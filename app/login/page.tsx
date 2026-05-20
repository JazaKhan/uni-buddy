'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    const supabase = createClient();
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password });

    if (authError) {
      setError(authError.message);
      setLoading(false);
    } else {
      router.push('/dashboard');
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6" style={{ backgroundColor: '#8FAF76' }}>
      <div className="w-full max-w-md p-8 rounded-3xl shadow-lg flex flex-col gap-6" style={{ backgroundColor: '#FEFEE8' }}>
        <div className="text-center">
          <h1 className="text-2xl font-black tracking-tight text-gray-800">UNI-BUDDY</h1>
          <p className="text-sm text-gray-500 mt-1">Sign in to your account</p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="px-4 py-2 rounded-xl border border-gray-200 text-sm outline-none focus:ring-2 focus:ring-yellow-300"
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="px-4 py-2 rounded-xl border border-gray-200 text-sm outline-none focus:ring-2 focus:ring-yellow-300"
          />

          {error && <p className="text-red-500 text-xs">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2 rounded-full text-sm font-bold text-gray-800 hover:opacity-80 transition-opacity disabled:opacity-50"
            style={{ backgroundColor: '#F5C842' }}
          >
            {loading ? 'Signing in…' : 'Login'}
          </button>
        </form>

        <p className="text-center text-sm text-gray-600">
          Don&apos;t have an account?{' '}
          <button onClick={() => router.push('/signup')} className="font-bold text-gray-800 hover:underline">
            Sign Up
          </button>
        </p>

        <div className="border-t border-gray-200 pt-4 flex flex-col items-center gap-2">
          <p className="text-xs text-gray-400">Just exploring?</p>
          <button
            type="button"
            onClick={() => { setEmail('demo@uni-buddy.com'); setPassword('demo1234'); }}
            className="w-full py-2 rounded-full text-sm font-semibold text-gray-600 border border-gray-300 hover:border-gray-400 hover:text-gray-800 transition-colors"
            style={{ backgroundColor: 'transparent' }}
          >
            Try Demo
          </button>
        </div>
      </div>
    </div>
  );
}
