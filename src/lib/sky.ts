import type { Want } from "../data/catalogue";

// Couleurs de ciel selon le point fort de la destination : du haut vers l'horizon.
const SKY: Record<Want, [string, string, string]> = {
  plage: ["#BFE8E4", "#6CC5C9", "#2F8FB0"],
  plongee: ["#BFE3F2", "#4FA3C7", "#1E5A8A"],
  desert: ["#F6D9A4", "#E89C6A", "#B9654A"],
  neige: ["#EAF1F8", "#B8CDE6", "#7C93C4"],
  faune: ["#F3DFA0", "#D3A85E", "#8A6A3E"],
  nature: ["#DDE8D5", "#9DBF9A", "#4F7C6B"],
  rando: ["#E3E9D8", "#A7B98F", "#5E7458"],
  culture: ["#F6D3B8", "#D99AA6", "#7C6FA8"],
  ville: ["#E4E1F0", "#A9A3CF", "#5A5891"],
  gastro: ["#F8DCC0", "#E6A07A", "#A2523F"],
};

export function skyGradient(first: Want | undefined): string {
  const [a, b, c] = SKY[first ?? "nature"];
  return `linear-gradient(180deg, ${a}, ${b} 70%, ${c})`;
}
