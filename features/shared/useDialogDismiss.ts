"use client";
import { useRef, type DialogHTMLAttributes, type MouseEvent, type PointerEvent } from "react";

type DialogPointerEvent = MouseEvent<HTMLDialogElement> | PointerEvent<HTMLDialogElement>;
function isBackdrop(event: DialogPointerEvent) {
  if (event.target !== event.currentTarget) return false;
  const bounds = event.currentTarget.getBoundingClientRect();
  return event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom;
}

/** Dismiss only gestures that both start and end on the backdrop. */
export function useDialogDismiss(disabled = false) {
  const startedOutside = useRef(false);
  return {
    onPointerDown(event) {
      startedOutside.current = event.isPrimary && event.button === 0 && isBackdrop(event);
    },
    onPointerCancel() { startedOutside.current = false; },
    onClick(event) {
      const dismiss = startedOutside.current && isBackdrop(event);
      startedOutside.current = false;
      if (!disabled && dismiss) event.currentTarget.close();
    },
    onCancel(event) { if (disabled) event.preventDefault(); },
  } satisfies Pick<DialogHTMLAttributes<HTMLDialogElement>, "onPointerDown" | "onPointerCancel" | "onClick" | "onCancel">;
}
