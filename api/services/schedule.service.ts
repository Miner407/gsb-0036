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
    const [members, config, unavailableMap] = await Promise.all([
      memberService.getAllMembers(),
      configService.getConfig(),
      memberService.getAllUnavailableDatesAsMap(),
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
      endDate
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

    const [config, unavailableMap, members] = await Promise.all([
      configService.getConfig(),
      memberService.getAllUnavailableDatesAsMap(),
      memberService.getAllMembers(),
    ]);

    const member = members.find((m) => m.id === newMemberId);
    if (!member) {
      throw new Error('目标成员不存在');
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
    const [schedules, members, unavailableMap, config] = await Promise.all([
      scheduleRepository.findByDateRange(startDate, endDate),
      memberService.getAllMembers(),
      memberService.getAllUnavailableDatesAsMap(),
      configService.getConfig(),
    ]);

    return conflictDetector.detectAllConflicts(
      schedules,
      members,
      unavailableMap,
      config,
      startDate,
      endDate
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

    const memberShifts: MemberShiftCount[] = [];
    for (const member of members) {
      const count = await scheduleRepository.countByMemberAndDateRange(
        member.id,
        actualStart,
        actualEnd
      );
      memberShifts.push({
        memberId: member.id,
        memberName: member.name,
        count,
      });
    }

    const maxConsecutive = schedulingAlgorithm.getMaxConsecutiveDays(schedules);

    return {
      totalDays: Math.ceil(
        (parseDate(actualEnd).getTime() - parseDate(actualStart).getTime()) / (1000 * 60 * 60 * 24)
      ) + 1,
      totalShifts: schedules.filter((s) => !s.isLeave || s.substituteId).length,
      memberShifts,
      maxConsecutive,
    };
  },
};

export default scheduleService;
