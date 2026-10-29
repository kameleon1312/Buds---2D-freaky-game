'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import {
  PAIR_CODE_TTL_MINUTES,
  SLOTS,
  STATS,
  catalogItem,
  levelFromXp,
  moodLabel,
  type AccountBud,
} from '@buds/shared';
import { accountPairCode, claimBud, getAccountBuds, getMyBud, linkBud } from '@/lib/api';
import { getPlayer } from '@/lib/player';
import { authMessage, supabase, useSession } from '@/lib/supabase';
import { plural } from '@/lib/plural';
import { AccountSettings, BudManage } from './AccountManage';
import { BudSprite } from './BudSprite';

type Mode = 'login' | 'register' | 'reset';

/** Sign in / sign up (e-mail + password) and, once signed in, the private view of the account's buds. */
export function AccountPanel() {
  const session = useSession();
  if (!supabase()) {
    return (
      <div className="auth-center">
        <section className="card panel auth">
          <h2>Konta są wyłączone</h2>
          <p className="muted">
            Ta wersja strony nie ma ustawionego połączenia z Supabase (NEXT_PUBLIC_SUPABASE_URL i
            NEXT_PUBLIC_SUPABASE_ANON_KEY), więc logowanie i rejestracja nie działają. Twój Bud jest
            zapisany w tej przeglądarce.
          </p>
        </section>
      </div>
    );
  }
  if (session === undefined)
    return (
      <div className="auth-center">
        <p className="muted">Wczytuję…</p>
      </div>
    );
  return session ? (
    <Dashboard email={session.user.email ?? ''} token={session.access_token} />
  ) : (
    <AuthForm />
  );
}

function AuthForm() {
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [repeat, setRepeat] = useState('');
  const [consent, setConsent] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const s = supabase()!;
    setError('');
    setInfo('');
    if (mode === 'register') {
      if (password.length < 8) return setError('Hasło musi mieć co najmniej 8 znaków.');
      if (password !== repeat) return setError('Hasła się różnią.');
      if (!consent) return setError('Zaakceptuj zasady prywatności.');
    }
    setPending(true);
    const redirect = `${window.location.origin}/konto`;
    const { error: err, data } =
      mode === 'login'
        ? await s.auth.signInWithPassword({ email, password })
        : mode === 'register'
          ? await s.auth.signUp({ email, password, options: { emailRedirectTo: redirect } })
          : await s.auth.resetPasswordForEmail(email, {
              redirectTo: `${window.location.origin}/konto/nowe-haslo`,
            });
    setPending(false);
    if (err) return setError(authMessage(err.message));
    if (mode === 'register' && data && 'session' in data && !data.session)
      setInfo('Gotowe! Wysłaliśmy ci e-mail z linkiem. Kliknij go, żeby potwierdzić konto.');
    if (mode === 'reset')
      setInfo('Jeśli to konto istnieje, wysłaliśmy link do ustawienia nowego hasła.');
  }

  const titles: Record<Mode, string> = {
    login: 'Zaloguj się',
    register: 'Załóż konto',
    reset: 'Nowe hasło',
  };

  return (
    <div className="auth-center">
      <section className="card auth">
        <div className="tabs" role="tablist">
          {(['login', 'register'] as const).map((m) => (
            <button
              key={m}
              type="button"
              role="tab"
              aria-selected={mode === m}
              className="chip"
              aria-pressed={mode === m}
              onClick={() => {
                setMode(m);
                setError('');
                setInfo('');
              }}
            >
              {titles[m]}
            </button>
          ))}
        </div>
        <form className="auth-form" onSubmit={onSubmit} noValidate>
          <h2>{titles[mode]}</h2>
          {mode === 'register' && (
            <p className="muted">
              Konto przechowuje twoje Budy, ich postępy, ekwipunek i monety. Przetrwa zmianę
              telefonu i przeglądarki.
            </p>
          )}
          <label className="field">
            <span className="field-label">E-mail</span>
            <input
              className="input"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </label>
          {mode !== 'reset' && (
            <label className="field">
              <span className="field-label">Hasło</span>
              <input
                className="input"
                type="password"
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={8}
                required
              />
            </label>
          )}
          {mode === 'register' && (
            <>
              <label className="field">
                <span className="field-label">Powtórz hasło</span>
                <input
                  className="input"
                  type="password"
                  autoComplete="new-password"
                  value={repeat}
                  onChange={(e) => setRepeat(e.target.value)}
                  required
                />
              </label>
              <label className="consent">
                <input
                  type="checkbox"
                  checked={consent}
                  onChange={(e) => setConsent(e.target.checked)}
                />
                <span>
                  Akceptuję <Link href="/prywatnosc">zasady prywatności</Link>.
                </span>
              </label>
            </>
          )}
          {error && <p className="form-error">{error}</p>}
          {info && <p className="notice">{info}</p>}
          <button type="submit" className="btn btn-primary btn-big" disabled={pending}>
            {pending ? 'Chwila…' : titles[mode]}
          </button>
          {mode === 'login' ? (
            <button type="button" className="link-button" onClick={() => setMode('reset')}>
              Nie pamiętam hasła
            </button>
          ) : (
            mode === 'reset' && (
              <button type="button" className="link-button" onClick={() => setMode('login')}>
                Wróć do logowania
              </button>
            )
          )}
        </form>
      </section>
    </div>
  );
}

