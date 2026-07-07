import sqlite3 from 'sqlite3';

const dbOld = new sqlite3.Database('C:\\Users\\mcmur\\.gemini\\config\\plugins\\ide-architect-plugin\\backend\\mcp_brain.sqlite');
const dbNew = new sqlite3.Database('C:\\AI\\mcp\\ide-architect-mcp\\backend\\mcp_brain.sqlite');

dbOld.all("SELECT * FROM MemoryBank", (err, rows) => {
  if (err) { console.error("Select error:", err); return; }
  console.log("Found", rows.length, "rows in old db");
  rows.forEach(row => {
    dbNew.run(
      "INSERT INTO MemoryBank (topic, details, embedding, created_at) VALUES (?, ?, ?, ?)",
      [row.topic, row.details, row.embedding, row.created_at],
      (err) => {
        if (err) console.error("Insert error:", err);
        else console.log("Inserted:", row.topic);
      }
    );
  });
});
