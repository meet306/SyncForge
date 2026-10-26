import mongoose from 'mongoose';
import { Document } from '../models/Document.js';
import { DocumentMember } from '../models/DocumentMember.js';
import { DocumentUpdate } from '../models/DocumentUpdate.js';
import { DocumentSnapshot } from '../models/DocumentSnapshot.js';
import { ShareLink } from '../models/ShareLink.js';
import { User } from '../models/User.js';
import { roomManager } from '../collaboration/server.js';
import { sendDocumentInvitationEmail } from '../services/emailService.js';

export async function listDocuments(req, res, next) {
  try {
    const userId = req.user._id;
    const {
      filter = 'all',
      search = '',
      sortBy = 'updatedAt',
      sortOrder = 'desc',
      page = 1,
      limit = 12
    } = req.query;

    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = Math.min(50, Math.max(1, parseInt(limit, 10)));
    const skip = (pageNum - 1) * limitNum;

    // Determine document IDs based on filter
    let documentIds = [];

    if (filter === 'owned') {
      const ownedDocs = await Document.find({
        ownerId: userId,
        'metadata.isArchived': false
      }).select('_id');
      documentIds = ownedDocs.map((d) => d._id);
    } else if (filter === 'shared') {
      const memberships = await DocumentMember.find({
        userId,
        role: { $ne: 'owner' }
      }).select('documentId');
      documentIds = memberships.map((m) => m.documentId);
    } else {
      // 'all'
      const [owned, memberships] = await Promise.all([
        Document.find({ ownerId: userId, 'metadata.isArchived': false }).select('_id'),
        DocumentMember.find({ userId }).select('documentId')
      ]);
      const set = new Set([
        ...owned.map((d) => d._id.toString()),
        ...memberships.map((m) => m.documentId.toString())
      ]);
      documentIds = Array.from(set).map((id) => new mongoose.Types.ObjectId(id));
    }

    const query = {
      _id: { $in: documentIds },
      'metadata.isArchived': false
    };

    if (search && search.trim()) {
      query.title = { $regex: search.trim(), $options: 'i' };
    }

    const sortOption = {};
    sortOption[sortBy] = sortOrder === 'asc' ? 1 : -1;

    const [documents, total] = await Promise.all([
      Document.find(query)
        .populate('ownerId', 'name email avatarColor')
        .sort(sortOption)
        .skip(skip)
        .limit(limitNum)
        .lean(),
      Document.countDocuments(query)
    ]);

    // Attach user's role to each document
    const docIds = documents.map((d) => d._id);
    const userMemberships = await DocumentMember.find({
      documentId: { $in: docIds },
      userId
    }).lean();

    const roleMap = new Map();
    userMemberships.forEach((m) => roleMap.set(m.documentId.toString(), m.role));

    // Get collaborator counts
    const memberCounts = await DocumentMember.aggregate([
      { $match: { documentId: { $in: docIds } } },
      { $group: { _id: '$documentId', count: { $sum: 1 } } }
    ]);
    const memberCountMap = new Map();
    memberCounts.forEach((c) => memberCountMap.set(c._id.toString(), c.count));

    const enrichedDocs = documents.map((doc) => {
      const docIdStr = doc._id.toString();
      const isOwner = doc.ownerId?._id?.toString() === userId.toString();
      return {
        ...doc,
        userRole: isOwner ? 'owner' : roleMap.get(docIdStr) || 'viewer',
        collaboratorCount: memberCountMap.get(docIdStr) || 1
      };
    });

    return res.json({
      documents: enrichedDocs,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum)
      }
    });
  } catch (err) {
    next(err);
  }
}

export async function createDocument(req, res, next) {
  try {
    const { title = 'Untitled Document' } = req.body;
    const userId = req.user._id;

    const doc = new Document({
      title: title.trim() || 'Untitled Document',
      ownerId: userId,
      metadata: {
        wordCount: 0,
        characterCount: 0,
        isArchived: false
      }
    });

    await doc.save();

    // Owner membership record
    await DocumentMember.create({
      documentId: doc._id,
      userId,
      role: 'owner'
    });

    const populated = await Document.findById(doc._id).populate('ownerId', 'name email avatarColor');

    return res.status(201).json({
      message: 'Document created successfully.',
      document: {
        ...populated.toObject(),
        userRole: 'owner',
        collaboratorCount: 1
      }
    });
  } catch (err) {
    next(err);
  }
}

