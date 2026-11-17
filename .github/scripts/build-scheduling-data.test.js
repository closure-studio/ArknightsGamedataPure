const { test } = require('node:test');
const assert = require('node:assert/strict');
const { projectSchedulingData } = require('./build-scheduling-data');
const crypto = require('node:crypto');
function fixture() {
  return {
    rooms: Object.fromEntries(['MANUFACTURE', 'TRADING', 'POWER'].map(type => [type, { phases: [{ maxStationedNum: 1 }] }])),
    chars: { sample: { charId: 'sample', secret: 'omit', buffChar: [{ buffData: [{ buffId: 'simple', cond: { phase: 0, level: 1 } }] }] } },
    buffs: { simple: { roomType: 'MANUFACTURE', description: '合成测试技能', efficiency: 0.15, secret: 'omit' } },
  };
}
test('只投影契约字段，保持输入不变并记录来源', () => {
  const source = fixture();
  const before = JSON.stringify(source);
  const result = projectSchedulingData(source, 'a'.repeat(40), 'b'.repeat(64));
  assert.equal(JSON.stringify(source), before);
  assert.equal(result.schemaVersion, 1);
  assert.deepEqual(result.source, { revision: 'a'.repeat(40), sha256: 'b'.repeat(64) });
  assert.deepEqual(result.rooms.manufacturing, [1]);
  assert.deepEqual(result.operators.sample, [[{ skillId: 'simple', elite: 0, level: 1 }]]);
  assert.deepEqual(result.skills.simple, { roomType: 'manufacturing', description: '合成测试技能', efficiency: 0.15 });
  assert.ok(!JSON.stringify(result).includes('secret'));
  assert.equal(result.payloadSha256, crypto.createHash('sha256').update(JSON.stringify({ rooms: result.rooms, operators: result.operators, skills: result.skills })).digest('hex'));
});
test('未知房间技能保留为 other，不静默丢失', () => {
  const source = fixture(); source.buffs.simple.roomType = 'DORMITORY';
  assert.equal(projectSchedulingData(source, 'a'.repeat(40), 'b'.repeat(64)).skills.simple.roomType, 'other');
});
for (const [name, mutate] of [
  ['缺失技能引用', s => { delete s.buffs.simple; }],
  ['非法解锁阶段', s => { s.chars.sample.buffChar[0].buffData[0].cond.phase = 3; }],
  ['缺失容量', s => { delete s.rooms.POWER.phases[0].maxStationedNum; }],
  ['无效效率', s => { s.buffs.simple.efficiency = NaN; }],
  ['ID不一致', s => { s.chars.sample.charId = 'other'; }],
]) test(name, () => { const s = fixture(); mutate(s); assert.throws(() => projectSchedulingData(s, 'a'.repeat(40), 'b'.repeat(64))); });
test('拒绝无版本来源', () => assert.throws(() => projectSchedulingData(fixture(), '', '')));
