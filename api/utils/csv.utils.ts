import { Schedule, Member, SHIFT_LABELS, ShiftType } from '../../shared/types';
import { getWeekday } from './date.utils';

type ScheduleWithNames = Schedule & { memberName?: string; substituteName?: string };

export const generateScheduleCSV = (
  schedules: ScheduleWithNames[],
  members: Member[]
): string => {
  const memberMap = new Map(members.map((m) => [m.id, m.name]));

  const schedulesByDate = new Map<string, ScheduleWithNames[]>();
  for (const s of schedules) {
    if (!schedulesByDate.has(s.date)) {
      schedulesByDate.set(s.date, []);
    }
    schedulesByDate.get(s.date)!.push(s);
  }

  const sortedDates = Array.from(schedulesByDate.keys()).sort();

  const header = ['日期', '星期', '班次', '值班人员', '请假情况', '代班人员'];
  const rows: string[][] = [header];

  for (const date of sortedDates) {
    const daySchedules = schedulesByDate.get(date)!;
    const weekday = getWeekday(date);

    const grouped = new Map<ShiftType, ScheduleWithNames[]>();
    for (const s of daySchedules) {
      if (!grouped.has(s.shift)) {
        grouped.set(s.shift, []);
      }
      grouped.get(s.shift)!.push(s);
    }

    const sortedShifts = Array.from(grouped.keys()).sort((a, b) => {
      const order: ShiftType[] = ['morning', 'day', 'evening', 'night'];
      return order.indexOf(a) - order.indexOf(b);
    });

    for (const shift of sortedShifts) {
      const shiftScheds = grouped.get(shift)!;
      const shiftLabel = SHIFT_LABELS[shift] || shift;

      const dutyNames: string[] = [];
      const leaveInfo: string[] = [];
      const substituteNames: string[] = [];

      for (const s of shiftScheds) {
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
        shiftLabel,
        dutyNames.join('、'),
        leaveInfo.join('、') || '-',
        substituteNames.join('、') || '-',
      ]);
    }
  }

  return rows
    .map((row) =>
      row.map((cell) => {
        if (cell.includes(',') || cell.includes('"') || cell.includes('\n')) {
          return `"${cell.replace(/"/g, '""')}"`;
        }
        return cell;
      }).join(',')
    )
    .join('\n');
};

export const downloadCSV = (
  content: string,
  filename: string
): {
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
