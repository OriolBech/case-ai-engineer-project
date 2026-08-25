'use client';

/**
 * Las decisiones pendientes de una línea, dentro del desplegable de la línea.
 *
 * DÓNDE VIVE UNA DECISIÓN. Estos formularios estuvieron en "Cómo ha ido", junto a las métricas de la
 * ejecución, y era el sitio equivocado por dos razones. La primera es de producto: ese panel contesta
 * *¿cómo ha salido este MTO?* y se lee de una pasada; una decisión de vocabulario se toma mirando la
 * fila —el texto original, el resto de atributos, qué se pierde si se resuelve mal—, y nada de eso
 * está en un panel de métricas. La segunda es de flujo: quien revisa trabaja en la cola, línea a
 * línea; obligarle a cerrar la cola, abrir el resumen y buscar el valor en una lista agregada es
 * pedirle que cambie de sitio para arreglar lo que tiene delante.
 *
 * Así que la regla es: **en "Cómo ha ido" se cuentan las decisiones; aquí se toman.** El panel de
 * KPIs sigue diciendo cuántas hay y cuáles son, porque eso es una métrica de la revisión, pero no
 * lleva ni un botón que escriba en el vocabulario.
 *
 * Una decisión sigue siendo UNA aunque el valor salga en cuarenta filas: guardarla desde esta línea
 * la aplica a todas las que comparten el valor, en este MTO y en los que vengan. Es el mismo bucle de
 * `docs/11-system-behind-the-rules.md` §4, con el formulario donde está el problema.
 */
import type { PolicyBacklogItem } from '../../src/pipeline/coverage.ts';
import type { OutputLine } from '../../src/pipeline/types.ts';
import { decisionsOf, matchFromCandidate } from '../lib/line-decisions.ts';
import { FinishVocabAddPanel } from './FinishVocabAddPanel.tsx';
import { MaterialVocabAddPanel } from './MaterialVocabAddPanel.tsx';
import { QualityVocabAddPanel } from './QualityVocabAddPanel.tsx';
import type { SuggestionPatch } from './App.tsx';

/**
 * Lo que NO está pendiente en esta línea, y por qué.
 *
 * Nace de una queja concreta y correcta: "veo líneas con la calidad fuera de catálogo y no me da la
 * opción de decidir". A veces era un fallo —una calidad sin material que salía RESUELTA, arreglada
 * con P-13— y a veces no lo era: `GR B16` está fuera del catálogo de §5 y el vocabulario SÍ deriva
 * su material, y `200HV` tiene el material vacío porque la tabla declara, con su motivo escrito, que
 * una dureza no nombra el metal base. En esos dos casos no hay nada pendiente… y la pantalla no lo
 * decía, así que se leía igual que un olvido.
 *
 * Callar aquí es lo que hace que un sistema parezca que se ha saltado algo. Así que se dice, y
 * además se deja la puerta abierta: si el comprador quiere decidirlo igualmente, el enlace al
 * vocabulario está. Nunca "no hay opción".
 */
function OpenEnds({ line, pending }: { line: OutputLine; pending: ReadonlySet<string> }) {
  const q = line.attributes.quality;
  const m = line.attributes.material;
  const notes: { key: string; text: string; href: string; cta: string }[] = [];

  if (!pending.has('quality') && q.provenance === 'extracted_uncatalogued' && q.raw) {
    notes.push({
      key: 'quality',
      text: `La calidad «${q.normalized ?? q.raw}» no está en el catálogo de §5. Se conserva tal cual, que es lo que `
        + 'mandan las reglas, y por eso no hay nada pendiente. Si en vuestra casa equivale a un grupo concreto, '
        + 'se puede declarar y dejará de estar fuera de catálogo.',
      href: `/vocabulario?attr=quality&alias=${encodeURIComponent(q.raw)}`,
      cta: 'Declarar su grupo →',
    });
  }

  if (!pending.has('material') && m.normalized === null && q.raw) {
    if (m.rule === 'P-3:no-derivable') {
      notes.push({
        key: 'material-decided',
        text: 'El material está vacío por decisión, no por olvido: el vocabulario declara que de esta calidad no se '
          + 'puede derivar, con su motivo escrito. Una ausencia decidida es un valor válido.',
        href: `/vocabulario?attr=material&alias=${encodeURIComponent(q.raw)}`,
        cta: 'Ver la decisión →',
      });
    } else if (!m.rule) {
      // Red de seguridad: si el material falta y no hay ni hueco ni decisión registrada, decirlo en
      // vez de enseñar una celda vacía. Con P-13 no debería ocurrir; si ocurre, es un aviso, no un
      // silencio.
      notes.push({
        key: 'material-orphan',
        text: 'Esta línea no lleva material y no hay ninguna decisión registrada sobre esta calidad. Conviene '
          + 'declararla en el vocabulario antes de pedir.',
        href: `/vocabulario?attr=material&alias=${encodeURIComponent(q.raw)}`,
        cta: 'Añadir al vocabulario →',
      });
    }
  }

  if (notes.length === 0) return null;

  return (
    <div className="trace-openends">
      {notes.map((n) => (
        <p className="kpi-help" key={n.key}>
          {n.text} <a className="vocab-quickadd-link" href={n.href}>{n.cta}</a>
        </p>
      ))}
    </div>
  );
}

