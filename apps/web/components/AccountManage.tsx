'use client';

import { useState, type FormEvent } from 'react';
import {
  BUD_NAME_MAX,
  DELETE_ACCOUNT_WORDS,
  RENAME_DAYS,
  confirmsName,
  type BudRecord,
} from '@buds/shared';
import {
  deleteAccount,
  deleteAccountBud,
  exportAccount,
  logoutBudDevices,
  renameAccountBud,
} from '@/lib/api';
import { authMessage, supabase } from '@/lib/supabase';

const message = (err: unknown, fallback: string) => (err instanceof Error ? err.message : fallback);

/**
 * Managing one bud from the account: a new name (once a week), signing out every device that plays it, and
 * deleting it for good (its name typed to confirm).
 */
export function BudManage({
  bud,
  token,
  onChanged,
}: {
  bud: BudRecord;
  token: string;
  onChanged: () => Promise<void>;
}) {
  const [open, setOpen] = useState<'name' | 'delete' | null>(null);
  const [name, setName] = useState(bud.name);
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');
  const [error, setError] = useState('');

  async function run(work: () => Promise<string | void>) {
    setBusy(true);
    setError('');
    setNote('');
    try {
      const done = await work();
      if (done) setNote(done);
    } catch (err) {
      setError(message(err, 'Nie udało się.'));
    } finally {
      setBusy(false);
    }
  }

  function rename(e: FormEvent) {
    e.preventDefault();
    void run(async () => {
      await renameAccountBud(token, bud.slug, name);
      setOpen(null);
      await onChanged();
      return 'Imię zmienione.';
    });
  }

  function remove(e: FormEvent) {
    e.preventDefault();
    void run(async () => {
      await deleteAccountBud(token, bud.slug, confirm);
      await onChanged();
    });
  }

  return (
    <div className="manage">
      <div className="manage-row">
        <button
          type="button"
          className="btn btn-small"
          onClick={() => setOpen(open === 'name' ? null : 'name')}
        >
          Zmień imię
        </button>
        <button
          type="button"
          className="btn btn-small"
          disabled={busy}
          onClick={() =>
            void run(async () => {
              const n = await logoutBudDevices(token, bud.slug);
              return n > 0
                ? `Wylogowano urządzenia: ${n}.`
                : 'Żadne urządzenie nie było zalogowane.';
            })
          }
        >
          Wyloguj ze wszystkich urządzeń
        </button>
        <button
          type="button"
          className="btn btn-small btn-alert"
          onClick={() => setOpen(open === 'delete' ? null : 'delete')}
        >
          Usuń Buda
        </button>
      </div>

      {open === 'name' && (
        <form className="manage-form" onSubmit={rename}>
          <label className="field-label" htmlFor={`name-${bud.slug}`}>
            Nowe imię (zmienisz je raz na {RENAME_DAYS} dni)
          </label>
          <div className="manage-row">
            <input
              id={`name-${bud.slug}`}
              className="input"
              value={name}
              maxLength={BUD_NAME_MAX}
              onChange={(e) => setName(e.target.value)}
              autoComplete="off"
            />
            <button
              type="submit"
              className="btn btn-buds btn-small"
              disabled={busy || name.trim() === bud.name}
            >
              Zapisz
            </button>
          </div>
        </form>
      )}

      {open === 'delete' && (
        <form className="manage-form manage-danger" onSubmit={remove}>
          <p>
            <strong>To nieodwracalne.</strong> Bud zniknie razem z poziomem, ekwipunkiem, monetami,
            gemami i dystryktem. Zakupy nie są zwracane.
          </p>
          <label className="field-label" htmlFor={`del-${bud.slug}`}>
            Wpisz imię Buda: <strong>{bud.name}</strong>
          </label>
          <div className="manage-row">
            <input
              id={`del-${bud.slug}`}
              className="input"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              autoComplete="off"
            />
            <button
              type="submit"
              className="btn btn-alert btn-small"
              disabled={busy || !confirmsName(confirm, bud.name)}
            >
              Usuń na zawsze
            </button>
          </div>
        </form>
      )}

      {note && <p className="fineprint">{note}</p>}
      {error && <p className="form-error">{error}</p>}
    </div>
  );
}

/**
 * The account itself: a new password, everything about it to download, and deleting it with every bud (the
 * words typed to confirm). The website is where Google Play's "delete your account" link leads.
 */
export function AccountSettings({ token }: { token: string }) {
  const [password, setPassword] = useState('');
  const [again, setAgain] = useState('');
  const [words, setWords] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');
  const [error, setError] = useState('');

  async function run(work: () => Promise<string | void>) {
    setBusy(true);
    setError('');
    setNote('');
    try {
      const done = await work();
      if (done) setNote(done);
    } catch (err) {
      setError(message(err, 'Nie udało się.'));
    } finally {
      setBusy(false);
    }
  }

  function changePassword(e: FormEvent) {
    e.preventDefault();
    if (password !== again) {
      setError('Hasła się różnią.');
      return;
    }
    void run(async () => {
      const { error: err } = await supabase()!.auth.updateUser({ password });
      if (err) throw new Error(authMessage(err.message));
      setPassword('');
      setAgain('');
      return 'Hasło zmienione.';
    });
  }

  function download() {
    void run(async () => {
      const blob = await exportAccount(token);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'buds-moje-dane.json';
      a.click();
      URL.revokeObjectURL(url);
      return 'Pobrano plik z twoimi danymi.';
    });
  }

  function remove(e: FormEvent) {
    e.preventDefault();
    void run(async () => {
      await deleteAccount(token);
      await supabase()!.auth.signOut();
    });
  }

  return (
    <section className="card panel account-settings">
      <h2>Ustawienia konta</h2>

      <form className="manage-form" onSubmit={changePassword}>
        <span className="field-label">Nowe hasło</span>
        <div className="manage-row">
          <input
            className="input"
            type="password"
            autoComplete="new-password"
            minLength={8}
            placeholder="Co najmniej 8 znaków"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <input
            className="input"
            type="password"
            autoComplete="new-password"
            placeholder="Powtórz hasło"
            value={again}
            onChange={(e) => setAgain(e.target.value)}
          />
          <button type="submit" className="btn btn-small" disabled={busy || password.length < 8}>
            Zmień hasło
          </button>
        </div>
      </form>

      <div className="manage-row">
        <button type="button" className="btn btn-small" disabled={busy} onClick={download}>
          Pobierz moje dane
        </button>
        <button
          type="button"
          className="btn btn-small btn-alert"
          onClick={() => setDeleting(!deleting)}
        >
          Usuń konto
        </button>
      </div>

      {deleting && (
        <form className="manage-form manage-danger" onSubmit={remove}>
          <p>
            <strong>To nieodwracalne.</strong> Usuniemy konto i wszystkie Budy na nim, z ich
            postępami, przedmiotami, monetami, gemami i dystryktami. Zakupy nie są zwracane.
          </p>
          <label className="field-label" htmlFor="delete-account">
            Wpisz <strong>{DELETE_ACCOUNT_WORDS}</strong>
          </label>
          <div className="manage-row">
            <input
              id="delete-account"
              className="input"
              value={words}
              onChange={(e) => setWords(e.target.value)}
              autoComplete="off"
            />
            <button
              type="submit"
              className="btn btn-alert btn-small"
              disabled={busy || words.trim() !== DELETE_ACCOUNT_WORDS}
            >
              Usuń konto na zawsze
            </button>
          </div>
        </form>
      )}

      {note && <p className="fineprint on-dark">{note}</p>}
      {error && <p className="form-error on-dark">{error}</p>}
    </section>
  );
}
