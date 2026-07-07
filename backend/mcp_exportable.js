import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema
} from "@modelcontextprotocol/sdk/types.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { getAllMemories, addMemory, searchMemories } from "./database.js";
import axios from "axios"; 

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ARCHITECTURE_FILE = path.join(__dirname, "architecture.md");


const walkSync = (dir, filelist = []) => {
  try {
    const files = fs.readdirSync(dir);
    for (const file of files) {
      const filepath = path.join(dir, file);
      if (fs.statSync(filepath).isDirectory()) {
        if (!['node_modules', '.git', 'dist', 'build', '.next', 'coverage', '.idea', '.vscode'].includes(file)) {
          filelist = walkSync(filepath, filelist);
        }
      } else {
        if (filepath.match(/\.(js|jsx|ts|tsx|py|go|java|c|cpp|h|hpp|cs|html|css|json|md)$/)) {
          filelist.push(filepath);
        }
      }
    }
  } catch(e) {}
  return filelist;
};

const server = new Server({
  name: "ide-architect-mcp",
  version: "3.0.0",
}, {
  capabilities: {
    tools: {},
    resources: {}
  }
});

server.setRequestHandler(ListResourcesRequestSchema, async () => {
  return {
    resources: [
      {
        uri: "workspace://context",
        name: "Workspace Master Context",
        mimeType: "text/markdown",
        description: "Contains the latest architecture blueprint AND the persistent memory bank of the IDE."
      }
    ]
  };
});

server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  if (request.params.uri === "workspace://context") {
    let archContent = "No architecture plan generated yet.";
    if (fs.existsSync(ARCHITECTURE_FILE)) archContent = fs.readFileSync(ARCHITECTURE_FILE, "utf-8");

    const memories = await getAllMemories();
    const memoryString = memories.length > 0 
      ? memories.map(m => `### ${m.topic}\n${m.details}\n(Recorded: ${m.created_at})`).join('\n\n')
      : "No memories stored yet.";

    const fullContext = `# Architecture Blueprint\n\n${archContent}\n\n---\n\n# Persistent Memory Bank\n\n${memoryString}`;

    return {
      contents: [{
        uri: request.params.uri,
        mimeType: "text/markdown",
        text: fullContext
      }]
    };
  }
  throw new Error(`Resource not found: ${request.params.uri}`);
});

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "store_memory",
        description: "Store a permanent memory or context fact (e.g., SSH keys, decisions made, project status).",
        inputSchema: {
          type: "object",
          properties: {
            topic: { type: "string", description: "Short title of the memory" },
            details: { type: "string", description: "The full details to remember" }
          },
          required: ["topic", "details"]
        }
      },
      {
        name: "troubleshoot_error",
        description: "Pass a stubborn error log to the MCP's AI agent for deep web research and resolution.",
        inputSchema: {
          type: "object",
          properties: {
            errorLog: { type: "string", description: "The exact error message or stack trace" }
          },
          required: ["errorLog"]
        }
      },
      {
        name: "search_memory",
        description: "Semantically search the IDE's persistent memory bank using vector embeddings.",
        inputSchema: {
          type: "object",
          properties: {
            query: { type: "string", description: "The natural language query to search for" },
            limit: { type: "number", description: "Max number of results to return (default 5)" }
          },
          required: ["query"]
        }
      },
      {
        name: "review_codebase",
        description: "Analyze a codebase or snippet and suggest architectural improvements based on the current blueprint and memory.",
        inputSchema: {
          type: "object",
          properties: {
            codeSnippet: { type: "string", description: "The code or architecture description to review" },
            context: { type: "string", description: "Optional context about what the code does" }
          },
          required: ["codeSnippet"]
        }
      },
      {
        name: "analyze_workspace",
        description: "Recursively crawl the IDE's current project folder and perform a deep architectural review of the entire codebase. INSTRUCTION TO IDE AI: If you have full-codebase context capabilities, generate a quantified architectural summary (core logic, structure, routes) and pass it in 'ideProvidedSummary'. If not, leave it blank and the backend will crawl the raw files.",
        inputSchema: {
          type: "object",
          properties: {
            workspaceRoot: { type: "string", description: "The absolute path to the current project directory" },
            ideProvidedSummary: { type: "string", description: "Optional. A structural summary of the codebase generated by the IDE." }
          },
          required: ["workspaceRoot"]
        }
      }
    ]
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  if (request.params.name === "store_memory") {
    const { topic, details } = request.params.arguments;
    await addMemory(topic, details);
    return { content: [{ type: "text", text: `Memory stored successfully under topic: ${topic}` }] };
  }
  if (request.params.name === "search_memory") {
    const { query, limit } = request.params.arguments;
    const results = await searchMemories(query, limit || 5);
    const text = results.length > 0 
      ? results.map(r => `[Score: ${r.score?.toFixed(2) || 'N/A'}] ${r.topic}: ${r.details}`).join('\n')
      : "No matching memories found.";
    return { content: [{ type: "text", text }] };
  }
  if (request.params.name === "troubleshoot_error") {
    const { errorLog } = request.params.arguments;
    try {
      const res = await axios.post("http://localhost:3001/api/troubleshoot", { errorLog });
      return { content: [{ type: "text", text: res.data.solution }] };
    } catch (e) {
      return { content: [{ type: "text", text: `Failed to troubleshoot: ${e.message}` }] };
    }
  }
  if (request.params.name === "review_codebase") {
    const { codeSnippet, context } = request.params.arguments;
    try {
      const res = await axios.post("http://localhost:3001/api/troubleshoot", { 
          errorLog: `Please review this code and suggest improvements based on our architecture.\n\nContext: ${context || 'None'}\n\nCode:\n${codeSnippet}` 
      });
      return { content: [{ type: "text", text: res.data.solution }] };
    } catch (e) {
      return { content: [{ type: "text", text: `Failed to review codebase: ${e.message}` }] };
    }
  }
  if (request.params.name === "analyze_workspace") {
    const { workspaceRoot, ideProvidedSummary } = request.params.arguments;
    try {
      let bundledCode = "";
      if (!ideProvidedSummary) {
        const files = walkSync(workspaceRoot);
        for (const file of files) {
          try {
            const content = fs.readFileSync(file, 'utf-8');
            bundledCode += `\n\n--- FILE: ${file.replace(workspaceRoot, '')} ---\n${content}`;
            if (bundledCode.length > 500000) {
              bundledCode += "\n\n...[TRUNCATED to protect memory]...";
              break;
            }
          } catch(e) {}
        }
      }

      const res = await axios.post("http://localhost:3001/api/analyze_workspace", { 
          bundledCode,
          workspaceRoot,
          ideProvidedSummary
      });
      return { content: [{ type: "text", text: res.data.solution }] };
    } catch (e) {
      return { content: [{ type: "text", text: `Failed to analyze workspace: ${e.message}` }] };
    }
  }
  throw new Error(`Tool not found: ${request.params.name}`);
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("IDE Architect MCP Server running on stdio");
}

export { server };
//main().catch(console.error);
