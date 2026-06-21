import { runQuery, getQuery, allQuery } from '../config/database';
import { ScheduleConfig, ShiftConfig, ShiftType } from '../../shared/types';

interface ConfigRow {
  id: number;
  start_date: string;
  cycle_days: number;
  daily_required: number;
  max_consecutive_days: number;
  balance_weight: number;
  enable_multi_shift: number;
  created_at: string;
  updated_at: string;
}

interface ShiftConfigRow {
  id: number;
  shift_type: string;
  daily_required: number;
  member_ids: string;
  created_at: string;
  updated_at: string;
}

const toConfig = (row: ConfigRow): ScheduleConfig => ({
  id: row.id,
  startDate: row.start_date,
  cycleDays: row.cycle_days,
  dailyRequired: row.daily_required,
  maxConsecutiveDays: row.max_consecutive_days,
  balanceWeight: row.balance_weight,
  enableMultiShift: !!row.enable_multi_shift,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const toShiftConfig = (row: ShiftConfigRow): ShiftConfig => ({
  id: row.id,
  shiftType: row.shift_type as ShiftType,
  dailyRequired: row.daily_required,
  memberIds: JSON.parse(row.member_ids || '[]') as number[],
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

export const configRepository = {
  async get(): Promise<ScheduleConfig> {
    let row = await getQuery<ConfigRow>('SELECT * FROM schedule_config WHERE id = 1');
    
    if (!row) {
      const today = new Date();
      const monday = new Date(today);
      monday.setDate(today.getDate() - (today.getDay() + 6) % 7);
      const startDate = `${monday.getFullYear()}-${String(monday.getMonth() + 1).padStart(2, '0')}-${String(monday.getDate()).padStart(2, '0')}`;
      
      await runQuery(
        'INSERT INTO schedule_config (id, start_date, cycle_days, daily_required, max_consecutive_days, balance_weight, enable_multi_shift) VALUES (1, ?, 7, 1, 2, 80, 0)',
        [startDate]
      );
      row = await getQuery<ConfigRow>('SELECT * FROM schedule_config WHERE id = 1');
    }
    
    return toConfig(row!);
  },

  async update(data: {
    startDate?: string;
    cycleDays?: number;
    dailyRequired?: number;
    maxConsecutiveDays?: number;
    balanceWeight?: number;
    enableMultiShift?: boolean;
  }): Promise<ScheduleConfig> {
    await this.get();

    const fields: string[] = [];
    const params: (string | number | boolean)[] = [];
    
    if (data.startDate !== undefined) {
      fields.push('start_date = ?');
      params.push(data.startDate);
    }
    if (data.cycleDays !== undefined) {
      fields.push('cycle_days = ?');
      params.push(data.cycleDays);
    }
    if (data.dailyRequired !== undefined) {
      fields.push('daily_required = ?');
      params.push(data.dailyRequired);
    }
    if (data.maxConsecutiveDays !== undefined) {
      fields.push('max_consecutive_days = ?');
      params.push(data.maxConsecutiveDays);
    }
    if (data.balanceWeight !== undefined) {
      fields.push('balance_weight = ?');
      params.push(data.balanceWeight);
    }
    if (data.enableMultiShift !== undefined) {
      fields.push('enable_multi_shift = ?');
      params.push(data.enableMultiShift ? 1 : 0);
    }
    
    fields.push('updated_at = CURRENT_TIMESTAMP');
    
    if (fields.length > 1) {
      await runQuery(`UPDATE schedule_config SET ${fields.join(', ')} WHERE id = 1`, params);
    }
    
    return this.get();
  },

  async getAllShiftConfigs(): Promise<ShiftConfig[]> {
    const rows = await allQuery<ShiftConfigRow>('SELECT * FROM shift_configs ORDER BY id');
    if (rows.length === 0) {
      await runQuery(`
        INSERT INTO shift_configs (shift_type, daily_required, member_ids) VALUES
        ('morning', 1, '[]'),
        ('evening', 1, '[]'),
        ('night', 1, '[]')
      `);
      const reRows = await allQuery<ShiftConfigRow>('SELECT * FROM shift_configs ORDER BY id');
      return reRows.map(toShiftConfig);
    }
    return rows.map(toShiftConfig);
  },

  async updateShiftConfig(shiftType: ShiftType, data: {
    dailyRequired?: number;
    memberIds?: number[];
  }): Promise<ShiftConfig> {
    const existing = await getQuery<ShiftConfigRow>(
      'SELECT * FROM shift_configs WHERE shift_type = ?',
      [shiftType]
    );

    const fields: string[] = [];
    const params: (string | number)[] = [];

    if (data.dailyRequired !== undefined) {
      fields.push('daily_required = ?');
      params.push(data.dailyRequired);
    }
    if (data.memberIds !== undefined) {
      fields.push('member_ids = ?');
      params.push(JSON.stringify(data.memberIds));
    }

    if (fields.length === 0 && existing) {
      return toShiftConfig(existing);
    }

    fields.push('updated_at = CURRENT_TIMESTAMP');

    if (existing) {
      params.push(shiftType);
      await runQuery(
        `UPDATE shift_configs SET ${fields.join(', ')} WHERE shift_type = ?`,
        params
      );
    } else {
      const dailyReq = data.dailyRequired ?? 1;
      const memIds = data.memberIds ?? [];
      await runQuery(
        `INSERT INTO shift_configs (shift_type, daily_required, member_ids) VALUES (?, ?, ?)`,
        [shiftType, dailyReq, JSON.stringify(memIds)]
      );
    }

    const row = await getQuery<ShiftConfigRow>(
      'SELECT * FROM shift_configs WHERE shift_type = ?',
      [shiftType]
    );
    return toShiftConfig(row!);
  },

  async getShiftConfig(shiftType: ShiftType): Promise<ShiftConfig | null> {
    const row = await getQuery<ShiftConfigRow>(
      'SELECT * FROM shift_configs WHERE shift_type = ?',
      [shiftType]
    );
    return row ? toShiftConfig(row) : null;
  },
};

export default configRepository;
