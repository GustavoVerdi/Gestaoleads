const DEFAULT_POLL_INTERVAL_MS = 2000;
const DEFAULT_MAX_WAIT_MS = 270000;

export function buildMapsKeyword({ segment = '', city = '', state = '', region = '' } = {}) {
  const niche = String(segment).trim();
  const place = [String(city).trim(), String(state).trim().toUpperCase()].filter(Boolean).join(', ');
  const area = [place, String(region).trim()].filter(Boolean).join(' - ');
  if (!niche) return area;
  if (!area) return niche;
  return `${niche} em ${area}`;
}

function formatAddress(value) {
  const raw = String(value || '').trim();
  if (!raw.startsWith('{')) return raw;
  try {
    const address = JSON.parse(raw);
    return [...new Set([address.street, address.borough, address.city, address.state, address.postal_code].filter(Boolean))].join(', ');
  } catch { return raw; }
}

export function mapGoogleMapsPlace(place = {}, query = {}) {
  const name = String(place.title || place.name || '').trim();
  const address = formatAddress(place.complete_address || place.address || '');
  const website = String(place.website || '').trim();
  const phone = String(place.phone || '').trim();
  const sourceUrl = String(place.link || place.url || '').trim();
  return {
    name: name || 'Empresa sem nome',
    type: String(place.category || place.type || 'Empresa'),
    city: [query.city, query.state].filter(Boolean).join(' - ') || address,
    address,
    phone,
    site: website || 'Sem site',
    rating: place.review_rating == null ? '' : String(place.review_rating),
    reviews: place.review_count == null ? '' : String(place.review_count),
    mapsUrl: sourceUrl,
    sourceUrl,
    tone: 'green',
    initials: (name || 'EM').slice(0, 2).toUpperCase(),
    status: 'Novo lead',
  };
}

async function responseJson(response) {
  const text = await response.text();
  let payload;
  try { payload = text ? JSON.parse(text) : {}; }
  catch { throw new Error('O serviço Google Maps Scraper retornou uma resposta inválida.'); }
  if (!response.ok) {
    const message = payload.message || payload.Message || payload.error || `O scraper respondeu com status ${response.status}.`;
    throw new Error(message);
  }
  return payload;
}

function parseCsv(source) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < source.length; i += 1) {
    const char = source[i];
    if (quoted) {
      if (char === '"' && source[i + 1] === '"') { field += '"'; i += 1; }
      else if (char === '"') quoted = false;
      else field += char;
    } else if (char === '"') quoted = true;
    else if (char === ',') { row.push(field); field = ''; }
    else if (char === '\n' || char === '\r') {
      if (char === '\r' && source[i + 1] === '\n') i += 1;
      row.push(field); field = '';
      if (row.some(value => value !== '')) rows.push(row);
      row = [];
    } else field += char;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  if (!rows.length) return [];
  const headers = rows.shift().map(value => value.trim().toLowerCase());
  return rows.map(values => Object.fromEntries(headers.map((key, index) => [key, values[index] || ''])));
}

export async function startGoogleMapsScraperJob(filters, {
  baseUrl,
  fetchImpl = fetch,
} = {}) {
  if (!baseUrl) throw new Error('Google Maps Scraper não configurado. Inicie o serviço local e defina GOOGLE_MAPS_SCRAPER_URL.');
  const keyword = buildMapsKeyword(filters);
  if (!keyword) throw new Error('Informe um segmento ou uma localização para pesquisar.');
  const root = baseUrl.replace(/\/+$/, '');
  const headers = { 'Content-Type': 'application/json' };
  const submitted = await responseJson(await fetchImpl(`${root}/api/v1/jobs`, {
    method: 'POST', headers,
    body: JSON.stringify({
      name: keyword,
      keywords: [keyword],
      lang: 'pt',
      depth: 1,
      max_time: 250,
      zoom: 15,
      lat: '0',
      lon: '0',
      radius: 10000,
      email: false,
      extra_reviews: false,
      fast_mode: false,
    }),
    // The scraper may be waking from Render's free-tier sleep; allow startup time.
    signal: AbortSignal.timeout(60000),
  }));
  const jobId = submitted.job_id || submitted.id || submitted.ID;
  if (!jobId) throw new Error('O scraper aceitou a busca, mas não retornou o identificador do trabalho.');
  return { jobId: String(jobId), keyword };
}

export async function getGoogleMapsScraperJob(jobId, filters = {}, { baseUrl, fetchImpl = fetch } = {}) {
  if (!baseUrl) throw new Error('Google Maps Scraper não configurado.');
  const keyword = buildMapsKeyword(filters);
  const root = baseUrl.replace(/\/+$/, '');
  const headers = { 'Content-Type': 'application/json' };
  const job = await responseJson(await fetchImpl(`${root}/api/v1/jobs/${encodeURIComponent(jobId)}`, {
    headers, signal: AbortSignal.timeout(15000),
  }));
  const status = String(job.status || job.Status || '').toLowerCase();
  if (['failed', 'error', 'cancelled', 'canceled', 'discarded'].includes(status)) {
    return { status: 'failed', provider: 'google-maps-scraper', error: job.error || `A busca no Google Maps terminou com status “${status}”.` };
  }
  if (!['completed', 'complete', 'done', 'ok', 'success'].includes(status)) {
    return { status: 'processing', provider: 'google-maps-scraper' };
  }
  const csvResponse = await fetchImpl(`${root}/api/v1/jobs/${encodeURIComponent(jobId)}/download`, {
    headers: { Accept: 'text/csv' }, signal: AbortSignal.timeout(15000),
  });
  if (!csvResponse.ok) throw new Error(`O scraper concluiu a busca, mas não foi possível baixar os resultados (status ${csvResponse.status}).`);
  const csv = await csvResponse.text();
  const items = parseCsv(csv);
  const unique = new Map();
  for (const item of items) {
    const place = mapGoogleMapsPlace(item, filters);
    const key = `${place.name.toLocaleLowerCase('pt-BR')}|${place.phone.replace(/\D/g, '')}`;
    if (place.name !== 'Empresa sem nome' && !unique.has(key)) unique.set(key, place);
  }
  const results = [...unique.values()];
  return {
    status: 'completed',
    configured: true,
    provider: 'google-maps-scraper',
    results,
    notice: `Google Maps consultado agora; ${results.length} empresa(s) encontrada(s) para “${keyword}”.`,
  };
}

export async function searchGoogleMapsScraper(filters, {
  baseUrl,
  fetchImpl = fetch,
  sleep = ms => new Promise(resolve => setTimeout(resolve, ms)),
  pollIntervalMs = DEFAULT_POLL_INTERVAL_MS,
  maxWaitMs = DEFAULT_MAX_WAIT_MS,
} = {}) {
  const { jobId } = await startGoogleMapsScraperJob(filters, { baseUrl, fetchImpl });
  const deadline = Date.now() + maxWaitMs;
  while (Date.now() < deadline) {
    await sleep(Math.min(pollIntervalMs, Math.max(0, deadline - Date.now())));
    const job = await getGoogleMapsScraperJob(jobId, filters, { baseUrl, fetchImpl });
    if (job.status === 'completed') return job;
    if (job.status === 'failed') throw new Error(job.error);
  }
  throw new Error('A busca no Google Maps ainda está processando. Tente novamente em instantes.');
}
