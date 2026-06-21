import { create } from 'zustand';
import { memberApi, configApi, scheduleApi, exportApi } from '@/services/api';
import { formatDate, addDays } from '@/utils/date';
import type {
  Member,
  UnavailableDate,
  ScheduleConfig,
  Schedule,
  ScheduleStatistics,
  Conflict,
} from '@shared/types';

interface ScheduleState {
  members: Member[];
  config: ScheduleConfig | null;
  schedules: Schedule[];
  statistics: ScheduleStatistics | null;
  conflicts: Conflict[];
  unavailableDates: Map<number, UnavailableDate[]>;
  loading: boolean;
  error: string | null;
  
  loadMembers: () => Promise<void>;
  addMember: (data: { name: string; department?: string; email?: string; phone?: string }) => Promise<void>;
  updateMember: (id: number, data: { name?: string; department?: string; email?: string; phone?: string }) => Promise<void>;
  deleteMember: (id: number) => Promise<void>;
  
  loadUnavailableDates: (memberId: number) => Promise<void>;
  addUnavailableDates: (memberId: number, data: { date?: string; startDate?: string; endDate?: string; reason?: string }) => Promise<void>;
  deleteUnavailableDate: (id: number) => Promise<void>;
  
  loadConfig: () => Promise<void>;
  updateConfig: (data: {
    startDate?: string;
    cycleDays?: number;
    dailyRequired?: number;
    maxConsecutiveDays?: number;
    balanceWeight?: number;
  }) => Promise<void>;
  
  loadSchedules: (startDate: string, endDate: string) => Promise<void>;
  generateSchedule: (params?: { startDate?: string; cycleDays?: number; dailyRequired?: number }) => Promise<{ success: boolean; conflicts: Conflict[] }>;
  swapSchedules: (scheduleId1: number, scheduleId2: number) => Promise<{ success: boolean; conflicts: Conflict[] }>;
  replaceSchedule: (scheduleId: number, newMemberId: number) => Promise<{ success: boolean; conflicts: Conflict[] }>;
  markLeave: (scheduleId: number, leaveType: string, substituteId?: number) => Promise<void>;
  cancelLeave: (scheduleId: number) => Promise<void>;
  
  loadStatistics: (startDate?: string, endDate?: string) => Promise<void>;
  loadConflicts: (startDate: string, endDate: string) => Promise<void>;
  checkConflicts: () => Promise<void>;
  
  exportService: {
    exportSchedule: (startDate: string, endDate: string, format: string) => Promise<Blob>;
  };
  
  clearError: () => void;
}

