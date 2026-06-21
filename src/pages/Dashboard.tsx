import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Users,
  CalendarDays,
  Calendar,
  TrendingUp,
  UserPlus,
  Settings as SettingsIcon,
  PlayCircle,
  Download,
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import useScheduleStore from '@/store/useScheduleStore';
import Card from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import { formatDate, addDays, isToday } from '@/utils/date';

const Dashboard = () => {
  const { members, schedules, statistics, conflicts, config, loadMembers, loadSchedules, loadStatistics, loadConfig } =
    useScheduleStore();

  useEffect(() => {
    const today = new Date();
    const start = formatDate(new Date(today.getFullYear(), today.getMonth(), 1));
    const end = formatDate(new Date(today.getFullYear(), today.getMonth() + 1, 0));

    Promise.all([
      loadMembers(),
      loadConfig(),
      loadSchedules(start, end),
      loadStatistics(start, end),
    ]);
  }, [loadMembers, loadConfig, loadSchedules, loadStatistics]);

  const todayStr = formatDate(new Date());
  const todaySchedules = schedules.filter((s) => s.date === todayStr && !s.isLeave);
  const tomorrowStr = formatDate(addDays(new Date(), 1));
  const tomorrowSchedules = schedules.filter((s) => s.date === tomorrowStr && !s.isLeave);

  const upcomingSchedules = schedules
    .filter((s) => s.date >= todayStr && !s.isLeave)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 5);

  const memberMap = new Map(members.map((m) => [m.id, m]));

  const chartData = statistics?.memberShifts.map((ms) => ({
    name: ms.memberName,
    值班次数: ms.count,
  })) || [];

  const errorCount = conflicts.filter((c) => c.severity === 'error').length;
  const warningCount = conflicts.filter((c) => c.severity === 'warning').length;

  const quickActions = [
    { label: '添加成员', icon: UserPlus, path: '/members', color: 'from-blue-500 to-blue-600' },
    { label: '排班设置', icon: SettingsIcon, path: '/settings', color: 'from-purple-500 to-purple-600' },
    { label: '生成排班', icon: PlayCircle, path: '/schedule', color: 'from-secondary-500 to-secondary-600' },
    { label: '导出CSV', icon: Download, path: '/export', color: 'from-orange-500 to-orange-600' },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">仪表盘</h1>
          <p className="mt-1 text-sm text-gray-500">欢迎使用值班排班管理系统</p>
        </div>
        {config && (
          <div className="text-sm text-gray-500">
            排班周期：{config.cycleDays} 天 / 每日 {config.dailyRequired} 人
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card hover>
          <Card.Body className="flex items-center gap-4">
            <div className="p-3 bg-blue-100 rounded-xl">
              <Users className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">团队成员</p>
              <p className="text-2xl font-bold text-gray-900">{members.length}</p>
            </div>
          </Card.Body>
        </Card>

        <Card hover>
          <Card.Body className="flex items-center gap-4">
            <div className="p-3 bg-green-100 rounded-xl">
              <CalendarDays className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">本期排班天数</p>
              <p className="text-2xl font-bold text-gray-900">{statistics?.totalDays || 0}</p>
            </div>
          </Card.Body>
        </Card>

        <Card hover>
          <Card.Body className="flex items-center gap-4">
            <div className="p-3 bg-purple-100 rounded-xl">
              <Calendar className="w-6 h-6 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">今日值班</p>
              <p className="text-2xl font-bold text-gray-900">{todaySchedules.length}</p>
            </div>
          </Card.Body>
        </Card>

        <Card hover>
          <Card.Body className="flex items-center gap-4">
            <div className="p-3 bg-orange-100 rounded-xl">
              <TrendingUp className="w-6 h-6 text-orange-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">总排班次数</p>
              <p className="text-2xl font-bold text-gray-900">{statistics?.totalShifts || 0}</p>
            </div>
          </Card.Body>
        </Card>
      </div>

      {(errorCount > 0 || warningCount > 0) && (
        <div className="flex gap-3">
          {errorCount > 0 && (
            <Badge variant="error" className="px-3 py-1.5 text-sm">
              {errorCount} 个错误冲突
            </Badge>
          )}
          {warningCount > 0 && (
            <Badge variant="warning" className="px-3 py-1.5 text-sm">
              {warningCount} 个警告
            </Badge>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {quickActions.map((action) => {
          const Icon = action.icon;
          return (
            <Link key={action.path} to={action.path}>
              <Card hover className="h-full">
                <Card.Body className="flex items-center gap-4">
                  <div className={`p-4 rounded-xl bg-gradient-to-br ${action.color}`}>
                    <Icon className="w-6 h-6 text-white" />
                  </div>
                  <span className="font-medium text-gray-900">{action.label}</span>
                </Card.Body>
              </Card>
            </Link>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <Card.Header>
            <h2 className="text-lg font-semibold text-gray-900">每人值班次数统计</h2>
          </Card.Header>
          <Card.Body>
            <div className="h-64">
              {chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Bar dataKey="值班次数" fill="#1e3a5f" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-gray-400">
                  暂无数据，请先生成排班
                </div>
              )}
            </div>
          </Card.Body>
        </Card>

        <Card>
          <Card.Header>
            <h2 className="text-lg font-semibold text-gray-900">即将值班</h2>
          </Card.Header>
          <Card.Body className="space-y-3">
            {upcomingSchedules.length > 0 ? (
              upcomingSchedules.map((s) => {
                const member = memberMap.get(s.memberId);
                return (
                  <div
                    key={s.id}
                    className={`flex items-center justify-between p-3 rounded-lg ${
                      isToday(s.date) ? 'bg-primary-50 border border-primary-200' : 'bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-primary-800 text-white flex items-center justify-center text-sm font-medium">
                        {member?.name?.charAt(0) || '?'}
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{member?.name || '未知'}</p>
                        <p className="text-xs text-gray-500">{s.date}</p>
                      </div>
                    </div>
                    {isToday(s.date) && (
                      <Badge variant="primary">今日</Badge>
                    )}
                  </div>
                );
              })
            ) : (
              <div className="h-48 flex items-center justify-center text-gray-400">
                暂无值班安排
              </div>
            )}
          </Card.Body>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <Card.Header>
            <h2 className="text-lg font-semibold text-gray-900">今日值班</h2>
          </Card.Header>
          <Card.Body>
            {todaySchedules.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {todaySchedules.map((s) => {
                  const member = memberMap.get(s.memberId);
                  return (
                    <div
                      key={s.id}
                      className="flex items-center gap-2 px-4 py-2 bg-secondary-50 rounded-lg border border-secondary-200"
                    >
                      <div className="w-8 h-8 rounded-full bg-secondary-500 text-white flex items-center justify-center text-sm font-medium">
                        {member?.name?.charAt(0) || '?'}
                      </div>
                      <span className="font-medium text-gray-900">{member?.name || '未知'}</span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-gray-400 text-center py-4">今日无人值班</p>
            )}
          </Card.Body>
        </Card>

        <Card>
          <Card.Header>
            <h2 className="text-lg font-semibold text-gray-900">明日值班</h2>
          </Card.Header>
          <Card.Body>
            {tomorrowSchedules.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {tomorrowSchedules.map((s) => {
                  const member = memberMap.get(s.memberId);
                  return (
                    <div
                      key={s.id}
                      className="flex items-center gap-2 px-4 py-2 bg-blue-50 rounded-lg border border-blue-200"
                    >
                      <div className="w-8 h-8 rounded-full bg-blue-500 text-white flex items-center justify-center text-sm font-medium">
                        {member?.name?.charAt(0) || '?'}
                      </div>
                      <span className="font-medium text-gray-900">{member?.name || '未知'}</span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-gray-400 text-center py-4">明日无人值班</p>
            )}
          </Card.Body>
        </Card>
      </div>

      {statistics && statistics.maxConsecutive > 0 && (
        <Card>
          <Card.Body>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">最长连续值班</p>
                <p className="text-2xl font-bold text-gray-900">{statistics.maxConsecutive} 天</p>
              </div>
              {config && statistics.maxConsecutive > config.maxConsecutiveDays ? (
                <Badge variant="error">超过限制 {config.maxConsecutiveDays} 天</Badge>
              ) : (
                <Badge variant="success">符合要求</Badge>
              )}
            </div>
          </Card.Body>
        </Card>
      )}
    </div>
  );
};

export default Dashboard;
