import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { BUSINESS_TAG_KEYS as testedBusinessTagKeys, buildNicheSelectors, matchesNiche as testedMatchesNiche } from './prospecting-search.mjs';
import { getGoogleMapsScraperJob, startGoogleMapsScraperJob } from './google-maps-scraper.mjs';
import { resolveMunicipality } from './municipality-location.mjs';

async function loadLocalEnvironment() {
  try {
    const source = await readFile(new URL('.env', import.meta.url), 'utf8');
    for (const line of source.split(/\r?\n/)) {
      const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
      if (!match || match[1].startsWith('#') || process.env[match[1]]) continue;
      process.env[match[1]] = match[2].replace(/^(['"])(.*)\1$/, '$2');
    }
  } catch (error) { if (error.code !== 'ENOENT') throw error; }
}
await loadLocalEnvironment();

const root = fileURLToPath(new URL('.', import.meta.url));
const port = Number(process.env.PORT || 4173);
const mimeTypes = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8' };
const ceoPermissions = ['dashboard', 'projects', 'leads', 'project-edit', 'sensitive', 'team'];
export { server };

function sendJson(response, status, payload) { response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }); response.end(JSON.stringify(payload)); }
function supabaseConfig() { return { url: String(process.env.SUPABASE_URL || '').replace(/\/$/, ''), publishableKey: process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY || '' }; }
function supabaseAdminConfig() { return { ...supabaseConfig(), serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '' }; }
function adminHeaders() { const { publishableKey, serviceRoleKey } = supabaseAdminConfig(); return { apikey: serviceRoleKey || publishableKey, Authorization: `Bearer ${serviceRoleKey || publishableKey}`, 'Content-Type': 'application/json' }; }
async function authenticatedProfile(request) {
  const { url, publishableKey } = supabaseConfig();
  const token = request.headers.authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!url || !publishableKey || !token) return null;
  const headers = { apikey: publishableKey, Authorization: `Bearer ${token}` };
  const userResponse = await fetch(`${url}/auth/v1/user`, { headers, signal: AbortSignal.timeout(8000) });
  if (!userResponse.ok) return null;
  const user = await userResponse.json();
  const profileUrl = new URL(`${url}/rest/v1/profiles`);
  profileUrl.searchParams.set('select', 'id,full_name,role_id,active,must_change_password');
  profileUrl.searchParams.set('id', `eq.${user.id}`);
  const profileResponse = await fetch(profileUrl, { headers: { ...headers, Accept: 'application/json' }, signal: AbortSignal.timeout(8000) });
  if (!profileResponse.ok) throw new Error('Não foi possível carregar seu perfil. Confira se a migração inicial do banco foi aplicada.');
  const [profile] = await profileResponse.json();
  if (!profile) return null;
  const roleUrl = new URL(`${url}/rest/v1/app_roles`);
  roleUrl.searchParams.set('select', 'id,name,permissions,protected');
  roleUrl.searchParams.set('id', `eq.${profile.role_id}`);
  const roleResponse = await fetch(roleUrl, { headers: { ...headers, Accept: 'application/json' }, signal: AbortSignal.timeout(8000) });
  if (!roleResponse.ok) throw new Error('Não foi possível carregar as permissões do cargo.');
  const [role] = await roleResponse.json();
  const permissions = role?.id === 'owner' || role?.name === 'CEO' ? ceoPermissions : role?.permissions || [];
  return { user: { id: user.id, email: user.email }, profile: { ...profile, role: role || null, permissions } };
}
function escapeRegex(value) { return String(value || '').replace(/[\\"\[\]()*+?.^$|{}]/g, '\\$&'); }
function normalizeText(value) { return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim(); }
const businessTagKeys = ['shop', 'amenity', 'office', 'craft', 'healthcare', 'tourism', 'leisure', 'industrial', 'club', 'sport'];
const brazilianStates = { AC: 'Acre', AL: 'Alagoas', AP: 'Amapá', AM: 'Amazonas', BA: 'Bahia', CE: 'Ceará', DF: 'Distrito Federal', ES: 'Espírito Santo', GO: 'Goiás', MA: 'Maranhão', MT: 'Mato Grosso', MS: 'Mato Grosso do Sul', MG: 'Minas Gerais', PA: 'Pará', PB: 'Paraíba', PR: 'Paraná', PE: 'Pernambuco', PI: 'Piauí', RJ: 'Rio de Janeiro', RN: 'Rio Grande do Norte', RS: 'Rio Grande do Sul', RO: 'Rondônia', RR: 'Roraima', SC: 'Santa Catarina', SP: 'São Paulo', SE: 'Sergipe', TO: 'Tocantins' };
function matchesNiche(tags, segment) { return testedMatchesNiche(tags, segment); }
function osmPlaceToLead(element, query) { const tags = element.tags || {}; const name = tags.name || tags.brand || 'Empresa sem nome'; const address = [tags['addr:street'], tags['addr:housenumber'], tags['addr:suburb']].filter(Boolean).join(', '); const site = tags.website || tags['contact:website'] || 'Sem site'; const phone = tags.phone || tags['contact:phone'] || ''; const type = testedBusinessTagKeys.map(key => tags[key]).find(Boolean) || 'Empresa'; return { name, type, city: query.city || address || 'Localização não informada', address, phone, site, rating: '', reviews: '', mapsUrl: `https://www.openstreetmap.org/${element.type}/${element.id}`, sourceUrl: `https://www.openstreetmap.org/${element.type}/${element.id}`, tone: 'green', initials: name.slice(0, 2).toUpperCase(), status: 'Novo lead' }; }
async function searchOpenStreetMap(query) {
  const city = (query.city || query.region || '').replace(/\s*[,·-]\s*[A-Z]{2}\s*$/i, '').trim();
  if (!city) return { configured: true, provider: 'openstreetmap', results: [], notice: 'Informe uma cidade para definir a área da busca.' };
  const areaName = escapeRegex(city);
  const requestedState = String(query.state || '').trim().toUpperCase();
  const stateName = escapeRegex(brazilianStates[requestedState] || query.state || '');
  const stateFilter = stateName ? `area["name"~"^${stateName}$",i]["boundary"="administrative"]->.stateArea;` : '';
  const stateScope = stateName ? '(area.stateArea)' : '';
  const selectors = buildNicheSelectors(query.segment);
  const overpassQuery = `[out:json][timeout:30];${stateFilter}area["name"~"^${areaName}$",i]["boundary"="administrative"]${stateScope}->.searchArea;(${selectors});out center tags;`;
  const endpoints = ['https://overpass-api.de/api/interpreter', 'https://lz4.overpass-api.de/api/interpreter', 'https://overpass.private.coffee/api/interpreter', 'https://maps.mail.ru/osm/tools/overpass/api/interpreter'];
  let lastError = 'Fonte OpenStreetMap temporariamente indisponível.';
  for (const endpoint of endpoints) {
    try {
      const overpassResponse = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'VerdiTechSolucoes/1.0 (local business prospecting tool)' },
        body: new URLSearchParams({ data: overpassQuery }),
        // Public Overpass mirrors frequently answer in 5–15s; short client
        // deadlines were causing false failures before their own query limit.
        signal: AbortSignal.timeout(15000),
      });
      const raw = await overpassResponse.text();
      if (overpassResponse.status === 429 || overpassResponse.status === 406) { lastError = 'A fonte pública pediu uma pausa de 30 segundos antes de uma nova tentativa.'; break; }
      if (!overpassResponse.ok || raw.trimStart().startsWith('<')) { lastError = `Fonte pública indisponível (${overpassResponse.status}).`; continue; }
      const payload = JSON.parse(raw);
      const results = (payload.elements || []).filter(element => element.tags?.name && matchesNiche(element.tags, query.segment)).map(element => osmPlaceToLead(element, query));
      const seen = new Set();
      const unique = results.filter(place => { const key = normalizeText(place.name); if (!key || seen.has(key)) return false; seen.add(key); return true; });
      const updatedAt = payload.osm3s?.timestamp_osm_base || '';
      const response = { configured: true, provider: 'openstreetmap', results: unique, updatedAt, notice: `© OpenStreetMap contributors. Consulta feita agora; ${unique.length} empresa(s) encontrada(s). ${updatedAt ? `Dados da base atualizados em ${updatedAt}.` : 'A cobertura depende do que está cadastrado na cidade.'}` };
      return response;
    } catch (error) { lastError = error.message; }
  }
  throw new Error(lastError);
}
async function readRequest(request) { let body = ''; for await (const chunk of request) body += chunk; return JSON.parse(body || '{}'); }
async function searchPlaces(request, response) {
  try {
    const auth = await authenticatedProfile(request);
    if (!auth?.profile?.active) return sendJson(response, 401, { error: 'Entre no sistema para pesquisar leads.' });
  } catch (error) { return sendJson(response, 503, { error: error.message || 'Não foi possível validar seu acesso.' }); }
  const query = await readRequest(request);
  const scraperUrl = process.env.GOOGLE_MAPS_SCRAPER_URL?.trim();
  if (scraperUrl) {
    try {
      // Fast mode avoids Chromium and fits small instances. Full mode remains
      // available explicitly for hosts with enough memory.
      const fastMode = process.env.GOOGLE_MAPS_SCRAPER_MODE !== 'full';
      const location = fastMode ? await resolveMunicipality(query) : undefined;
      const { jobId } = await startGoogleMapsScraperJob(query, { baseUrl: scraperUrl, fastMode, location });
      return sendJson(response, 202, { jobId, status: 'processing', provider: 'google-maps-scraper', notice: 'Busca iniciada no Google Maps. Você pode acompanhar o resultado nesta tela.' });
    } catch (error) {
      return sendJson(response, 502, { error: error.message || 'Não foi possível iniciar o Google Maps Scraper.' });
    }
  }
  try { return sendJson(response, 200, await searchOpenStreetMap(query)); }
  catch (error) { return sendJson(response, 502, { error: error.message || 'Não foi possível consultar uma fonte pública agora.' }); }
}

