import { useMemo, useRef, useState } from 'react';

// Courbe d'une seule série (le titre la nomme, pas de légende), un seul axe Y.
// points = [{ t: ms, v: nombre | null }] ; les null coupent la ligne.
// Survol : réticule vertical + infobulle sur le point le plus proche.
const W = 360;
const H = 150;
const PAD = { top: 10, right: 8, bottom: 22, left: 40 };

const niceTicks = (min, max, count = 4) => {
  if (min === max) { min -= 1; max += 1; }
  const step0 = (max - min) / count;
  const mag = 10 ** Math.floor(Math.log10(step0));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= step0);
  const lo = Math.floor(min / step) * step;
  const hi = Math.ceil(max / step) * step;
  const ticks = [];
  for (let v = lo; v <= hi + step / 2; v += step) ticks.push(Number(v.toFixed(6)));
  return ticks;
};

const timeLabel = (t) => new Date(t).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

export default function LineChart({ title, unit, points, digits = 1 }) {
  const svgRef = useRef(null);
  const [hover, setHover] = useState(null);
  const valid = useMemo(() => points.filter((p) => p.v != null), [points]);
  const last = valid[valid.length - 1];

  const geo = useMemo(() => {
    if (valid.length === 0) return null;
    const t0 = points[0].t;
    const t1 = Math.max(points[points.length - 1].t, t0 + 60000);
    const values = valid.map((p) => p.v);
    const ticks = niceTicks(Math.min(...values), Math.max(...values));
    const yMin = ticks[0];
    const yMax = ticks[ticks.length - 1];
    const x = (t) => PAD.left + ((t - t0) / (t1 - t0)) * (W - PAD.left - PAD.right);
    const y = (v) => H - PAD.bottom - ((v - yMin) / (yMax - yMin)) * (H - PAD.top - PAD.bottom);
    let d = '';
    let pen = false;
    for (const p of points) {
      if (p.v == null) { pen = false; continue; }
      d += `${pen ? 'L' : 'M'}${x(p.t).toFixed(1)},${y(p.v).toFixed(1)}`;
      pen = true;
    }
    return { x, y, d, ticks, t0, t1 };
  }, [points, valid]);

  const onMove = (e) => {
    if (!geo) return;
    const rect = svgRef.current.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * W;
    let best = null;
    for (const p of valid) {
      if (!best || Math.abs(geo.x(p.t) - px) < Math.abs(geo.x(best.t) - px)) best = p;
    }
    setHover(best);
  };

  return (
    <figure className="chart">
      <figcaption>
        <span>{title}</span>
        <strong>{last ? `${last.v.toFixed(digits)} ${unit}` : '—'}</strong>
      </figcaption>
      {!geo ? (
        <div className="chart-empty">En attente de mesures…</div>
      ) : (
        <div className="chart-plot">
          <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} role="img"
               aria-label={`${title} : dernière valeur ${last.v.toFixed(digits)} ${unit}`}
               onMouseMove={onMove} onMouseLeave={() => setHover(null)}>
            {geo.ticks.map((v) => (
              <g key={v}>
                <line className="grid" x1={PAD.left} x2={W - PAD.right} y1={geo.y(v)} y2={geo.y(v)} />
                <text className="axis" x={PAD.left - 6} y={geo.y(v)} textAnchor="end" dominantBaseline="middle">{v}</text>
              </g>
            ))}
            <text className="axis" x={PAD.left} y={H - 6}>{timeLabel(geo.t0)}</text>
            <text className="axis" x={W - PAD.right} y={H - 6} textAnchor="end">{timeLabel(geo.t1)}</text>
            <path className="line" d={geo.d} />
            {valid.length === 1 && <circle className="dot" cx={geo.x(last.t)} cy={geo.y(last.v)} r="4" />}
            {hover && (
              <g>
                <line className="crosshair" x1={geo.x(hover.t)} x2={geo.x(hover.t)} y1={PAD.top} y2={H - PAD.bottom} />
                <circle className="dot" cx={geo.x(hover.t)} cy={geo.y(hover.v)} r="4" />
              </g>
            )}
          </svg>
          {hover && (
            <div className="tooltip" style={{ left: `${(geo.x(hover.t) / W) * 100}%` }}>
              <strong>{hover.v.toFixed(digits)} {unit}</strong>
              <span>{new Date(hover.t).toLocaleTimeString('fr-FR')}</span>
            </div>
          )}
        </div>
      )}
    </figure>
  );
}
