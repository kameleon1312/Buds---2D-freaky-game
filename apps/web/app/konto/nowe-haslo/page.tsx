import type { Metadata } from 'next';
import { NewPassword } from '@/components/NewPassword';

export const metadata: Metadata = { title: 'Nowe hasło', robots: { index: false } };

export default function NewPasswordPage() {
  return (
    <main className="container account-page">
      <h1>Nowe hasło</h1>
      <NewPassword />
    </main>
  );
}
