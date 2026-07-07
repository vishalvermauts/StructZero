import { chromium } from 'playwright';
import path from 'path';

async function run() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  
  await page.goto('http://localhost:5173');
  await page.evaluate(() => {
    localStorage.setItem('synapse_api_key', 'test_key');
  });
  await page.reload();
  await page.waitForTimeout(2000);
  await page.screenshot({ path: process.argv[2], fullPage: true });
  console.log("Screenshot taken before crash!");
  await browser.close();
  await page.waitForTimeout(1000); // Wait for transition
  await page.screenshot({ path: process.argv[2], fullPage: true });
  
  const errors = await page.evaluate(() => window.__REACT_RENDER_ERRORS__ || []);
  if (errors.length > 0) {
    console.error("React Crashed:", errors);
  } else {
    console.log("No React crashes!");
  }
  
  await browser.close();
}
run();
