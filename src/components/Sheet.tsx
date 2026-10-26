import { useEffect, useRef, type ReactNode } from "react";

interface Props {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
}

/** Feuille qui monte du bas ; se ferme avec le fond, le bouton, Échap ou en glissant vers le bas. */
export function Sheet({ open, title, onClose, children, footer }: Props) {
  const sheet = useRef<HTMLDivElement>(null);
  const body = useRef<HTMLDivElement>(null);
  const closeBtn = useRef<HTMLButtonElement>(null);
  const startY = useRef<number | null>(null);

  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    body.current?.scrollTo(0, 0);
    // Focus sur la feuille elle-même (pas sur la croix, qui afficherait un anneau sur iPhone).
    const t = setTimeout(() => sheet.current?.focus({ preventScroll: true }), 60);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    document.documentElement.classList.add("sheet-open");
    return () => {
      clearTimeout(t);
      document.removeEventListener("keydown", onKey);
      document.documentElement.classList.remove("sheet-open");
      prev?.focus?.();
    };
  }, [open, onClose]);

  const onTouchStart = (e: React.TouchEvent) => {
    startY.current = (body.current?.scrollTop ?? 0) <= 0 ? e.touches[0].clientY : null;
  };
  const onTouchMove = (e: React.TouchEvent) => {
    if (startY.current === null || !sheet.current) return;
    const dy = e.touches[0].clientY - startY.current;
    if (dy > 0) {
      sheet.current.style.transition = "none";
      sheet.current.style.transform = `translateY(${dy}px)`;
    }
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (startY.current === null || !sheet.current) return;
    const dy = e.changedTouches[0].clientY - startY.current;
    sheet.current.style.transition = "";
    sheet.current.style.transform = "";
    startY.current = null;
    if (dy > 90) onClose();
  };

  return (
    <>
      <div className={`scrim${open ? " on" : ""}`} onClick={onClose} aria-hidden="true" />
      <div
        ref={sheet}
        className={`sheet${open ? " on" : ""}`}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        aria-hidden={!open}
        inert={!open}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        <div className="grab" />
        <div className="sheet-head">
          <h2>{title}</h2>
          <button ref={closeBtn} className="x" onClick={onClose} aria-label="Fermer">×</button>
        </div>
        <div ref={body} className="sheet-body">{children}</div>
        {footer && <div className="sheet-foot">{footer}</div>}
      </div>
    </>
  );
}
