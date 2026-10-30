import type { SVGProps } from 'react';

/**
 * Juego de iconos unico.
 *
 * Todos comparten rejilla de 24, trazo de 2 y `currentColor`, para que hereden
 * el color del texto que acompanan y se lean como una sola familia. Son
 * decorativos por defecto (`aria-hidden`): el significado siempre lo aporta el
 * texto que va al lado, nunca el icono solo.
 */

const PATHS = {
  dashboard: (
    <>
      <rect width="7" height="9" x="3" y="3" rx="1.5" />
      <rect width="7" height="5" x="14" y="3" rx="1.5" />
      <rect width="7" height="9" x="14" y="12" rx="1.5" />
      <rect width="7" height="5" x="3" y="16" rx="1.5" />
    </>
  ),
  trace: (
    <>
      <circle cx="6" cy="6" r="2.5" />
      <circle cx="6" cy="18" r="2.5" />
      <circle cx="18" cy="9" r="2.5" />
      <line x1="6" y1="8.5" x2="6" y2="15.5" />
      <path d="M17.5 11.5A8.5 8.5 0 0 1 9 18" />
    </>
  ),
  producers: (
    <>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </>
  ),
  establishments: (
    <>
      <path d="M3 21h18" />
      <path d="M5 21V8l7-5 7 5v13" />
      <path d="M9 21v-6h6v6" />
    </>
  ),
  apiaries: (
    <>
      <path d="M12 2 20 6.5v9L12 20l-8-4.5v-9z" />
      <path d="M12 11.5 20 7" />
      <path d="M12 11.5V20" />
      <path d="M12 11.5 4 7" />
    </>
  ),
  movements: (
    <>
      <path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2" />
      <path d="M15 18H9" />
      <path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.62l-3.48-4.35A1 1 0 0 0 17.52 8H14" />
      <circle cx="17" cy="18" r="2" />
      <circle cx="7" cy="18" r="2" />
    </>
  ),
  extractions: (
    <path d="M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-4-4-6.5c-.5 2.5-2 4.9-4 6.5C6 11.1 5 13 5 15a7 7 0 0 0 7 7z" />
  ),
  lots: (
    <>
      <path d="M12.8 2.2a2 2 0 0 0-1.6 0L2.6 6.1a1 1 0 0 0 0 1.8l8.6 3.9a2 2 0 0 0 1.6 0l8.6-3.9a1 1 0 0 0 0-1.8z" />
      <path d="m22 12.5-8.6 3.9a2 2 0 0 1-1.6 0L2.6 12.5" />
      <path d="m22 17.5-8.6 3.9a2 2 0 0 1-1.6 0L2.6 17.5" />
    </>
  ),
  drums: (
    <>
      <ellipse cx="12" cy="5" rx="8" ry="3" />
      <path d="M4 5v14c0 1.7 3.6 3 8 3s8-1.3 8-3V5" />
      <path d="M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3" />
    </>
  ),
  rules: (
    <>
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10" />
      <path d="m9 12 2 2 4-4" />
    </>
  ),
  audit: (
    <>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
    </>
  ),
  sync: (
    <>
      <path d="M21 12a9 9 0 0 1-9 9c-4 0-7.4-2.6-8.6-6.2" />
      <path d="M3 12a9 9 0 0 1 9-9c4 0 7.4 2.6 8.6 6.2" />
      <polyline points="21 3 21 9 15 9" />
      <polyline points="3 21 3 15 9 15" />
    </>
  ),
  more: (
    <>
      <circle cx="5" cy="12" r="1.5" />
      <circle cx="12" cy="12" r="1.5" />
      <circle cx="19" cy="12" r="1.5" />
    </>
  ),
  menu: (
    <>
      <line x1="4" x2="20" y1="6" y2="6" />
      <line x1="4" x2="20" y1="12" y2="12" />
      <line x1="4" x2="20" y1="18" y2="18" />
    </>
  ),
  close: (
    <>
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </>
  ),
  back: <path d="m15 18-6-6 6-6" />,
  forward: <path d="m9 18 6-6-6-6" />,
  down: <path d="m6 9 6 6 6-6" />,
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="m21 21-4.3-4.3" />
    </>
  ),
  plus: (
    <>
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </>
  ),
  check: <path d="M20 6 9 17l-5-5" />,
  checkCircle: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="m9 12 2 2 4-4" />
    </>
  ),
  warning: (
    <>
      <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </>
  ),
  danger: (
    <>
      <circle cx="12" cy="12" r="9" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </>
  ),
  info: (
    <>
      <circle cx="12" cy="12" r="9" />
      <line x1="12" y1="11" x2="12" y2="16" />
      <line x1="12" y1="8" x2="12.01" y2="8" />
    </>
  ),
  offline: (
    <>
      <path d="M2 2l20 20" />
      <path d="M8.5 16.4a5 5 0 0 1 7 0" />
      <path d="M5 12.9a10 10 0 0 1 3.3-2.2" />
      <path d="M15.7 10.7a10 10 0 0 1 3.3 2.2" />
      <path d="M2 8.8A15 15 0 0 1 7 6" />
      <path d="M17 6a15 15 0 0 1 5 2.8" />
      <line x1="12" y1="20" x2="12.01" y2="20" />
    </>
  ),
  online: (
    <>
      <path d="M5 12.9a10 10 0 0 1 14 0" />
      <path d="M2 8.8a15 15 0 0 1 20 0" />
      <path d="M8.5 16.4a5 5 0 0 1 7 0" />
      <line x1="12" y1="20" x2="12.01" y2="20" />
    </>
  ),
  location: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
      <circle cx="12" cy="12" r="8" />
    </>
  ),
  pin: (
    <>
      <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
      <circle cx="12" cy="10" r="3" />
    </>
  ),
  calendar: (
    <>
      <rect width="18" height="16" x="3" y="5" rx="2" />
      <path d="M8 3v4M16 3v4M3 11h18" />
    </>
  ),
  logout: (
    <>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </>
  ),
  inbox: (
    <>
      <polyline points="22 12 16 12 14 15 10 15 8 12 2 12" />
      <path d="M5.4 5.1 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.4-6.9A2 2 0 0 0 16.8 4H7.2a2 2 0 0 0-1.8 1.1z" />
    </>
  ),
  send: (
    <>
      <path d="m22 2-7 20-4-9-9-4z" />
      <path d="M22 2 11 13" />
    </>
  ),
  download: (
    <>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </>
  ),
  lock: (
    <>
      <rect width="18" height="11" x="3" y="11" rx="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </>
  ),
  document: (
    <>
      <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7z" />
      <polyline points="15 2 15 7 20 7" />
    </>
  ),
  /** Frasco: la sala de fraccionamiento. */
  jar: (
    <>
      <rect width="10" height="3.5" x="7" y="2.5" rx="1" />
      <path d="M8 6h8a3 3 0 0 1 3 3v9.5a3 3 0 0 1-3 3H8a3 3 0 0 1-3-3V9a3 3 0 0 1 3-3z" />
      <path d="M5 12h14" />
    </>
  ),
  /** Documento con renglones: el DT-e en la barra inferior. */
  fileLines: (
    <>
      <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7z" />
      <path d="M15 2v5h5" />
      <path d="M8 9h3M8 13h8M8 17h8" />
    </>
  ),
  trash: (
    <>
      <path d="M3 6h18" />
      <path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
    </>
  ),
  filter: <polygon points="22 3 2 3 10 12.5 10 19 14 21 14 12.5 22 3" />,
  sun: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M6.3 17.7l-1.4 1.4M19.1 4.9l-1.4 1.4" />
    </>
  ),
  moon: <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9z" />,
  help: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </>
  ),
  sparkles: (
    <>
      <path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3z" />
    </>
  ),
  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </>
  ),
  minus: <path d="M5 12h14" />,
  copy: (
    <>
      <rect width="13" height="13" x="9" y="9" rx="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  shield: (
    <>
      <path d="M12 22s8-3.5 8-10V5l-8-3-8 3v7c0 6.5 8 10 8 10z" />
      <path d="m9 12 2 2 4-4" />
    </>
  ),
  hive: <path d="M12 2.5 20.2 7.25v9.5L12 21.5l-8.2-4.75v-9.5z" />,
  print: (
    <>
      <path d="M6 9V2h12v7" />
      <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
      <rect width="12" height="8" x="6" y="14" rx="1" />
    </>
  ),
  route: (
    <>
      <circle cx="6" cy="19" r="3" />
      <path d="M9 19h8.5a3.5 3.5 0 0 0 0-7h-11a3.5 3.5 0 0 1 0-7H15" />
      <circle cx="18" cy="5" r="3" />
    </>
  ),
  idCard: (
    <>
      <rect width="20" height="16" x="2" y="4" rx="2" />
      <circle cx="8" cy="11" r="2.5" />
      <path d="M4.5 17a3.5 3.5 0 0 1 7 0M14 9h5M14 13h4" />
    </>
  ),
  play: <path d="m7 4 13 8-13 8z" />,
  /* --------------------------------------------------- rediseño (doc 13) */
  user: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4.5 21a7.5 7.5 0 0 1 15 0" />
    </>
  ),
  home: (
    <>
      <path d="M3 10.5 12 3l9 7.5" />
      <path d="M5 9.5V20a1 1 0 0 0 1 1h4.5v-6h3v6H18a1 1 0 0 0 1-1V9.5" />
    </>
  ),
  map: (
    <>
      <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
      <circle cx="12" cy="10" r="3" />
    </>
  ),
  camera: (
    <>
      <path d="M14.5 4h-5L7.5 6.5H4a2 2 0 0 0-2 2V18a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8.5a2 2 0 0 0-2-2h-3.5z" />
      <circle cx="12" cy="13" r="3.5" />
    </>
  ),
  car: (
    <>
      <path d="M5 11 6.6 6.4A2 2 0 0 1 8.5 5h7a2 2 0 0 1 1.9 1.4L19 11" />
      <path d="M3 17v-4a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v4H3z" />
      <path d="M5 17v2M19 17v2" />
      <circle cx="7.5" cy="14" r="0.6" />
      <circle cx="16.5" cy="14" r="0.6" />
    </>
  ),
  trailer: (
    <>
      <rect x="2" y="7" width="14" height="8" rx="1.5" />
      <circle cx="7" cy="17" r="2.5" />
      <path d="M16 13h6" />
    </>
  ),
  crosshair: (
    <>
      <circle cx="12" cy="12" r="7" />
      <circle cx="12" cy="12" r="2.6" />
      <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
    </>
  ),
  beehive: (
    <>
      <path d="M6 4h12l2 4H4z" />
      <path d="M4.5 8h15v4h-15zM5 12h14v4H5zM6 16h12v4H6z" />
      <path d="M11 20v-2h2v2" />
    </>
  ),
  arrowLeft: (
    <>
      <path d="M19 12H5" />
      <path d="m11 18-6-6 6-6" />
    </>
  ),
  arrowRight: (
    <>
      <path d="M5 12h14" />
      <path d="m13 6 6 6-6 6" />
    </>
  ),
  eye: (
    <>
      <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  eyeOff: (
    <>
      <path d="M10.6 5.1A9.7 9.7 0 0 1 12 5c6.4 0 10 7 10 7a17 17 0 0 1-2.6 3.5M6.6 6.6C3.7 8.4 2 12 2 12s3.6 7 10 7a9.6 9.6 0 0 0 5.4-1.6" />
      <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
      <path d="m2 2 20 20" />
    </>
  ),
  image: (
    <>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <circle cx="9" cy="9" r="2" />
      <path d="m21 15-5-5L5 21" />
    </>
  ),
  layers: (
    <>
      <path d="m12 3 9 5-9 5-9-5z" />
      <path d="m3 13 9 5 9-5" />
    </>
  ),
  honeycomb: (
    <>
      <path d="M12 2.8 15.6 4.9v4.2L12 11.2 8.4 9.1V4.9z" />
      <path d="M7.6 10.4 11.2 12.5v4.2l-3.6 2.1L4 16.7v-4.2z" />
      <path d="M16.4 10.4 20 12.5v4.2l-3.6 2.1-3.6-2.1v-4.2z" />
    </>
  ),
  finca: (
    <>
      <circle cx="12" cy="5.5" r="1" fill="currentColor" stroke="none" />
      <circle cx="12" cy="2.8" r="1.3" />
      <circle cx="14.6" cy="4.6" r="1.3" />
      <circle cx="13.6" cy="7.4" r="1.3" />
      <circle cx="10.4" cy="7.4" r="1.3" />
      <circle cx="9.4" cy="4.6" r="1.3" />
      <path d="M12 6.8v6.2" />
      <path d="M12 10.2c-2-1.8-4.2-1.3-4.8 0 1.6.5 3.2.5 4.8 0" />
      <path d="M12 9.2c2-1.8 4.2-1.3 4.8 0-1.6.5-3.2.5-4.8 0" />
      <path d="M2.5 10.5c3.5 0 6.5 1.2 9.5 2.8 3-1 6-1.3 9.5-.8" />
      <path d="M12 13.3c-2 3-4.5 6-6.5 8.2" />
      <path d="M2.5 13.2c2.8 0 5.4.8 7.5 1.8" />
      <path d="M2.5 16c2.5 0 4.8.8 6.5 2" />
      <path d="M2.5 18.8c2 0 3.8.7 5.2 1.8" />
      <path d="M12 13.3c2.8 1.8 5.5 4.2 7.5 7.2" />
      <path d="M9.8 16.5c2.2 1.6 4.5 3.8 6.2 6" />
    </>
  ),
} as const;

