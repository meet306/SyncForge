import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { connectDB, disconnectDB } from '../config/db.js';
import { User } from '../models/User.js';
import { Document } from '../models/Document.js';
import { DocumentMember } from '../models/DocumentMember.js';
import { DocumentSnapshot } from '../models/DocumentSnapshot.js';
import { DocumentUpdate } from '../models/DocumentUpdate.js';
import { ShareLink } from '../models/ShareLink.js';

dotenv.config();

async function cleanData() {
  try {
    await connectDB();
    console.log('[Clean Data] Purging all fake and demo data from MongoDB collections...');

    await Promise.all([
      User.deleteMany({}),
      Document.deleteMany({}),
      DocumentMember.deleteMany({}),
      DocumentSnapshot.deleteMany({}),
      DocumentUpdate.deleteMany({}),
      ShareLink.deleteMany({})
    ]);

    console.log('✅ All fake and demo data removed successfully.');
    console.log('The database is now clean for real user registrations, logins, and document sharing.');

    await disconnectDB();
    process.exit(0);
  } catch (err) {
    console.error('[Clean Data Error]:', err);
    process.exit(1);
  }
}

cleanData();
