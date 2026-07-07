import { chromium } from 'playwright';
import path from 'path';

async function run() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  
  await page.goto('http://localhost:5173');
  await page.waitForTimeout(1000);
  
  // Login
  await page.fill('input[type="password"]', 'synapse-v8-secure');
  await page.click('button:has-text("Access Dashboard")');
  await page.waitForTimeout(2000);
  
  // Settings Tab
  await page.locator('button', { hasText: 'Settings' }).click();
  await page.waitForTimeout(1000);
  await page.screenshot({ path: "C:\\Users\\mcmur\\.gemini\\antigravity\\brain\\83751be6-b9ec-43bf-8d7d-acb66f038727\\issue3_verified.png", fullPage: true });

  // Security Center Tab
  await page.locator('button', { hasText: 'Security Center' }).click();
  await page.waitForTimeout(1000);
  await page.screenshot({ path: "C:\\Users\\mcmur\\.gemini\\antigravity\\brain\\83751be6-b9ec-43bf-8d7d-acb66f038727\\issue4_verified.png", fullPage: true });

  // Billing & Usage Tab (Telemetry)
  await page.locator('button', { hasText: 'Billing & Usage' }).click();
  await page.waitForTimeout(1000);
  await page.screenshot({ path: "C:\\Users\\mcmur\\.gemini\\antigravity\\brain\\83751be6-b9ec-43bf-8d7d-acb66f038727\\issue2_verified.png", fullPage: true });
  
  const errors = await page.evaluate(() => window.__REACT_RENDER_ERRORS__ || []);
  if (errors.length > 0) {
    console.error("React Crashed:", errors);
  } else {
    console.log("No React crashes!");
  }
  
  await browser.close();
}
run();
