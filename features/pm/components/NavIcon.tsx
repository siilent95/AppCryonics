"use client";
export function NavIcon({ label }: { label: string }) {
  return <span className="navIcon">{label.slice(0, 2).toUpperCase()}</span>;
}

