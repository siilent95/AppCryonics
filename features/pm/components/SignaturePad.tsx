"use client";
import { useRef } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
export function SignaturePad({
  ariaLabel,
  disabled,
  onChange,
}: {
  ariaLabel: string;
  disabled: boolean;
  onChange: (dataUrl: string) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawingRef = useRef(false);
  const hasInkRef = useRef(false);

  function point(event: ReactPointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * canvas.width,
      y: ((event.clientY - rect.top) / rect.height) * canvas.height,
    };
  }

  function beginSignature(event: ReactPointerEvent<HTMLCanvasElement>) {
    if (disabled) return;
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;
    const start = point(event);
    drawingRef.current = true;
    canvas.setPointerCapture(event.pointerId);
    context.beginPath();
    context.moveTo(start.x, start.y);
  }

  function continueSignature(event: ReactPointerEvent<HTMLCanvasElement>) {
    if (!drawingRef.current || disabled) return;
    const context = canvasRef.current?.getContext("2d");
    if (!context) return;
    const next = point(event);
    context.lineWidth = 4;
    context.lineCap = "round";
    context.lineJoin = "round";
    context.strokeStyle = "#172b3a";
    context.lineTo(next.x, next.y);
    context.stroke();
    hasInkRef.current = true;
  }

  function finishSignature(event: ReactPointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    if (!canvas || !drawingRef.current) return;
    drawingRef.current = false;
    if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
    if (hasInkRef.current) onChange(canvas.toDataURL("image/png"));
  }

  function clearSignature() {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context || disabled) return;
    context.clearRect(0, 0, canvas.width, canvas.height);
    hasInkRef.current = false;
    onChange("");
  }

  return (
    <div className={`signaturePad ${disabled ? "disabled" : ""}`}>
      <canvas
        aria-label={ariaLabel}
        height="240"
        onPointerCancel={finishSignature}
        onPointerDown={beginSignature}
        onPointerMove={continueSignature}
        onPointerUp={finishSignature}
        ref={canvasRef}
        role="img"
        width="900"
      />
      <div className="signatureLine"><span>Sign inside the box</span><button disabled={disabled} onClick={clearSignature} type="button">Clear</button></div>
    </div>
  );
}
