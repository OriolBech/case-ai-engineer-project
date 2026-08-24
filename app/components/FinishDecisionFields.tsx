'use client';

import { useId } from 'react';
import { fold } from '../../src/rules/text.ts';
import { FINISH_OPTIONS } from '../lib/finish-vocab-ui.ts';

/** Tres decisiones de compras al vincular un texto de acabado del MTO. */
export type FinishDecision = 'catalog' | 'new' | 'not_a_finish';

export interface FinishDecisionFieldsProps {
  decision: FinishDecision;
  onDecisionChange: (d: FinishDecision) => void;
  catalogValue: string;
  onCatalogValueChange: (v: string) => void;
  newFinishName: string;
  onNewFinishNameChange: (v: string) => void;
  finishCatalog: string[];
  /** Texto del MTO: prefill del nombre canónico al elegir «acabado nuevo». */
  aliasText: string;
  className?: string;
}

function finishLabel(value: string): string {
  return FINISH_OPTIONS.find((o) => o.value === value)?.label ?? value;
}

function finishHint(value: string): string {
  const seed = FINISH_OPTIONS.find((o) => o.value === value);
  return seed?.hint ?? 'Añadido al catálogo';
}

function isSeedFinish(value: string): boolean {
  return FINISH_OPTIONS.some((o) => o.value === value);
}

export function FinishDecisionFields({
  decision,
  onDecisionChange,
  catalogValue,
  onCatalogValueChange,
  newFinishName,
  onNewFinishNameChange,
  finishCatalog,
  aliasText,
  className = '',
}: FinishDecisionFieldsProps) {
  const groupName = useId();

  const pick = (d: FinishDecision) => {
    if (d === 'new' && !newFinishName.trim() && aliasText.trim()) {
      onNewFinishNameChange(fold(aliasText));
    }
    onDecisionChange(d);
  };

  const catalog = finishCatalog.length > 0 ? finishCatalog : FINISH_OPTIONS.map((o) => o.value);

  return (
    <fieldset className={`finish-decision-fields ${className}`.trim()}>
      <legend className="finish-decision-legend">Decisión</legend>

      <label className={`finish-decision-card${decision === 'catalog' ? ' selected' : ''}`}>
        <input
          type="radio"
          name={groupName}
          value="catalog"
          checked={decision === 'catalog'}
          onChange={() => pick('catalog')}
        />
        <span className="finish-decision-card-body">
          <strong>Equivale a uno del catálogo</strong>
          <span className="kpi-help">
            El texto del MTO es un sinónimo de un acabado que ya conocemos (los siete de §9 o uno
            añadido antes).
          </span>
        </span>
      </label>

      {decision === 'catalog' && (
        <label className="finish-decision-detail">
          Acabado del catálogo
          <select value={catalogValue} onChange={(e) => onCatalogValueChange(e.target.value)}>
            {catalog.map((v) => (
              <option key={v} value={v}>
                {finishLabel(v)}
                {!isSeedFinish(v) ? ' · añadido' : ''}
              </option>
            ))}
          </select>
          <span className="kpi-help">{finishHint(catalogValue)}</span>
        </label>
      )}

      <label className={`finish-decision-card${decision === 'new' ? ' selected' : ''}`}>
        <input
          type="radio"
          name={groupName}
          value="new"
          checked={decision === 'new'}
          onChange={() => pick('new')}
        />
        <span className="finish-decision-card-body">
          <strong>Es un acabado nuevo</strong>
          <span className="kpi-help">
            Recubrimiento real que aún no está en el catálogo (p. ej. niquelado, PTFE). El texto del
            MTO queda como alias y el nombre canónico se añade al catálogo.
          </span>
        </span>
      </label>

      {decision === 'new' && (
        <label className="finish-decision-detail">
          Nombre canónico del acabado
          <input
            value={newFinishName}
            onChange={(e) => onNewFinishNameChange(e.target.value)}
            placeholder="p. ej. NIQUELADO"
            required
          />
          <span className="kpi-help">Mayúsculas, sin tildes — se normaliza al guardar.</span>
        </label>
      )}

      <label className={`finish-decision-card${decision === 'not_a_finish' ? ' selected' : ''}`}>
        <input
          type="radio"
          name={groupName}
          value="not_a_finish"
          checked={decision === 'not_a_finish'}
          onChange={() => pick('not_a_finish')}
        />
        <span className="finish-decision-card-body">
          <strong>No es un acabado</strong>
          <span className="kpi-help">
            El texto no describe un recubrimiento: PLAIN, SELF-COLOUR, «según pliego», «sin recubrir»…
            La línea queda sin acabado — valor válido de §9, no un recubrimiento inventado.
          </span>
        </span>
      </label>
    </fieldset>
  );
}
