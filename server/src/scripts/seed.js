import dotenv from 'dotenv';
import mongoose from 'mongoose';
import * as Y from 'yjs';
import { connectDB, disconnectDB } from '../config/db.js';
import { User } from '../models/User.js';
import { Document } from '../models/Document.js';
import { DocumentMember } from '../models/DocumentMember.js';
import { DocumentSnapshot } from '../models/DocumentSnapshot.js';
import { DocumentUpdate } from '../models/DocumentUpdate.js';
import { ShareLink } from '../models/ShareLink.js';

dotenv.config();

async function seed() {
  try {
    await connectDB();
    console.log('[Seed] Cleaning existing collections...');

    await Promise.all([
      User.deleteMany({}),
      Document.deleteMany({}),
      DocumentMember.deleteMany({}),
      DocumentSnapshot.deleteMany({}),
      DocumentUpdate.deleteMany({}),
      ShareLink.deleteMany({})
    ]);

    console.log('[Seed] Creating demo users...');
    const passwordHash = await User.hashPassword('Password123!');

    const alice = await User.create({
      name: 'Alice Vance',
      email: 'alice@syncforge.local',
      passwordHash,
      avatarColor: '#3b82f6'
    });

    const bob = await User.create({
      name: 'Bob Martin',
      email: 'bob@syncforge.local',
      passwordHash,
      avatarColor: '#10b981'
    });

    const charlie = await User.create({
      name: 'Charlie Stone',
      email: 'charlie@syncforge.local',
      passwordHash,
      avatarColor: '#8b5cf6'
    });

    console.log('[Seed] Creating sample documents...');

    // Document 1: SyncForge Architecture (Owned by Alice, Bob is Editor, Charlie is Viewer)
    const doc1 = await Document.create({
      title: 'SyncForge Product Architecture & Vision',
      ownerId: alice._id,
      metadata: {
        wordCount: 142,
        characterCount: 960,
        isArchived: false
      }
    });

    await DocumentMember.create([
      { documentId: doc1._id, userId: alice._id, role: 'owner' },
      { documentId: doc1._id, userId: bob._id, role: 'editor' },
      { documentId: doc1._id, userId: charlie._id, role: 'viewer' }
    ]);

    // Initialize Yjs snapshot for Doc 1
    const ydoc1 = new Y.Doc();
    const xmlFragment = ydoc1.getXmlFragment('default');
    
    const h1 = new Y.XmlElement('heading');
    h1.setAttribute('level', '1');
    const h1Text = new Y.XmlText('Welcome to SyncForge');
    h1.insert(0, [h1Text]);

    const p1 = new Y.XmlElement('paragraph');
    const p1Text = new Y.XmlText('SyncForge is a high-performance real-time collaborative document editor engineered with Conflict-free Replicated Data Types (CRDTs), MongoDB persistence, and Redis pub/sub.');
    p1.insert(0, [p1Text]);

    const p2 = new Y.XmlElement('paragraph');
    const p2Text = new Y.XmlText('Key features include live cursors, presence indicators, role-based access control, periodic snapshotting, and offline-resilient synchronisation.');
    p2.insert(0, [p2Text]);

    xmlFragment.insert(0, [h1, p1, p2]);

    const snapshot1Buffer = Buffer.from(Y.encodeStateAsUpdate(ydoc1));
    await DocumentSnapshot.create({
      documentId: doc1._id,
      snapshot: snapshot1Buffer,
      version: 1,
      plainTextPreview: 'Welcome to SyncForge. SyncForge is a high-performance real-time collaborative document editor...'
    });

    // Document 2: Quarterly Roadmap (Owned by Bob, Alice is Editor)
    const doc2 = await Document.create({
      title: 'Quarterly Growth & Engineering Roadmap',
      ownerId: bob._id,
      metadata: {
        wordCount: 88,
        characterCount: 520,
        isArchived: false
      }
    });

    await DocumentMember.create([
      { documentId: doc2._id, userId: bob._id, role: 'owner' },
      { documentId: doc2._id, userId: alice._id, role: 'editor' }
    ]);

    // Document 3: CRDT Specification (Owned by Alice)
    const doc3 = await Document.create({
      title: 'Real-Time Collaboration CRDT Specification',
      ownerId: alice._id,
      metadata: {
        wordCount: 45,
        characterCount: 310,
        isArchived: false
      }
    });

    await DocumentMember.create([
      { documentId: doc3._id, userId: alice._id, role: 'owner' }
    ]);

    // Create a public share link for Doc 1
    const rawToken = 'demo-share-token-syncforge-2026';
    await ShareLink.create({
      documentId: doc1._id,
      tokenHash: ShareLink.hashToken(rawToken),
      permission: 'editor',
      createdBy: alice._id
    });

    console.log('-------------------------------------------------------');
    console.log('✅ Database seeded successfully!');
    console.log('Demo Accounts (Password for all: Password123!):');
    console.log('  1. Alice Vance (Owner):   alice@syncforge.local');
    console.log('  2. Bob Martin (Editor):   bob@syncforge.local');
    console.log('  3. Charlie Stone (Viewer): charlie@syncforge.local');
    console.log('Demo Share Link Token:');
    console.log('  Token: demo-share-token-syncforge-2026');
    console.log('-------------------------------------------------------');

    await disconnectDB();
    process.exit(0);
  } catch (err) {
    console.error('[Seed Error]:', err);
    process.exit(1);
  }
}

seed();
