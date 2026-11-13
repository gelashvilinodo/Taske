'use client';

import { useState, type CSSProperties, type ReactNode } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

/** One slice of a donut, or one row of a bar list. `tone` is any CSS colour (usually a token). */
export interface Slice { key: string; label: string; value: number; tone: string; href?: string }

const R = 46;
const C = 2 * Math.PI * R;
const GAP = 2.2; // px of track left between slices

/**
 * Glass donut: slices on a sunken track around a raised glass disc that holds the headline number.
 * Hovering a slice (or its legend row) lifts it and shows its share in the middle.
 */
export function Donut({ slices, center, label }: { slices: Slice[]; center: { value: string; caption: string }; label: string }) {
  const [hot, setHot] = useState<string | null>(null);
  const router = useRouter();
  const total = slices.reduce((s, x) => s + x.value, 0);
  const live = slices.filter(s => s.value > 0);
  let at = 0;
  const arcs = live.map(s => {
    const len = (s.value / total) * C;
    const arc = { ...s, len: Math.max(len - (live.length > 1 ? GAP : 0), 0.001), start: at };
    at += len;
    return arc;
  });
  const hotSlice = slices.find(s => s.key === hot);
  const pct = (v: number) => (total ? Math.round(v / total * 100) : 0);

  return (
    <div className="donut">
      <div className="donut-ring">
        <svg viewBox="0 0 120 120" role="img" aria-label={label + ': ' + slices.map(s => `${s.label} ${s.value}`).join(', ')}>
          <circle className="donut-track" cx="60" cy="60" r={R} />
          {arcs.map(a => (
            <circle key={a.key} className={'donut-arc' + (hot && hot !== a.key ? ' is-dim' : '') + (hot === a.key ? ' is-hot' : '')}
              cx="60" cy="60" r={R} style={{ '--tone': a.tone, strokeDasharray: `${a.len} ${C}`, strokeDashoffset: -a.start } as CSSProperties}
              onPointerEnter={() => setHot(a.key)} onPointerLeave={() => setHot(null)} onClick={() => a.href && router.push(a.href)} />
          ))}
        </svg>
        <div className="donut-core" aria-hidden="true">
          <b>{hotSlice ? pct(hotSlice.value) + '%' : center.value}</b>
          <span>{hotSlice ? hotSlice.label : center.caption}</span>
        </div>
      </div>
      <ul className="legend">
        {slices.map(s => (
          <li key={s.key} className={hot === s.key ? 'is-hot' : undefined} style={{ '--tone': s.tone } as CSSProperties}
            onPointerEnter={() => setHot(s.key)} onPointerLeave={() => setHot(null)}>
            {s.href ? (
              <Link href={s.href} className="legend-row" aria-label={`${s.label}: ${s.value}, open in Table`} onFocus={() => setHot(s.key)} onBlur={() => setHot(null)}>
                <i aria-hidden="true" /><span className="legend-name">{s.label}</span><b>{s.value}</b><small>{pct(s.value)}%</small>
              </Link>
            ) : (
              <span className="legend-row"><i aria-hidden="true" /><span className="legend-name">{s.label}</span><b>{s.value}</b><small>{pct(s.value)}%</small></span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** A rounded-up top for a chart's scale: 1, 2, 5, 10, 20, 50… */
export function niceMax(n: number) {
  if (n <= 4) return n <= 2 ? 2 : 4; // small scales stay whole at the halfway line
  const p = 10 ** Math.floor(Math.log10(n));
  return ([1, 2, 2.5, 5, 10].map(m => m * p).find(v => v >= n)) ?? n;
}

export interface Column { key: string; label: string; tip: string; minor?: boolean; back: number; front: number; flag?: number; best?: boolean; now?: boolean; href?: string }

/**
 * Glass column chart. Each column has a frosted back bar (e.g. planned) and a glowing front bar
 * (e.g. done) rising inside it; `flag` puts a small red count on top (late). Columns grow when
 * the period changes.
 */
export function Columns({ cols, label, backName, frontName, flagName }: {
  cols: Column[]; label: string; backName?: string; frontName: string; flagName?: string;
}) {
  const max = niceMax(Math.max(0, ...cols.map(c => Math.max(c.back, c.front))));
  const h = (v: number) => (v / max) * 100 + '%';
  const many = cols.length > 16;
  return (
    <div className={'cols' + (many ? ' is-many' : '')} role="img" aria-label={label}>
      <div className="cols-grid" aria-hidden="true">
        {[max, max / 2, 0].map((v, i) => <span key={i}><small>{Number.isInteger(v) ? v : v.toFixed(1)}</small></span>)}
      </div>
      <div className="cols-plot" style={{ '--n': cols.length } as CSSProperties}>
        {cols.map(c => {
          const tip = c.tip + (backName ? ` · ${c.back} ${backName}` : '') + ` · ${c.front} ${frontName}` + (flagName && c.flag ? ` · ${c.flag} ${flagName}` : '');
          return (
            <Col key={c.key} href={c.href} className={'col' + (c.best ? ' is-best' : '') + (c.now ? ' is-now' : '')} tip={tip}>
              <div className="col-bars">
                {backName !== undefined && <span className="col-back" style={{ height: h(c.back) }} />}
                <span className="col-front" style={{ height: h(c.front) }} />
                {!!c.flag && <span className="col-flag" style={{ bottom: `calc(${h(Math.max(c.back, c.front))} + 4px)` }}>{c.flag}</span>}
              </div>
              <span className={'col-label' + (c.minor ? ' is-minor' : '')}>{c.label}</span>
            </Col>
          );
        })}
      </div>
    </div>
  );
}

/** A column: a link when it leads somewhere, else a focusable box (for its tooltip). */
function Col({ href, className, tip, children }: { href?: string; className: string; tip: string; children: ReactNode }) {
  return href
    ? <Link href={href} className={className + ' is-link'} data-tip={tip} aria-label={tip + ', open in Table'}>{children}</Link>
    : <div className={className} data-tip={tip} tabIndex={0} aria-label={tip}>{children}</div>;
}

export interface BarRow { key: string; label: ReactNode; name: string; value: number; total: number; tone: string; extra?: string; href?: string }

/** Horizontal glass bars: how much of each row is done, out of its total. */
export function BarList({ rows, empty }: { rows: BarRow[]; empty: string }) {
  if (!rows.length) return <p className="dash-empty">{empty}</p>;
  return (
    <ul className="hbars">
      {rows.map(r => {
        const pct = r.total ? Math.round(r.value / r.total * 100) : 0;
        return (
          <li key={r.key} style={{ '--tone': r.tone } as CSSProperties}>
            {(() => {
              const body = (<>
                <span className="hbar-name">{r.label}</span>
                <span className="hbar-num"><b>{r.value}</b>/{r.total}{r.extra && <small> · {r.extra}</small>}</span>
                <span className="hbar-track" role="img" aria-label={`${r.name}: ${r.value} of ${r.total} done`}>
                  <i style={{ width: pct + '%' }} />
                </span>
              </>);
              return r.href ? <Link href={r.href} className="hbar-row is-link">{body}</Link> : <div className="hbar-row">{body}</div>;
            })()}
          </li>
        );
      })}
    </ul>
  );
}
