const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const html = fs.readFileSync(path.join(__dirname, '../app/index.html'), 'utf8');
const script = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].at(-1)[1];
const elements = new Map();
function element(id) {
  if (!elements.has(id)) elements.set(id, {
    value: id === 'point-star-filter' ? 'all' : '', checked: false, style: {},
    textContent: '', innerHTML: '', children: [], disabled: false, open: false,
    addEventListener() {}, setAttribute() {}, removeAttribute() {}, focus() {},
    showModal() { this.open = true; }, close() { this.open = false; },
    classList: { add() {}, remove() {} }, querySelectorAll() { return []; }
  });
  return elements.get(id);
}
const c = vm.createContext({
  document: { getElementById: element, querySelector() { return null; } },
  window: { addEventListener() {} }, requestAnimationFrame(callback) { callback(); }
});
vm.runInContext(script, c);
const fixture = () => ({
  '번호': '1',
  '지문': [{ '번호': '1', '영어': 'Alpha beta constructor.' }, { '번호': '2', '영어': 'Another sentence.' }],
  '출제포인트': {
    '문장 삽입 포인트': [{ '문장번호': '(1)', '별점': '★★☆', '삽입후보문장': 'Alpha beta constructor.', '출제이유': 'INSERT explanation' }],
    '서술형 포인트': [{ '문장번호': '(1)', '별점': '★★★', '영어원문': 'Alpha beta constructor.', '문법포인트설명': 'WRITTEN explanation' }],
    '어휘 포인트': [{ '문장번호': '(1)', '별점': '★☆☆', '표현': 'Alpha', '왜_벗어나는가': 'VOCAB explanation' }]
  }
});
function load(data = fixture()) {
  c.records = [c.buildRecordFromJsonPassage(data, 0, 'test')];
  return c.records[0];
}
function output(mode = 'screen') { return c.buildRecordSheetHtml(c.records[0], 'teacher', mode); }

let record = load();
c.openSentenceEditor(2);
element('edit-order-labels').value = '(A)';
c.saveSentenceEditor();
for (const type of ['문장 삽입', '서술형']) {
  const point = record.sentences[0].points.find(p => p.type === type);
  c.movePoint(point.id, '2');
}
for (const mode of ['screen', 'print']) {
  assert.ok(output(mode).includes('INSERT explanation') && output(mode).includes('WRITTEN explanation'), 'Unrelated order edits must not hide moved points');
}
c.openSentenceEditor(2);
element('edit-insert-marker').checked = false;
c.saveSentenceEditor();
const moved = record.sentences[1].points.find(p => p.type === '문장 삽입');
c.movePoint(moved.id, '1');
c.movePoint(moved.id, '2');
assert.ok(!output().includes('INSERT explanation'), 'Explicit suppression must survive moving out and back');
assert.ok(output().includes('WRITTEN explanation'));

for (const [section, titleKey, type] of [
  ['빈칸 포인트', '핵심구절', '빈칸'], ['어휘 포인트', '표현', '어휘'], ['함축 의미 포인트', '핵심표현', '함축 의미']
]) {
  const data = fixture();
  data['출제포인트'] = { [section]: [{ '문장번호': '(1)', '별점': '★★☆', [titleKey]: 'Alpha', '출제이유': 'Explanation', '왜_벗어나는가': 'Explanation', '함축의미': 'Explanation' }] };
  record = load(data);
  record.sentences[0].useAutoMarks = false;
  const key = { '빈칸': 'blank', '어휘': 'vocab', '함축 의미': 'figurative' }[type];
  record.sentences[0].manualMarks = { [key]: ['alpha'] };
  assert.ok(output().includes('Explanation'), type + ': lowercase target retains explanation');
  assert.ok(output('print').includes('Explanation'));
}

