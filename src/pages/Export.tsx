import { useEffect, useState } from 'react';
import { Download, FileSpreadsheet, Calendar, Info } from 'lucide-react';
import useScheduleStore from '@/store/useScheduleStore';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Badge from '@/components/ui/Badge';
import { toast } from '@/components/ui/Toast';
import { formatDate, addDays } from '@/utils/date';

const Export = () => {
  const { config, schedules, members, loadSchedules, exportService, loadStatistics } =
    useScheduleStore();

  const [startDate, setStartDate] = useState(formatDate(new Date()));
  const [endDate, setEndDate] = useState(formatDate(addDays(new Date(), 30)));
  const [format, setFormat] = useState<'csv' | 'csv_with_leave'>('csv');

  useEffect(() => {
    if (config) {
      const end = formatDate(addDays(new Date(config.startDate), config.cycleDays - 1));
      loadSchedules(config.startDate, end);
      loadStatistics(config.startDate, end);
    }
  }, [config, loadSchedules, loadStatistics]);

  const handleExport = async () => {
    try {
      const blob = await exportService.exportSchedule(startDate, endDate, format);
      const url = window.URL.createObjectURL(new Blob([blob], { type: 'text/csv;charset=utf-8;' }));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `值班表_${startDate}_${endDate}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success('导出成功');
    } catch (error: unknown) {
      toast.error((error as Error).message || '导出失败');
    }
  };

  const filteredSchedules = schedules.filter(
    (s) => s.date >= startDate && s.date <= endDate
  );

  const memberMap = new Map(members.map((m) => [m.id, m]));

  const leaveCount = filteredSchedules.filter((s) => s.isLeave).length;

  const countByMember = members.map((member) => {
    const memberSchedules = filteredSchedules.filter(
      (s) => s.memberId === member.id && !s.isLeave
    );
    return {
      member,
      count: memberSchedules.length,
    };
  });

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">导出中心</h1>
        <p className="mt-1 text-sm text-gray-500">导出排班表为 CSV 格式</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <Card.Header>
            <h2 className="text-lg font-semibold text-gray-900">导出设置</h2>
          </Card.Header>
          <Card.Body className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Input
                label="开始日期"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                required
              />
              <Input
                label="结束日期"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">
                导出格式
              </label>
              <div className="flex gap-4">
                <label
                  className={`flex-1 p-4 rounded-xl border-2 cursor-pointer transition-all ${
                    format === 'csv'
                      ? 'border-primary-500 bg-primary-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <input
                    type="radio"
                    value="csv"
                    checked={format === 'csv'}
                    onChange={() => setFormat('csv')}
                    className="sr-only"
                  />
                  <div className="flex items-center gap-3">
                    <FileSpreadsheet
                      className={`w-8 h-8 ${
                        format === 'csv' ? 'text-primary-600' : 'text-gray-400'
                      }`}
                    />
                    <div>
                      <p
                        className={`font-medium ${
                          format === 'csv' ? 'text-gray-900' : 'text-gray-600'
                        }`}
                      >
                        标准格式
                      </p>
                      <p className="text-xs text-gray-500">日期、姓名、状态</p>
                    </div>
                  </div>
                </label>

                <label
                  className={`flex-1 p-4 rounded-xl border-2 cursor-pointer transition-all ${
                    format === 'csv_with_leave'
                      ? 'border-primary-500 bg-primary-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <input
                    type="radio"
                    value="csv_with_leave"
                    checked={format === 'csv_with_leave'}
                    onChange={() => setFormat('csv_with_leave')}
                    className="sr-only"
                  />
                  <div className="flex items-center gap-3">
                    <Calendar
                      className={`w-8 h-8 ${
                        format === 'csv_with_leave' ? 'text-primary-600' : 'text-gray-400'
                      }`}
                    />
                    <div>
                      <p
                        className={`font-medium ${
                          format === 'csv_with_leave' ? 'text-gray-900' : 'text-gray-600'
                        }`}
                      >
                        详细格式
                      </p>
                      <p className="text-xs text-gray-500">含请假、替班信息</p>
                    </div>
                  </div>
                </label>
              </div>
            </div>

            <div className="flex justify-end pt-4">
              <Button onClick={handleExport}>
                <Download className="w-4 h-4 mr-2" />
                导出 CSV
              </Button>
            </div>
          </Card.Body>
        </Card>

        <div className="space-y-6">
          <Card>
            <Card.Header>
              <h2 className="text-lg font-semibold text-gray-900">统计预览</h2>
            </Card.Header>
            <Card.Body className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-gray-500">总排班数</span>
                <span className="font-semibold text-gray-900">
                  {filteredSchedules.length} 条
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-500">请假数</span>
                <span className="font-semibold text-gray-900">
                  {leaveCount} 条
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-500">实际值班</span>
                <span className="font-semibold text-gray-900">
                  {filteredSchedules.length - leaveCount} 条
                </span>
              </div>
            </Card.Body>
          </Card>

          <Card>
            <Card.Header>
              <div className="flex items-center gap-2">
                <Info className="w-5 h-5 text-primary-500" />
                <h2 className="text-lg font-semibold text-gray-900">
                  每人值班次数
                </h2>
              </div>
            </Card.Header>
            <Card.Body className="space-y-3 max-h-64 overflow-y-auto">
              {countByMember.length > 0 ? (
                countByMember.map(({ member, count }) => (
                  <div
                    key={member.id}
                    className="flex items-center justify-between"
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-primary-800 text-white flex items-center justify-center text-xs font-medium">
                        {member.name.charAt(0)}
                      </div>
                      <span className="text-gray-700">{member.name}</span>
                    </div>
                    <Badge variant="primary">{count} 次</Badge>
                  </div>
                ))
              ) : (
                <p className="text-gray-400 text-center py-4">暂无数据</p>
              )}
            </Card.Body>
          </Card>
        </div>
      </div>

      <Card>
        <Card.Header>
          <h2 className="text-lg font-semibold text-gray-900">预览</h2>
          <Badge variant="secondary" size="sm">
            显示前 10 条
          </Badge>
        </Card.Header>
        <Card.Body className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    日期
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    星期
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    值班人员
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    状态
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredSchedules.slice(0, 10).length > 0 ? (
                  filteredSchedules
                    .sort((a, b) => a.date.localeCompare(b.date))
                    .map((s) => {
                      const member = memberMap.get(s.memberId);
                      return (
                        <tr key={s.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 whitespace-nowrap text-gray-900">
                            {s.date}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-gray-500">
                            {new Date(s.date).toLocaleDateString('zh-CN', {
                              weekday: 'short',
                            })}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <div className="flex items-center gap-2">
                              <span
                                className={
                                  s.isLeave ? 'line-through text-red-600' : 'text-gray-900'
                                }
                              >
                                {member?.name || '未知'}
                              </span>
                              {s.substituteId && (
                                <span className="text-secondary-600">
                                  → {memberMap.get(s.substituteId)?.name}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            {s.isLeave ? (
                              <Badge variant="error">请假</Badge>
                            ) : (
                              <Badge variant="success">正常</Badge>
                            )}
                          </td>
                        </tr>
                      );
                    })
                ) : (
                  <tr>
                    <td colSpan={4} className="px-4 py-12 text-center text-gray-400">
                      暂无数据
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card.Body>
      </Card>
    </div>
  );
};

export default Export;
