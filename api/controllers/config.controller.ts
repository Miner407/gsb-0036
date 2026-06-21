import { Request, Response, NextFunction } from 'express';
import { configService } from '../services/config.service';
import { ShiftType } from '../../shared/types';

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
      const { startDate, cycleDays, dailyRequired, maxConsecutiveDays, balanceWeight, enableMultiShift } = req.body;
      const config = await configService.updateConfig({
        startDate,
        cycleDays: cycleDays ? parseInt(cycleDays as string) : undefined,
        dailyRequired: dailyRequired ? parseInt(dailyRequired as string) : undefined,
        maxConsecutiveDays: maxConsecutiveDays ? parseInt(maxConsecutiveDays as string) : undefined,
        balanceWeight: balanceWeight !== undefined ? parseInt(balanceWeight as string) : undefined,
        enableMultiShift: enableMultiShift !== undefined ? (enableMultiShift === true || enableMultiShift === 'true' || enableMultiShift === 1) : undefined,
      });
      res.json({ data: config, message: '配置更新成功' });
    } catch (error) {
      next(error);
    }
  },

  async getAllShiftConfigs(req: Request, res: Response, next: NextFunction) {
    try {
      const configs = await configService.getAllShiftConfigs();
      res.json({ data: configs });
    } catch (error) {
      next(error);
    }
  },

  async updateShiftConfig(req: Request, res: Response, next: NextFunction) {
    try {
      const { shiftType, dailyRequired, memberIds } = req.body;
      if (!shiftType) {
        res.status(400).json({ error: '请指定班次类型' });
        return;
      }
      const parsedMemberIds: number[] | undefined = Array.isArray(memberIds)
        ? (memberIds as unknown[]).map((id) => Number(id)).filter((id) => !Number.isNaN(id))
        : undefined;

      const config = await configService.updateShiftConfig(
        shiftType as ShiftType,
        {
          dailyRequired: dailyRequired !== undefined ? parseInt(dailyRequired as string) : undefined,
          memberIds: parsedMemberIds,
        }
      );
      res.json({ data: config, message: '班次配置更新成功' });
    } catch (error) {
      next(error);
    }
  },

  async batchUpdateShiftConfigs(req: Request, res: Response, next: NextFunction) {
    try {
      const { configs } = req.body as { configs?: { shiftType: ShiftType; dailyRequired?: number; memberIds?: number[] }[] };
      if (!Array.isArray(configs)) {
        res.status(400).json({ error: '请提供配置列表' });
        return;
      }
      const parsedConfigs = configs.map((c) => ({
        shiftType: c.shiftType,
        dailyRequired: c.dailyRequired !== undefined ? Number(c.dailyRequired) : undefined,
        memberIds: Array.isArray(c.memberIds)
          ? c.memberIds.map((id) => Number(id)).filter((id) => !Number.isNaN(id))
          : undefined,
      }));
      const results = await configService.batchUpdateShiftConfigs(parsedConfigs);
      res.json({ data: results, message: '班次配置批量更新成功' });
    } catch (error) {
      next(error);
    }
  },

  async getShiftConfig(req: Request, res: Response, next: NextFunction) {
    try {
      const { shiftType } = req.params;
      const config = await configService.getShiftConfig(shiftType as ShiftType);
      res.json({ data: config });
    } catch (error) {
      next(error);
    }
  },
};

export default configController;
