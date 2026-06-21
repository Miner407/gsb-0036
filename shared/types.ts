export type ShiftType = 'morning' | 'evening' | 'night' | 'day';

export const SHIFT_LABELS: Record<ShiftType, string> = {
  morning: '早班',
  evening: '晚班',
  night: '夜班',
  day: '白班',
};

export const SHIFT_ORDER: ShiftType[] = ['morning', 'evening', 'night'];

export interface Member {
  id: number;
  name: string;
  department?: string;
  email?: string;
  phone?: string;
  createdAt: string;
}

export interface UnavailableDate {
  id: number;
  memberId: number;
  date: string;
  reason?: string;
  createdAt: string;
}

export interface ShiftConfig {
  id: number;
  shiftType: ShiftType;
  dailyRequired: number;
  memberIds: number[];
  createdAt: string;
  updatedAt: string;
}

export interface ScheduleConfig {
  id: number;
  startDate: string;
  cycleDays: number;
  dailyRequired: number;
  maxConsecutiveDays: number;
  balanceWeight: number;
  enableMultiShift: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Schedule {
  id: number;
  date: string;
  memberId: number;
  shift: ShiftType;
  isLeave: boolean;
  leaveType?: string;
  substituteId?: number;
  createdAt: string;
  updatedAt: string;
}

export type ConflictType = 'consecutive' | 'unavailable' | 'insufficient' | 'duplicate_same_day' | 'imbalance';
export type ConflictSeverity = 'warning' | 'error';

export interface Conflict {
  type: ConflictType;
  severity: ConflictSeverity;
  date?: string;
  memberId?: number;
  shiftType?: ShiftType;
  message: string;
}

export interface MemberShiftCount {
  memberId: number;
  memberName: string;
  count: number;
  shiftBreakdown: Record<ShiftType, number>;
}

export interface ScheduleStatistics {
  totalDays: number;
  totalShifts: number;
  memberShifts: MemberShiftCount[];
  maxConsecutive: number;
  shiftBreakdown: Record<ShiftType, number>;
}

export interface ScheduleGenerateResult {
  success: boolean;
  schedules: Schedule[];
  conflicts: Conflict[];
  statistics: ScheduleStatistics;
}

export interface SwapRequest {
  scheduleId1: number;
  scheduleId2: number;
}

export interface ReplaceRequest {
  scheduleId: number;
  newMemberId: number;
}

export interface LeaveRequest {
  scheduleId: number;
  leaveType: string;
  substituteId?: number;
}

export interface UnavailableDateBatchRequest {
  date?: string;
  startDate?: string;
  endDate?: string;
  reason?: string;
}

export interface ShiftConfigRequest {
  shiftType: ShiftType;
  dailyRequired: number;
  memberIds: number[];
}

export interface OperationResult {
  success: boolean;
  message?: string;
  conflicts?: Conflict[];
}

export interface ApiResponse<T> {
  data?: T;
  error?: string;
  message?: string;
}
