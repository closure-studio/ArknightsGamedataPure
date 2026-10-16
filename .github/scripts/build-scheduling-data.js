const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const TYPES = { MANUFACTURE: 'manufacturing', TRADING: 'trading', POWER: 'power' };
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
function object(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('基建数据对象无效');
  return value;
}
function array(value, max) {
  if (!Array.isArray(value) || value.length > max) throw new Error('基建数据列表无效或超限');
  return value;
}
function id(value) {
  if (typeof value !== 'string' || !value || value.trim() !== value || value.length > 200) throw new Error('基建数据标识无效');
  return value;
}
function projectSchedulingData(input, revision, sha256) {
  if (!/^[a-f0-9]{40}$/.test(revision) || !/^[a-f0-9]{64}$/.test(sha256)) throw new Error('基建来源版本无效');
  const source = object(input);
  const rooms = Object.fromEntries(Object.entries(TYPES).map(([key, type]) => {
    const phases = array(object(object(source.rooms)[key]).phases, 10);
    if (!phases.length) throw new Error('缺少房间等级');
    return [type, phases.map(phase => {
      const n = object(phase).maxStationedNum;
      if (!Number.isSafeInteger(n) || n < 1 || n > 10) throw new Error('房间容量无效');
      return n;
    })];
  }));
  const sourceSkills = object(source.buffs);
  const sourceOperators = Object.entries(object(source.chars));
  if (sourceOperators.length > 5000) throw new Error('干员数量超限');
  const skills = Object.create(null);
  const operators = Object.fromEntries(sourceOperators.map(([charId, entry]) => {
    id(charId); object(entry);
    if (entry.charId !== charId) throw new Error('干员标识不一致');
    // 特殊模板不能伪装成普通技能组；前端会显示不支持。
    if (entry.tmpl || entry.templates || entry.tmplId) return [charId, null];
    const groups = array(entry.buffChar, 20).map(group => array(object(group).buffData, 20).map(item => {
      object(item); const skillId = id(item.buffId); const cond = object(item.cond);
      if (![0, 1, 2].includes(cond.phase) || !Number.isSafeInteger(cond.level) || cond.level < 1 || cond.level > 1000) throw new Error('技能解锁条件无效');
      const buff = object(sourceSkills[skillId]);
      if (typeof buff.description !== 'string' || buff.description.length > 10000 || !Number.isFinite(buff.efficiency)) throw new Error('技能字段无效');
      id(buff.roomType);
      skills[skillId] = { roomType: TYPES[buff.roomType] || 'other', description: buff.description, efficiency: buff.efficiency };
      return { skillId, elite: cond.phase, level: cond.level };
    }));
    return [charId, groups];
  }));
  const payload = { rooms, operators, skills };
  return { schemaVersion: 1, source: { revision, sha256 }, payloadSha256: hash(JSON.stringify(payload)), ...payload };
}
if (require.main === module) {
  const root = path.resolve(__dirname, '../..');
  const inputPath = process.argv[2] || path.join(root, 'excel/building_data.json');
  const outputPath = process.argv[3] || path.join(root, 'processed/base_scheduling.v1.json');
  const revision = process.argv[4] || execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
  const raw = fs.readFileSync(inputPath);
  const result = projectSchedulingData(JSON.parse(raw.toString('utf8')), revision, hash(raw));
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify(result));
  console.log(`基建资源生成：${Object.keys(result.operators).length} 干员，${Object.keys(result.skills).length} 技能，schema=1`);
}
module.exports = { projectSchedulingData };
