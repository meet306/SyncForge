import { User } from '../models/User.js';
import { signToken } from '../middleware/auth.js';

export async function register(req, res, next) {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Name, email, and password are required.' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters long.' });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const existing = await User.findOne({ email: normalizedEmail });
    if (existing) {
      return res.status(409).json({ error: 'An account with this email address already exists.' });
    }

    const passwordHash = await User.hashPassword(password);
    const user = new User({
      name: name.trim(),
      email: normalizedEmail,
      passwordHash
    });

    await user.save();
    const token = signToken(user);

    return res.status(201).json({
      message: 'User registered successfully.',
      token,
      user: user.toJSON()
    });
  } catch (err) {
    next(err);
  }
}

export async function login(req, res, next) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const user = await User.findOne({ email: normalizedEmail });
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const token = signToken(user);

    return res.json({
      message: 'Login successful.',
      token,
      user: user.toJSON()
    });
  } catch (err) {
    next(err);
  }
}

export async function getMe(req, res) {
  return res.json({
    user: req.user.toJSON()
  });
}

export async function logout(req, res) {
  return res.json({ message: 'Logged out successfully.' });
}
