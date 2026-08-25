'use client';

/**
 * Alta de calidad desde la línea (capa 2 de §5, SPEC-017), con las mismas salidas que el resto.
 *
 * LA PREGUNTA NO ES "¿QUÉ VALE?" SINO "¿CON QUÉ ES INTERCAMBIABLE?". §5 agrupa las calidades en
 * catorce grupos y lo que hace un grupo es declarar equivalencia: dentro de G5, `8.8` y `GRADE 5`
 * son la misma cosa; entre grupos, jamás — `8.8` (G5) no es `8` (G8), y confundirlos es la invariante
 * nº4 del proyecto. Por eso el grupo **no se propone**: proponerlo sería inventar la equivalencia.
 *
 * LA TERCERA SALIDA, que faltaba. Este panel sólo dejaba elegir uno de los catorce, y para una
 * calidad que no equivale a ninguna —`GR 660`, una aleación base níquel— la única salida disponible
 * era declarar una equivalencia **falsa**. Es decir: el formulario empujaba a romper la misma
 * invariante que dice proteger, y de la peor manera, porque una equivalencia falsa acaba en que
 * alguien reciba `8.8` donde el plano pedía `GR 660`. El acabado ya tenía "declarar uno nuevo" y el
 * material tiene "no derivable"; esto es lo mismo para la calidad.
 *
 * LOS CATORCE SIGUEN SIENDO CATORCE. Un grupo nuevo no entra en §5: nace en nuestra capa con el
 * prefijo `V-` (`V-GR-660`), que existe para que jamás se confunda el documento del cliente con lo
 * que hemos decidido nosotros — ni en la tabla, ni en el log, ni en la traza de una compra. Y un
 * grupo propio ya creado se puede reutilizar: dos calidades nuevas que sí son equivalentes entre sí
 * comparten el suyo.
 *
 * SIN RE-APLICACIÓN EN CALIENTE, y es deliberado: el grupo mueve la coherencia calidad/tipo y la
 * derivación de material, y eso lo recalcula el servidor al reprocesar. Parchearlo en el cliente sería
 * enseñar un resultado que el pipeline no ha producido.
 */
import { useEffect, useMemo, useState } from 'react';
import { QUALITY_GROUPS, ownGroupId } from '../../src/rules/quality-groups.ts';
import { VocabAddPanel, postVocab } from './VocabAddPanel.tsx';

type Decision = 'catalog' | 'own' | 'new_group';

interface GroupRow { id: string; members: string[]; own: boolean }

