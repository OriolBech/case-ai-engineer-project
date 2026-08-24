import { RevisionCompareScreen } from '../../components/RevisionCompareScreen.tsx';

export const metadata = {
  title: 'Comparar revisiones · Tornillería',
};

export default async function ComparePage({
  searchParams,
}: {
  searchParams: Promise<{ previous?: string; current?: string }>;
}) {
  const sp = await searchParams;
  const previous = sp.previous ?? '';
  const current = sp.current ?? '';
  if (!previous || !current) {
    return (
      <div className="vocab-page">
        <div className="vocab-page-inner">
          <p className="kpi-verdict">Faltan los parámetros previous y current. Vuelve al <a href="/mto-history">histórico</a>.</p>
        </div>
      </div>
    );
  }
  return <RevisionCompareScreen previousId={previous} currentId={current} />;
}
