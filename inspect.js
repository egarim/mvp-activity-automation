// ponytail: throwaway probe, keeps the signed-in window open on CDP 9333 for 30 min
const { chromium } = require('playwright');
(async () => {
  const ctx = await chromium.launchPersistentContext('./.mvp-profile', { headless: false, viewport: { width: 1400, height: 900 }, args: ['--remote-debugging-port=9333'] });
  const page = ctx.pages()[0] || await ctx.newPage();
  await page.goto('https://mvp.microsoft.com/');
  await page.getByRole('button', { name: 'Add Activity' }).waitFor({ timeout: 30 * 60 * 1000 });
  console.log('READY ' + page.url());
  await page.waitForTimeout(30 * 60 * 1000);
  await ctx.close();
})();
