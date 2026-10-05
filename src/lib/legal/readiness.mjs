/** Validate public owner facts without reading or printing secret values.
 * @param {Record<string, any>} config
 * @param {Record<string, string | undefined>} env
 */
export function legalLaunchBlockers(config, env = process.env) {
  const blockers = [];
  const validText = value => typeof value === 'string' && value.trim().length > 0 && !/\b(TODO|TBD|example|your[-_])/i.test(value);
  for (const field of ['controllerName', 'postalAddress']) {
    if (!validText(config[field])) blockers.push(`operator.${field}`);
  }
  if (!validText(config.privacyEmail) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(config.privacyEmail)) blockers.push('operator.privacyEmail');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(config.effectiveDate ?? '') || !Number.isFinite(Date.parse(config.effectiveDate)) || new Date(config.effectiveDate).toISOString().slice(0, 10) !== config.effectiveDate) blockers.push('operator.effectiveDate');
  if (!validText(config.version)) blockers.push('operator.version');
  for (const provider of ['hosting', 'authentication', 'email']) {
    for (const field of ['name', 'locations']) if (!validText(config[provider]?.[field])) blockers.push(`operator.${provider}.${field}`);
  }
  for (const record of ['account', 'logs', 'requests', 'backups']) {
    for (const language of ['tr', 'en']) if (!validText(config.retention?.[record]?.[language])) blockers.push(`operator.retention.${record}.${language}`);
  }
  for (const language of ['tr', 'en']) if (!validText(config.transferDisclosure?.[language])) blockers.push(`operator.transferDisclosure.${language}`);
  for (const review of ['legalBases', 'providerContracts', 'internationalTransfers', 'verbis', 'law5651', 'requestChannelTested', 'requestOwnerAssigned', 'incidentResponse', 'retentionAndDeletion', 'universityPermissions', 'dependencyLicenses']) {
    if (config.reviews?.[review] !== true) blockers.push(`operator.reviews.${review}`);
  }
  if (!env.SUPABASE_SECRET_KEY?.trim()) blockers.push('server.SUPABASE_SECRET_KEY (account deletion)');
  if (!env.NEXT_PUBLIC_SUPABASE_URL?.startsWith('https://') || /your-project|example/.test(env.NEXT_PUBLIC_SUPABASE_URL)) blockers.push('server.NEXT_PUBLIC_SUPABASE_URL');
  if (!env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() || /your_key/.test(env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY)) blockers.push('server.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY');
  if (!env.NEXT_PUBLIC_SITE_URL?.startsWith('https://') || /localhost|\.example/.test(env.NEXT_PUBLIC_SITE_URL)) blockers.push('server.NEXT_PUBLIC_SITE_URL');
  if (env.NEXT_PUBLIC_SUPABASE_SECRET_KEY || env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY) blockers.push('public admin credential is forbidden');
  return blockers;
}
