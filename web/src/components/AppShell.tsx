import { useEffect, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth';
import { Modal } from './ui';
import { ScenesMenu } from './ScenesMenu';
import { UserMenu } from './UserMenu';

const links = [
  { to: '/', label: 'Lights', end: true },
  { to: '/devices', label: 'Devices', end: false },
];

const tabClass = ({ isActive }: { isActive: boolean }) =>
  `flex flex-1 flex-col items-center gap-0.5 py-2 text-[.78rem] font-medium no-underline ${
    isActive ? 'text-acc' : 'text-mut'
  }`;

export function AppShell() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [helpOpen, setHelpOpen] = useState(false);
  const sidebar = user?.layout === 'side';

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target;
      if (t instanceof HTMLElement && t.closest('input, textarea, select, [contenteditable="true"]')) return;
      if (document.querySelector('dialog[open]')) return;
      if (e.key === '?') setHelpOpen(true);
      else if (e.key === 'l') navigate('/');
      else if (e.key === 'd') navigate('/devices');
      else if (e.key === 'p') navigate('/profile');
      else if (e.key === 's') navigate('/settings');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [navigate]);

  return (
    <div className="min-h-dvh">
      {sidebar && (
        <nav
          aria-label="Sidebar"
          className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col gap-4 border-r border-line bg-card p-4 md:flex"
        >
          <NavLink to="/" className="flex items-center gap-2 text-[1.05rem] font-bold text-ink no-underline">
            <span aria-hidden="true" className="size-7 rounded-lg bg-acc" />
            Lights
          </NavLink>
          <ul className="m-0 grid list-none gap-1 p-0">
            {links.map((l) => (
              <li key={l.to}>
                <NavLink
                  to={l.to}
                  end={l.end}
                  className={({ isActive }) =>
                    `block rounded-lg px-3 py-2 text-[.95rem] font-medium no-underline transition-colors ${
                      isActive ? 'bg-soft text-ink' : 'text-mut hover:text-ink'
                    }`
                  }
                >
                  {l.label}
                </NavLink>
              </li>
            ))}
          </ul>
          <div className="mt-auto flex items-center gap-2">
            <ScenesMenu align="left" />
            <UserMenu align="left" />
          </div>
        </nav>
      )}

      <nav
        aria-label="Main"
        className={`sticky top-0 z-30 border-b border-line bg-card/90 backdrop-blur ${sidebar ? 'md:hidden' : ''}`}
      >
        <div className="mx-auto flex max-w-[1100px] items-center gap-x-6 px-4 py-3">
          <NavLink to="/" className="flex items-center gap-2 text-[1.05rem] font-bold text-ink no-underline">
            <span aria-hidden="true" className="size-7 rounded-lg bg-acc" />
            Lights
          </NavLink>
          <ul className="m-0 hidden list-none gap-1 p-0 md:flex">
            {links.map((l) => (
              <li key={l.to}>
                <NavLink
                  to={l.to}
                  end={l.end}
                  className={({ isActive }) =>
                    `block rounded-lg px-3 py-1.5 text-[.95rem] font-medium no-underline transition-colors ${
                      isActive ? 'bg-soft text-ink' : 'text-mut hover:text-ink'
                    }`
                  }
                >
                  {l.label}
                </NavLink>
              </li>
            ))}
          </ul>
          <div className="ml-auto flex items-center gap-2">
            <ScenesMenu />
            <UserMenu />
          </div>
        </div>
      </nav>

      <main className={`mx-auto max-w-[1100px] px-4 py-6 pb-24 md:pb-6 ${sidebar ? 'md:pl-64' : ''}`}>
        <Outlet />
      </main>

      <nav
        aria-label="Mobile"
        className="fixed inset-x-0 bottom-0 z-30 flex border-t border-line bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
      >
        <NavLink to="/" end className={tabClass}>
          Lights
        </NavLink>
        <NavLink to="/devices" className={tabClass}>
          Devices
        </NavLink>
        <NavLink to="/profile" className={tabClass}>
          Profile
        </NavLink>
        <NavLink to="/settings" className={tabClass}>
          Settings
        </NavLink>
      </nav>

      <ShortcutsDialog open={helpOpen} onClose={() => setHelpOpen(false)} />
    </div>
  );
}

function ShortcutsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const rows: [string, string][] = [
    ['L', 'Lights'],
    ['D', 'Devices'],
    ['P', 'Profile'],
    ['S', 'Settings'],
    ['?', 'Show this list'],
    ['Esc', 'Close a menu or dialog'],
  ];
  return (
    <Modal open={open} onClose={onClose} labelledBy="shortcutsTitle" className="w-[min(380px,94vw)]">
      <h2 id="shortcutsTitle" className="m-0 mb-3 text-xl font-semibold">
        Keyboard shortcuts
      </h2>
      <dl className="m-0 grid grid-cols-[auto_1fr] gap-x-6 gap-y-2">
        {rows.map(([key, text]) => (
          <div key={key} className="contents">
            <dt>
              <kbd className="rounded-md border border-line bg-soft px-2 py-0.5 font-mono text-[.85rem]">{key}</kbd>
            </dt>
            <dd className="m-0 self-center text-mut">{text}</dd>
          </div>
        ))}
      </dl>
      <p className="mb-0 mt-4 text-[.8rem] text-mut">Shortcuts are off while typing in a field.</p>
    </Modal>
  );
}
