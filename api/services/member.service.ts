import { memberRepository } from '../repositories/member.repository';
import { Member, UnavailableDate } from '../../shared/types';
import { getDatesInRange } from '../utils/date.utils';

export const memberService = {
  async getAllMembers(): Promise<Member[]> {
    return memberRepository.findAll();
  },

  async getMemberById(id: number): Promise<Member | null> {
    return memberRepository.findById(id);
  },

  async createMember(data: { name: string; department?: string; email?: string; phone?: string }): Promise<Member> {
    if (!data.name?.trim()) {
      throw new Error('成员姓名不能为空');
    }
    return memberRepository.create(data);
  },

  async updateMember(id: number, data: { name?: string; department?: string; email?: string; phone?: string }): Promise<Member | null> {
    if (data.name !== undefined && !data.name?.trim()) {
      throw new Error('成员姓名不能为空');
    }
    return memberRepository.update(id, data);
  },

  async deleteMember(id: number): Promise<boolean> {
    return memberRepository.delete(id);
  },

  async getMemberUnavailableDates(memberId: number): Promise<UnavailableDate[]> {
    return memberRepository.findUnavailableDates(memberId);
  },

  async addUnavailableDates(
    memberId: number,
    data: { date?: string; startDate?: string; endDate?: string; reason?: string }
  ): Promise<UnavailableDate[]> {
    const member = await memberRepository.findById(memberId);
    if (!member) {
      throw new Error('成员不存在');
    }

    const created: UnavailableDate[] = [];

    if (data.date) {
      const existing = await memberRepository.isDateUnavailable(memberId, data.date);
      if (!existing) {
        const ud = await memberRepository.addUnavailableDate(memberId, data.date, data.reason);
        created.push(ud);
      }
    } else if (data.startDate && data.endDate) {
      const dates = getDatesInRange(data.startDate, data.endDate);
      for (const date of dates) {
        const existing = await memberRepository.isDateUnavailable(memberId, date);
        if (!existing) {
          const ud = await memberRepository.addUnavailableDate(memberId, date, data.reason);
          created.push(ud);
        }
      }
    } else {
      throw new Error('请指定日期或日期范围');
    }

    return created;
  },

  async deleteUnavailableDate(id: number): Promise<boolean> {
    return memberRepository.deleteUnavailableDate(id);
  },

  async getAllUnavailableDatesAsMap(): Promise<Map<number, Set<string>>> {
    const allDates = await memberRepository.findAllUnavailableDates();
    const map = new Map<number, Set<string>>();
    
    for (const ud of allDates) {
      if (!map.has(ud.memberId)) {
        map.set(ud.memberId, new Set());
      }
      map.get(ud.memberId)!.add(ud.date);
    }
    
    return map;
  },
};

export default memberService;
