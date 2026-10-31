// app/api/ringkasan/route.ts
// Route handler F20: Ringkasan AI latihan rumah untuk fisioterapis.
// SPEC §9 (langkah 1-12) dan PLAN §3 Fase 7.

import { createClient } from '@supabase/supabase-js';
import {
  type MasukanRingkasan,
  type RawPasien,
  type RawSesi,
  type RawEskalasi,
  PROMPT_RINGKASAN,
  bangunMasukan,
  putuskanRingkasan,
} from '../../../lib/ringkasan';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const REGEX_UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(req: Request) {
  // 1. Ekstraksi token dari header Authorization
  const authHeader =
    req.headers.get('authorization') || req.headers.get('Authorization');
  const token = authHeader?.replace(/^Bearer\s+/i, '').trim();

  if (!token) {
    return Response.json({ galat: 'tanpa_token' }, { status: 401 });
  }

  // 2. Klien Supabase dengan kredensial publik dan token pemanggil (RLS berlaku)
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !key) {
    console.error('Konfigurasi Supabase env server belum lengkap');
    return Response.json({ galat: 'kueri_gagal' }, { status: 500 });
  }

  const sb = createClient(url, key, {
    global: {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
    auth: {
      persistSession: false,
    },
  });

  // 3. Verifikasi JWT pengguna pemanggil
  const {
    data: { user },
    error: userError,
  } = await sb.auth.getUser(token);

  if (userError || !user) {
    return Response.json({ galat: 'token_tidak_sah' }, { status: 401 });
  }

  // 4. Parse JSON body dan validasi format UUID pasien_id
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ galat: 'badan_tidak_sah' }, { status: 400 });
  }

  const pasien_id = (body as Record<string, unknown>)?.pasien_id;
  if (
    !pasien_id ||
    typeof pasien_id !== 'string' ||
    !REGEX_UUID.test(pasien_id)
  ) {
    return Response.json({ galat: 'pasien_id_tidak_sah' }, { status: 400 });
  }

  // 5. Baca data pasien dan pastikan pasien milik akun fisioterapis pemanggil (RLS + verifikasi eksplisit)
  const { data: pasien, error: pasienError } = await sb
    .from('pasien')
    .select('id, terapis_id, sesi_per_minggu')
    .eq('id', pasien_id)
    .maybeSingle();

  if (pasienError) {
    console.error('Kueri pasien gagal');
    return Response.json({ galat: 'kueri_gagal' }, { status: 500 });
  }

  if (!pasien || pasien.terapis_id !== user.id) {
    return Response.json({ galat: 'akses_ditolak' }, { status: 403 });
  }

  // 6. Baca sesi 14 hari terakhir dan eskalasi terbuka
  const kini = new Date();
  const batas14HariIso = new Date(
    kini.getTime() - 14 * 86400000
  ).toISOString();

  const { data: sesi, error: sesiError } = await sb
    .from('sesi')
    .select(
      'mulai, resep, rep_terukur, pct_terkompensasi, pct_tak_terukur, nyeri, per_gerakan'
    )
    .eq('pasien_id', pasien_id)
    .gte('mulai', batas14HariIso)
    .order('mulai');

  if (sesiError) {
    console.error('Kueri sesi gagal');
    return Response.json({ galat: 'kueri_gagal' }, { status: 500 });
  }

  const { data: esk, error: eskError } = await sb
    .from('eskalasi')
    .select('dibuka, median_baseline, panjang_run, batas')
    .eq('pasien_id', pasien_id)
    .is('ditinjau', null)
    .maybeSingle();

  if (eskError) {
    console.error('Kueri eskalasi gagal');
    return Response.json({ galat: 'kueri_gagal' }, { status: 500 });
  }

  // 7. Susun agregat angka tanpa nama atau tanggal absolut
  const masukan: MasukanRingkasan = bangunMasukan(
    pasien as RawPasien,
    (sesi ?? []) as RawSesi[],
    (esk ?? null) as RawEskalasi | null,
    kini
  );

  // 8. Bila GEMINI_API_KEY atau GEMINI_MODEL kosong -> templat tanpa_kunci
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  const model = process.env.GEMINI_MODEL?.trim();

  if (!apiKey || !model) {
    const hasil = putuskanRingkasan(masukan, null, 'tanpa_kunci');
    return Response.json({ ...hasil, masukan }, { status: 200 });
  }

  // 9. Panggil Google Gemini REST API (systemInstruction, contents, temperature 0.2, maxOutputTokens 400, timeout 8s)
  let teksAi: string | null = null;
  try {
    const generationConfig: Record<string, unknown> = {
      temperature: 0.2,
      maxOutputTokens: 400,
    };

    // [default spec] dukung env opsional GEMINI_THINKING_BUDGET jika model Flash memerlukan batasan thinking budget
    const thinkingBudgetEnv = process.env.GEMINI_THINKING_BUDGET?.trim();
    if (thinkingBudgetEnv && /^-?\d+$/.test(thinkingBudgetEnv)) {
      const n = Number(thinkingBudgetEnv);
      if (Number.isInteger(n) && n >= -1) {
        generationConfig.thinkingConfig = {
          thinkingBudget: n,
        };
      }
    }

    const payload = {
      systemInstruction: { parts: [{ text: PROMPT_RINGKASAN }] },
      contents: [{ role: 'user', parts: [{ text: JSON.stringify(masukan) }] }],
      generationConfig,
    };

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey,
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(8000),
      }
    );

    if (!res.ok) {
      console.error(`Gemini HTTP gagal dengan status ${res.status}`);
      const hasil = putuskanRingkasan(masukan, null, 'api_gagal');
      return Response.json({ ...hasil, masukan }, { status: 200 });
    }

    const data = await res.json();

    if (data.promptFeedback?.blockReason) {
      console.error('Gemini prompt terblokir oleh kebijakan keamanan');
      const hasil = putuskanRingkasan(masukan, null, 'api_gagal');
      return Response.json({ ...hasil, masukan }, { status: 200 });
    }

    const cand = data.candidates?.[0];
    if (cand?.finishReason && cand.finishReason !== 'STOP') {
      console.error(`Gemini finishReason tidak wajar: ${cand.finishReason}`);
      const hasil = putuskanRingkasan(masukan, null, 'api_gagal');
      return Response.json({ ...hasil, masukan }, { status: 200 });
    }

    const parts = cand?.content?.parts;
    if (!Array.isArray(parts) || parts.length === 0) {
      console.error('Gemini candidates kosong atau terpotong');
      const hasil = putuskanRingkasan(masukan, null, 'api_gagal');
      return Response.json({ ...hasil, masukan }, { status: 200 });
    }

    teksAi = parts
      .map((p: { text?: string }) => (typeof p.text === 'string' ? p.text : ''))
      .join('')
      .trim();
  } catch (err) {
    console.error('Panggilan Gemini fetch galat atau timeout');
    const hasil = putuskanRingkasan(masukan, null, 'api_gagal');
    return Response.json({ ...hasil, masukan }, { status: 200 });
  }

  // 10-12. Evaluasi cekKalimat dan cekAngka, lalu kembalikan respons 200
  const hasil = putuskanRingkasan(masukan, teksAi);
  return Response.json({ ...hasil, masukan }, { status: 200 });
}

