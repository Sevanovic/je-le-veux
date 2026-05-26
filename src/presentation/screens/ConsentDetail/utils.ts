import type { TFunction } from 'i18next';

/**
 * Format remaining minutes into a human-readable string:
 *  - 0 or less   → "Expired"
 *  - < 60 min    → "Expires in X minutes"
 *  - whole hour  → "Expires in N hours"
 *  - otherwise   → "Expires in Nh Mm"
 */
export function formatRemainingTime(minutes: number, t: TFunction): string {
  if (minutes <= 0) return t('history.expired');
  if (minutes < 60) return t('common.expiresInMinutes', { count: minutes });
  const hours = Math.floor(minutes / 60);
  const remainingMin = minutes % 60;
  if (remainingMin === 0) return t('common.expiresInHours', { count: hours });
  return t('common.expiresInHoursMinutes', { hours, minutes: remainingMin });
}
