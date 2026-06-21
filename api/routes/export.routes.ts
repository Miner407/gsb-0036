import { Router } from 'express';
import exportController from '../controllers/export.controller';

const router = Router();

router.get('/csv', exportController.exportCSV);

export default router;
