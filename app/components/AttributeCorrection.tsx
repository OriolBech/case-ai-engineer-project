'use client';

/**
 * Corregir un atributo de UNA línea: cambiarlo, quitarlo, o escribir el que falta.
 *
 * QUÉ ES Y QUÉ NO ES. Esto **no** es vocabulario. Una entrada de vocabulario dice "cada vez que
 * aparezca esto, léelo así" y cambia todos los MTO; una corrección dice "en esta fila, este dato es
 * éste", y no cambia ninguna regla. Confundirlas es el error que SPEC-015 existe para evitar, y por
 * eso viven en sitios distintos del mismo panel: arriba lo que enseña al sistema, aquí lo que arregla
 * esta línea. Una corrección puede llegar a ser una regla, pero por el camino largo —aprobación y
 * regresión contra el gold—, nunca por el atajo de escribirla en una celda.
 *
 * LOS TRES CASOS, y los tres hacían falta:
 *   - **Cambiar**: leyó `ISO 4014` donde la fila dice otra cosa.
 *   - **Quitar**: dedujo una calidad que esa pieza no lleva. Vaciar la celda es una afirmación
 *     ("aquí no hay calidad"), no un hueco, y por eso pide motivo igual que las demás.
 *   - **Añadir**: la fila lo dice y el sistema no lo vio.
 *
 * LA EVIDENCIA LITERAL, que el backend exige y aquí se comprueba antes de enviar. `proposeCorrection`
 * rechaza cualquier corrección cuya evidencia no aparezca **tal cual** en el texto de la fila. No es
 * burocracia: es lo que separa una corrección auditable de una opinión, y es lo que permite que
 * meses después alguien pueda releer la fila y ver por qué se compró lo que se compró. Se valida en
 * el cliente para no hacer al comprador descubrirlo con un error del servidor.
 */
import { useMemo, useState } from 'react';
import type { ATTRIBUTE_KEYS, OutputLine } from '../../src/pipeline/types.ts';
import { ATTR_LABEL } from '../lib/derive.ts';
import { VOCAB_ACTOR } from '../lib/finish-vocab-ui.ts';
// La MISMA función que usa el servidor para aceptar o rechazar: escrita dos veces, divergirían.
import { evidenceMatches } from '../../src/eval/history/evidence.ts';

type AttrKey = (typeof ATTRIBUTE_KEYS)[number];
type Mode = 'set' | 'clear';

