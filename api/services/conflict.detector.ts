import { Conflict, Schedule, Member, ScheduleConfig } from '../../shared/types';
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
              message: `连续值班 ${consecutive} 天，超过最大允许 ${maxConsecutiveDays} 天`,
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
          message: `该日期为成员不可值班日期`,
        });
      }
    }
    
    return conflicts;
  },

  detectInsufficientConflicts(
    schedules: Schedule[],
    startDate: string,
    endDate: string,
    dailyRequired: number
  ): Conflict[] {
    const conflicts: Conflict[] = [];
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
    
    return conflicts;
  },

  detectImbalanceConflicts(
    schedules: Schedule[],
    members: Member[]
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
      conflicts.push({
        type: 'imbalance',
        severity: 'warning',
        message: `排班不均衡，最多 ${max} 次，最少 ${min} 次，差值 ${max - min}`,
      });
    }
    
    return conflicts;
  },

  detectAllConflicts(
    schedules: Schedule[],
    members: Member[],
    unavailableDates: Map<number, Set<string>>,
    config: ScheduleConfig,
    startDate: string,
    endDate: string
  ): Conflict[] {
    return [
      ...this.detectConsecutiveConflicts(schedules, config.maxConsecutiveDays),
      ...this.detectUnavailableConflicts(schedules, unavailableDates),
      ...this.detectInsufficientConflicts(schedules, startDate, endDate, config.dailyRequired),
      ...this.detectImbalanceConflicts(schedules, members),
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
        message: `该成员在 ${schedule.date} 不可值班`,
      });
    }
    
    const sameDay = allSchedules.filter(
      s => s.date === schedule.date && s.memberId === newMemberId && s.id !== schedule.id
    );
    if (sameDay.length > 0) {
      conflicts.push({
        type: 'insufficient',
        severity: 'warning',
        date: schedule.date,
        memberId: newMemberId,
        message: `该成员当天已有值班安排`,
      });
    }
    
    const memberScheds = allSchedules
      .filter(s => s.memberId === newMemberId && !s.isLeave && s.id !== schedule.id)
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
            message: `调整后将连续值班 ${consecutive} 天，超过最大允许 ${maxConsecutiveDays} 天`,
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
