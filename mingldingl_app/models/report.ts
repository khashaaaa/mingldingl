/**
 * The reasons `POST /reports` accepts, in the order the sheet offers them. These are wire values
 * the engine validates against `ReportReasons.All`; the copy lives in `lib/i18n` under
 * `report_reason_*`, so adding one means adding it in both places.
 */
export const REPORT_REASONS = [
  'Harassment',
  'InappropriatePhotos',
  'FakeProfile',
  'Scam',
  'Underage',
  'OffPlatformHarm',
  'Other',
] as const;

export type ReportReason = (typeof REPORT_REASONS)[number];

/** The `report_reason_*` i18n key for a reason. */
export function reportReasonKey(reason: ReportReason): string {
  const snake = reason.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase();
  const key = `report_reason_${snake}`;
  return key;
}
