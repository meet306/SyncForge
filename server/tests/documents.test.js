import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { setupTestDB, teardownTestDB } from './setup.js';
import { User } from '../src/models/User.js';
import { Document } from '../src/models/Document.js';
import { DocumentMember } from '../src/models/DocumentMember.js';

describe('Document Management & Permissions API', () => {
  let app;
  let ownerToken;
  let ownerUser;
  let editorToken;
  let editorUser;
  let viewerToken;
  let viewerUser;
  let outsiderToken;
  let outsiderUser;
  let testDocId;

  beforeAll(async () => {
    await setupTestDB();
    await Promise.all([
      User.deleteMany({}),
      Document.deleteMany({}),
      DocumentMember.deleteMany({})
    ]);

    app = createApp();

    // Register 4 test users
    const registerUser = async (name, email) => {
      const res = await request(app).post('/api/auth/register').send({
        name,
        email,
        password: 'Password123!'
      });
      return { user: res.body.user, token: res.body.token };
    };

    const owner = await registerUser('Owner User', 'owner@example.com');
    ownerUser = owner.user;
    ownerToken = owner.token;

    const editor = await registerUser('Editor User', 'editor@example.com');
    editorUser = editor.user;
    editorToken = editor.token;

    const viewer = await registerUser('Viewer User', 'viewer@example.com');
    viewerUser = viewer.user;
    viewerToken = viewer.token;

    const outsider = await registerUser('Outsider User', 'outsider@example.com');
    outsiderUser = outsider.user;
    outsiderToken = outsider.token;
  });

  afterAll(async () => {
    await teardownTestDB();
  });

  it('should allow authenticated user to create a new document', async () => {
    const res = await request(app)
      .post('/api/documents')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ title: 'Quarterly Planning Doc' });

    expect(res.status).toBe(201);
    expect(res.body.document).toBeDefined();
    expect(res.body.document.title).toBe('Quarterly Planning Doc');
    expect(res.body.document.userRole).toBe('owner');
    testDocId = res.body.document._id;
  });

  it('should list documents with user role and pagination', async () => {
    const res = await request(app)
      .get('/api/documents')
      .set('Authorization', `Bearer ${ownerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.documents).toBeInstanceOf(Array);
    expect(res.body.documents.length).toBeGreaterThanOrEqual(1);
    expect(res.body.pagination).toBeDefined();
  });

  it('should allow owner to add an editor and a viewer collaborator', async () => {
    // Add editor
    const addEditorRes = await request(app)
      .post(`/api/documents/${testDocId}/members`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ email: 'editor@example.com', role: 'editor' });

    expect(addEditorRes.status).toBe(201);
    expect(addEditorRes.body.member.role).toBe('editor');

    // Add viewer
    const addViewerRes = await request(app)
      .post(`/api/documents/${testDocId}/members`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ email: 'viewer@example.com', role: 'viewer' });

    expect(addViewerRes.status).toBe(201);
    expect(addViewerRes.body.member.role).toBe('viewer');
  });

  it('should allow editor to read and update document title', async () => {
    const getRes = await request(app)
      .get(`/api/documents/${testDocId}`)
      .set('Authorization', `Bearer ${editorToken}`);

    expect(getRes.status).toBe(200);
    expect(getRes.body.document.userRole).toBe('editor');

    const updateRes = await request(app)
      .patch(`/api/documents/${testDocId}`)
      .set('Authorization', `Bearer ${editorToken}`)
      .send({ title: 'Updated By Editor' });

    expect(updateRes.status).toBe(200);
    expect(updateRes.body.document.title).toBe('Updated By Editor');
  });

  it('should allow viewer to read the document', async () => {
    const res = await request(app)
      .get(`/api/documents/${testDocId}`)
      .set('Authorization', `Bearer ${viewerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.document.userRole).toBe('viewer');
  });

  it('should REJECT viewer from updating document title (403 Forbidden)', async () => {
    const res = await request(app)
      .patch(`/api/documents/${testDocId}`)
      .set('Authorization', `Bearer ${viewerToken}`)
      .send({ title: 'Viewer Attempted Change' });

    expect(res.status).toBe(403);
    expect(res.body.error).toContain('Insufficient permissions');
  });

  it('should REJECT outsider from reading the document (403 Forbidden)', async () => {
    const res = await request(app)
      .get(`/api/documents/${testDocId}`)
      .set('Authorization', `Bearer ${outsiderToken}`);

    expect(res.status).toBe(403);
    expect(res.body.error).toContain('do not have permission');
  });

  it('should create and verify share link for public access', async () => {
    const shareRes = await request(app)
      .post(`/api/documents/${testDocId}/share-links`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ permission: 'viewer', expiresInHours: 24 });

    expect(shareRes.status).toBe(201);
    expect(shareRes.body.shareLink.token).toBeDefined();

    const rawToken = shareRes.body.shareLink.token;

    // Access via public share link
    const accessRes = await request(app).get(`/api/documents/public/share/${rawToken}`);
    expect(accessRes.status).toBe(200);
    expect(accessRes.body.document.title).toBe('Updated By Editor');
    expect(accessRes.body.permission).toBe('viewer');
  });

  it('should reject non-owner from deleting document', async () => {
    const res = await request(app)
      .delete(`/api/documents/${testDocId}`)
      .set('Authorization', `Bearer ${editorToken}`);

    expect(res.status).toBe(403);
  });

  it('should allow owner to delete document', async () => {
    const res = await request(app)
      .delete(`/api/documents/${testDocId}`)
      .set('Authorization', `Bearer ${ownerToken}`);

    expect(res.status).toBe(200);

    // Verify it is gone
    const checkRes = await request(app)
      .get(`/api/documents/${testDocId}`)
      .set('Authorization', `Bearer ${ownerToken}`);

    expect(checkRes.status).toBe(404);
  });
});
