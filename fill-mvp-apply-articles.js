const { chromium } = require('playwright');
const fs = require('fs');

const allArticles = JSON.parse(fs.readFileSync('./articles.json', 'utf-8'));

// 12 AI articles (Microsoft Foundry) + 4 software dev articles = 16 total
const aiArticles = allArticles.filter(a => a.techArea === 'Microsoft Foundry');

const softwareDevArticles = [
  allArticles[10], // Testing SignalR Applications with Integration Tests
  allArticles[18], // Understanding the N+1 Database Problem Using Entity Framework Core
  allArticles[39], // ConfigureAwait(false): Why It Exists...
  allArticles[43], // As an XAF Developer, What Should I Actually Test?
].map(a => ({ ...a, techArea: '.NET' }));

const activities = [...aiArticles, ...softwareDevArticles];

console.log(`Loaded ${activities.length} articles (${aiArticles.length} AI + ${softwareDevArticles.length} software dev)`);

const CONFIG = {
  startFromIndex: 15,
  targetAudience: 'Developer',
  role: 'Author',
  numberOfViews: '0',
  actionDelay: 1500,
  entryDelay: 3000,
};

function parseDate(dateStr) {
  const [year, month, day] = dateStr.split('-').map(Number);
  return { year, month, day };
}

function getMonthName(month) {
  return ['January','February','March','April','May','June',
          'July','August','September','October','November','December'][month - 1];
}