export type IconName = keyof typeof PATHS;

interface IconProps extends Omit<SVGProps<SVGSVGElement>, 'name'> {
  name: IconName;
  size?: number;
  /** Texto alternativo cuando el icono va solo y si comunica algo. */
  title?: string;
}

export const Icon = ({ name, size = 18, title, ...rest }: IconProps) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden={title ? undefined : true}
    role={title ? 'img' : undefined}
    focusable="false"
    {...rest}
  >
    {title && <title>{title}</title>}
    {PATHS[name]}
  </svg>
);

/** Marca de la aplicación: tres colmenas encadenadas. */
export const Logo = ({ size = 26 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true" focusable="false">
    <rect width="64" height="64" rx="15" fill="var(--brand)" />
    <g fill="none" stroke="#ffffff" strokeWidth="3.2" strokeLinejoin="round" opacity="0.92">
      <path d="M32 12l7 4v8l-7 4-7-4v-8z" />
      <path d="M18 34l7 4v8l-7 4-7-4v-8z" />
      <path d="M46 34l7 4v8l-7 4-7-4v-8z" />
    </g>
    <path
      d="M32 32l7 4v8l-7 4-7-4v-8z"
      fill="#3a2607"
      stroke="#ffffff"
      strokeWidth="3.2"
      strokeLinejoin="round"
    />
  </svg>
);
