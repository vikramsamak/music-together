/**
 * Utility to generate stable, visually pleasant avatar gradients and initials.
 */

const PALETTES = [
  { from: "#ec4899", to: "#f43f5e", text: "#ffffff" }, // Pink / Rose
  { from: "#8b5cf6", to: "#6366f1", text: "#ffffff" }, // Purple / Indigo
  { from: "#06b6d4", to: "#3b82f6", text: "#ffffff" }, // Cyan / Blue
  { from: "#10b981", to: "#059669", text: "#ffffff" }, // Emerald / Green
  { from: "#f59e0b", to: "#d97706", text: "#ffffff" }, // Amber
  { from: "#f97316", to: "#ef4444", text: "#ffffff" }, // Orange / Red
  { from: "#14b8a6", to: "#0891b2", text: "#ffffff" }, // Teal / Cyan
  { from: "#a855f7", to: "#d946ef", text: "#ffffff" }, // Violet / Fuchsia
];

function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

export function getAvatarStyle(nameOrId: string) {
  const hash = hashString(nameOrId);
  const palette = PALETTES[hash % PALETTES.length];
  return {
    background: `linear-gradient(135deg, ${palette.from}, ${palette.to})`,
    color: palette.text,
  };
}

export function getInitials(name: string): string {
  const cleaned = name.trim();
  if (!cleaned) return "?";
  const parts = cleaned.split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return cleaned.slice(0, 2).toUpperCase();
}
