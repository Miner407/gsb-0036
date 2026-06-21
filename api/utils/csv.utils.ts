import { Schedule, Member } from '../../shared/types';
import { getWeekday } from './date.utils';

export const generateScheduleCSV = (
  schedules: (Schedule & { memberName?: string; substituteName?: string })[],
  members: Member[]
): string => {
  const memberMap = new Map(members.map(m => [m.id, m.name]));
  
  const schedulesByDate = new Map<string, typeof schedules>();
  for (const s of schedules) {
    if (!schedulesByDate.has(s.date)) {
      schedulesByDate.set(s.date, []);
    }
    schedulesByDate.get(s.date)!.push(s);
  }
  
  const sortedDates = Array.from(schedulesByDate.keys()).sort();
  
  const header = ['日期', '星期', '值班人员', '请假情况', '代班人员'];
  const rows: string[][] = [header];
  
  for (const date of sortedDates) {
    const daySchedules = schedulesByDate.get(date)!;
    const weekday = getWeekday(date);
    
    const dutyNames: string[] = [];
    const leaveInfo: string[] = [];
    const substituteNames: string[] = [];
    
    for (const s of daySchedules) {
      const memberName = s.memberName || memberMap.get(s.memberId) || '未知';
      dutyNames.push(memberName);
      
      if (s.isLeave) {
        leaveInfo.push(`${memberName}(${s.leaveType || '请假'})`);
        if (s.substituteId) {
          const subName = s.substituteName || memberMap.get(s.substituteId) || '未知';
          substituteNames.push(subName);
        }
      }
    }
    
    rows.push([
      date,
      weekday,
      dutyNames.join('、'),
      leaveInfo.join('、') || '-',
      substituteNames.join('、') || '-'
    ]);
  }
  
  return rows.map(row => 
    row.map(cell => {
      if (cell.includes(',') || cell.includes('"') || cell.includes('\n')) {
        return `"${cell.replace(/"/g, '""')}"`;
      }
      return cell;
    }).join(',')
  ).join('\n');
};

export const downloadCSV = (content: string, filename: string): {
  content: string;
  headers: {
    'Content-Type': string;
    'Content-Disposition': string;
  };
} => {
  const BOM = '\uFEFF';
  return {
    content: BOM + content,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${encodeURIComponent(filename)}"`,
    },
  };
};
