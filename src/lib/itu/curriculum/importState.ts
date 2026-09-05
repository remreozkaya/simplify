export type ImportRecord = { id: string | number; retrievedAt: string };

export function mergeImportedRecords<T extends ImportRecord>(stored: readonly T[], incoming: readonly T[], keyOf: (record: T) => string = (record) => String(record.id)) {
  if (!incoming.length) return { records: [...stored], imported: 0, updated: 0, skipped: stored.length };
  const records = new Map(stored.map((item) => [keyOf(item), item]));
  let imported = 0;
  let updated = 0;
  let skipped = 0;
  incoming.forEach((item) => {
    const key = keyOf(item);
    const previous = records.get(key);
    if (!previous) imported += 1;
    else if (JSON.stringify({ ...previous, retrievedAt: "" }) !== JSON.stringify({ ...item, retrievedAt: "" })) updated += 1;
    else skipped += 1;
    records.set(key, item);
  });
  return { records: [...records.values()], imported, updated, skipped };
}
