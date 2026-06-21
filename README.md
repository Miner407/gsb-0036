# 小团队值班排班与调班系统

基于 React + TypeScript + Vite + Express + SQLite 构建的小团队值班排班管理系统，支持成员管理、多班次自动排班、调班/替班/请假、冲突检测、CSV 导出等功能。

## 功能特性

- 👥 **成员管理**：添加、编辑、删除团队成员；为每位成员设置不可值班日期（单日或日期范围）
- 🗓️ **单班次/多班次模式**：
  - 单班次模式：传统"每天 N 人"值班排班
  - **多班次模式**：支持早班（morning）、晚班（evening）、夜班（night）分别设置每日所需人数和可值班成员范围
- ⚙️ **智能排班算法**：按班次均衡分配，避免同一成员同一天重复排班；支持最大连续值班天数、均衡度权重等参数
- 🔍 **四类冲突检测**：
  1. `unavailable`（不可值班冲突）：成员在不可值班日期被排
  2. `consecutive`（连续值班冲突）：连续值班超过配置的最大天数
  3. `insufficient`（人数不足）：某班次/某日实际排班人数少于所需
  4. `duplicate_same_day`（同日重复）：同一成员被排到同一天的多个班次
  5. `imbalance`（不均衡警告）：各成员值班次数差异过大
- 🔄 **调班/替班/请假**：交换两人排班、指定替班、标记请假并可选代班人
- 📤 **CSV 导出**：包含班次列，支持按班次筛选导出
- 📊 **统计仪表盘**：展示排班周期、班次分布、均衡度、最长连续值班等指标

## 目录结构

```
gsb-0036/
├── api/                          # 后端 (Express + TypeScript)
│   ├── config/
│   │   └── database.ts           # SQLite 连接与查询封装
│   ├── controllers/              # Express 控制器层
│   ├── database/
│   │   ├── init.ts               # 数据库初始化与迁移
│   │   └── schema.sql            # 建表 Schema
│   ├── middleware/
│   ├── repositories/             # 数据访问层
│   ├── routes/                   # API 路由
│   ├── services/                 # 业务逻辑层
│   │   ├── scheduling.algorithm.ts  # 排班生成与均衡优化算法
│   │   ├── conflict.detector.ts     # 冲突检测器
│   │   └── export.service.ts        # 导出服务
│   ├── utils/
│   │   ├── csv.utils.ts          # CSV 生成工具（含班次列）
│   │   └── date.utils.ts
│   ├── app.ts
│   ├── server.ts
│   └── index.ts
├── data/
│   └── schedule.db               # SQLite 数据库文件（自动创建）
├── public/
├── shared/
│   └── types.ts                  # 前后端共享 TypeScript 类型
├── src/                          # 前端 (React + Vite)
│   ├── components/
│   ├── hooks/
│   ├── layouts/
│   ├── lib/
│   ├── pages/                    # 页面 (Dashboard/Members/Schedule/Settings/Export)
│   ├── services/
│   ├── store/                    # Zustand 状态管理
│   ├── utils/
│   ├── App.tsx
│   └── main.tsx
├── eslint.config.js
├── nodemon.json
├── package.json
├── postcss.config.js
├── tailwind.config.js
├── test-api.ts                   # 后端功能与多班次场景脚本测试
├── tsconfig.json
└── vite.config.ts
```

## 环境要求

- Node.js >= 18
- npm (或 pnpm/yarn)
- Windows / macOS / Linux

## 安装依赖

```bash
cd e:\solo\项目\gsb-0036
npm install
```

## 启动项目

项目采用前后端分离 + 并行开发的模式。

### 方式一：同时启动前后端（推荐开发模式）

```bash
npm run dev
```

这会同时启动：
- **前端 Vite 开发服务器**：http://localhost:5173 （含 /api 代理到后端）
- **后端 Express 服务器**：http://localhost:3001 （通过 nodemon 热重载）

### 方式二：单独启动

```bash
# 只启动前端
npm run client:dev         # http://localhost:5173

# 只启动后端
npm run server:dev         # http://localhost:3001
```

## 数据目录说明

- 数据库文件位置：`./data/schedule.db`（SQLite）
- 首次启动时会自动通过 `api/database/schema.sql` 创建所有表，并自动填充默认配置
- 已内置 schema 迁移逻辑：若旧库缺少 `shift`、`enable_multi_shift` 字段或 `shift_configs` 表，会自动新增（详见 `api/database/init.ts`）
- 如需**重置数据库**，停止服务后删除 `data/schedule.db` 再启动即可

## 构建生产版本

```bash
npm run build
```

执行顺序：`tsc -b`（类型检查 & TS 编译） → `vite build`（前端打包到 `dist/`）。

## 类型检查

```bash
npm run check          # 仅类型检查（tsc --noEmit），不生成输出
```

## Lint

```bash
npm run lint           # ESLint 检查所有 .ts/.tsx 文件
```

## 核心接口说明

后端默认端口 3001，所有接口均挂在 `/api` 前缀下；前端开发模式下 Vite 会将 `/api` 代理到后端。

### 健康检查

```
GET /api/health           -> { success: true, message: "ok" }
```

### 成员管理 `/api/members`

