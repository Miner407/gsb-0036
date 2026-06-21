import { useEffect, useState } from 'react';
import { Plus, Edit2, Trash2, CalendarX, X } from 'lucide-react';
import useScheduleStore from '@/store/useScheduleStore';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Modal from '@/components/ui/Modal';
import Badge from '@/components/ui/Badge';
import { toast } from '@/components/ui/Toast';
import { formatDisplayDate } from '@/utils/date';
import type { Member, UnavailableDate } from '@shared/types';

const Members = () => {
  const {
    members,
    unavailableDates,
    loadMembers,
    addMember,
    updateMember,
    deleteMember,
    loadUnavailableDates,
    addUnavailableDates,
    deleteUnavailableDate,
  } = useScheduleStore();

  const [showMemberModal, setShowMemberModal] = useState(false);
  const [editingMember, setEditingMember] = useState<Member | null>(null);
  const [formData, setFormData] = useState({ name: '', department: '', email: '', phone: '' });

  const [showUnavailableModal, setShowUnavailableModal] = useState(false);
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [unavailableForm, setUnavailableForm] = useState({
    date: '',
    startDate: '',
    endDate: '',
    reason: '',
    mode: 'single' as 'single' | 'range',
  });

  useEffect(() => {
    loadMembers();
  }, []);

  useEffect(() => {
    if (editingMember) {
      setFormData({
        name: editingMember.name,
        department: editingMember.department || '',
        email: editingMember.email || '',
        phone: editingMember.phone || '',
      });
    } else {
      setFormData({ name: '', department: '', email: '', phone: '' });
    }
  }, [editingMember]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingMember) {
        await updateMember(editingMember.id, formData);
        toast.success('成员更新成功');
      } else {
        await addMember(formData);
        toast.success('成员添加成功');
      }
      setShowMemberModal(false);
      setEditingMember(null);
    } catch (error: any) {
      toast.error(error.message || '操作失败');
    }
  };

  const handleDelete = async (id: number, name: string) => {
    if (confirm(`确定要删除成员 ${name} 吗？`)) {
      try {
        await deleteMember(id);
        toast.success('删除成功');
      } catch (error: any) {
        toast.error(error.message || '删除失败');
      }
    }
  };

  const handleOpenUnavailable = async (member: Member) => {
    setSelectedMember(member);
    await loadUnavailableDates(member.id);
    setUnavailableForm({ date: '', startDate: '', endDate: '', reason: '', mode: 'single' });
    setShowUnavailableModal(true);
  };

  const handleAddUnavailable = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMember) return;

    try {
      const data =
        unavailableForm.mode === 'single'
          ? { date: unavailableForm.date, reason: unavailableForm.reason }
          : {
              startDate: unavailableForm.startDate,
              endDate: unavailableForm.endDate,
              reason: unavailableForm.reason,
            };
      await addUnavailableDates(selectedMember.id, data);
      toast.success('不可值班日期添加成功');
      setUnavailableForm({ date: '', startDate: '', endDate: '', reason: '', mode: 'single' });
    } catch (error: any) {
      toast.error(error.message || '添加失败');
    }
  };

  const handleDeleteUnavailable = async (id: number) => {
    try {
      await deleteUnavailableDate(id);
      if (selectedMember) {
        await loadUnavailableDates(selectedMember.id);
      }
      toast.success('删除成功');
    } catch (error: any) {
      toast.error(error.message || '删除失败');
    }
  };

  const memberUnavailableDates = selectedMember
    ? unavailableDates.get(selectedMember.id) || []
    : [];

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">成员管理</h1>
          <p className="mt-1 text-sm text-gray-500">管理团队成员和他们的不可值班日期</p>
        </div>
        <Button
          onClick={() => {
            setEditingMember(null);
            setShowMemberModal(true);
          }}
        >
          <Plus className="w-4 h-4 mr-2" />
          添加成员
        </Button>
      </div>

      <Card>
        <Card.Body className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    姓名
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    部门
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    邮箱
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    电话
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    不可值班日期
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    操作
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {members.length > 0 ? (
                  members.map((member) => (
                    <tr key={member.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-primary-800 text-white flex items-center justify-center text-sm font-medium">
                            {member.name.charAt(0)}
                          </div>
                          <span className="font-medium text-gray-900">{member.name}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-gray-500">
                        {member.department || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-gray-500">
                        {member.email || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-gray-500">
                        {member.phone || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <Badge variant="primary">
                          {(unavailableDates.get(member.id) || []).length} 天
                        </Badge>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleOpenUnavailable(member)}
                          >
                            <CalendarX className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setEditingMember(member);
                              setShowMemberModal(true);
                            }}
                          >
                            <Edit2 className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(member.id, member.name)}
                          >
                            <Trash2 className="w-4 h-4 text-red-500" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-gray-400">
                      暂无成员，点击右上角按钮添加
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card.Body>
      </Card>

      <Modal
        isOpen={showMemberModal}
        onClose={() => {
          setShowMemberModal(false);
          setEditingMember(null);
        }}
        title={editingMember ? '编辑成员' : '添加成员'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="姓名"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="请输入姓名"
            required
          />
          <Input
            label="部门"
            value={formData.department}
            onChange={(e) => setFormData({ ...formData, department: e.target.value })}
            placeholder="请输入部门（选填）"
          />
          <Input
            label="邮箱"
            type="email"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            placeholder="请输入邮箱（选填）"
          />
          <Input
            label="电话"
            value={formData.phone}
            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
            placeholder="请输入电话（选填）"
          />
          <div className="flex justify-end gap-3 pt-4">
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setShowMemberModal(false);
                setEditingMember(null);
              }}
            >
              取消
            </Button>
            <Button type="submit">{editingMember ? '保存' : '添加'}</Button>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={showUnavailableModal}
        onClose={() => {
          setShowUnavailableModal(false);
          setSelectedMember(null);
        }}
        title={`${selectedMember?.name} - 不可值班日期`}
        size="lg"
      >
        <form onSubmit={handleAddUnavailable} className="space-y-4">
          <div className="flex gap-4 mb-4">
            <button
              type="button"
              onClick={() => setUnavailableForm({ ...unavailableForm, mode: 'single' })}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                unavailableForm.mode === 'single'
                  ? 'bg-primary-800 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              单个日期
            </button>
            <button
              type="button"
              onClick={() => setUnavailableForm({ ...unavailableForm, mode: 'range' })}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                unavailableForm.mode === 'range'
                  ? 'bg-primary-800 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              日期范围
            </button>
          </div>

          {unavailableForm.mode === 'single' ? (
            <Input
              label="日期"
              type="date"
              value={unavailableForm.date}
              onChange={(e) => setUnavailableForm({ ...unavailableForm, date: e.target.value })}
              required
            />
          ) : (
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="开始日期"
                type="date"
                value={unavailableForm.startDate}
                onChange={(e) => setUnavailableForm({ ...unavailableForm, startDate: e.target.value })}
                required
              />
              <Input
                label="结束日期"
                type="date"
                value={unavailableForm.endDate}
                onChange={(e) => setUnavailableForm({ ...unavailableForm, endDate: e.target.value })}
                required
              />
            </div>
          )}

          <Input
            label="原因（选填）"
            value={unavailableForm.reason}
            onChange={(e) => setUnavailableForm({ ...unavailableForm, reason: e.target.value })}
            placeholder="如：休假、出差等"
          />

          <div className="flex justify-end gap-3">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setShowUnavailableModal(false)}
            >
              关闭
            </Button>
            <Button type="submit" variant="secondary">
              添加
            </Button>
          </div>
        </form>

        <div className="mt-6 pt-6 border-t border-gray-100">
          <h4 className="font-medium text-gray-900 mb-3">已设置的不可值班日期</h4>
          {memberUnavailableDates.length > 0 ? (
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {memberUnavailableDates.map((ud: UnavailableDate) => (
                <div
                  key={ud.id}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                >
                  <div>
                    <span className="font-medium text-gray-900">
                      {formatDisplayDate(ud.date)}
                    </span>
                    {ud.reason && (
                      <span className="ml-2 text-sm text-gray-500">（{ud.reason}）</span>
                    )}
                  </div>
                  <button
                    onClick={() => handleDeleteUnavailable(ud.id)}
                    className="p-1.5 text-gray-400 hover:text-red-500 transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-400 text-center py-4">暂无不可值班日期</p>
          )}
        </div>
      </Modal>
    </div>
  );
};

export default Members;