export function QualityVocabAddPanel({ quality }: { quality: string }) {
  const [decision, setDecision] = useState<Decision>('catalog');
  const [group, setGroup] = useState('G5');
  const [ownGroup, setOwnGroup] = useState('');
  const [text, setText] = useState(quality);
  const [groups, setGroups] = useState<GroupRow[]>([]);

  // El catálogo de §5 viaja en el bundle; los grupos propios no pueden, porque nacen en runtime.
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/vocabulary');
        const body = await res.json();
        if (res.ok && Array.isArray(body.qualityGroups)) setGroups(body.qualityGroups);
      } catch { /* se seguirá con los catorce del bundle */ }
    })();
  }, []);

  const clientGroups = useMemo(
    () => (groups.length ? groups.filter((g) => !g.own) : [...QUALITY_GROUPS].map(([id, m]) => ({ id, members: [...m], own: false }))),
    [groups],
  );
  const ownGroups = useMemo(() => groups.filter((g) => g.own), [groups]);

  useEffect(() => {
    if (ownGroups.length && !ownGroup) setOwnGroup(ownGroups[0].id);
  }, [ownGroups, ownGroup]);

  const members = clientGroups.find((g) => g.id === group)?.members ?? [];
  const newId = ownGroupId(text.trim() || quality);

  const chosen = decision === 'catalog' ? group : decision === 'own' ? ownGroup : newId;
  const suggestedId = useMemo(() => {
    const slug = `${chosen}-${text}`.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'x';
    return `qual-${slug}`;
  }, [chosen, text]);

  const doneText = decision === 'new_group'
    ? `Guardada como grupo propio ${newId}. No se declara intercambiable con ninguna calidad de §5 — que es precisamente lo que querías decir. Reprocesa el MTO para ver el efecto.`
    : `Guardada en ${chosen}. Se aplicará a todos los MTO siguientes; reprocesa éste para ver el efecto sobre la coherencia y el material.`;

  return (
    <VocabAddPanel
      attribute="quality"
      title="Añadir al vocabulario de calidad"
      matchLabel="Calidad tal como la escribe el MTO (editable)"
      matchHint="Se guarda el texto literal: lo que se decide es con qué es intercambiable."
      defaultMatch={quality}
      suggestedId={suggestedId}
      onMatchChange={setText}
      requireRationale={decision === 'new_group'}
      doneText={doneText}
      onSubmit={async ({ match, rationale, evidence, decidedBy }) =>
        postVocab({
          attribute: 'quality',
          match,
          kind: decision === 'new_group' ? 'new_group' : 'equivalence',
          // En `new_group` el id lo calcula el servidor a partir del texto guardado, para que no
          // pueda desincronizarse con lo que el comprador acabó escribiendo en el campo.
          value: decision === 'new_group' ? null : chosen,
          rationale,
          evidence: evidence || 'UI comprador (línea)',
          decidedBy,
        })
      }
    >
      <fieldset className="vocab-decision-fields">
        <legend className="vocab-decision-legend">Decisión</legend>

        <label className={`vocab-decision-card${decision === 'catalog' ? ' selected' : ''}`}>
          <input type="radio" name="quality-decision" checked={decision === 'catalog'} onChange={() => setDecision('catalog')} />
          <span className="vocab-decision-card-body">
            <strong>Equivale a un grupo de §5</strong>
            <span>Es otra forma de escribir una calidad que el documento del cliente ya lista.</span>
          </span>
        </label>
        {decision === 'catalog' && (
          <div className="vocab-decision-detail">
            <label>
              Grupo de §5
              <select value={group} onChange={(e) => setGroup(e.target.value)}>
                {clientGroups.map((g) => (
                  <option key={g.id} value={g.id}>{g.id} · {g.members.join(', ')}</option>
                ))}
              </select>
            </label>
            <span className="kpi-help">
              Al guardar, «{text.trim() || quality}» pasa a ser intercambiable con {members.join(', ')} — y
              con nada de otro grupo.
            </span>
          </div>
        )}

        {ownGroups.length > 0 && (
          <>
            <label className={`vocab-decision-card${decision === 'own' ? ' selected' : ''}`}>
              <input type="radio" name="quality-decision" checked={decision === 'own'} onChange={() => setDecision('own')} />
              <span className="vocab-decision-card-body">
                <strong>Equivale a un grupo que ya creamos</strong>
                <span>Dos calidades fuera de §5 que sí son intercambiables entre sí comparten grupo.</span>
              </span>
            </label>
            {decision === 'own' && (
              <div className="vocab-decision-detail">
                <label>
                  Grupo propio
                  <select value={ownGroup} onChange={(e) => setOwnGroup(e.target.value)}>
                    {ownGroups.map((g) => (
                      <option key={g.id} value={g.id}>{g.id} · {g.members.join(', ')}</option>
                    ))}
                  </select>
                </label>
              </div>
            )}
          </>
        )}

        <label className={`vocab-decision-card${decision === 'new_group' ? ' selected' : ''}`}>
          <input type="radio" name="quality-decision" checked={decision === 'new_group'} onChange={() => setDecision('new_group')} />
          <span className="vocab-decision-card-body">
            <strong>Es una calidad nueva: no equivale a ninguna</strong>
            <span>
              Estrena su propio grupo, y no se declara intercambiable con nada. Es la respuesta correcta
              cuando forzar una equivalencia de §5 sería inventarla.
            </span>
          </span>
        </label>
        {decision === 'new_group' && (
          <div className="vocab-decision-detail">
            <span className="kpi-help">
              Se creará el grupo <code>{newId}</code>, fuera de los catorce de §5 y marcado como
              nuestro. Los catorce del cliente no se tocan.
            </span>
          </div>
        )}
      </fieldset>
    </VocabAddPanel>
  );
}
