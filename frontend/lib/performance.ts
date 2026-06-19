import type React from "react";

export function performancePct(current: number, prev: number): number | null {
  if (!prev) return null;
  return Math.round((current / prev) * 100);
}

export function performanceCellStyle(pct: number): React.CSSProperties {
  if (pct >= 150) return { background: "#d1fae5", color: "#065f46" }; // emerald
  if (pct >= 80)  return { background: "#fef9c3", color: "#854d0e" }; // yellow
  return { background: "#ffedd5", color: "#c2410c" };                 // orange
}