export async function getDocumentById(req, res, next) {
  try {
    const doc = req.document;
    const userRole = req.userRole;

    const populatedDoc = await Document.findById(doc._id)
      .populate('ownerId', 'name email avatarColor')
      .lean();

    // Fetch members
    const members = await DocumentMember.find({ documentId: doc._id })
      .populate('userId', 'name email avatarColor')
      .lean();

    // Fetch share links if owner/editor
    let shareLinks = [];
    if (userRole === 'owner' || userRole === 'editor') {
      shareLinks = await ShareLink.find({ documentId: doc._id })
        .populate('createdBy', 'name email')
        .sort({ createdAt: -1 })
        .lean();
    }

    return res.json({
      document: {
        ...populatedDoc,
        userRole
      },
      members: members.map((m) => ({
        id: m._id,
        user: m.userId,
        role: m.role,
        createdAt: m.createdAt
      })),
      shareLinks
    });
  } catch (err) {
    next(err);
  }
}

export async function updateDocument(req, res, next) {
  try {
    const { title, isArchived } = req.body;
    const doc = req.document;

    if (title !== undefined) {
      doc.title = title.trim();
    }
    if (isArchived !== undefined) {
      doc.metadata.isArchived = Boolean(isArchived);
    }

    await doc.save();
    return res.json({
      message: 'Document updated successfully.',
      document: doc
    });
  } catch (err) {
    next(err);
  }
}

export async function deleteDocument(req, res, next) {
  try {
    const doc = req.document;

    // Only owner can delete document
    if (req.userRole !== 'owner') {
      return res.status(403).json({ error: 'Only the document owner can delete this document.' });
    }

    // Clean up all associated entities
    await Promise.all([
      Document.findByIdAndDelete(doc._id),
      DocumentMember.deleteMany({ documentId: doc._id }),
      DocumentUpdate.deleteMany({ documentId: doc._id }),
      DocumentSnapshot.deleteMany({ documentId: doc._id }),
      ShareLink.deleteMany({ documentId: doc._id })
    ]);

    // Teardown in-memory room if active
    const activeRoom = roomManager.getRoom(doc._id.toString());
    if (activeRoom) {
      activeRoom.destroy();
    }

    return res.json({ message: 'Document deleted successfully.' });
  } catch (err) {
    next(err);
  }
}

