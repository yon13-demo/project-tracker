'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Globe2, Terminal } from 'lucide-react';
import { supabase } from '@/lib/supabase';

const DEV_DOMAINS = ['leonxlab.app', 'leonxlab.digital'];

export default function LoginDev() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [domain, setDomain] = useState(DEV_DOMAINS[0]);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Kalau sudah login, redirect ke home
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) router.replace('/');
    });
  }, [router]);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!username.trim()) { setError('Masukkan username.'); return; }
    const email = `${username.trim()}@${domain}`;
    setLoading(true);
    const { error: err } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (err) setError(err.message);
    else router.replace('/');
  }

  return (
    <main style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: '#0f0f0f' }}>
      {/* Topbar */}
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 24px', borderBottom: '1px solid #1e1e1e' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#e5e5e5', fontWeight: 700, fontSize: 18 }}>
          <Image src="/logo/weaver.svg" alt="Weaver" width={36} height={36} style={{ objectFit: 'contain' }} />
          Weaver <span style={{ color: '#6366f1', fontSize: 12, fontWeight: 600, background: '#1e1b4b', padding: '2px 8px', borderRadius: 20 }}>DEV</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#6366f1', fontSize: 13 }}>
          <Terminal size={14} /> Developer Portal
        </div>
      </header>

      {/* Card */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <div style={{
          width: '100%', maxWidth: 400,
          background: '#161616',
          border: '1px solid #2a2a2a',
          borderRadius: 16,
          padding: '32px 28px',
          boxShadow: '0 0 40px rgba(99,102,241,0.08)'
        }}>
          <h1 style={{ color: '#e5e5e5', fontSize: 22, fontWeight: 700, marginBottom: 4 }}>Developer Login</h1>
          <p style={{ color: '#666', fontSize: 13, marginBottom: 28 }}>
            Gunakan akun LeonxLab untuk mengakses portal dev.
          </p>

          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Username + domain */}
            <div>
              <label style={{ display: 'block', color: '#999', fontSize: 12, marginBottom: 6, fontWeight: 500 }}>
                Email
              </label>
              <div style={{ display: 'flex', gap: 8, alignItems: 'stretch' }}>
                <input
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  placeholder="username"
                  required
                  style={{
                    flex: 1, padding: '10px 12px', borderRadius: 8,
                    background: '#1e1e1e', border: '1px solid #2e2e2e',
                    color: '#e5e5e5', fontSize: 14, outline: 'none'
                  }}
                />
                <span style={{
                  display: 'flex', alignItems: 'center',
                  color: '#555', fontSize: 14, userSelect: 'none', whiteSpace: 'nowrap'
                }}>@</span>
                <select
                  value={domain}
                  onChange={e => setDomain(e.target.value)}
                  style={{
                    padding: '10px 10px', borderRadius: 8,
                    background: '#1e1e1e', border: '1px solid #2e2e2e',
                    color: '#6366f1', fontSize: 13, cursor: 'pointer', outline: 'none'
                  }}
                >
                  {DEV_DOMAINS.map(d => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>
              <div style={{ marginTop: 6, color: '#444', fontSize: 12 }}>
                → {username ? `${username}@${domain}` : <span style={{ fontStyle: 'italic' }}>username@{domain}</span>}
              </div>
            </div>

            {/* Password */}
            <div>
              <label style={{ display: 'block', color: '#999', fontSize: 12, marginBottom: 6, fontWeight: 500 }}>
                Password
              </label>
              <input
                value={password}
                onChange={e => setPassword(e.target.value)}
                type="password"
                required
                minLength={6}
                placeholder="••••••••"
                style={{
                  width: '100%', padding: '10px 12px', borderRadius: 8,
                  background: '#1e1e1e', border: '1px solid #2e2e2e',
                  color: '#e5e5e5', fontSize: 14, outline: 'none', boxSizing: 'border-box'
                }}
              />
            </div>

            {error && (
              <div style={{
                background: '#1f0a0a', border: '1px solid #5c1a1a',
                borderRadius: 8, padding: '10px 14px', color: '#f87171', fontSize: 13
              }}>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              style={{
                padding: '12px', borderRadius: 8, border: 'none', cursor: loading ? 'not-allowed' : 'pointer',
                background: loading ? '#2a2a5e' : '#6366f1', color: '#fff',
                fontWeight: 600, fontSize: 15, transition: 'background 0.2s'
              }}
            >
              {loading ? 'Masuk…' : 'Masuk sebagai Developer'}
            </button>
          </form>

          <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid #1e1e1e', textAlign: 'center' }}>
            <a
              href="/"
              style={{ color: '#555', fontSize: 12, textDecoration: 'none' }}
            >
              ← Kembali ke halaman utama
            </a>
          </div>
        </div>
      </div>
    </main>
  );
}
