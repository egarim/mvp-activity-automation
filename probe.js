const { chromium } = require('playwright');
(async () => {
  const b = await chromium.connectOverCDP('http://localhost:9333');
  const page = b.contexts()[0].pages()[0];
  const code = process.argv[2];
  console.log(JSON.stringify(await eval(`(async()=>{${code}})()`), null, 1));
  process.exit(0);
})();
