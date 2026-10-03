"use client";
import type { Result } from "@/features/pm/types";
export function Choice({ value, onChange, label, disabled = false, allowNA = true, anyInsteadOfNo = false }: { value: Result; onChange: (value: Exclude<Result, null>) => void; label: string; disabled?: boolean; allowNA?: boolean; anyInsteadOfNo?: boolean }) {
  const options: Array<Exclude<Result, null>> = allowNA ? ["yes", anyInsteadOfNo ? "any" : "no", "na"] : ["yes", anyInsteadOfNo ? "any" : "no"];
  return (
    <div className="choiceGroup" aria-label={`${label} result`}>
      {options.map((option) => (
        <button
          aria-pressed={value === option}
          className={`choice ${value === option ? `active ${option}` : ""}`}
          disabled={disabled}
          key={option}
          onClick={() => onChange(option)}
          type="button"
        >
          {option === "yes" ? "Yes" : option === "no" ? "No" : option === "any" ? "Any" : "N/A"}
        </button>
      ))}
    </div>
  );
}
