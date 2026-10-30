import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useResource } from '../lib/useResource';
import { useTheme } from '../lib/theme';
import { useSync } from '../lib/sync';
import { directionsUrl, getCurrentPosition, GeoError, type GeoPoint } from '../lib/geo';
import { PLACES, PLACE_TYPES, type Place, type PlacesMap, type PlaceType } from '../lib/cargo';
import { Icon } from '../components/Icon';
import { PlaceGlyph } from '../components/Illustrations';
import { Notice, SkeletonList } from '../components/ui';
import { ResourceNotices } from '../components/ResourceNotices';

/**
 * Mapa (doc 13): apiarios, salas, fincas y depósitos con ubicación.
 *
 * El fondo es OpenStreetMap (o el que se configure en VITE_MAP_TILE_URL) y
 * necesita señal; los lugares no: salen de la misma copia local que el resto,
 * y la lista de abajo funciona aunque el fondo no cargue.
 */

const TILE_URL = import.meta.env.VITE_MAP_TILE_URL || 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const TILE_ATTRIBUTION =
  import.meta.env.VITE_MAP_ATTRIBUTION ||
  '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a>';

/** Centro de Argentina, para cuando todavía no hay lugares con ubicación. */
const ARGENTINA: L.LatLngExpression = [-38.4, -63.6];

const PLURAL: Record<PlaceType, string> = {
  APIARIO: 'Apiarios',
  FINCA_POLINIZACION: 'Fincas',
  DEPOSITO: 'Depósitos',
  SALA_EXTRACCION: 'Salas de extracción',
  SALA_FRACCIONAMIENTO: 'Salas de fraccionamiento',
};

/** Racimo de siete celdas (el apiario), como trazo SVG. */
const HEX_CLUSTER = (() => {
  const hex = (cx: number, cy: number, r: number) => {
    const points: string[] = [];
    for (let i = 0; i < 6; i += 1) {
      const angle = (Math.PI / 3) * i - Math.PI / 6;
      points.push(`${(cx + r * Math.cos(angle)).toFixed(2)},${(cy + r * Math.sin(angle)).toFixed(2)}`);
    }
    return `M${points.join('L')}z`;
  };
  const cells: [number, number][] = [[12, 12]];
  for (let i = 0; i < 6; i += 1) cells.push([12 + 6.1 * Math.cos((Math.PI / 3) * i), 12 + 6.1 * Math.sin((Math.PI / 3) * i)]);
  return cells.map(([cx, cy]) => hex(cx, cy, 3.1)).join('');
})();

/** Ícono SVG del marcador, en texto (Leaflet lo pone como HTML). */
const PIN_GLYPH: Record<PlaceType, string> = {
  APIARIO: `<path d="${HEX_CLUSTER}"/>`,
  FINCA_POLINIZACION:
    '<g fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="5.5" r="1" fill="currentColor" stroke="none"/><circle cx="12" cy="2.8" r="1.3"/><circle cx="14.6" cy="4.6" r="1.3"/><circle cx="13.6" cy="7.4" r="1.3"/><circle cx="10.4" cy="7.4" r="1.3"/><circle cx="9.4" cy="4.6" r="1.3"/><path d="M12 6.8v6.2"/><path d="M12 10.2c-2-1.8-4.2-1.3-4.8 0 1.6.5 3.2.5 4.8 0"/><path d="M12 9.2c2-1.8 4.2-1.3 4.8 0-1.6.5-3.2.5-4.8 0"/><path d="M2.5 10.5c3.5 0 6.5 1.2 9.5 2.8 3-1 6-1.3 9.5-.8"/><path d="M12 13.3c-2 3-4.5 6-6.5 8.2"/><path d="M2.5 13.2c2.8 0 5.4.8 7.5 1.8"/><path d="M2.5 16c2.5 0 4.8.8 6.5 2"/><path d="M2.5 18.8c2 0 3.8.7 5.2 1.8"/><path d="M12 13.3c2.8 1.8 5.5 4.2 7.5 7.2"/><path d="M9.8 16.5c2.2 1.6 4.5 3.8 6.2 6"/></g>',
  DEPOSITO: '<path fill-rule="evenodd" d="M12 2.6 22 9.4V21a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V9.4zM9 14v8h6v-8z"/>',
  SALA_EXTRACCION:
    '<path fill-rule="evenodd" d="M3 21V11l5 3.2V11l5 3.2V4.5a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1V9h1.6a1 1 0 0 1 1 1V21a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z"/>',
  SALA_FRACCIONAMIENTO:
    '<path fill-rule="evenodd" d="M7 2.5h10a1 1 0 0 1 1 1V6a1 1 0 0 1-1 1v.6c1.9 1 3 2.7 3 4.9V19a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3v-6.5c0-2.2 1.1-3.9 3-4.9V7a1 1 0 0 1-1-1V3.5a1 1 0 0 1 1-1z"/>',
};

