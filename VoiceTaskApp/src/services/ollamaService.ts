import axios from 'axios';
import * as db from './db';
import { OllamaResult } from '../types';

function buildPrompt(transcript: string, today: string): string {
  return `You are a task and note parser. Given a voice note transcript, extract the intent and return ONLY a valid JSON object — no explanation, no other text.

Output format:
{
  "type": "todo" | "reminder" | "thought",
  "text": "cleaned up action text",
  "datetime": "ISO 8601 string or null",
  "priority": "low" | "medium" | "high"
}

Rules:
- "todo"     = task for today with no specific future date
- "reminder" = future scheduled event with a specific date/time
- "thought"  = idea, observation, or note with no action needed
- Extract dates from phrases like "tomorrow", "next Monday", "at 3pm"
- Keep "text" concise and imperative (e.g. "Call John" not "remind me to call")
- "priority" only applies to todos; default to "medium"

Today's date is: ${today}

Transcript: "${transcript}"`;
}

export async function ping(): Promise<boolean> {
  try {
    const url = await db.getSetting('ollamaUrl', 'http://192.168.1.x:11434');
    const res = await axios.get(`${url}/api/tags`, { timeout: 3000 });
    return res.status === 200;
  } catch {
    return false;
  }
}

export async function parseTranscript(transcript: string): Promise<OllamaResult> {
  const url = await db.getSetting('ollamaUrl', 'http://192.168.1.x:11434');
  const model = await db.getSetting('ollamaModel', 'phi3:mini');
  const today = new Date().toISOString().split('T')[0];

  const response = await axios.post(
    `${url}/api/generate`,
    {
      model,
      prompt: buildPrompt(transcript, today),
      stream: false,
    },
    { timeout: 15000 }
  );

  const raw: string = response.data.response;
  // Extract JSON from response (model may wrap it in markdown code block)
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('No JSON found in Ollama response');

  const parsed = JSON.parse(jsonMatch[0]) as OllamaResult;
  return parsed;
}
