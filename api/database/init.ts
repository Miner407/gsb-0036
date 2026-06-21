import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { runQuery, getQuery, allQuery } from '../config/database';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const migrateDatabase = async (): Promise<void> => {
  const scheduleTableExists = await getQuery<{ name: string }>(
    "SELECT name FROM sqlite_master WHERE type='table' AND name='schedules'"
  );

  if (scheduleTableExists) {
    const scheduleCols = await allQuery<{ name: string }>("PRAGMA table_info(schedules)");
    const colNames = scheduleCols.map(c => c.name);

    if (!colNames.includes('shift')) {
      await runQuery(`ALTER TABLE schedules ADD COLUMN shift VARCHAR(20) NOT NULL DEFAULT 'day'`);
      console.log('Migrated: added shift column to schedules');
    }
  }

  const configTableExists = await getQuery<{ name: string }>(
    "SELECT name FROM sqlite_master WHERE type='table' AND name='schedule_config'"
  );

  if (configTableExists) {
    const configCols = await allQuery<{ name: string }>("PRAGMA table_info(schedule_config)");
    const configColNames = configCols.map(c => c.name);

    if (!configColNames.includes('enable_multi_shift')) {
      await runQuery(`ALTER TABLE schedule_config ADD COLUMN enable_multi_shift INTEGER NOT NULL DEFAULT 0`);
      console.log('Migrated: added enable_multi_shift column to schedule_config');
    }
  }

  const shiftTableExists = await getQuery<{ name: string }>(
    "SELECT name FROM sqlite_master WHERE type='table' AND name='shift_configs'"
  );

  if (!shiftTableExists) {
    await runQuery(`
      CREATE TABLE IF NOT EXISTS shift_configs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        shift_type VARCHAR(20) NOT NULL,
        daily_required INTEGER NOT NULL DEFAULT 1,
        member_ids TEXT NOT NULL DEFAULT '[]',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(shift_type)
      )
    `);
    await runQuery(`
      INSERT INTO shift_configs (shift_type, daily_required, member_ids) VALUES
      ('morning', 1, '[]'),
      ('evening', 1, '[]'),
      ('night', 1, '[]')
    `);
    console.log('Migrated: created shift_configs table');
  }

  if (scheduleTableExists) {
    const idxExists = await getQuery<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type='index' AND name='idx_schedules_shift'"
    );
    if (!idxExists) {
      await runQuery('CREATE INDEX IF NOT EXISTS idx_schedules_shift ON schedules(shift)');
    }
  }
};

export const initDatabase = async (): Promise<void> => {
  try {
    await migrateDatabase();

    const schemaPath = path.join(__dirname, 'schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');

    const statements = schema.split(';').filter(stmt => stmt.trim());

    for (const stmt of statements) {
      if (stmt.trim()) {
        await runQuery(stmt);
      }
    }

    console.log('Database initialized successfully');
  } catch (error) {
    console.error('Error initializing database:', error);
    throw error;
  }
};

export default initDatabase;
