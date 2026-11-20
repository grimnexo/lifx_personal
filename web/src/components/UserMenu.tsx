import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth';
import { useApp } from '../context';

const item =
  'flex w-full cursor-pointer items-center gap-2 rounded-lg border-0 bg-transparent px-3 py-2 text-left text-[.9rem] text-ink no-underline hover:bg-soft';

export function UserMenu() {
  const { user, signOut } = useAuth();
  const { openSettings } = useApp();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const initials = (user?.name || user?.username || '?')
    .split(/\s+/)
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="flex cursor-pointer items-center gap-2 rounded-full border border-line bg-card py-1 pl-1 pr-3 text-ink hover:border-acc"
      >
        <span className="grid size-7 place-items-center rounded-full bg-acc text-[.75rem] font-bold text-on-acc">
          {initials}
        </span>
        <span className="hidden text-[.9rem] font-medium sm:inline">{user?.name}</span>
        <span aria-hidden="true" className="text-[.7rem] text-mut">
          {'\u25be'}
        </span>
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 mt-2 grid w-56 gap-0.5 rounded-[var(--radius)] border border-line bg-card p-1.5 shadow-card"
        >
          <div className="px-3 pb-2 pt-1.5">
            <div className="truncate text-[.9rem] font-semibold text-ink">{user?.name}</div>
            <div className="truncate text-[.8rem] text-mut">@{user?.username}</div>
          </div>
          <div className="my-1 h-px bg-line" />
          <Link to="/profile" role="menuitem" className={item} onClick={() => setOpen(false)}>
            Profile
          </Link>
          <button
            type="button"
            role="menuitem"
            className={item}
            onClick={() => {
              setOpen(false);
              openSettings();
            }}
          >
            Settings
          </button>
          <div className="my-1 h-px bg-line" />
          <button type="button" role="menuitem" className={item} onClick={() => void signOut()}>
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}
