'use client';

import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent } from 'react';
import { coverZoom, imageSize, loadImage, renderLogo, ZOOM_MAX, ZOOM_MIN, type LogoFrame } from '@/lib/tasks/logo';
import { IconMinus, IconPlus, IconSave } from '@/components/shell/icons';
import s from './LogoEditor.module.css';

const clampZoom = (z: number) => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z));

/** Frame a logo inside the square tile: drag to move it, wheel / pinch / slider to zoom. */
export default function LogoEditor({ src, initial, onApply, onCancel }: {
  src: string;
  initial?: LogoFrame;
  onApply: (logo: string, frame: LogoFrame) => void;
  onCancel: () => void;
}) {
  const box = useRef<HTMLDivElement>(null);
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [frame, setFrame] = useState<LogoFrame>(initial ?? { zoom: 1, x: 0, y: 0 });
  const [error, setError] = useState('');
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const frameRef = useRef(frame);
  frameRef.current = frame;

  useEffect(() => {
    let live = true;
    loadImage(src).then(i => {
      if (!live) return;
      setImg(i);
      if (!initial) setFrame({ zoom: coverZoom(i), x: 0, y: 0 });
    }, e => live && setError(e.message));
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src]);

  const size = img ? imageSize(img) : { w: 1, h: 1 };
  const fw = size.w / Math.max(size.w, size.h), fh = size.h / Math.max(size.w, size.h);

  /** Keep at least a sliver of the image inside the frame so it can't get lost. */
  const clamp = (f: LogoFrame): LogoFrame => {
    const zoom = clampZoom(f.zoom);
    const mx = (fw * zoom + 1) / 2 - 0.1, my = (fh * zoom + 1) / 2 - 0.1;
    return { zoom, x: Math.max(-mx, Math.min(mx, f.x)), y: Math.max(-my, Math.min(my, f.y)) };
  };
  const update = (f: LogoFrame) => setFrame(clamp(f));

  /** Zoom while keeping the point `p` (frame fractions from the centre) where it is. */
  const zoomAt = (target: number, p = { x: 0, y: 0 }) => {
    const f = frameRef.current;
    const z = clampZoom(target), k = z / f.zoom;
    update({ zoom: z, x: p.x - (p.x - f.x) * k, y: p.y - (p.y - f.y) * k });
  };

  const rel = (cx: number, cy: number) => {
    const r = box.current!.getBoundingClientRect();
    return { x: (cx - r.left) / r.width - 0.5, y: (cy - r.top) / r.height - 0.5, side: r.width };
  };

  // Wheel needs a non-passive listener so the page doesn't scroll.
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const p = rel(e.clientX, e.clientY);
      zoomAt(frameRef.current.zoom * Math.exp(-e.deltaY * 0.0015), p);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  });

  const onDown = (e: PointerEvent) => {
    box.current?.setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
  };
  const onMove = (e: PointerEvent) => {
    const map = pointers.current;
    const prev = map.get(e.pointerId);
    if (!prev) return;
    const side = box.current!.getBoundingClientRect().width;
    if (map.size === 1) {
      const f = frameRef.current;
      update({ ...f, x: f.x + (e.clientX - prev.x) / side, y: f.y + (e.clientY - prev.y) / side });
    } else if (map.size === 2) {
      const other = [...map.entries()].find(([id]) => id !== e.pointerId)![1];
      const before = Math.hypot(prev.x - other.x, prev.y - other.y);
      const after = Math.hypot(e.clientX - other.x, e.clientY - other.y);
      if (before > 0) {
        const mid = rel((e.clientX + other.x) / 2, (e.clientY + other.y) / 2);
        zoomAt(frameRef.current.zoom * (after / before), mid);
      }
    }
    map.set(e.pointerId, { x: e.clientX, y: e.clientY });
  };
  const onUp = (e: PointerEvent) => { pointers.current.delete(e.pointerId); };

  const onKey = (e: KeyboardEvent) => {
    const step = e.shiftKey ? 0.05 : 0.01;
    const f = frameRef.current;
    const moves: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
    if (moves[e.key]) { e.preventDefault(); update({ ...f, x: f.x + moves[e.key][0], y: f.y + moves[e.key][1] }); }
    else if (e.key === '+' || e.key === '=') { e.preventDefault(); zoomAt(f.zoom * 1.1); }
    else if (e.key === '-') { e.preventDefault(); zoomAt(f.zoom / 1.1); }
  };

  const apply = () => {
    if (!img) return;
    try { onApply(renderLogo(img, frame), frame); }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not use this image.'); }
  };

  const fill = img ? coverZoom(img) : 1;
  const view = { '--x': frame.x, '--y': frame.y, '--z': frame.zoom, '--fw': fw, '--fh': fh } as CSSProperties;
  const picture = <img src={src} alt="" draggable={false} />;
  const lz = Math.log(ZOOM_MIN), hz = Math.log(ZOOM_MAX);

  return (
    <div className={s.editor}>
      <div className={s.stage}>
        <div ref={box} className={s.frame} style={view} tabIndex={0} role="application"
          aria-label="Logo framing. Drag or use the arrow keys to move, scroll or plus and minus to zoom."
          onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} onKeyDown={onKey}>
          {img && picture}
        </div>
        <div className={s.previews} aria-hidden="true">
          <span className={s.previewsLabel}>Preview</span>
          {[64, 28, 14].map(px => (
            <div key={px} className={s.preview} style={{ ...view, '--px': px + 'px' } as CSSProperties}>{img && picture}</div>
          ))}
        </div>
      </div>

      <div className={s.zoomRow}>
        <button type="button" className={s.iconBtn} aria-label="Zoom out" onClick={() => zoomAt(frame.zoom / 1.2)}><IconMinus size={16} /></button>
        <input type="range" className={s.slider} aria-label="Zoom" min={0} max={1000}
          value={Math.round(((Math.log(frame.zoom) - lz) / (hz - lz)) * 1000)}
          onChange={e => zoomAt(Math.exp(lz + (Number(e.target.value) / 1000) * (hz - lz)))} />
        <button type="button" className={s.iconBtn} aria-label="Zoom in" onClick={() => zoomAt(frame.zoom * 1.2)}><IconPlus size={16} /></button>
        <span className={s.pct}>{Math.round((frame.zoom / fill) * 100)}%</span>
      </div>

      <div className={s.actions}>
        <button type="button" className="ghost" onClick={() => update({ zoom: 1, x: 0, y: 0 })} title="Show the whole logo">Fit</button>
        <button type="button" className="ghost" onClick={() => update({ zoom: fill, x: 0, y: 0 })} title="Fill the whole tile">Fill</button>
        <button type="button" className="ghost" onClick={() => update({ ...frame, x: 0, y: 0 })}>Centre</button>
        <span className={s.spacer} />
        <button type="button" className="ghost" onClick={onCancel}>Cancel</button>
        <button type="button" className="primary" disabled={!img} onClick={apply}><IconSave size={16} />Use logo</button>
      </div>
      <p className={s.hint}>Drag to move, scroll or pinch to zoom. Arrow keys nudge, Shift for bigger steps.</p>
      {error && <p className="form-error" role="alert">{error}</p>}
    </div>
  );
}
