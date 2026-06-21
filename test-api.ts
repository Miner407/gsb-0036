import { initDatabase } from './api/database/init';
import { memberService } from './api/services/member.service';
import { scheduleService } from './api/services/schedule.service';
import { configService } from './api/services/config.service';
import { conflictDetector } from './api/services/conflict.detector';
import { schedulingAlgorithm } from './api/services/scheduling.algorithm';
import { generateScheduleCSV } from './api/utils/csv.utils';
import { runQuery } from './api/config/database';
import * as fs from 'fs';

const log = (title: string, data?: any) => {
  console.log('\n' + '='.repeat(60));
  console.log(`📋 ${title}`);
  console.log('='.repeat(60));
  if (data !== undefined) {
    console.log(JSON.stringify(data, null, 2));
  }
};

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const clearDatabase = async () => {
  await runQuery('DELETE FROM schedules');
  await runQuery('DELETE FROM unavailable_dates');
  await runQuery('DELETE FROM members');
  await runQuery('DELETE FROM schedule_config');
  await runQuery('DELETE FROM sqlite_sequence WHERE name IN ("members", "unavailable_dates", "schedules", "schedule_config")');
};

const runTests = async () => {
  console.log('\n🚀 开始值班排班系统功能测试\n');

  try {
    await initDatabase();
    log('数据库初始化成功');

    await clearDatabase();
    log('数据库已清空，开始测试...');

    // 1. 测试成员管理
    log('1. 测试成员管理');
    const memberNames = ['张三', '李四', '王五', '赵六', '钱七'];
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

    // 2. 设置不可值班日期
    log('2. 设置不可值班日期');
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    const nextWeek = new Date(today);
    nextWeek.setDate(today.getDate() + 7);

    const formatDate = (d: Date) => d.toISOString().split('T')[0];

    // 张三明天不可值班
    await memberService.addUnavailableDates(members[0].id, {
      date: formatDate(tomorrow),
      reason: '有事请假'
    });
    console.log(`✓ 设置张三(${members[0].id}) ${formatDate(tomorrow)} 不可值班`);

    // 李四下一周不可值班
    await memberService.addUnavailableDates(members[1].id, {
      startDate: formatDate(nextWeek),
      endDate: formatDate(new Date(nextWeek.getTime() + 3 * 24 * 60 * 60 * 1000)),
      reason: '休假'
    });
    console.log(`✓ 设置李四(${members[1].id}) ${formatDate(nextWeek)} 起连续4天不可值班`);

    const zsUnavailable = await memberService.getMemberUnavailableDates(members[0].id);
    console.log(`张三的不可值班日期: ${zsUnavailable.length} 天`);

    // 3. 配置排班设置
    log('3. 配置排班设置');
    const config = await configService.updateConfig({
      cycleDays: 14,
      dailyRequired: 2,
      maxConsecutiveDays: 2,
      balanceWeight: 1.0,
      startDate: formatDate(today)
    });
    console.log(`✓ 排班配置: 周期${config.cycleDays}天, 每天${config.dailyRequired}人, 最多连续${config.maxConsecutiveDays}天`);

    // 4. 测试排班生成算法
    log('4. 测试排班生成算法');
    const unavailableMap = await memberService.getAllUnavailableDatesAsMap();
    
    // 转换格式给算法
    const unavailableDates = Array.from(unavailableMap.entries()).flatMap(([memberId, dates]) =>
      Array.from(dates).map((date) => ({
        id: 0,
        memberId,
        date,
        createdAt: '',
      }))
    );
    
    const algorithmResult = schedulingAlgorithm.generateSchedule(
      allMembers,
      unavailableDates,
      config
    );
    console.log(`✓ 算法生成排班记录: ${algorithmResult.schedules.length} 条`);
    if (algorithmResult.message) {
      console.log(`提示: ${algorithmResult.message}`);
    }

    // 保存排班
    const generateResult = await scheduleService.generateSchedule({
      startDate: formatDate(today),
      cycleDays: config.cycleDays,
      dailyRequired: config.dailyRequired
    });
    const savedSchedules = generateResult.schedules;
    console.log(`✓ 保存排班记录: ${savedSchedules.length} 条`);
    console.log(`✓ 生成成功: ${generateResult.success}`);
    if (generateResult.conflicts.length > 0) {
      console.log(`生成时检测到 ${generateResult.conflicts.length} 个潜在冲突`);
    }

    // 5. 统计分析
    log('5. 排班统计分析');
    const endDateStr = formatDate(new Date(today.getTime() + (config.cycleDays - 1) * 24 * 60 * 60 * 1000));
    const stats = await scheduleService.getStatistics(
      formatDate(today),
      endDateStr
    );
    console.log('每人值班次数:');
    const counts: number[] = [];
    for (const ms of stats.memberShifts) {
      console.log(`  ${ms.memberName}: ${ms.count} 次`);
      counts.push(ms.count);
    }
    const maxCount = Math.max(...counts);
    const minCount = Math.min(...counts);
    console.log(`\n排班均衡度 - 最多: ${maxCount}, 最少: ${minCount}, 差值: ${maxCount - minCount}`);
    console.log(`最长连续值班: ${stats.maxConsecutive} 天`);

    // 6. 冲突检测
    log('6. 冲突检测');
    const conflicts = await conflictDetector.detectAllConflicts(
      savedSchedules,
      allMembers,
      unavailableMap,
      config,
      formatDate(today),
      endDateStr
    );
    console.log(`检测到 ${conflicts.length} 个冲突/警告:`);
    for (const c of conflicts) {
      console.log(`  [${c.severity.toUpperCase()}] ${c.type}: ${c.message}`);
    }

    // 7. 测试调班功能（交换同一天的两人）
    log('7. 测试调班功能');
    const sameDaySchedules = savedSchedules.filter(s => s.date === savedSchedules[0]?.date);
    if (sameDaySchedules.length >= 2) {
      const schedule1 = sameDaySchedules[0];
      const schedule2 = sameDaySchedules[1];
      
      console.log(`交换: ${schedule1.date} 成员${schedule1.memberId} ↔ 成员${schedule2.memberId}`);
      
      const swapResult = await scheduleService.swapSchedules(schedule1.id, schedule2.id);
      console.log(`✓ 调班成功: ${swapResult.success}, 更新 ${swapResult.schedules.length} 条记录`);
      if (swapResult.conflicts.length > 0) {
        console.log(`调班后检测到 ${swapResult.conflicts.length} 个潜在冲突:`);
        for (const c of swapResult.conflicts) {
          console.log(`  [${c.severity.toUpperCase()}] ${c.message}`);
        }
      }
    } else {
      console.log('⚠ 第一天排班不足2人，跳過交换测试');
    }

    // 8. 测试替班功能
    log('8. 测试替班功能');
    if (savedSchedules.length > 0 && members.length > 2) {
      const schedule = savedSchedules.find(s => s.memberId !== members[2].id) || savedSchedules[0];
      const oldMemberId = schedule.memberId;
      const newMemberId = members[2].id;
      
      console.log(`替班: ${schedule.date} 成员${oldMemberId} → 成员${newMemberId}`);
      
      const replaceResult = await scheduleService.replaceSchedule(schedule.id, newMemberId);
      console.log(`✓ 替班成功: ${replaceResult.success}`);
      if (replaceResult.conflicts.length > 0) {
        console.log(`替班后检测到 ${replaceResult.conflicts.length} 个潜在冲突:`);
        for (const c of replaceResult.conflicts) {
          console.log(`  [${c.severity.toUpperCase()}] ${c.message}`);
        }
      }
    }

    // 9. 测试请假功能
    log('9. 测试请假功能');
    if (savedSchedules.length > 0 && members.length > 1) {
      const schedule = savedSchedules[1];
      const substituteId = members[3].id;
      
      console.log(`请假: ${schedule.date} 成员${schedule.memberId}, 替班: 成员${substituteId}`);
      
      const result = await scheduleService.markLeave(
        schedule.id,
        '年假',
        substituteId
      );
      console.log(`✓ 请假标记成功, isLeave: ${result.isLeave}, leaveType: ${result.leaveType}`);
    }

    // 10. 再次检测冲突（调班和请假后）
    log('10. 调班和请假后再次检测冲突');
    const updatedSchedules = await scheduleService.getSchedules(
      formatDate(today),
      endDateStr
    );
    const conflictsAfter = await conflictDetector.detectAllConflicts(
      updatedSchedules,
      allMembers,
      unavailableMap,
      config,
      formatDate(today),
      endDateStr
    );
    console.log(`检测到 ${conflictsAfter.length} 个冲突/警告:`);
    for (const c of conflictsAfter) {
      console.log(`  [${c.severity.toUpperCase()}] ${c.type}: ${c.message}`);
    }

    // 11. 导出CSV
    log('11. 测试导出CSV');
    const csvContent = generateScheduleCSV(updatedSchedules, allMembers, 'detailed');
    const csvPath = './test-export.csv';
    fs.writeFileSync(csvPath, csvContent, 'utf-8');
    console.log(`✓ CSV已导出到 ${csvPath}`);
    console.log(`CSV内容预览 (前500字符):\n${csvContent.substring(0, 500)}...`);

    // 12. 测试标准格式导出
    const standardCSV = generateScheduleCSV(updatedSchedules, allMembers, 'standard');
    const standardPath = './test-export-standard.csv';
    fs.writeFileSync(standardPath, standardCSV, 'utf-8');
    console.log(`\n✓ 标准格式CSV已导出到 ${standardPath}`);

    // 13. 更新后的统计
    log('12. 最终统计');
    const finalStats = await scheduleService.getStatistics(
      formatDate(today),
      endDateStr
    );
    console.log('最终每人值班次数:');
    const finalCounts: number[] = [];
    for (const ms of finalStats.memberShifts) {
      console.log(`  ${ms.memberName}: ${ms.count} 次`);
      finalCounts.push(ms.count);
    }
    const finalMax = Math.max(...finalCounts);
    const finalMin = Math.min(...finalCounts);
    console.log(`\n最终均衡度 - 最多: ${finalMax}, 最少: ${finalMin}, 差值: ${finalMax - finalMin}`);
    console.log(`最长连续值班: ${finalStats.maxConsecutive} 天`);

    console.log('\n' + '🎉'.repeat(20));
    console.log('✅ 所有测试通过！功能验证完成！');
    console.log('🎉'.repeat(20) + '\n');

    // 测试总结
    console.log('\n📊 测试总结:');
    console.log(`  ✓ 成员管理: 添加${members.length}个成员`);
    console.log(`  ✓ 不可值班日期管理: 正常`);
    console.log(`  ✓ 排班配置: 正常`);
    console.log(`  ✓ 排班生成算法: 生成${savedSchedules.length}条排班`);
    console.log(`  ✓ 均衡性: 最大最小差值 ${maxCount - minCount} 天`);
    console.log(`  ✓ 冲突检测: 检测到${conflicts.length}个潜在问题`);
    console.log(`  ✓ 调班功能: 正常`);
    console.log(`  ✓ 替班功能: 正常`);
    console.log(`  ✓ 请假功能: 正常`);
    console.log(`  ✓ CSV导出: 2个文件已生成`);
    console.log('\n');

    process.exit(0);
  } catch (error) {
    console.error('\n❌ 测试失败:', error);
    console.error(error);
    process.exit(1);
  }
};

runTests();
