export const formatDate = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const parseDate = (dateStr: string): Date => {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day);
};

export const addDays = (date: Date, days: number): Date => {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
};

export const getDatesInRange = (startDate: string, endDate: string): string[] => {
  const dates: string[] = [];
  const start = parseDate(startDate);
  const end = parseDate(endDate);
  
  let current = new Date(start);
  while (current <= end) {
    dates.push(formatDate(current));
    current = addDays(current, 1);
  }
  
  return dates;
};

export const getWeekday = (dateStr: string): string => {
  const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
  const date = parseDate(dateStr);
  return weekdays[date.getDay()];
};

export const isToday = (dateStr: string): boolean => {
  return dateStr === formatDate(new Date());
};

export const isPast = (dateStr: string): boolean => {
  const today = formatDate(new Date());
  return dateStr < today;
};

export const isFuture = (dateStr: string): boolean => {
  const today = formatDate(new Date());
  return dateStr > today;
};

export const getDaysDiff = (date1: string, date2: string): number => {
  const d1 = parseDate(date1);
  const d2 = parseDate(date2);
  const diffTime = Math.abs(d2.getTime() - d1.getTime());
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
};

export const getMonthDates = (year: number, month: number): string[] => {
  const dates: string[] = [];
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  
  for (let d = new Date(firstDay); d <= lastDay; d.setDate(d.getDate() + 1)) {
    dates.push(formatDate(d));
  }
  
  return dates;
};

export const getCalendarMonthDates = (year: number, month: number): string[] => {
  const dates: string[] = [];
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  
  const firstDayOfWeek = firstDay.getDay();
  const lastDayOfWeek = lastDay.getDay();
  
  for (let i = firstDayOfWeek - 1; i >= 0; i--) {
    const d = new Date(firstDay);
    d.setDate(d.getDate() - i - 1);
    dates.push(formatDate(d));
  }
  
  for (let d = new Date(firstDay); d <= lastDay; d.setDate(d.getDate() + 1)) {
    dates.push(formatDate(d));
  }
  
  for (let i = 1; i < 7 - lastDayOfWeek; i++) {
    const d = new Date(lastDay);
    d.setDate(d.getDate() + i);
    dates.push(formatDate(d));
  }
  
  return dates;
};
