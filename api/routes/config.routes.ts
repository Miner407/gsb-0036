import { Router } from 'express';
import configController from '../controllers/config.controller';

const router = Router();

router.get('/', configController.getConfig);
router.put('/', configController.updateConfig);

export default router;
