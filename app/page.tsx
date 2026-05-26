'use client';

import { useSession } from 'next-auth/react';
import ConsoleApp from '@/components/ConsoleApp';
import LandingPage from '@/components/LandingPage';

export default function Page() {
  const { data: session, status } = useSession();

  // Show landing page while loading (default state for new visitors)
  // and when definitively unauthenticated
  if (status === 'loading' || !session) {
    // If loading and we have a session cookie hint, show dashboard loading
    if (status === 'loading' && typeof document !== 'undefined' && document.cookie.includes('next-auth')) {
      return (
        <div className="console-root console-root--light console-root--d-compact">
          <div className="cp-loading">Loading...</div>
        </div>
      );
    }
    return <LandingPage />;
  }

  return (
    <main>
      <ConsoleApp />
    </main>
  );
}