async function getPlacesSearch(request, response, jobId) {
  try {
    const auth = await authenticatedProfile(request);
    if (!auth?.profile?.active) return sendJson(response, 401, { error: 'Entre no sistema para ver os resultados.' });
  } catch (error) { return sendJson(response, 503, { error: error.message || 'Não foi possível validar seu acesso.' }); }
  if (!process.env.GOOGLE_MAPS_SCRAPER_URL) return sendJson(response, 410, { error: 'A busca no serviço público expirou. Inicie uma nova consulta.' });
  const filters = Object.fromEntries(new URL(request.url, `http://${request.headers.host || 'localhost'}`).searchParams.entries());
  try {
    const job = await getGoogleMapsScraperJob(jobId, filters, { baseUrl: process.env.GOOGLE_MAPS_SCRAPER_URL.trim(), fastMode: process.env.GOOGLE_MAPS_SCRAPER_MODE !== 'full' });
    if (job.status === 'failed') return sendJson(response, 200, { ...job, results: [] });
    return sendJson(response, 200, job);
  } catch (error) {
    // A scraper instance on a free host can stall briefly while waking or
    // returning a job status. Keep the client polling the same ephemeral job
    // instead of turning one slow status request into a failed search.
    if (error.name === 'TimeoutError' || error.name === 'AbortError' || [429, 502, 503, 504].includes(error.status) || /aborted due to timeout|timed out|timeout/i.test(error.message)) {
      return sendJson(response, 200, { status: 'processing', provider: 'google-maps-scraper', notice: 'O serviço está demorando para responder; continuando a consulta.' });
    }
    if (error.status === 404) return sendJson(response, 410, { error: 'O Google Maps Scraper não encontrou essa busca temporária. Inicie uma nova consulta.' });
    return sendJson(response, 502, { error: error.message || 'Não foi possível consultar o andamento no scraper.' });
  }
}

