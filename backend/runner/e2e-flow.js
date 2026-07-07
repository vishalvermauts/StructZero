import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SCREENSHOT_DIR = path.join(__dirname, 'screenshots');
const REPORT_PATH = path.join(__dirname, 'e2e-report.json');

if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

const UI_URL = 'http://localhost:5173';
const PASS = 'synapse-v8-secure';

const report = { timestamp: new Date().toISOString(), tests: [], summary: { passed: 0, failed: 0, warnings: 0 } };

function logTest(name, status, detail = '') {
  const emoji = status === 'PASS' ? '✅' : status === 'FAIL' ? '❌' : '⚠️';
  console.log(`${emoji} [${status}] ${name}${detail ? ': ' + detail : ''}`);
  report.tests.push({ name, status, detail, time: new Date().toISOString() });
  if (status === 'PASS') report.summary.passed++;
  else if (status === 'FAIL') report.summary.failed++;
  else report.summary.warnings++;
}

async function clickTab(page, testId) {
  await page.evaluate((id) => {
    const el = document.querySelector(`[data-testid="${id}"]`);
    if (el) el.click();
    else throw new Error(`Tab not found: ${id}`);
  }, testId);
  await page.waitForTimeout(800);
}

async function runE2E() {
  console.log('\n🤖 [E2E Bot] Launching IDE Architect Test Suite...\n');
  const browser = await chromium.launch({ headless: false, slowMo: 30 });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  page.on('pageerror', err => logTest('Browser JS Error', 'FAIL', err.message));

  try {
    // ─────────────────────────────────────────
    // TEST 1: Authentication
    // ─────────────────────────────────────────
    console.log('\n--- TEST 1: Authentication ---');
    await page.goto(UI_URL, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);

    const hasLogin = await page.locator('input[type="password"]').count() > 0;
    if (hasLogin) {
      await page.fill('input[type="password"]', PASS);
      await page.click('button:has-text("Access Dashboard")');
      await page.waitForTimeout(1500);
    }

    const hasNav = await page.locator('[data-testid="tab-architect"]').count() > 0;
    if (hasNav) {
      logTest('Authentication & Login', 'PASS', 'Dashboard loaded with navigation');
    } else {
      logTest('Authentication & Login', 'FAIL', 'Navigation not found after login');
    }
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '01_dashboard.png') });

    // ─────────────────────────────────────────
    // TEST 2: Settings Tab - Removed ACL test
    // ─────────────────────────────────────────
    console.log('\\n--- TEST 2: Settings ---');
    await clickTab(page, 'tab-settings');

    // ─────────────────────────────────────────
    // TEST 3: Settings – Save Button & API Key
    // ─────────────────────────────────────────
    console.log('\n--- TEST 3: Settings - Save Button ---');
    // The actual button text is "Save API Configuration"
    const saveBtn = page.locator('button:has-text("Save API Configuration")');
    const hasSave = await saveBtn.count() > 0;
    if (hasSave) {
      logTest('Save Settings Button Exists', 'PASS', '"Save API Configuration" found');
    } else {
      // Check for any save-like button
      const anySave = await page.locator('button').filter({ hasText: /save/i }).count();
      logTest('Save Settings Button Exists', anySave > 0 ? 'PASS' : 'FAIL', anySave > 0 ? 'Found a save button' : 'No save button found - UX issue');
    }

    // ─────────────────────────────────────────
    // TEST 4: Architect Tab – Prompt Input
    // ─────────────────────────────────────────
    console.log('\n--- TEST 4: Architect Tab – Prompt Generation ---');
    await clickTab(page, 'tab-architect');

    const textarea = page.locator('textarea').first();
    const hasTextarea = await textarea.count() > 0;
    if (!hasTextarea) {
      logTest('Architect Prompt Textarea', 'FAIL', 'No textarea found in Architect tab');
    } else {
      logTest('Architect Prompt Textarea', 'PASS');
      const testPrompt = 'Project Zeus: Build a task management system. Must use PostgreSQL. No MongoDB.';
      await textarea.fill(testPrompt);
      logTest('Prompt Text Entered', 'PASS', testPrompt);
    }

    const generateBtn = page.locator('button:has-text("Generate Blueprint")');
    const hasGenBtn = await generateBtn.count() > 0;
    if (hasGenBtn) {
      logTest('Generate Blueprint Button Exists', 'PASS', 'Button text: "Generate Blueprint"');
    } else {
      logTest('Generate Blueprint Button Exists', 'FAIL', 'Not found - check button text');
    }
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '03_architect_prompt.png') });

    // ─────────────────────────────────────────
    // TEST 4.5: Backend Health Check
    // ─────────────────────────────────────────
    console.log('\n--- TEST 4.5: Backend Health Check ---');
    try {
      const healthResp = await page.evaluate(() => fetch('http://localhost:3001/api/health').then(r => r.json()).catch(() => null));
      if (healthResp && healthResp.status === 'ok') {
        logTest('Backend Server Running', 'PASS', `Status: ${healthResp.status}`);
      } else {
        logTest('Backend Server Running', 'WARN', 'Health check returned unexpected response - generation may fail');
      }
    } catch(e) {
      logTest('Backend Server Running', 'FAIL', 'Cannot reach localhost:3001 - start the backend server');
    }
    console.log('\n--- TEST 5: Architecture Generation (lean mode, live API call) ---');
    if (hasGenBtn) {
      // Enable Lean Mode to skip DeepSeek and use Gemini Flash (much faster)
      console.log('[E2E Bot] Enabling Lean Mode to skip slow DeepSeek round...');
      const leanCheckbox = page.locator('input[type="checkbox"]').first();
      const isLean = await leanCheckbox.isChecked().catch(() => false);
      if (!isLean) {
        await leanCheckbox.check().catch(() => {});
        logTest('Lean Mode Enabled for Speed', 'PASS', 'Skipping DeepSeek round 3');
      } else {
        logTest('Lean Mode Already On', 'PASS', 'Using fast model');
      }
      await generateBtn.click();
      console.log('[E2E Bot] Waiting for generation (up to 2 minutes)...');
      const debateComplete = await page.waitForSelector('text=MULTI-AGENT DEBATE COMPLETE', { timeout: 120000, state: 'visible' }).catch(() => null);
      if (debateComplete) {
        logTest('Architecture Generation Completed', 'PASS', 'Debate Engine responded');
      } else {
        // Check if there's partial output
        const hasMermaidSvg = await page.locator('svg[id*="mermaid"], .mermaid svg').count() > 0;
        const hasFlowchartText = await page.getByText('flowchart', { exact: false }).count() > 0;
        const hasOutput = hasMermaidSvg || hasFlowchartText;
        if (hasOutput) {
          logTest('Architecture Generation Completed', 'WARN', 'Debate complete text not found but output present');
        } else {
          logTest('Architecture Generation Completed', 'FAIL', 'No output after 120s - DeepSeek may be rate-limited. Try enabling Lean Mode in Settings.');
        }
      }
      await page.waitForTimeout(2000);
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, '04_architecture_generated.png') });

      // Scroll down to see the full result area (diagram is below fold)
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await page.waitForTimeout(1500);
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, '04b_architecture_scrolled.png') });

      // Check Mermaid diagram rendered — it injects SVG inside div.mermaid-container
      const hasMermaid = await page.locator('.mermaid-container svg').count() > 0;
      if (hasMermaid) {
        logTest('Mermaid Diagram Rendered', 'PASS', 'SVG found inside .mermaid-container');
      } else {
        // Check for error state
        const hasMermaidError = await page.locator('.mermaid-container .text-red-500').count() > 0;
        logTest('Mermaid Diagram Rendered', 'FAIL', hasMermaidError ? 'Diagram error state shown - check mermaid syntax' : 'No SVG or error found in .mermaid-container');
      }

      // Copy button says just "Copy" with a Copy icon
      const hasCopyBtn = await page.locator('button:has-text("Copy")').count() > 0;
      logTest('Copy (Markdown) Button Visible', hasCopyBtn ? 'PASS' : 'FAIL', hasCopyBtn ? 'Found "Copy" button in toolbar' : 'Not found - may only appear after generation');

      // Check Project Name propagated
      const hasProjectName = await page.locator('text=Project Zeus').count() > 0;
      logTest('Project Name "Project Zeus" Visible', hasProjectName ? 'PASS' : 'WARN', hasProjectName ? '' : 'Project name not extracted from prompt');
    }

    // ─────────────────────────────────────────
    // TEST 6: Security Center Tab
    // ─────────────────────────────────────────
    console.log('\n--- TEST 6: Security Center ---');
    await clickTab(page, 'tab-security');
    
    const securityHeading = await page.locator('h2:has-text("Security Center")').count() > 0;
    logTest('Security Center Tab Loads', securityHeading ? 'PASS' : 'FAIL');
    
    const runSastBtn = page.locator('button:has-text("Run Manual SAST Scan")');
    const hasSast = await runSastBtn.count() > 0;
    logTest('Run SAST Scan Button Exists', hasSast ? 'PASS' : 'FAIL');
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '05_security_center.png') });

    // ─────────────────────────────────────────
    // TEST 7: Skills Library
    // ─────────────────────────────────────────
    console.log('\n--- TEST 7: Skills Library ---');
    await clickTab(page, 'tab-skills');
    const blueprintHeader = page.locator('h2:has-text("Skills Library")');
    const hasLibrary = await blueprintHeader.count() > 0;
    if (hasLibrary) {
      logTest('Skills Library Tab Loads', 'PASS');
    } else {
      logTest('Skills Library Tab Loads', 'FAIL', 'Header not found');
    }await page.screenshot({ path: path.join(SCREENSHOT_DIR, '06_blueprint_library.png') });

    // ─────────────────────────────────────────
    // TEST 8: Billing & Usage Tab
    // ─────────────────────────────────────────
    console.log('\n--- TEST 8: Billing & Usage ---');
    await clickTab(page, 'tab-billing');
    await page.waitForTimeout(1000);

    const billingHeading = await page.locator('h2:has-text("Billing"), h2:has-text("Usage")').count() > 0;
    logTest('Billing Tab Loads', billingHeading ? 'PASS' : 'WARN');

    // Check date-picker theme consistency
    const datePickers = await page.locator('input[type="date"]').count();
    if (datePickers > 0) {
      logTest('Date Pickers Present in Billing', 'PASS', `${datePickers} date input(s) found`);
    } else {
      logTest('Date Pickers Present in Billing', 'WARN', 'No date inputs found');
    }
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '07_billing.png') });

    // ─────────────────────────────────────────
    // TEST 9: How To Use Tab (Documentation)
    // ─────────────────────────────────────────
    console.log('\n--- TEST 9: Documentation / How To Use ---');
    await clickTab(page, 'tab-how-to-use');
    await page.waitForTimeout(800);
    
    const docContent = await page.locator('h1, h2, h3').count();
    logTest('Documentation Tab Has Content', docContent > 3 ? 'PASS' : 'WARN', `${docContent} headings found`);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '08_documentation.png') });

    // ─────────────────────────────────────────
    // FINAL SUMMARY
    // ─────────────────────────────────────────
    console.log('\n' + '═'.repeat(60));
    console.log('📊 E2E TEST SUMMARY');
    console.log('═'.repeat(60));
    console.log(`  ✅ PASSED:   ${report.summary.passed}`);
    console.log(`  ❌ FAILED:   ${report.summary.failed}`);
    console.log(`  ⚠️  WARNINGS: ${report.summary.warnings}`);
    console.log('═'.repeat(60));
    
    fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2));
    console.log(`\n📄 Full report saved: ${REPORT_PATH}`);
    console.log(`📸 Screenshots: ${SCREENSHOT_DIR}`);

  } catch (err) {
    console.error('[E2E Bot] Unexpected test crash:', err);
    logTest('Test Suite Crashed', 'FAIL', err.message);
    fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2));
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'error_dump.png') });
  } finally {
    await browser.close();
  }
}

runE2E();