(async () => {
  const browser = await chromium.launch({ headless: false, slowMo: 300 });
  const context = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  const page = await context.newPage();

  console.log('='.repeat(60));
  console.log('Opening MVP portal...');
  console.log('');
  console.log('Steps:');
  console.log('  1. Log in with your Microsoft account');
  console.log('  2. Go to: https://mvp.microsoft.com/en-US/mvp/apply');
  console.log('  3. Navigate to the Contributions step');
  console.log('  4. Press ENTER here — script answers the dropdown and');
  console.log('     fills all 16 articles automatically');
  console.log('='.repeat(60));

  await page.goto('https://mvp.microsoft.com/', { timeout: 60000, waitUntil: 'domcontentloaded' });

  await new Promise((resolve) => process.stdin.once('data', resolve));

  const total = activities.length;
  const today = new Date();
  const currentMonth = today.getMonth();
  const currentYear = today.getFullYear();

  // One-time setup: answer "Have you shared your expertise..." dropdown
  try {
    const expertiseDropdown = page.getByRole('combobox', { name: /have you shared your expertise/i });
    if (await expertiseDropdown.isVisible({ timeout: 3000 }).catch(() => false)) {
      await expertiseDropdown.click();
      await page.waitForTimeout(500);
      await page.getByRole('option', { name: 'Yes' }).click();
      await page.waitForTimeout(CONFIG.actionDelay);
      console.log('  ✓ Answered expertise question');
    }
  } catch { /* already answered or not present */ }

  let popupOpen = false;

  for (let i = CONFIG.startFromIndex; i < total; i++) {
    const item = activities[i];
    const { year, month, day } = parseDate(item.date);
    const monthName = getMonthName(month);
    const isLast = i === total - 1;

    console.log(`\n[${i + 1}/${total}] Blog: ${item.title}`);
    console.log(`  Date: ${item.date} | Tech: ${item.techArea}`);

    try {
      // Open popup — third "Create Activity/Event" button (nth(2), 0-indexed)
      if (!popupOpen) {
        await page.getByRole('button', { name: 'Create Activity/Event' }).nth(2).click();
        await page.waitForTimeout(CONFIG.actionDelay);
      }
      popupOpen = true;

      // --- Activity Type (button on first open, combobox after Save and Create Another) ---
      try {
        await page.getByRole('button', { name: 'Activity Type' }).click({ timeout: 3000 });
      } catch {
        await page.getByRole('combobox', { name: 'Activity Type' }).click();
      }
      await page.waitForTimeout(500);
      await page.getByRole('option', { name: 'Blog' }).click();
      await page.waitForTimeout(CONFIG.actionDelay);

      // --- Primary Technology Area ---
      await page.getByRole('button', { name: 'Primary Technology Area' }).click();
      await page.waitForTimeout(500);
await page.getByRole('option', { name: item.techArea }).click();
      await page.waitForTimeout(CONFIG.actionDelay);

      // --- Title ---
      await page.getByRole('textbox', { name: 'Title' }).click();
      await page.getByRole('textbox', { name: 'Title' }).fill(item.title);
      await page.waitForTimeout(500);

      // --- Description ---
      await page.getByRole('textbox', { name: 'Description', exact: true }).click();
      await page.getByRole('textbox', { name: 'Description', exact: true }).fill(item.title);
      await page.waitForTimeout(500);

      // --- Private Description ---
      try {
        const privateDesc = page.getByRole('textbox', { name: 'Private Description' });
        if (await privateDesc.isVisible({ timeout: 1500 }).catch(() => false)) {
          await privateDesc.click();
          await privateDesc.fill(item.title);
          await page.waitForTimeout(500);
        }
      } catch { /* field may not exist */ }

      // --- Target Audience ---
      await page.getByLabel('Target Audience required').getByText('Select Target Audience').click();
      await page.waitForTimeout(500);
      await page.getByLabel('Target Audience required').getByText('Developer').click();
      await page.waitForTimeout(CONFIG.actionDelay);

      // --- Published Date ---
      const targetMonthIndex = month - 1;
      const monthDiff = (currentYear - year) * 12 + (currentMonth - targetMonthIndex);

      await page.getByRole('combobox', { name: 'Published Date' }).click();
      await page.waitForTimeout(500);

      if (monthDiff > 0) {
        for (let m = 0; m < monthDiff; m++) {
          await page.getByRole('button', { name: /^Go to previous month/ }).click();
          await page.waitForTimeout(300);
        }
      } else if (monthDiff < 0) {
        for (let m = 0; m < Math.abs(monthDiff); m++) {
          await page.getByRole('button', { name: /^Go to next month/ }).click();
          await page.waitForTimeout(300);
        }
      }

      try {
        await page.getByRole('gridcell', { name: new RegExp(`^${day}, ${monthName}`) }).click();
      } catch {
        await page.getByRole('button', { name: new RegExp(`^${day}, ${monthName}`) }).click();
      }
      await page.waitForTimeout(CONFIG.actionDelay);

      // --- Role ---
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          await page.getByRole('combobox', { name: 'Role' }).click();
          await page.waitForTimeout(1000);
          await page.getByRole('option', { name: CONFIG.role }).click({ timeout: 5000 });
          break;
        } catch (e) {
          if (attempt === 2) throw e;
          console.log(`  Retrying Role selection (attempt ${attempt + 2})...`);
          await page.waitForTimeout(1000);
        }
      }
      await page.waitForTimeout(CONFIG.actionDelay);

      // --- Number of views ---
      await page.getByRole('spinbutton', { name: 'Number of views' }).click();
      await page.getByRole('spinbutton', { name: 'Number of views' }).fill(CONFIG.numberOfViews);
      await page.waitForTimeout(500);

      // --- Activity URL ---
      await page.getByRole('textbox', { name: 'Activity URL' }).click();
      await page.getByRole('textbox', { name: 'Activity URL' }).fill(item.url);
      await page.waitForTimeout(500);

      // --- Save ---
      if (isLast) {
        await page.getByRole('button', { name: 'Save', exact: true }).click();
        popupOpen = false;
      } else {
        await page.getByRole('button', { name: 'Save and Create Another' }).click();
        await page.waitForTimeout(CONFIG.entryDelay);
      }

      console.log(`  ✓ Saved!`);

    } catch (error) {
      console.error(`  ✗ ERROR on entry ${i + 1}: ${error.message}`);
      console.log(`  To resume, set CONFIG.startFromIndex = ${i}`);
      popupOpen = false;

      try {
        const cancelBtn = page.getByRole('button', { name: 'Cancel' });
        if (await cancelBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
          await cancelBtn.click();
          await page.waitForTimeout(1000);
        }
      } catch { /* ignore */ }

      console.log('  Press ENTER to continue with next entry, or Ctrl+C to stop.');
      await new Promise((resolve) => process.stdin.once('data', resolve));
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log(`Done! Processed ${total - CONFIG.startFromIndex} articles.`);
  console.log('Press ENTER to close the browser.');
  console.log('='.repeat(60));

  await new Promise((resolve) => process.stdin.once('data', resolve));
  await browser.close();
})();
