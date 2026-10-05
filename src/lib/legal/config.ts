import operator from './operator.json';
export const legalConfig = operator;
export const LEGAL_DOCUMENTS = ['privacy', 'storage', 'terms', 'requests'] as const;
export type LegalDocument = typeof LEGAL_DOCUMENTS[number];
export function isLegalDocument(value: string): value is LegalDocument {
  return LEGAL_DOCUMENTS.some(item => item === value);
}
