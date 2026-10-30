import { useId, type ReactNode } from 'react';
import type { CargoType, PlaceType, VehicleKind } from '../lib/cargo';

/**
 * Ilustraciones del rediseño (doc 13).
 *
 * Todas son SVG propias, dibujadas en código: no dependen de la red ni de
 * archivos de imagen, se ven nítidas en cualquier pantalla y pesan casi nada.
 * Son decorativas (aria-hidden): el texto que las acompaña dice lo mismo.
 *
 *  - HeroIcon: el ícono grande de cada formulario («Registrá un nuevo apiario»).
 *  - CargoArt: lo que se transporta (paso 1 del asistente).
 *  - VehicleArt: el vehículo guardado (paso 2 y Traslados).
 *  - PlaceGlyph: el tipo de lugar (pasos 4 y 5, mapa).
 */

/* =========================================================================
   Íconos grandes de los formularios
   ========================================================================= */

export type HeroIconName =
  | 'personPlus'
  | 'person'
  | 'databasePlus'
  | 'databaseDrop'
  | 'hivePlus'
  | 'farmPlus'
  | 'fieldPlus'
  | 'jarComb'
  | 'jarPlus'
  | 'truckArrow'
  | 'truckPlus'
  | 'mapPin';

/** Insignia «+» rellena, abajo a la derecha. */
const PlusBadge = ({ cx = 70, cy = 70, r = 15 }: { cx?: number; cy?: number; r?: number }) => (
  <g>
    <circle cx={cx} cy={cy} r={r} fill="currentColor" stroke="var(--bg)" strokeWidth={3} />
    <path
      d={`M${cx} ${cy - r * 0.5}v${r}M${cx - r * 0.5} ${cy}h${r}`}
      stroke="var(--hero-badge-ink, #1c1406)"
      strokeWidth={3.4}
      strokeLinecap="round"
    />
  </g>
);

const cylinder = (
  <>
    <ellipse cx="40" cy="22" rx="26" ry="9" />
    <path d="M14 22v44c0 5 11.6 9 26 9" />
    <path d="M66 22v26" />
    <path d="M14 37c0 5 11.6 9 26 9s26-4 26-9" />
    <path d="M14 52c0 5 11.6 9 26 9 5 0 9.6-.5 13.4-1.3" />
  </>
);

