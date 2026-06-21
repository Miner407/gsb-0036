import {
  Conflict,
  Schedule,
  Member,
  ScheduleConfig,
  ShiftConfig,
  ShiftType,
  SHIFT_LABELS,
} from '../../shared/types';
import { parseDate, addDays, formatDate } from '../utils/date.utils';

export const conflictDetector = {
  detectConsecutiveConflicts(
    schedules: Schedule[],
    maxConsecutiveDays: number
  ): Conflict[] {
    const conflicts: Conflict[] = [];
    const memberSchedules = new Map<number, Schedule[]>();

    for (const s of schedules) {
      if (s.isLeave) continue;
      if (!memberSchedules.has(s.memberId)) {
        memberSchedules.set(s.memberId, []);
      }
      memberSchedules.get(s.memberId)!.push(s);
    }

    for (const [memberId, memberScheds] of memberSchedules) {
      const sorted = [...memberScheds].sort((a, b) => a.date.localeCompare(b.date));
      let consecutive = 1;

      for (let i = 1; i < sorted.length; i++) {
        const prev = parseDate(sorted[i - 1].date);
        const curr = parseDate(sorted[i].date);
        const diffDays = Math.round((curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24));

        if (diffDays === 1) {
          consecutive++;
          if (consecutive > maxConsecutiveDays) {
            conflicts.push({
              type: 'consecutive',
              severity: 'error',
              date: sorted[i].date,
              memberId,
              shiftType: sorted[i].shift,
              message: `连续值班 ${consecutive} 天，超过最大允许 ${maxConsecutiveDays} 天（${SHIFT_LABELS[sorted[i].shift]}）`,
            });
          }
        } else {
          consecutive = 1;
        }
      }
    }

    return conflicts;
  },

  detectUnavailableConflicts(
    schedules: Schedule[],
    unavailableDates: Map<number, Set<string>>
  ): Conflict[] {
    const conflicts: Conflict[] = [];

    for (const s of schedules) {
      if (s.isLeave) continue;
      const memberUnavailable = unavailableDates.get(s.memberId);
      if (memberUnavailable?.has(s.date)) {
        conflicts.push({
          type: 'unavailable',
          severity: 'error',
          date: s.date,
          memberId: s.memberId,
          shiftType: s.shift,
          message: `该日期为成员不可值班日期（${SHIFT_LABELS[s.shift]}）`,
        });
      }
    }

    return conflicts;
  },

  detectDuplicateSameDayConflicts(schedules: Schedule[]): Conflict[] {
    const conflicts: Conflict[] = [];
    const dayMemberMap = new Map<string, Map<number, Schedule[]>>();

    for (const s of schedules) {
      if (s.isLeave) continue;
      if (!dayMemberMap.has(s.date)) {
        dayMemberMap.set(s.date, new Map());
      }
      const inner = dayMemberMap.get(s.date)!;
      if (!inner.has(s.memberId)) {
        inner.set(s.memberId, []);
      }
      inner.get(s.memberId)!.push(s);
    }

    for (const [date, innerMap] of dayMemberMap) {
      for (const [memberId, scheds] of innerMap) {
        if (scheds.length > 1) {
          const shifts = scheds.map((s) => SHIFT_LABELS[s.shift]).join('、');
          conflicts.push({
            type: 'duplicate_same_day',
            severity: 'error',
            date,
            memberId,
            message: `同一成员在同一天被重复排班（班次：${shifts}）`,
          });
        }
      }
    }

    return conflicts;
  },

  detectInsufficientConflicts(
    schedules: Schedule[],
    startDate: string,
    endDate: string,
    dailyRequired: number,
    enableMultiShift: boolean,
    shiftConfigs: ShiftConfig[]
  ): Conflict[] {
    const conflicts: Conflict[] = [];

    if (enableMultiShift && shiftConfigs.length > 0) {
      const dayShiftMap = new Map<string, Map<ShiftType, number>>();

      for (const s of schedules) {
        if (s.isLeave && !s.substituteId) continue;
        if (!dayShiftMap.has(s.date)) {
          dayShiftMap.set(s.date, new Map());
        }
        const shiftMap = dayShiftMap.get(s.date)!;
        const cur = shiftMap.get(s.shift) || 0;
        shiftMap.set(s.shift, cur + 1);
      }

      const start = parseDate(startDate);
      const end = parseDate(endDate);

      for (let d = new Date(start); d <= end; d = addDays(d, 1)) {
        const dateStr = formatDate(d);
        const shiftMap = dayShiftMap.get(dateStr) || new Map();
        for (const sc of shiftConfigs) {
          const actual = shiftMap.get(sc.shiftType) || 0;
          if (actual < sc.dailyRequired) {
            conflicts.push({
              type: 'insufficient',
              severity: 'error',
              date: dateStr,
              shiftType: sc.shiftType,
              message: `${SHIFT_LABELS[sc.shiftType]}人数不足，需要 ${sc.dailyRequired} 人，实际 ${actual} 人`,
            });
          }
        }
      }
    } else {
      const dateCounts = new Map<string, number>();

      for (const s of schedules) {
        if (s.isLeave && !s.substituteId) continue;
        const count = dateCounts.get(s.date) || 0;
        dateCounts.set(s.date, count + 1);
      }

      const start = parseDate(startDate);
      const end = parseDate(endDate);

      for (let d = new Date(start); d <= end; d = addDays(d, 1)) {
        const dateStr = formatDate(d);
        const count = dateCounts.get(dateStr) || 0;
        if (count < dailyRequired) {
          conflicts.push({
            type: 'insufficient',
            severity: 'error',
            date: dateStr,
            message: `值班人数不足，需要 ${dailyRequired} 人，实际 ${count} 人`,
          });
        }
      }
    }

    return conflicts;
  },

  detectImbalanceConflicts(
    schedules: Schedule[],
    members: Member[],
    enableMultiShift: boolean
  ): Conflict[] {
    const conflicts: Conflict[] = [];
    const counts = new Map<number, number>();

    for (const m of members) {
      counts.set(m.id, 0);
    }

    for (const s of schedules) {
      if (s.isLeave && !s.substituteId) continue;
      const count = counts.get(s.memberId) || 0;
      counts.set(s.memberId, count + 1);
      if (s.substituteId) {
        const subCount = counts.get(s.substituteId) || 0;
        counts.set(s.substituteId, subCount + 1);
      }
    }

    const countValues = Array.from(counts.values());
    if (countValues.length === 0) return conflicts;

    const max = Math.max(...countValues);
    const min = Math.min(...countValues);

    if (max - min > 2) {
      const detail = enableMultiShift ? '（包含跨班次综合统计）' : '';
      conflicts.push({
        type: 'imbalance',
        severity: 'warning',
        message: `排班不均衡${detail}，最多 ${max} 次，最少 ${min} 次，差值 ${max - min}`,
      });
    }

    if (enableMultiShift) {
      const shiftMemberCount = new Map<ShiftType, Map<number, number>>();
      for (const s of schedules) {
        if (s.isLeave && !s.substituteId) continue;
        if (!shiftMemberCount.has(s.shift)) {
          shiftMemberCount.set(s.shift, new Map());
        }
        const mm = shiftMemberCount.get(s.shift)!;
        const cur = mm.get(s.memberId) || 0;
        mm.set(s.memberId, cur + 1);
      }

      for (const [shift, mm] of shiftMemberCount) {
        const values = Array.from(mm.values());
        if (values.length <= 1) continue;
        const sMax = Math.max(...values);
        const sMin = Math.min(...values);
        if (sMax - sMin > 2) {
          conflicts.push({
            type: 'imbalance',
            severity: 'warning',
            shiftType: shift,
            message: `${SHIFT_LABELS[shift]}排班不均衡，最多 ${sMax} 次，最少 ${sMin} 次，差值 ${sMax - sMin}`,
          });
        }
      }
    }

    return conflicts;
  },

  detectAllConflicts(
    schedules: Schedule[],
    members: Member[],
    unavailableDates: Map<number, Set<string>>,
    config: ScheduleConfig,
    startDate: string,
    endDate: string,
    shiftConfigs?: ShiftConfig[]
  ): Conflict[] {
    return [
      ...this.detectDuplicateSameDayConflicts(schedules),
      ...this.detectUnavailableConflicts(schedules, unavailableDates),
      ...this.detectConsecutiveConflicts(schedules, config.maxConsecutiveDays),
      ...this.detectInsufficientConflicts(
        schedules,
        startDate,
        endDate,
        config.dailyRequired,
        config.enableMultiShift,
        shiftConfigs || []
      ),
      ...this.detectImbalanceConflicts(schedules, members, config.enableMultiShift),
    ];
  },

  checkReplaceConflict(
    schedule: Schedule,
    newMemberId: number,
    allSchedules: Schedule[],
    unavailableDates: Map<number, Set<string>>,
    maxConsecutiveDays: number
  ): Conflict[] {
    const conflicts: Conflict[] = [];

    const memberUnavailable = unavailableDates.get(newMemberId);
    if (memberUnavailable?.has(schedule.date)) {
      conflicts.push({
        type: 'unavailable',
        severity: 'error',
        date: schedule.date,
        memberId: newMemberId,
        shiftType: schedule.shift,
        message: `该成员在 ${schedule.date} 不可值班（${SHIFT_LABELS[schedule.shift]}）`,
      });
    }

    const sameDayDuplicate = allSchedules.filter(
      (s) =>
        s.date === schedule.date &&
        s.memberId === newMemberId &&
        s.id !== schedule.id &&
        !s.isLeave
    );
    if (sameDayDuplicate.length > 0) {
      const shifts = sameDayDuplicate.map((s) => SHIFT_LABELS[s.shift]).join('、');
      conflicts.push({
        type: 'duplicate_same_day',
        severity: 'error',
        date: schedule.date,
        memberId: newMemberId,
        shiftType: schedule.shift,
        message: `该成员当天已有排班（班次：${shifts}）`,
      });
    }

    const memberScheds = allSchedules
      .filter((s) => s.memberId === newMemberId && !s.isLeave && s.id !== schedule.id)
      .sort((a, b) => a.date.localeCompare(b.date));

    const testScheds = [...memberScheds, { ...schedule, memberId: newMemberId }]
      .sort((a, b) => a.date.localeCompare(b.date));

    let consecutive = 1;
    for (let i = 1; i < testScheds.length; i++) {
      const prev = parseDate(testScheds[i - 1].date);
      const curr = parseDate(testScheds[i].date);
      const diffDays = Math.round((curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24));

      if (diffDays === 1) {
        consecutive++;
        if (consecutive > maxConsecutiveDays) {
          conflicts.push({
            type: 'consecutive',
            severity: 'error',
            date: testScheds[i].date,
            memberId: newMemberId,
            shiftType: testScheds[i].shift,
            message: `调整后将连续值班 ${consecutive} 天，超过最大允许 ${maxConsecutiveDays} 天（${SHIFT_LABELS[testScheds[i].shift]}）`,
          });
          break;
        }
      } else {
        consecutive = 1;
      }
    }

    return conflicts;
  },
};

export default conflictDetector;