export const useScheduleStore = create<ScheduleState>((set, get) => ({
  members: [],
  config: null,
  schedules: [],
  statistics: null,
  conflicts: [],
  unavailableDates: new Map(),
  loading: false,
  error: null,

  loadMembers: async () => {
    try {
      set({ loading: true, error: null });
      const members = await memberApi.getAll();
      set({ members });
    } catch (error: unknown) {
      set({ error: (error as Error).message || '加载成员列表失败' });
    } finally {
      set({ loading: false });
    }
  },

  addMember: async (data) => {
    try {
      set({ loading: true, error: null });
      await memberApi.create(data);
      await get().loadMembers();
    } catch (error: unknown) {
      set({ error: (error as Error).message || '添加成员失败' });
      throw error;
    } finally {
      set({ loading: false });
    }
  },

  updateMember: async (id, data) => {
    try {
      set({ loading: true, error: null });
      await memberApi.update(id, data);
      await get().loadMembers();
    } catch (error: unknown) {
      set({ error: (error as Error).message || '更新成员失败' });
      throw error;
    } finally {
      set({ loading: false });
    }
  },

  deleteMember: async (id) => {
    try {
      set({ loading: true, error: null });
      await memberApi.delete(id);
      await get().loadMembers();
    } catch (error: unknown) {
      set({ error: (error as Error).message || '删除成员失败' });
      throw error;
    } finally {
      set({ loading: false });
    }
  },

  loadUnavailableDates: async (memberId) => {
    try {
      set({ loading: true, error: null });
      const dates = await memberApi.getUnavailableDates(memberId);
      const newMap = new Map(get().unavailableDates);
      newMap.set(memberId, dates);
      set({ unavailableDates: newMap });
    } catch (error: unknown) {
      set({ error: (error as Error).message || '加载不可值班日期失败' });
    } finally {
      set({ loading: false });
    }
  },

  addUnavailableDates: async (memberId, data) => {
    try {
      set({ loading: true, error: null });
      await memberApi.addUnavailableDates(memberId, data);
      await get().loadUnavailableDates(memberId);
    } catch (error: unknown) {
      set({ error: (error as Error).message || '添加不可值班日期失败' });
      throw error;
    } finally {
      set({ loading: false });
    }
  },

  deleteUnavailableDate: async (id) => {
    try {
      set({ loading: true, error: null });
      await memberApi.deleteUnavailableDate(id);
    } catch (error: unknown) {
      set({ error: (error as Error).message || '删除不可值班日期失败' });
      throw error;
    } finally {
      set({ loading: false });
    }
  },

  loadConfig: async () => {
    try {
      set({ loading: true, error: null });
      const config = await configApi.get();
      set({ config });
    } catch (error: unknown) {
      set({ error: (error as Error).message || '加载配置失败' });
    } finally {
      set({ loading: false });
    }
  },

  updateConfig: async (data) => {
    try {
      set({ loading: true, error: null });
      const config = await configApi.update(data);
      set({ config });
    } catch (error: unknown) {
      set({ error: (error as Error).message || '更新配置失败' });
      throw error;
    } finally {
      set({ loading: false });
    }
  },

  loadSchedules: async (startDate, endDate) => {
    try {
      set({ loading: true, error: null });
      const schedules = await scheduleApi.get(startDate, endDate);
      set({ schedules });
    } catch (error: unknown) {
      set({ error: (error as Error).message || '加载排班表失败' });
    } finally {
      set({ loading: false });
    }
  },

  generateSchedule: async (params) => {
    try {
      set({ loading: true, error: null });
      const result = await scheduleApi.generate(params);
      if (result.success && result.schedules.length > 0) {
        set({ schedules: result.schedules, statistics: result.statistics, conflicts: result.conflicts });
      }
      return { success: result.success, conflicts: result.conflicts };
    } catch (error: unknown) {
      set({ error: (error as Error).message || '生成排班失败' });
      throw error;
    } finally {
      set({ loading: false });
    }
  },

  swapSchedules: async (scheduleId1, scheduleId2) => {
    try {
      set({ loading: true, error: null });
      const result = await scheduleApi.swap(scheduleId1, scheduleId2);
      if (result.success) {
        const current = get().schedules;
        const updated = current.map((s) => {
          const updatedSchedule = result.schedules.find((us) => us.id === s.id);
          return updatedSchedule || s;
        });
        set({ schedules: updated });
      }
      return { success: result.success, conflicts: result.conflicts };
    } catch (error: unknown) {
      set({ error: (error as Error).message || '调班失败' });
      throw error;
    } finally {
      set({ loading: false });
    }
  },

  replaceSchedule: async (scheduleId, newMemberId) => {
    try {
      set({ loading: true, error: null });
      const result = await scheduleApi.replace(scheduleId, newMemberId);
      if (result.success) {
        const current = get().schedules;
        const updated = current.map((s) => {
          const updatedSchedule = result.schedules.find((us) => us.id === s.id);
          return updatedSchedule || s;
        });
        set({ schedules: updated });
      }
      return { success: result.success, conflicts: result.conflicts };
    } catch (error: unknown) {
      set({ error: (error as Error).message || '调班失败' });
      throw error;
    } finally {
      set({ loading: false });
    }
  },

  markLeave: async (scheduleId, leaveType, substituteId) => {
    try {
      set({ loading: true, error: null });
      const schedule = await scheduleApi.markLeave(scheduleId, leaveType, substituteId);
      const current = get().schedules;
      const updated = current.map((s) => (s.id === scheduleId ? schedule : s));
      set({ schedules: updated });
    } catch (error: unknown) {
      set({ error: (error as Error).message || '标记请假失败' });
      throw error;
    } finally {
      set({ loading: false });
    }
  },

  cancelLeave: async (scheduleId) => {
    try {
      set({ loading: true, error: null });
      const schedule = await scheduleApi.cancelLeave(scheduleId);
      const current = get().schedules;
      const updated = current.map((s) => (s.id === scheduleId ? schedule : s));
      set({ schedules: updated });
    } catch (error: unknown) {
      set({ error: (error as Error).message || '取消请假失败' });
      throw error;
    } finally {
      set({ loading: false });
    }
  },

  loadStatistics: async (startDate, endDate) => {
    try {
      set({ loading: true, error: null });
      const statistics = await scheduleApi.getStatistics(startDate, endDate);
      set({ statistics });
    } catch (error: unknown) {
      set({ error: (error as Error).message || '加载统计数据失败' });
    } finally {
      set({ loading: false });
    }
  },

  loadConflicts: async (startDate, endDate) => {
    try {
      set({ loading: true, error: null });
      const conflicts = await scheduleApi.getConflicts(startDate, endDate);
      set({ conflicts });
    } catch (error: unknown) {
      set({ error: (error as Error).message || '加载冲突数据失败' });
    } finally {
      set({ loading: false });
    }
  },

  checkConflicts: async () => {
    const state = get();
    if (!state.config) return;
    const endDate = formatDate(addDays(new Date(state.config.startDate), state.config.cycleDays - 1));
    await state.loadConflicts(state.config.startDate, endDate);
  },

  exportService: {
    exportSchedule: async (startDate: string, endDate: string, format: string) => {
      const response = await exportApi.exportSchedule(startDate, endDate, format);
      return response;
    },
  },

  clearError: () => set({ error: null }),
}));

export default useScheduleStore;
