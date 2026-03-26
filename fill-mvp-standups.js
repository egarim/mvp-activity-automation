const { chromium } = require('playwright');
const fs = require('fs');

// Load standups data
const articles = JSON.parse(fs.readFileSync('./standups.json', 'utf-8'));

// Configuration
const CONFIG = {
  activityType: 'Webinar/Online Training',
  techArea: '.NET',
  targetAudience: 'Developer',
  role: 'Host',
  livestreamViews: '0',
  numberOfSessions: '1',
  onDemandViews: '0',
  // Set to the index to start from (0-based)
  startFromIndex: 0,
  // Delay between actions (ms)
  actionDelay: 1500,
  // Delay between articles (ms)
  articleDelay: 3000,
};

function parseDate(dateStr) {
  const [year, month, day] = dateStr.split('-').map(Number);
  return { year, month, day };
}

function getMonthName(month) {
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  return months[month - 1];
}

(async () => {
  const browser = await chromium.launch({
    headless: false,
    slowMo: 300,
  });

  const context = await browser.newContext({
    viewport: { width: 1400, height: 900 },
  });

  const page = await context.newPage();

  // ============================================================
  // STEP 1: Navigate to MVP portal and wait for manual login
  // ============================================================
  console.log('='.repeat(60));
  console.log('Opening MVP portal... Please log in manually.');
  console.log('Navigate to: My Account > Activities');
  console.log('Once you see the Activities page, press ENTER here.');
  console.log('='.repeat(60));

  await page.goto('https://mvp.microsoft.com/');

  // Wait for user to log in and navigate to Activities
  await new Promise((resolve) => {
    process.stdin.once('data', resolve);
  });

  // ============================================================
  // STEP 2: Loop through standups and fill the form
  // ============================================================
  const total = articles.length;
  const today = new Date();
  const currentMonth = today.getMonth(); // 0-based
  const currentYear = today.getFullYear();

  for (let i = CONFIG.startFromIndex; i < total; i++) {
    const article = articles[i];
    const { year, month, day } = parseDate(article.date);
    const monthName = getMonthName(month);

    console.log(`\n[${i + 1}/${total}] Adding: ${article.title}`);
    console.log(`  Date: ${article.date}`);

    try {
      // --- Add Activity ---
      await page.getByRole('button', { name: 'Add Activity' }).click();
      await page.waitForTimeout(CONFIG.actionDelay);

      // --- Activity Type ---
      await page.getByRole('button', { name: 'Activity Type' }).click();
      await page.waitForTimeout(500);
      await page.getByRole('option', { name: CONFIG.activityType }).click();
      await page.waitForTimeout(CONFIG.actionDelay);

      // --- Primary Technology Area ---
      await page.getByRole('combobox', { name: 'Primary Technology Area' }).click();
      await page.waitForTimeout(500);
      await page.getByRole('option', { name: CONFIG.techArea }).click();
      await page.waitForTimeout(CONFIG.actionDelay);

      // --- Title ---
      await page.getByRole('textbox', { name: 'Title' }).click();
      await page.getByRole('textbox', { name: 'Title' }).fill(article.title);
      await page.waitForTimeout(500);

      // --- Description ---
      await page.getByRole('textbox', { name: 'Description', exact: true }).click();
      await page.getByRole('textbox', { name: 'Description', exact: true }).fill(article.title);
      await page.waitForTimeout(500);

      // --- Target Audience ---
      await page.getByLabel('Target Audience required').getByText('Select Target Audience').click();
      await page.waitForTimeout(500);
      await page.getByLabel('Target Audience required').getByText(CONFIG.targetAudience).click();
      await page.waitForTimeout(CONFIG.actionDelay);

      // --- Published Date ---
      await page.getByRole('combobox', { name: 'Published Date' }).click();
      await page.waitForTimeout(500);

      const targetMonthIndex = month - 1;
      let monthDiff = (currentYear - year) * 12 + (currentMonth - targetMonthIndex);

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
          await page.getByPlaceholder('Select Role').click();
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

      // --- Livestream views ---
      await page.getByRole('textbox', { name: 'Livestream views' }).click();
      await page.getByRole('textbox', { name: 'Livestream views' }).fill(CONFIG.livestreamViews);
      await page.waitForTimeout(500);

      // --- Number of sessions ---
      await page.getByRole('textbox', { name: 'Number of sessions' }).click();
      await page.getByRole('textbox', { name: 'Number of sessions' }).fill(CONFIG.numberOfSessions);
      await page.waitForTimeout(500);

      // --- On-demand views ---
      await page.getByRole('textbox', { name: 'On-demand views' }).click();
      await page.getByRole('textbox', { name: 'On-demand views' }).fill(CONFIG.onDemandViews);
      await page.waitForTimeout(500);

      // --- Activity URL ---
      await page.getByRole('textbox', { name: 'Activity URL' }).click();
      await page.getByRole('textbox', { name: 'Activity URL' }).fill(article.url);
      await page.waitForTimeout(500);

      // --- Save ---
      await page.getByRole('button', { name: 'Save' }).click();
      await page.waitForTimeout(CONFIG.articleDelay);

      console.log(`  ✓ Saved successfully!`);

    } catch (error) {
      console.error(`  ✗ ERROR on article ${i + 1}: ${error.message}`);
      console.log(`  To resume later, set CONFIG.startFromIndex = ${i}`);

      try {
        const cancelBtn = page.getByRole('button', { name: 'Cancel' });
        if (await cancelBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
          await cancelBtn.click();
          await page.waitForTimeout(1000);
        }
      } catch (e) {
        // ignore
      }

      console.log('  Press ENTER to continue with the next article, or Ctrl+C to stop.');
      await new Promise((resolve) => {
        process.stdin.once('data', resolve);
      });
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log(`Done! Processed ${total - CONFIG.startFromIndex} standups.`);
  console.log('Press ENTER to close the browser.');
  console.log('='.repeat(60));

  await new Promise((resolve) => {
    process.stdin.once('data', resolve);
  });

  await browser.close();
})();
