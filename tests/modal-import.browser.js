// With START.bat running: playwright-cli -s=pinpoint-regression open http://127.0.0.1:8761/app/index.html
// Then: playwright-cli -s=pinpoint-regression run-code --filename=tests/modal-import.browser.js
// If CLI yields at a native confirm, inspect the final result with: playwright-cli -s=pinpoint-regression eval 'window.pinpointRegressionResult'
async page => {
  const check = (condition, message) => { if (!condition) throw new Error(message); };
  const results = [];
  const passage = {
    '번호': '1', '지문': [{ '번호': '1', '영어': 'Alpha beta.' }, { '번호': '2', '영어': 'Keep this sentence.' }],
    '출제포인트': {
      '핵심 내용 재활용': { '영어_요약문': 'Alpha beta.' },
      '어휘 포인트': [{ '문장번호': '1', '별점': '★★', '표현': 'Alpha' }]
    }
  };
  const upload = async (payload, name = 'regression.json') => {
    await page.locator('#json-file').setInputFiles({
      name, mimeType: 'application/json', buffer: Buffer.from(typeof payload === 'string' ? payload : JSON.stringify(payload))
    });
    await page.locator('#gen-btn').click();
  };
  const original = { PASSAGES: [passage, { ...passage, '번호': '2' }] };
  await page.goto('http://127.0.0.1:8761/app/index.html');
  await page.evaluate(() => { window.pinpointRegressionResult = null; });
  await upload(original);
  await page.locator('#result-area').waitFor({ state: 'visible' });

  for (const [id, name, trigger] of [
    ['print-modal', '프린트 옵션', '#print-btn'],
    ['image-modal', '이미지 저장 옵션', '#image-btn'],
    ['sentence-edit-modal', '문장 표시 직접 수정', '#record-view .sentence-edit-btn'],
    ['summary-edit-modal', '영어 요약문 밑줄 수정', '#record-view .summary-edit-btn']
  ]) {
    const opener = page.locator(trigger).first();
    await opener.focus();
    await page.keyboard.press('Enter');
    const dialog = page.getByRole('dialog', { name, exact: true });
    await dialog.waitFor({ state: 'visible', timeout: 5000 });
    const bounds = await dialog.locator('.print-modal-card, .edit-modal-card').boundingBox();
    const viewport = page.viewportSize();
    check(bounds && bounds.x >= 0 && bounds.x + bounds.width <= viewport.width + 1 && bounds.y >= 0 && bounds.y + bounds.height <= viewport.height + 1, id + ': card must fit the viewport');
    check(await dialog.evaluate(el => el.contains(document.activeElement)), id + ': initial focus must be inside');
    const controls = dialog.locator('button, input, textarea, select, a[href]');
    await controls.first().focus();
    await page.keyboard.press('Shift+Tab');
    check(await controls.last().evaluate(el => el === document.activeElement), id + ': Shift+Tab must wrap');
    await page.keyboard.press('Tab');
    check(await controls.first().evaluate(el => el === document.activeElement), id + ': Tab must wrap');
    await page.evaluate(() => document.getElementById('gen-btn').focus());
    check(await dialog.evaluate(el => el.contains(document.activeElement)), id + ': background must be inert');
    await page.keyboard.press('Escape');
    await dialog.waitFor({ state: 'hidden' });
    check(await opener.evaluate(el => el === document.activeElement), id + ': Escape must restore trigger focus');
    await opener.press('Enter');
    await dialog.getByRole('button', { name: '취소', exact: true }).click();
    check(await opener.evaluate(el => el === document.activeElement), id + ': Cancel must restore trigger focus');
    results.push(id + ': name, initial focus, Tab/Shift+Tab, background inert, Escape and return focus');
  }

  // Saving rerenders the sheet, replacing the original trigger element.
  await page.locator('#record-view .sentence-edit-btn').first().click();
  await page.locator('#edit-vocab-targets').fill('beta');
  await page.locator('#sentence-edit-modal').getByRole('button', { name: '저장', exact: true }).click();
  check(await page.locator('#record-view .sentence-edit-btn').first().evaluate(el => el === document.activeElement), 'Sentence save must restore the new trigger');
  await page.locator('#record-view .summary-edit-btn').click();
  await page.locator('#summary-underline-a').fill('Alpha');
  await page.locator('#summary-edit-modal').getByRole('button', { name: '저장', exact: true }).click();
  check(await page.locator('#record-view .summary-edit-btn').evaluate(el => el === document.activeElement), 'Summary save must restore the new trigger');
  results.push('Editor save restores focus after sheet rerender');

  await page.locator('#record-tabs button').nth(1).click();
  await page.locator('#record-label-input').fill('수정한 지문 제목');
  await page.locator('#record-label-input').blur();
  await page.getByRole('button', { name: '학생용', exact: true }).click();
  await page.locator('#point-star-filter').selectOption('2');
  const before = await page.evaluate(() => ({ data: JSON.stringify(records), index: activeRecordIndex, view: activeViewMode, html: document.getElementById('record-view').innerHTML }));
  check(await page.evaluate(() => {
    const event = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(event);
    return event.defaultPrevented;
  }), 'Edited workspace must request a navigation warning');
  let confirmations = 0;
  let accept = false;
  const handleDialog = async dialog => {
    if (dialog.type() === 'confirm') {
      confirmations++;
      if (accept) await dialog.accept(); else await dialog.dismiss();
    } else await dialog.dismiss();
  };
  page.on('dialog', handleDialog);
  try {
    for (const [payload, filename] of [
      ['{ invalid', 'broken.json'],
      [{ PASSAGES: [] }, 'empty.json'],
      [{ PASSAGES: [{ ...passage, '지문': [{ '번호': '9'.repeat(309), '영어': 'Bad.' }] }] }, 'huge-number.json']
    ]) {
      await upload(payload, filename);
      await page.locator('#error-box').waitFor({ state: 'visible' });
      const after = await page.evaluate(() => ({ data: JSON.stringify(records), index: activeRecordIndex, view: activeViewMode, html: document.getElementById('record-view').innerHTML }));
      check(JSON.stringify(after) === JSON.stringify(before), filename + ': preserve data, selection and visible output');
      check(await page.locator('#result-area').isVisible(), filename + ': preserve visible result');
      check(await page.locator('#print-btn').isEnabled() && await page.locator('#image-btn').isEnabled(), filename + ': preserve export buttons');
      check((await page.locator('#error-box').textContent()).includes(filename), filename + ': identify failed file');
    }
    check(confirmations === 0, 'Invalid input must not prompt for edit disposal');
    await upload(original);
    await page.waitForFunction(() => !document.getElementById('gen-btn').disabled);
    check(confirmations === 1, 'Valid replacement must ask before discarding edits');
    check(await page.evaluate(() => records[1].label === '수정한 지문 제목' && activeRecordIndex === 1 && activeViewMode === 'student'), 'Cancel must preserve workspace');
    accept = true;
    await upload(original);
    await page.waitForFunction(() => !document.getElementById('gen-btn').disabled);
    check(confirmations === 2, 'Accept must confirm replacement');
    check(await page.evaluate(() => records[1].label === '지문 2' && activeRecordIndex === 0 && activeViewMode === 'teacher'), 'Accept must replace workspace');
    await upload(original);
    await page.waitForFunction(() => !document.getElementById('gen-btn').disabled);
    check(confirmations === 2, 'Unedited workspace must not prompt');
    check(await page.evaluate(() => {
      const event = new Event('beforeunload', { cancelable: true });
      window.dispatchEvent(event);
      return !event.defaultPrevented;
    }), 'Clean workspace must not request a navigation warning');
    results.push('Invalid/empty/huge input preserves edited workspace and exports; replacement cancel/accept; clean reload');
  } finally {
    page.removeListener('dialog', handleDialog);
  }
  // CLI may yield while a native confirm is being handled; keep the final result inspectable.
  await page.evaluate(passed => { window.pinpointRegressionResult = { passed }; }, results);
  return { passed: results };
}
