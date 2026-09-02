import { useEffect, useId, useRef } from 'react';
import type { ReactNode } from 'react';

interface SidebarDrawerProps {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
}

export function SidebarDrawer({ open, onClose, children }: SidebarDrawerProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!open || !dialog) return;
    const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dialog.showModal();
    dialog.querySelector<HTMLButtonElement>('button')?.focus();
    return () => {
      dialog.close();
      if (trigger?.isConnected) trigger.focus({ preventScroll: true });
    };
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      className="sidebar-drawer"
      dir="rtl"
      aria-labelledby={titleId}
      aria-modal="true"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.preventDefault();
          onClose();
        }
        if (event.key !== 'Tab') return;
        const focusable = Array.from(
          event.currentTarget.querySelectorAll<HTMLElement>(
            'button:not(:disabled), a[href], [tabindex="0"]',
          ),
        );
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }}
    >
      <section className="drawer-panel">
        <div className="drawer-header">
          <h2 id={titleId}>فهرست مطالب</h2>
          <button className="button" aria-label="بستن فهرست مطالب" onClick={onClose} type="button">
            بستن
          </button>
        </div>
        {open ? children : null}
      </section>
    </dialog>
  );
}
