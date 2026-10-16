import { useCallback, useId, useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { MoreHorizontal } from 'lucide-react';

export type ActionMenuItem = {
  label: string;
  icon: ReactNode;
  disabled?: boolean;
  destructive?: boolean;
  positive?: boolean;
  separatorBefore?: boolean;
  trailing?: ReactNode;
} & (
  | { href: string; target?: string; rel?: string; onSelect?: never }
  | { href?: never; target?: never; rel?: never; onSelect: () => void }
);

type MenuPosition = {
  top: number;
  left: number;
  maxHeight: number;
  placement: 'above' | 'below';
};

let activeMenu: { id: symbol; close: () => void } | null = null;

export function ActionMenu({
  label,
  items,
}: {
  label: string;
  items: ActionMenuItem[];
}) {
  const id = useRef(Symbol());
  const menuId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<MenuPosition | null>(null);

  const closeMenu = useCallback((restoreFocus = true) => {
    setOpen(false);
    setPosition(null);
    if (activeMenu?.id === id.current) activeMenu = null;
    if (restoreFocus) {
      window.requestAnimationFrame(() => triggerRef.current?.focus({ preventScroll: true }));
    }
  }, []);

  const positionMenu = useCallback(() => {
    const trigger = triggerRef.current;
    const menu = menuRef.current;
    if (!trigger || !menu) return;

    const triggerRect = trigger.getBoundingClientRect();
    const menuRect = menu.getBoundingClientRect();
    const menuHeight = Math.max(menu.scrollHeight, menuRect.height);
    const menuWidth = menuRect.width;
    const viewportWidth = document.documentElement.clientWidth;
    const viewportHeight = window.innerHeight;
    const nav = document.querySelector<HTMLElement>('.mobile-nav');
    const navVisible = nav && getComputedStyle(nav).display !== 'none';
    const navRect = navVisible ? nav.getBoundingClientRect() : null;
    const navHeight = navRect?.height ?? 0;
    const safeArea = Number.parseFloat(
      getComputedStyle(document.documentElement).getPropertyValue('--safe-area-inset-bottom'),
    ) || 0;
    const bottomLimit = Math.min(
      viewportHeight - navHeight - safeArea - 8,
      (navRect?.top ?? viewportHeight) - 8,
    );
    const aboveSpace = Math.max(0, triggerRect.top - 8);
    const belowTop = triggerRect.bottom + 8;
    const belowSpace = Math.max(0, bottomLimit - belowTop);
    const fitsAbove = aboveSpace >= menuHeight;
    const fitsBelow = belowSpace >= menuHeight;
    const placement: MenuPosition['placement'] = fitsAbove
      ? 'above'
      : fitsBelow
        ? 'below'
        : aboveSpace >= belowSpace
          ? 'above'
          : 'below';
    const availableHeight = placement === 'above' ? aboveSpace : belowSpace;
    const maxHeight = Math.min(menuHeight, availableHeight);
    const top = placement === 'above'
      ? Math.max(8, triggerRect.top - 8 - maxHeight)
      : belowTop;
    const maxLeft = Math.max(8, viewportWidth - menuWidth - 8);
    const left = Math.min(maxLeft, Math.max(8, triggerRect.right - menuWidth));

    setPosition({ top, left, maxHeight, placement });
  }, []);

  useLayoutEffect(() => {
    return () => {
      if (activeMenu?.id === id.current) activeMenu = null;
    };
  }, []);

  useLayoutEffect(() => {
    if (!open) return;

    positionMenu();
    const focusFrame = window.requestAnimationFrame(() => {
      menuRef.current
        ?.querySelector<HTMLElement>('[role="menuitem"]:not([aria-disabled="true"])')
        ?.focus({ preventScroll: true });
    });
    const closeOnScroll = () => closeMenu();
    const closeOnOutsidePointer = (event: PointerEvent) => {
      const target = event.target;
      if (
        target instanceof Node &&
        !menuRef.current?.contains(target) &&
        !triggerRef.current?.contains(target)
      ) {
        closeMenu();
      }
    };
    const resizeObserver = menuRef.current && typeof ResizeObserver !== 'undefined'
      ? new ResizeObserver(positionMenu)
      : null;
    if (menuRef.current) resizeObserver?.observe(menuRef.current);

    window.addEventListener('resize', positionMenu);
    window.addEventListener('orientationchange', positionMenu);
    window.addEventListener('scroll', closeOnScroll, true);
    document.addEventListener('pointerdown', closeOnOutsidePointer, true);

    return () => {
      window.cancelAnimationFrame(focusFrame);
      resizeObserver?.disconnect();
      window.removeEventListener('resize', positionMenu);
      window.removeEventListener('orientationchange', positionMenu);
      window.removeEventListener('scroll', closeOnScroll, true);
      document.removeEventListener('pointerdown', closeOnOutsidePointer, true);
    };
  }, [closeMenu, open, positionMenu]);

  const toggleMenu = () => {
    if (open) {
      closeMenu(false);
      return;
    }
    activeMenu?.close();
    activeMenu = { id: id.current, close: () => closeMenu(false) };
    setPosition(null);
    setOpen(true);
  };

  const handleMenuKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const menu = menuRef.current;
    if (!menu) return;
    const items = Array.from(menu.querySelectorAll<HTMLElement>('[role="menuitem"]:not([aria-disabled="true"])'));
    const currentIndex = items.indexOf(document.activeElement as HTMLElement);

    if (event.key === 'Escape') {
      event.preventDefault();
      closeMenu();
    } else if (event.key === 'Tab') {
      closeMenu();
    } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const direction = event.key === 'ArrowDown' ? 1 : -1;
      const nextIndex = (currentIndex + direction + items.length) % items.length;
      items[nextIndex]?.focus();
    } else if (event.key === 'Home') {
      event.preventDefault();
      items[0]?.focus();
    } else if (event.key === 'End') {
      event.preventDefault();
      items.at(-1)?.focus();
    }
  };

  const selectItem = (item: ActionMenuItem) => {
    closeMenu();
    if ('onSelect' in item && item.onSelect) item.onSelect();
  };

  return (
    <>
      <button
        ref={triggerRef}
        className="action-menu-trigger"
        type="button"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={toggleMenu}
      >
        <MoreHorizontal size={20} aria-hidden="true" />
      </button>
      {open && createPortal(
        <div
          ref={menuRef}
          id={menuId}
          className={`action-menu-popover${position ? ` action-menu-${position.placement}` : ''}`}
          role="menu"
          aria-label={label}
          onKeyDown={handleMenuKeyDown}
          style={{
            top: position?.top ?? 8,
            left: position?.left ?? 8,
            maxHeight: position?.maxHeight,
            visibility: position ? 'visible' : 'hidden',
          }}
        >
          {items.map((item, index) => {
            const className = [
              'action-menu-item',
              item.destructive ? 'action-menu-item-destructive' : '',
              item.positive ? 'action-menu-item-positive' : '',
            ].filter(Boolean).join(' ');
            const content = (
              <>
                <span className="action-menu-item-icon" aria-hidden="true">{item.icon}</span>
                <span className="action-menu-item-label">{item.label}</span>
                {item.trailing && <span className="action-menu-item-trailing">{item.trailing}</span>}
              </>
            );

            return (
              <div className="action-menu-item-group" key={`${item.label}-${index}`}>
                {item.separatorBefore && <div className="action-menu-separator" role="separator" />}
                {'href' in item ? (
                  <a
                    className={className}
                    href={item.href}
                    target={item.target}
                    rel={item.rel}
                    role="menuitem"
                    tabIndex={-1}
                    onClick={() => selectItem(item)}
                  >
                    {content}
                  </a>
                ) : (
                  <button
                    className={className}
                    type="button"
                    role="menuitem"
                    tabIndex={-1}
                    disabled={item.disabled}
                    aria-disabled={item.disabled || undefined}
                    onClick={() => selectItem(item)}
                  >
                    {content}
                  </button>
                )}
              </div>
            );
          })}
        </div>,
        document.body,
      )}
    </>
  );
}
