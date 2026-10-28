import { useEffect, useState, type ReactNode } from "react";

/**
 * Bouton de suppression en deux touchers : le premier demande confirmation dans le bouton lui-même,
 * le second agit. Plus fiable que window.confirm, parfois bloqué dans l'app installée sur iPhone.
 */
export function ConfirmButton({ className, disabled, onConfirm, children, confirmLabel = "Toucher encore pour supprimer" }: {
  className: string; disabled?: boolean; onConfirm: () => void; children: ReactNode; confirmLabel?: string;
}) {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(false), 4000);
    return () => clearTimeout(t);
  }, [armed]);
  return (
    <button type="button" className={`${className}${armed ? " armed" : ""}`} disabled={disabled}
      onClick={() => { if (armed) { setArmed(false); onConfirm(); } else setArmed(true); }}>
      {armed ? confirmLabel : children}
    </button>
  );
}
