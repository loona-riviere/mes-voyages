// iPhone, appli installée : à la fermeture du clavier, iOS laisse parfois la page remontée.
// On recale le défilement et on masque la barre d'onglets pendant la frappe.
const isTyping = (el: Element | null): boolean =>
  !!el &&
  (el.tagName === "TEXTAREA" || el.tagName === "SELECT" ||
    (el.tagName === "INPUT" && !/^(checkbox|radio|range|button|submit|file)$/.test((el as HTMLInputElement).type)));

function clampScroll() {
  if (isTyping(document.activeElement)) return;
  const max = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
  if (window.scrollY > max) window.scrollTo(0, max);
}

function syncTyping() {
  const vv = window.visualViewport;
  const keyboard = !!vv && window.innerHeight - vv.height > 150;
  document.documentElement.classList.toggle("is-typing", keyboard && isTyping(document.activeElement));
}

export function installKeyboardFix() {
  document.addEventListener("focusin", () => setTimeout(syncTyping, 300));
  document.addEventListener("focusout", () => {
    setTimeout(syncTyping, 0);
    for (const d of [100, 400, 800]) setTimeout(clampScroll, d);
  });
  window.visualViewport?.addEventListener("resize", syncTyping);
}
