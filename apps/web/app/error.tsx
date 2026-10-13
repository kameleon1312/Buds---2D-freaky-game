'use client';

export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="container center-page">
      <h1>Ups, coś się zacięło</h1>
      <p className="lead">Serwer palów chwilowo nie odpowiada. Spróbuj ponownie za moment.</p>
      <button type="button" className="btn btn-primary btn-big" onClick={reset}>
        Spróbuj ponownie
      </button>
    </main>
  );
}
