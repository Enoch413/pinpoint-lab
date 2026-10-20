// START.bat running, then playwright-cli -s=pinpoint-workflows open http://127.0.0.1:8761/app/index.html
// playwright-cli -s=pinpoint-workflows run-code --filename=tests/workflows.browser.js
async page => {
  const check = (ok, message) => { if (!ok) throw new Error(message); };
  const passed = [];
  const errors = [];
  const onError = error => errors.push(error.message);
  page.on('pageerror', onError);
  const passage = {
    '번호': '1', '지문': [{ '번호': '1', '영어': 'Alpha beta gamma constructor.' }, { '번호': '2', '영어': 'Another sentence for learning.' }],
    '출제포인트': {
      '핵심 내용 재활용': { '영어_요약문': 'Alpha beta gamma.' },
      '빈칸 포인트': [{ '문장번호': '(1)', '별점': '★☆☆', '핵심구절': 'Alpha', '출제이유': 'BLANK explanation' }],
      '어휘 포인트': [{ '문장번호': '(1)', '별점': '★★☆', '표현': 'beta', '왜_벗어나는가': 'VOCAB explanation' }],
      '함축 의미 포인트': [{ '문장번호': '(1)', '별점': '★★★', '핵심표현': 'gamma constructor', '함축의미': 'MEANING explanation' }],
      '문장 삽입 포인트': [{ '문장번호': '(1)', '별점': '★★★', '삽입후보문장': 'Alpha beta gamma constructor.', '출제이유': 'INSERT explanation' }],
      '서술형 포인트': [{ '문장번호': '(1)', '별점': '★★☆', '영어원문': 'Alpha beta gamma constructor.', '문법포인트설명': 'WRITTEN explanation' }]
    }
  };
  try {
    await page.evaluate(() => { window.workflowRegressionResult = null; });
    const allowTestNavigation = dialog => dialog.accept();
    page.on('dialog', allowTestNavigation);
    await page.goto('http://127.0.0.1:8761/app/index.html');
    page.removeListener('dialog', allowTestNavigation);
    await page.evaluate(() => { window.workflowRegressionResult = null; });
    await page.getByLabel('분석 JSON 업로드', { exact: false }).setInputFiles({
      name: 'workflow.json', mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify({ PASSAGES: [passage, { ...passage, '번호': '2' }] }))
    });
    await page.locator('#gen-btn').click();
    await page.locator('#result-area').waitFor({ state: 'visible' });
    check(await page.locator('#error-box').getAttribute('role') === 'alert', 'Errors need alert semantics');
    for (const id of ['json-status', 'success-box', 'loading', 'export-status']) {
      check(await page.locator('#' + id).getAttribute('role') === 'status', id + ': status semantics');
    }
    for (const input of await page.getByRole('spinbutton').all()) {
      check((await input.getAttribute('aria-label')).includes('포인트를 옮길 문장 번호'), 'Point destination needs a contextual name');
    }
    const contrast = await page.locator('#json-help').evaluate(el => {
      const rgb = value => value.match(/[\d.]+/g).slice(0, 3).map(Number);
      const luminance = values => values.map(value => {
        const c = value / 255;
        return c <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4;
      }).reduce((sum, value, index) => sum + value * [.2126, .7152, .0722][index], 0);
      const foreground = luminance(rgb(getComputedStyle(el).color));
      const background = luminance(rgb(getComputedStyle(el.closest('.left-card')).backgroundColor));
      return (Math.max(foreground, background) + .05) / (Math.min(foreground, background) + .05);
    });
    check(contrast >= 4.5, 'Visible helper text contrast must reach 4.5:1');
    const expected = { all: 5, '3': 2, '2': 2, '1': 1, '1-2': 3, '2-3': 4 };
    for (const [mode, label] of [['teacher', '교사용'], ['student', '학생용']]) {
      const button = page.getByRole('button', { name: label, exact: true });
      await button.focus();
      await page.keyboard.press('Enter');
      check(await page.locator(`[data-view-mode="${mode}"]`).evaluate(el => el === document.activeElement && el.getAttribute('aria-pressed') === 'true'), 'View switch must retain focus/state');
      for (const [filter, count] of Object.entries(expected)) {
        await page.locator('#point-star-filter').selectOption(filter);
        if (mode === 'teacher') check(await page.locator('#record-view .point-item').count() === count, 'Teacher filter ' + filter);
        check((await page.locator('#record-view').textContent()).includes('Another sentence for learning.'), 'Keep source text');
      }
    }
    await page.locator('#point-star-filter').selectOption('all');
    await page.locator('[data-record-index="1"]').focus();
    await page.keyboard.press('Enter');
    check(await page.locator('[data-record-index="1"]').evaluate(el => el === document.activeElement && el.getAttribute('aria-pressed') === 'true'), 'Record switch must retain focus/state');
    await page.locator('[data-record-index="0"]').click();
    passed.push('Accessible input/status names, keyboard switches, six filters in teacher/student views');

    const pngSizes = [];
    for (const width of [375, 1280]) {
      await page.setViewportSize({ width, height: 850 });
      if (width === 375) {
        const body = await page.locator('#record-view .student-sentence-row .sentence-text').first().boundingBox();
        check(body.width >= 200, 'Mobile student text needs at least 200px in this viewport');
        check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Mobile page must fit');
      }
      pngSizes.push(await page.evaluate(async () => {
        const blob = await renderStudentSheetToBlob(records[0], getStudentCaptureWidth());
        const bytes = new DataView(await blob.arrayBuffer());
        return [bytes.getUint32(16), bytes.getUint32(20)];
      }));
    }
    check(pngSizes.every(size => size[0] === 794), 'Student PNG width must be independent of viewport');
    check(pngSizes[0][1] === pngSizes[1][1], 'Student PNG layout must be independent of viewport');
    passed.push('Mobile readable text and actual student PNG dimensions at 375px/1280px');

    await page.getByRole('button', { name: '교사용', exact: true }).click();
    await page.locator('#record-view .sentence-edit-btn').nth(1).click();
    await page.locator('#edit-order-labels').fill('(A)');
    await page.locator('#sentence-edit-modal').getByRole('button', { name: '저장', exact: true }).click();
    for (const type of ['문장 삽입', '서술형']) {
      const destination = page.getByRole('spinbutton', { name: new RegExp('문장 1의 ' + type) });
      await destination.fill('2');
      await destination.locator('..').getByRole('button', { name: '이동', exact: true }).click();
      check(await page.getByRole('spinbutton', { name: new RegExp('문장 2의 ' + type) }).evaluate(el => el === document.activeElement), 'Moving a point must preserve keyboard position');
    }
    const destinationCard = page.locator('#record-view .sentence-card').nth(1);
    check((await destinationCard.textContent()).includes('INSERT explanation') && (await destinationCard.textContent()).includes('WRITTEN explanation'), 'Moved points must remain visible after unrelated order edit');
    await page.locator('#record-view .sentence-edit-btn').first().click();
    await page.locator('#edit-use-auto-marks').uncheck();
    await page.locator('#edit-vocab-targets').fill('BETA');
    await page.locator('#sentence-edit-modal').getByRole('button', { name: '저장', exact: true }).click();
    check((await page.locator('#record-view').textContent()).includes('VOCAB explanation'), 'Case-insensitive manual target must retain explanation');
    await page.locator('#record-view .sentence-edit-btn').first().click();
    await page.locator('#edit-vocab-targets').fill('absent phrase');
    await page.locator('#sentence-edit-modal').getByRole('button', { name: '저장', exact: true }).click();
    check(await page.locator('#sentence-edit-modal').isVisible(), 'Unmatched manual target must keep editor open');
    check(await page.locator('#edit-vocab-targets').getAttribute('aria-invalid') === 'true', 'Invalid target identified');
    check((await page.locator('#edit-vocab-targets-feedback').textContent()).includes('absent phrase'), 'Unmatched target needs feedback');
    await page.locator('#edit-vocab-targets').fill('beta');
    await page.locator('#sentence-edit-modal').getByRole('button', { name: '저장', exact: true }).click();
    await page.locator('#record-view .summary-edit-btn').click();
    await page.locator('#summary-underline-a').fill('absent summary');
    await page.locator('#summary-edit-modal').getByRole('button', { name: '저장', exact: true }).click();
    check(await page.locator('#summary-edit-modal').isVisible(), 'Unmatched summary target must keep editor open');
    await page.locator('#summary-underline-a').fill('alpha');
    await page.locator('#summary-edit-modal').getByRole('button', { name: '저장', exact: true }).click();
    passed.push('Move with partial overrides, case-consistent explanations and recoverable matching feedback');

    // Hold a canvas call to reproduce the audited race without depending on machine speed.
    await page.evaluate(() => {
      window.workflowOriginalCanvas = html2canvas;
      window.workflowOriginalDownload = downloadBlob;
      window.workflowCaptures = []; window.workflowDownloads = [];
      html2canvas = async element => {
        workflowCaptures.push({ student: !!element.querySelector('.student-sheet'), points: element.querySelectorAll('.point-item').length });
        if (workflowCaptures.length === 1) await new Promise(resolve => { window.workflowResume = resolve; });
        return { toBlob(callback) { callback(new Blob(['synthetic timing test'], { type: 'image/png' })); } };
      };
      downloadBlob = (blob, name) => workflowDownloads.push(name);
      window.workflowPending = startImageExport('all');
    });
    await page.waitForFunction(() => typeof window.workflowResume === 'function');
    check(await page.locator('[data-view-mode="student"]').isDisabled(), 'Lock view while exporting');
    check(await page.locator('#point-star-filter').isDisabled(), 'Lock filter while exporting');
    check(await page.locator('#gen-btn').isDisabled(), 'Lock reimport while exporting');
    await page.locator('[data-view-mode="student"]').evaluate(el => el.click());
    const race = await page.evaluate(async () => {
      workflowResume();
      try { await workflowPending; return { mode: activeViewMode, captures: workflowCaptures, names: workflowDownloads }; }
      finally { html2canvas = workflowOriginalCanvas; downloadBlob = workflowOriginalDownload; }
    });
    check(race.mode === 'teacher' && race.captures.every(capture => !capture.student) && race.names.every(name => name.includes('교사용')), 'One export batch must retain its view and names');
    check(await page.locator('#point-star-filter').isEnabled() && await page.locator('#gen-btn').isEnabled(), 'Unlock controls after export');
    passed.push('Delayed PNG export freezes controls, view and filenames, then restores controls');
    const failureRestored = await page.evaluate(async () => {
      const original = html2canvas;
      html2canvas = async () => { throw new Error('Synthetic export failure'); };
      try { await startImageExport('current'); }
      finally { html2canvas = original; }
      return !document.getElementById('image-btn').disabled && !document.getElementById('gen-btn').disabled && !document.getElementById('point-star-filter').disabled;
    });
    check(failureRestored, 'Failed PNG export must restore controls');
    passed.push('Failed PNG export restores controls; measured helper contrast >=4.5:1');

    await page.setViewportSize({ width: 375, height: 850 });
    await page.locator('#record-label-input').fill('A'.repeat(220));
    await page.locator('#record-label-input').blur();
    const title = await page.locator('[data-record-index="0"]').boundingBox();
    check(title.x + title.width <= 376, 'Long unbroken title must wrap inside viewport');
    check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Long title must not expand page');
    check(errors.length === 0, 'No application exceptions: ' + errors.join('; '));
    passed.push('Long-title boundary and no application exceptions');
    const result = { passed, pngSizes, contrast };
    await page.evaluate(result => { window.workflowRegressionResult = result; }, result);
    return result;
  } finally {
    page.removeListener('pageerror', onError);
  }
}
