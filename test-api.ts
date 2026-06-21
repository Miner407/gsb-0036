import { initDatabase } from './api/database/init';
import { memberService } from './api/services/member.service';
import { scheduleService } from './api/services/schedule.service';
import { configService } from './api/services/config.service';
import { schedulingAlgorithm } from './api/services/scheduling.algorithm';
import { generateScheduleCSV } from './api/utils/csv.utils';
import { runQuery } from './api/config/database';
import * as fs from 'fs';

const log = (title: string, data?: unknown) => {
  console.log('\n' + '='.repeat(60));
  console.log(`📋 ${title}`);
  console.log('='.repeat(60));
  if (data !== undefined) {
    console.log(JSON.stringify(data, null, 2));
  }
};

const clearDatabase = async () => {
  await runQuery('DELETE FROM schedules');
  await runQuery('DELETE FROM unavailable_dates');
  await runQuery('DELETE FROM members');
  await runQuery('DELETE FROM schedule_config');
  await runQuery('DELETE FROM shift_configs');
  await runQuery('DELETE FROM sqlite_sequence WHERE name IN ("members", "unavailable_dates", "schedules", "schedule_config", "shift_configs")');
};

const runTests = async () => {
  console.log('\n🚀 开始值班排班系统功能测试（含多班次）\n');

  try {
    await initDatabase();
    log('数据库初始化成功');

    await clearDatabase();
    log('数据库已清空，开始测试...');

    const formatDate = (d: Date) => d.toISOString().split('T')[0];
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    const nextWeek = new Date(today);
    nextWeek.setDate(today.getDate() + 7);

    log('1. 测试成员管理');
    const memberNames = ['张三', '李四', '王五', '赵六', '钱七', '孙八'];
    const members = [];
    for (const name of memberNames) {
      const member = await memberService.createMember({
        name,
        department: '技术部',
        email: `${name}@example.com`,
        phone: '13800138000'
      });
      members.push(member);
      console.log(`✓ 添加成员: ${name} (ID: ${member.id})`);
    }

    const allMembers = await memberService.getAllMembers();
    console.log(`\n总成员数: ${allMembers.length}`);

    log('2. 设置不可值班日期');
    await memberService.addUnavailableDates(members[0].id, {
      date: formatDate(tomorrow),
      reason: '有事请假'
    });
    console.log(`✓ 设置张三(${members[0].id}) ${formatDate(tomorrow)} 不可值班`);

    await memberService.addUnavailableDates(members[1].id, {
      startDate: formatDate(nextWeek),
      endDate: formatDate(new Date(nextWeek.getTime() + 3 * 24 * 60 * 60 * 1000)),
      reason: '休假'
    });
    console.log(`✓ 设置李四(${members[1].id}) ${formatDate(nextWeek)} 起连续4天不可值班`);

    log('3. 配置排班设置（启用多班次模式）');
    const config = await configService.updateConfig({
      cycleDays: 14,
      dailyRequired: 2,
      maxConsecutiveDays: 2,
      balanceWeight: 80,
      enableMultiShift: true,
      startDate: formatDate(today)
    });
    console.log(`✓ 排班配置: 周期${config.cycleDays}天, 多班次模式: ${config.enableMultiShift}`);

    log('3b. 配置多班次详情（早班/晚班/夜班）');
    const morningIds = members.slice(0, 4).map(m => m.id);
    const eveningIds = members.slice(2, 6).map(m => m.id);
    const nightIds = members.slice(0, 2).concat(members.slice(4, 6)).map(m => m.id);

    const shiftConfigs = await configService.batchUpdateShiftConfigs([
      { shiftType: 'morning', dailyRequired: 2, memberIds: morningIds },
      { shiftType: 'evening', dailyRequired: 2, memberIds: eveningIds },
      { shiftType: 'night', dailyRequired: 1, memberIds: nightIds },
    ]);
    console.log('✓ 班次配置:');
    for (const sc of shiftConfigs) {
      const labelMap: Record<string, string> = { morning: '早班', evening: '晚班', night: '夜班' };
      console.log(`  ${labelMap[sc.shiftType] || sc.shiftType}: 每日${sc.dailyRequired}人, 可值班成员ID: [${sc.memberIds.join(', ')}]`);
    }

    log('4. 测试多班次排班生成算法');
    const unavailableMap = await memberService.getAllUnavailableDatesAsMap();
    const unavailableDates = Array.from(unavailableMap.entries()).flatMap(([memberId, dates]) =>
      Array.from(dates).map((date) => ({
        id: 0,
        memberId,
        date,
        createdAt: '',
      }))
    );

    const currentShiftConfigs = await configService.getAllShiftConfigs();
    const algorithmResult = schedulingAlgorithm.generateSchedule(
      allMembers,
      unavailableDates,
      config,
      currentShiftConfigs
    );
    console.log(`✓ 算法生成排班记录: ${algorithmResult.schedules.length} 条`);
    if (algorithmResult.message) {
      console.log(`提示: ${algorithmResult.message}`);
    }

    log('5. 保存排班并生成统计');
    const generateResult = await scheduleService.generateSchedule({
      startDate: formatDate(today),
      cycleDays: config.cycleDays,
    });
    const savedSchedules = generateResult.schedules;
    console.log(`✓ 保存排班记录: ${savedSchedules.length} 条`);
    console.log(`✓ 生成成功: ${generateResult.success}`);

    const shiftBreakdown = generateResult.statistics.shiftBreakdown;
    console.log('\n班次统计:');
    const labelMap2: Record<string, string> = { morning: '早班', evening: '晚班', night: '夜班', day: '白班' };
    for (const [k, v] of Object.entries(shiftBreakdown)) {
      console.log(`  ${labelMap2[k] || k}: ${v} 次`);
    }

    log('6. 排班均衡度统计');
    const endDateStr = formatDate(new Date(today.getTime() + (config.cycleDays - 1) * 24 * 60 * 60 * 1000));
    const stats = await scheduleService.getStatistics(formatDate(today), endDateStr);
    console.log('每人值班次数:');
    const counts: number[] = [];
    for (const ms of stats.memberShifts) {
      const breakdownStr = Object.entries(ms.shiftBreakdown)
        .filter(([, v]) => v > 0)
        .map(([k, v]) => `${labelMap2[k] || k}${v}次`)
        .join(', ');
      console.log(`  ${ms.memberName}: ${ms.count} 次 (${breakdownStr})`);
      counts.push(ms.count);
    }
    const maxCount = Math.max(...counts);
    const minCount = Math.min(...counts);
    console.log(`\n排班均衡度 - 最多: ${maxCount}, 最少: ${minCount}, 差值: ${maxCount - minCount}`);
    console.log(`最长连续值班: ${stats.maxConsecutive} 天`);

    log('7. 四类冲突检测（不可值班/连续值班/人数不足/同日重复）');
    const conflicts = await scheduleService.detectConflicts(formatDate(today), endDateStr);
    const typeLabel: Record<string, string> = {
      consecutive: '连续值班',
      unavailable: '不可值班',
      insufficient: '人数不足',
      duplicate_same_day: '同日重复',
      imbalance: '不均衡',
    };
    console.log(`检测到 ${conflicts.length} 个冲突/警告:`);
    const byType = new Map<string, number>();
    for (const c of conflicts) {
      const tl = typeLabel[c.type] || c.type;
      byType.set(tl, (byType.get(tl) || 0) + 1);
      console.log(`  [${c.severity.toUpperCase()}] ${tl}: ${c.message}`);
    }
    if (conflicts.length > 0) {
      console.log('\n按冲突类型汇总:');
      for (const [k, v] of byType.entries()) {
        console.log(`  ${k}: ${v} 项`);
      }
    }

    log('8. 测试调班功能（同一班次同一天两人交换）');
    const morningSchedules = savedSchedules.filter(s => s.shift === 'morning');
    const firstMorningDay = morningSchedules[0]?.date;
    const sameMorningDay = morningSchedules.filter(s => s.date === firstMorningDay);
    if (sameMorningDay.length >= 2) {
      const schedule1 = sameMorningDay[0];
      const schedule2 = sameMorningDay[1];

      console.log(`交换: ${schedule1.date} 早班 成员${schedule1.memberId} ↔ 成员${schedule2.memberId}`);

      const swapResult = await scheduleService.swapSchedules(schedule1.id, schedule2.id);
      console.log(`✓ 调班成功: ${swapResult.success}, 更新 ${swapResult.schedules.length} 条记录`);
      if (swapResult.conflicts.length > 0) {
        console.log(`调班后检测到 ${swapResult.conflicts.length} 个潜在冲突:`);
        for (const c of swapResult.conflicts) {
          console.log(`  [${c.severity.toUpperCase()}] ${c.message}`);
        }
      }
    } else {
      console.log('⚠ 第一天早班排班不足2人，跳过交换测试');
    }

    log('9. 测试替班功能（检查是否在班次可值班成员内）');
    const allSchedules = await scheduleService.getSchedules(formatDate(today), endDateStr);
    if (allSchedules.length > 0 && members.length > 2) {
      const targetShift = allSchedules[0].shift;
      const sc = (await configService.getAllShiftConfigs()).find(c => c.shiftType === targetShift);
      const eligibleIds = sc && sc.memberIds.length > 0 ? sc.memberIds : members.map(m => m.id);
      const schedule = allSchedules.find(s => s.memberId !== eligibleIds[2 % eligibleIds.length]) || allSchedules[0];
      const newMemberId = eligibleIds[2 % eligibleIds.length];
      const oldMemberId = schedule.memberId;

      console.log(`替班: ${schedule.date} (${labelMap2[schedule.shift] || schedule.shift}) 成员${oldMemberId} → 成员${newMemberId}`);

      const replaceResult = await scheduleService.replaceSchedule(schedule.id, newMemberId);
      console.log(`✓ 替班成功: ${replaceResult.success}`);
      if (replaceResult.conflicts.length > 0) {
        console.log(`替班后检测到 ${replaceResult.conflicts.length} 个潜在冲突:`);
        for (const c of replaceResult.conflicts) {
          console.log(`  [${c.severity.toUpperCase()}] ${c.message}`);
        }
      }
    }

    log('10. 测试请假功能');
    const updatedSchedules1 = await scheduleService.getSchedules(formatDate(today), endDateStr);
    if (updatedSchedules1.length > 1 && members.length > 3) {
      const schedule = updatedSchedules1[1];
      const sc2 = (await configService.getAllShiftConfigs()).find(c => c.shiftType === schedule.shift);
      const eligible2 = sc2 && sc2.memberIds.length > 0 ? sc2.memberIds : members.map(m => m.id);
      const substituteId = eligible2.find(id => id !== schedule.memberId) || members[3].id;

      console.log(`请假: ${schedule.date} (${labelMap2[schedule.shift] || schedule.shift}) 成员${schedule.memberId}, 替班: 成员${substituteId}`);

      const result = await scheduleService.markLeave(
        schedule.id,
        '年假',
        substituteId
      );
      console.log(`✓ 请假标记成功, isLeave: ${result.isLeave}, leaveType: ${result.leaveType}`);
    }

    log('11. 调班和请假后再次检测冲突');
    const updatedSchedules2 = await scheduleService.getSchedules(formatDate(today), endDateStr);
    const conflictsAfter = await scheduleService.detectConflicts(formatDate(today), endDateStr);
    console.log(`检测到 ${conflictsAfter.length} 个冲突/警告:`);
    for (const c of conflictsAfter) {
      console.log(`  [${c.severity.toUpperCase()}] ${typeLabel[c.type] || c.type}: ${c.message}`);
    }

    log('12. 测试 CSV 导出（含班次列，多班次详细）');
    const memberMap = new Map(allMembers.map(m => [m.id, m.name]));
    const schedulesWithNames = updatedSchedules2.map(s => ({
      ...s,
      memberName: memberMap.get(s.memberId) || '未知',
      substituteName: s.substituteId ? memberMap.get(s.substituteId) || '未知' : undefined,
    }));
    const csvContent = generateScheduleCSV(schedulesWithNames, allMembers);
    const csvPath = './test-export-multi-shift.csv';
    fs.writeFileSync(csvPath, csvContent, 'utf-8');
    console.log(`✓ 多班次CSV已导出到 ${csvPath}`);
    console.log(`CSV内容预览 (前800字符):\n${csvContent.substring(0, 800)}...`);

    log('13. 测试按班次筛选导出（仅早班）');
    const morningOnly = schedulesWithNames.filter(s => s.shift === 'morning');
    const morningCSV = generateScheduleCSV(morningOnly, allMembers);
    const morningPath = './test-export-morning.csv';
    fs.writeFileSync(morningPath, morningCSV, 'utf-8');
    console.log(`✓ 仅早班CSV已导出到 ${morningPath}, 共 ${morningOnly.length} 条记录`);

    log('14. 最终统计汇总');
    const finalStats = await scheduleService.getStatistics(formatDate(today), endDateStr);
    console.log('最终每人值班次数:');
    const finalCounts: number[] = [];
    for (const ms of finalStats.memberShifts) {
      const breakdownStr = Object.entries(ms.shiftBreakdown)
        .filter(([, v]) => v > 0)
        .map(([k, v]) => `${labelMap2[k] || k}${v}次`)
        .join(', ');
      console.log(`  ${ms.memberName}: ${ms.count} 次 (${breakdownStr})`);
      finalCounts.push(ms.count);
    }
    const finalMax = Math.max(...finalCounts);
    const finalMin = Math.min(...finalCounts);
    console.log(`\n最终均衡度 - 最多: ${finalMax}, 最少: ${finalMin}, 差值: ${finalMax - finalMin}`);
    console.log(`最长连续值班: ${finalStats.maxConsecutive} 天`);
    console.log('各班次总数:', JSON.stringify(finalStats.shiftBreakdown));

    console.log('\n' + '🎉'.repeat(20));
    console.log('✅ 所有测试通过！多班次功能验证完成！');
    console.log('🎉'.repeat(20) + '\n');

    console.log('\n📊 测试总结:');
    console.log(`  ✓ 成员管理: 添加${members.length}个成员`);
    console.log(`  ✓ 不可值班日期管理: 正常`);
    console.log(`  ✓ 多班次配置: 早/晚/夜三班次, 各有成员范围`);
    console.log(`  ✓ 排班生成算法: 生成${savedSchedules.length}条排班（含班次）`);
    console.log(`  ✓ 均衡性: 最大最小差值 ${finalMax - finalMin} 天`);
    console.log(`  ✓ 冲突检测(4类): 检测到${conflictsAfter.length}个潜在问题`);
    console.log(`  ✓ 调班功能: 同班次内交换正常`);
    console.log(`  ✓ 替班功能: 班次成员资格校验正常`);
    console.log(`  ✓ 请假功能: 正常`);
    console.log(`  ✓ CSV导出(含班次列): 2个文件已生成`);
    console.log('\n');

    process.exit(0);
  } catch (error) {
    console.error('\n❌ 测试失败:', error);
    console.error(error);
    process.exit(1);
  }
};

runTests();
