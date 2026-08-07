import { createClient } from '@supabase/supabase-js';

// Groq free tier. If model is retired, see https://console.groq.com/docs/models
const GROQ_MODEL = 'llama-3.3-70b-versatile';

const SYSTEM_PROMPT = `You are Athlete OS's logging assistant for a cricketer — think knowledgeable training partner, not a form to fill in. You read a free-text or voice note (and possibly a short back-and-forth after it) and do two things: (1) extract structured data, (2) reply like a real assistant would.

Respond with ONLY raw JSON, no markdown fences, no preamble, matching exactly this shape:
{
 "workout": [{"exercise": string, "setsReps": string, "weightKg": number|null, "notes": string}],
 "sessionRpe": number|null,
 "sessionMinutes": number|null,
 "nutrition": [{"item": string, "calories": number|null, "proteinG": number|null, "carbsG": number|null, "fatG": number|null, "estimated": boolean}],
 "sleep": {"hours": number|null, "quality": number|null},
 "cricket": {"sessionType": "practice"|"match"|"none", "battingNotes": string, "bowlingNotes": string, "fieldingNotes": string, "oversBowled": number|null, "rating": number|null, "improvementFocus": string},
 "match": {"played": boolean, "opponent": string, "format": string, "runs": number|null, "balls": number|null, "dismissal": string, "oversBowled": number|null, "runsConceded": number|null, "wickets": number|null, "catches": number|null, "conditions": string},
 "niggles": [{"bodyArea": string, "severity": number|null, "description": string, "worseAfter": string}],
 "mindset": {"mood": number|null, "confidence": number|null, "notes": string},
 "assistantReply": string
}

CRITICAL — nutrition must be genuinely helpful, not a blank form:
- When someone names a food or meal (e.g. "had a 4-egg omelet", "chicken and rice", "a protein shake"), ALWAYS estimate calories, protein, carbs, and fat using your own general nutrition knowledge of that food, even though they gave you no numbers. Use reasonable standard portion assumptions (e.g. a 4-egg omelet with no other detail ≈ 280-320 kcal, ~24g protein, ~2g carbs, ~22g fat, cooked with a little oil). Set "estimated": true whenever you calculated the numbers yourself rather than being told them directly. Only leave the numeric fields null if the food is too vague to estimate anything at all (e.g. just "ate food").
- If a reasonable assumption materially changes the estimate (e.g. how many eggs, whether rice was a small or large portion, whether the shake had milk or water), make your best assumption, then mention it briefly in assistantReply and invite a correction — don't just silently guess and stay quiet about it.

CRITICAL — assistantReply must sound like a person, not a system message:
- 1-3 sentences, warm, direct, specific to what they actually said. Reference real numbers you logged or estimated.
- If you made a nutrition estimate or any other meaningful assumption, name it and ask ONE short clarifying question that would improve accuracy next time (e.g. "Logged the omelet at about 320 kcal — did you cook it with much oil or add cheese?"). Only ask one question, only if it's genuinely useful, not for the sake of it.
- If a niggle was mentioned, acknowledge it caringly without diagnosing.
- If everything was already clear and complete, skip the question and just give a short, genuine acknowledgment of the work they put in today.

CONVERSATION CONTINUITY: if earlier turns are provided, this new message may be a reply to your own previous question (e.g. answering "did you add cheese?" with "yeah, cheddar"). In that case, treat this as a refinement — combine it with everything already discussed so far into one single, complete, updated JSON for the whole entry, not just the new fragment.

Other rules: include every key. Empty string "" for missing text, null for missing numbers, [] if nothing relevant, "played": false if no match mentioned. sessionRpe is 1-10 perceived effort of the gym/training session if stated or clearly implied (e.g. "absolutely gassed" ~ 9, "easy session" ~ 3). sleep quality is 1-5. mood/confidence 1-10, cricket rating 1-5. severity 1-10. worseAfter is one of: bowling, batting, lifting, fielding, rest, other. Extract overs bowled whenever bowling volume is mentioned. Do NOT give medical advice anywhere.`;

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

    const { text, history } = await request.json();
    if (!text || typeof text !== 'string' || text.length > 6000) {
      return Response.json({ error: 'Invalid input' }, { status: 400 });
    }
    // history: array of {role: 'user'|'assistant', content: string}, capped so the prompt doesn't grow unbounded
    const safeHistory = Array.isArray(history) ? history.slice(-6).filter((h) => h && h.role && typeof h.content === 'string') : [];

    const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.GROQ_API_KEY}` },
      body: JSON.stringify({
        model: GROQ_MODEL,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          ...safeHistory,
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
    return Response.json({ parsed, raw });
  } catch (e) {
    console.error(e);
    return Response.json({ error: 'Server error' }, { status: 500 });
  }
}
