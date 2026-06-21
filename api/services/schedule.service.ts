import { scheduleRepository } from '../repositories/schedule.repository';
import { memberService } from './member.service';
import { configService } from './config.service';
import { schedulingAlgorithm } from './scheduling.algorithm';
import { conflictDetector } from './conflict.detector';
import {
  Schedule,
  ScheduleGenerateResult,
  ScheduleStatistics,
  Conflict,
  MemberShiftCount,
  ShiftType,
  SHIFT_LABELS,
} from '../../shared/types';
import { addDays, formatDate, parseDate } from '../utils/date.utils';

export const scheduleService = {
  async getSchedules(startDate: string, endDate: string): Promise<Schedule[]> {
    return scheduleRepository.findByDateRange(startDate, endDate);
  },

  async generateSchedule(params?: {
    startDate?: string;
    cycleDays?: number;
    dailyRequired?: number;
  }): Promise<ScheduleGenerateResult> {
    const [members, config, unavailableMap, shiftConfigs] = await Promise.all([
      memberService.getAllMembers(),
      configService.getConfig(),
      memberService.getAllUnavailableDatesAsMap(),
      configService.getAllShiftConfigs(),
    ]);

    const unavailableDates = Array.from(unavailableMap.entries()).flatMap(([memberId, dates]) =>
      Array.from(dates).map((date) => ({
        id: 0,
        memberId,
        date,
        createdAt: '',
      }))
    );

    const result = schedulingAlgorithm.generateSchedule(
      members,
      unavailableDates,
      config,
      shiftConfigs,
      params?.startDate,
      params?.cycleDays,
      params?.dailyRequired
    );

    if (result.schedules.length === 0) {
      return {
        success: false,
        schedules: [],
        conflicts: [],
        statistics: {
          totalDays: 0,
          totalShifts: 0,
          memberShifts: [],
          maxConsecutive: 0,
          shiftBreakdown: { morning: 0, evening: 0, night: 0, day: 0 },
        },
      };
    }

    const actualStartDate = params?.startDate || config.startDate;
    const actualCycleDays = params?.cycleDays || config.cycleDays;
    const endDate = formatDate(addDays(parseDate(actualStartDate), actualCycleDays - 1));

    await scheduleRepository.deleteByDateRange(actualStartDate, endDate);

    const createdSchedules = await scheduleRepository.bulkCreate(result.schedules);

    const fullSchedules: Schedule[] = createdSchedules.map((s, idx) => ({
      ...s,
      id: idx + 1,
    }));

    const conflicts = conflictDetector.detectAllConflicts(
      fullSchedules,
      members,
      unavailableMap,
      config,
      actualStartDate,
      endDate,
      shiftConfigs
    );

    const statistics = await this.getStatistics(actualStartDate, endDate);

    return {
      success: true,
      schedules: createdSchedules,
      conflicts,
      statistics,
    };
  },

  async swapSchedules(scheduleId1: number, scheduleId2: number): Promise<{
    success: boolean;
    schedules: Schedule[];
    conflicts: Conflict[];
  }> {
    const [s1, s2] = await Promise.all([
      scheduleRepository.findById(scheduleId1),
      scheduleRepository.findById(scheduleId2),
    ]);

    if (!s1 || !s2) {
      throw new Error('排班记录不存在');
    }

    if (s1.date !== s2.date) {
      throw new Error('只能交换同一天的排班');
    }

    if (s1.shift !== s2.shift) {
      throw new Error('只能交换同一班次的排班');
    }

    const [config, unavailableMap] = await Promise.all([
      configService.getConfig(),
      memberService.getAllUnavailableDatesAsMap(),
    ]);

    const allSchedules = await scheduleRepository.findByDateRange(
      formatDate(addDays(parseDate(s1.date), -30)),
      formatDate(addDays(parseDate(s1.date), 30))
    );

    const conflicts1 = conflictDetector.checkReplaceConflict(
      s1,
      s2.memberId,
      allSchedules,
      unavailableMap,
      config.maxConsecutiveDays
    );

    const conflicts2 = conflictDetector.checkReplaceConflict(
      s2,
      s1.memberId,
      allSchedules,
      unavailableMap,
      config.maxConsecutiveDays
    );

    const allConflicts = [...conflicts1, ...conflicts2];
    const hasErrors = allConflicts.some((c) => c.severity === 'error');

    if (hasErrors) {
      return {
        success: false,
        schedules: [],
        conflicts: allConflicts,
      };
    }

    const [updated1, updated2] = await Promise.all([
      scheduleRepository.updateMember(s1.id, s2.memberId),
      scheduleRepository.updateMember(s2.id, s1.memberId),
    ]);

    return {
      success: true,
      schedules: [updated1!, updated2!],
      conflicts: allConflicts,
    };
  },

  async replaceSchedule(scheduleId: number, newMemberId: number): Promise<{
    success: boolean;
    schedules: Schedule[];
    conflicts: Conflict[];
  }> {
    const schedule = await scheduleRepository.findById(scheduleId);
    if (!schedule) {
      throw new Error('排班记录不存在');
    }

    const [config, unavailableMap, members, shiftConfigs] = await Promise.all([
      configService.getConfig(),
      memberService.getAllUnavailableDatesAsMap(),
      memberService.getAllMembers(),
      configService.getAllShiftConfigs(),
    ]);

    const member = members.find((m) => m.id === newMemberId);
    if (!member) {
      throw new Error('目标成员不存在');
    }

    if (config.enableMultiShift) {
      const sc = shiftConfigs.find((c) => c.shiftType === schedule.shift);
      if (sc && sc.memberIds.length > 0 && !sc.memberIds.includes(newMemberId)) {
        return {
          success: false,
          schedules: [],
          conflicts: [{
            type: 'unavailable',
            severity: 'error',
            date: schedule.date,
            memberId: newMemberId,
            shiftType: schedule.shift,
            message: `该成员不在${SHIFT_LABELS[schedule.shift]}可值班名单内`,
          }],
        };
      }
    }

    const allSchedules = await scheduleRepository.findByDateRange(
      formatDate(addDays(parseDate(schedule.date), -30)),
      formatDate(addDays(parseDate(schedule.date), 30))
    );

    const conflicts = conflictDetector.checkReplaceConflict(
      schedule,
      newMemberId,
      allSchedules,
      unavailableMap,
      config.maxConsecutiveDays
    );

    const hasErrors = conflicts.some((c) => c.severity === 'error');

    if (hasErrors) {
      return {
        success: false,
        schedules: [],
        conflicts,
      };
    }

    const updated = await scheduleRepository.updateMember(scheduleId, newMemberId);

    return {
      success: true,
      schedules: updated ? [updated] : [],
      conflicts,
    };
  },

  async markLeave(scheduleId: number, leaveType: string, substituteId?: number): Promise<Schedule> {
    const schedule = await scheduleRepository.findById(scheduleId);
    if (!schedule) {
      throw new Error('排班记录不存在');
    }

    if (substituteId) {
      const members = await memberService.getAllMembers();
      if (!members.find((m) => m.id === substituteId)) {
        throw new Error('代班人不存在');
      }
    }

    const updated = await scheduleRepository.setLeave(scheduleId, leaveType, substituteId);
    if (!updated) {
      throw new Error('标记请假失败');
    }

    return updated;
  },

  async cancelLeave(scheduleId: number): Promise<Schedule> {
    const schedule = await scheduleRepository.findById(scheduleId);
    if (!schedule) {
      throw new Error('排班记录不存在');
    }

    const updated = await scheduleRepository.cancelLeave(scheduleId);
    if (!updated) {
      throw new Error('取消请假失败');
    }

    return updated;
  },

  async detectConflicts(startDate: string, endDate: string): Promise<Conflict[]> {
    const [schedules, members, unavailableMap, config, shiftConfigs] = await Promise.all([
      scheduleRepository.findByDateRange(startDate, endDate),
      memberService.getAllMembers(),
      memberService.getAllUnavailableDatesAsMap(),
      configService.getConfig(),
      configService.getAllShiftConfigs(),
    ]);

    return conflictDetector.detectAllConflicts(
      schedules,
      members,
      unavailableMap,
      config,
      startDate,
      endDate,
      shiftConfigs
    );
  },

  async getStatistics(startDate?: string, endDate?: string): Promise<ScheduleStatistics> {
    const [config, members] = await Promise.all([
      configService.getConfig(),
      memberService.getAllMembers(),
    ]);

    const actualStart = startDate || config.startDate;
    const actualEnd = endDate || formatDate(addDays(parseDate(config.startDate), config.cycleDays - 1));

    const schedules = await scheduleRepository.findByDateRange(actualStart, actualEnd);

    const shiftBreakdown: Record<ShiftType, number> = {
      morning: 0,
      evening: 0,
      night: 0,
      day: 0,
    };

    const memberShifts: MemberShiftCount[] = [];
    for (const member of members) {
      const count = await scheduleRepository.countByMemberAndDateRange(
        member.id,
        actualStart,
        actualEnd
      );

      const sb: Record<ShiftType, number> = {
        morning: 0,
        evening: 0,
        night: 0,
        day: 0,
      };

      const mScheds = schedules.filter((s) => s.memberId === member.id && !s.isLeave);
      for (const s of mScheds) {
        sb[s.shift]++;
      }

      for (const s of mScheds) {
        shiftBreakdown[s.shift]++;
      }

      memberShifts.push({
        memberId: member.id,
        memberName: member.name,
        count,
        shiftBreakdown: sb,
      });
    }

    const maxConsecutive = schedulingAlgorithm.getMaxConsecutiveDays(schedules);

    const totalDays = Math.ceil(
      (parseDate(actualEnd).getTime() - parseDate(actualStart).getTime()) / (1000 * 60 * 60 * 24)
    ) + 1;

    const totalShifts = schedules.filter((s) => !s.isLeave || s.substituteId).length;

    return {
      totalDays,
      totalShifts,
      memberShifts,
      maxConsecutive,
      shiftBreakdown,
    };
  },
};

export default scheduleService;
