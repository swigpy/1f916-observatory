/** The application's only network boundary. No caller-supplied options or URLs. */
const ORIGIN = 'https://1f916.ai';
const MAX_BYTES = 8_000_000;
const ROUTES = Object.freeze({
  pulse: () => '/api/pulse',
  post: id => `/api/post/${positiveId(id)}`,
  comment: id => `/api/comment/${positiveId(id)}`,
  citizen: handle => `/api/citizen/${publicHandle(handle)}`,
  grant: slug => `/api/grants/${publicHandle(slug)}`,
  newest: (page = {}) => {
    if (!page || typeof page !== 'object' || Array.isArray(page) || Object.keys(page).some(k => !['before','snapshot_id','pin_snapshot'].includes(k))) throw new TypeError('Invalid page selector');
    if (!Object.keys(page).length) return '/api/new?limit=100';
    if (!/^[1-9]\d{0,15}:[1-9]\d{0,15}$/.test(page.before) || typeof page.pin_snapshot !== 'string' || !/^(?:[1-9]\d{0,15}(?:,[1-9]\d{0,15})*)?$/.test(page.pin_snapshot) || page.pin_snapshot.length > 2000) throw new TypeError('Invalid feed cursor');
    return `/api/new?limit=100&before=${encodeURIComponent(page.before)}&snapshot_id=${positiveId(page.snapshot_id)}&pin_snapshot=${encodeURIComponent(page.pin_snapshot)}`;
  },
});
function positiveId(value) {
  if (!Number.isSafeInteger(value) || value < 1) throw new TypeError('A positive integer id is required');
  return value;
}
function publicHandle(value) {
  if (typeof value !== 'string' || !/^[A-Za-z0-9_-]{1,80}$/.test(value)) throw new TypeError('Invalid public handle');
  return value;
}
export function sourceUrl(kind, key) {
  if (!Object.hasOwn(ROUTES, kind)) throw new TypeError('Read operation not allowed');
  return ORIGIN + ROUTES[kind](key);
}
export async function readPublic(kind, key) {
  const url = sourceUrl(kind, key);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12_000);
  try {
    const response = await fetch(url, {
      method: 'GET', credentials: 'omit', redirect: 'error', cache: 'no-store',
      referrerPolicy: 'no-referrer', headers: { Accept: 'application/json' }, signal: controller.signal,
    });
    if (!response.ok) throw new Error(`Source unavailable (HTTP ${response.status})`);
    if (!response.headers.get('content-type')?.includes('application/json')) throw new Error('Unexpected source format');
    if (Number(response.headers.get('content-length')) > MAX_BYTES) throw new Error('Source response is too large');
    if (!response.body) throw new Error('Empty source response');
    const reader = response.body.getReader();
    const parts = []; let size = 0;
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_BYTES) { await reader.cancel(); throw new Error('Source response is too large'); }
      parts.push(value);
    }
    const bytes = new Uint8Array(size); let offset = 0;
    for (const part of parts) { bytes.set(part, offset); offset += part.byteLength; }
    return { url, bytes, data: JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)) };
  } finally { clearTimeout(timer); }
}
