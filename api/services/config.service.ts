import { configRepository } from '../repositories/config.repository';
import { ScheduleConfig, ShiftConfig, ShiftType } from '../../shared/types';

export const configService = {
  async getConfig(): Promise<ScheduleConfig> {
    return configRepository.get();
  },

  async updateConfig(data: {
    startDate?: string;
    cycleDays?: number;
    dailyRequired?: number;
    maxConsecutiveDays?: number;
    balanceWeight?: number;
    enableMultiShift?: boolean;
  }): Promise<ScheduleConfig> {
    if (data.cycleDays !== undefined && data.cycleDays < 1) {
      throw new Error('排班周期至少为1天');
    }
    if (data.dailyRequired !== undefined && data.dailyRequired < 1) {
      throw new Error('每日所需人数至少为1人');
    }
    if (data.maxConsecutiveDays !== undefined && data.maxConsecutiveDays < 1) {
      throw new Error('最大连续值班天数至少为1天');
    }
    if (data.balanceWeight !== undefined && (data.balanceWeight < 0 || data.balanceWeight > 100)) {
      throw new Error('均衡度权重需在0-100之间');
    }

    return configRepository.update(data);
  },

  async getAllShiftConfigs(): Promise<ShiftConfig[]> {
    return configRepository.getAllShiftConfigs();
  },

  async updateShiftConfig(shiftType: ShiftType, data: {
    dailyRequired?: number;
    memberIds?: number[];
  }): Promise<ShiftConfig> {
    if (!['morning', 'evening', 'night', 'day'].includes(shiftType)) {
      throw new Error(`无效的班次类型: ${shiftType}`);
    }
    if (data.dailyRequired !== undefined && data.dailyRequired < 1) {
      throw new Error('每班所需人数至少为1人');
    }
    if (data.memberIds !== undefined && data.memberIds.length === 0 && (data.dailyRequired ?? 1) > 0) {
      // 允许空成员列表，但会在生成时发出警告
    }

    return configRepository.updateShiftConfig(shiftType, data);
  },

  async batchUpdateShiftConfigs(configs: {
    shiftType: ShiftType;
    dailyRequired?: number;
    memberIds?: number[];
  }[]): Promise<ShiftConfig[]> {
    const results: ShiftConfig[] = [];
    for (const cfg of configs) {
      const result = await this.updateShiftConfig(cfg.shiftType, {
        dailyRequired: cfg.dailyRequired,
        memberIds: cfg.memberIds,
      });
      results.push(result);
    }
    return results;
  },

  async getShiftConfig(shiftType: ShiftType): Promise<ShiftConfig | null> {
    return configRepository.getShiftConfig(shiftType);
  },
};

export default configService;
