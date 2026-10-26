// Fondu puis retrait de l'écran de lancement (posé dans index.html), ~2,5 s après son apparition.
const DURATION = 2500;

export function hideSplash() {
  const el = document.getElementById("splash");
  const root = document.documentElement;
  if (!el || !root.classList.contains("splash-en-cours")) {
    el?.remove();
    return;
  }
  let done = false;
  const leave = () => {
    if (done) return;
    done = true;
    root.classList.remove("splash-en-cours");
    el.classList.add("sortie");
    setTimeout(() => el.remove(), 450);
  };
  const start = (window as { __splashStart?: number }).__splashStart ?? Date.now();
  setTimeout(leave, Math.max(0, DURATION - (Date.now() - start)));
  el.addEventListener("pointerdown", leave, { once: true });
}
