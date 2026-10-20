const date = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
const dateTime = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'Asia/Ulaanbaatar',
});

export const formatDate = (iso: string) => date.format(new Date(iso));
export const formatDateTime = (iso: string) => dateTime.format(new Date(iso));

/** How long ago, in the largest whole unit: "3h", "1d". */
export function formatAge(iso: string, now = Date.now()) {
  const minutes = Math.max(0, Math.floor((now - Date.parse(iso)) / 60_000));
  if (minutes < 60) return `${minutes}m`;
  if (minutes < 60 * 24) return `${Math.floor(minutes / 60)}h`;
  return `${Math.floor(minutes / (60 * 24))}d`;
}

/** The list shows only the first four digits; the full number is on the person's page. */
export const maskPhone = (phone: string) => `${phone.slice(0, 4)} ····`;

/** Tögrög, grouped: "12,000₮". */
export const tugrik = (n: number) => `${n.toLocaleString('en-US')}₮`;
