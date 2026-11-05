import type { InputHTMLAttributes } from "react";

// Keep the native picker. iOS WebKit miscalculates 100%-wide date inputs
// with horizontal padding, so the surrounding surface owns that padding.
export function NativeDateInput(props: Omit<InputHTMLAttributes<HTMLInputElement>, "type">) {
  return <span className="nativeDateField"><input {...props} type="date" /></span>;
}