export async function addMember(req, res, next) {
  try {
    const { email, role = 'viewer' } = req.body;
    const doc = req.document;

    if (req.userRole !== 'owner') {
      return res.status(403).json({ error: 'Only the document owner can add collaborators directly.' });
    }

    if (!email) {
      return res.status(400).json({ error: 'User email is required.' });
    }

    if (!['editor', 'viewer'].includes(role)) {
      return res.status(400).json({ error: 'Role must be either editor or viewer.' });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
    const inviterName = req.user.name;
    const inviterEmail = req.user.email;
    const documentTitle = doc.title;

    const targetUser = await User.findOne({ email: normalizedEmail });

    if (targetUser) {
      if (targetUser._id.toString() === doc.ownerId.toString()) {
        return res.status(400).json({ error: 'User is already the document owner.' });
      }

      const membership = await DocumentMember.findOneAndUpdate(
        { documentId: doc._id, userId: targetUser._id },
        { role },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      ).populate('userId', 'name email avatarColor');

      // Dispatch real invitation email to registered user
      const shareUrl = `${clientUrl}/document/${doc._id}`;
      sendDocumentInvitationEmail({
        toEmail: targetUser.email,
        inviterName,
        inviterEmail,
        documentTitle,
        role,
        shareUrl
      }).catch((err) => console.warn('[Invitation Notice]:', err.message));

      return res.status(201).json({
        message: `Collaborator ${targetUser.name} added as ${role}. Real invitation email sent to ${targetUser.email}!`,
        member: {
          id: membership._id,
          user: membership.userId,
          role: membership.role
        }
      });
    } else {
      // User is not yet registered: generate a direct share link and email them
      const rawToken = ShareLink.generateRawToken();
      const tokenHash = ShareLink.hashToken(rawToken);

      const link = new ShareLink({
        documentId: doc._id,
        tokenHash,
        permission: role,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
        createdBy: req.user._id
      });
      await link.save();

      const shareUrl = `${clientUrl}/share/${rawToken}`;
      sendDocumentInvitationEmail({
        toEmail: normalizedEmail,
        inviterName,
        inviterEmail,
        documentTitle,
        role,
        shareUrl
      }).catch((err) => console.warn('[Invitation Notice]:', err.message));

      return res.status(201).json({
        message: `Invitation email sent to ${normalizedEmail} with ${role} permissions!`,
        invitedEmail: normalizedEmail,
        role,
        shareUrl
      });
    }
  } catch (err) {
    next(err);
  }
}

export async function updateMemberRole(req, res, next) {
  try {
    const { targetUserId } = req.params;
    const { role } = req.body;
    const doc = req.document;

    if (req.userRole !== 'owner') {
      return res.status(403).json({ error: 'Only the document owner can update roles.' });
    }

    if (!['editor', 'viewer'].includes(role)) {
      return res.status(400).json({ error: 'Role must be either editor or viewer.' });
    }

    if (targetUserId === doc.ownerId.toString()) {
      return res.status(400).json({ error: 'Cannot change owner role.' });
    }

    const membership = await DocumentMember.findOneAndUpdate(
      { documentId: doc._id, userId: targetUserId },
      { role },
      { new: true }
    ).populate('userId', 'name email avatarColor');

    if (!membership) {
      return res.status(404).json({ error: 'Collaborator not found.' });
    }

    return res.json({
      message: 'Collaborator role updated successfully.',
      member: {
        id: membership._id,
        user: membership.userId,
        role: membership.role
      }
    });
  } catch (err) {
    next(err);
  }
}

export async function removeMember(req, res, next) {
  try {
    const { targetUserId } = req.params;
    const doc = req.document;

    const isSelfRemoval = targetUserId === req.user._id.toString();
    const isOwner = req.userRole === 'owner';

    if (!isSelfRemoval && !isOwner) {
      return res.status(403).json({ error: 'Only the document owner can remove other collaborators.' });
    }

    if (targetUserId === doc.ownerId.toString()) {
      return res.status(400).json({ error: 'Document owner cannot be removed.' });
    }

    const deleted = await DocumentMember.findOneAndDelete({
      documentId: doc._id,
      userId: targetUserId
    });

    if (!deleted) {
      return res.status(404).json({ error: 'Collaborator not found.' });
    }

    return res.json({ message: 'Collaborator removed successfully.' });
  } catch (err) {
    next(err);
  }
}

export async function createShareLink(req, res, next) {
  try {
    const { permission = 'viewer', expiresInHours = null } = req.body;
    const doc = req.document;

    if (!['viewer', 'editor'].includes(permission)) {
      return res.status(400).json({ error: 'Permission must be viewer or editor.' });
    }

    const rawToken = ShareLink.generateRawToken();
    const tokenHash = ShareLink.hashToken(rawToken);

    let expiresAt = null;
    if (expiresInHours && !isNaN(expiresInHours)) {
      expiresAt = new Date(Date.now() + expiresInHours * 60 * 60 * 1000);
    }

    const link = new ShareLink({
      documentId: doc._id,
      tokenHash,
      permission,
      expiresAt,
      createdBy: req.user._id
    });

    await link.save();

    return res.status(201).json({
      message: 'Share link generated successfully.',
      shareLink: {
        id: link._id,
        token: rawToken, // Return raw token only once on creation
        permission: link.permission,
        expiresAt: link.expiresAt,
        isRevoked: link.isRevoked
      }
    });
  } catch (err) {
    next(err);
  }
}

export async function revokeShareLink(req, res, next) {
  try {
    const { linkId } = req.params;
    const doc = req.document;

    const link = await ShareLink.findOne({ _id: linkId, documentId: doc._id });
    if (!link) {
      return res.status(404).json({ error: 'Share link not found.' });
    }

    link.isRevoked = true;
    await link.save();

    return res.json({ message: 'Share link revoked successfully.' });
  } catch (err) {
    next(err);
  }
}

export async function accessPublicShare(req, res, next) {
  try {
    const { token } = req.params;
    if (!token) {
      return res.status(400).json({ error: 'Share token is required.' });
    }

    const tokenHash = ShareLink.hashToken(token);
    const link = await ShareLink.findOne({
      tokenHash,
      isRevoked: false
    }).populate('documentId');

    if (!link || !link.documentId) {
      return res.status(404).json({ error: 'Invalid or revoked share link.' });
    }

    if (link.expiresAt && new Date(link.expiresAt) < new Date()) {
      return res.status(410).json({ error: 'This share link has expired.' });
    }

    return res.json({
      document: {
        _id: link.documentId._id,
        title: link.documentId.title,
        metadata: link.documentId.metadata,
        updatedAt: link.documentId.updatedAt
      },
      permission: link.permission
    });
  } catch (err) {
    next(err);
  }
}
