import { runQuery, getQuery, allQuery } from '../config/database';
import { Member, UnavailableDate } from '../../shared/types';

const toMember = (row: any): Member => ({
  id: row.id,
  name: row.name,
  department: row.department || undefined,
  email: row.email || undefined,
  phone: row.phone || undefined,
  createdAt: row.created_at,
});

const toUnavailableDate = (row: any): UnavailableDate => ({
  id: row.id,
  memberId: row.member_id,
  date: row.date,
  reason: row.reason || undefined,
  createdAt: row.created_at,
});

export const memberRepository = {
  async findAll(): Promise<Member[]> {
    const rows = await allQuery('SELECT * FROM members ORDER BY id');
    return rows.map(toMember);
  },

  async findById(id: number): Promise<Member | null> {
    const row = await getQuery('SELECT * FROM members WHERE id = ?', [id]);
    return row ? toMember(row) : null;
  },

  async create(data: { name: string; department?: string; email?: string; phone?: string }): Promise<Member> {
    const result = await runQuery(
      'INSERT INTO members (name, department, email, phone) VALUES (?, ?, ?, ?)',
      [data.name, data.department || null, data.email || null, data.phone || null]
    );
    return this.findById(result.lastID) as Promise<Member>;
  },

  async update(id: number, data: { name?: string; department?: string; email?: string; phone?: string }): Promise<Member | null> {
    const fields = [];
    const params = [];
    
    if (data.name !== undefined) {
      fields.push('name = ?');
      params.push(data.name);
    }
    if (data.department !== undefined) {
      fields.push('department = ?');
      params.push(data.department);
    }
    if (data.email !== undefined) {
      fields.push('email = ?');
      params.push(data.email);
    }
    if (data.phone !== undefined) {
      fields.push('phone = ?');
      params.push(data.phone);
    }
    
    if (fields.length === 0) {
      return this.findById(id);
    }
    
    params.push(id);
    await runQuery(`UPDATE members SET ${fields.join(', ')} WHERE id = ?`, params);
    return this.findById(id);
  },

  async delete(id: number): Promise<boolean> {
    const result = await runQuery('DELETE FROM members WHERE id = ?', [id]);
    return result.changes > 0;
  },

  async findUnavailableDates(memberId: number): Promise<UnavailableDate[]> {
    const rows = await allQuery(
      'SELECT * FROM unavailable_dates WHERE member_id = ? ORDER BY date',
      [memberId]
    );
    return rows.map(toUnavailableDate);
  },

  async findAllUnavailableDates(): Promise<UnavailableDate[]> {
    const rows = await allQuery('SELECT * FROM unavailable_dates ORDER BY date');
    return rows.map(toUnavailableDate);
  },

  async addUnavailableDate(memberId: number, date: string, reason?: string): Promise<UnavailableDate> {
    const result = await runQuery(
      'INSERT INTO unavailable_dates (member_id, date, reason) VALUES (?, ?, ?)',
      [memberId, date, reason || null]
    );
    const row = await getQuery('SELECT * FROM unavailable_dates WHERE id = ?', [result.lastID]);
    return toUnavailableDate(row);
  },

  async deleteUnavailableDate(id: number): Promise<boolean> {
    const result = await runQuery('DELETE FROM unavailable_dates WHERE id = ?', [id]);
    return result.changes > 0;
  },

  async isDateUnavailable(memberId: number, date: string): Promise<boolean> {
    const row = await getQuery(
      'SELECT 1 FROM unavailable_dates WHERE member_id = ? AND date = ? LIMIT 1',
      [memberId, date]
    );
    return !!row;
  },
};

export default memberRepository;