const HERO_PATHS: Record<HeroIconName, ReactNode> = {
  person: (
    <>
      <circle cx="48" cy="32" r="15" />
      <path d="M20 80c0-16.6 12.5-28 28-28s28 11.4 28 28" />
    </>
  ),
  personPlus: (
    <>
      <circle cx="42" cy="30" r="15" />
      <path d="M14 78c0-16.6 12.5-28 28-28 6.5 0 12.4 2 17 5.4" />
      <PlusBadge cx={68} cy={68} r={16} />
    </>
  ),
  databasePlus: (
    <>
      {cylinder}
      <PlusBadge cx={68} cy={68} r={16} />
    </>
  ),
  databaseDrop: (
    <>
      {cylinder}
      <path d="M70 50c-6 8.5-10 14.4-10 19a10 10 0 0 0 20 0c0-4.6-4-10.5-10-19z" />
    </>
  ),
  hivePlus: (
    <>
      <path d="M14 30 40 14l26 16" />
      <path d="M18 30h44" />
      <rect x="18" y="30" width="44" height="16" rx="2" />
      <rect x="18" y="46" width="44" height="16" rx="2" />
      <path d="M18 62h34v14H18z" />
      <path d="M33 76v-5h8v5" />
      <PlusBadge cx={68} cy={68} r={16} />
    </>
  ),
  /** «Finca / Polinización» (doc 14): el granero, el árbol y la abeja que poliniza. */
  farmPlus: (
    <>
      <path d="M6 40 28 22l22 18" />
      <path d="M11 36v38h34V36" />
      <path d="M20 74V54h16v20" />
      <path d="M20 54l16 20M36 54 20 74" strokeWidth={3} />
      <path d="M2 74h46" />
      <path d="M62 40A8 8 0 0 1 62 24A10 10 0 0 1 82 24A8 8 0 0 1 82 40Z" />
      <path d="M72 40v13M72 47l5-5" />
      <g transform="translate(14 8) rotate(-12) scale(1.15)">
        <path
          d="M-2 0c-3-6-9-6-9-1.5 0 3 4 4 8 2.5M2 0c3-6 9-6 9-1.5 0 3-4 4-8 2.5"
          strokeWidth={2.4}
        />
        <ellipse cx="0" cy="4" rx="7" ry="4.6" fill="currentColor" stroke="none" />
        <path d="M-2 .2v7.6M2.4 .4v7.2" stroke="var(--hero-badge-ink, #1c1406)" strokeWidth={1.8} />
      </g>
      <PlusBadge cx={70} cy={70} r={16} />
    </>
  ),
  /** Opción «Finca / Polinización» de Carga de datos (doc 14): la flor en el campo arado. */
  fieldPlus: (
    <>
      <circle cx="44" cy="10" r="4.2" />
      <circle cx="50.9" cy="14" r="4.2" />
      <circle cx="50.9" cy="22" r="4.2" />
      <circle cx="44" cy="26" r="4.2" />
      <circle cx="37.1" cy="22" r="4.2" />
      <circle cx="37.1" cy="14" r="4.2" />
      <circle cx="44" cy="18" r="3" fill="currentColor" />
      <path d="M44 30v20" />
      <path d="M44 44c-6 0-10.5-3-12.5-8.5 6.5 0 10.5 3 12.5 8.5z" />
      <path d="M44 38c5 0 8.5-2.5 10-7-5 0-8.5 2.5-10 7z" />
      <path d="M6 56c12-6 26-8 44-6" />
      <path d="M6 68c14-8 30-11 48-9" />
      <path d="M8 80c12-8 26-11 42-10" />
      <path d="M16 90c8-5 18-7 30-7" />
      <PlusBadge cx={70} cy={70} r={16} />
    </>
  ),
  jarComb: (
    <>
      <rect x="28" y="12" width="40" height="12" rx="3" />
      <path d="M32 24v4c-6 3-10 8-10 15v27a12 12 0 0 0 12 12h28a12 12 0 0 0 12-12V43c0-7-4-12-10-15v-4" />
      <path d="M48 42l7 4v8l-7 4-7-4v-8z" />
      <path d="M41 54l7 4v8l-7 4-7-4v-8z" transform="translate(-0 0)" />
      <path d="M55 54l7 4v8l-7 4-7-4v-8z" />
    </>
  ),
  jarPlus: (
    <>
      <rect x="24" y="12" width="36" height="11" rx="3" />
      <path d="M28 23v4c-5 3-9 7.5-9 14v26a11 11 0 0 0 11 11h24" />
      <path d="M56 27c5 3 9 7.5 9 14v6" />
      <path d="M42 42l6 3.5v7L42 56l-6-3.5v-7z" />
      <PlusBadge cx={68} cy={68} r={16} />
    </>
  ),
  truckArrow: (
    <>
      <path d="M8 22a4 4 0 0 1 4-4h40a4 4 0 0 1 4 4v42H8z" />
      <path d="M56 36h14.5a4 4 0 0 1 3.2 1.6l9.5 12.6a4 4 0 0 1 .8 2.4V64H56" />
      <circle cx="24" cy="68" r="8" />
      <circle cx="70" cy="68" r="8" />
      <path d="M20 41h22M35 33l8 8-8 8" />
    </>
  ),
  truckPlus: (
    <>
      <path d="M8 22a4 4 0 0 1 4-4h38a4 4 0 0 1 4 4v38H8z" />
      <path d="M54 34h12a4 4 0 0 1 3.2 1.6l7 9.4" />
      <circle cx="22" cy="66" r="7" />
      <path d="M29 66h14" />
      <PlusBadge cx={70} cy={68} r={16} />
    </>
  ),
  mapPin: (
    <>
      <path d="M48 86s26-24.5 26-44a26 26 0 0 0-52 0c0 19.5 26 44 26 44z" />
      <circle cx="48" cy="42" r="9" />
    </>
  ),
};

