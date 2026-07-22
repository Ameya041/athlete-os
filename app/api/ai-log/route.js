import { createClient } from '@supabase/supabase-js';

// Using Groq's free API tier — no credit card needed, and very fast inference.
// If this model is retired, check https://console.groq.com/docs/models for current free-tier options.
const GROQ_MODEL = 'llama-3.3-70b-versatile';

const SYSTEM_PROMPT = `You extract structured training-log data from an athlete's free-text note. Respond with ONLY raw JSON, no markdown fences, no preamble, matching exactly this shape:
{
 "workout": [{"exercise": string, "setsReps": string, "weightKg": number|null, "notes": string}],
 "nutrition": [{"item": string, "calories": number|null, "proteinG": number|null, "carbsG": number|null, "fatG": number|null}],
 "cricket": {
   "sessionType": "practice"|"match"|"none",
   "battingNotes": string, "bowlingNotes": string, "fieldingNotes": string,
   "rating": number|null, "improvementFocus": string,
   "fatigue": number|null,
   "roleMetrics": {
     "middlingPct": number|null, "shotExecutionPct": number|null,
     "oversBowled": number|null, "effortBalls": number|null, "lineLengthControlPct": number|null, "stiffnessRating": number|null,
     "catches": number|null, "stumpings": number|null, "byesConceded": number|null, "footworkRating": number|null
   }
 },
 "mindset": {"mood": number|null, "confidence": number|null, "notes": string, "insight": string}
}
Rules: omit nothing from the schema. Use empty string "" for missing text fields, null for missing numbers, empty array [] if nothing relevant was mentioned. mood/confidence/fatigue are 1-10, cricket rating is 1-5, percentages are 0-100. Only fill roleMetrics fields the person actually mentioned or clearly implied — leave the rest null. For "insight" give one short, encouraging, practical sentence of mental-performance advice based on what they said (only if mindset-relevant content exists, else "").`;



export async function POST(request) {
  try {
    // 1. Verify the request is from a logged-in user (stops strangers from burning your API credits)
    const authHeader = request.headers.get('authorization') || '';
    const token = authHeader.replace('Bearer ', '');
    if (!token) {
      return Response.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
    const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(token);
    if (userErr || !userData?.user) {
      return Response.json({ error: 'Invalid session' }, { status: 401 });
    }

    // 2. Parse the request body
    const { text } = await request.json();
    if (!text || typeof text !== 'string' || text.length > 4000) {
      return Response.json({ error: 'Invalid input' }, { status: 400 });
    }

    // 3. Call Groq's free-tier API (key stays server-side only)
    const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.GROQ_API_KEY}`
      },
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
      const errBody = await groqRes.text();
      console.error('Groq error:', errBody);
      return Response.json({ error: 'AI parsing failed' }, { status: 502 });
    }

    const data = await groqRes.json();
    const raw = data?.choices?.[0]?.message?.content || '{}';
    const cleaned = raw.replace(/```json|```/g, '').trim();

    let parsed;
    try {
      parsed = JSON.parse(cleaned);
    } catch (e) {
      return Response.json({ error: 'Could not parse AI response' }, { status: 502 });
    }

    return Response.json({ parsed });
  } catch (e) {
    console.error(e);
    return Response.json({ error: 'Server error' }, { status: 500 });
  }
}
