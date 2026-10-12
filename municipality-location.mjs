const IBGE_ROOT = 'https://servicodados.ibge.gov.br/api';
const STATES = new Set('AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO'.split(' '));
const normalizeName = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[-’']/g, ' ').replace(/\s+/g, ' ').trim();

export function locationFromGeometry(geo) {
  let west = Infinity, east = -Infinity, south = Infinity, north = -Infinity;
  function visit(value) {
    if (!Array.isArray(value)) return;
    if (value.length >= 2 && typeof value[0] === 'number' && typeof value[1] === 'number') {
      const [lon, lat] = value;
      if (!Number.isFinite(lon) || !Number.isFinite(lat) || Math.abs(lon) > 180 || Math.abs(lat) > 90) return;
      west = Math.min(west, lon); east = Math.max(east, lon);
      south = Math.min(south, lat); north = Math.max(north, lat);
    } else value.forEach(visit);
  }
  for (const feature of geo.features || []) visit(feature.geometry?.coordinates);
  if (![west, east, south, north].every(Number.isFinite)) throw new Error('O IBGE não retornou a área deste município.');
  const lat = (south + north) / 2, lon = (west + east) / 2;
  // Cover the municipality's bounding box, with a small margin. The search
  // keyword still names the requested city; this circle is not its boundary.
  const radius = Math.max(20000, Math.ceil(Math.hypot((north - south) * 111320 / 2, (east - west) * 111320 / 2) * 1.1));
  return { lat: String(lat), lon: String(lon), radius };
}

export function createMunicipalityResolver({ fetchImpl = fetch, now = Date.now } = {}) {
  const cache = new Map();
  async function cached(key, action) {
    const existing = cache.get(key);
    if (existing && existing.expires > now()) return existing.promise;
    const entry = { expires: now() + 86400000, promise: Promise.resolve().then(action) };
    cache.set(key, entry);
    if (cache.size > 200) cache.delete(cache.keys().next().value);
    try { return await entry.promise; }
    catch (error) { if (cache.get(key) === entry) cache.delete(key); throw error; }
  }
  async function getJson(path) {
    try {
      const response = await fetchImpl(`${IBGE_ROOT}${path}`, { signal: AbortSignal.timeout(12000) });
      if (!response.ok) throw new Error(`status ${response.status}`);
      return await response.json();
    } catch {
      throw new Error('Não foi possível localizar a cidade no IBGE agora. Tente novamente em instantes.');
    }
  }
  return async ({ city, state }) => {
    const uf = String(state || '').trim().toUpperCase();
    if (!STATES.has(uf) || !normalizeName(city)) throw new Error('Informe a cidade e a sigla do estado, por exemplo: Pouso Redondo e SC.');
    const cities = await cached(`state:${uf}`, () => getJson(`/v1/localidades/estados/${uf}/municipios`));
    const match = cities.find(item => normalizeName(item.nome) === normalizeName(city));
    if (!match) throw new Error(`Cidade não encontrada em ${uf}. Confira o nome completo do município e o estado.`);
    if (!/^\d{7}$/.test(String(match.id))) throw new Error('O IBGE retornou um município inválido.');
    return cached(`city:${match.id}`, async () => locationFromGeometry(await getJson(`/v3/malhas/municipios/${match.id}?formato=application/vnd.geo+json&qualidade=minima`)));
  };
}

export const resolveMunicipality = createMunicipalityResolver();
