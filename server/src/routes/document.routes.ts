import express from 'express';
import { DocumentController } from '../controllers/document.controller';
import { authenticate } from '../middleware/authenticate';
const router = express.Router();
router.use(authenticate);
router.get('/', DocumentController.getStoredDocuments);
router.get('/:id/download', DocumentController.downloadDocument);
router.delete('/:id', DocumentController.deleteDocument);
export default router;