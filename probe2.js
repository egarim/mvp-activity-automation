const { chromium } = require('playwright');
(async () => {
  const b = await chromium.connectOverCDP('http://localhost:9333');
  const ctx = b.contexts()[0];
  const page = await ctx.newPage();
  try {
    await page.goto('https://mvp.microsoft.com/en-US/account/');
    await page.waitForTimeout(5000);
    await page.getByText('Activities', { exact: true }).first().click();
    await page.getByRole('button', { name: 'Add Activity' }).click();
    await page.waitForTimeout(2500);
    const opt = page.getByRole('option', { name: process.argv[2], exact: true });
    for (let i = 0; i < 5 && !(await opt.isVisible().catch(() => false)); i++) { await page.getByRole('button', { name: 'Activity Type' }).click(); await page.waitForTimeout(1000); }
    await opt.click(); await page.waitForTimeout(2500);
    const fields = await page.locator('input, textarea, [role=combobox], button').evaluateAll(es => es.filter(e => e.offsetParent).map(e => [e.tagName, e.getAttribute('role'), e.getAttribute('aria-label') || e.getAttribute('placeholder') || e.innerText?.trim().slice(0, 40)].join(' | ')));
    console.log(fields.join('\n'));
    await page.getByPlaceholder('Select Role').click().catch(() => {}); await page.waitForTimeout(1500);
    console.log('ROLES:', await page.getByRole('option').allInnerTexts());
  } finally { await page.close(); process.exit(0); }
})();