const pinIcon = (place: Place, selected: boolean): L.DivIcon =>
  L.divIcon({
    className: '',
    html: `<span class="map-pin pin-${place.placeType.toLowerCase()}${selected ? ' is-selected' : ''}${place.own ? '' : ' is-shared'}"><svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true">${PIN_GLYPH[place.placeType]}</svg></span>`,
    iconSize: [36, 36],
    iconAnchor: [18, 18],
    popupAnchor: [0, -18],
  });

const escapeHtml = (value: string): string =>
  value.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!);

/** Distancia en km (haversine). */
const distanceKm = (a: { latitude: number; longitude: number }, b: { latitude: number; longitude: number }) => {
  const rad = (value: number) => (value * Math.PI) / 180;
  const dLat = rad(b.latitude - a.latitude);
  const dLon = rad(b.longitude - a.longitude);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.latitude)) * Math.cos(rad(b.latitude)) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(h));
};

const formatDistance = (km: number) => (km < 1 ? `${Math.round(km * 1000)} m` : `${km < 10 ? km.toFixed(1) : Math.round(km)} km`);

/** Dónde se ve la ficha de cada lugar. */
const detailPath = (place: Place): string | null => {
  if (!place.own) return null;
  switch (place.placeType) {
    case 'APIARIO':
      return '/apiaries';
    case 'SALA_EXTRACCION':
      return '/salas/extraccion';
    case 'SALA_FRACCIONAMIENTO':
      return '/salas/fraccionamiento';
    default:
      return '/establishments';
  }
};

