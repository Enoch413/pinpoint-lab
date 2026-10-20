// Local server running, then playwright-cli run-code --filename=tests/onboarding.browser.js
async page => {
  const check = (ok, message) => { if (!ok) throw new Error(message); };
  await page.goto('http://127.0.0.1:8761/app/index.html');
  check(await page.getByRole('main', { name: '학습지 미리보기' }).count() === 1, 'One named main landmark');
  check(await page.getByRole('heading', { level: 2, name: '분석 파일로 학습지를 만들어 보세요' }).isVisible(), 'First-use instructions');
  await page.keyboard.press('Tab');
  check(await page.getByRole('link', { name: '학습지 영역으로 건너뛰기' }).evaluate(el => el === document.activeElement), 'Skip link is first');
  await page.keyboard.press('Enter');
  check(await page.locator('#right').evaluate(el => el === document.activeElement), 'Skip link focuses main');
  await page.emulateMedia({ media: 'print' });
  check(await page.locator('.skip-link').evaluate(el => getComputedStyle(el).display === 'none'), 'Skip link stays out of printed output');
  await page.emulateMedia({ media: 'screen' });
  const sampleLink = page.getByRole('link', { name: '연습용 분석 JSON 다운로드' });
  const sampleUrl = await sampleLink.evaluate(el => el.href);
  const response = await page.request.get(sampleUrl);
  check(response.ok(), 'Public sample exists');
  const sample = await response.json();
  const downloadPromise = page.waitForEvent('download');
  await sampleLink.click();
  const download = await downloadPromise;
  check(download.suggestedFilename() === 'MASTER_ANALYSIS.sample.json', 'Sample download filename');
  await page.getByLabel('분석 JSON 업로드', { exact: false }).setInputFiles({ name: 'sample.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(sample)) });
  await page.locator('#gen-btn').click();
  await page.locator('#result-area').waitFor({ state: 'visible' });
  check(await page.getByRole('navigation', { name: '지문 선택' }).isVisible(), 'Named document navigation');
  check(await page.getByRole('group', { name: '학습지 보기 선택' }).isVisible(), 'Named view controls');
  check(await page.locator('#record-view h2.sheet-title').count() === 1, 'Document heading');
  check(await page.locator('#record-view h3.section-title').count() === 2, 'Summary and sentence headings');
  check((await page.locator('#record-view').textContent()).includes('작은 습관과 연습은 학습을 돕는다.'), 'Sample summary renders');
  await page.setViewportSize({ width: 375, height: 850 });
  for (const el of await page.locator('#record-view .sentence-edit-btn, #record-view .summary-edit-btn, #record-view .point-move-btn, #record-view .point-move-input, #view-tabs button, #record-tabs button, #point-star-filter, #record-label-input').all()) {
    const box = await el.boundingBox();
    check(box.width >= 44 && box.height >= 44, 'Touch control >=44px');
  }
  check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'No horizontal overflow');
  await page.locator('#record-view .sentence-edit-btn').first().click();
  for (const button of await page.locator('#sentence-edit-modal button').all()) check((await button.boundingBox()).height >= 44, 'Modal touch height');
  await page.keyboard.press('Escape');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  check(await page.locator('#loading .spin').evaluate(el => getComputedStyle(el).animationName === 'none'), 'Spinner stops for reduced motion');
  check(await page.locator('#gen-btn').evaluate(el => getComputedStyle(el).transitionDuration === '0s'), 'Reduced-motion transitions');
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  check(await page.locator('#loading .spin').evaluate(el => getComputedStyle(el).animationName !== 'none'), 'Normal spinner retained');
  const result = { passed: ['First-use sample download and import', 'Skip link, main, document navigation and heading hierarchy', '375px touch controls and modal buttons >=44px', 'Reduced motion without changing normal loading feedback'] };
  await page.evaluate(result => { window.onboardingRegressionResult = result; }, result);
  return result;
}