export const HeroIcon = ({
  name,
  size = 96,
  tone = 'amber',
}: {
  name: HeroIconName;
  size?: number;
  tone?: 'amber' | 'sky';
}) => (
  <svg
    className={`hero-icon hero-icon-${tone}`}
    width={size}
    height={size}
    viewBox="0 0 96 96"
    fill="none"
    stroke="currentColor"
    strokeWidth={4.4}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    focusable="false"
  >
    {HERO_PATHS[name]}
  </svg>
);

/* =========================================================================
   Isométrica: cajas de madera (alzas, colmenas, núcleos)
   ========================================================================= */

type Point = [number, number];
const COS30 = Math.cos(Math.PI / 6);

const projector = (ox: number, oy: number, scale: number) => (x: number, y: number, z: number): Point => [
  ox + (x - y) * COS30 * scale,
  oy + (x + y) * 0.5 * scale - z * scale,
];

const poly = (points: Point[]): string =>
  points.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');

interface BoxSpec {
  w: number;
  d: number;
  h: number;
  z?: number;
  /** Desplazamiento en x/y del plano (para tapas que sobresalen). */
  dx?: number;
  dy?: number;
}

const boxFaces = (p: ReturnType<typeof projector>, { w, d, h, z = 0, dx = 0, dy = 0 }: BoxSpec) => {
  const z1 = z + h;
  return {
    top: poly([p(dx, dy, z1), p(dx + w, dy, z1), p(dx + w, dy + d, z1), p(dx, dy + d, z1)]),
    right: poly([p(dx + w, dy, z), p(dx + w, dy + d, z), p(dx + w, dy + d, z1), p(dx + w, dy, z1)]),
    left: poly([p(dx, dy + d, z), p(dx + w, dy + d, z), p(dx + w, dy + d, z1), p(dx, dy + d, z1)]),
  };
};

/** Gradientes de madera compartidos por las tres cajas. */
const WoodDefs = ({ id }: { id: string }) => (
  <defs>
    <linearGradient id={`${id}-l`} x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stopColor="#e2ae6c" />
      <stop offset="1" stopColor="#c98d4c" />
    </linearGradient>
    <linearGradient id={`${id}-r`} x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stopColor="#b77a3d" />
      <stop offset="1" stopColor="#9c6530" />
    </linearGradient>
    <linearGradient id={`${id}-t`} x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stopColor="#f0c98f" />
      <stop offset="1" stopColor="#d9a669" />
    </linearGradient>
  </defs>
);

/** Caja abierta con los cuadros a la vista (alza o núcleo). */
const OpenBox = ({
  id,
  p,
  spec,
  frames,
}: {
  id: string;
  p: ReturnType<typeof projector>;
  spec: BoxSpec;
  frames: number;
}) => {
  const faces = boxFaces(p, spec);
  const { w, d, h, z = 0 } = spec;
  const z1 = z + h;
  const rim = 0.07;
  const inner = poly([p(rim, rim, z1), p(w - rim, rim, z1), p(w - rim, d - rim, z1), p(rim, d - rim, z1)]);
  const bars: string[] = [];
  const usable = w - rim * 2;
  const step = usable / frames;
  for (let i = 0; i < frames; i += 1) {
    const x0 = rim + i * step + step * 0.16;
    const x1 = rim + (i + 1) * step - step * 0.16;
    bars.push(poly([p(x0, rim - 0.02, z1 + 0.01), p(x1, rim - 0.02, z1 + 0.01), p(x1, d - rim + 0.02, z1 + 0.01), p(x0, d - rim + 0.02, z1 + 0.01)]));
  }
  // Agarradera calada en la cara corta (x = w).
  const hz = z + h * 0.62;
  const grip = poly([p(w, d * 0.32, hz - 0.05), p(w, d * 0.68, hz - 0.05), p(w, d * 0.68, hz + 0.05), p(w, d * 0.32, hz + 0.05)]);
  return (
    <g>
      <polygon points={faces.left} fill={`url(#${id}-l)`} />
      <polygon points={faces.right} fill={`url(#${id}-r)`} />
      <polygon points={faces.top} fill={`url(#${id}-t)`} />
      <polygon points={inner} fill="#4a2c12" />
      {bars.map((bar, index) => (
        <polygon key={index} points={bar} fill={index % 2 ? '#e7bd82' : '#f1cd95'} />
      ))}
      <polygon points={grip} fill="#6b4220" opacity={0.85} />
      {/* Veta de la madera */}
      {[0.3, 0.55, 0.8].map((t) => (
        <polyline
          key={t}
          points={poly([p(0.05, d, z + h * t), p(w - 0.05, d, z + h * t + 0.01)])}
          stroke="#a8692f"
          strokeWidth={0.8}
          opacity={0.35}
          fill="none"
        />
      ))}
    </g>
  );
};

