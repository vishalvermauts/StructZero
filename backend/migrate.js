import sqlite3 from 'sqlite3';

const dbOld = new sqlite3.Database('C:\\Users\\mcmur\\.gemini\\config\\plugins\\ide-architect-plugin\\backend\\mcp_brain.sqlite');
const dbNew = new sqlite3.Database('C:\\AI\\mcp\\ide-architect-mcp\\backend\\mcp_brain.sqlite');

dbOld.get("SELECT value FROM Settings WHERE key = 'userProfiles'", (err, row) => {
  if (row) {
    dbNew.run("INSERT OR REPLACE INTO Settings (key, value) VALUES ('userProfiles', ?)", [row.value], () => {
      console.log('Migrated userProfiles');
    });
  }
});

dbOld.get("SELECT value FROM Settings WHERE key = 'activeUser'", (err, row) => {
  if (row) {
    dbNew.run("INSERT OR REPLACE INTO Settings (key, value) VALUES ('activeUser', ?)", [row.value], () => {
      console.log('Migrated activeUser');
    });
  }
});
