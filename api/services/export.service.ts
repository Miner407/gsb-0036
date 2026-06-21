import { scheduleRepository } from '../repositories/schedule.repository';
import { memberService } from './member.service';
import { generateScheduleCSV, downloadCSV } from '../utils/csv.utils';
import { formatDate, addDays, parseDate } from '../utils/date.utils';

export const exportService = {
  async exportToCSV(startDate?: string, endDate?: string): Promise<{
    content: string;
    headers: {
      'Content-Type': string;
      'Content-Disposition': string;
    };
  }> {
    const today = new Date();
    const defaultStart = formatDate(new Date(today.getFullYear(), today.getMonth(), 1));
    const defaultEnd = formatDate(new Date(today.getFullYear(), today.getMonth() + 1, 0));

    const actualStart = startDate || defaultStart;
    const actualEnd = endDate || defaultEnd;

    const [schedules, members] = await Promise.all([
      scheduleRepository.findByDateRange(actualStart, actualEnd),
      memberService.getAllMembers(),
    ]);

    const memberMap = new Map(members.map((m) => [m.id, m.name]));

    const schedulesWithNames = schedules.map((s) => ({
      ...s,
      memberName: memberMap.get(s.memberId) || '未知',
      substituteName: s.substituteId ? memberMap.get(s.substituteId) || '未知' : undefined,
    }));

    const csvContent = generateScheduleCSV(schedulesWithNames, members);
    const filename = `排班表_${actualStart}_${actualEnd}.csv`;

    return downloadCSV(csvContent, filename);
  },
};

export default exportService;
