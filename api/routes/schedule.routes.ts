import { Router } from 'express';
import scheduleController from '../controllers/schedule.controller';

const router = Router();

router.get('/', scheduleController.getSchedules);
router.post('/generate', scheduleController.generateSchedule);
router.post('/swap', scheduleController.swapSchedules);
router.post('/replace', scheduleController.replaceSchedule);
router.post('/leave', scheduleController.markLeave);
router.delete('/leave/:id', scheduleController.cancelLeave);
router.get('/conflicts', scheduleController.detectConflicts);
router.get('/statistics', scheduleController.getStatistics);

export default router;
