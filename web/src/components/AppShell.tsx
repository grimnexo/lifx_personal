import { NavLink, Outlet } from 'react-router-dom';
import { SettingsDialog } from './SettingsDialog';
import { UserMenu } from './UserMenu';

const links = [
  { to: '/', label: 'Lights', end: true },
  { to: '/devices', label: 'Devices', end: false },
];

export function AppShell() {
  return (
    <div className="min-h-dvh">
      <nav aria-label="Main" className="sticky top-0 z-30 border-b border-line bg-card/90 backdrop-blur">
        <div className="mx-auto flex max-w-[1100px] items-center gap-x-6 px-4 py-3">
          <NavLink to="/" className="flex items-center gap-2 text-[1.05rem] font-bold text-ink no-underline">
            <span aria-hidden="true" className="size-7 rounded-lg bg-acc" />
            Lights
          </NavLink>
          <ul className="m-0 flex list-none gap-1 p-0">
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
          <div className="ml-auto">
            <UserMenu />
          </div>
        </div>
      </nav>
      <main className="mx-auto max-w-[1100px] px-4 py-6">
        <Outlet />
      </main>
      <SettingsDialog />
    </div>
  );
}
