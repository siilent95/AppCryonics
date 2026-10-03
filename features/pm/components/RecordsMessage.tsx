"use client";
import type { RecordsStatus } from "@/features/pm/types";
export function RecordsMessage({
  error,
  onRetry,
  status,
}: {
  error: string;
  onRetry: () => void;
  status: RecordsStatus;
}) {
  if (status === "loading" || status === "idle") {
    return <div className="viewMessage"><strong>Loading PM records</strong><span>Retrieving the protected maintenance history.</span></div>;
  }
  if (status === "error") {
    return (
      <div className="viewMessage error">
        <strong>PM records could not be loaded</strong>
        <span>{error}</span>
        <button onClick={onRetry} type="button">Try again</button>
      </div>
    );
  }
  return null;
}
