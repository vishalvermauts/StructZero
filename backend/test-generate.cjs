const http = require('http');

const req = http.request({
  hostname: 'localhost',
  port: 3001,
  path: '/api/generate',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-api-key': 'test'
  }
}, (res) => {
  res.on('data', (d) => {
    process.stdout.write(d);
  });
});

req.write(JSON.stringify({
  prompt: 'Test prompt',
  uiStyles: [],
  leanMode: true
}));
req.end();
