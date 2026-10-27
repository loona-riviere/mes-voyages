/** Bouton « + » flottant : une seule façon d'ajouter, au même endroit sur tous les écrans. */
export function AddFab({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button className="fab" onClick={onClick} aria-label={label} title={label}>
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
    </button>
  );
}
