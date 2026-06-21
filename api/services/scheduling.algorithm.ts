import { Member, UnavailableDate, ScheduleConfig, Schedule } from '../../shared/types';
import { getDatesInRange, parseDate, addDays, formatDate } from '../utils/date.utils';
import { conflictDetector } from './conflict.detector';

interface Candidate {
  memberId: number;
  score: number;
  shiftCount: number;
}

export const schedulingAlgorithm = {
  generateSchedule(
    members: Member[],
    unavailableDates: UnavailableDate[],
    config: ScheduleConfig,
    startDate?: string,
    cycleDays?: number,
    dailyRequired?: number
  ): { schedules: Omit<Schedule, 'id' | 'createdAt' | 'updatedAt'>[]; message?: string } {
    const actualStartDate = startDate || config.startDate;
    const actualCycleDays = cycleDays || config.cycleDays;
    const actualDailyRequired = dailyRequired || config.dailyRequired;
    
    if (members.length === 0) {
      return { schedules: [], message: '请先添加成员' };
    }
    
    if (actualDailyRequired > members.length) {
      return { schedules: [], message: `每日所需人数 (${actualDailyRequired}) 不能超过成员总数 (${members.length})` };
    }
    
    const endDate = formatDate(addDays(parseDate(actualStartDate), actualCycleDays - 1));
    const dates = getDatesInRange(actualStartDate, endDate);
    
    const unavailableMap = new Map<number, Set<string>>();
    for (const ud of unavailableDates) {
      if (!unavailableMap.has(ud.memberId)) {
        unavailableMap.set(ud.memberId, new Set());
      }
      unavailableMap.get(ud.memberId)!.add(ud.date);
    }
    
    const shiftCounts = new Map<number, number>();
    for (const m of members) {
      shiftCounts.set(m.id, 0);
    }
    
    const recentAssignments = new Map<number, string[]>();
    for (const m of members) {
      recentAssignments.set(m.id, []);
    }
    
    const schedules: Omit<Schedule, 'id' | 'createdAt' | 'updatedAt'>[] = [];
    const warnings: string[] = [];
    
    for (const date of dates) {
      const candidates: Candidate[] = [];
      
      for (const member of members) {
        const memberUnavailable = unavailableMap.get(member.id);
        if (memberUnavailable?.has(date)) continue;
        
        const recent = recentAssignments.get(member.id) || [];
        const count = shiftCounts.get(member.id) || 0;
        
        let score = count * (config.balanceWeight / 100);
        
        const prevDay = formatDate(addDays(parseDate(date), -1));
        const twoDaysAgo = formatDate(addDays(parseDate(date), -2));
        
        if (recent.includes(prevDay)) {
          score += 100;
        }
        if (config.maxConsecutiveDays <= 2 && recent.includes(twoDaysAgo) && recent.includes(prevDay)) {
          score += 200;
        }
        
        candidates.push({
          memberId: member.id,
          score,
          shiftCount: count,
        });
      }
      
      candidates.sort((a, b) => {
        if (a.score !== b.score) return a.score - b.score;
        return Math.random() - 0.5;
      });
      
      const selected = candidates.slice(0, actualDailyRequired);
      
      if (selected.length < actualDailyRequired) {
        warnings.push(`${date}: 可值班人数不足，需要 ${actualDailyRequired} 人，实际 ${selected.length} 人`);
      }
      
      for (const candidate of selected) {
        schedules.push({
          date,
          memberId: candidate.memberId,
          isLeave: false,
        });
        
        shiftCounts.set(candidate.memberId, candidate.shiftCount + 1);
        
        const recent = recentAssignments.get(candidate.memberId) || [];
        recent.push(date);
        if (recent.length > config.maxConsecutiveDays + 1) {
          recent.shift();
        }
        recentAssignments.set(candidate.memberId, recent);
      }
    }
    
    const optimizedSchedules = this.optimizeBalance(
      schedules,
      members,
      unavailableMap,
      config
    );
    
    return {
      schedules: optimizedSchedules,
      message: warnings.length > 0 ? warnings.join('\n') : undefined,
    };
  },

  optimizeBalance(
    schedules: Omit<Schedule, 'id' | 'createdAt' | 'updatedAt'>[],
    members: Member[],
    unavailableMap: Map<number, Set<string>>,
    config: ScheduleConfig
  ): Omit<Schedule, 'id' | 'createdAt' | 'updatedAt'>[] {
    const result = [...schedules];
    const maxIterations = 100;
    
    for (let iteration = 0; iteration < maxIterations; iteration++) {
      const counts = new Map<number, number>();
      for (const m of members) {
        counts.set(m.id, 0);
      }
      for (const s of result) {
        if (!s.isLeave) {
          const count = counts.get(s.memberId) || 0;
          counts.set(s.memberId, count + 1);
        }
      }
      
      const countValues = Array.from(counts.entries()).sort((a, b) => a[1] - b[1]);
      if (countValues.length < 2) break;
      
      const minMember = countValues[0];
      const maxMember = countValues[countValues.length - 1];
      
      if (maxMember[1] - minMember[1] <= 1) break;
      
      let swapped = false;
      for (let i = 0; i < result.length; i++) {
        const s = result[i];
        if (s.memberId === maxMember[0] && !s.isLeave) {
          const memberUnavailable = unavailableMap.get(minMember[0]);
          if (!memberUnavailable?.has(s.date)) {
            const tempScheds = result.map(r => ({ ...r }));
            tempScheds[i] = { ...tempScheds[i], memberId: minMember[0] };
            
            const fullScheds: Schedule[] = tempScheds.map((r, idx) => ({
              ...r,
              id: idx + 1,
              createdAt: '',
              updatedAt: '',
            }));
            
            const conflicts = conflictDetector.detectConsecutiveConflicts(
              fullScheds,
              config.maxConsecutiveDays
            );
            
            if (conflicts.length === 0) {
              result[i] = { ...result[i], memberId: minMember[0] };
              swapped = true;
              break;
            }
          }
        }
      }
      
      if (!swapped) break;
    }
    
    return result;
  },

  getMaxConsecutiveDays(schedules: Schedule[]): number {
    const memberSchedules = new Map<number, Schedule[]>();
    
    for (const s of schedules) {
      if (s.isLeave) continue;
      if (!memberSchedules.has(s.memberId)) {
        memberSchedules.set(s.memberId, []);
      }
      memberSchedules.get(s.memberId)!.push(s);
    }
    
    let maxConsecutive = 0;
    
    for (const [, memberScheds] of memberSchedules) {
      const sorted = [...memberScheds].sort((a, b) => a.date.localeCompare(b.date));
      let consecutive = 1;
      
      for (let i = 1; i < sorted.length; i++) {
        const prev = parseDate(sorted[i - 1].date);
        const curr = parseDate(sorted[i].date);
        const diffDays = Math.round((curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24));
        
        if (diffDays === 1) {
          consecutive++;
          maxConsecutive = Math.max(maxConsecutive, consecutive);
        } else {
          consecutive = 1;
        }
      }
      
      maxConsecutive = Math.max(maxConsecutive, consecutive);
    }
    
    return maxConsecutive;
  },
};

export default schedulingAlgorithm;
