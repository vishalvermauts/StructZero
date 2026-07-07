import 'dotenv/config';
import { GoogleGenAI } from '@google/genai';
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
(async () => {
  const response = await ai.models.list();
  for await (const model of response) {
    if (model.name.includes('embedding')) {
      console.log(model.name);
    }
  }
})();
