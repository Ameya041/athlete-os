import { createClient } from '@supabase/supabase-js';

const GROQ_MODEL = 'llama-3.3-70b-versatile';

const REVIEW_PROMPT = `You are a supportive, knowledgeable training companion for a cricketer — part accountability partner, part reflective coach. You will receive a JSON summary of their recent training data (today plus recent days).

Write a short end-of-day review (under 220 words) with this structure, in plain encouraging language:
1. What they did today (one or two sentences, acknowledge the work).
2. One pattern worth noticing across the recent data (e.g. sleep vs mood, training load trend, bowling workload creeping up, a lift progressing well).
3. One concrete focus for tomorrow.

Rules:
- If weekly training load or bowling overs look sharply higher than their recent average, gently flag it as a spike worth managing.
- If they logged pain/niggles: NEVER diagnose or prescribe treatment or exercises for it. If pain is recurring (multiple days) or severity >= 6, clearly recommend they get it assessed by a physio or doctor before pushing on. For mild one-off soreness, acknowledging it and suggesting they monitor it is fine.
- Never invent data that isn't in the summary. If data is sparse, say so and encourage logging.
- No markdown headers, no bullet lists. Warm, direct, like a coach who knows them.`;

const QA_PROMPT = `You are a knowledgeable cricket training companion answering a cricketer's general question. You can discuss training methods, cricket skills and tactics, nutrition principles, recovery basics, and mindset.
Rules:
- You are not a doctor or physio: for injury, pain, or medical questions, share only general educational information and recommend professional assessment for anything specific to their body.
- Be concise and practical (under 250 words). Plain language, no markdown headers.`;

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

    const body = await request.json();
    const mode = body.mode === 'qa' ? 'qa' : 'review';

    let messages;
    if (mode === 'qa') {
      const q = body.question;
      if (!q || typeof q !== 'string' || q.length > 2000) return Response.json({ error: 'Invalid input' }, { status: 400 });
      messages = [
        { role: 'system', content: QA_PROMPT },
        { role: 'user', content: q }
      ];
    } else {
      const summary = body.summary;
      if (!summary || typeof summary !== 'object') return Response.json({ error: 'Invalid input' }, { status: 400 });
      messages = [
        { role: 'system', content: REVIEW_PROMPT },
        { role: 'user', content: JSON.stringify(summary).slice(0, 8000) }
      ];
    }

    const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.GROQ_API_KEY}` },
      body: JSON.stringify({ model: GROQ_MODEL, messages, max_tokens: 500 })
    });

    if (!groqRes.ok) {
      console.error('Groq error:', await groqRes.text());
      return Response.json({ error: 'AI request failed' }, { status: 502 });
    }
    const data = await groqRes.json();
    const text = data?.choices?.[0]?.message?.content || '';
    return Response.json({ text });
  } catch (e) {
    console.error(e);
    return Response.json({ error: 'Server error' }, { status: 500 });
  }
}
