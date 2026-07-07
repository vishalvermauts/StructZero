import sqlite3 from 'sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DB_PATH = path.join(__dirname, 'mcp_brain.sqlite');

const db = new sqlite3.Database(DB_PATH);

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS Settings (
    key TEXT PRIMARY KEY,
    value TEXT
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS MemoryBank (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    topic TEXT,
    details TEXT,
    embedding TEXT DEFAULT '[]',
    username TEXT DEFAULT 'global',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
  db.run(`ALTER TABLE MemoryBank ADD COLUMN embedding TEXT DEFAULT '[]'`, (err) => {});
  db.run(`ALTER TABLE MemoryBank ADD COLUMN username TEXT DEFAULT 'global'`, (err) => {});
  db.run(`CREATE TABLE IF NOT EXISTS Skills (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    description TEXT,
    architecture_content TEXT,
    project_name TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
  db.run(`ALTER TABLE Skills ADD COLUMN project_name TEXT`, (err) => {});
  
  db.run(`CREATE TABLE IF NOT EXISTS ObservabilityMetrics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    provider TEXT,
    latency_ms INTEGER,
    tokens INTEGER,
    cost REAL,
    project_name TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
  db.run(`ALTER TABLE ObservabilityMetrics ADD COLUMN project_name TEXT`, (err) => {});
});

export const getSetting = (key) => {
  return new Promise((resolve, reject) => {
    db.get('SELECT value FROM Settings WHERE key = ?', [key], (err, row) => {
      if (err) reject(err);
      else resolve(row ? row.value : null);
    });
  });
};

export const setSetting = (key, value) => {
  return new Promise((resolve, reject) => {
    db.run('INSERT OR REPLACE INTO Settings (key, value) VALUES (?, ?)', [key, value], (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
};

export const getAllMemories = (username = null) => {
  return new Promise((resolve, reject) => {
    let query = 'SELECT * FROM MemoryBank ORDER BY created_at DESC';
    let params = [];
    if (username) {
      query = 'SELECT * FROM MemoryBank WHERE username = ? ORDER BY created_at DESC';
      params = [username];
    }
    db.all(query, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
};

export const addMemory = async (topic, details, username = 'global') => {
  let embeddingStr = "[]";
  try {
    const key = await getSetting('geminiKey');
    if (key) {
      const ai = new GoogleGenAI({ apiKey: key });
      const response = await ai.models.embedContent({
        model: 'gemini-embedding-2',
        contents: `${topic}: ${details}`
      });
      if (response.embeddings && response.embeddings.length > 0) {
        embeddingStr = JSON.stringify(response.embeddings[0].values);
      }
    }
  } catch (e) {
    console.error("Failed to generate embedding", e);
  }

  return new Promise((resolve, reject) => {
    db.run('INSERT INTO MemoryBank (topic, details, embedding, username) VALUES (?, ?, ?, ?)', [topic, details, embeddingStr, username], (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
};

const cosineSimilarity = (a, b) => {
  let dotProduct = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
};

export const searchMemories = async (query, limit = 5, username = null) => {
  let queryEmbedding = null;
  try {
    const key = await getSetting('geminiKey');
    if (key) {
      const ai = new GoogleGenAI({ apiKey: key });
      const response = await ai.models.embedContent({
        model: 'gemini-embedding-exp-03-07',
        contents: query
      });
      if (response.embeddings && response.embeddings.length > 0) {
        queryEmbedding = response.embeddings[0].values;
      }
    }
  } catch (e) {
    console.error("Failed to generate query embedding", e);
  }

  const allMemories = await getAllMemories(username);
  if (!queryEmbedding) return allMemories.slice(0, limit);

  const scoredMemories = allMemories.map(m => {
    let score = 0;
    if (m.embedding && m.embedding !== "[]") {
      try {
        const emb = JSON.parse(m.embedding);
        score = cosineSimilarity(queryEmbedding, emb);
      } catch (e) {}
    }
    return { ...m, score };
  });

  scoredMemories.sort((a, b) => b.score - a.score);
  return scoredMemories.slice(0, limit);
};

export const deleteMemory = (id) => {
  return new Promise((resolve, reject) => {
    db.run('DELETE FROM MemoryBank WHERE id = ?', [id], (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
};

export const getAllSkills = () => {
  return new Promise((resolve, reject) => {
    db.all('SELECT * FROM Skills ORDER BY created_at DESC', (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
};

export const saveSkill = (name, description, architectureContent, projectName = 'Unknown') => {
  return new Promise((resolve, reject) => {
    db.run('INSERT INTO Skills (name, description, architecture_content, project_name) VALUES (?, ?, ?, ?)', [name, description, architectureContent, projectName], (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
};

export const deleteSkill = (id) => {
  return new Promise((resolve, reject) => {
    db.run('DELETE FROM Skills WHERE id = ?', [id], (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
};

export const logMetric = (provider, latencyMs, tokens, cost, projectName = 'Unknown') => {
  return new Promise((resolve, reject) => {
    db.run('INSERT INTO ObservabilityMetrics (provider, latency_ms, tokens, cost, project_name) VALUES (?, ?, ?, ?, ?)', [provider, latencyMs, tokens, cost, projectName], (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
};

export const getMetrics = () => {
  return new Promise((resolve, reject) => {
    db.all('SELECT * FROM ObservabilityMetrics ORDER BY created_at ASC', (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
};