export function LineDecisions({
  line,
  backlog,
  onApplied,
}: {
  line: OutputLine;
  backlog: readonly PolicyBacklogItem[];
  onApplied?: (p: SuggestionPatch) => void;
}) {
  const decisions = decisionsOf(line, backlog);
  const pending = new Set<string>(decisions.map((d) => d.attribute));
  const blocking = decisions.filter((d) => d.blocking);
  const optional = decisions.filter((d) => !d.blocking);

  if (decisions.length === 0) return <OpenEnds line={line} pending={pending} />;

  return (
    <div className="trace-decisions">
      {blocking.length > 0 && (
        <div className="trace-decisions-head">
          <strong>Decisiones pendientes de esta línea</strong>
          <span className="kpi-help">
            No es revisar una línea: es una regla que aún no existe. Se decide una vez, aquí, y el
            sistema la aplica igual en todos los MTO que vengan.
          </span>
        </div>
      )}

      {blocking.map((d) => (
        <div className="trace-decision" key={d.attribute}>
          <div className="trace-decision-title">{d.title}</div>
          <div className="kpi-help">{d.detail}</div>
          <div className="kpi-help">
            {d.rows === null
              ? 'Se guardará para esta calidad en todos los MTO, no solo en esta fila.'
              : d.rows.length === 1
                ? 'Afecta solo a esta fila… y a cualquier MTO futuro con el mismo valor.'
                : `Afecta a ${d.rows.length} filas de este MTO: ${d.rows.join(', ')}.`}
          </div>

          {d.attribute === 'quality' && <QualityVocabAddPanel quality={d.value} />}

          {d.attribute === 'material' && (
            <MaterialVocabAddPanel
              quality={line.attributes.quality.raw ?? d.value}
              matchOverride={matchFromCandidate(d.candidate)}
              matchKind={(d.candidate?.when as { qualityGroup?: string } | undefined)?.qualityGroup
                ? 'qualityGroup'
                : 'qualityPattern'}
              onApplied={onApplied}
            />
          )}

          {d.attribute === 'finish' && (
            <FinishVocabAddPanel
              defaultAlias={String(d.candidate?.alias ?? d.value)}
              defaultFinish={String(d.candidate?.finish ?? 'CINCADO')}
              source="UI comprador (línea)"
              collapsible={false}
              onApplied={onApplied}
            />
          )}
        </div>
      ))}

      {optional.length > 0 && (
        <div className={`trace-decisions-optional${blocking.length > 0 ? ' after' : ''}`}>
          <div className="trace-decisions-head">
            {/* La cabecera cambia según lo de arriba: decirle "esta línea no espera nada" a una línea
                que está en revisión por el bloque anterior sería contradecirse en dos párrafos. */}
            <strong>
              {blocking.length > 0
                ? 'Además, puedes enseñarle algo al sistema'
                : 'Esta línea no espera nada — y aún puedes enseñarle algo al sistema'}
            </strong>
            <span className="kpi-help">
              Lo de aquí abajo <strong>no</strong> la está frenando
              {blocking.length > 0
                ? ': la línea se resuelve en cuanto cierres lo de arriba, decidas esto o no.'
                : ': sale completa y lista para pedir.'}{' '}
              Es la ocasión de que el sistema aprenda algo que tú sabes y él todavía no, para las
              próximas veces.
            </span>
          </div>

          {optional.map((d) => (
            <div className="trace-decision" key={d.attribute}>
              <div className="trace-decision-title">{d.title}</div>
              <div className="kpi-help">{d.detail}</div>
              {d.attribute === 'quality' && <QualityVocabAddPanel quality={d.value} />}
              {d.attribute === 'material' && (
                <MaterialVocabAddPanel
                  quality={line.attributes.quality.raw ?? d.value}
                  matchOverride={matchFromCandidate(d.candidate)}
                  onApplied={onApplied}
                />
              )}
              {d.attribute === 'finish' && (
                <FinishVocabAddPanel
                  defaultAlias={String(d.candidate?.alias ?? d.value)}
                  defaultFinish={String(d.candidate?.finish ?? 'CINCADO')}
                  source="UI comprador (línea)"
                  collapsible={false}
                  onApplied={onApplied}
                />
              )}
            </div>
          ))}
        </div>
      )}

      <OpenEnds line={line} pending={pending} />
    </div>
  );
}

