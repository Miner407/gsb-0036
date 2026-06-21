import { Router } from 'express';
import configController from '../controllers/config.controller';

const router = Router();

router.get('/', configController.getConfig);
router.put('/', configController.updateConfig);

router.get('/shifts', configController.getAllShiftConfigs);
router.put('/shifts', configController.batchUpdateShiftConfigs);
router.put('/shifts/batch', configController.batchUpdateShiftConfigs);
router.get('/shifts/:shiftType', configController.getShiftConfig);
router.put('/shifts/:shiftType', configController.updateShiftConfig);

export default router;
