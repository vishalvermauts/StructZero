import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mcpCode = fs.readFileSync(path.join(__dirname, 'mcp.js'), 'utf-8');
mcpCode = mcpCode.replace('main().catch(console.error);', 'export { server };\n//main().catch(console.error);');
fs.writeFileSync(path.join(__dirname, 'mcp_exportable.js'), mcpCode, 'utf-8');
console.log("mcp_exportable.js created");
