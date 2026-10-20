const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const html = fs.readFileSync(path.join(__dirname, '../app/index.html'), 'utf8');
const script = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].at(-1)[1];
const elements = new Map();
function element(id) {
  if (!elements.has(id)) elements.set(id, {
    value: id === 'point-star-filter' ? 'all' : '', style: {}, disabled: false,
    textContent: '', innerHTML: '', children: [], addEventListener() {}, setAttribute() {}, removeAttribute() {},
    classList: { add() {}, remove() {} }, querySelectorAll() { return []; }
  });
  return elements.get(id);
}
let confirmations = 0;
let acceptReplacement = false;
const context = vm.createContext({
  document: { getElementById: element, querySelector() { return null; } },
  window: { addEventListener() {}, confirm() { confirmations++; return acceptReplacement; } },
  requestAnimationFrame(callback) { callback(); }
});
vm.runInContext(script, context);
function passage(reference = '1') {
  return {
    '번호': '1', '지문': [{ '번호': '1', '영어': 'Alpha beta.' }],
    '출제포인트': { '어휘 포인트': [{ '문장번호': reference, '별점': '★★', '표현': 'Alpha' }] }
  };
}
function file(payload, name = 'sample.json') {
  return { name, async text() { return typeof payload === 'string' ? payload : JSON.stringify(payload); } };
}
async function load(files) {
  context.uploadedJsonFiles = files;
  await context.generate();
}
function build(data) {
  context.testPassage = data;
  return vm.runInContext('buildRecordFromJsonPassage(testPassage, 0, "test")', context, { timeout: 1000 });
}

(async () => {
  for (const reference of ['100000', '9'.repeat(309), 0, -1, '1.5', 'Infinity', '1e309', 'bad']) {
    assert.throws(() => build(passage(reference)), /문장 (번호|범위)/, String(reference).slice(0, 30));
  }
  assert.throws(() => build({ ...passage(), '지문': [{ '번호': '9'.repeat(309), '영어': 'Bad.' }] }), /문장 번호/);
  assert.throws(() => build({ ...passage(), '지문': Array.from({ length: 1001 }, () => ({ '영어': 'Text.' })) }), /1,?000/);
  for (const reference of ['1~100000', '2~1', '0~2', '1~Infinity', '1~', '-1~2', '1~2.5']) {
    const data = passage();
    data['출제포인트']['글의 순서 포인트'] = { A: { '문장번호': reference } };
    assert.throws(() => build(data), /문장 (번호|범위)/, reference);
  }
  for (const reference of ['1', '(1)', '①', '문장 1', '1번 문장']) {
    assert.equal(build(passage(reference)).sentences[0].points.length, 1, reference);
  }
  assert.equal(build(passage('1000')).sentences.length, 1000, 'Maximum valid reference is supported');
  const ordered = passage();
  ordered['출제포인트']['글의 순서 포인트'] = { A: { '문장번호': '①~③' } };
  assert.equal(build(ordered).sentences.length, 3);
  assert.equal(build(ordered).sentences[0].orderLabels[0], '(A)');

  await load([file({ PASSAGES: [passage(), { ...passage(), '번호': '2' }] })]);
  assert.equal(context.records.length, 2);
  assert.equal(confirmations, 0);
  context.activeRecordIndex = 1;
  context.activeViewMode = 'student';
  context.renameActiveRecord('Edited title');
  context.records[1].sentences[0].manualMarks = { vocab: ['beta'] };
  const previousRecords = context.records;
  const previousData = JSON.stringify(context.records);
  element('point-star-filter').value = '2';

  for (const files of [
    [file('{ invalid', 'broken.json')],
    [file({ PASSAGES: [] }, 'empty.json')],
    [file({ PASSAGES: [passage()] }), file('{ invalid', 'second-broken.json')],
    [file({ PASSAGES: [passage('100000')] }, 'bad-number.json')]
  ]) {
    await load(files);
    assert.strictEqual(context.records, previousRecords, 'Failed import must keep the original objects');
    assert.equal(JSON.stringify(context.records), previousData);
    assert.equal(context.activeRecordIndex, 1);
    assert.equal(context.activeViewMode, 'student');
    assert.equal(element('point-star-filter').value, '2');
    assert.equal(element('result-area').style.display, 'block');
    assert.equal(element('print-btn').disabled, false);
    assert.equal(element('image-btn').disabled, false);
    assert.equal(element('gen-btn').disabled, false);
    assert.equal(element('json-file').disabled, false);
    assert.ok(element('error-box').textContent.includes(files.at(-1).name), 'Identify the failing file');
  }
  assert.equal(confirmations, 0, 'Invalid input must not ask to discard edits');

  let finishRead;
  context.uploadedJsonFiles = [{ name: 'slow.json', text() { return new Promise(resolve => { finishRead = resolve; }); } }];
  const pendingImport = context.generate();
  assert.equal(element('result-area').inert, true, 'Prevent unfinished edits while reading a replacement');
  assert.equal(element('print-btn').disabled, true);
  assert.equal(element('image-btn').disabled, true);
  assert.strictEqual(context.records, previousRecords);
  finishRead('{ invalid');
  await pendingImport;
  assert.equal(element('result-area').inert, false);
  assert.equal(element('print-btn').disabled, false);
  assert.equal(element('image-btn').disabled, false);
  assert.equal(JSON.stringify(context.records), previousData);

  await load([file({ PASSAGES: [passage()] })]);
  assert.equal(confirmations, 1);
  assert.strictEqual(context.records, previousRecords, 'Cancel must keep current edits and selection');
  assert.equal(context.activeRecordIndex, 1);
  assert.equal(context.activeViewMode, 'student');

  acceptReplacement = true;
  await load([file({ PASSAGES: [passage()] })]);
  assert.equal(confirmations, 2);
  assert.equal(context.records.length, 1);
  assert.equal(context.records[0].label, '지문 1');
  await load([file({ PASSAGES: [passage()] })]);
  assert.equal(confirmations, 2, 'Unedited workspace should not prompt');
  console.log('PASS: bounded references/ranges, valid boundary, atomic failed imports, edit-preserving cancellation, confirmed replacement');
})().catch(error => { console.error(error); process.exitCode = 1; });
