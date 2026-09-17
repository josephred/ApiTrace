import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { TraceEdge, TraceNode, TraceNodeType, TraceResult } from '../lib/types';
import { formatDateTime } from '../lib/format';
import { humanizeCode } from '../lib/vocabulary';
import { Button, Pill, SummaryList } from './ui';

/**
 * Columnas del grafo, en el orden natural de la cadena apicola.
 *
 * Distribuir por tipo y no por profundidad calculada mantiene la lectura
 * estable: el productor siempre a la izquierda y el tambor siempre a la
 * derecha, sin importar por donde haya empezado la consulta.
 */
const RANK: Record<TraceNodeType, number> = {
  producer: 0,
  renapa: 1,
  renspa: 1,
  establishment: 2,
  apiary: 3,
  movement: 4,
  dte: 5,
  reception: 5,
  extraction: 6,
  lot: 7,
  drum: 8,
};

const TYPE_LABEL: Record<TraceNodeType, string> = {
  producer: 'Productor',
  renapa: 'RENAPA',
  renspa: 'RENSPA',
  establishment: 'Establecimiento',
  apiary: 'Apiario',
  movement: 'Movimiento',
  dte: 'DT-e',
  reception: 'Recepción',
  extraction: 'Extracción',
  lot: 'Lote',
  drum: 'Tambor',
};

const TYPE_COLOR: Record<TraceNodeType, string> = {
  producer: 'var(--info-fg)',
  renapa: 'var(--info-fg)',
  renspa: 'var(--info-fg)',
  establishment: 'var(--text-2)',
  apiary: 'var(--success-fg)',
  movement: 'var(--brand)',
  dte: 'var(--warning-fg)',
  reception: 'var(--warning-fg)',
  extraction: 'var(--brand)',
  lot: 'var(--success-fg)',
  drum: 'var(--success-fg)',
};

const NODE_W = 154;
const NODE_H = 52;
const COL_GAP = 46;
const ROW_GAP = 22;
const PAD = 26;

interface Placed extends TraceNode {
  x: number;
  y: number;
}

const layout = (nodes: TraceNode[]): { placed: Placed[]; width: number; height: number } => {
  const columns = new Map<number, TraceNode[]>();
  for (const node of nodes) {
    const rank = RANK[node.type] ?? 9;
    const bucket = columns.get(rank) ?? [];
    bucket.push(node);
    columns.set(rank, bucket);
  }

  const ranks = [...columns.keys()].sort((a, b) => a - b);
  const tallest = Math.max(1, ...ranks.map((rank) => columns.get(rank)!.length));
  const height = PAD * 2 + tallest * NODE_H + (tallest - 1) * ROW_GAP;

  const placed: Placed[] = [];
  ranks.forEach((rank, columnIndex) => {
    const bucket = columns.get(rank)!;
    const columnHeight = bucket.length * NODE_H + (bucket.length - 1) * ROW_GAP;
    // Cada columna se centra verticalmente para que la cadena se lea en linea.
    const startY = (height - columnHeight) / 2;
    bucket.forEach((node, rowIndex) => {
      placed.push({
        ...node,
        x: PAD + columnIndex * (NODE_W + COL_GAP),
        y: startY + rowIndex * (NODE_H + ROW_GAP),
      });
    });
  });

  const width = PAD * 2 + ranks.length * NODE_W + Math.max(0, ranks.length - 1) * COL_GAP;
  return { placed, width, height };
};

const edgePath = (from: Placed, to: Placed): string => {
  // Se conecta siempre por el lado que enfrenta al otro nodo, de modo que las
  // aristas hacia atrás no crucen por encima de las cajas.
  const fromRight = to.x >= from.x;
  const x1 = fromRight ? from.x + NODE_W : from.x;
  const x2 = fromRight ? to.x : to.x + NODE_W;
  const y1 = from.y + NODE_H / 2;
  const y2 = to.y + NODE_H / 2;
  const dx = Math.max(24, Math.abs(x2 - x1) * 0.45) * (fromRight ? 1 : -1);
  return `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`;
};

const truncate = (value: string, max = 19): string =>
  value.length > max ? `${value.slice(0, max - 1)}…` : value;

