import { createClient } from '@supabase/supabase-js';

async function authUser(request) {
  const token = (request.headers.get('authorization') || '').replace('Bearer ', '');
  if (!token) return null;
  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data?.user) return null;
  return data.user;
}

export async function POST(request) {
  const user = await authUser(request);
  if (!user) return Response.json({ error: 'Not authenticated' }, { status: 401 });

  const { subscription } = await request.json();
  if (!subscription?.endpoint) return Response.json({ error: 'Invalid subscription' }, { status: 400 });

  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  const { error } = await admin.from('push_subscriptions').upsert(
    { user_id: user.id, endpoint: subscription.endpoint, subscription },
    { onConflict: 'user_id,endpoint' }
  );
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ ok: true });
}

export async function DELETE(request) {
  const user = await authUser(request);
  if (!user) return Response.json({ error: 'Not authenticated' }, { status: 401 });
  const { endpoint } = await request.json();
  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  await admin.from('push_subscriptions').delete().eq('user_id', user.id).eq('endpoint', endpoint);
  return Response.json({ ok: true });
}
