import { Request, Response, NextFunction } from 'express';
import { memberService } from '../services/member.service';

export const memberController = {
  async getAllMembers(req: Request, res: Response, next: NextFunction) {
    try {
      const members = await memberService.getAllMembers();
      res.json({ data: members });
    } catch (error) {
      next(error);
    }
  },

  async getMemberById(req: Request, res: Response, next: NextFunction) {
    try {
      const id = parseInt(req.params.id);
      const member = await memberService.getMemberById(id);
      if (!member) {
        res.status(404).json({ error: '成员不存在' });
        return;
      }
      res.json({ data: member });
    } catch (error) {
      next(error);
    }
  },

  async createMember(req: Request, res: Response, next: NextFunction) {
    try {
      const { name, department, email, phone } = req.body;
      const member = await memberService.createMember({ name, department, email, phone });
      res.status(201).json({ data: member, message: '创建成功' });
    } catch (error) {
      next(error);
    }
  },

  async updateMember(req: Request, res: Response, next: NextFunction) {
    try {
      const id = parseInt(req.params.id);
      const { name, department, email, phone } = req.body;
      const member = await memberService.updateMember(id, { name, department, email, phone });
      if (!member) {
        res.status(404).json({ error: '成员不存在' });
        return;
      }
      res.json({ data: member, message: '更新成功' });
    } catch (error) {
      next(error);
    }
  },

  async deleteMember(req: Request, res: Response, next: NextFunction) {
    try {
      const id = parseInt(req.params.id);
      const success = await memberService.deleteMember(id);
      if (!success) {
        res.status(404).json({ error: '成员不存在' });
        return;
      }
      res.json({ success: true, message: '删除成功' });
    } catch (error) {
      next(error);
    }
  },

  async getUnavailableDates(req: Request, res: Response, next: NextFunction) {
    try {
      const memberId = parseInt(req.params.id);
      const dates = await memberService.getMemberUnavailableDates(memberId);
      res.json({ data: dates });
    } catch (error) {
      next(error);
    }
  },

  async addUnavailableDates(req: Request, res: Response, next: NextFunction) {
    try {
      const memberId = parseInt(req.params.id);
      const { date, startDate, endDate, reason } = req.body;
      const dates = await memberService.addUnavailableDates(memberId, { date, startDate, endDate, reason });
      res.status(201).json({ data: dates, message: '添加成功' });
    } catch (error) {
      next(error);
    }
  },

  async deleteUnavailableDate(req: Request, res: Response, next: NextFunction) {
    try {
      const id = parseInt(req.params.id);
      const success = await memberService.deleteUnavailableDate(id);
      if (!success) {
        res.status(404).json({ error: '记录不存在' });
        return;
      }
      res.json({ success: true, message: '删除成功' });
    } catch (error) {
      next(error);
    }
  },
};

export default memberController;
