'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { byGender, type Gender } from '@buds/shared';
import { ApiRequestError, createPairCode } from '@/lib/api';
import { forgetPlayer, getPlayer } from '@/lib/player';

/** Owners get a one-time code to link the bud to the game; visitors get a nudge to make their own. */
export function PairPanel({
  slug,
  name,
  gender,
  isNew,
}: {
  slug: string;
  name: string;
  gender: Gender;
  isNew: boolean;
}) {
  const [owner, setOwner] = useState<boolean | null>(null);
  const [code, setCode] = useState<{ code: string; expiresAt: number } | null>(null);
  const [now, setNow] = useState(Date.now());
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);

  useEffect(() => setOwner(getPlayer()?.slug === slug), [slug]);

  useEffect(() => {
    if (!code) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [code]);

  async function issue() {
    const player = getPlayer();
    if (!player) return;
    setPending(true);
    setError('');
    try {
      const res = await createPairCode(player.token);
      setCode({ code: res.code, expiresAt: Date.parse(res.expiresAt) });
      setNow(Date.now());
    } catch (err) {
      if (err instanceof ApiRequestError && err.status === 401) {
        // the guest key went with the bud onto an account (or the bud is gone): this browser is a visitor now
        forgetPlayer();
        setOwner(false);
        return;
      }
      setError(err instanceof Error ? err.message : 'Nie udało się wygenerować kodu.');
    } finally {
      setPending(false);
    }
  }

  if (owner === null) return null;

  if (!owner) {
    return (
      <section className="card panel">
        <h2>Też chcesz swojego Buda?</h2>
        <p className="muted">Stwórz ziomka na stronie, a potem graj nim w Buds.</p>
        <Link href="/" className="btn btn-primary">
          Stwórz swojego
        </Link>
      </section>
    );
  }

  const secondsLeft = code ? Math.max(0, Math.round((code.expiresAt - now) / 1000)) : 0;
  const expired = code !== null && secondsLeft === 0;

  return (
    <section className={`card panel ${isNew ? 'panel-new' : ''}`}>
      <h2>
        {isNew ? `${name} jest ${byGender(gender, 'gotowy', 'gotowa')} do gry!` : 'Połącz z grą'}
      </h2>
      <p className="muted">
        Otwórz grę Buds, wpisz kod poniżej i kliknij „Połącz”. Twój Bud pojawi się w grze ze
        wszystkimi postępami.
      </p>

      {code && !expired ? (
        <div className="pair-code">
          <span className="pair-code-value" aria-label={code.code.split('').join(' ')}>
            {code.code}
          </span>
          <span className="muted">
            ważny jeszcze {Math.floor(secondsLeft / 60)}:{String(secondsLeft % 60).padStart(2, '0')}
          </span>
        </div>
      ) : (
        <button
          type="button"
          className="btn btn-primary btn-big"
          onClick={issue}
          disabled={pending}
        >
          {pending ? 'Generuję…' : expired ? 'Kod wygasł — nowy kod' : 'Pokaż kod do gry'}
        </button>
      )}
      {error && (
        <p className="form-error" role="alert">
          {error} {error.includes('Konto') && <Link href="/konto">Przejdź do konta</Link>}
        </p>
      )}
    </section>
  );
}