async function authorizeTeam(request) {
  const auth = await authenticatedProfile(request);
  if (!auth?.profile?.active || !auth.profile.permissions?.includes('team')) return null;
  const config = supabaseAdminConfig();
  if (!config.url || !config.serviceRoleKey) throw new Error('Configure SUPABASE_SERVICE_ROLE_KEY no ambiente do site para cadastrar funcionários.');
  return { auth, config };
}
async function teamUsers(request, response) {
  try {
    const access = await authorizeTeam(request);
    if (!access) return sendJson(response, 403, { error: 'Seu cargo não tem permissão para visualizar os funcionários.' });
    const { config } = access;
    const [usersResponse, profilesResponse] = await Promise.all([
      fetch(`${config.url}/auth/v1/admin/users?per_page=1000`, { headers: adminHeaders(), signal: AbortSignal.timeout(8000) }),
      fetch(`${config.url}/rest/v1/profiles?select=id,full_name,phone,role_id,active,must_change_password`, { headers: { ...adminHeaders(), Accept: 'application/json' }, signal: AbortSignal.timeout(8000) }),
    ]);
    if (!usersResponse.ok || !profilesResponse.ok) throw new Error('Não foi possível carregar os funcionários.');
    const users = await usersResponse.json();
    const profiles = await profilesResponse.json();
    const profileMap = new Map(profiles.map(profile => [profile.id, profile]));
    return sendJson(response, 200, { users: (users.users || []).map(user => ({ id: user.id, email: user.email || '', ...profileMap.get(user.id), name: profileMap.get(user.id)?.full_name || user.user_metadata?.full_name || user.email || 'Usuário' })) });
  } catch (error) { return sendJson(response, error.message?.startsWith('Configure') ? 503 : 403, { error: error.message || 'Acesso negado.' }); }
}
async function createTeamUser(request, response) {
  try {
    const access = await authorizeTeam(request);
    if (!access) return sendJson(response, 403, { error: 'Seu cargo não tem permissão para cadastrar funcionários.' });
    const { config } = access;
    const body = await readRequest(request);
    const name = String(body.name || '').trim();
    const email = String(body.email || '').trim().toLowerCase();
    const phone = String(body.phone || '').trim();
    const roleId = String(body.roleId || '').trim();
    if (!name || !email || !/^\S+@\S+\.\S+$/.test(email) || !phone || !['sales', 'manager'].includes(roleId)) return sendJson(response, 400, { error: 'Informe nome, e-mail, telefone e um cargo válido.' });
    const createResponse = await fetch(`${config.url}/auth/v1/admin/users`, { method: 'POST', headers: adminHeaders(), body: JSON.stringify({ email, password: 'mudar123', email_confirm: true, user_metadata: { full_name: name, phone } }), signal: AbortSignal.timeout(8000) });
    const created = await createResponse.json().catch(() => ({}));
    if (!createResponse.ok) return sendJson(response, createResponse.status, { error: created.msg || created.message || 'Não foi possível criar o usuário.' });
    const profileResponse = await fetch(`${config.url}/rest/v1/profiles?id=eq.${encodeURIComponent(created.id)}`, { method: 'PATCH', headers: { ...adminHeaders(), Prefer: 'return=minimal' }, body: JSON.stringify({ full_name: name, phone, role_id: roleId, active: true, must_change_password: true }), signal: AbortSignal.timeout(8000) });
    if (!profileResponse.ok) { await fetch(`${config.url}/auth/v1/admin/users/${created.id}`, { method: 'DELETE', headers: adminHeaders() }); throw new Error('Usuário criado, mas o perfil não pôde ser configurado.'); }
    return sendJson(response, 201, { user: { id: created.id, email, name, full_name: name, phone, role_id: roleId, active: true, must_change_password: true } });
  } catch (error) { return sendJson(response, error.message?.startsWith('Configure') ? 503 : 500, { error: error.message || 'Não foi possível criar o funcionário.' }); }
}
async function updateTeamUser(request, response, userId) {
  try {
    const access = await authorizeTeam(request);
    if (!access) return sendJson(response, 403, { error: 'Seu cargo não tem permissão para atualizar funcionários.' });
    const { config } = access;
    const body = await readRequest(request);
    const roleId = String(body.roleId || '').trim();
    if (!['sales', 'manager'].includes(roleId)) return sendJson(response, 400, { error: 'Cargo inválido.' });
    const profileResponse = await fetch(`${config.url}/rest/v1/profiles?id=eq.${encodeURIComponent(userId)}`, { method: 'PATCH', headers: { ...adminHeaders(), Prefer: 'return=minimal' }, body: JSON.stringify({ role_id: roleId }), signal: AbortSignal.timeout(8000) });
    if (!profileResponse.ok) throw new Error('Não foi possível atualizar o cargo.');
    return sendJson(response, 200, { ok: true });
  } catch (error) { return sendJson(response, error.message?.startsWith('Configure') ? 503 : 500, { error: error.message || 'Não foi possível atualizar o funcionário.' }); }
}

