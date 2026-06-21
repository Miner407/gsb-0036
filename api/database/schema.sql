CREATE TABLE IF NOT EXISTS members (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name VARCHAR(100) NOT NULL,
  department VARCHAR(100),
  email VARCHAR(100),
  phone VARCHAR(20),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS unavailable_dates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  member_id INTEGER NOT NULL,
  date DATE NOT NULL,
  reason VARCHAR(255),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS schedule_config (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  start_date DATE NOT NULL,
  cycle_days INTEGER NOT NULL DEFAULT 7,
  daily_required INTEGER NOT NULL DEFAULT 1,
  max_consecutive_days INTEGER NOT NULL DEFAULT 2,
  balance_weight INTEGER NOT NULL DEFAULT 80,
  enable_multi_shift INTEGER NOT NULL DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS shift_configs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  shift_type VARCHAR(20) NOT NULL,
  daily_required INTEGER NOT NULL DEFAULT 1,
  member_ids TEXT NOT NULL DEFAULT '[]',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(shift_type)
);

CREATE TABLE IF NOT EXISTS schedules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date DATE NOT NULL,
  member_id INTEGER NOT NULL,
  shift VARCHAR(20) NOT NULL DEFAULT 'day',
  is_leave BOOLEAN NOT NULL DEFAULT 0,
  leave_type VARCHAR(50),
  substitute_id INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (member_id) REFERENCES members(id),
  FOREIGN KEY (substitute_id) REFERENCES members(id)
);

CREATE INDEX IF NOT EXISTS idx_schedules_date ON schedules(date);
CREATE INDEX IF NOT EXISTS idx_schedules_member ON schedules(member_id);
CREATE INDEX IF NOT EXISTS idx_schedules_shift ON schedules(shift);
CREATE INDEX IF NOT EXISTS idx_unavailable_member ON unavailable_dates(member_id);
CREATE INDEX IF NOT EXISTS idx_unavailable_date ON unavailable_dates(date);

INSERT OR IGNORE INTO schedule_config 
(id, start_date, cycle_days, daily_required, max_consecutive_days, balance_weight, enable_multi_shift)
VALUES (1, DATE('now', 'weekday 1'), 7, 1, 2, 80, 0);

INSERT OR IGNORE INTO shift_configs (shift_type, daily_required, member_ids) VALUES
('morning', 1, '[]'),
('evening', 1, '[]'),
('night', 1, '[]');
