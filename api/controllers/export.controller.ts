import { Request, Response, NextFunction } from 'express';
import { exportService } from '../services/export.service';

export const exportController = {
  async exportCSV(req: Request, res: Response, next: NextFunction) {
    try {
      const { startDate, endDate } = req.query;
      const result = await exportService.exportToCSV(
        startDate as string | undefined,
        endDate as string | undefined
      );
      
      res.set(result.headers);
      res.send(result.content);
    } catch (error) {
      next(error);
    }
  },
};

export default exportController;
