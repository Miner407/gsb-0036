import { runQuery, getQuery } from '../config/database';
import { ScheduleConfig } from '../../shared/types';

const toConfig = (row: any): ScheduleConfig => ({
  id: row.id,
  startDate: row.start_date,
  cycleDays: row.cycle_days,
  dailyRequired: row.daily_required,
  maxConsecutiveDays: row.max_consecutive_days,
  balanceWeight: row.balance_weight,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

export const configRepository = {
  async get(): Promise<ScheduleConfig> {
    let row = await getQuery('SELECT * FROM schedule_config WHERE id = 1');
    
    if (!row) {
      const today = new Date();
      const monday = new Date(today);
      monday.setDate(today.getDate() - (today.getDay() + 6) % 7);
      const startDate = `${monday.getFullYear()}-${String(monday.getMonth() + 1).padStart(2, '0')}-${String(monday.getDate()).padStart(2, '0')}`;
      
      await runQuery(
        'INSERT INTO schedule_config (id, start_date, cycle_days, daily_required, max_consecutive_days, balance_weight) VALUES (1, ?, 7, 1, 2, 80)',
        [startDate]
      );
      row = await getQuery('SELECT * FROM schedule_config WHERE id = 1');
    }
    
    return toConfig(row);
  },

  async update(data: {
    startDate?: string;
    cycleDays?: number;
    dailyRequired?: number;
    maxConsecutiveDays?: number;
    balanceWeight?: number;
  }): Promise<ScheduleConfig> {
    const fields = [];
    const params = [];
    
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
    
    fields.push('updated_at = CURRENT_TIMESTAMP');
    
    if (fields.length > 1) {
      await runQuery(`UPDATE schedule_config SET ${fields.join(', ')} WHERE id = 1`, params);
    }
    
    return this.get();
  },
};

export default configRepository;
