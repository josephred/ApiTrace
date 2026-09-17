import { useResource } from '../lib/useResource';
import { formatDate } from '../lib/format';
import { ESTABLISHMENT_TYPES, MOVEMENT_TYPES } from '../lib/vocabulary';
import { Card, EmptyState, Notice, PageHeader, Pill } from '../components/ui';
import { DataList, type Column } from '../components/DataList';
import { ResourceNotices } from '../components/ResourceNotices';
import type { MovementRule } from '../lib/types';

/**
 * Inspeccion de la normativa configurada. Es solo lectura, pero importante:
 * permite auditar por qué un movimiento exigio (o no) un documento sin tener
 * que leer codigo.
 */
export const RulesPage = () => {
  const rules = useResource<MovementRule[]>('/movement-rules');
  const today = new Date();

  const isEffective = (rule: MovementRule): boolean =>
    rule.active &&
    new Date(rule.effectiveFrom) <= today &&
    (!rule.effectiveTo || new Date(rule.effectiveTo) > today);

  const scopeOf = (rule: MovementRule): string =>
    [
      rule.movementType && MOVEMENT_TYPES.label(rule.movementType),
      rule.originType && `desde ${ESTABLISHMENT_TYPES.label(rule.originType)}`,
      rule.destinationType && `hacia ${ESTABLISHMENT_TYPES.label(rule.destinationType)}`,
    ]
      .filter(Boolean)
      .join(' · ') || 'Cualquier traslado';

  const columns: Column<MovementRule>[] = [
    {
      key: 'name',
      header: 'Regla',
      role: 'title',
      cell: (rule) => (
        <>
          <strong>{rule.name}</strong>
          {rule.legalReference && <div className="small muted">{rule.legalReference}</div>}
        </>
      ),
    },
    {
      key: 'effective',
      header: 'Vigencia',
      role: 'status',
      cell: (rule) =>
        isEffective(rule) ? (
          <Pill tone="success" icon="checkCircle">
            Vigente hoy
          </Pill>
        ) : (
          <Pill>No vigente</Pill>
        ),
    },
    { key: 'scope', header: 'Se aplica a', cell: scopeOf },
    {
      key: 'requires',
      header: 'Exige',
      cell: (rule) =>
        rule.requiresDocument ? (
          <Pill tone="warning" icon="document">
            {rule.requiredDocumentType}
          </Pill>
        ) : (
          <span className="faint small">Nada</span>
        ),
    },
    {
      key: 'dates',
      header: 'Desde / hasta',
      cell: (rule) => (
        <span className="nowrap small">
          {formatDate(rule.effectiveFrom)} → {rule.effectiveTo ? formatDate(rule.effectiveTo) : 'sin fin'}
        </span>
      ),
    },
    {
      key: 'priority',
      header: 'Prioridad',
      align: 'right',
      cell: (rule) => rule.priority,
    },
  ];

  return (
    <div className="stack">
      <PageHeader
        title="Reglas documentales"
        help="rules"
        sub="Qué traslados exigen DT-e u otro documento."
      />

      <ResourceNotices resource={rules} />

      <Notice tone="info" title="Se evalua con la fecha del traslado">
        No con la fecha de carga. Un traslado anterior al 01/08/2026 no exige DT-e aunque se
        registre hoy, porque ese día la norma todavía no regía.
      </Notice>

      <Card flush>
        <DataList
          items={rules.data ?? []}
          columns={columns}
          rowKey={(rule) => rule.id}
          loading={rules.loading}
          empty={
            <EmptyState
              icon="rules"
              title="No hay reglas cargadas"
              description="Sin reglas, ningún traslado exige documento."
            />
          }
        />
      </Card>

      <Card title="Qué regla gana" help="rulePriority">
        <div className="small stack">
          <p>
            Se buscan las reglas activas y vigentes a la fecha del traslado cuyos criterios
            coincidan. Un criterio vacío funciona como comodin.
          </p>
          <p>
            Gana la de <strong>menor número de prioridad</strong>, es decir, la más especifica. Si
            empatan, la de vigencia más reciente. El movimiento guarda cual se le aplico, así que la
            decision queda auditable aunque después se modifique la regla.
          </p>
        </div>
      </Card>
    </div>
  );
};
