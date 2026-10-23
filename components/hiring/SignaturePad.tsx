'use client';

import { useRef, useState } from 'react';

const W = 640;
const H = 200;
/** A signature shorter than this (in canvas pixels of pen travel) is a dot or a scribble, not a signature. */
const MIN_STROKE = 90;

/** A signature drawn with a finger or mouse. It reports the signature as a PNG data URL, or an empty string while there
    is none (or only a dot). */
export function SignaturePad({ onChange }: { onChange: (png: string) => void }) {
  const [drawn, setDrawn] = useState(false);
  const [short, setShort] = useState(false);
  const canvas = useRef<HTMLCanvasElement>(null);
  const down = useRef(false);
  const last = useRef<{ x: number; y: number } | null>(null);
  const travel = useRef(0);

  const point = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * W, y: ((e.clientY - r.top) / r.height) * H };
  };
  const clear = () => {
    canvas.current?.getContext('2d')?.clearRect(0, 0, W, H);
    travel.current = 0;
    setDrawn(false);
    setShort(false);
    onChange('');
  };

  return (
    <div className="sig">
      <div className="sig-box">
        <canvas
          ref={canvas}
          width={W}
          height={H}
          aria-label="Signature area: draw your signature here"
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId);
            down.current = true;
            const ctx = e.currentTarget.getContext('2d');
            const p = point(e);
            last.current = p;
            if (!ctx) return;
            ctx.lineWidth = 3;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.strokeStyle = '#111827';
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(p.x + 0.01, p.y + 0.01);
            ctx.stroke();
          }}
          onPointerMove={(e) => {
            if (!down.current) return;
            const ctx = e.currentTarget.getContext('2d');
            const p = point(e);
            if (last.current) travel.current += Math.hypot(p.x - last.current.x, p.y - last.current.y);
            last.current = p;
            ctx?.lineTo(p.x, p.y);
            ctx?.stroke();
          }}
          onPointerUp={(e) => {
            if (!down.current) return;
            down.current = false;
            setDrawn(true);
            if (travel.current < MIN_STROKE) {
              setShort(true);
              onChange('');
              return;
            }
            setShort(false);
            onChange(e.currentTarget.toDataURL('image/png'));
          }}
          onPointerCancel={() => {
            down.current = false;
          }}
        />
        {!drawn && <span className="sig-hint">Sign here</span>}
      </div>
      {short && (
        <div className="of-err" role="alert">
          That looks like a dot or a short mark. Please sign with your full signature.
        </div>
      )}
      <div className="sig-foot">
        <span>By signing you agree this is your legal signature on this offer.</span>
        <button type="button" className="lnk" onClick={clear}>
          Clear
        </button>
      </div>
    </div>
  );
}
