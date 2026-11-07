import { Bookmark, Utensils } from 'lucide-react'
import { NavLink } from 'react-router'
import { cx } from '../../lib/cx'

const items = [
  { to: '/', label: 'Explore', icon: Utensils, end: true },
  { to: '/saved', label: 'Saved', icon: Bookmark, end: false },
] as const

/** Rendered twice by AppShell (bottom bar on phones, header on wider screens). */
export function PrimaryNav({ variant }: { variant: 'bottom' | 'header' }) {
  return (
    <nav
      aria-label="Primary"
      className={cx(
        variant === 'bottom'
          ? 'fixed inset-x-0 bottom-0 z-20 border-t border-line bg-surface pb-[env(safe-area-inset-bottom)] md:hidden'
          : 'hidden md:block',
      )}
    >
      <ul className={cx('flex', variant === 'bottom' ? 'justify-around' : 'gap-1')}>
        {items.map(({ to, label, icon: Icon, end }) => (
          <li key={to} className={variant === 'bottom' ? 'flex-1' : undefined}>
            <NavLink
              to={to}
              end={end}
              className={({ isActive }) =>
                cx(
                  'flex min-h-(--size-touch-lg) items-center justify-center gap-2 px-4 text-small',
                  'transition-colors duration-(--duration-fast)',
                  variant === 'bottom' ? 'flex-col gap-0.5 text-caption' : 'min-h-(--size-touch) rounded-pill',
                  isActive
                    ? 'font-semibold text-primary'
                    : 'font-medium text-text-muted hover:text-text',
                  isActive && variant === 'header' && 'bg-primary-soft',
                )
              }
            >
              <Icon size={20} aria-hidden="true" />
              {label}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}