export function AttributeCorrection({
  line,
  attribute,
  sourceText,
  onCorrected,
  onClose,
}: {
  line: OutputLine;
  attribute: AttrKey;
  sourceText: string | null;
  onCorrected?: (lineId: string, attribute: AttrKey, value: string | null) => void;
  onClose: () => void;
}) {
  const current = line.attributes[attribute];
  const [mode, setMode] = useState<Mode>(current.normalized === null ? 'set' : 'set');
  const [value, setValue] = useState(current.normalized ?? '');
  // Por defecto, lo que la fila dice sobre este atributo: es la evidencia obvia y casi siempre la
  // correcta. Editable, porque la evidencia de "aquí NO va calidad" puede ser otro trozo de la fila.
  const [evidence, setEvidence] = useState(current.raw ?? current.normalized ?? '');
  const [rationale, setRationale] = useState('');
  const [state, setState] = useState<'idle' | 'saving' | 'done' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);

  const evidenceOk = useMemo(
    () => !!sourceText && !!evidence.trim() && evidenceMatches(sourceText, evidence),
    [sourceText, evidence],
  );

  const nextValue = mode === 'clear' ? null : value.trim();
  const unchanged = mode === 'set' && (nextValue ?? '') === (current.normalized ?? '');
  const blocked =
    !rationale.trim() ? 'Escribe el motivo: una corrección sin porqué no se puede revisar después.'
    : !evidence.trim() ? 'Falta la evidencia: el trozo de la fila en el que te apoyas.'
    : !sourceText ? 'No tenemos el texto original de esta fila en esta sesión, así que no se puede registrar la evidencia.'
    : !evidenceOk ? 'Esa evidencia no aparece tal cual en la fila. Cópiala del texto de arriba.'
    : mode === 'set' && !nextValue ? 'Escribe el valor, o elige “quitarlo”.'
    : unchanged ? 'El valor es el que ya había.'
    : null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (blocked) return;
    setState('saving');
    setError(null);
    try {
      const res = await fetch('/api/corrections', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          // `runId` es un run de EVALUACIÓN (SPEC-010), no el MTO que el comprador tiene abierto:
          // son dos bases y dos espacios de ids distintos, y atarlos daba un error de clave ajena
          // ilegible. Una corrección desde la app no nace de un run de evaluación, así que va nulo;
          // `lineId` y `rowRef` ya dicen sobre qué se corrigió, y `createdAt`, cuándo.
          runId: null,
          rowRef: line.rowRef,
          lineId: line.id,
          attribute,
          previousValue: current.normalized,
          correctedValue: nextValue,
          evidence: evidence.trim(),
          author: VOCAB_ACTOR,
          rationale: rationale.trim(),
          rowSourceText: sourceText,
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
      setState('done');
      onCorrected?.(line.id, attribute, nextValue);
    } catch (e2) {
      setError(e2 instanceof Error ? e2.message : String(e2));
      setState('error');
    }
  };

  if (state === 'done') {
    return (
      <div className="trace-correction done">
        <p className="kpi-help vocab-quickadd-done">
          {nextValue === null
            ? `Quitado. Esta línea ya no lleva ${ATTR_LABEL[attribute].toLowerCase()}.`
            : `Corregido a «${nextValue}» en esta línea.`}
        </p>
        <p className="kpi-help">
          Queda registrada con tu motivo y la evidencia, pendiente de aprobación en{' '}
          <a className="vocab-quickadd-link" href="/corrections">correcciones</a>. Cambia esta línea,
          no las reglas: para que el sistema lo aplique solo en los MTO que vengan, hay que aprobarla
          y pasar la regresión.
        </p>
        <button className="wf-btn small" onClick={onClose}>Cerrar</button>
      </div>
    );
  }

  return (
    <form className="trace-correction" onSubmit={submit}>
      <div className="trace-correction-head">
        <strong>Corregir {ATTR_LABEL[attribute].toLowerCase()}</strong>
        <span className="kpi-help">
          Sólo esta línea. Ahora dice{' '}
          <b>{current.normalized ?? '— nada —'}</b>.
        </span>
      </div>

      <div className="pillgroup" role="group" aria-label="Qué hacer">
        <button type="button" className={`pill${mode === 'set' ? ' on' : ''}`} onClick={() => setMode('set')}>
          {current.normalized === null ? 'Escribir el que falta' : 'Cambiar el valor'}
        </button>
        <button type="button" className={`pill${mode === 'clear' ? ' on' : ''}`} onClick={() => setMode('clear')}>
          Quitarlo: aquí no aplica
        </button>
      </div>

      {mode === 'set' ? (
        <label>
          Valor correcto
          <input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={`${ATTR_LABEL[attribute]} tal como debe quedar`}
            autoFocus
          />
        </label>
      ) : (
        <p className="kpi-help">
          La línea quedará <strong>sin {ATTR_LABEL[attribute].toLowerCase()}</strong>. Es una
          afirmación sobre esta pieza —que no lleva ese dato—, no un hueco pendiente.
        </p>
      )}

      <label>
        Evidencia <span className="vocab-required">(literal de la fila)</span>
        <input
          value={evidence}
          onChange={(e) => setEvidence(e.target.value)}
          placeholder="cópialo del texto original de arriba"
        />
        <span className={`kpi-help${evidence.trim() && !evidenceOk ? ' evidence-bad' : ''}`}>
          {!evidence.trim()
            ? 'El trozo de la fila en el que te apoyas para decir esto.'
            : evidenceOk
              ? '✓ aparece tal cual en la fila'
              : '✗ no aparece tal cual en la fila: una corrección exige evidencia literal, no una paráfrasis'}
        </span>
      </label>

      <label>
        Motivo <span className="vocab-required">(obligatorio)</span>
        <input
          value={rationale}
          onChange={(e) => setRationale(e.target.value)}
          placeholder="por qué el sistema se equivocó aquí"
        />
      </label>

      <div className="trace-correction-actions">
        <button className="wf-btn primary small" type="submit" disabled={state === 'saving' || !!blocked}>
          {state === 'saving' ? 'Guardando…' : 'Guardar corrección'}
        </button>
        <button type="button" className="wf-btn small" onClick={onClose}>Cancelar</button>
        {blocked && <span className="kpi-help">{blocked}</span>}
      </div>

      {error && <span className="vocab-quickadd-error">{error}</span>}
    </form>
  );
}
