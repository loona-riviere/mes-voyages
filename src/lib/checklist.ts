export interface CheckItem {
  done: boolean;
  label: string;
}

/** Liste proposée pour un nouveau voyage. */
export const DEFAULT_CHECKLIST = [
  "Passeport ou carte d'identité valide",
  "Visa / autorisation d'entrée",
  "Assurance voyage",
  "Billets enregistrés",
  "Logement confirmé",
  "Carte bancaire et argent liquide",
  "Vaccins et traitements",
  "Valise et adaptateur",
];

/** Une ligne par élément : « [x] libellé » ou « [ ] libellé ». */
export function parseChecklist(text: string): CheckItem[] {
  return text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => {
      const m = /^\[( |x)\]\s*(.*)$/i.exec(l);
      return m ? { done: m[1].toLowerCase() === "x", label: m[2] } : { done: false, label: l };
    })
    .filter((i) => i.label);
}

export const serializeChecklist = (items: CheckItem[]) => items.map((i) => `[${i.done ? "x" : " "}] ${i.label}`).join("\n");
