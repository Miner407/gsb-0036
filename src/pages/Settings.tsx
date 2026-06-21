import { useEffect, useState } from 'react';
import { Save, Info } from 'lucide-react';
import useScheduleStore from '@/store/useScheduleStore';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import { toast } from '@/components/ui/Toast';
import { formatDate, addDays } from '@/utils/date';

const Settings = () => {
  const { config, loadConfig, updateConfig } = useScheduleStore();
  const [formData, setFormData] = useState({
    startDate: formatDate(new Date()),
    cycleDays: 7,
    dailyRequired: 1,
    maxConsecutiveDays: 2,
    balanceWeight: 80,
  });

  useEffect(() => {
    loadConfig();
  }, []);

  useEffect(() => {
    if (config) {
      setFormData({
        startDate: config.startDate,
        cycleDays: config.cycleDays,
        dailyRequired: config.dailyRequired,
        maxConsecutiveDays: config.maxConsecutiveDays,
        balanceWeight: config.balanceWeight,
      });
    }
  }, [config]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await updateConfig(formData);
      toast.success('配置保存成功');
    } catch (error: any) {
      toast.error(error.message || '保存失败');
    }
  };

  const endDate = formatDate(addDays(new Date(formData.startDate), formData.cycleDays - 1));
  const totalShifts = formData.cycleDays * formData.dailyRequired;

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">排班设置</h1>
        <p className="mt-1 text-sm text-gray-500">配置排班周期、人数和算法参数</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <Card.Header>
            <h2 className="text-lg font-semibold text-gray-900">基本配置</h2>
          </Card.Header>
          <Card.Body>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Input
                  label="排班开始日期"
                  type="date"
                  value={formData.startDate}
                  onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                  required
                />
                <div>
                  <Input
                    label="排班周期（天）"
                    type="number"
                    min="1"
                    max="365"
                    value={formData.cycleDays}
                    onChange={(e) =>
                      setFormData({ ...formData, cycleDays: parseInt(e.target.value) || 1 })
                    }
                    required
                  />
                  <p className="mt-1 text-xs text-gray-400">
                    结束日期：{endDate}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Input
                  label="每日所需值班人数"
                  type="number"
                  min="1"
                  value={formData.dailyRequired}
                  onChange={(e) =>
                    setFormData({ ...formData, dailyRequired: parseInt(e.target.value) || 1 })
                  }
                  required
                />
                <Input
                  label="最大连续值班天数"
                  type="number"
                  min="1"
                  max="7"
                  value={formData.maxConsecutiveDays}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      maxConsecutiveDays: parseInt(e.target.value) || 1,
                    })
                  }
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  均衡度权重：{formData.balanceWeight}%
                </label>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={formData.balanceWeight}
                  onChange={(e) =>
                    setFormData({ ...formData, balanceWeight: parseInt(e.target.value) })
                  }
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-primary-800"
                />
                <div className="flex justify-between text-xs text-gray-400 mt-1">
                  <span>偏向随机性</span>
                  <span>偏向均衡分配</span>
                </div>
              </div>

              <div className="flex justify-end pt-4">
                <Button type="submit">
                  <Save className="w-4 h-4 mr-2" />
                  保存配置
                </Button>
              </div>
            </form>
          </Card.Body>
        </Card>

        <div className="space-y-6">
          <Card>
            <Card.Header>
              <h2 className="text-lg font-semibold text-gray-900">统计信息</h2>
            </Card.Header>
            <Card.Body className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-gray-500">排班周期</span>
                <span className="font-semibold text-gray-900">{formData.cycleDays} 天</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-500">每日人数</span>
                <span className="font-semibold text-gray-900">{formData.dailyRequired} 人</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-500">总班次</span>
                <span className="font-semibold text-gray-900">{totalShifts} 次</span>
              </div>
            </Card.Body>
          </Card>

          <Card>
            <Card.Header>
              <div className="flex items-center gap-2">
                <Info className="w-5 h-5 text-primary-500" />
                <h2 className="text-lg font-semibold text-gray-900">参数说明</h2>
              </div>
            </Card.Header>
            <Card.Body className="space-y-3 text-sm text-gray-600">
              <p>
                <strong>排班开始日期</strong>：排班周期的第一天
              </p>
              <p>
                <strong>排班周期</strong>：需要生成排班的总天数
              </p>
              <p>
                <strong>每日所需人数</strong>：每天需要多少人值班
              </p>
              <p>
                <strong>最大连续值班</strong>：一个人最多连续值班几天
              </p>
              <p>
                <strong>均衡度权重</strong>：值越高，排班越均衡；值越低，排班越随机
              </p>
            </Card.Body>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Settings;
