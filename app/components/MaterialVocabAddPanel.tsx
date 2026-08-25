'use client';

/**
 * Alta de material desde la línea, con la misma forma que la de acabado.
 *
 * LAS TRES SALIDAS, no dos. El hueco de material lleva escrito desde el principio *"decidir si es AC
 * o INOX, o declararla no derivable con su motivo"*, y el formulario sólo ofrecía las dos primeras:
 * sobre una calidad de la que el metal NO se deduce —una dureza, por ejemplo— las dos opciones
 * disponibles eran inventárselo. La tercera es el gemelo exacto de "esto no es un acabado" del panel
 * de §9, y ahora existe también aquí (`kind: 'not_derivable'`).
 *
 * EL PATRÓN LO PONE EL CÓDIGO. La entrada se ata a la calidad con un patrón anclado y escapado
 * (`exactQualityPattern`), el mismo que redacta el backlog. Que el comprador tuviera que escribir
 * `^GR\\ 12H$` sería pedirle una expresión regular para comprar tornillos; y un patrón sin anclar
 * cubre de más, que es material equivocado con cara de tabla.
 */
import { useMemo, useState } from 'react';
import { exactQualityPattern } from '../../src/rules/quality-pattern.ts';
import { VocabAddPanel, postVocab } from './VocabAddPanel.tsx';
import type { SuggestionPatch } from './App.tsx';

type Decision = 'AC' | 'INOX' | 'not_derivable';

const CHOICES: { value: Decision; label: string; detail: string }[] = [
  { value: 'AC', label: 'Es acero (AC)', detail: 'Acero al carbono o aleado. Las clases 8.8, 10.9, 12.9 y los grados ASTM B7 o 2H son esto.' },
  { value: 'INOX', label: 'Es inoxidable (INOX)', detail: 'A2, A4, 304, 316. La distinción que más caro sale confundir, porque el precio y la aplicación no se parecen.' },
  { value: 'not_derivable', label: 'De esta calidad no se deduce el material', detail: 'Como las durezas HV: describen el tratamiento superficial, no el metal base. La línea seguirá sin material, pero por una decisión escrita y no por un vacío.' },
];

export function MaterialVocabAddPanel({
  quality,
  /** El patrón que redactó el backlog, si esta línea venía de un hueco. Si no, se deriva del texto. */
  matchOverride,
  matchKind = 'qualityPattern',
  onApplied,
}: {
  quality: string;
  matchOverride?: string;
  matchKind?: 'qualityPattern' | 'qualityGroup';
  onApplied?: (p: SuggestionPatch) => void;
}) {
  const [decision, setDecision] = useState<Decision>('AC');
  const [text, setText] = useState(quality);

  const match = matchOverride ?? (matchKind === 'qualityGroup' ? text.trim() : exactQualityPattern(text));
  const suggestedId = useMemo(() => {
    const slug = text.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'x';
    return decision === 'not_derivable' ? `uncovered:${slug}` : `mat-${slug}-${decision.toLowerCase()}`;
  }, [text, decision]);

  return (
    <VocabAddPanel
      attribute="material"
      title="Añadir al vocabulario de material"
      matchLabel="Calidad de la que se deduce (editable)"
      matchHint={matchOverride
        ? 'Esta entrada viene del hueco detectado: se aplicará a la calidad tal como la escribe el MTO.'
        : 'Se guardará atada exactamente a esta calidad, ni más ni menos.'}
      defaultMatch={quality}
      suggestedId={suggestedId}
      onMatchChange={setText}
      requireRationale={decision === 'not_derivable'}
      doneText={
        decision === 'not_derivable'
          ? 'Guardado. Esta calidad queda declarada no derivable con tu motivo: dejará de aparecer como decisión pendiente en todos los MTO.'
          : `Guardado. Las líneas con esa calidad quedan resueltas con material ${decision}, aquí y en los MTO que vengan.`
      }
      onSubmit={async ({ match: edited, rationale, evidence, decidedBy }) => {
        const finalMatch = matchOverride && edited === quality
          ? matchOverride
          : matchKind === 'qualityGroup' ? edited : exactQualityPattern(edited);
        const warnings = await postVocab({
          attribute: 'material',
          match: finalMatch,
          matchKind,
          kind: decision === 'not_derivable' ? 'not_derivable' : 'derivation',
          value: decision === 'not_derivable' ? null : decision,
          rationale,
          evidence: evidence || 'UI comprador (línea)',
          decidedBy,
        });
        // Sólo se re-aplica en caliente lo que da un valor: una ausencia declarada no rellena nada.
        if (decision !== 'not_derivable') {
          onApplied?.({ attribute: 'material', match: edited, value: decision });
        }
        return warnings;
      }}
    >
      <fieldset className="vocab-decision-fields">
        <legend className="vocab-decision-legend">Decisión</legend>
        {CHOICES.map((c) => (
          <label key={c.value} className={`vocab-decision-card${decision === c.value ? ' selected' : ''}`}>
            <input
              type="radio"
              name="material-decision"
              checked={decision === c.value}
              onChange={() => setDecision(c.value)}
            />
            <span className="vocab-decision-card-body">
              <strong>{c.label}</strong>
              <span>{c.detail}</span>
            </span>
          </label>
        ))}
      </fieldset>
    </VocabAddPanel>
  );
}
