import type { ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button, SkeletonList } from './ui';

/**
 * Lista de datos responsable de su propia forma.
 *
 * En escritorio se dibuja como tabla; en teléfono, como tarjetas. Es el mismo
 * dato y la misma definicion de columnas: la alternativa anterior —una tabla
 * con desplazamiento horizontal— obligaba a arrastrar la pantalla de costado
 * para llegar a las acciones, que además quedaban en la última columna.
 *
 * Cada columna declara que papel cumple en la tarjeta:
 *   title   → titulo de la tarjeta (arriba a la izquierda)
 *   status  → sello de estado (arriba a la derecha)
 *   field   → par etiqueta/valor en la grilla
 *   hidden  → solo en la tabla, se omite en movil
 */
export interface Column<T> {
  key: string;
  header: string;
  cell: (item: T) => ReactNode;
  /** Valor para la tarjeta si conviene mostrarlo distinto que en la tabla. */
  cardCell?: (item: T) => ReactNode;
  role?: 'title' | 'status' | 'field' | 'hidden';
  align?: 'left' | 'right';
  width?: string;
}

interface DataListProps<T> {
  items: T[];
  columns: Column<T>[];
  rowKey: (item: T) => string;
  /** Destino al abrir el registro. Hace tocable la fila y la tarjeta entera. */
  rowHref?: (item: T) => string;
  /** Acciones por registro. Quedan fuera del área tocable para no competir. */
  rowActions?: (item: T) => ReactNode;
  loading?: boolean;
  empty?: ReactNode;
  /** Total informado por el servidor, para saber si hay más de lo que se ve. */
  total?: number;
  onLoadMore?: () => void;
  loadingMore?: boolean;
}

export function DataList<T>({
  items,
  columns,
  rowKey,
  rowHref,
  rowActions,
  loading,
  empty,
  total,
  onLoadMore,
  loadingMore,
}: DataListProps<T>) {
  const navigate = useNavigate();

  if (loading && items.length === 0) return <SkeletonList rows={5} />;
  if (items.length === 0) return <>{empty}</>;

  const titleCol = columns.find((column) => column.role === 'title') ?? columns[0];
  const statusCol = columns.find((column) => column.role === 'status');
  const fieldCols = columns.filter(
    (column) => column !== titleCol && column !== statusCol && column.role !== 'hidden',
  );

  const showFooter = Boolean(
    (total !== undefined && total > items.length) || (total !== undefined && total > 0),
  );

  return (
    <>
      {/* ------------------------------------------------ escritorio: tabla */}
      <div className="dl-table-wrap">
        <table>
          <thead>
            <tr>
              {columns.map((column) => (
                <th
                  key={column.key}
                  className={column.align === 'right' ? 'num' : undefined}
                  style={column.width ? { width: column.width } : undefined}
                >
                  {column.header}
                </th>
              ))}
              {rowActions && <th aria-label="Acciones" />}
            </tr>
          </thead>
          <tbody>
            {items.map((item) => {
              const href = rowHref?.(item);
              return (
                <tr
                  key={rowKey(item)}
                  className={href ? 'clickable' : undefined}
                  onClick={
                    href
                      ? (event) => {
                          // Un clic sobre un control propio de la fila no debe
                          // navegar: la acción ya hace lo suyo.
                          const target = event.target as HTMLElement;
                          if (target.closest('a, button, input, select, label')) return;
                          navigate(href);
                        }
                      : undefined
                  }
                >
                  {columns.map((column) => (
                    <td key={column.key} className={column.align === 'right' ? 'num' : undefined}>
                      {column === titleCol && href ? (
                        <Link to={href}>{column.cell(item)}</Link>
                      ) : (
                        column.cell(item)
                      )}
                    </td>
                  ))}
                  {rowActions && (
                    <td>
                      <div className="row">{rowActions(item)}</div>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* --------------------------------------------------- movil: tarjetas */}
      <div className="dl-cards">
        {items.map((item) => {
          const href = rowHref?.(item);
          const head = (
            <>
              <div className="dl-card-top">
                <span className="dl-card-title">
                  {(titleCol.cardCell ?? titleCol.cell)(item)}
                </span>
                {statusCol && (statusCol.cardCell ?? statusCol.cell)(item)}
              </div>
              {fieldCols.length > 0 && (
                <div className="dl-card-fields">
                  {fieldCols.map((column) => (
                    <div className="dl-card-field" key={column.key}>
                      <div className="dl-card-key">{column.header}</div>
                      <div className="dl-card-val">{(column.cardCell ?? column.cell)(item)}</div>
                    </div>
                  ))}
                </div>
              )}
            </>
          );

          return (
            <div className="dl-card" key={rowKey(item)}>
              {href ? (
                <Link to={href} className="dl-card-main">
                  {head}
                </Link>
              ) : (
                head
              )}
              {rowActions && <div className="dl-card-actions">{rowActions(item)}</div>}
            </div>
          );
        })}
      </div>

      {showFooter && (
        <div className="dl-foot">
          <span>
            {items.length === total
              ? `${total} ${total === 1 ? 'registro' : 'registros'}`
              : `Mostrando ${items.length} de ${total}`}
          </span>
          {total !== undefined && total > items.length && onLoadMore && (
            <Button size="sm" onClick={onLoadMore} busy={loadingMore} busyLabel="Cargando…">
              Ver más
            </Button>
          )}
        </div>
      )}
    </>
  );
}
