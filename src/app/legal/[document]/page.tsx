import { notFound } from 'next/navigation';
import LegalPage from '@/components/legal/LegalPage';
import { isLegalDocument, LEGAL_DOCUMENTS } from '@/lib/legal/config';
import catalog from '@/data/itu/curriculum-catalog.json';
import equivalences from '@/data/itu/equivalences.json';
export function generateStaticParams() { return LEGAL_DOCUMENTS.map(document => ({ document })); }
export default async function LegalRoute({ params }: { params: Promise<{ document: string }> }) {
  const { document } = await params;
  if (!isLegalDocument(document)) notFound();
  return <LegalPage document={document} sourceDates={{ catalog: catalog.retrievedAt, equivalences: equivalences.generatedAt }} />;
}
