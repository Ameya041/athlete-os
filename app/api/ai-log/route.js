import { createClient } from '@supabase/supabase-js';

// Groq free tier. If model is retired, see https://console.groq.com/docs/models
const GROQ_MODEL = 'llama-3.3-70b-versatile';

const SYSTEM_PROMPT = `You extract structured training-log data from a cricketer's free-text note. Respond with ONLY raw JSON, no markdown fences, no preamble, matching exactly this shape:
{
 "workout": [{"exercise": string, "setsReps": string, "weightKg": number|null, "notes": string}],
 "sessionRpe": number|null,
 "sessionMinutes": number|null,
 "nutrition": [{"item": string, "calories": number|null, "proteinG": number|null, "carbsG": number|null, "fatG": number|null}],
 "sleep": {"hours": number|null, "quality": number|null},
 "cricket": {"sessionType": "practice"|"match"|"none", "battingNotes": string, "bowlingNotes": string, "fieldingNotes": string, "oversBowled": number|null, "rating": number|null, "improvementFocus": string},
 "match": {"played": boolean, "opponent": string, "format": string, "runs": number|null, "balls": number|null, "dismissal": string, "oversBowled": number|null, "runsConceded": number|null, "wickets": number|null, "catches": number|null, "conditions": string},
 "niggles": [{"bodyArea": string, "severity": number|null, "description": string, "worseAfter": string}],
 "mindset": {"mood": number|null, "confidence": number|null, "notes": string}
}
Rules: include every key. Empty string "" for missing text, null for missing numbers, [] if nothing relevant, "played": false if no match mentioned. sessionRpe is 1-10 perceived effort of the gym/training session if stated or clearly implied (e.g. "absolutely gassed" ~ 9, "easy session" ~ 3). sleep quality is 1-5. mood/confidence 1-10, cricket rating 1-5. severity 1-10. worseAfter is one of: bowling, batting, lifting, fielding, rest, other. Extract overs bowled whenever bowling volume is mentioned (e.g. "bowled 8 overs"). Do NOT give medical advice anywhere.`;

async function authUser(request) {
  const token = (request.headers.get('authorization') || '').replace('Bearer ', '');
  if (!token) return null;
  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data?.user) return null;
  return data.user;
}

export async function POST(request) {
  try {
    const user = await authUser(request);
    if (!user) return Response.json({ error: 'Not authenticated' }, { status: 401 });

    const { text } = await request.json();
    if (!text || typeof text !== 'string' || text.length > 6000) {
      return Response.json({ error: 'Invalid input' }, { status: 400 });
    }

    const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.GROQ_API_KEY}` },
      body: JSON.stringify({
        model: GROQ_MODEL,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: text }
        ]
      })
    });

    if (!groqRes.ok) {
      console.error('Groq error:', await groqRes.text());
      return Response.json({ error: 'AI parsing failed' }, { status: 502 });
    }

    const data = await groqRes.json();
    const raw = data?.choices?.[0]?.message?.content || '{}';
    let parsed;
    try {
      parsed = JSON.parse(raw.replace(/```json|```/g, '').trim());
    } catch (e) {
      return Response.json({ error: 'Could not parse AI response' }, { status: 502 });
    }
    return Response.json({ parsed });
  } catch (e) {
    console.error(e);
    return Response.json({ error: 'Server error' }, { status: 500 });
  }
}
