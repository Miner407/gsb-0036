import { Request, Response, NextFunction } from 'express';
import { configService } from '../services/config.service';

export const configController = {
  async getConfig(req: Request, res: Response, next: NextFunction) {
    try {
      const config = await configService.getConfig();
      res.json({ data: config });
    } catch (error) {
      next(error);
    }
  },

  async updateConfig(req: Request, res: Response, next: NextFunction) {
    try {
      const { startDate, cycleDays, dailyRequired, maxConsecutiveDays, balanceWeight } = req.body;
      const config = await configService.updateConfig({
        startDate,
        cycleDays: cycleDays ? parseInt(cycleDays) : undefined,
        dailyRequired: dailyRequired ? parseInt(dailyRequired) : undefined,
        maxConsecutiveDays: maxConsecutiveDays ? parseInt(maxConsecutiveDays) : undefined,
        balanceWeight: balanceWeight !== undefined ? parseInt(balanceWeight) : undefined,
      });
      res.json({ data: config, message: '配置更新成功' });
    } catch (error) {
      next(error);
    }
  },
};

export default configController;