/** Caja cerrada de una colmena (cámara de cría o alza apilada). */
const ClosedBox = ({ id, p, spec }: { id: string; p: ReturnType<typeof projector>; spec: BoxSpec }) => {
  const faces = boxFaces(p, spec);
  const { w, d, h, z = 0 } = spec;
  const seam = poly([p(0, d, z + 0.012), p(w, d, z + 0.012), p(w, 0, z + 0.012)]);
  const grip = poly([p(w, d * 0.32, z + h * 0.58), p(w, d * 0.68, z + h * 0.58), p(w, d * 0.68, z + h * 0.7), p(w, d * 0.32, z + h * 0.7)]);
  return (
    <g>
      <polygon points={faces.left} fill={`url(#${id}-l)`} />
      <polygon points={faces.right} fill={`url(#${id}-r)`} />
      <polyline points={seam} stroke="#7a4a20" strokeWidth={1} fill="none" opacity={0.7} />
      <polygon points={grip} fill="#6b4220" opacity={0.8} />
    </g>
  );
};

const ArtSvg = ({ children, label }: { children: ReactNode; label?: string }) => (
  <svg viewBox="0 0 120 100" className="cargo-art" aria-hidden={label ? undefined : true} role={label ? 'img' : undefined} focusable="false">
    {label && <title>{label}</title>}
    {children}
  </svg>
);

const Shadow = ({ cx = 60, cy = 90, rx = 40 }: { cx?: number; cy?: number; rx?: number }) => (
  <ellipse cx={cx} cy={cy} rx={rx} ry={5.5} fill="#000" opacity={0.32} />
);

const AlzaArt = ({ id }: { id: string }) => {
  const p = projector(52, 42, 30);
  return (
    <ArtSvg>
      <WoodDefs id={id} />
      <Shadow cy={88} rx={42} />
      <OpenBox id={id} p={p} spec={{ w: 1.7, d: 1.05, h: 0.62 }} frames={9} />
    </ArtSvg>
  );
};

const NucleoArt = ({ id }: { id: string }) => {
  const p = projector(54, 40, 31);
  return (
    <ArtSvg>
      <WoodDefs id={id} />
      <Shadow cy={88} rx={38} />
      <ClosedBox id={id} p={p} spec={{ w: 1.5, d: 0.72, h: 0.52 }} />
      <OpenBox id={id} p={p} spec={{ w: 1.5, d: 0.72, h: 0.46, z: 0.52 }} frames={5} />
    </ArtSvg>
  );
};

