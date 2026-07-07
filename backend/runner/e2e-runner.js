import { chromium } from 'playwright';

async function runTest() {
  const targetUrl = process.argv[2] || 'http://localhost:5173';
  console.log(JSON.stringify({ status: 'Starting', message: `Launching browser for ${targetUrl}` }));

  let browser;
  try {
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();

    const errors = [];
    const warnings = [];
    
    // Listen for console errors
    page.on('console', msg => {
      if (msg.type() === 'error') {
        warnings.push({ type: 'console', text: msg.text() });
      }
    });
    
    // Listen for uncaught exceptions
    page.on('pageerror', exception => {
      errors.push({ type: 'exception', text: exception.message });
    });

    console.log(JSON.stringify({ status: 'Running', message: `Navigating to ${targetUrl}` }));
    await page.goto(targetUrl, { waitUntil: 'networkidle' });
    
    // Test basic tab navigation on standard IDE Architect / generated apps
    // This is a generic heuristic: we look for common navigation elements.
    console.log(JSON.stringify({ status: 'Running', message: 'Looking for navigation elements...' }));
    
    const tabs = await page.$$('button, a, [role="tab"]');
    if (tabs.length > 0) {
      // Click up to 3 random tabs to test rendering
      const maxClicks = Math.min(3, tabs.length);
      for (let i = 0; i < maxClicks; i++) {
         try {
           await tabs[i].click({ timeout: 2000 });
           await page.waitForTimeout(500); // Give React time to render/crash
         } catch(e) {
           // Ignore unclickable elements
         }
      }
    }

    // Check the custom React Error Boundary global variable we inject
    const reactErrors = await page.evaluate(() => {
      return window.__REACT_RENDER_ERRORS__ || [];
    });
    
    reactErrors.forEach(err => {
      errors.push({ type: 'react-boundary', text: err.message, stack: err.componentStack });
    });

    const screenshotPath = process.argv[3];
    if (screenshotPath) {
      console.log(JSON.stringify({ status: 'Running', message: 'Capturing screenshot...' }));
      await page.screenshot({ path: screenshotPath, fullPage: true });
    }

    await browser.close();

    if (errors.length > 0) {
      console.log(JSON.stringify({ 
        status: 'Failed', 
        message: `${errors.length} errors caught during rendering`, 
        errors 
      }));
      process.exit(1);
    } else {
      console.log(JSON.stringify({ 
        status: 'Passed', 
        message: 'No rendering crashes detected. E2E test successful.', 
        errors: [] 
      }));
      process.exit(0);
    }

  } catch (err) {
    if (browser) await browser.close();
    console.log(JSON.stringify({ 
      status: 'Failed', 
      message: 'Test execution failed critically.', 
      errors: [{ type: 'system', text: err.message }]
    }));
    process.exit(1);
  }
}

runTest();
