import axios from 'axios';
import type {
  Member,
  UnavailableDate,
  ScheduleConfig,
  Schedule,
  ScheduleGenerateResult,
  ScheduleStatistics,
  Conflict,
} from '@shared/types';

const api = axios.create({
  baseURL: '/api',
  timeout: 10000,
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error('API Error:', error.message);
    return Promise.reject(error);
  }
);

export const memberApi = {
  getAll: () => api.get<{ data: Member[] }>('/members').then((r) => r.data.data),
  getById: (id: number) => api.get<{ data: Member }>(`/members/${id}`).then((r) => r.data.data),
  create: (data: { name: string; department?: string; email?: string; phone?: string }) =>
    api.post<{ data: Member }>('/members', data).then((r) => r.data.data),
  update: (id: number, data: { name?: string; department?: string; email?: string; phone?: string }) =>
    api.put<{ data: Member }>(`/members/${id}`, data).then((r) => r.data.data),
  delete: (id: number) => api.delete(`/members/${id}`).then((r) => r.data),
  getUnavailableDates: (memberId: number) =>
    api.get<{ data: UnavailableDate[] }>(`/members/${memberId}/unavailable`).then((r) => r.data.data),
  addUnavailableDates: (
    memberId: number,
    data: { date?: string; startDate?: string; endDate?: string; reason?: string }
  ) => api.post<{ data: UnavailableDate[] }>(`/members/${memberId}/unavailable`, data).then((r) => r.data.data),
  deleteUnavailableDate: (id: number) => api.delete(`/members/unavailable/${id}`).then((r) => r.data),
};

export const configApi = {
  get: () => api.get<{ data: ScheduleConfig }>('/config').then((r) => r.data.data),
  update: (data: {
    startDate?: string;
    cycleDays?: number;
    dailyRequired?: number;
    maxConsecutiveDays?: number;
    balanceWeight?: number;
  }) => api.put<{ data: ScheduleConfig }>('/config', data).then((r) => r.data.data),
};

export const scheduleApi = {
  get: (startDate: string, endDate: string) =>
    api.get<{ data: Schedule[] }>('/schedules', { params: { startDate, endDate } }).then((r) => r.data.data),
  generate: (params?: { startDate?: string; cycleDays?: number; dailyRequired?: number }) =>
    api.post<ScheduleGenerateResult>('/schedules/generate', params).then((r) => r.data),
  swap: (scheduleId1: number, scheduleId2: number) =>
    api.post<{ success: boolean; schedules: Schedule[]; conflicts: Conflict[] }>('/schedules/swap', {
      scheduleId1,
      scheduleId2,
    }).then((r) => r.data),
  replace: (scheduleId: number, newMemberId: number) =>
    api.post<{ success: boolean; schedules: Schedule[]; conflicts: Conflict[] }>('/schedules/replace', {
      scheduleId,
      newMemberId,
    }).then((r) => r.data),
  markLeave: (scheduleId: number, leaveType: string, substituteId?: number) =>
    api.post<{ data: Schedule }>('/schedules/leave', { scheduleId, leaveType, substituteId }).then((r) => r.data.data),
  cancelLeave: (scheduleId: number) =>
    api.delete<{ data: Schedule }>(`/schedules/leave/${scheduleId}`).then((r) => r.data.data),
  getConflicts: (startDate: string, endDate: string) =>
    api.get<{ data: Conflict[] }>('/schedules/conflicts', { params: { startDate, endDate } }).then((r) => r.data.data),
  getStatistics: (startDate?: string, endDate?: string) =>
    api.get<{ data: ScheduleStatistics }>('/schedules/statistics', { params: { startDate, endDate } }).then((r) => r.data.data),
};

export const exportApi = {
  exportCSV: (startDate?: string, endDate?: string) =>
    api.get('/export/csv', {
      params: { startDate, endDate },
      responseType: 'blob',
    }),
  exportSchedule: (startDate: string, endDate: string, format: string) =>
    api.get<Blob>('/export/csv', {
      params: { startDate, endDate, format },
      responseType: 'blob',
    }).then((r) => r.data),
};

export default api;
