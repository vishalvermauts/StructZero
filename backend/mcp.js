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
import { getSetting, setSetting, getAllMemories, addMemory, searchMemories, getAllSkills } from "./database.js";
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

    const activeUser = await getSetting('activeUser') || 'global';

    const memories = await getAllMemories(activeUser);
    const memoryString = memories.length > 0 
      ? memories.map(m => `### ${m.topic}\n${m.details}\n(Recorded: ${m.created_at})`).join('\n\n')
      : "No memories stored yet.";
      
    const userProfilesRaw = await getSetting('userProfiles');
    const userProfilesObj = userProfilesRaw ? JSON.parse(userProfilesRaw) : {};
    const userProfile = activeUser !== 'global' ? userProfilesObj[activeUser] : '';
    const profileString = userProfile ? `# User Profile (${activeUser})\n\n${userProfile}\n\n---\n\n` : '';

    const fullContext = `${profileString}# Architecture Blueprint\n\n${archContent}\n\n---\n\n# Persistent Memory Bank\n\n${memoryString}`;

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
        name: "switch_active_user",
        description: "Switch the globally active user profile. Use this when the user says 'I am [name]' or wants to change their identity.",
        inputSchema: {
          type: "object",
          properties: {
            username: { type: "string", description: "The username to switch to (e.g. 'vishal', 'global')" }
          },
          required: ["username"]
        }
      },
      {
        name: "create_or_update_profile",
        description: "Create or update the rules for a specific user profile.",
        inputSchema: {
          type: "object",
          properties: {
            username: { type: "string", description: "The username to create/update (e.g. 'vishal')" },
            rules: { type: "string", description: "The persistent rules/preferences for this user (e.g. 'I prefer Next.js and Tailwind.')" }
          },
          required: ["username", "rules"]
        }
      },
      {
        name: "list_profiles",
        description: "List all available user profiles and the currently active profile.",
        inputSchema: {
          type: "object",
          properties: {},
          required: []
        }
      },
      {
        name: "delete_profile",
        description: "Delete a specific user profile and its global rules.",
        inputSchema: {
          type: "object",
          properties: {
            username: { type: "string", description: "The username to delete (e.g. 'vishal')" }
          },
          required: ["username"]
        }
      },
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
      },
      {
        name: "generate_architecture",
        description: "Generate a detailed implementation plan and architecture blueprint for a new application idea.",
        inputSchema: {
          type: "object",
          properties: {
            prompt: { type: "string", description: "The core idea or requirements for the app (e.g. 'Android weather app with offline support')" },
            leanMode: { type: "boolean", description: "If true, generates a highly condensed technical plan." }
          },
          required: ["prompt"]
        }
      },
      {
        name: "search_skills",
        description: "Search the user's library of saved architecture blueprints, design patterns, and reusable coding skills.",
        inputSchema: {
          type: "object",
          properties: {
            query: { type: "string", description: "Optional search query to filter skills by name or description." }
          },
          required: []
        }
      }
    ]
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  if (request.params.name === "switch_active_user") {
    const { username } = request.params.arguments;
    const userProfilesRaw = await getSetting('userProfiles');
    const userProfiles = userProfilesRaw ? JSON.parse(userProfilesRaw) : { global: '' };
    if (!userProfiles.hasOwnProperty(username) && username !== 'global') {
      return { content: [{ type: "text", text: `Error: Profile '${username}' does not exist. Use create_or_update_profile first, or switch to 'global'.` }] };
    }
    await setSetting('activeUser', username);
    return { content: [{ type: "text", text: `Successfully switched active profile to: ${username}` }] };
  }
  if (request.params.name === "create_or_update_profile") {
    const { username, rules } = request.params.arguments;
    const userProfilesRaw = await getSetting('userProfiles');
    const userProfiles = userProfilesRaw ? JSON.parse(userProfilesRaw) : { global: '' };
    userProfiles[username] = rules;
    await setSetting('userProfiles', JSON.stringify(userProfiles));
    return { content: [{ type: "text", text: `Successfully saved rules for profile: ${username}` }] };
  }
  if (request.params.name === "list_profiles") {
    const activeUser = await getSetting('activeUser') || 'global';
    const userProfilesRaw = await getSetting('userProfiles');
    const userProfiles = userProfilesRaw ? JSON.parse(userProfilesRaw) : { global: '' };
    const text = `Active Profile: ${activeUser}\n\nAvailable Profiles:\n` + Object.keys(userProfiles).map(u => `- ${u}`).join('\n');
    return { content: [{ type: "text", text }] };
  }
  if (request.params.name === "delete_profile") {
    const { username } = request.params.arguments;
    const userProfilesRaw = await getSetting('userProfiles');
    const userProfiles = userProfilesRaw ? JSON.parse(userProfilesRaw) : { global: '' };
    if (username === 'global') return { content: [{ type: "text", text: "Cannot delete the global profile." }] };
    if (!userProfiles.hasOwnProperty(username)) {
      return { content: [{ type: "text", text: `Profile '${username}' does not exist.` }] };
    }
    delete userProfiles[username];
    await setSetting('userProfiles', JSON.stringify(userProfiles));
    const activeUser = await getSetting('activeUser');
    if (activeUser === username) await setSetting('activeUser', 'global');
    return { content: [{ type: "text", text: `Successfully deleted profile: ${username}` }] };
  }
  if (request.params.name === "store_memory") {
    const { topic, details } = request.params.arguments;
    const activeUser = await getSetting('activeUser') || 'global';
    await addMemory(topic, details, activeUser);
    return { content: [{ type: "text", text: `Memory stored successfully under topic: ${topic} for user: ${activeUser}` }] };
  }
  if (request.params.name === "search_memory") {
    const { query, limit } = request.params.arguments;
    const activeUser = await getSetting('activeUser') || 'global';
    const results = await searchMemories(query, limit || 5, activeUser);
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
  if (request.params.name === "generate_architecture") {
    const { prompt, leanMode } = request.params.arguments;
    try {
      // Create a small wrapper to handle the streaming response format of the generate endpoint
      const response = await axios.post("http://localhost:3001/api/generate", {
        prompt: prompt + ". VERY IMPORTANT: Code must adhere to strict WCAG AA accessibility standards. IMPORTANT: Target an Android Offline-First architecture using local SQLite/Room.",
        uiStyles: [],
        leanMode: leanMode || false,
        context: null
      }, { responseType: 'text' });
      
      // Parse the response
      let fullPlan = "";
      try {
        // Try parsing the entire response as a single JSON object first (Cloud Engine non-SSE fallback)
        const parsedData = JSON.parse(response.data);
        if (parsedData.architecture) {
          fullPlan = parsedData.architecture;
        } else if (parsedData.error) {
          throw new Error(parsedData.error);
        }
      } catch (e) {
        // If it's not a single JSON object, it must be an SSE stream
        const lines = response.data.split('\n');
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.substring(6));
              if (data.chunk) fullPlan += data.chunk;
              if (data.architecture) fullPlan += "\n\n" + data.architecture;
              if (data.error) throw new Error(data.error);
            } catch(e) {}
          }
        }
      }
      return { content: [{ type: "text", text: fullPlan || "Failed to parse generation stream." }] };
    } catch (e) {
      return { content: [{ type: "text", text: `Failed to generate architecture: ${e.message}` }] };
    }
  }
  if (request.params.name === "search_skills") {
    try {
      const { query } = request.params.arguments || {};
      const skills = await getAllSkills();
      let filtered = skills;
      if (query) {
        const q = query.toLowerCase();
        filtered = skills.filter(s => 
          (s.name && s.name.toLowerCase().includes(q)) || 
          (s.description && s.description.toLowerCase().includes(q)) ||
          (s.project_name && s.project_name.toLowerCase().includes(q))
        );
      }
      const text = filtered.length > 0 
        ? filtered.map(s => `## Skill/Blueprint: ${s.name}\nProject: ${s.project_name || 'Unknown'}\nDescription: ${s.description}\nSaved At: ${s.created_at}\n\nContent:\n${s.architecture_content}`).join('\n\n---\n\n')
        : "No matching skills or blueprints found in your library.";
      return { content: [{ type: "text", text }] };
    } catch (err) {
      return { content: [{ type: "text", text: `Failed to search skills: ${err.message}` }] };
    }
  }
  throw new Error(`Tool not found: ${request.params.name}`);
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("IDE Architect MCP Server running on stdio");
}

main().catch(console.error);
