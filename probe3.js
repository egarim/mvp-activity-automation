const { chromium } = require('playwright');
(async () => {
  const b = await chromium.connectOverCDP('http://localhost:9333');
  const page = await b.contexts()[0].newPage();
  try {
    await page.goto('https://mvp.microsoft.com/en-US/account/'); await page.waitForTimeout(5000);
    await page.getByText('Activities', { exact: true }).first().click();
    await page.getByRole('button', { name: 'Add Activity' }).click(); await page.waitForTimeout(2500);
    const opt = page.getByRole('option', { name: 'Open Source/Project/Sample code/Tools', exact: true });
    for (let i = 0; i < 5 && !(await opt.isVisible().catch(() => false)); i++) { await page.getByRole('button', { name: 'Activity Type' }).click(); await page.waitForTimeout(1000); }
    await opt.click(); await page.waitForTimeout(2000);
    await page.getByRole('combobox', { name: 'Start Date' }).click(); await page.waitForTimeout(1000);
    const heading = await page.locator('[role=dialog], .ms-Callout, .ms-DatePicker').last().innerText().catch(()=>'' );
    console.log('START PICKER:', heading.slice(0, 300).replace(/\n/g,' | '));
    await page.getByRole('button', { name: /^Go to previous month/ }).click(); await page.waitForTimeout(500);
    await page.getByRole('gridcell', { name: /^15, / }).first().click(); await page.waitForTimeout(800);
    console.log('START VALUE:', await page.getByRole('combobox', { name: 'Start Date' }).innerText());
    await page.getByRole('combobox', { name: 'End Date' }).click(); await page.waitForTimeout(1000);
    const h2 = await page.locator('[role=dialog], .ms-Callout, .ms-DatePicker').last().innerText().catch(()=>'' );
    console.log('END PICKER:', h2.slice(0, 200).replace(/\n/g,' | '));
    await page.keyboard.press('Escape');
  } finally { await page.close(); process.exit(0); }
})();
