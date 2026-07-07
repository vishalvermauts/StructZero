import fs from 'fs';

const filePath = 'server.js';
let content = fs.readFileSync(filePath, 'utf-8');

// Normalize line endings to \n
content = content.replace(/\r\n/g, '\n');

// Find all matches of: const profilePrompt = ... ;
// We want to match it and the following if statement:
// if (pTopicMatch ... ) { ... }
const regex = /const profilePrompt =[\s\S]*?if\s*\(pTopicMatch[\s\S]*?addMemory[\s\S]*?\n\s*\}/g;

if (regex.test(content)) {
  content = content.replace(regex, '');
  fs.writeFileSync(filePath, content, 'utf-8');
  console.log("Patched server.js successfully using regex!");
} else {
  console.log("Regex did not match profilePrompt block.");
}