| 方法 | 路径 | 说明 |
|------|------|------|
| GET  | `/api/members` | 获取全部成员列表 |
| GET  | `/api/members/:id` | 获取单个成员 |
| POST | `/api/members` | 新增成员 `{ name, department?, email?, phone? }` |
| PUT  | `/api/members/:id` | 更新成员 |
| DELETE | `/api/members/:id` | 删除成员 |
| GET  | `/api/members/:id/unavailable` | 获取该成员不可值班日期 |
| POST | `/api/members/:id/unavailable` | 新增不可值班日期（单日或范围）`{ date?, startDate?, endDate?, reason? }` |
| DELETE | `/api/members/unavailable/:id` | 删除一条不可值班日期 |

### 排班配置 `/api/config`

| 方法 | 路径 | 说明 |
|------|------|------|
| GET  | `/api/config` | 获取基础排班配置 |
| PUT  | `/api/config` | 更新 `{ startDate?, cycleDays?, dailyRequired?, maxConsecutiveDays?, balanceWeight?, enableMultiShift? }` |
| GET  | `/api/config/shifts` | 获取全部班次配置（早/晚/夜） |
| GET  | `/api/config/shifts/:shiftType` | 获取单个班次配置 |
| PUT  | `/api/config/shifts/:shiftType` | 更新单个班次配置 `{ dailyRequired, memberIds }` |
| PUT  | `/api/config/shifts` (或 `/batch`) | 批量更新班次配置 `{ configs: [{shiftType, dailyRequired, memberIds}] }` |

班次类型取值：`morning`（早班）、`evening`（晚班）、`night`（夜班）、`day`（单班次模式默认白班）。

### 排班与调班 `/api/schedules`

| 方法 | 路径 | 说明 |
|------|------|------|
| GET  | `/api/schedules?startDate=&endDate=` | 获取日期范围内排班 |
| POST | `/api/schedules/generate` | 生成排班 `{ startDate?, cycleDays?, dailyRequired? }`；实际读取基础/班次配置 |
| POST | `/api/schedules/swap` | 交换两人排班（同一天且同一班次）`{ scheduleId1, scheduleId2 }` |
| POST | `/api/schedules/replace` | 替班 `{ scheduleId, newMemberId }`；多班次模式下校验成员资格 |
| POST | `/api/schedules/leave` | 标记请假 `{ scheduleId, leaveType, substituteId? }` |
| POST | `/api/schedules/leave/:id/cancel` | 取消请假 |
| GET  | `/api/schedules/conflicts?startDate=&endDate=` | 返回四类冲突列表 |
| GET  | `/api/schedules/statistics?startDate=&endDate=` | 统计信息（含各班次分布 breakdown） |

### 导出 `/api/export`

| 方法 | 路径 | 说明 |
|------|------|------|
| GET  | `/api/export/csv?startDate=&endDate=&shiftType=` | 下载 CSV；`shiftType` 可选按班次过滤（`morning/evening/night/day`） |

CSV 列顺序：`日期, 星期, 班次, 值班人员, 请假情况, 代班人员`。

## 接口脚本验证（test-api.ts）

项目提供 `test-api.ts` 脚本，直接调用后端服务层（无需启动 HTTP 服务）完成端到端场景验证，涵盖：
1. 成员 CRUD + 不可值班日期
2. 多班次配置（早/晚/夜）与成员范围
3. 排班生成、均衡度、同日重复避免
4. 四类冲突检测汇总
5. 调班、替班（含班次成员资格校验）
6. 请假 + 代班
7. CSV 导出（含班次列 + 按班次筛选）

运行方式：

```bash
npx tsx test-api.ts
```

脚本执行成功会打印 `🎉🎉…✅ 所有测试通过！多班次功能验证完成！`，并在项目根目录生成两个 CSV 文件：
- `test-export-multi-shift.csv`（全部班次）
- `test-export-morning.csv`（仅早班筛选）

## 核心 HTTP 验证（curl 示例）

启动后端服务 `npm run server:dev` 后，可使用以下命令做简单 HTTP 健康检查：

```bash
# 健康检查
curl http://localhost:3001/api/health

# 查看基础配置
curl http://localhost:3001/api/config

# 查看班次配置
curl http://localhost:3001/api/config/shifts

# 获取成员
curl http://localhost:3001/api/members

# 生成排班
curl -X POST http://localhost:3001/api/schedules/generate \
  -H "Content-Type: application/json" \
  -d "{\"cycleDays\": 14}"
```

## 技术栈

- **前端**：React 18 + TypeScript + Vite 6 + React Router v7 + Zustand + Tailwind CSS + Recharts + Lucide Icons
- **后端**：Node.js + Express 4 + TypeScript + SQLite3（sqlite3 原生驱动）
- **工程化**：ESLint 9（Flat Config + typescript-eslint）+ Prettier-less 风格 + Nodemon + Concurrently + tsx

## 常见问题

**Q：首次启动报错 `SQLITE_ERROR: no such column: shift`？**
A：删除 `data/schedule.db` 再重启，或检查 `api/database/init.ts` 的迁移逻辑是否执行。

**Q：生成排班时报「可值班人数不足」？**
A：检查班次配置的 `memberIds` 范围是否过窄、或 `dailyRequired` 超过可值班成员数；或适当放宽 `maxConsecutiveDays`。

**Q：如何从单班次切换到多班次模式？**
A：在设置页将 `enableMultiShift` 设为 `true`，或调用 `PUT /api/config` 传 `enableMultiShift: true`，然后在 `/api/config/shifts` 配置早/晚/夜各班次的 `dailyRequired` 和可值班 `memberIds`。
