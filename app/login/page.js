'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabaseClient';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState('signin');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (mode === 'signin') {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
      }
      router.push('/');
      router.refresh();
    } catch (err) {
      setError(err.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <h1 className="font-display font-extrabold text-5xl text-center mb-1 text-cream tracking-tight">
          ATHLETE<span className="text-seam">OS</span>
        </h1>
        <div className="seam-rule mb-6" />
        <div className="bg-paper text-ink rounded-xl p-6 shadow-lg shadow-black/30">
          <p className="font-serif italic text-inkMuted text-sm mb-5">
            {mode === 'signin' ? 'Sign in to your scorecard.' : 'Start your own scorecard.'}
          </p>
          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label className="block font-mono text-[10px] uppercase tracking-wide text-inkMuted mb-1">Email</label>
              <input
                type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-white border border-ink/15 rounded-lg px-3 py-2 text-ink text-sm"
              />
            </div>
            <div>
              <label className="block font-mono text-[10px] uppercase tracking-wide text-inkMuted mb-1">Password</label>
              <input
                type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-white border border-ink/15 rounded-lg px-3 py-2 text-ink text-sm"
              />
            </div>
            {error && <p className="text-seam text-xs font-mono">{error}</p>}
            <button
              type="submit" disabled={loading}
              className="w-full bg-seam text-paper font-semibold rounded-lg py-3 mt-2 disabled:opacity-60"
            >
              {loading ? 'Please wait...' : mode === 'signin' ? 'Sign in' : 'Create account'}
            </button>
          </form>
          <button
            className="text-inkMuted text-xs mt-4 underline font-mono"
            onClick={() => setMode(mode === 'signin' ? 'signup' : 'signin')}
          >
            {mode === 'signin' ? "Don't have an account? Sign up" : 'Already have an account? Sign in'}
          </button>
        </div>
      </div>
    </div>
  );
}
