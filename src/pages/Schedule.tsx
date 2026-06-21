import { useEffect, useState, useMemo } from 'react';
import {
  PlayCircle,
  RefreshCw,
  ArrowLeftRight,
  CalendarX,
  AlertTriangle,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Check,
  X,
} from 'lucide-react';
import useScheduleStore from '@/store/useScheduleStore';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import Input from '@/components/ui/Input';
import Badge from '@/components/ui/Badge';
import { toast } from '@/components/ui/Toast';
import { formatDate, addDays, getWeekday, isToday, isWeekend } from '@/utils/date';
import type { Schedule, Conflict } from '@shared/types';

const SchedulePage = () => {
  const {
    members,
    schedules,
    config,
    conflicts,
    generateSchedule,
    loadSchedules,
    loadConfig,
    checkConflicts,
    swapSchedules,
    replaceSchedule,
    markLeave,
    cancelLeave,
  } = useScheduleStore();

  const [viewMode, setViewMode] = useState<'calendar' | 'list'>('calendar');
  const [currentWeekOffset, setCurrentWeekOffset] = useState(0);
  const [showSwapModal, setShowSwapModal] = useState(false);
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [showReplaceModal, setShowReplaceModal] = useState(false);
  const [selectedSchedule, setSelectedSchedule] = useState<Schedule | null>(null);
  const [swapData, setSwapData] = useState<{
    sourceScheduleId: number;
    targetScheduleId: number;
  } | null>(null);
  const [leaveForm, setLeaveForm] = useState({ leaveType: 'annual', reason: '' });
  const [replaceForm, setReplaceForm] = useState({ newMemberId: 0 });
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  useEffect(() => {
    if (config) {
      const endDate = formatDate(addDays(new Date(config.startDate), config.cycleDays - 1));
      loadSchedules(config.startDate, endDate);
    }
  }, [config, loadSchedules]);

  const startDate = useMemo(() => {
    if (!config) return formatDate(new Date());
    const base = new Date(config.startDate);
    base.setDate(base.getDate() + currentWeekOffset * 7);
    return formatDate(base);
  }, [config, currentWeekOffset]);

  const weekDates = useMemo(() => {
    const dates = [];
    for (let i = 0; i < 7; i++) {
      dates.push(formatDate(addDays(new Date(startDate), i)));
    }
    return dates;
  }, [startDate]);

  const schedulesByDate = useMemo(() => {
    const map = new Map<string, Schedule[]>();
    schedules.forEach((s) => {
      const list = map.get(s.date) || [];
      list.push(s);
      map.set(s.date, list);
    });
    return map;
  }, [schedules]);

  const memberMap = useMemo(
    () => new Map(members.map((m) => [m.id, m])),
    [members]
  );

  const dateConflicts = useMemo(() => {
    const map = new Map<string, Conflict[]>();
    conflicts.forEach((c) => {
      if (c.date) {
        const list = map.get(c.date) || [];
        list.push(c);
        map.set(c.date, list);
      }
    });
    return map;
  }, [conflicts]);

  const handleGenerate = async () => {
    if (!config) return;
    if (members.length === 0) {
      toast.error('请先添加成员');
      return;
    }
    setGenerating(true);
    try {
      await generateSchedule();
      toast.success('排班生成成功');
    } catch (error: unknown) {
      toast.error((error as Error).message || '生成失败');
    } finally {
      setGenerating(false);
    }
  };

  const handleRefreshConflicts = async () => {
    try {
      await checkConflicts();
      toast.success('冲突检查完成');
    } catch (error: unknown) {
      toast.error((error as Error).message || '检查失败');
    }
  };

  const handleOpenSwap = (schedule: Schedule) => {
    if (swapData) {
      setSwapData({ sourceScheduleId: swapData.sourceScheduleId, targetScheduleId: schedule.id });
    } else {
      setSwapData({ sourceScheduleId: schedule.id, targetScheduleId: 0 });
      setSelectedSchedule(schedule);
    }
  };

  const handleConfirmSwap = async () => {
    if (!swapData || swapData.targetScheduleId === 0) return;
    try {
      await swapSchedules(swapData.sourceScheduleId, swapData.targetScheduleId);
      toast.success('调班成功');
      setShowSwapModal(false);
      setSwapData(null);
      setSelectedSchedule(null);
    } catch (error: unknown) {
      toast.error((error as Error).message || '调班失败');
    }
  };

  const handleOpenLeave = (schedule: Schedule) => {
    setSelectedSchedule(schedule);
    setLeaveForm({ leaveType: 'annual', reason: '' });
    setShowLeaveModal(true);
  };

  const handleConfirmLeave = async () => {
    if (!selectedSchedule) return;
    try {
      await markLeave(selectedSchedule.id, leaveForm.leaveType);
      toast.success('请假标记成功');
      setShowLeaveModal(false);
      setSelectedSchedule(null);
    } catch (error: unknown) {
      toast.error((error as Error).message || '操作失败');
    }
  };

  const handleCancelLeave = async (scheduleId: number) => {
    try {
      await cancelLeave(scheduleId);
      toast.success('已取消请假标记');
    } catch (error: unknown) {
      toast.error((error as Error).message || '操作失败');
    }
  };

  const handleOpenReplace = (schedule: Schedule) => {
    setSelectedSchedule(schedule);
    setReplaceForm({ newMemberId: 0 });
    setShowReplaceModal(true);
  };

  const handleConfirmReplace = async () => {
    if (!selectedSchedule || replaceForm.newMemberId === 0) return;
    try {
      await replaceSchedule(selectedSchedule.id, replaceForm.newMemberId);
      toast.success('替班成功');
      setShowReplaceModal(false);
      setSelectedSchedule(null);
    } catch (error: unknown) {
      toast.error((error as Error).message || '替班失败');
    }
  };

  const errorCount = conflicts.filter((c) => c.severity === 'error').length;
  const warningCount = conflicts.filter((c) => c.severity === 'warning').length;

  const availableMembersForReplace = members.filter((m) => {
    if (!selectedSchedule) return true;
    const dateSchedules = schedulesByDate.get(selectedSchedule.date) || [];
    const alreadyOnDuty = dateSchedules.some(
      (s) => s.memberId === m.id && !s.isLeave
    );
    return !alreadyOnDuty;
  });

  const renderScheduleCell = (date: string) => {
    const daySchedules = schedulesByDate.get(date) || [];
    const dayConflicts = dateConflicts.get(date) || [];
    const hasError = dayConflicts.some((c) => c.severity === 'error');
    const hasWarning = dayConflicts.some((c) => c.severity === 'warning');

    return (
      <div
        key={date}
        className={`min-h-32 p-3 rounded-xl border-2 transition-all ${
          isToday(date)
            ? 'border-primary-500 bg-primary-50'
            : isWeekend(date)
            ? 'border-gray-200 bg-gray-50'
            : 'border-gray-100 bg-white'
        } hover:shadow-md`}
      >
        <div className="flex items-center justify-between mb-2">
          <div>
            <span
              className={`text-sm font-semibold ${
                isToday(date) ? 'text-primary-600' : 'text-gray-900'
              }`}
            >
              {getWeekday(date)}
            </span>
            <span
              className={`ml-2 text-xs ${
                isToday(date) ? 'text-primary-500' : 'text-gray-400'
              }`}
            >
              {date.slice(5)}
            </span>
          </div>
          {hasError && (
            <div className="flex gap-1">
              {hasError && (
                <AlertCircle className="w-4 h-4 text-red-500" />
              )}
              {hasWarning && (
                <AlertTriangle className="w-4 h-4 text-warning-500" />
              )}
            </div>
          )}
        </div>

        <div className="space-y-1.5">
          {daySchedules.length > 0 ? (
            daySchedules.map((s) => {
              const member = memberMap.get(s.memberId);
              const subMember = s.substituteId
                ? memberMap.get(s.substituteId)
                : null;

              return (
                <div
                  key={s.id}
                  className={`group flex items-center justify-between p-2 rounded-lg text-sm transition-all ${
                    s.isLeave
                      ? 'bg-red-50 border border-red-200'
                      : 'bg-gray-50 border border-gray-100 hover:bg-gray-100'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <div
                      className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium flex-shrink-0 ${
                        s.isLeave
                          ? 'bg-red-100 text-red-600'
                          : 'bg-primary-800 text-white'
                      }`}
                    >
                      {member?.name?.charAt(0) || '?'}
                    </div>
                    <div className="min-w-0">
                      <span
                        className={`block truncate ${
                          s.isLeave ? 'text-red-600 line-through' : 'text-gray-900'
                        }`}
                      >
                        {member?.name || '未知'}
                      </span>
                      {subMember && (
                        <span className="block text-xs text-secondary-600">
                          → {subMember.name}
                        </span>
                      )}
                    </div>
                  </div>

                  {!s.isLeave && (
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => handleOpenSwap(s)}
                        className="p-1 rounded hover:bg-white/80 text-gray-400 hover:text-primary-600"
                        title="调班"
                      >
                        <ArrowLeftRight className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleOpenLeave(s)}
                        className="p-1 rounded hover:bg-white/80 text-gray-400 hover:text-warning-600"
                        title="请假"
                      >
                        <CalendarX className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleOpenReplace(s)}
                        className="p-1 rounded hover:bg-white/80 text-gray-400 hover:text-secondary-600"
                        title="替班"
                      >
                        <Check className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                  {s.isLeave && (
                    <button
                      onClick={() => handleCancelLeave(s.id)}
                      className="p-1 rounded hover:bg-white/80 text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity"
                      title="取消请假"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              );
            })
          ) : (
            <p className="text-xs text-gray-400 text-center py-4">
            </p>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">排班表</h1>
          <p className="mt-1 text-sm text-gray-500">查看和管理排班，支持调班、请假和替班</p>
        </div>
        <div className="flex gap-3">
          <div className="flex bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setViewMode('calendar')}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                viewMode === 'calendar'
                  ? 'bg-white text-gray-900 shadow'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              日历视图
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                viewMode === 'list'
                  ? 'bg-white text-gray-900 shadow'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              列表视图
            </button>
          </div>
          <Button variant="secondary" onClick={handleRefreshConflicts}>
            <RefreshCw className="w-4 h-4 mr-2" />
            检查冲突
          </Button>
          <Button onClick={handleGenerate} loading={generating}>
            <PlayCircle className="w-4 h-4 mr-2" />
            生成排班
          </Button>
        </div>
      </div>

      {(errorCount > 0 || warningCount > 0) && (
        <Card className="bg-gradient-to-r from-orange-50 to-red-50 border-orange-200">
          <Card.Body>
            <div className="flex items-center gap-6">
            {errorCount > 0 && (
              <div className="flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-red-500" />
                <span className="text-red-700 font-medium">
                  {errorCount} 个错误冲突
                </span>
              </div>
            )}
            {warningCount > 0 && (
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-warning-500" />
                <span className="text-warning-700 font-medium">
                  {warningCount} 个警告
                </span>
              </div>
            )}
            <Button
              size="sm"
              variant="ghost"
              className="ml-auto"
              onClick={() => document.getElementById('conflicts-section')?.scrollIntoView({ behavior: 'smooth' })}
            >
              查看详情
            </Button>
          </div>
        </Card.Body>
        </Card>
      )}

      {swapData && swapData.targetScheduleId === 0 && (
        <Card className="bg-primary-50 border-primary-200">
          <Card.Body>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <ArrowLeftRight className="w-5 h-5 text-primary-600" />
                <span className="text-primary-700 font-medium">
                  调班模式：点击另一个班次进行交换
                </span>
                {selectedSchedule && (
                  <Badge variant="primary">
                    已选择：{memberMap.get(selectedSchedule.memberId)?.name} -{' '}
                    {selectedSchedule.date}
                  </Badge>
                )}
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSwapData(null);
                  setSelectedSchedule(null);
                }}
              >
                取消
              </Button>
            </div>
          </Card.Body>
        </Card>
      )}

      {viewMode === 'calendar' && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setCurrentWeekOffset((o) => o - 1)}
            >
              <ChevronLeft className="w-4 h-4 mr-1" />
              上一周
            </Button>
            <span className="font-medium text-gray-700">
              {startDate} ~ {formatDate(addDays(new Date(startDate), 6))}
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setCurrentWeekOffset((o) => o + 1)}
            >
              下一周
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-7 gap-3">
            {weekDates.map(renderScheduleCell)}
          </div>
        </div>
      )}

      {viewMode === 'list' && (
        <Card>
          <Card.Body className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      日期
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      值班人员
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      状态
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      操作
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {schedules
                    .sort((a, b) => a.date.localeCompare(b.date))
                    .map((s) => {
                      const member = memberMap.get(s.memberId);
                      return (
                        <tr key={s.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 whitespace-nowrap">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-gray-900">
                                {s.date}
                              </span>
                              <span className="text-xs text-gray-400">
                                {getWeekday(s.date)}
                              </span>
                              {isToday(s.date) && (
                                <Badge variant="primary" size="sm">
                                  今日
                                </Badge>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <div
                                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                                  s.isLeave
                                    ? 'bg-red-100 text-red-600'
                                    : 'bg-primary-800 text-white'
                                }`}
                              >
                                {member?.name?.charAt(0) || '?'}
                              </div>
                              <span
                                className={s.isLeave ? 'line-through text-red-600' : ''}
                              >
                                {member?.name || '未知'}
                              </span>
                              {s.substituteId && (
                                <span className="text-secondary-600 ml-1">
                                  → {memberMap.get(s.substituteId)?.name}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            {s.isLeave ? (
                              <Badge variant="error">请假</Badge>
                            ) : (
                              <Badge variant="success">正常</Badge>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex justify-end gap-1">
                              {!s.isLeave && (
                                <>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleOpenSwap(s)}
                                  >
                                    <ArrowLeftRight className="w-4 h-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleOpenLeave(s)}
                                  >
                                    <CalendarX className="w-4 h-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleOpenReplace(s)}
                                  >
                                    <Check className="w-4 h-4" />
                                  </Button>
                                </>
                              )}
                              {s.isLeave && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleCancelLeave(s.id)}
                                >
                                  <X className="w-4 h-4 text-red-500" />
                                </Button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </Card.Body>
        </Card>
      )}

      {conflicts.length > 0 && (
        <Card id="conflicts-section">
          <Card.Header>
        <h2 className="text-lg font-semibold text-gray-900">冲突列表</h2>
          </Card.Header>
          <Card.Body className="space-y-2">
            {conflicts.map((c, idx) => (
              <div
                key={idx}
                className={`flex items-center gap-3 p-3 rounded-lg ${
                  c.severity === 'error'
                    ? 'bg-red-50 border border-red-200'
                    : 'bg-warning-50 border border-warning-200'
                }`}
              >
                {c.severity === 'error' ? (
                  <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
                ) : (
                  <AlertTriangle className="w-5 h-5 text-warning-500 flex-shrink-0" />
                )}
                <div className="flex-1">
                  <span
                    className={`font-medium ${
                      c.severity === 'error' ? 'text-red-800' : 'text-warning-800'
                    }`}
                  >
                    {c.message}
                  </span>
                  {c.date && (
                    <span className="ml-2 text-sm text-gray-500">
                      ({c.date})
                    </span>
                  )}
                </div>
                <Badge
                  variant={c.severity === 'error' ? 'error' : 'warning'}
                >
                  {c.type === 'consecutive'
                    ? '连续值班'
                    : c.type === 'unavailable'
                    ? '不可值班'
                    : c.type === 'insufficient'
                    ? '人数不足'
                    : '不均衡'}
                </Badge>
              </div>
            ))}
          </Card.Body>
        </Card>
      )}

      <Modal
        isOpen={showSwapModal}
        onClose={() => {
          setShowSwapModal(false);
          setSwapData(null);
          setSelectedSchedule(null);
        }}
        title="确认调班"
      >
        <p className="text-gray-600 mb-4">
          确定要交换这两个班次吗？交换后两人的值班日期会互换。
        </p>
        <div className="flex justify-end gap-3">
          <Button
            variant="ghost"
            onClick={() => {
              setShowSwapModal(false);
              setSwapData(null);
              setSelectedSchedule(null);
            }}
          >
            取消
          </Button>
          <Button onClick={handleConfirmSwap}>
            确认调班
          </Button>
        </div>
      </Modal>

      <Modal
        isOpen={showLeaveModal}
        onClose={() => {
          setShowLeaveModal(false);
          setSelectedSchedule(null);
        }}
        title="标记请假"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              请假类型
            </label>
            <select
              value={leaveForm.leaveType}
              onChange={(e) =>
                setLeaveForm({ ...leaveForm, leaveType: e.target.value })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            >
              <option value="annual">年假</option>
              <option value="sick">病假</option>
              <option value="personal">事假</option>
              <option value="other">其他</option>
            </select>
          </div>
          <Input
            label="原因（选填）"
            value={leaveForm.reason}
            onChange={(e) =>
              setLeaveForm({ ...leaveForm, reason: e.target.value })
            }
            placeholder="请输入请假原因"
          />
          <div className="flex justify-end gap-3 pt-2">
            <Button
              variant="ghost"
              onClick={() => {
                setShowLeaveModal(false);
                setSelectedSchedule(null);
              }}
            >
              取消
            </Button>
            <Button onClick={handleConfirmLeave}>
              确认请假
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={showReplaceModal}
        onClose={() => {
          setShowReplaceModal(false);
          setSelectedSchedule(null);
          setReplaceForm({ newMemberId: 0 });
        }}
        title="替班"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              选择替班人员
            </label>
            <select
              value={replaceForm.newMemberId}
              onChange={(e) =>
                setReplaceForm({ ...replaceForm, newMemberId: parseInt(e.target.value) })
              }
              className="w-full px-3 py-2 border border-gray-300 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            >
              <option value={0}>请选择</option>
              {availableMembersForReplace.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button
              variant="ghost"
              onClick={() => {
                setShowReplaceModal(false);
                setSelectedSchedule(null);
                setReplaceForm({ newMemberId: 0 });
              }}
            >
              取消
            </Button>
            <Button onClick={handleConfirmReplace}>
              确认替班
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default SchedulePage;
