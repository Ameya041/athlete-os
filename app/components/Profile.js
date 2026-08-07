'use client';
import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { Card, Eyebrow, Empty, H2, Sub, FlipTile, inputCls, labelCls, btnCls, btnSecondary, btnGold } from './ui';
import { Mail, LogOut, HelpCircle, Instagram, Link2, Camera, UserPlus, Check, X as XIcon, Bell, BellOff, Search, Gift, Copy, Video } from 'lucide-react';

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

const SUPPORT_EMAIL = 'support@athleteos.app'; // placeholder — swap for your real inbox once you have one

export default function Profile({ session, profile, setProfile, recentDays, recentMatches, streak, bestStreak,
  friends, incomingRequests, onAddFriend, onRespondFriend, onSignOut, onReopenHelp, onOpenFeed, showToast }) {
  const [editing, setEditing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [friendEmail, setFriendEmail] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [usernameError, setUsernameError] = useState('');
  const [form, setForm] = useState({
    display_name: profile.display_name || '',
    username: profile.username || '',
    bio: profile.bio || '',
    instagram_handle: profile.instagram_handle || '',
    other_social_url: profile.other_social_url || '',
    phone: profile.phone || '',
    primary_role: profile.primary_role || 'all-rounder',
    experience_years: profile.experience_years || '',
    is_coach: profile.is_coach || false
  });
  const [busy, setBusy] = useState(false);
  const [notifStatus, setNotifStatus] = useState('unknown'); // unknown | unsupported | denied | off | on
  const [notifBusy, setNotifBusy] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || !('Notification' in window) || !('serviceWorker' in navigator)) {
      setNotifStatus('unsupported'); return;
    }
    if (Notification.permission === 'denied') { setNotifStatus('denied'); return; }
    navigator.serviceWorker.getRegistration().then(async (reg) => {
      const sub = await reg?.pushManager.getSubscription();
      setNotifStatus(sub ? 'on' : 'off');
    });
  }, []);

  async function enableReminders() {
    setNotifBusy(true);
    try {
      const perm = await Notification.requestPermission();
      if (perm !== 'granted') { setNotifStatus('denied'); return; }
      const reg = await navigator.serviceWorker.register('/sw.js');
      const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!vapidKey) { console.error('Missing NEXT_PUBLIC_VAPID_PUBLIC_KEY'); return; }
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(vapidKey) });
      const { data: { session: s } } = await supabase.auth.getSession();
      await fetch('/api/push-subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${s.access_token}` },
        body: JSON.stringify({ subscription: sub.toJSON() })
      });
      setNotifStatus('on');
    } catch (e) {
      console.error(e);
    } finally {
      setNotifBusy(false);
    }
  }

  async function disableReminders() {
    setNotifBusy(true);
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        const { data: { session: s } } = await supabase.auth.getSession();
        await fetch('/api/push-subscribe', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${s.access_token}` },
          body: JSON.stringify({ endpoint: sub.endpoint })
        });
        await sub.unsubscribe();
      }
      setNotifStatus('off');
    } finally {
      setNotifBusy(false);
    }
  }

  const totalSessions = recentDays.filter((d) => d.session_rpe != null).length;
  const totalMeditation = recentDays.reduce((s, d) => s + (d.meditation_minutes || 0), 0);

  async function uploadAvatar(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const ext = file.name.split('.').pop();
      const path = `${session.user.id}/avatar.${ext}`;
      const { error: upErr } = await supabase.storage.from('athlete-os-media').upload(path, file, { upsert: true });
      if (upErr) throw upErr;
      const { data } = supabase.storage.from('athlete-os-media').getPublicUrl(path);
      const url = `${data.publicUrl}?t=${Date.now()}`;
      await supabase.from('profiles').update({ avatar_url: url }).eq('id', session.user.id);
      setProfile({ ...profile, avatar_url: url });
    } catch (err) {
      console.error(err);
    } finally {
      setUploading(false);
    }
  }

  async function saveProfile() {
    setBusy(true);
    setUsernameError('');
    const patch = {
      display_name: form.display_name, bio: form.bio,
      instagram_handle: form.instagram_handle.replace('@', ''), other_social_url: form.other_social_url,
      phone: form.phone, primary_role: form.primary_role, experience_years: Number(form.experience_years) || null,
      is_coach: form.is_coach
    };
    if (form.username) patch.username = form.username.trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
    const { error } = await supabase.from('profiles').update(patch).eq('id', session.user.id);
    if (error) {
      if (error.message?.includes('unique') || error.code === '23505') setUsernameError('That username is already taken.');
      setBusy(false);
      return;
    }
    setProfile({ ...profile, ...patch });
    setBusy(false);
    setEditing(false);
  }

  async function runSearch(q) {
    setSearchQuery(q);
    if (q.trim().length < 2) { setSearchResults([]); return; }
    const { data } = await supabase.rpc('search_users', { query: q.trim() });
    setSearchResults(data || []);
  }

  function copyReferralLink() {
    const link = `${window.location.origin}/login?ref=${profile.referral_code}`;
    navigator.clipboard.writeText(link);
    showToast?.('Invite link copied ✓');
  }

  const name = profile.display_name || session.user.email.split('@')[0];

  return (
    <>
      {/* the "athlete card" — a bit of visual fun instead of a plain settings list */}
      <Card className="!p-0 overflow-hidden">
        <div className="bg-ink px-5 pt-6 pb-14 relative">
          <div className="font-mono text-[9px] uppercase tracking-widest text-willow">Player card</div>
          <div className="font-display text-2xl text-paper mt-1">{name}</div>
          {profile.username && <div className="font-mono text-xs text-willow">@{profile.username}</div>}
          <div className="font-serif italic text-paper/60 text-sm">{profile.primary_role || 'all-rounder'}{profile.experience_years ? ` · ${profile.experience_years} yrs` : ''}{profile.is_coach ? ' · Coach' : ''}</div>
        </div>
        <div className="flex justify-center -mt-10">
          <div className="relative">
            <div className="w-20 h-20 rounded-full bg-paper border-4 border-paper overflow-hidden flex items-center justify-center">
              {profile.avatar_url
                ? <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" />
                : <div className="w-full h-full bg-seam/10 flex items-center justify-center font-display text-2xl text-seam">{name[0]?.toUpperCase()}</div>}
            </div>
            <label className="absolute bottom-0 right-0 w-7 h-7 rounded-full bg-seam text-paper flex items-center justify-center cursor-pointer border-2 border-paper">
              <Camera size={12} />
              <input type="file" accept="image/*" className="hidden" onChange={uploadAvatar} disabled={uploading} />
            </label>
          </div>
        </div>
        <div className="px-5 pb-5 pt-2 text-center">
          {profile.bio && <p className="font-serif text-sm text-ink mt-1">{profile.bio}</p>}
          <div className="flex justify-center gap-3 mt-2">
            {profile.instagram_handle && (
              <a href={`https://instagram.com/${profile.instagram_handle}`} target="_blank" rel="noreferrer"
                className="font-mono text-xs text-seam flex items-center gap-1"><Instagram size={12} /> @{profile.instagram_handle}</a>
            )}
            {profile.other_social_url && (
              <a href={profile.other_social_url} target="_blank" rel="noreferrer"
                className="font-mono text-xs text-seam flex items-center gap-1"><Link2 size={12} /> link</a>
            )}
          </div>
          <div className="grid grid-cols-4 gap-2 mt-4">
            <FlipTile value={streak} caption="Streak" />
            <FlipTile value={bestStreak} caption="Best ever" />
            <FlipTile value={totalSessions} caption="Sessions" />
            <FlipTile value={totalMeditation} caption="Meditate min" />
          </div>
        </div>
      </Card>

      <Card>
        <Eyebrow>Settings</Eyebrow>
        <H2>Edit profile</H2>
        {!editing ? (
          <button className={`${btnSecondary} w-full`} onClick={() => setEditing(true)}>Edit bio, socials & details</button>
        ) : (
          <>
            <label className={labelCls}>Display name</label>
            <input className={inputCls} value={form.display_name} onChange={(e) => setForm({ ...form, display_name: e.target.value })} placeholder="What friends see" />
            <label className={labelCls}>Username</label>
            <input className={inputCls} value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} placeholder="lowercase, no spaces — how friends find you" />
            {usernameError && <p className="text-seam text-xs font-mono mt-1">{usernameError}</p>}
            <label className={labelCls}>Bio</label>
            <textarea className={inputCls} value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} placeholder="Off-spinner, Bengaluru club cricket, building the base for next season." />
            <label className={labelCls}>Instagram handle</label>
            <input className={inputCls} value={form.instagram_handle} onChange={(e) => setForm({ ...form, instagram_handle: e.target.value })} placeholder="yourhandle (no @ needed)" />
            <label className={labelCls}>Another link (YouTube, X, portfolio...)</label>
            <input className={inputCls} value={form.other_social_url} onChange={(e) => setForm({ ...form, other_social_url: e.target.value })} placeholder="https://..." />
            <label className={labelCls}>Phone (optional, for friends to find you by)</label>
            <input className={inputCls} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+91..." />
            <label className={labelCls}>Role</label>
            <select className={inputCls} value={form.primary_role} onChange={(e) => setForm({ ...form, primary_role: e.target.value })}>
              {['batter', 'bowler', 'all-rounder', 'wicketkeeper'].map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
            <label className={labelCls}>Years of serious training</label>
            <input type="number" inputMode="numeric" className={inputCls} value={form.experience_years} onChange={(e) => setForm({ ...form, experience_years: e.target.value })} />
            <label className="flex items-center gap-2 mt-3 font-mono text-xs text-inkMuted">
              <input type="checkbox" checked={form.is_coach} onChange={(e) => setForm({ ...form, is_coach: e.target.checked })} className="accent-seam w-4 h-4" />
              I'm a coach — let me post video tips to the Feed
            </label>
            <div className="grid grid-cols-2 gap-2.5 mt-3">
              <button className={btnCls} onClick={saveProfile} disabled={busy}>{busy ? 'Saving…' : 'Save'}</button>
              <button className={btnSecondary} onClick={() => setEditing(false)}>Cancel</button>
            </div>
          </>
        )}
      </Card>

      <Card>
        <Eyebrow>Invite friends</Eyebrow>
        <H2>{profile.points || 0} points</H2>
        <Sub>Share your link. Once someone you invite finishes setting up their account, you both get credit. Points are a tracked ledger for now — once paid plans launch, they'll convert into free subscription time.</Sub>
        <div className="flex items-center justify-between bg-white rounded-lg px-3 py-2.5">
          <span className="font-mono text-sm text-ink">{profile.referral_code || '—'}</span>
          <button onClick={copyReferralLink} className="text-seam flex items-center gap-1 font-mono text-xs"><Copy size={14} /> Copy link</button>
        </div>
        <div className="flex items-center gap-2 mt-2 text-inkMuted font-mono text-xs"><Gift size={14} /> 50 points per friend who gets started</div>
      </Card>

      <Card>
        <Eyebrow>Friends</Eyebrow>
        <H2>Train together</H2>
        <Sub>Search by username, or add directly by their exact email or phone. Once accepted, you'll see each other's shared wins on the Feed — not a private inbox, just visible, friendly accountability.</Sub>

        <div className="relative">
          <Search size={14} className="absolute left-3 top-3.5 text-inkMuted" />
          <input className={`${inputCls} pl-8`} value={searchQuery} onChange={(e) => runSearch(e.target.value)} placeholder="Search by username..." />
        </div>
        {searchResults.length > 0 && (
          <div className="mt-2">
            {searchResults.map((r) => (
              <div key={r.id} className="flex justify-between items-center py-1.5 text-sm font-serif">
                <span>{r.display_name || r.username} <span className="font-mono text-xs text-inkMuted">@{r.username}</span></span>
                <button onClick={() => { onAddFriend(r.username); setSearchQuery(''); setSearchResults([]); }} className="text-seam"><UserPlus size={16} /></button>
              </div>
            ))}
          </div>
        )}

        <div className="flex gap-2 mt-3">
          <input className={inputCls} value={friendEmail} onChange={(e) => setFriendEmail(e.target.value)} placeholder="or exact email / phone" />
          <button className={btnSecondary} onClick={() => { onAddFriend(friendEmail); setFriendEmail(''); }}><UserPlus size={16} /></button>
        </div>

        {incomingRequests.length > 0 && (
          <div className="mt-3">
            <div className={labelCls}>Requests</div>
            {incomingRequests.map((r) => (
              <div key={r.id} className="flex justify-between items-center py-1.5 text-sm font-serif">
                <span>{r.requester_email}</span>
                <div className="flex gap-2">
                  <button onClick={() => onRespondFriend(r.id, true)} className="text-good"><Check size={16} /></button>
                  <button onClick={() => onRespondFriend(r.id, false)} className="text-seam"><XIcon size={16} /></button>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="mt-3">
          <div className={labelCls}>Your friends ({friends.length})</div>
          {friends.length === 0 ? <Empty>No friends added yet.</Empty> :
            friends.map((f) => <div key={f.id} className="text-sm font-serif py-1">{f.display_name || f.username || f.email}</div>)}
        </div>
        <button className={`${btnGold} w-full mt-3`} onClick={onOpenFeed}>Open the Feed</button>
      </Card>

      <Card>
        <Eyebrow>Stay consistent</Eyebrow>
        <H2>Daily reminders</H2>
        <Sub>One nudge a day, only if you haven't logged anything yet. No spam.</Sub>
        {notifStatus === 'unsupported' && <Empty>Not supported in this browser — try Chrome or install the app to your home screen first.</Empty>}
        {notifStatus === 'denied' && <Empty>Notifications are blocked for this site in your browser settings.</Empty>}
        {(notifStatus === 'on' || notifStatus === 'off') && (
          <button
            className={`${notifStatus === 'on' ? btnSecondary : btnCls} w-full flex items-center justify-center gap-2`}
            onClick={notifStatus === 'on' ? disableReminders : enableReminders} disabled={notifBusy}>
            {notifStatus === 'on' ? <><BellOff size={16} /> Turn off reminders</> : <><Bell size={16} /> Enable reminders</>}
          </button>
        )}
      </Card>

      <Card>
        <Eyebrow>Need something?</Eyebrow>
        <H2>Help & contact</H2>
        <button className={`${btnSecondary} w-full flex items-center justify-center gap-2`} onClick={onReopenHelp}>
          <HelpCircle size={16} /> Replay the how-it-works tour
        </button>
        <a href={`mailto:${SUPPORT_EMAIL}`} className={`${btnSecondary} w-full mt-2 flex items-center justify-center gap-2`}>
          <Mail size={16} /> Email support
        </a>
        <p className="font-mono text-[10px] text-inkMuted mt-2 text-center">{SUPPORT_EMAIL}</p>
      </Card>

      <Card>
        <button className={`${btnCls} w-full flex items-center justify-center gap-2`} onClick={onSignOut}>
          <LogOut size={16} /> Sign out
        </button>
        <p className="font-mono text-[9px] text-inkMuted mt-3 text-center">Athlete OS · beta</p>
      </Card>
    </>
  );
}
