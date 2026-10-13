'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { authMessage, supabase, useSession } from '@/lib/supabase';

/** The link from the reset e-mail signs the user in; here they choose the new password. */
export function NewPassword() {
  const session = useSession();
  const [password, setPassword] = useState('');
  const [repeat, setRepeat] = useState('');
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (password.length < 8) return setError('Hasło musi mieć co najmniej 8 znaków.');
    if (password !== repeat) return setError('Hasła się różnią.');
    setPending(true);
    const { error: err } = await supabase()!.auth.updateUser({ password });
    setPending(false);
    if (err) return setError(authMessage(err.message));
    setDone(true);
  }

  if (session === undefined) return <p className="muted">Wczytuję…</p>;
  if (!session || !supabase())
    return (
      <section className="card panel">
        <h2>Link wygasł</h2>
        <p className="muted">Poproś o nowy link na stronie logowania.</p>
        <Link href="/konto" className="btn">
          Do logowania
        </Link>
      </section>
    );
  if (done)
    return (
      <section className="card panel">
        <h2>Hasło zmienione</h2>
        <Link href="/konto" className="btn btn-primary">
          Przejdź do konta
        </Link>
      </section>
    );
  return (
    <section className="card auth">
      <form className="auth-form" onSubmit={onSubmit} noValidate>
        <label className="field">
          <span className="field-label">Nowe hasło</span>
          <input
            className="input"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        <label className="field">
          <span className="field-label">Powtórz hasło</span>
          <input
            className="input"
            type="password"
            autoComplete="new-password"
            value={repeat}
            onChange={(e) => setRepeat(e.target.value)}
          />
        </label>
        {error && <p className="form-error">{error}</p>}
        <button type="submit" className="btn btn-primary btn-big" disabled={pending}>
          Zapisz hasło
        </button>
      </form>
    </section>
  );
}
