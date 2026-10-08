import { Router } from 'express';
import { AuthController } from '../controllers/authController';
import { ConsumerController } from '../controllers/consumerController';
import { ReadingController } from '../controllers/readingController';
import { ReaderController, StatsController, AuditController, OcrController } from '../controllers/miscControllers';

const router = Router();

// HEALTH CHECK
router.get('/health', (req, res) => {
  res.json({
    status: 'ONLINE',
    service: 'Tagoloan Water District API Node',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
  });
});

// AUTH
router.post('/auth/login', AuthController.login);
router.post('/auth/register', AuthController.register);

// CONSUMERS
router.get('/consumers', ConsumerController.getAll);
router.get('/consumers/:accountNumber', ConsumerController.getByAccountNumber);

// READINGS
router.get('/readings', ReadingController.getAll);
router.post('/readings', ReadingController.create);
router.post('/readings/batch', ReadingController.syncBatch);
router.patch('/readings/:id/status', ReadingController.updateStatus);

// READERS
router.get('/readers', ReaderController.getAll);
router.patch('/readers/:id/status', ReaderController.updateStatus);

// STATS
router.get('/stats', StatsController.getDashboardStats);

// AUDIT
router.get('/audit-logs', AuditController.getAll);

// OCR CAMERA RECOGNITION
router.post('/ocr/analyze', OcrController.analyze);

export default router;
