import { FinishVocabularyScreen } from '../../components/FinishVocabularyScreen.tsx';

export default function FinishVocabularyPage({
  searchParams,
}: {
  searchParams?: { alias?: string };
}) {
  return <FinishVocabularyScreen initialAlias={searchParams?.alias} />;
}
