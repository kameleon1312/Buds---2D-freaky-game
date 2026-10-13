import type { Metadata } from 'next';
import { AccountPanel } from '@/components/AccountPanel';

export const metadata: Metadata = {
  title: 'Konto',
  description: 'Twoje konto Buds: Budy, postępy, ekwipunek i monety w jednym bezpiecznym miejscu.',
  robots: { index: false },
};

export default function AccountPage() {
  return (
    <main className="container account-page">
      <h1>Konto</h1>
      <AccountPanel />
    </main>
  );
}
