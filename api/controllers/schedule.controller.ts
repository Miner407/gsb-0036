import { Request, Response, NextFunction } from 'express';
import { scheduleService } from '../services/schedule.service';

export const scheduleController = {
  async getSchedules(req: Request, res: Response, next: NextFunction) {
    try {
      const { startDate, endDate } = req.query;
      if (!startDate || !endDate) {
        res.status(400).json({ error: '请指定开始和结束日期' });
        return;
      }
      const schedules = await scheduleService.getSchedules(startDate as string, endDate as string);
      res.json({ data: schedules });
    } catch (error) {
      next(error);
    }
  },

  async generateSchedule(req: Request, res: Response, next: NextFunction) {
    try {
      const { startDate, cycleDays, dailyRequired } = req.body;
      const result = await scheduleService.generateSchedule({
        startDate,
        cycleDays: cycleDays ? parseInt(cycleDays) : undefined,
        dailyRequired: dailyRequired ? parseInt(dailyRequired) : undefined,
      });
      
      if (!result.success && result.schedules.length === 0) {
        res.status(400).json({ error: '生成排班失败，请检查成员配置', ...result });
        return;
      }
      
      res.json({ ...result, message: '排班生成成功' });
    } catch (error) {
      next(error);
    }
  },

  async swapSchedules(req: Request, res: Response, next: NextFunction) {
    try {
      const { scheduleId1, scheduleId2 } = req.body;
      if (!scheduleId1 || !scheduleId2) {
        res.status(400).json({ error: '请指定两个排班记录ID' });
        return;
      }
      const result = await scheduleService.swapSchedules(
        parseInt(scheduleId1),
        parseInt(scheduleId2)
      );
      res.json(result);
    } catch (error) {
      next(error);
    }
  },

  async replaceSchedule(req: Request, res: Response, next: NextFunction) {
    try {
      const { scheduleId, newMemberId } = req.body;
      if (!scheduleId || !newMemberId) {
        res.status(400).json({ error: '请指定排班记录ID和目标成员ID' });
        return;
      }
      const result = await scheduleService.replaceSchedule(
        parseInt(scheduleId),
        parseInt(newMemberId)
      );
      res.json(result);
    } catch (error) {
      next(error);
    }
  },

  async markLeave(req: Request, res: Response, next: NextFunction) {
    try {
      const { scheduleId, leaveType, substituteId } = req.body;
      if (!scheduleId || !leaveType) {
        res.status(400).json({ error: '请指定排班记录ID和请假类型' });
        return;
      }
      const schedule = await scheduleService.markLeave(
        parseInt(scheduleId),
        leaveType,
        substituteId ? parseInt(substituteId) : undefined
      );
      res.json({ data: schedule, message: '标记请假成功' });
    } catch (error) {
      next(error);
    }
  },

  async cancelLeave(req: Request, res: Response, next: NextFunction) {
    try {
      const id = parseInt(req.params.id);
      const schedule = await scheduleService.cancelLeave(id);
      res.json({ data: schedule, message: '取消请假成功' });
    } catch (error) {
      next(error);
    }
  },

  async detectConflicts(req: Request, res: Response, next: NextFunction) {
    try {
      const { startDate, endDate } = req.query;
      if (!startDate || !endDate) {
        res.status(400).json({ error: '请指定开始和结束日期' });
        return;
      }
      const conflicts = await scheduleService.detectConflicts(
        startDate as string,
        endDate as string
      );
      res.json({ data: conflicts });
    } catch (error) {
      next(error);
    }
  },

  async getStatistics(req: Request, res: Response, next: NextFunction) {
    try {
      const { startDate, endDate } = req.query;
      const statistics = await scheduleService.getStatistics(
        startDate as string | undefined,
        endDate as string | undefined
      );
      res.json({ data: statistics });
    } catch (error) {
      next(error);
    }
  },
};

export default scheduleController;
