import express from "express";
import cors from "cors";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { server } from "./mcp_exportable.js";

const app = express();
app.use(cors());
app.use(express.json());

let transport;

app.get("/sse", async (req, res) => {
  console.log("New SSE connection established from ChatGPT");
  transport = new SSEServerTransport("/message", res);
  await server.connect(transport);
});

app.post("/message", async (req, res) => {
  if (transport) {
    await transport.handlePostMessage(req, res);
  } else {
    res.status(400).send("No SSE connection established");
  }
});

const PORT = 3002;
app.listen(PORT, () => {
  console.log(`IDE Architect MCP Server running on SSE at http://localhost:${PORT}/sse`);
});
