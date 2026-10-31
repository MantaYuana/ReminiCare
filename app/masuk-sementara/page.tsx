'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase, pesanGalat } from '../../lib/supabase';

export default function MasukSementara() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [sandi, setSandi] = useState('');
  const [galat, setGalat] = useState<string | null>(null);

  async function masuk(e: React.FormEvent) {
    e.preventDefault();
    const { error } = await supabase.auth.signInWithPassword({ email, password: sandi });
    if (error) return setGalat(pesanGalat(error));
    router.replace('/terapis');
  }

  return (
    <form onSubmit={masuk} className="p-6 space-y-3 text-lg">
      <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" className="border p-2 block" />
      <input value={sandi} onChange={(e) => setSandi(e.target.value)} type="password" placeholder="Kata sandi" className="border p-2 block" />
      <button className="border p-2">Masuk</button>
      {galat && <p role="alert">{galat}</p>}
    </form>
  );
}
