import * as Y from 'yjs';
import { Document } from '../models/Document.js';
import { DocumentSnapshot } from '../models/DocumentSnapshot.js';
import { DocumentUpdate } from '../models/DocumentUpdate.js';

function toUint8(data) {
  if (!data) return new Uint8Array(0);
  if (data instanceof Uint8Array && !Buffer.isBuffer(data)) return data;
  if (data.read && typeof data.length === 'function') {
    return new Uint8Array(data.read(0, data.length()));
  }
  if (Buffer.isBuffer(data)) {
    return new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
  }
  return new Uint8Array(Buffer.from(data));
}

export async function loadDocumentFromStorage(documentId, ydoc) {
  try {
    // 1. Fetch latest snapshot
    const latestSnapshot = await DocumentSnapshot.findOne({ documentId })
      .sort({ version: -1 })
      .lean();

    let baseVersion = 0;

    if (latestSnapshot && latestSnapshot.snapshot) {
      Y.applyUpdate(ydoc, toUint8(latestSnapshot.snapshot), 'persistence');
      baseVersion = latestSnapshot.version || 1;
    }

    // 2. Fetch updates created after this snapshot version
    const updates = await DocumentUpdate.find({
      documentId,
      sequenceNumber: { $gt: baseVersion }
    })
      .sort({ sequenceNumber: 1 })
      .lean();

    let currentVersion = baseVersion;

    for (const item of updates) {
      if (item.update) {
        Y.applyUpdate(ydoc, toUint8(item.update), 'persistence');
        if (item.sequenceNumber > currentVersion) {
          currentVersion = item.sequenceNumber;
        }
      }
    }

    return {
      version: currentVersion,
      updateCount: updates.length,
      hasSnapshot: !!latestSnapshot
    };
  } catch (err) {
    console.error(`[Persistence Error] Failed to load document ${documentId}:`, err);
    throw err;
  }
}

export async function persistUpdate(documentId, updateBuffer, sequenceNumber, userId = null) {
  try {
    const docUpdate = new DocumentUpdate({
      documentId,
      update: Buffer.from(updateBuffer),
      sequenceNumber,
      createdBy: userId
    });
    await docUpdate.save();
    return docUpdate;
  } catch (err) {
    console.error(`[Persistence Error] Failed to persist update for doc ${documentId}:`, err);
    throw err;
  }
}

export async function createDocumentSnapshot(documentId, ydoc, version) {
  try {
    const snapshotBuffer = Buffer.from(Y.encodeStateAsUpdate(ydoc));

    // Calculate plain text preview and word count from prosemirror / yjs fragment
    let plainText = '';
    try {
      const fragment = ydoc.getXmlFragment('default');
      plainText = fragment.toString().replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    } catch {
      plainText = '';
    }

    const words = plainText.length > 0 ? plainText.split(/\s+/).filter(Boolean).length : 0;
    const chars = plainText.length;

    const snapshot = new DocumentSnapshot({
      documentId,
      snapshot: snapshotBuffer,
      version,
      plainTextPreview: plainText.slice(0, 300)
    });

    await snapshot.save();

    // Update document metadata
    await Document.findByIdAndUpdate(documentId, {
      $set: {
        'metadata.wordCount': words,
        'metadata.characterCount': chars,
        updatedAt: new Date()
      }
    });

    // Prune compacted updates older than version to maintain optimal performance and storage limits
    await DocumentUpdate.deleteMany({
      documentId,
      sequenceNumber: { $lte: version }
    });

    return snapshot;
  } catch (err) {
    console.error(`[Persistence Error] Failed to create snapshot for ${documentId}:`, err);
    throw err;
  }
}