const ColmenaArt = ({ id }: { id: string }) => {
  const p = projector(58, 47, 26);
  const lid = boxFaces(p, { w: 1.38, d: 1.18, h: 0.16, z: 1.26, dx: -0.04, dy: -0.04 });
  const base = boxFaces(p, { w: 1.3, d: 1.1, h: 0.1 });
  return (
    <ArtSvg>
      <WoodDefs id={id} />
      <defs>
        <linearGradient id={`${id}-lid`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#f4f6f8" />
          <stop offset="1" stopColor="#cfd5dc" />
        </linearGradient>
      </defs>
      <Shadow cy={90} rx={36} />
      <polygon points={base.left} fill="#5b3a1d" />
      <polygon points={base.right} fill="#4a2f17" />
      <ClosedBox id={id} p={p} spec={{ w: 1.3, d: 1.1, h: 0.58, z: 0.1 }} />
      <ClosedBox id={id} p={p} spec={{ w: 1.3, d: 1.1, h: 0.58, z: 0.68 }} />
      <polygon points={lid.left} fill="#c3c9d1" />
      <polygon points={lid.right} fill="#a9b0ba" />
      <polygon points={lid.top} fill={`url(#${id}-lid)`} />
      {/* Piquera: la entrada de las abejas */}
      <polygon points={poly([p(0.35, 1.1, 0.12), p(0.95, 1.1, 0.12), p(0.95, 1.1, 0.19), p(0.35, 1.1, 0.19)])} fill="#2a1a0b" />
    </ArtSvg>
  );
};

const TamborArt = ({ id }: { id: string }) => (
  <ArtSvg>
    <defs>
      <linearGradient id={`${id}-drum`} x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stopColor="#0b3d86" />
        <stop offset="0.32" stopColor="#2f8ff0" />
        <stop offset="0.55" stopColor="#1f74da" />
        <stop offset="1" stopColor="#0a3477" />
      </linearGradient>
      <linearGradient id={`${id}-top`} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#4aa3f7" />
        <stop offset="1" stopColor="#1d64c2" />
      </linearGradient>
    </defs>
    <Shadow cy={91} rx={30} />
    <path d="M37 18v68c0 3.6 10.3 6.5 23 6.5s23-2.9 23-6.5V18z" fill={`url(#${id}-drum)`} />
    {[40, 64].map((y) => (
      <g key={y}>
        <path d={`M37 ${y}c0 3.6 10.3 6.5 23 6.5s23-2.9 23-6.5`} stroke="#062a5f" strokeWidth={2.2} fill="none" />
        <path d={`M37 ${y + 2.2}c0 3.6 10.3 6.5 23 6.5s23-2.9 23-6.5`} stroke="#5cb0ff" strokeWidth={1} fill="none" opacity={0.55} />
      </g>
    ))}
    <ellipse cx="60" cy="18" rx="23" ry="6.5" fill={`url(#${id}-top)`} />
    <ellipse cx="60" cy="18" rx="19" ry="4.8" fill="none" stroke="#0e4ea8" strokeWidth={1.2} />
    <ellipse cx="51" cy="17.4" rx="3.6" ry="1.6" fill="#0a3a80" />
    <ellipse cx="68" cy="18.6" rx="2.6" ry="1.2" fill="#0a3a80" />
    <rect x="44" y="24" width="4" height="58" rx="2" fill="#fff" opacity={0.16} />
  </ArtSvg>
);

const FrascoArt = ({ id }: { id: string }) => (
  <ArtSvg>
    <defs>
      <linearGradient id={`${id}-honey`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#ffc24d" />
        <stop offset="0.5" stopColor="#ef8f12" />
        <stop offset="1" stopColor="#b85b05" />
      </linearGradient>
      <linearGradient id={`${id}-lid`} x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stopColor="#a87a22" />
        <stop offset="0.4" stopColor="#f2d27a" />
        <stop offset="1" stopColor="#9b6c18" />
      </linearGradient>
    </defs>
    <Shadow cy={92} rx={28} />
    <rect x="45" y="28" width="30" height="12" rx="2.5" fill="#f7c45a" />
    <rect x="45" y="28" width="30" height="3" fill="#fff" opacity={0.25} />
    <path d="M36 52c0-6 2.6-10 8.4-13h31.2c5.8 3 8.4 7 8.4 13v28a9 9 0 0 1-9 9H45a9 9 0 0 1-9-9z" fill={`url(#${id}-honey)`} />
    <rect x="41" y="12" width="38" height="18" rx="3.5" fill={`url(#${id}-lid)`} />
    {[46, 52, 58, 64, 70, 75].map((x) => (
      <line key={x} x1={x} y1="14" x2={x} y2="28" stroke="#7a5412" strokeWidth={1} opacity={0.5} />
    ))}
    <rect x="42" y="45" width="5" height="36" rx="2.5" fill="#fff" opacity={0.32} />
    <rect x="73" y="50" width="3" height="22" rx="1.5" fill="#fff" opacity={0.18} />
  </ArtSvg>
);

const ReinaArt = ({ id }: { id: string }) => (
  <ArtSvg>
    <defs>
      <linearGradient id={`${id}-abd`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#f2b649" />
        <stop offset="1" stopColor="#b9741c" />
      </linearGradient>
      <radialGradient id={`${id}-th`} cx="0.4" cy="0.35" r="0.7">
        <stop offset="0" stopColor="#c08636" />
        <stop offset="1" stopColor="#5d3a12" />
      </radialGradient>
      <clipPath id={`${id}-clip`}>
        <ellipse cx="74" cy="60" rx="30" ry="14.5" transform="rotate(14 74 60)" />
      </clipPath>
    </defs>
    <Shadow cy={90} rx={40} />
    {/* Patas */}
    <g stroke="#3a2510" strokeWidth={2} strokeLinecap="round" fill="none">
      <path d="M44 62l-6 14 -4 6" />
      <path d="M52 64l-2 15 -3 5" />
      <path d="M60 64l4 14 4 5" />
    </g>
    {/* Alas */}
    <g fill="#e8f2fb" stroke="#9fb8cc" strokeWidth={1} opacity={0.85}>
      <ellipse cx="66" cy="34" rx="24" ry="10" transform="rotate(-22 66 34)" />
      <ellipse cx="60" cy="38" rx="18" ry="8" transform="rotate(-38 60 38)" />
    </g>
    {/* Abdomen con bandas */}
    <ellipse cx="74" cy="60" rx="30" ry="14.5" transform="rotate(14 74 60)" fill={`url(#${id}-abd)`} />
    <g clipPath={`url(#${id}-clip)`} fill="#3a2410">
      <rect x="64" y="40" width="6" height="40" transform="rotate(14 74 60)" />
      <rect x="78" y="40" width="6" height="40" transform="rotate(14 74 60)" />
      <rect x="92" y="40" width="9" height="40" transform="rotate(14 74 60)" />
    </g>
    <circle cx="47" cy="54" r="12" fill={`url(#${id}-th)`} />
    <circle cx="30" cy="56" r="9" fill="#2b1b0b" />
    <circle cx="27" cy="54" r="2.4" fill="#5c4630" />
    <g stroke="#2b1b0b" strokeWidth={1.8} strokeLinecap="round" fill="none">
      <path d="M26 49c-4-6-9-8-13-7" />
      <path d="M30 48c-1-7-4-11-8-13" />
    </g>
  </ArtSvg>
);

export const CargoArt = ({ cargo }: { cargo: CargoType }) => {
  const id = useId().replace(/[:«»]/g, '');
  switch (cargo) {
    case 'ALZAS':
      return <AlzaArt id={id} />;
    case 'COLMENAS':
      return <ColmenaArt id={id} />;
    case 'NUCLEOS':
      return <NucleoArt id={id} />;
    case 'TAMBORES':
      return <TamborArt id={id} />;
    case 'FRASCOS':
      return <FrascoArt id={id} />;
    case 'REINAS':
      return <ReinaArt id={id} />;
  }
};

/* =========================================================================
   Vehículos
   ========================================================================= */

const Wheel = ({ cx, cy = 50, r = 8.5 }: { cx: number; cy?: number; r?: number }) => (
  <g>
    <circle cx={cx} cy={cy} r={r} fill="#1b1c20" />
    <circle cx={cx} cy={cy} r={r * 0.52} fill="#aeb4bd" />
    <circle cx={cx} cy={cy} r={r * 0.18} fill="#5d636c" />
  </g>
);

const VehicleSvg = ({ children }: { children: ReactNode }) => (
  <svg viewBox="0 0 120 64" className="vehicle-art" aria-hidden="true" focusable="false">
    <ellipse cx="60" cy="59" rx="54" ry="3.4" fill="#000" opacity={0.3} />
    {children}
  </svg>
);

const BODY = '#f2f4f7';
const SHADE = '#cfd5dd';
const GLASS = '#33465a';

export const VehicleArt = ({ kind }: { kind: VehicleKind }) => {
  switch (kind) {
    case 'CAMIONETA':
      return (
        <VehicleSvg>
          <path d="M8 34h52V24c0-2 1.4-3.4 3.6-3.8l14-2.4c3-.5 5.6.4 7.6 2.6l7 8 12.6 2.2c3 .6 5.2 3.2 5.2 6.2V46H8z" fill={BODY} />
          <path d="M8 34h52v12H8z" fill={SHADE} opacity={0.55} />
          <path d="M64 22.6l13.4-2.2c2.2-.4 4 .2 5.4 1.8l6 7H64z" fill={GLASS} />
          <path d="M66 23.4l3.4-.5v6.3H66z" fill="#6b8bab" opacity={0.6} />
          <rect x="107" y="35" width="4" height="3" rx="1" fill="#f0ae3a" />
          <rect x="6" y="44" width="106" height="4" rx="2" fill="#8d949e" />
          <Wheel cx={28} />
          <Wheel cx={92} />
        </VehicleSvg>
      );
    case 'CAMION':
      return (
        <VehicleSvg>
          <rect x="6" y="8" width="70" height="38" rx="2.5" fill={BODY} />
          <rect x="6" y="8" width="70" height="38" rx="2.5" fill="none" stroke={SHADE} strokeWidth={1.4} />
          <path d="M78 20h17c2 0 3.8 1 4.8 2.7l7.4 12c.5.8.8 1.8.8 2.8V46H78z" fill={BODY} />
          <path d="M83 24h12l5.6 9H83z" fill={GLASS} />
          <rect x="106" y="38" width="4" height="3" rx="1" fill="#f0ae3a" />
          <rect x="4" y="44" width="108" height="4" rx="2" fill="#8d949e" />
          <Wheel cx={22} />
          <Wheel cx={40} />
          <Wheel cx={96} />
        </VehicleSvg>
      );
    case 'ACOPLADO':
      return (
        <VehicleSvg>
          <rect x="4" y="10" width="100" height="32" rx="2" fill={BODY} />
          <rect x="4" y="10" width="100" height="32" rx="2" fill="none" stroke={SHADE} strokeWidth={1.4} />
          {[24, 44, 64, 84].map((x) => (
            <line key={x} x1={x} y1="12" x2={x} y2="40" stroke={SHADE} strokeWidth={1} />
          ))}
          <rect x="2" y="42" width="106" height="4" rx="2" fill="#8d949e" />
          <rect x="26" y="46" width="3" height="9" fill="#6c727b" />
          <Wheel cx={78} />
          <Wheel cx={96} />
        </VehicleSvg>
      );
    case 'FURGON':
      return (
        <VehicleSvg>
          <path d="M8 16c0-3.3 2.7-6 6-6h58c3 0 5.8 1.5 7.4 4l14.6 18 12 3c2.4.6 4 2.7 4 5.1V46H8z" fill={BODY} />
          <path d="M74 14h4.6c1.4 0 2.6.7 3.4 1.8L94 31H74z" fill={GLASS} />
          <rect x="106" y="37" width="4" height="3" rx="1" fill="#f0ae3a" />
          <rect x="6" y="44" width="106" height="4" rx="2" fill="#8d949e" />
          <Wheel cx={28} />
          <Wheel cx={90} />
        </VehicleSvg>
      );
    case 'UTILITARIO':
      return (
        <VehicleSvg>
          <path d="M14 22c0-3.3 2.7-6 6-6h50c2.6 0 5 1.3 6.4 3.4L86 30l14 3c2.4.5 4 2.6 4 5V46H14z" fill={BODY} />
          <path d="M70 19h2.4c1.4 0 2.6.6 3.4 1.7L83 30H70z" fill={GLASS} />
          <path d="M22 20h40v10H22z" fill={GLASS} opacity={0.85} />
          <rect x="12" y="44" width="96" height="4" rx="2" fill="#8d949e" />
          <Wheel cx={32} r={8} />
          <Wheel cx={88} r={8} />
        </VehicleSvg>
      );
    default:
      return (
        <VehicleSvg>
          <path d="M14 34l10-12c1.6-2 4-3 6.6-3h36c2.8 0 5.4 1.2 7.2 3.4L84 33l16 3c2.4.5 4 2.6 4 5V46H14z" fill={BODY} />
          <path d="M30 23h16v10H22z" fill={GLASS} />
          <path d="M50 23h16c1.6 0 3 .7 4 1.9L77 33H50z" fill={GLASS} />
          <rect x="12" y="44" width="96" height="4" rx="2" fill="#8d949e" />
          <Wheel cx={32} r={8} />
          <Wheel cx={86} r={8} />
        </VehicleSvg>
      );
  }
};

/* =========================================================================
   Tipos de lugar (pasos 4 y 5, mapa)
   ========================================================================= */

const hexPath = (cx: number, cy: number, r: number): string => {
  const points: string[] = [];
  for (let i = 0; i < 6; i += 1) {
    const angle = (Math.PI / 3) * i - Math.PI / 6;
    points.push(`${(cx + r * Math.cos(angle)).toFixed(2)},${(cy + r * Math.sin(angle)).toFixed(2)}`);
  }
  return `M${points.join('L')}z`;
};

/** Racimo de celdas: el apiario. */
export const HexCluster = ({ size = 28 }: { size?: number }) => {
  const r = 3.1;
  const gap = 6.1;
  const cells: [number, number][] = [[12, 12]];
  for (let i = 0; i < 6; i += 1) {
    const angle = (Math.PI / 3) * i;
    cells.push([12 + gap * Math.cos(angle), 12 + gap * Math.sin(angle)]);
  }
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="currentColor">
      {cells.map(([cx, cy], index) => (
        <path key={index} d={hexPath(cx, cy, r)} />
      ))}
    </svg>
  );
};

const GLYPHS: Record<Exclude<PlaceType, 'APIARIO'> | 'STORE', ReactNode> = {
  FINCA_POLINIZACION: (
    <>
      {Array.from({ length: 6 }, (_, i) => {
        const angle = (Math.PI / 3) * i;
        return <circle key={i} cx={12 + 3.6 * Math.cos(angle)} cy={9 + 3.6 * Math.sin(angle)} r={2.7} />;
      })}
      <circle cx="12" cy="9" r="2.2" fill="var(--glyph-center, #1a1b20)" />
      <path d="M11.2 13.4h1.6V22h-1.6z" />
      <path d="M12.6 19.2c1.6-2.4 3.8-3 5.6-2.6-.6 2-2.8 3.2-5.6 2.6z" />
    </>
  ),
  DEPOSITO: (
    <path
      fillRule="evenodd"
      d="M12 2.6 22 9.4V21a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V9.4zM9 14v8h6v-8z"
    />
  ),
  SALA_EXTRACCION: (
    <path
      fillRule="evenodd"
      d="M3 21V11l5 3.2V11l5 3.2V4.5a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1V9h1.6a1 1 0 0 1 1 1V21a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1zm3.4-3.8v2h2.4v-2zm4.6 0v2h2.4v-2z"
    />
  ),
  SALA_FRACCIONAMIENTO: (
    <path
      fillRule="evenodd"
      d="M7 2.5h10a1 1 0 0 1 1 1V6a1 1 0 0 1-1 1v.6c1.9 1 3 2.7 3 4.9V19a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3v-6.5c0-2.2 1.1-3.9 3-4.9V7a1 1 0 0 1-1-1V3.5a1 1 0 0 1 1-1zm1.5 10.5v5h7v-5z"
    />
  ),
  STORE: (
    <g fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinejoin="round" strokeLinecap="round">
      <path d="M3.5 9.5V20a1 1 0 0 0 1 1h15a1 1 0 0 0 1-1V9.5" />
      <path d="M2.5 9.5 4.4 4.2A1 1 0 0 1 5.3 3.5h13.4a1 1 0 0 1 .9.7l1.9 5.3" />
      <path d="M2.5 9.5a2.4 2.4 0 0 0 4.9 0 2.4 2.4 0 0 0 4.6 0 2.4 2.4 0 0 0 4.6 0 2.4 2.4 0 0 0 4.9 0" />
      <path d="M9.5 21v-5h5v5" />
    </g>
  ),
};

export const PlaceGlyph = ({ type, size = 28 }: { type: PlaceType | 'STORE'; size?: number }) =>
  type === 'APIARIO' ? (
    <HexCluster size={size} />
  ) : (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="currentColor">
      {GLYPHS[type]}
    </svg>
  );
