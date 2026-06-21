import { Request, Response, NextFunction } from 'express';
import { exportService } from '../services/export.service';
import { ShiftType } from '../../shared/types';

export const exportController = {
  async exportCSV(req: Request, res: Response, next: NextFunction) {
    try {
      const { startDate, endDate, shiftType } = req.query;
      const result = await exportService.exportToCSV(
        startDate as string | undefined,
        endDate as string | undefined,
        shiftType as ShiftType | undefined
      );
      
      res.set(result.headers);
      res.send(result.content);
    } catch (error) {
      next(error);
    }
  },
};

export default exportController;
