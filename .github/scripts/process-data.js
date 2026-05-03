const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

// 配置
const CONFIG = {
  inputDir: path.join(__dirname, '../../excel'),
  outputDir: path.join(__dirname, '../../processed'),
  files: {
    stage: 'stage_table.json',
    item: 'item_table.json',
    character: 'character_table.json'
  }
};

// 压缩文件
function compressFile(inputPath) {
  const gzipPath = inputPath + '.gz';
  const input = fs.readFileSync(inputPath);
  const compressed = zlib.gzipSync(input, { level: 9 }); // 最高压缩级别
  fs.writeFileSync(gzipPath, compressed);

  const originalSize = (input.length / 1024).toFixed(2);
  const compressedSize = (compressed.length / 1024).toFixed(2);
  const ratio = ((1 - compressed.length / input.length) * 100).toFixed(2);

  console.log(`  ✓ 压缩: ${originalSize} KB → ${compressedSize} KB (节省 ${ratio}%)`);
}

// 主函数
async function main() {
  try {
    console.log('========================================');
    console.log('开始处理游戏数据...');
    console.log('========================================\n');

    // 创建输出目录
    if (!fs.existsSync(CONFIG.outputDir)) {
      fs.mkdirSync(CONFIG.outputDir, { recursive: true });
      console.log(`✓ 创建输出目录: ${CONFIG.outputDir}\n`);
    }

    // 并行处理三个文件
    await Promise.all([
      processStageTable(),
      processItemTable(),
      processCharacterTable()
    ]);

    console.log('\n========================================');
    console.log('✅ 所有数据处理完成！');
    console.log('========================================');
  } catch (error) {
    console.error('\n❌ 处理失败:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// 处理 stage_table.json
async function processStageTable() {
  console.log('📋 处理 stage_table.json...');

  const inputPath = path.join(CONFIG.inputDir, CONFIG.files.stage);
  const outputPath = path.join(CONFIG.outputDir, CONFIG.files.stage);

  try {
    // 读取原始数据
    const rawData = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
    const stages = rawData.stages || {};

    // 过滤和转换
    const filtered = {};
    let totalCount = 0;
    let filteredCount = 0;

    for (const [stageId, stage] of Object.entries(stages)) {
      totalCount++;

      // 过滤条件
      if (shouldFilterStage(stageId, stage)) {
        filteredCount++;
        continue;
      }

      // 提取掉落物品 ID
      const items = [];
      const displayRewards = stage.stageDropInfo?.displayRewards || [];
      for (const item of displayRewards) {
        if (item.dropType === 2 || item.dropType === 3) {
          items.push(item.id);
        }
      }

      // 如果没有物品且不包含 act24side，跳过
      if (items.length === 0 && !stageId.includes('act24side')) {
        filteredCount++;
        continue;
      }

      // 处理关卡名称
      const stageName = stage.stageId && stage.stageId.includes('#s#')
        ? '[险地]' + stage.name
        : stage.name;

      // 提取需要的字段
      filtered[stageId] = {
        name: stageName,
        code: stage.code,
        ap: stage.apCost,
        items: items
      };
    }

    // 写入输出文件
    fs.writeFileSync(outputPath, JSON.stringify(filtered, null, 2));

    const outputSize = (fs.statSync(outputPath).size / 1024 / 1024).toFixed(2);
    console.log(`  ✓ 总关卡数: ${totalCount}`);
    console.log(`  ✓ 过滤掉: ${filteredCount}`);
    console.log(`  ✓ 保留: ${totalCount - filteredCount}`);
    console.log(`  ✓ 输出大小: ${outputSize} MB`);
    console.log(`  ✓ 输出文件: ${outputPath}`);

    // 压缩文件
    compressFile(outputPath);
  } catch (error) {
    console.error(`  ❌ 处理 stage_table.json 失败:`, error.message);
    throw error;
  }
}

// 关卡过滤逻辑
function shouldFilterStage(stageId, stage) {
  // 排除包含特定关键词的关卡
  if (stageId.includes('camp') ||
      stageId.includes('#f#') ||
      stageId.includes('bossrush') ||
      stageId.includes('act1lock_a') ||
      stageId.includes('act17d7_01') ||
      stageId.includes('lt_') ||
      stageId.includes('tr_')) {
    return true;
  }

  // 排除 apCost <= 0 的关卡
  if (!stage.apCost || stage.apCost <= 0) {
    return true;
  }

  return false;
}

// 处理 item_table.json
async function processItemTable() {
  console.log('📦 处理 item_table.json...');

  const inputPath = path.join(CONFIG.inputDir, CONFIG.files.item);
  const outputPath = path.join(CONFIG.outputDir, CONFIG.files.item);

  try {
    // 读取原始数据
    const rawData = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
    const items = rawData.items || {};

    // 转换数据
    const processed = {};
    let count = 0;

    for (const [itemId, item] of Object.entries(items)) {
      processed[itemId] = {
        name: item.name,
        icon: item.iconId
      };
      count++;
    }

    // 写入输出文件
    fs.writeFileSync(outputPath, JSON.stringify(processed, null, 2));

    const outputSize = (fs.statSync(outputPath).size / 1024).toFixed(2);
    console.log(`  ✓ 处理物品数: ${count}`);
    console.log(`  ✓ 输出大小: ${outputSize} KB`);
    console.log(`  ✓ 输出文件: ${outputPath}`);

    // 压缩文件
    compressFile(outputPath);
  } catch (error) {
    console.error(`  ❌ 处理 item_table.json 失败:`, error.message);
    throw error;
  }
}

// 处理 character_table.json
async function processCharacterTable() {
  console.log('👤 处理 character_table.json...');

  const inputPath = path.join(CONFIG.inputDir, CONFIG.files.character);
  const outputPath = path.join(CONFIG.outputDir, CONFIG.files.character);

  try {
    // 读取原始数据
    const rawData = JSON.parse(fs.readFileSync(inputPath, 'utf8'));

    // 转换数据
    const processed = {};
    let count = 0;

    for (const [charId, character] of Object.entries(rawData)) {
      // 只处理有 name 和 rarity 字段的数据
      if (character.name !== undefined && character.rarity !== undefined) {
        processed[charId] = {
          name: character.name,
          rarity: character.rarity
        };
        count++;
      }
    }

    // 写入输出文件
    fs.writeFileSync(outputPath, JSON.stringify(processed, null, 2));

    const outputSize = (fs.statSync(outputPath).size / 1024).toFixed(2);
    console.log(`  ✓ 处理干员数: ${count}`);
    console.log(`  ✓ 输出大小: ${outputSize} KB`);
    console.log(`  ✓ 输出文件: ${outputPath}`);

    // 压缩文件
    compressFile(outputPath);
  } catch (error) {
    console.error(`  ❌ 处理 character_table.json 失败:`, error.message);
    throw error;
  }
}

// 运行主函数
main();
