const http = require('http');

const data = JSON.stringify({
  prompt: "As the Architect Debate Engine, analyze these user feature requests for an IDE Builder Dashboard and propose a comprehensive UI/UX Implementation Plan:\n\n1. The WebSockets ticker at the bottom is too tiny and buried. Make it prominent and 'amazing' with effects.\n2. The Architect page lost its UI style selectors. Bring them back, and add new toggle modifiers: 'Zero-Bloatware Code (Concise)', 'Offline-First (Android)', and selectors for Color Patterns/Accessibility.\n3. For Telemetry: what other cards are useful? (e.g. estimated total API credit cost for an architecture).\n4. For Billing: How do we build the UI to view costs for prompts from 2 months ago (Historical Date Filtering)?\n\nOutline the React component structure, state management, and visual design for these features.",
  uiStyles: ["Clean Light Dashboard"]
});

const options = {
  hostname: 'localhost',
  port: 3001,
  path: '/api/generate',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(data)
  }
};

const req = http.request(options, (res) => {
  let body = '';
  res.on('data', (chunk) => { body += chunk; });
  res.on('end', () => {
    try {
       const parsed = JSON.parse(body);
       console.log(parsed.architecture);
    } catch(e) {
       console.log(body);
    }
  });
});

req.on('error', (e) => {
  console.error(`Problem with request: ${e.message}`);
});

req.write(data);
req.end();