const server = createServer(async (request, response) => { try { const requestUrl = new URL(request.url, `http://${request.headers.host || 'localhost'}`); if (requestUrl.pathname === '/api/auth/config' && request.method === 'GET') { const { url, publishableKey } = supabaseConfig(); return sendJson(response, 200, { configured: Boolean(url && publishableKey), url, publishableKey }); } if (requestUrl.pathname === '/api/auth/session' && request.method === 'GET') { try { const auth = await authenticatedProfile(request); if (!auth?.profile?.active) return sendJson(response, 401, { error: 'Acesso não autorizado.' }); return sendJson(response, 200, auth); } catch (error) { return sendJson(response, 503, { error: error.message || 'Falha ao validar a sessão.' }); } } if (requestUrl.pathname === '/api/team/users' && request.method === 'GET') return await teamUsers(request, response); if (requestUrl.pathname === '/api/team/users' && request.method === 'POST') return await createTeamUser(request, response); const teamUserMatch = requestUrl.pathname.match(/^\/api\/team\/users\/([\w-]+)$/); if (teamUserMatch && request.method === 'PATCH') return await updateTeamUser(request, response, teamUserMatch[1]); if (requestUrl.pathname === '/api/places-search' && request.method === 'POST') return await searchPlaces(request, response); const searchMatch = requestUrl.pathname.match(/^\/api\/places-search\/([\w-]+)$/); if (searchMatch && request.method === 'GET') return await getPlacesSearch(request, response, searchMatch[1]); if (requestUrl.pathname === '/api/health') return sendJson(response, 200, { ok: true, placesProvider: process.env.GOOGLE_MAPS_SCRAPER_URL ? 'Google Maps Scraper' : 'OpenStreetMap ao vivo', mapsScraperConfigured: Boolean(process.env.GOOGLE_MAPS_SCRAPER_URL), authConfigured: Boolean(supabaseConfig().url && supabaseConfig().publishableKey), teamAdminConfigured: Boolean(supabaseAdminConfig().serviceRoleKey) }); const pathname = requestUrl.pathname === '/' ? '/index.html' : requestUrl.pathname; const safePath = normalize(join(root, pathname)); if (!safePath.startsWith(root)) return sendJson(response, 403, { error: 'Forbidden' }); const contents = await readFile(safePath); response.writeHead(200, { 'Content-Type': mimeTypes[extname(safePath)] || 'application/octet-stream' }); response.end(contents); } catch (error) { if (error.code === 'ENOENT') return sendJson(response, 404, { error: 'Not found' }); sendJson(response, 500, { error: 'Internal server error' }); } });
server.listen(port, () => console.log(`Despverdi Gestão em http://localhost:${port}`));
