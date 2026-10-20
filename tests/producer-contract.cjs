// Supply local producer files as arguments; original material is neither copied nor printed.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../app/index.html'), 'utf8');
const script = [...source.matchAll(/<script>([\s\S]*?)<\/script>/g)].at(-1)[1];
const context = vm.createContext({ document: { getElementById() { return { addEventListener() {} }; } }, window: { addEventListener() {} } });
vm.runInContext(script, context);
assert.ok(process.argv.length > 2, 'Pass representative MASTER_ANALYSIS JSON paths');
for (const filename of process.argv.slice(2)) {
  const payload = JSON.parse(fs.readFileSync(filename, 'utf8').replace(/^\uFEFF/, ''));
  assert.ok(Array.isArray(payload.PASSAGES) && payload.PASSAGES.length);
  let sentences = 0;
  let points = 0;
  for (const [index, passage] of payload.PASSAGES.entries()) {
    const record = context.buildRecordFromJsonPassage(passage, index, path.basename(filename));
    sentences += record.sentences.length;
    points += record.sentences.reduce((sum, sentence) => sum + sentence.points.length, 0);
  }
  console.log(JSON.stringify({ file: path.basename(filename), passages: payload.PASSAGES.length, sentences, points, result: 'PASS' }));
}
