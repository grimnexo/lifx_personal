import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth';
import { brandLabel, updateBranding, useBranding } from '../branding';
import { BrandTile } from './BrandTile';
import { ConfirmDialog } from './ConfirmDialog';
import { Icon, type IconName } from './icons';
import { Modal } from './ui';
import { ScenesMenu } from './ScenesMenu';
import { ScheduleDialog } from './ScheduleDialog';
import { UserMenu } from './UserMenu';

const sections: { to: string; label: string; end: boolean; icon: IconName }[] = [
  { to: '/', label: 'Dashboard', end: true, icon: 'dashboard' },
  { to: '/lights', label: 'Lights', end: false, icon: 'lights' },
  { to: '/rooms', label: 'Rooms', end: false, icon: 'rooms' },
  { to: '/groups', label: 'Groups', end: false, icon: 'groups' },
  { to: '/schedules', label: 'Schedules', end: false, icon: 'schedules' },
];

const mobileTabs = [
  { to: '/', label: 'Dashboard', end: true },
  { to: '/lights', label: 'Lights', end: false },
  { to: '/rooms', label: 'Rooms', end: false },
  { to: '/schedules', label: 'Schedules', end: false },
];

const moreLinks = [
  { to: '/groups', label: 'Groups' },
  { to: '/profile', label: 'Profile' },
  { to: '/settings', label: 'Settings' },
];

const tabClass = ({ isActive }: { isActive: boolean }) =>
  `flex flex-1 flex-col items-center gap-0.5 py-2 text-[.78rem] font-medium no-underline ${
    isActive ? 'text-acc' : 'text-mut'
  }`;

export function AppShell() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { user } = useAuth();
  const [helpOpen, setHelpOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const branding = useBranding();
  const sidebar = user?.layout === 'side';
  const collapsed = sidebar && branding.sidebarCollapsed;
  const name = brandLabel(branding);
  const moreActive = moreLinks.some((l) => pathname === l.to || pathname.startsWith(l.to + '/'));

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target;
      if (t instanceof HTMLElement && t.closest('input, textarea, select, [contenteditable="true"]')) return;
      if (document.querySelector('dialog[open]')) return;
      if (e.key === '?') setHelpOpen(true);
      else if (e.key === 'h') navigate('/');
      else if (e.key === 'l') navigate('/lights');
      else if (e.key === 'r') navigate('/rooms');
      else if (e.key === 'g') navigate('/groups');
      else if (e.key === 'c') navigate('/schedules');
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
          className={`fixed inset-y-0 left-0 z-30 hidden flex-col gap-4 border-r border-line bg-card p-3 md:flex ${
            collapsed ? 'w-16' : 'w-60 p-4'
          }`}
        >
          <div className={`flex items-center gap-2 ${collapsed ? 'flex-col' : 'justify-between'}`}>
            <NavLink
              to="/"
              title={name}
              className="flex min-w-0 items-center gap-2 text-[1.05rem] font-bold text-ink no-underline"
            >
              <BrandTile icon={branding.icon} customIcon={branding.customIcon} />
              <span className={collapsed ? 'sr-only' : 'truncate'}>{name}</span>
            </NavLink>
            <button
              type="button"
              onClick={() => updateBranding({ sidebarCollapsed: !branding.sidebarCollapsed })}
              aria-expanded={!collapsed}
              aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              className="grid size-8 flex-none cursor-pointer place-items-center rounded-lg border-0 bg-transparent text-mut hover:bg-soft hover:text-ink"
            >
              <Icon name={collapsed ? 'chevronRight' : 'chevronLeft'} className="size-4" />
            </button>
          </div>
          <ul className="m-0 grid list-none gap-1 p-0">
            {sections.map((l) => (
              <li key={l.to}>
                <NavLink
                  to={l.to}
                  end={l.end}
                  title={collapsed ? l.label : undefined}
                  className={({ isActive }) =>
                    `flex items-center gap-3 rounded-lg py-2 text-[.95rem] font-medium no-underline transition-colors ${
                      collapsed ? 'justify-center' : 'px-3'
                    } ${isActive ? 'bg-soft text-ink' : 'text-mut hover:text-ink'}`
                  }
                >
                  <Icon name={l.icon} className="size-5 flex-none" />
                  <span className={collapsed ? 'sr-only' : ''}>{l.label}</span>
                </NavLink>
              </li>
            ))}
          </ul>
          <div className="mt-auto grid gap-2">
            <ScenesMenu align="left" drop="up" block={!collapsed} compact={collapsed} />
            <UserMenu align="left" drop="up" block={!collapsed} compact={collapsed} />
          </div>
        </nav>
      )}

      <nav
        aria-label="Main"
        className={`sticky top-0 z-30 border-b border-line bg-card/90 backdrop-blur ${sidebar ? 'md:hidden' : ''}`}
      >
        <div className="mx-auto flex max-w-[1100px] items-center gap-x-6 px-4 py-3">
          <NavLink to="/" className="flex items-center gap-2 text-[1.05rem] font-bold text-ink no-underline">
            <BrandTile icon={branding.icon} customIcon={branding.customIcon} />
            {name}
          </NavLink>
          <ul className="m-0 hidden list-none gap-1 p-0 md:flex">
            {sections.map((l) => (
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

      <main
        className={`mx-auto max-w-[1100px] px-4 py-6 pb-24 md:pb-6 ${
          collapsed ? 'md:pl-20' : sidebar ? 'md:pl-64' : ''
        }`}
      >
        <Outlet />
      </main>

      <nav
        aria-label="Mobile"
        className="fixed inset-x-0 bottom-0 z-30 flex border-t border-line bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
      >
        {mobileTabs.map((l) => (
          <NavLink key={l.to} to={l.to} end={l.end} className={tabClass}>
            {l.label}
          </NavLink>
        ))}
        <button
          type="button"
          onClick={() => setMoreOpen(true)}
          aria-current={moreActive ? 'page' : undefined}
          className={`${tabClass({ isActive: moreActive })} cursor-pointer border-0 bg-transparent`}
        >
          More
        </button>
      </nav>

      <Modal open={moreOpen} onClose={() => setMoreOpen(false)} labelledBy="moreTitle" className="w-[min(340px,92vw)]">
        <h2 id="moreTitle" className="m-0 mb-3 text-xl font-semibold">
          More
        </h2>
        <ul className="m-0 grid list-none gap-1 p-0">
          {moreLinks.map((l) => (
            <li key={l.to}>
              <NavLink
                to={l.to}
                onClick={() => setMoreOpen(false)}
                className={({ isActive }) =>
                  `block rounded-lg px-3 py-2.5 font-medium no-underline ${isActive ? 'bg-soft text-ink' : 'text-mut'}`
                }
              >
                {l.label}
              </NavLink>
            </li>
          ))}
        </ul>
      </Modal>

      <ScheduleDialog />
      <ConfirmDialog />
      <ShortcutsDialog open={helpOpen} onClose={() => setHelpOpen(false)} />
    </div>
  );
}

function ShortcutsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const rows: [string, string][] = [
    ['H', 'Dashboard'],
    ['L', 'Lights'],
    ['R', 'Rooms'],
    ['G', 'Groups'],
    ['C', 'Schedules'],
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
