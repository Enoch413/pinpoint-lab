const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

const html = fs.readFileSync(path.join(__dirname, '../app/index.html'), 'utf8');
const script = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].at(-1)[1];
const elements = new Map();
const context = vm.createContext({
  document: {
    getElementById(id) {
      if (!elements.has(id)) elements.set(id, { value: 'all', addEventListener() {} });
      return elements.get(id);
    }
  },
  window: { addEventListener() {} }
});
vm.runInContext(script, context);
context.document.getElementById('point-star-filter');
const record = context.buildRecordFromJsonPassage({
  '번호': '1',
  '지문': [{ '번호': '1', '영어': 'Alpha beta gamma.' }, { '번호': '2', '영어': 'Keep this sentence.' }],
  '출제포인트': {
    '빈칸 포인트': [{ '문장번호': '1', '별점': '★', '핵심구절': 'Alpha' }],
    '어휘 포인트': [{ '문장번호': '1', '별점': '★★', '표현': 'beta' }],
    '함축 의미 포인트': [{ '문장번호': '1', '별점': '★★★', '핵심표현': 'gamma' }],
    '서술형 포인트': [{ '문장번호': '1', '별점': '★★', '영어원문': 'Alpha beta gamma.' }],
    '문장 삽입 포인트': [{ '문장번호': '1', '별점': '★★★', '삽입후보문장': 'Alpha beta gamma.' }]
  }
}, 0, 'test');
const original = JSON.stringify(record);
const choices = { all: [1, 2, 3, 2, 3], '1': [1], '2': [2, 2], '3': [3, 3], '1-2': [1, 2, 2], '2-3': [2, 3, 2, 3] };
for (const [selection, expected] of Object.entries(choices)) {
  elements.get('point-star-filter').value = selection;
  const sentences = context.filterSentencesByStars(record.sentences);
  assert.deepEqual(Array.from(sentences[0].points, p => p.stars).sort(), expected.slice().sort(), selection);
  assert.equal(sentences.length, 2, 'Keep all original sentences');
  assert.equal(sentences[1].text, 'Keep this sentence.');
  for (const mode of ['screen', 'print']) {
    const teacher = context.buildRecordSheetHtml(record, 'teacher', mode);
    const student = context.buildRecordSheetHtml(record, 'student', mode);
    assert.equal((teacher.match(/class="point-item"/g) || []).length, expected.length);
    assert.ok(teacher.includes('Keep this sentence.') && student.includes('Keep this sentence.'));
    assert.equal(teacher.includes('marker-descriptive'), expected.includes(2));
    assert.equal(student.includes('marker-insert'), expected.includes(3));
  }
  assert.equal(JSON.stringify(record), original, 'Filtering must not change imported data');
}
elements.get('point-star-filter').value = '3';
let marks = context.collectSentenceMarkTargets(context.filterSentencesByStars(record.sentences)[0]);
assert.equal(marks.blankTargets.length, 0);
assert.equal(marks.vocabTargets.length, 0);
assert.deepEqual(Array.from(marks.figurativeTargets), ['gamma']);
record.sentences[0].manualMarks = { grammar: ['beta'] };
marks = context.collectSentenceMarkTargets(context.filterSentencesByStars(record.sentences)[0]);
assert.deepEqual(Array.from(marks.grammarTargets), ['beta'], 'Keep manual edits');
elements.get('point-star-filter').value = 'all';
assert.strictEqual(context.filterSentencesByStars(record.sentences), record.sentences);
const sentence = record.sentences[0];
const sourcePoints = JSON.stringify(sentence.points);
function details(mode = 'screen') {
  return context.buildRecordSheetHtml(record, 'teacher', mode);
}
for (const mode of ['screen', 'print']) {
  sentence.manualMarkerOverride = { orderLabels: [], descriptive: false, insert: true };
  assert.ok(!details(mode).includes('marker-descriptive'));
  assert.ok(!details(mode).includes('>서술형</span>'), 'Removing the star must hide its explanation');
  assert.ok(details(mode).includes('>문장 삽입</span>'), 'Keep the other explanation');
  sentence.manualMarkerOverride = { orderLabels: [], descriptive: true, insert: false };
  assert.ok(details(mode).includes('>서술형</span>'), 'Rechecking restores the explanation');
  assert.ok(!details(mode).includes('>문장 삽입</span>'), 'Removing insertion marker hides its explanation');
  sentence.manualMarkerOverride = { orderLabels: [], descriptive: false, insert: false };
  assert.equal((details(mode).match(/class="point-item"/g) || []).length, 3);
}
sentence.useAutoMarks = false;
sentence.manualMarks = { vocab: ['beta'] };
assert.equal((details().match(/class="point-item"/g) || []).length, 1, 'Only the manually retained vocabulary explanation remains');
assert.ok(details().includes('>어휘</span>'));
assert.ok(!details().includes('>빈칸</span>') && !details().includes('>함축 의미</span>'));
sentence.useAutoMarks = true;
sentence.manualMarks = null;
sentence.manualMarkerOverride = null;

const renderTeacher = context.renderSentenceCards;
const renderStudent = context.renderStudentSentenceBlock;
context.renderSentenceCards = () => { throw new Error('Student output must not render teacher cards'); };
assert.ok(context.buildRecordSheetHtml(record, 'student', 'screen').includes('student-sheet'));
context.renderSentenceCards = renderTeacher;
context.renderStudentSentenceBlock = () => { throw new Error('Teacher output must not render student cards'); };
assert.ok(context.buildRecordSheetHtml(record, 'teacher', 'print').includes('sentence-list'));
context.renderStudentSentenceBlock = renderStudent;

const sample = JSON.parse(fs.readFileSync(path.join(__dirname, '../samples/MASTER_ANALYSIS.sample.json'), 'utf8'));
const sampleRecord = context.buildRecordFromJsonPassage(sample.PASSAGES[0], 0, 'public-sample');
assert.equal(sampleRecord.summary.oneSentence, '작은 습관과 연습은 학습을 돕는다.');
assert.equal(sampleRecord.sentences.flatMap(sentence => sentence.points).length, 3);
assert.equal((details().match(/class="point-item"/g) || []).length, 5, 'Restoring automatic marks restores all explanations');
assert.equal(JSON.stringify(sentence.points), sourcePoints, 'Hiding explanations must preserve imported points');
console.log('PASS: six star filters, teacher/student output, linked marker/explanation visibility, reversible edits, original data preserved');
