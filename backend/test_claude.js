import axios from 'axios';
import { getSetting } from './database.js';

async function test() {
  const claudeKey = await getSetting('claudeKey');
  try {
    const res = await axios.get('https://api.anthropic.com/v1/models', {
      headers: {
        'x-api-key': claudeKey,
        'anthropic-version': '2023-06-01'
      }
    });
    console.log("Models available:", JSON.stringify(res.data, null, 2));
  } catch (e) {
    console.error("Error:", e.response ? JSON.stringify(e.response.data) : e.message);
  }
}
test();
