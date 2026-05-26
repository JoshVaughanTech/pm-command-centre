'use client';

import { useSession } from 'next-auth/react';
import ConsoleApp from '@/components/ConsoleApp';
import LandingPage from '@/components/LandingPage';

export default function Page() {
  const { data: session, status } = useSession();

  if (status === 'loading') {
    return (
      <div className="console-root console-root--light console-root--d-compact">
        <div className="cp-loading">Loading...</div>
      </div>
    );
  }

  if (!session) {
    return <LandingPage />;
  }

  return (
    <main>
      <ConsoleApp />
    </main>
  );
}