function Dashboard({ email, token }: { email: string; token: string }) {
  const [buds, setBuds] = useState<AccountBud[] | null>(null);
  const [error, setError] = useState('');
  const [guest, setGuest] = useState<{ name: string; token: string } | null>(null);
  const [claiming, setClaiming] = useState(false);

  const load = useCallback(async () => {
    try {
      const { buds: list } = await getAccountBuds(token);
      setBuds(list);
      // a bud made in this browser before signing in can join the account
      const player = getPlayer();
      if (player && !list.some((b) => b.bud.slug === player.slug)) {
        const bud = await getMyBud(player.token).catch(() => null);
        setGuest(bud ? { name: bud.name, token: player.token } : null);
      } else setGuest(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nie udało się wczytać konta.');
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  async function claim() {
    if (!guest) return;
    setClaiming(true);
    setError('');
    try {
      await claimBud(token, guest.token);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nie udało się dodać Buda.');
    } finally {
      setClaiming(false);
    }
  }

  return (
    <div className="account">
      <section className="card panel account-head">
        <div>
          <h2>Twoje konto</h2>
          <p className="muted">{email}</p>
        </div>
        <button type="button" className="btn" onClick={() => void supabase()!.auth.signOut()}>
          Wyloguj
        </button>
      </section>

      {guest && (
        <section className="card panel panel-new">
          <h2>Bud z tej przeglądarki: {guest.name}</h2>
          <p className="muted">
            Dodaj go do konta, żeby jego postępy, ekwipunek i monety były bezpieczne na każdym
            urządzeniu.
          </p>
          <button type="button" className="btn btn-primary" onClick={claim} disabled={claiming}>
            {claiming ? 'Dodaję…' : 'Dodaj do konta'}
          </button>
        </section>
      )}

      <LinkFromGame token={token} onLinked={load} />

      {error && <p className="form-error on-dark">{error}</p>}
      {buds === null && !error && <p className="muted">Wczytuję twoje Budy…</p>}
      {buds?.length === 0 && (
        <section className="card panel">
          <h2>Nie masz jeszcze Buda</h2>
          <p className="muted">Stwórz pierwszego: od razu trafi na to konto.</p>
          <Link href="/#kreator" className="btn btn-buds">
            Stwórz Buda
          </Link>
        </section>
      )}
      <div className="bud-cards">
        {buds?.map((b) => (
          <BudCard key={b.bud.slug} data={b} token={token} onChanged={load} />
        ))}
      </div>
      {buds && buds.length > 0 && (
        <p className="fineprint on-dark">
          Te dane widzisz tylko ty. Publiczny profil pokazuje jedynie imię, wygląd i poziom.{' '}
          <Link href="/#kreator">Stwórz kolejnego Buda</Link>
        </p>
      )}
      <AccountSettings token={token} />
    </div>
  );
}

/** A bud made in the game joins the account with the code the game shows (Twój Bud → Połącz z kontem). */
function LinkFromGame({ token, onLinked }: { token: string; onLinked: () => Promise<void> }) {
  const [code, setCode] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState('');

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setDone('');
    const clean = code.trim().toUpperCase();
    if (clean.length !== 6) return setError('Kod ma 6 znaków.');
    setPending(true);
    try {
      const linked = await linkBud(token, clean);
      setDone(`${linked.bud.name} jest teraz na twoim koncie.`);
      setCode('');
      await onLinked();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nie udało się połączyć Buda.');
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="card panel">
      <h2>Bud z gry</h2>
      <p className="muted">
        Masz Buda stworzonego w grze? W grze otwórz „Twój Bud” → „Połącz z kontem” i wpisz tutaj
        kod.
      </p>
      <form className="link-form" onSubmit={onSubmit} noValidate>
        <input
          className="input code-input"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="KOD"
          maxLength={6}
          autoComplete="off"
          aria-label="Kod z gry"
        />
        <button type="submit" className="btn btn-buds" disabled={pending}>
          {pending ? 'Łączę…' : 'Połącz'}
        </button>
      </form>
      {error && <p className="form-error">{error}</p>}
      {done && <p className="notice">{done}</p>}
    </section>
  );
}

function BudCard({
  data,
  token,
  onChanged,
}: {
  data: AccountBud;
  token: string;
  onChanged: () => Promise<void>;
}) {
  const { bud } = data;
  const info = levelFromXp(bud.xp);
  const [code, setCode] = useState<string | null>(null);
  const [error, setError] = useState('');

  async function pair() {
    setError('');
    try {
      setCode((await accountPairCode(token, bud.slug)).code);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nie udało się.');
    }
  }

  return (
    <article className="card bud-card">
      <div className="bud-card-head">
        <BudSprite look={bud.look} height={120} />
        <div>
          <h3>{bud.name}</h3>
          <p className="muted">
            {moodLabel(bud.look.mood, bud.look.gender)} · poziom {info.level} · {bud.xp} XP
          </p>
          <div className="stat-pills">
            <span className="pill">
              {data.coins} {plural(data.coins, 'moneta', 'monety', 'monet')}
            </span>
            <span className="pill">
              {data.questsDone} {plural(data.questsDone, 'zadanie', 'zadania', 'zadań')}
            </span>
            <span className="pill">
              {data.cachesFound} {plural(data.cachesFound, 'skrytka', 'skrytki', 'skrytek')}
            </span>
          </div>
        </div>
      </div>

      <h4>Statystyki</h4>
      <div className="stats">
        {STATS.map((s) => (
          <div key={s.id} className="stat">
            <span>{s.name}</span>
            <span className="stat-bar" aria-hidden>
              <span style={{ width: `${(data.stats[s.id] / s.max) * 100}%` }} />
            </span>
            <strong>{s.unit === '%' ? `+${data.stats[s.id]}%` : data.stats[s.id]}</strong>
          </div>
        ))}
      </div>

      <h4>Ekwipunek</h4>
      <ul className="gear-list">
        {SLOTS.map((s) => {
          const id = data.equipment[s.id];
          return (
            <li key={s.id}>
              <span className="muted">{s.name}</span>
              <span>{id ? (catalogItem(id)?.name ?? id) : '—'}</span>
            </li>
          );
        })}
      </ul>
      <p className="fineprint">
        Przedmiotów: {data.items.length}. Zakładasz je w grze, w panelu „Twój Bud”.
      </p>

      <div className="bud-card-actions">
        {code ? (
          <p className="pair-code">
            <span className="pair-code-value">{code}</span>
            <span className="muted">
              Wpisz ten kod w grze. Ważny {PAIR_CODE_TTL_MINUTES} minut.
            </span>
          </p>
        ) : (
          <button type="button" className="btn btn-buds" onClick={pair}>
            Kod do gry
          </button>
        )}
        <Link href={`/b/${bud.slug}`} className="btn">
          Profil publiczny
        </Link>
      </div>
      {error && <p className="form-error">{error}</p>}
      <BudManage bud={bud} token={token} onChanged={onChanged} />
    </article>
  );
}
