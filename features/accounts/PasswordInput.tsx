"use client";
import { useState } from "react";

export function PasswordInput({ id, name, label, autoComplete, minLength, invalid = false, describedBy }: {
  id: string; name: string; label: string; autoComplete: "current-password" | "new-password"; minLength?: number; invalid?: boolean; describedBy?: string;
}) {
  const [visible, setVisible] = useState(false);
  return <div className="passwordField">
    <label htmlFor={id}>{label}</label>
    <div className="passwordControl">
      <input id={id} name={name} type={visible ? "text" : "password"} autoComplete={autoComplete} autoCapitalize="none" spellCheck={false} required minLength={minLength} maxLength={256} aria-invalid={invalid || undefined} aria-describedby={describedBy} />
      <button className="passwordToggle" type="button" aria-label={`${visible ? "Hide" : "Show"} password · ${label}`} title={visible ? "Hide password" : "Show password"} aria-controls={id} aria-pressed={visible} onClick={() => setVisible(value => !value)}>
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
          <path d="M2 12c2.4-4.6 5.7-7 10-7s7.6 2.4 10 7c-2.4 4.6-5.7 7-10 7S4.4 16.6 2 12Z" />
          <circle cx="12" cy="12" r="3" />
          {visible && <path d="m3 3 18 18" />}
        </svg>
      </button>
    </div>
  </div>;
}
