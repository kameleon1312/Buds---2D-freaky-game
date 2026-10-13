'use client';

import { useEffect, useState } from 'react';
import { createClient, type Session, type SupabaseClient } from '@supabase/supabase-js';

// public values: the URL and the publishable (anon) key — never the secret key
const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

let client: SupabaseClient | null | undefined;

/** The browser Supabase client for accounts, or null when the site runs without Supabase (local dev). */
export function supabase(): SupabaseClient | null {
  if (client === undefined) {
    client =
      URL && KEY
        ? createClient(URL, KEY, {
            auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
          })
        : null;
  }
  return client;
}

/** The signed-in user's access token (sent to the API), if any. */
export async function accessToken(): Promise<string | null> {
  const s = supabase();
  if (!s) return null;
  const { data } = await s.auth.getSession();
  return data.session?.access_token ?? null;
}

/** Current session: undefined while loading, null when signed out. */
export function useSession(): Session | null | undefined {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  useEffect(() => {
    const s = supabase();
    if (!s) {
      setSession(null);
      return;
    }
    s.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = s.auth.onAuthStateChange((_event, next) => setSession(next));
    return () => data.subscription.unsubscribe();
  }, []);
  return session;
}

/** Supabase auth errors in Polish. */
export function authMessage(message: string): string {
  const m = message.toLowerCase();
  if (m.includes('invalid login')) return 'Zły e-mail albo hasło.';
  if (m.includes('not confirmed'))
    return 'Najpierw potwierdź e-mail: kliknij link z wiadomości od nas.';
  if (m.includes('already registered')) return 'To konto już istnieje. Zaloguj się.';
  if (m.includes('password should be')) return 'Hasło jest za słabe: co najmniej 8 znaków.';
  if (m.includes('rate limit') || m.includes('too many'))
    return 'Za dużo prób. Odczekaj chwilę i spróbuj ponownie.';
  if (m.includes('valid email') || m.includes('invalid email')) return 'Sprawdź adres e-mail.';
  return 'Coś poszło nie tak. Spróbuj ponownie.';
}
