const { chromium } = require('playwright');
const fs = require('fs');

const allArticles = JSON.parse(fs.readFileSync('./articles.json', 'utf-8'));
const allStandups = JSON.parse(fs.readFileSync('./standups.json', 'utf-8'));

const MIN_DATE = new Date('2025-04-01');

// Filter out entries before April 1 2025 (wizard doesn't allow earlier dates)
const validStandups = allStandups
  .filter(s => new Date(s.date) >= MIN_DATE)
  .map(s => ({ ...s, type: 'standup' }));

// Fill remaining slots up to 24 with most recent articles
const needed = 24 - validStandups.length;
const validArticles = allArticles.slice(-needed).map(a => ({ ...a, type: 'blog' }));

const activities = [...validStandups, ...validArticles];
console.log(`Loaded ${activities.length} entries (${validStandups.length} standups + ${validArticles.length} articles)`);

const CONFIG = {
  startFromIndex: 16,
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
  console.log('  3. Click through the wizard until you reach the');
  console.log('     "Contributions" step — you see "Create Activity/Event"');
  console.log('  4. Press ENTER here — script takes over from there');
  console.log('='.repeat(60));

  await page.goto('https://mvp.microsoft.com/', { timeout: 60000, waitUntil: 'domcontentloaded' });

  await new Promise((resolve) => process.stdin.once('data', resolve));

  const total = activities.length;
  const today = new Date();
  const currentMonth = today.getMonth();
  const currentYear = today.getFullYear();

  let popupOpen = false;

  for (let i = CONFIG.startFromIndex; i < total; i++) {
    const item = activities[i];
    const { year, month, day } = parseDate(item.date);
    const monthName = getMonthName(month);
    const techArea = item.type === 'blog' ? item.techArea : '.NET';
    const isLast = i === total - 1;

    console.log(`\n[${i + 1}/${total}] ${item.type === 'blog' ? 'Blog' : 'Standup'}: ${item.title}`);
    console.log(`  Date: ${item.date} | Tech: ${techArea}`);

    try {
      // Open popup only if not already open (after Save and Create Another it stays open)
      if (!popupOpen) {
        await page.getByRole('button', { name: 'Create Activity/Event' }).click();
        await page.waitForTimeout(CONFIG.actionDelay);
      }
      popupOpen = true;

      // --- Activity Type ---
      await page.getByRole('combobox', { name: 'Activity Type' }).click();
      await page.waitForTimeout(500);
      await page.getByRole('option', { name: 'Speaker/Presenter at Third-' }).click();
      await page.waitForTimeout(CONFIG.actionDelay);

      // --- Primary Technology Area ---
      await page.getByRole('combobox', { name: 'Primary Technology Area' }).click();
      await page.waitForTimeout(500);
      await page.getByRole('option', { name: techArea }).click();
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
      await page.getByRole('textbox', { name: 'Private Description' }).click();
      await page.getByRole('textbox', { name: 'Private Description' }).fill(item.title);
      await page.waitForTimeout(500);

      // --- Date ---
      const targetMonthIndex = month - 1;
      let monthDiff = (currentYear - year) * 12 + (currentMonth - targetMonthIndex);

      // Debug: log all combobox names on first entry so we can identify the date field
      if (i === CONFIG.startFromIndex) {
        const comboboxes = await page.getByRole('combobox').all();
        const names = await Promise.all(comboboxes.map(cb => cb.getAttribute('aria-label').catch(() => cb.getAttribute('placeholder').catch(() => '?'))));
        console.log('  Combobox labels in form:', names);
      }

      // Try known date field labels
      let datePicker = null;
      for (const label of ['Published Date', 'Date', 'Activity Date', 'Event Date']) {
        try {
          const el = page.getByRole('combobox', { name: label });
          await el.waitFor({ timeout: 1500 });
          datePicker = el;
          break;
        } catch { /* try next */ }
      }

      if (datePicker) {
        await datePicker.click();
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
      } else {
        console.log(`  WARNING: date field not found — skipping date for entry ${i + 1}`);
      }
      await page.waitForTimeout(CONFIG.actionDelay);

      // --- Target Audience ---
      await page.getByLabel('Target Audience required').getByText('Select Target Audience').click();
      await page.waitForTimeout(500);
      await page.getByText('Developer').click();
      await page.waitForTimeout(CONFIG.actionDelay);

      // --- Livestream views ---
      await page.getByRole('spinbutton', { name: 'Livestream views' }).click();
      await page.getByRole('spinbutton', { name: 'Livestream views' }).fill('0');
      await page.waitForTimeout(300);

      // --- On-demand views ---
      await page.getByRole('spinbutton', { name: 'On-demand views' }).click();
      await page.getByRole('spinbutton', { name: 'On-demand views' }).fill('0');
      await page.waitForTimeout(300);

      // --- In-person attendees ---
      await page.getByRole('spinbutton', { name: 'In-person attendees' }).click();
      await page.getByRole('spinbutton', { name: 'In-person attendees' }).fill('0');
      await page.waitForTimeout(300);

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
        // Popup stays open for next entry
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
  console.log(`Done! Processed ${total - CONFIG.startFromIndex} entries.`);
  console.log('Press ENTER to close the browser.');
  console.log('='.repeat(60));

  await new Promise((resolve) => process.stdin.once('data', resolve));
  await browser.close();
})();
