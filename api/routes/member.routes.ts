import { Router } from 'express';
import memberController from '../controllers/member.controller';

const router = Router();

router.get('/', memberController.getAllMembers);
router.post('/', memberController.createMember);
router.get('/:id', memberController.getMemberById);
router.put('/:id', memberController.updateMember);
router.delete('/:id', memberController.deleteMember);
router.get('/:id/unavailable', memberController.getUnavailableDates);
router.post('/:id/unavailable', memberController.addUnavailableDates);
router.delete('/unavailable/:id', memberController.deleteUnavailableDate);

export default router;
