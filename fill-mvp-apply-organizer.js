const { chromium } = require('playwright');
const fs = require('fs');

const allStandups = JSON.parse(fs.readFileSync('./standups.json', 'utf-8'));

// All standups from April 2025 onwards
const activities = allStandups.filter(s => new Date(s.date) >= new Date('2025-04-01'));

console.log(`Loaded ${activities.length} standups as organizer events`);

const CONFIG = {
  startFromIndex: 0,
  actionDelay: 1500,
  entryDelay: 3000,
  timezone: 'Central America Standard Time',
  format: 'Online',
  type: 'Meetup',
  techArea: '.NET',
  endTime: '12:45 AM',
};

function parseDate(dateStr) {
  const [year, month, day] = dateStr.split('-').map(Number);
  return { year, month, day };
}

function getMonthName(month) {
  return ['January','February','March','April','May','June',
          'July','August','September','October','November','December'][month - 1];
}

async function pickDate(page, dateFieldComboboxName, year, month, day, currentYear, currentMonth) {
  const monthName = getMonthName(month);
  const targetMonthIndex = month - 1;
  const monthDiff = (currentYear - year) * 12 + (currentMonth - targetMonthIndex);

  // Try known labels for the date combobox
  let picker = null;
  for (const label of [dateFieldComboboxName, 'Start Date', 'End Date', 'Published Date', 'Date']) {
    try {
      const el = page.getByRole('combobox', { name: label });
      await el.waitFor({ timeout: 1500 });
      picker = el;
      break;
    } catch { /* try next */ }
  }

  if (!picker) {
    console.log(`  WARNING: date field "${dateFieldComboboxName}" not found`);
    return;
  }

  await picker.click();
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
  await page.waitForTimeout(500);
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
  console.log('  4. You will see TWO "Create Activity/Event" buttons');
  console.log('     Use the SECOND one (for organizer events)');
  console.log('  5. Press ENTER here — script takes over from there');
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
    const isLast = i === total - 1;

    console.log(`\n[${i + 1}/${total}] ${item.title}`);
    console.log(`  Date: ${item.date}`);

    try {
      // Open popup — second "Create Activity/Event" button is for organizer
      if (!popupOpen) {
        await page.getByRole('button', { name: 'Create Activity/Event' }).nth(1).click();
        await page.waitForTimeout(CONFIG.actionDelay);
      }
      popupOpen = true;

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

      // --- Target Audience ---
      await page.getByLabel('Target Audience required').getByText('Select Target Audience').click();
      await page.waitForTimeout(500);
      await page.getByText('Developer').click();
      await page.waitForTimeout(CONFIG.actionDelay);

      // --- Format ---
      await page.getByRole('combobox', { name: 'Format' }).click();
      await page.waitForTimeout(500);
      await page.getByRole('option', { name: CONFIG.format }).click();
      await page.waitForTimeout(CONFIG.actionDelay);

      // --- Type ---
      await page.getByRole('combobox', { name: 'Type' }).click();
      await page.waitForTimeout(500);
      await page.getByRole('option', { name: CONFIG.type }).click();
      await page.waitForTimeout(CONFIG.actionDelay);

      // --- Primary Technology Area ---
      await page.getByRole('button', { name: 'Primary Technology Area' }).click();
      await page.waitForTimeout(500);
      await page.getByRole('option', { name: CONFIG.techArea }).click();
      await page.waitForTimeout(CONFIG.actionDelay);

      // --- Time Zone ---
      await page.getByRole('combobox', { name: 'Time Zone' }).click();
      await page.waitForTimeout(500);
      await page.getByRole('option', { name: CONFIG.timezone }).click();
      await page.waitForTimeout(CONFIG.actionDelay);

      // --- Start Date ---
      await pickDate(page, 'Start Date', year, month, day, currentYear, currentMonth);
      await page.waitForTimeout(CONFIG.actionDelay);

      // --- End Time ---
      await page.getByRole('button', { name: 'End Time' }).click();
      await page.waitForTimeout(500);
      await page.getByRole('option', { name: CONFIG.endTime }).click();
      await page.waitForTimeout(CONFIG.actionDelay);

      // --- End Date (same day as start) ---
      await pickDate(page, 'End Date', year, month, day, currentYear, currentMonth);
      await page.waitForTimeout(CONFIG.actionDelay);

      // --- Event URL ---
      await page.getByRole('textbox', { name: 'Event URL' }).click();
      await page.getByRole('textbox', { name: 'Event URL' }).fill(item.url);
      await page.waitForTimeout(500);

      // --- Live Online Views ---
      await page.getByRole('textbox', { name: 'Live Online Views' }).click();
      await page.getByRole('textbox', { name: 'Live Online Views' }).fill('0');
      await page.waitForTimeout(300);

      // --- On-demand Views ---
      await page.getByRole('textbox', { name: 'On-demand Views' }).click();
      await page.getByRole('textbox', { name: 'On-demand Views' }).fill('0');
      await page.waitForTimeout(300);

      // --- Photos or Recording URL ---
      await page.getByRole('textbox', { name: 'Photos or Recording URL' }).click();
      await page.getByRole('textbox', { name: 'Photos or Recording URL' }).fill(item.url);
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
  console.log(`Done! Processed ${total - CONFIG.startFromIndex} entries.`);
  console.log('Press ENTER to close the browser.');
  console.log('='.repeat(60));

  await new Promise((resolve) => process.stdin.once('data', resolve));
  await browser.close();
})();