export const TraceGraph = ({ result }: { result: TraceResult }) => {
  const [selected, setSelected] = useState<TraceNode | null>(null);
  const [scale, setScale] = useState(1);
  const canvasRef = useRef<HTMLDivElement>(null);
  const { placed, width, height } = useMemo(() => layout(result.nodes), [result.nodes]);

  /**
   * Una cadena completa es más ancha que la pantalla. El contenedor permite
   * desplazarse, pero eso obliga a descubrirlo: por defecto se ajusta al ancho
   * disponible para que la cadena entera se vea de un vistazo, y quien necesite
   * leer las etiquetas puede volver al 100 %.
   */
  const fitToWidth = useCallback(() => {
    const available = canvasRef.current?.clientWidth ?? 0;
    if (!available || width <= available) {
      setScale(1);
      return;
    }
    setScale(Math.max(0.45, (available - 8) / width));
  }, [width]);

  useEffect(() => {
    fitToWidth();
  }, [fitToWidth]);
  const index = useMemo(() => new Map(placed.map((node) => [node.key, node])), [placed]);

  const visibleEdges = useMemo(
    () =>
      result.edges.filter(
        (edge: TraceEdge) => index.has(edge.from) && index.has(edge.to),
      ),
    [result.edges, index],
  );

  const typesPresent = useMemo(
    () => [...new Set(result.nodes.map((node) => node.type))].sort((a, b) => RANK[a] - RANK[b]),
    [result.nodes],
  );

  return (
    <div>
      <div className="row-between" style={{ marginBottom: 'var(--sp-3)', flexWrap: 'wrap' }}>
        <span className="small muted">
          {result.nodes.length} nodos · {result.edges.length} relaciones
        </span>
        <div className="row row-tight">
          <Button size="sm" onClick={fitToWidth}>
            Ajustar
          </Button>
          <Button
            size="sm"
            onClick={() => setScale((current) => Math.max(0.4, current - 0.15))}
            aria-label="Alejar"
          >
            −
          </Button>
          <span className="small mono nowrap" style={{ minWidth: '3.2rem', textAlign: 'center' }}>
            {Math.round(scale * 100)} %
          </span>
          <Button
            size="sm"
            onClick={() => setScale((current) => Math.min(2, current + 0.15))}
            aria-label="Acercar"
          >
            +
          </Button>
        </div>
      </div>

      <div className="trace-canvas" ref={canvasRef}>
        <svg
          width={width * scale}
          height={height * scale}
          viewBox={`0 0 ${width} ${height}`}
          role="img"
          aria-label={`Grafo de trazabilidad ${result.direction === 'backward' ? 'hacia atrás' : 'hacia adelante'} con ${result.nodes.length} nodos`}
        >
          <defs>
            <marker
              id="arrow"
              viewBox="0 0 8 8"
              refX="7"
              refY="4"
              markerWidth="7"
              markerHeight="7"
              orient="auto-start-reverse"
            >
              <path d="M 0 0 L 8 4 L 0 8 z" fill="var(--border-control)" />
            </marker>
          </defs>

          <g>
            {visibleEdges.map((edge, i) => {
              const from = index.get(edge.from)!;
              const to = index.get(edge.to)!;
              return (
                <path
                  key={`${edge.from}-${edge.to}-${i}`}
                  d={edgePath(from, to)}
                  fill="none"
                  stroke="var(--border-control)"
                  strokeWidth={1.4}
                  markerEnd="url(#arrow)"
                >
                  <title>{edge.relation}</title>
                </path>
              );
            })}
          </g>

          <g>
            {placed.map((node) => {
              const isRoot = node.key === result.root.key;
              const isSelected = selected?.key === node.key;
              return (
                <g
                  key={node.key}
                  className="trace-node"
                  transform={`translate(${node.x} ${node.y})`}
                  onClick={() => setSelected(isSelected ? null : node)}
                  style={{ cursor: 'pointer' }}
                  tabIndex={0}
                  role="button"
                  aria-label={`${TYPE_LABEL[node.type]} ${node.label}`}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      setSelected(isSelected ? null : node);
                    }
                  }}
                >
                  <rect
                    width={NODE_W}
                    height={NODE_H}
                    rx={8}
                    fill="var(--surface)"
                    stroke={isRoot || isSelected ? TYPE_COLOR[node.type] : 'var(--border)'}
                    strokeWidth={isRoot || isSelected ? 2 : 1}
                  />
                  <rect width={4} height={NODE_H} rx={2} fill={TYPE_COLOR[node.type]} />
                  <text x={14} y={19} fontSize={9.5} fill="var(--text-2)" letterSpacing="0.05em">
                    {TYPE_LABEL[node.type].toUpperCase()}
                  </text>
                  <text x={14} y={37} fontSize={12.5} fontWeight={620} fill="var(--text-1)">
                    {truncate(node.label)}
                  </text>
                  {isRoot && (
                    <circle cx={NODE_W - 11} cy={12} r={4} fill={TYPE_COLOR[node.type]}>
                      <title>Punto de partida de la consulta</title>
                    </circle>
                  )}
                </g>
              );
            })}
          </g>
        </svg>
      </div>

      <div className="trace-legend">
        {typesPresent.map((type) => (
          <span key={type} className="pill">
            <span className="dot" style={{ background: TYPE_COLOR[type] }} />
            {TYPE_LABEL[type]}
          </span>
        ))}
      </div>

      {selected && (
        <div className="card" style={{ marginTop: 'var(--sp-4)' }}>
          <div className="card-head">
            <div className="row row-tight">
              <Pill tone="brand">{TYPE_LABEL[selected.type]}</Pill>
              <strong>{selected.label}</strong>
            </div>
            <Button variant="ghost" size="sm" icon="close" onClick={() => setSelected(null)}>
              Cerrar
            </Button>
          </div>
          <div className="card-body">
            <SummaryList
              rows={Object.entries(selected.attributes)
                .filter(([, value]) => value !== null && value !== undefined && value !== '')
                .map(([key, value]) => ({
                  key: humanizeCode(key.replace(/([A-Z])/g, ' $1')),
                  value:
                    typeof value === 'boolean'
                      ? value
                        ? 'Sí'
                        : 'No'
                      : /At$|Date$/.test(key)
                        ? formatDateTime(String(value))
                        : String(value),
                }))}
            />
          </div>
        </div>
      )}
    </div>
  );
};
