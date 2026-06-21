import { runQuery, getQuery, allQuery } from '../config/database';
import { Schedule } from '../../shared/types';

const toSchedule = (row: any): Schedule => ({
  id: row.id,
  date: row.date,
  memberId: row.member_id,
  isLeave: !!row.is_leave,
  leaveType: row.leave_type || undefined,
  substituteId: row.substitute_id || undefined,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

export const scheduleRepository = {
  async findByDateRange(startDate: string, endDate: string): Promise<Schedule[]> {
    const rows = await allQuery(
      'SELECT * FROM schedules WHERE date >= ? AND date <= ? ORDER BY date, id',
      [startDate, endDate]
    );
    return rows.map(toSchedule);
  },

  async findById(id: number): Promise<Schedule | null> {
    const row = await getQuery('SELECT * FROM schedules WHERE id = ?', [id]);
    return row ? toSchedule(row) : null;
  },

  async create(date: string, memberId: number): Promise<Schedule> {
    const result = await runQuery(
      'INSERT INTO schedules (date, member_id) VALUES (?, ?)',
      [date, memberId]
    );
    return this.findById(result.lastID) as Promise<Schedule>;
  },

  async updateMember(id: number, memberId: number): Promise<Schedule | null> {
    await runQuery(
      'UPDATE schedules SET member_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [memberId, id]
    );
    return this.findById(id);
  },

  async setLeave(id: number, leaveType: string, substituteId?: number): Promise<Schedule | null> {
    await runQuery(
      'UPDATE schedules SET is_leave = 1, leave_type = ?, substitute_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [leaveType, substituteId || null, id]
    );
    return this.findById(id);
  },

  async cancelLeave(id: number): Promise<Schedule | null> {
    await runQuery(
      'UPDATE schedules SET is_leave = 0, leave_type = NULL, substitute_id = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [id]
    );
    return this.findById(id);
  },

  async deleteByDateRange(startDate: string, endDate: string): Promise<number> {
    const result = await runQuery(
      'DELETE FROM schedules WHERE date >= ? AND date <= ?',
      [startDate, endDate]
    );
    return result.changes;
  },

  async countByMemberAndDateRange(memberId: number, startDate: string, endDate: string): Promise<number> {
    const row = await getQuery(
      'SELECT COUNT(*) as count FROM schedules WHERE member_id = ? AND date >= ? AND date <= ? AND is_leave = 0',
      [memberId, startDate, endDate]
    );
    return row?.count || 0;
  },

  async findByMemberAndDate(memberId: number, date: string): Promise<Schedule | null> {
    const row = await getQuery(
      'SELECT * FROM schedules WHERE member_id = ? AND date = ? LIMIT 1',
      [memberId, date]
    );
    return row ? toSchedule(row) : null;
  },

  async bulkCreate(schedules: { date: string; memberId: number }[]): Promise<Schedule[]> {
    const created: Schedule[] = [];
    for (const s of schedules) {
      const schedule = await this.create(s.date, s.memberId);
      created.push(schedule);
    }
    return created;
  },

  async findConsecutiveByMember(memberId: number, date: string, maxDays: number): Promise<Schedule[]> {
    const rows = await allQuery(
      `SELECT * FROM schedules 
       WHERE member_id = ? 
       AND date >= date(?, ?) 
       AND date <= date(?, ?)
       AND is_leave = 0
       ORDER BY date`,
      [memberId, date, `-${maxDays - 1} days`, date, `${maxDays - 1} days`]
    );
    return rows.map(toSchedule);
  },
};

export default scheduleRepository;
