import { ChromaClient } from 'chromadb';

async function test() {
  try {
    const client = new ChromaClient();
    const collection = await client.getOrCreateCollection({ name: "test" });
    console.log("ChromaDB connected successfully!");
  } catch (e) {
    console.error("ChromaDB Error:", e.message);
  }
}

test();
