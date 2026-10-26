import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as Y from 'yjs';
import mongoose from 'mongoose';
import { setupTestDB, teardownTestDB } from './setup.js';
import { Document } from '../src/models/Document.js';
import { DocumentUpdate } from '../src/models/DocumentUpdate.js';
import { DocumentSnapshot } from '../src/models/DocumentSnapshot.js';
import {
  persistUpdate,
  createDocumentSnapshot,
  loadDocumentFromStorage
} from '../src/collaboration/persistence.js';

describe('Real-Time CRDT Collaboration & Persistence Engine', () => {
  let testDocId;

  beforeAll(async () => {
    await setupTestDB();
    await Promise.all([
      Document.deleteMany({}),
      DocumentUpdate.deleteMany({}),
      DocumentSnapshot.deleteMany({})
    ]);

    testDocId = new mongoose.Types.ObjectId();
    await Document.create({
      _id: testDocId,
      title: 'CRDT Persistence Verification Doc',
      ownerId: new mongoose.Types.ObjectId()
    });
  });

  afterAll(async () => {
    await teardownTestDB();
  });

  it('should merge concurrent offline edits deterministically without conflicts (CRDT verification)', () => {
    const docA = new Y.Doc();
    const docB = new Y.Doc();

    const textA = docA.getText('content');
    const textB = docB.getText('content');

    // Initial synchronized baseline
    textA.insert(0, 'SyncForge ');
    const initialUpdate = Y.encodeStateAsUpdate(docA);
    Y.applyUpdate(docB, initialUpdate);

    expect(textB.toString()).toBe('SyncForge ');

    // Concurrent edits while disconnected
    textA.insert(10, 'is FAST! ');
    textB.insert(10, 'is RELIABLE! ');

    // Exchange updates
    const updateA = Y.encodeStateAsUpdate(docA, Y.encodeStateVector(docB));
    const updateB = Y.encodeStateAsUpdate(docB, Y.encodeStateVector(docA));

    Y.applyUpdate(docB, updateA);
    Y.applyUpdate(docA, updateB);

    // Both documents MUST converge to the exact same text
    expect(textA.toString()).toBe(textB.toString());
    expect(textA.toString().includes('FAST')).toBe(true);
    expect(textA.toString().includes('RELIABLE')).toBe(true);
  });

  it('should persist incremental updates and restore them into a fresh Y.Doc', async () => {
    const originalDoc = new Y.Doc();
    const originalText = originalDoc.getText('content');

    originalText.insert(0, 'First sentence of the document. ');
    const update1 = Y.encodeStateAsUpdate(originalDoc);
    await persistUpdate(testDocId, update1, 1);

    originalText.insert(originalText.length, 'Second sentence appended later.');
    const update2 = Y.encodeStateAsUpdate(originalDoc, Y.encodeStateVectorFromUpdate(update1));
    await persistUpdate(testDocId, update2, 2);

    // Now restore into a brand new, empty Y.Doc as if the server restarted
    const recoveredDoc = new Y.Doc();
    const loadResult = await loadDocumentFromStorage(testDocId, recoveredDoc);

    expect(loadResult.version).toBe(2);
    expect(loadResult.updateCount).toBe(2);
    expect(recoveredDoc.getText('content').toString()).toBe(
      'First sentence of the document. Second sentence appended later.'
    );
  });

  it('should create compact snapshots and compact older update records', async () => {
    const doc = new Y.Doc();
    doc.getText('content').insert(0, 'Snapshot content baseline.');

    // Save snapshot at version 5
    await createDocumentSnapshot(testDocId, doc, 5);

    const savedSnapshot = await DocumentSnapshot.findOne({ documentId: testDocId, version: 5 });
    expect(savedSnapshot).toBeDefined();
    expect(savedSnapshot.snapshot).toBeDefined();

    // Verify older updates were pruned
    const oldUpdates = await DocumentUpdate.find({ documentId: testDocId, sequenceNumber: { $lte: 5 } });
    expect(oldUpdates.length).toBe(0);

    // Verify loading doc restores snapshot properly
    const restoredDoc = new Y.Doc();
    const result = await loadDocumentFromStorage(testDocId, restoredDoc);

    expect(result.hasSnapshot).toBe(true);
    expect(restoredDoc.getText('content').toString()).toBe('Snapshot content baseline.');
  });
});