assert.deepEqual(Array.from(c.uniqueItems(['constructor', 'CONSTRUCTOR', 'beta'])), ['constructor', 'beta']);
for (const [reference, index] of [['⑮', 14], ['⑯', 15], ['⑳', 19]]) {
  const data = fixture();
  data['지문'] = Array.from({ length: 20 }, (_, i) => ({ '번호': String(i + 1), '영어': `Sentence ${i + 1}.` }));
  data['출제포인트'] = { '어휘 포인트': [{ '문장번호': reference, '별점': '★☆☆', '표현': 'Sentence' }] };
  const result = c.buildRecordFromJsonPassage(data, 0, 'test');
  assert.equal(result.sentences[index].points.length, 1, reference);
}
const ranged = fixture();
ranged['출제포인트']['어휘 포인트'][0]['문장번호'] = '(1~2)';
record = load(ranged);
assert.equal(record.sentences[0].points.find(p => p.type === '어휘').sentenceNum, 1, 'Producer range retains the existing leading-sentence attachment');
assert.throws(() => load({ ...fixture(), '지문': [{ '번호': '1', '영어': 'First.' }, { '번호': '1', '영어': 'Duplicate.' }] }), /중복/);
assert.throws(() => c.jsonStarsToCount(3), /별점/);
assert.equal(c.jsonStarsToCount('★★☆'), 2);
record = load();
c.openSentenceEditor(1);
element('edit-vocab-targets').value = 'absent phrase';
const originalSentence = JSON.stringify(record.sentences[0]);
c.saveSentenceEditor();
assert.equal(element('sentence-edit-modal').open, true);
assert.equal(JSON.stringify(record.sentences[0]), originalSentence, 'Invalid manual target must not partially save');
assert.ok(element('edit-vocab-targets-feedback').textContent.includes('absent phrase'));
element('summary-underline-a').value = 'Alpha';
element('summary-underline-b').value = 'Alpha';
assert.strictEqual(c.updateMatchFeedback('Alpha beta.', ['summary-underline-a', 'summary-underline-b'], true), element('summary-underline-b'), 'Summary feedback must follow exclusive underline matching');

const sourceData = fixture();
const sourceSnapshot = JSON.stringify(sourceData);
c.records = [0, 1].map(index => c.buildRecordFromJsonPassage(sourceData, index, 'bulk-test'));
c.activeRecordIndex = 1;
c.activeViewMode = 'student';
element('point-star-filter').value = '1';
c.records[0].sentences[0].manualMarkerOverride = { descriptive: false, insert: true, orderLabels: ['(B)'] };
c.records[0].sentences[0].manualMarks = { grammar: ['beta'] };
c.records[1].sentences[1].manualMarkerOverride = { descriptive: true };
c.importedRecordsSnapshot = JSON.stringify(c.records);
let confirmRemoval = false;
let removalPrompts = 0;
c.window.confirm = () => { removalPrompts++; return confirmRemoval; };
const beforeRemoval = JSON.stringify(c.records);
c.removeAllDescriptivePoints();
assert.equal(JSON.stringify(c.records), beforeRemoval, 'Cancel preserves every tab and edit');
confirmRemoval = true;
element('remove-descriptive-btn').disabled = true;
c.removeAllDescriptivePoints();
element('remove-descriptive-btn').disabled = false;
element('result-area').inert = true;
c.removeAllDescriptivePoints();
element('result-area').inert = false;
assert.equal(removalPrompts, 1, 'Export/import locks prevent bulk deletion');
c.removeAllDescriptivePoints();
assert.equal(removalPrompts, 2);
assert.equal(c.activeRecordIndex, 1);
assert.equal(c.activeViewMode, 'student');
assert.equal(element('point-star-filter').value, '1', 'Keep the filter while deleting hidden points');
assert.equal(c.hasWorkspaceEdits(), true, 'Deletion is included in the existing discard warning');
assert.deepEqual(Array.from(c.records[0].sentences[0].manualMarkerOverride.orderLabels), ['(B)']);
assert.equal(c.records[0].sentences[0].manualMarkerOverride.insert, true);
assert.deepEqual(Array.from(c.records[0].sentences[0].manualMarks.grammar), ['beta']);
assert.equal(c.records[1].sentences[1].manualMarkerOverride, null, 'Clear manually forced descriptive stars too');
element('point-star-filter').value = 'all';
for (const item of c.records) {
  assert.equal(item.sentences[0].points.length, 2, 'Keep insertion and vocabulary points');
  assert.equal(item.sentences[0].text, 'Alpha beta constructor.');
  for (const view of ['teacher', 'student']) for (const target of ['screen', 'print']) {
    const sheet = c.buildRecordSheetHtml(item, view, target);
    assert.ok(!sheet.includes('WRITTEN explanation') && !sheet.includes('marker-descriptive'), `${view}/${target}: remove written explanations and stars on every tab`);
    assert.ok(sheet.includes('marker-insert') && sheet.includes('Alpha'), 'Keep other markers and text');
  }
}
assert.equal(JSON.stringify(sourceData), sourceSnapshot, 'Never modify the source JSON payload');
c.removeAllDescriptivePoints();
assert.equal(removalPrompts, 2, 'Repeated removal without targets needs no confirmation');
assert.ok(element('bulk-point-status').textContent.includes('없습니다'));
c.records = [];
c.removeAllDescriptivePoints();
console.log('PASS: moved-point overrides, explicit hiding, case-consistent explanations, constructor, circled references, verified producer formats');
