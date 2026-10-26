import jwt from 'jsonwebtoken';
import { User } from '../models/User.js';
import { Document } from '../models/Document.js';
import { DocumentMember } from '../models/DocumentMember.js';

const ROLE_HIERARCHY = {
  viewer: 1,
  editor: 2,
  owner: 3
};

export function signToken(user) {
  const secret = process.env.JWT_SECRET || 'syncforge_super_secure_jwt_secret_key_minimum_32_chars';
  const expiresIn = process.env.JWT_EXPIRES_IN || '7d';
  return jwt.sign(
    {
      id: user._id,
      email: user.email,
      name: user.name,
      avatarColor: user.avatarColor
    },
    secret,
    { expiresIn }
  );
}

export function verifyToken(token) {
  const secret = process.env.JWT_SECRET || 'syncforge_super_secure_jwt_secret_key_minimum_32_chars';
  return jwt.verify(token, secret);
}

export async function authenticate(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    let token = null;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    } else if (req.query && req.query.token) {
      token = req.query.token;
    }

    if (!token) {
      return res.status(401).json({ error: 'Authentication required. No token provided.' });
    }

    const decoded = verifyToken(token);
    const user = await User.findById(decoded.id);
    if (!user) {
      return res.status(401).json({ error: 'User associated with token no longer exists.' });
    }

    req.user = user;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token has expired. Please log in again.' });
    }
    return res.status(401).json({ error: 'Invalid authentication token.' });
  }
}

export function authorizeDocumentRole(minimumRole = 'viewer') {
  return async (req, res, next) => {
    try {
      const documentId = req.params.id || req.params.documentId;
      if (!documentId) {
        return res.status(400).json({ error: 'Document ID is required.' });
      }

      const doc = await Document.findById(documentId);
      if (!doc) {
        return res.status(404).json({ error: 'Document not found.' });
      }

      // Check if user is the direct owner
      if (doc.ownerId.toString() === req.user._id.toString()) {
        req.document = doc;
        req.userRole = 'owner';
        return next();
      }

      // Check membership
      const member = await DocumentMember.findOne({
        documentId: doc._id,
        userId: req.user._id
      });

      if (!member) {
        return res.status(403).json({ error: 'You do not have permission to access this document.' });
      }

      const requiredLevel = ROLE_HIERARCHY[minimumRole] || 1;
      const userLevel = ROLE_HIERARCHY[member.role] || 0;

      if (userLevel < requiredLevel) {
        return res.status(403).json({
          error: `Insufficient permissions. Required role: ${minimumRole}, your role: ${member.role}.`
        });
      }

      req.document = doc;
      req.userRole = member.role;
      next();
    } catch (err) {
      next(err);
    }
  };
}
