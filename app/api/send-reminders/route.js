import { createClient } from '@supabase/supabase-js';
import webpush from 'web-push';

export async function GET(request) {
  // Vercel automatically sends `Authorization: Bearer <CRON_SECRET>` for scheduled cron invocations
  // when the CRON_SECRET env var is set on the project — this stops random people from triggering it.
  const authHeader = request.headers.get('authorization');
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) {
    return Response.json({ error: 'VAPID keys not configured' }, { status: 500 });
  }
  webpush.setVapidDetails('mailto:support@athleteos.app', process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY, process.env.VAPID_PRIVATE_KEY);

  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  const today = new Date().toISOString().slice(0, 10);

  const { data: subs } = await admin.from('push_subscriptions').select('*');
  if (!subs?.length) return Response.json({ sent: 0, checked: 0, note: 'No subscriptions yet' });

  const uids = [...new Set(subs.map((s) => s.user_id))];
  const { data: todays } = await admin
    .from('day_logs').select('user_id, session_rpe, readiness, meditation_done, sleep_hours')
    .eq('log_date', today).in('user_id', uids);

  const activeToday = new Set(
    (todays || [])
      .filter((d) => d.session_rpe != null || d.readiness != null || d.meditation_done || d.sleep_hours != null)
      .map((d) => d.user_id)
  );

  const toNotify = subs.filter((s) => !activeToday.has(s.user_id));
  let sent = 0, cleaned = 0;

  for (const s of toNotify) {
    try {
      await webpush.sendNotification(
        s.subscription,
        JSON.stringify({ title: 'Athlete OS', body: "Haven't logged today yet — a quick voice note takes 20 seconds.", url: '/' })
      );
      sent++;
    } catch (e) {
      if (e.statusCode === 404 || e.statusCode === 410) {
        await admin.from('push_subscriptions').delete().eq('id', s.id); // subscription expired/revoked, remove it
        cleaned++;
      }
    }
  }

  return Response.json({ checked: subs.length, sent, skippedAlreadyActive: subs.length - toNotify.length, cleanedExpired: cleaned });
}
