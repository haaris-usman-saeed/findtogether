import { useEffect, useRef, useState, type ReactNode } from 'react';
import { NavLink, useLocation } from 'react-router';
import { cx } from '../../lib/cx';
import { api } from '../../services';
import { useConnection } from '../../state/async';
import { ROLE_LABEL, useSession } from '../../state/session';
import { Button } from '../ui/Button';
import { Notice } from '../ui/Notice';
import { CONNECTION_META, ConnectionIndicator } from './ConnectionIndicator';

function OfflineBanner() {
  const health = useConnection();
  const { session } = useSession();
  const [checking, setChecking] = useState(false);
  if (health !== 'offline') return null;

  const check = async () => {
    setChecking(true);
    try {
      await api.getShelters(session);
    } catch {
      // Health updates from the result; nothing else to do.
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="mx-auto max-w-6xl px-4 pt-4 sm:px-6 print:hidden">
      <Notice
        tone="danger"
        title="You’re offline"
        action={
          <Button onClick={check} loading={checking}>
            {checking ? 'Checking' : 'Check connection'}
          </Button>
        }
      >
        <p>{CONNECTION_META.offline.detail} What you’ve typed stays on screen until you reload.</p>
      </Notice>
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const { session } = useSession();
  const location = useLocation();
  const previousPath = useRef(location.pathname);

  useEffect(() => {
    if (previousPath.current === location.pathname) return;
    previousPath.current = location.pathname;
    window.scrollTo(0, 0);
    document.getElementById('page-title')?.focus();
  }, [location.pathname]);

  const items = [
    { to: '/', label: 'Home', end: true },
    { to: '/register', label: 'Register' },
    { to: '/search', label: 'Find family' },
    { to: '/status', label: 'Check a request' },
    ...(session.role === 'coordinator' ? [{ to: '/cases', label: 'Cases' }] : []),
  ];

  return (
    <div className="min-h-screen bg-canvas text-ink">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded focus:bg-surface focus:px-4 focus:py-2 focus:font-semibold"
      >
        Skip to main content
      </a>
      <p className="border-b border-line bg-sunk px-4 py-1.5 text-center text-sm text-ink-muted print:hidden">
        Demonstration with fictional people and places. Not for use in a real emergency.
      </p>
      <header className="border-b border-line bg-surface print:hidden">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-8 gap-y-1 px-4 pt-2 sm:px-6 md:py-2">
          <NavLink to="/" end className="inline-flex min-h-11 items-center text-lg font-semibold tracking-[-0.01em] text-ink">
            FindTogether
          </NavLink>
          <nav aria-label="Main" className="order-last -mx-3 w-[calc(100%+1.5rem)] pb-1.5 md:order-none md:mx-0 md:w-auto md:pb-0">
            <ul className="flex flex-wrap gap-x-1 gap-y-0.5">
              {items.map((item) => (
                <li key={item.to}>
                  <NavLink
                    to={item.to}
                    end={item.end}
                    className={({ isActive }) =>
                      cx(
                        'inline-flex min-h-11 items-center whitespace-nowrap rounded px-3 font-medium',
                        isActive ? 'bg-accent-tint text-accent' : 'text-ink-muted hover:bg-sunk hover:text-ink',
                      )
                    }
                  >
                    {item.label}
                  </NavLink>
                </li>
              ))}
            </ul>
          </nav>
          <div className="ml-auto flex items-center gap-5">
            <ConnectionIndicator />
            <span className="hidden text-right text-sm leading-tight sm:block">
              <span className="block font-semibold text-ink">{session.staffName}</span>
              <span className="text-ink-muted">{ROLE_LABEL[session.role]}</span>
            </span>
          </div>
        </div>
      </header>
      <OfflineBanner />
      <main id="main" className="mx-auto max-w-6xl px-4 pb-24 pt-8 sm:px-6 sm:pt-10">
        {children}
      </main>
    </div>
  );
}
