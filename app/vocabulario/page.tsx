import { VocabularyView } from '../components/VocabularyView.tsx';
import type { VocabAttribute } from '../../src/rules/vocab-model.ts';

export const metadata = {
  title: 'Vocabulario común · Tornillería',
};

const ATTRS: VocabAttribute[] = ['name', 'material', 'quality', 'norma', 'finish'];

/**
 * La vista única del vocabulario. `?attr=` y `?alias=` la abren prefiltrada y con el alta precargada
 * —así los enlaces "→ vocabulario" desde la cola o el backlog caen en el sitio exacto, sin páginas
 * separadas por atributo.
 */
export default function VocabularioPage({
  searchParams,
}: {
  searchParams?: { attr?: string; alias?: string };
}) {
  const attr = searchParams?.attr;
  const initialAttribute = attr && (ATTRS as string[]).includes(attr) ? (attr as VocabAttribute) : 'todos';
  return <VocabularyView initialAttribute={initialAttribute} initialAlias={searchParams?.alias} />;
}