export const MapPage = () => {
  const [params] = useSearchParams();
  const focusId = params.get('lugar');
  const { theme } = useTheme();
  const { online } = useSync();
  const data = useResource<PlacesMap>('/places/map');
  const [filter, setFilter] = useState<PlaceType | ''>('');
  const [selectedId, setSelectedId] = useState<string | null>(focusId);
  const [me, setMe] = useState<GeoPoint | null>(null);
  const [locating, setLocating] = useState(false);
  const [locateError, setLocateError] = useState<string | null>(null);

  const canvasRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.LayerGroup | null>(null);
  const meLayerRef = useRef<L.LayerGroup | null>(null);
  const fittedRef = useRef(false);
  const listRef = useRef<HTMLUListElement>(null);

  const places = useMemo(() => data.data?.places ?? [], [data.data]);
  const visible = useMemo(() => places.filter((place) => !filter || place.placeType === filter), [places, filter]);
  const sorted = useMemo(() => {
    if (!me) return [...visible].sort((a, b) => a.name.localeCompare(b.name));
    return [...visible].sort(
      (a, b) =>
        distanceKm(me, { latitude: a.latitude!, longitude: a.longitude! }) -
        distanceKm(me, { latitude: b.latitude!, longitude: b.longitude! }),
    );
  }, [visible, me]);

  /* ------------------------------------------------------------ mapa base */

  useEffect(() => {
    if (!canvasRef.current || mapRef.current) return;
    const map = L.map(canvasRef.current, {
      center: ARGENTINA,
      zoom: 4,
      zoomControl: false,
      attributionControl: true,
    });
    L.control.zoom({ position: 'topright' }).addTo(map);
    L.tileLayer(TILE_URL, { attribution: TILE_ATTRIBUTION, maxZoom: 18, crossOrigin: true }).addTo(map);
    layerRef.current = L.layerGroup().addTo(map);
    meLayerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;
    // El contenedor cambia de alto con la barra de estado: Leaflet tiene que enterarse.
    const observer = new ResizeObserver(() => map.invalidateSize());
    observer.observe(canvasRef.current);
    return () => {
      observer.disconnect();
      map.remove();
      mapRef.current = null;
    };
  }, []);

  /* ------------------------------------------------------------ marcadores */

  useEffect(() => {
    const map = mapRef.current;
    const layer = layerRef.current;
    if (!map || !layer) return;
    layer.clearLayers();
    const bounds: L.LatLngTuple[] = [];
    for (const place of visible) {
      if (place.latitude === null || place.longitude === null) continue;
      const position: L.LatLngTuple = [place.latitude, place.longitude];
      bounds.push(position);
      const marker = L.marker(position, {
        icon: pinIcon(place, place.id === selectedId),
        title: place.name,
        keyboard: true,
        zIndexOffset: place.id === selectedId ? 1000 : 0,
      });
      marker.bindPopup(
        `<strong>${escapeHtml(place.name)}</strong><br/><span>${escapeHtml(PLACES[place.placeType].tile)}${
          place.code ? ` · ${escapeHtml(place.code)}` : ''
        }</span>`,
        { closeButton: false },
      );
      marker.on('click', () => setSelectedId(place.id));
      marker.addTo(layer);
    }
    if (!fittedRef.current && bounds.length > 0) {
      fittedRef.current = true;
      const focus = focusId ? visible.find((place) => place.id === focusId) : undefined;
      if (focus && focus.latitude !== null && focus.longitude !== null) {
        map.setView([focus.latitude, focus.longitude], 14);
      } else if (bounds.length === 1) {
        map.setView(bounds[0], 13);
      } else {
        map.fitBounds(L.latLngBounds(bounds), { padding: [36, 36], maxZoom: 13 });
      }
    }
  }, [visible, selectedId, focusId]);

  // Al elegir en la lista o en el mapa, el mapa va al lugar y la lista lo muestra.
  useEffect(() => {
    if (!selectedId) return;
    const place = places.find((item) => item.id === selectedId);
    const map = mapRef.current;
    if (place && map && place.latitude !== null && place.longitude !== null) {
      map.flyTo([place.latitude, place.longitude], Math.max(map.getZoom(), 13), { duration: 0.6 });
    }
    listRef.current?.querySelector(`[data-place="${selectedId}"]`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [selectedId, places]);

  /* ----------------------------------------------------------- mi ubicación */

  const locate = async () => {
    setLocating(true);
    setLocateError(null);
    try {
      const point = await getCurrentPosition();
      setMe(point);
      const map = mapRef.current;
      const layer = meLayerRef.current;
      if (map && layer) {
        layer.clearLayers();
        if (point.accuracy) {
          L.circle([point.latitude, point.longitude], {
            radius: point.accuracy,
            color: '#36c9fc',
            weight: 1,
            fillOpacity: 0.12,
          }).addTo(layer);
        }
        L.circleMarker([point.latitude, point.longitude], {
          radius: 8,
          color: '#ffffff',
          weight: 3,
          fillColor: '#36c9fc',
          fillOpacity: 1,
        }).addTo(layer);
        map.flyTo([point.latitude, point.longitude], 12, { duration: 0.6 });
      }
    } catch (cause) {
      setLocateError(cause instanceof GeoError ? cause.message : 'No se pudo obtener tu ubicación.');
    } finally {
      setLocating(false);
    }
  };

  const counts = useMemo(() => {
    const result: Record<string, number> = {};
    for (const place of places) result[place.placeType] = (result[place.placeType] ?? 0) + 1;
    return result;
  }, [places]);
  const missing = data.data?.withoutLocation ?? [];

  return (
    <div className="map-page">
      <header className="map-head">
        <h1>Mapa</h1>
        <span className="map-count">
          {places.length === 1 ? '1 lugar' : `${places.length} lugares`}
        </span>
      </header>

      <div className="chip-row" role="group" aria-label="Qué mostrar">
        <button type="button" className={filter === '' ? 'chip selected' : 'chip'} aria-pressed={filter === ''} onClick={() => setFilter('')}>
          Todos ({places.length})
        </button>
        {PLACE_TYPES.filter((type) => counts[type]).map((type) => (
          <button
            key={type}
            type="button"
            className={filter === type ? 'chip selected' : 'chip'}
            aria-pressed={filter === type}
            onClick={() => setFilter(type)}
          >
            <span className={`chip-dot pin-${type.toLowerCase()}`} aria-hidden="true" />
            {PLURAL[type]} ({counts[type]})
          </button>
        ))}
      </div>

      <div className={theme === 'dark' ? 'map-wrap is-dark' : 'map-wrap'}>
        <div ref={canvasRef} className="map-canvas" role="region" aria-label="Mapa de apiarios y salas" />
        <button type="button" className="map-locate" onClick={() => void locate()} disabled={locating}>
          {locating ? <span className="spinner" aria-hidden="true" /> : <Icon name="crosshair" size={20} />}
          <span>{locating ? 'Buscando…' : 'Mi ubicación'}</span>
        </button>
        {!online && <div className="map-offline">Sin conexión: el fondo del mapa puede no cargar. La lista sí funciona.</div>}
      </div>

      {locateError && (
        <Notice tone="warning" title="No pudimos ubicarte">
          {locateError}
        </Notice>
      )}
      <ResourceNotices resource={data} />

      {missing.length > 0 && (
        <Notice tone="info" title={missing.length === 1 ? 'Un lugar tuyo no tiene ubicación' : `${missing.length} lugares tuyos no tienen ubicación`}>
          {missing
            .slice(0, 4)
            .map((item) => item.name)
            .join(', ')}
          {missing.length > 4 ? '…' : ''}. Abrí el lugar y tocá «Obtener ubicación» cuando estés ahí.
        </Notice>
      )}

      {data.loading && !data.data && <SkeletonList rows={3} />}

      {sorted.length > 0 && (
        <ul className="map-list" ref={listRef} aria-label="Lugares">
          {sorted.map((place) => {
            const selected = place.id === selectedId;
            const path = detailPath(place);
            return (
              <li key={place.id} data-place={place.id}>
                <div className={selected ? 'map-item selected' : 'map-item'}>
                  <button type="button" className="map-item-main" onClick={() => setSelectedId(place.id)} aria-pressed={selected}>
                    <span className={`map-item-glyph pin-${place.placeType.toLowerCase()}`}>
                      <PlaceGlyph type={place.placeType} size={22} />
                    </span>
                    <span className="map-item-text">
                      <span className="map-item-title">{place.name}</span>
                      <span className="map-item-sub">
                        {PLACES[place.placeType].tile}
                        {place.code ? ` · ${place.code}` : ''}
                        {place.hiveCount ? ` · ${place.hiveCount} colmenas` : ''}
                        {!place.own && place.organizationName ? ` · ${place.organizationName}` : ''}
                      </span>
                    </span>
                    {me && place.latitude !== null && place.longitude !== null && (
                      <span className="map-item-distance">
                        {formatDistance(distanceKm(me, { latitude: place.latitude, longitude: place.longitude }))}
                      </span>
                    )}
                  </button>
                  {selected && (
                    <div className="map-item-actions">
                      <a
                        className="chip-button"
                        href={directionsUrl(place.latitude!, place.longitude!)}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <Icon name="route" size={16} />
                        Cómo llegar
                      </a>
                      {path && (
                        <Link className="chip-button" to={path}>
                          <Icon name="forward" size={16} />
                          Ver ficha
                        </Link>
                      )}
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};
