'use client';
import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { Card, Eyebrow, Empty, H2, Sub, inputCls, btnCls, btnSecondary, btnGold } from './ui';
import { Heart, MessageCircle, Video, Image as ImageIcon } from 'lucide-react';

export default function Feed({ session, profile, dayLog, recentMatches, streak }) {
  const [posts, setPosts] = useState([]);
  const [note, setNote] = useState('');
  const [media, setMedia] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [openComments, setOpenComments] = useState(null);
  const [comments, setComments] = useState([]);
  const [commentText, setCommentText] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const { data } = await supabase.rpc('get_feed');
    setPosts(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function post(kind, content, withMedia) {
    if (!content.trim() && !withMedia) return;
    setUploading(true);
    try {
      let media_url = null, media_type = null;
      if (withMedia) {
        const path = `${session.user.id}/feed/${Date.now()}-${withMedia.name}`;
        const { error } = await supabase.storage.from('athlete-os-media').upload(path, withMedia);
        if (!error) {
          media_url = supabase.storage.from('athlete-os-media').getPublicUrl(path).data.publicUrl;
          media_type = withMedia.type.startsWith('video') ? 'video' : 'image';
        }
      }
      await supabase.from('feed_posts').insert({ user_id: session.user.id, kind, content: content || '', media_url, media_type });
      setNote(''); setMedia(null);
      load();
    } finally {
      setUploading(false);
    }
  }

  async function toggleLike(p) {
    if (p.liked_by_me) {
      await supabase.from('feed_likes').delete().eq('post_id', p.id).eq('user_id', session.user.id);
    } else {
      await supabase.from('feed_likes').insert({ post_id: p.id, user_id: session.user.id });
    }
    load();
  }

  async function openThread(postId) {
    if (openComments === postId) { setOpenComments(null); return; }
    setOpenComments(postId);
    const { data } = await supabase.rpc('get_feed_comments', { p_post_id: postId });
    setComments(data || []);
  }

  async function sendComment(postId) {
    if (!commentText.trim()) return;
    await supabase.from('feed_comments').insert({ post_id: postId, user_id: session.user.id, content: commentText });
    setCommentText('');
    const { data } = await supabase.rpc('get_feed_comments', { p_post_id: postId });
    setComments(data || []);
    load();
  }

  const lastMatch = recentMatches[recentMatches.length - 1];

  return (
    <>
      <Card>
        <Eyebrow>Share with friends</Eyebrow>
        <H2>{profile?.is_coach ? 'Post an update or a coaching tip' : "What's worth sharing today?"}</H2>
        <Sub>Visible to your accepted friends only — not a private inbox, just your wins (or tips) in one place.</Sub>
        <div className="grid grid-cols-2 gap-2 mb-2">
          {streak > 0 && <button className={btnSecondary} onClick={() => post('streak', `${streak}-day streak and counting 🔥`)}>Share streak ({streak})</button>}
          {lastMatch && <button className={btnSecondary} onClick={() => post('match', `Match: ${lastMatch.runs ?? '-'} runs${lastMatch.wickets ? `, ${lastMatch.wickets} wkts` : ''} vs ${lastMatch.opponent || 'opponent'}`)}>Share last match</button>}
        </div>
        <textarea className={inputCls} value={note} onChange={(e) => setNote(e.target.value)}
          placeholder={profile?.is_coach ? "Share a tip, or describe the video you're attaching..." : 'Or write your own update...'} />
        <label className={`${btnSecondary} w-full mt-2 flex items-center justify-center gap-2 cursor-pointer`}>
          {media?.type?.startsWith('video') ? <Video size={16} /> : <ImageIcon size={16} />}
          {media ? media.name : (profile?.is_coach ? 'Attach a photo or coaching video' : 'Attach a photo (optional)')}
          <input type="file" accept="image/*,video/*" className="hidden" onChange={(e) => setMedia(e.target.files?.[0] || null)} />
        </label>
        <button className={`${profile?.is_coach ? btnGold : btnCls} w-full mt-2`} onClick={() => post(profile?.is_coach && media?.type?.startsWith('video') ? 'coaching_tip' : 'note', note, media)} disabled={uploading}>
          {uploading ? 'Posting…' : 'Post'}
        </button>
      </Card>

      <Card>
        <Eyebrow>Feed</Eyebrow>
        {loading && <Sub>Loading…</Sub>}
        {!loading && posts.length === 0 && <Empty>Nothing yet — add friends in Profile, or post your own update above.</Empty>}
        {posts.map((p) => (
          <div key={p.id} className="py-3 border-b border-ink/10 last:border-0">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-seam/10 flex items-center justify-center font-display text-seam text-sm overflow-hidden">
                {p.author_avatar ? <img src={p.author_avatar} alt="" className="w-full h-full object-cover" /> : p.author_name?.[0]?.toUpperCase()}
              </div>
              <div className="font-semibold text-sm">{p.author_name}</div>
              {p.author_is_coach && <span className="font-mono text-[8px] bg-willow/20 text-willow px-1.5 py-0.5 rounded-full uppercase">Coach</span>}
              <div className="font-mono text-[9px] text-inkMuted ml-auto">{new Date(p.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}</div>
            </div>
            {p.content && <p className="font-serif text-sm mt-1.5">{p.content}</p>}
            {p.media_url && p.media_type === 'video' && (
              <video src={p.media_url} controls className="w-full rounded-lg mt-2 max-h-72 bg-black" />
            )}
            {p.media_url && p.media_type === 'image' && (
              <img src={p.media_url} alt="" className="w-full rounded-lg mt-2 max-h-72 object-cover" />
            )}
            <div className="flex gap-4 mt-2">
              <button onClick={() => toggleLike(p)} className={`flex items-center gap-1 text-xs font-mono ${p.liked_by_me ? 'text-seam' : 'text-inkMuted'}`}>
                <Heart size={14} fill={p.liked_by_me ? '#AE3529' : 'none'} /> {p.like_count}
              </button>
              <button onClick={() => openThread(p.id)} className="flex items-center gap-1 text-xs font-mono text-inkMuted">
                <MessageCircle size={14} /> {p.comment_count}
              </button>
            </div>
            {openComments === p.id && (
              <div className="mt-2 pl-2 border-l-2 border-ink/10">
                {comments.map((c) => (
                  <div key={c.id} className="text-xs font-serif py-1"><b>{c.author_name}</b> {c.content}</div>
                ))}
                <div className="flex gap-2 mt-1">
                  <input className={`${inputCls} !py-1.5 !text-xs`} value={commentText} onChange={(e) => setCommentText(e.target.value)} placeholder="Reply..." />
                  <button className="font-mono text-xs text-seam" onClick={() => sendComment(p.id)}>Send</button>
                </div>
              </div>
            )}
          </div>
        ))}
      </Card>
    </>
  );
}
