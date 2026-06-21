import { configRepository } from '../repositories/config.repository';
import { ScheduleConfig } from '../../shared/types';

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
};

export default configService;
