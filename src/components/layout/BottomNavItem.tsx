import type { MouseEventHandler, ReactNode } from 'react';
import { NavLink } from 'react-router-dom';

type BottomNavItemProps = {
  icon: ReactNode;
  label: string;
  accessibleLabel: string;
  title: string;
  active?: boolean;
  to?: string;
  end?: boolean;
  onClick?: MouseEventHandler<HTMLButtonElement>;
  ariaHasPopup?: 'dialog';
  ariaExpanded?: boolean;
};

function BottomNavItemContents({ icon, label }: Pick<BottomNavItemProps, 'icon' | 'label'>) {
  return (
    <>
      <span className="bottom-nav-icon">{icon}</span>
      <span className="bottom-nav-label">{label}</span>
    </>
  );
}

export function BottomNavItem({
  icon,
  label,
  accessibleLabel,
  title,
  active = false,
  to,
  end,
  onClick,
  ariaHasPopup,
  ariaExpanded,
}: BottomNavItemProps) {
  if (to) {
    return (
      <NavLink
        className={({ isActive }) => `mobile-nav-link ${isActive ? 'mobile-nav-active' : ''}`}
        to={to}
        end={end}
        aria-label={accessibleLabel}
        title={title}
      >
        <BottomNavItemContents icon={icon} label={label} />
      </NavLink>
    );
  }

  return (
    <button
      className={`mobile-nav-link ${active ? 'mobile-nav-active' : ''}`}
      type="button"
      onClick={onClick}
      aria-label={accessibleLabel}
      title={title}
      aria-haspopup={ariaHasPopup}
      aria-expanded={ariaExpanded}
    >
      <BottomNavItemContents icon={icon} label={label} />
    </button>
  );
}
