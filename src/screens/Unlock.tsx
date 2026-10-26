import { useState } from "react";
import { LockedError } from "../lib/api";

export function Unlock({ onUnlock, error }: { onUnlock: (p: string) => Promise<void>; error: string | null }) {
  const [pass, setPass] = useState("");
  const [busy, setBusy] = useState(false);
  const [wrong, setWrong] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pass.trim()) return;
    setBusy(true);
    setWrong(false);
    try {
      await onUnlock(pass.trim());
    } catch (err) {
      if (err instanceof LockedError) setWrong(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="unlock">
      <div className="unlock-sky" aria-hidden="true" />
      <form className="unlock-card" onSubmit={submit}>
        <h1>Mes voyages</h1>
        <p>Entre la phrase secrète pour relier l'app à Notion. Elle reste enregistrée sur ce téléphone.</p>
        <label className="lbl" htmlFor="pass">Phrase secrète</label>
        <input id="pass" className="field" type="password" autoComplete="current-password" autoCapitalize="none"
          value={pass} onChange={(e) => setPass(e.target.value)} />
        {wrong && <p className="err">Ce n'est pas la bonne phrase. Vérifie APP_PASSPHRASE sur Netlify.</p>}
        {error && <p className="err">{error}</p>}
        <button className="btn primary" type="submit" disabled={busy || !pass.trim()}>{busy ? "Vérification…" : "Ouvrir"}</button>
      </form>
    </div>
  );
}
