const { chromium } = require('playwright');
const fs = require('fs');

// Load articles data
// ponytail: env knobs instead of editing CONFIG: DATA=path START=n LIMIT=n
const articles = JSON.parse(fs.readFileSync(process.env.DATA || './articles.json', 'utf-8'));

// Configuration
const CONFIG = {
  // ponytail: TYPE=video posts Shorts/standups as "Webinar/Online Training/Video/Livestream"; default is Blog.
  activityType: process.env.TYPE === 'video' ? 'Webinar/Online Training/Video/Livestream' : 'Blog',
  targetAudience: 'Developer',
  role: process.env.ROLE || (process.env.TYPE === 'video' ? 'Host' : 'Author'),
  numberOfViews: '0',
  // Set to the index of the article to start from (0-based)
  // Useful if the script stops midway and you need to resume
  startFromIndex: Number(process.env.START ?? 39),
  limit: Number(process.env.LIMIT ?? Infinity),
  // Delay between actions (ms) - increase if the portal is slow
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
  // Persistent profile: sign in once, later runs reuse the session (.mvp-profile is gitignored).
  const context = await chromium.launchPersistentContext('./.mvp-profile', {
    headless: false,
    slowMo: 300,
    viewport: { width: 1400, height: 900 },
    args: ['--remote-debugging-port=9333'],
  });
  const browser = context;
  const page = context.pages()[0] || await context.newPage();

  // ============================================================
  // STEP 1: Navigate to MVP portal and wait for manual login
  // ============================================================
  console.log('='.repeat(60));
  console.log('Opening MVP portal... Please log in manually.');
  console.log('Navigate to: My Account > Activities');
  console.log('Once you see the Activities page, press ENTER here.');
  console.log('='.repeat(60));

  await page.goto('https://mvp.microsoft.com/');
  // With a saved session, go straight to My Account > Activities; otherwise the user signs in and gets there.
  await page.goto('https://mvp.microsoft.com/en-US/account/').catch(() => {});
  await page.getByText('Activities', { exact: true }).first().click({ timeout: 15000 }).catch(() => {});

  // Wait (up to 30 min) until the user has signed in and opened Activities.
  await page.getByRole('button', { name: 'Add Activity' }).waitFor({ timeout: 30 * 60 * 1000 });
  console.log('Activities page detected, starting.');

  // ============================================================
  // STEP 2: Loop through articles and fill the form
  // ============================================================
  const total = articles.length;
  const today = new Date();
  const currentMonth = today.getMonth(); // 0-based
  const currentYear = today.getFullYear();

  const end = Math.min(total, CONFIG.startFromIndex + CONFIG.limit);
  for (let i = CONFIG.startFromIndex; i < end; i++) {
    const article = articles[i];
    const { year, month, day } = parseDate(article.date);
    const monthName = getMonthName(month);

    console.log(`\n[${i + 1}/${total}] Adding: ${article.title}`);
    console.log(`  Tech Area: ${article.techArea} | Date: ${article.date}`);

    try {
      // --- Add Activity ---
      await page.getByRole('button', { name: 'Add Activity' }).click();
      await page.waitForTimeout(CONFIG.actionDelay);

      // --- Activity Type -> Blog ---
      // The dropdown sometimes ignores the first click while the form is still loading: retry until the option shows.
      const typeOption = page.getByRole('option', { name: CONFIG.activityType, exact: true });
      for (let tries = 0; tries < 5 && !(await typeOption.isVisible().catch(() => false)); tries++) {
        await page.getByRole('button', { name: 'Activity Type' }).click();
        await page.waitForTimeout(1000);
      }
      await typeOption.click();
      await page.waitForTimeout(CONFIG.actionDelay);

      // --- Primary Technology Area ---
      await page.getByRole('combobox', { name: 'Primary Technology Area' }).click();
      await page.waitForTimeout(500);
      await page.getByRole('option', { name: article.techArea || process.env.TECH || '.NET' }).click();
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
      // Open the date picker
      await page.getByRole('combobox', { name: 'Published Date' }).click();
      await page.waitForTimeout(500);

      // Navigate to the correct month/year
      // The date picker opens to the current month
      // We need to go back (month - 1 is 0-based, so target is month-1)
      const targetMonthIndex = month - 1; // 0-based
      let monthDiff = (currentYear - year) * 12 + (currentMonth - targetMonthIndex);

      // Click "Up" button to go to month view, then navigate
      // Actually, based on the recording, we navigate by clicking left arrow
      // Let's use the month navigation approach
      if (monthDiff > 0) {
        // Need to go backwards
        for (let m = 0; m < monthDiff; m++) {
          await page.getByRole('button', { name: /^Go to previous month/ }).click();
          await page.waitForTimeout(300);
        }
      } else if (monthDiff < 0) {
        // Need to go forwards
        for (let m = 0; m < Math.abs(monthDiff); m++) {
          await page.getByRole('button', { name: /^Go to next month/ }).click();
          await page.waitForTimeout(300);
        }
      }

      // Click the day - try multiple patterns
      const dayPattern = `${day}, ${monthName},`;
      try {
        await page.getByRole('gridcell', { name: new RegExp(`^${day}, ${monthName}`) }).click();
      } catch {
        // Fallback: try button
        await page.getByRole('button', { name: new RegExp(`^${day}, ${monthName}`) }).click();
      }
      await page.waitForTimeout(CONFIG.actionDelay);

      // --- Role ---
      // Retry up to 3 times in case dropdown detaches
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

      // --- Number of views ---
      if (process.env.TYPE === 'video') {
        for (const [name, value] of [['Livestream views', '0'], ['Number of sessions', '1'], ['On-demand views', '0']]) {
          await page.getByRole('textbox', { name }).fill(value);
          await page.waitForTimeout(300);
        }
      } else {
        await page.getByRole('textbox', { name: 'Number of views' }).click();
        await page.getByRole('textbox', { name: 'Number of views' }).fill(CONFIG.numberOfViews);
        await page.waitForTimeout(500);
      }

      // --- Activity URL ---
      await page.getByRole('textbox', { name: 'Activity URL' }).click();
      await page.getByRole('textbox', { name: 'Activity URL' }).fill(article.url);
      await page.waitForTimeout(500);

      // --- Save ---
      await page.getByRole('button', { name: 'Save' }).click();
      await page.waitForTimeout(CONFIG.articleDelay);

      console.log(`  ✓ Saved successfully!`);
      // Track every saved entry (for picking the top activities later).
      fs.appendFileSync('posted.jsonl', JSON.stringify({ savedAt: new Date().toISOString(), data: process.env.DATA, index: i, ...article }) + '\n');

    } catch (error) {
      console.error(`  ✗ ERROR on article ${i + 1}: ${error.message}`);
      console.log(`  To resume later, set CONFIG.startFromIndex = ${i}`);

      // Try to cancel the current form
      try {
        const cancelBtn = page.getByRole('button', { name: 'Cancel' });
        if (await cancelBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
          await cancelBtn.click();
          await page.waitForTimeout(1000);
        }
      } catch (e) {
        // ignore
      }

      fs.appendFileSync('failed.log', `${i}\t${article.url}\t${error.message.split('\n')[0]}\n`);
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log(`Done! Processed ${end - CONFIG.startFromIndex} articles (failures, if any, in failed.log).`);
  console.log('='.repeat(60));

  await browser.close();
})();
