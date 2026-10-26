import express from 'express';
import {
  listDocuments,
  createDocument,
  getDocumentById,
  updateDocument,
  deleteDocument,
  addMember,
  updateMemberRole,
  removeMember,
  createShareLink,
  revokeShareLink,
  accessPublicShare
} from '../controllers/documentController.js';
import { authenticate, authorizeDocumentRole } from '../middleware/auth.js';

const router = express.Router();

// Public share link inspection
router.get('/public/share/:token', accessPublicShare);

// Authenticated document routes
router.use(authenticate);

router.get('/', listDocuments);
router.post('/', createDocument);

router.get('/:id', authorizeDocumentRole('viewer'), getDocumentById);
router.patch('/:id', authorizeDocumentRole('editor'), updateDocument);
router.delete('/:id', authorizeDocumentRole('owner'), deleteDocument);

// Collaborator management
router.post('/:id/members', authorizeDocumentRole('owner'), addMember);
router.patch('/:id/members/:targetUserId', authorizeDocumentRole('owner'), updateMemberRole);
router.delete('/:id/members/:targetUserId', authorizeDocumentRole('viewer'), removeMember);

// Share links
router.post('/:id/share-links', authorizeDocumentRole('editor'), createShareLink);
router.delete('/:id/share-links/:linkId', authorizeDocumentRole('editor'), revokeShareLink);

export default router;
