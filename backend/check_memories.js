import sqlite3 from 'sqlite3';

const dbOld = new sqlite3.Database('C:\\Users\\mcmur\\.gemini\\config\\plugins\\ide-architect-plugin\\backend\\mcp_brain.sqlite');
const dbNew = new sqlite3.Database('C:\\AI\\mcp\\ide-architect-mcp\\backend\\mcp_brain.sqlite');

dbOld.get("SELECT count(*) as cnt FROM MemoryBank", (err, row) => {
  console.log("OLD DB COUNT:", row ? row.cnt : err);
});

dbNew.get("SELECT count(*) as cnt FROM MemoryBank", (err, row) => {
  console.log("NEW DB COUNT:", row ? row.cnt : err);
});
