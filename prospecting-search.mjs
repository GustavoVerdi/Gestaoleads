export const BUSINESS_TAG_KEYS = ['shop', 'amenity', 'office', 'craft', 'healthcare', 'tourism', 'leisure', 'industrial', 'club', 'sport', 'trade'];

const NICHE_ALIASES = {
  mercado: 'supermarket|convenience|marketplace|greengrocer|department_store',
  supermercado: 'supermarket|convenience|marketplace|greengrocer|department_store',
  mercearia: 'supermarket|convenience|marketplace|greengrocer',
  restaurante: 'restaurant|fast_food|food_court', comida: 'restaurant|fast_food|food_court|cafe',
  lanchonete: 'fast_food|cafe', pizzaria: 'restaurant|fast_food', padaria: 'bakery', acougue: 'butcher',
  barbearia: 'hairdresser|beauty', salao: 'hairdresser|beauty', cabelereiro: 'hairdresser|beauty', cabeleireiro: 'hairdresser|beauty',
  clinica: 'clinic|dentist|doctors|healthcare', odontologia: 'dentist|clinic', dentista: 'dentist', medico: 'doctors|clinic',
  roupa: 'clothes|fashion|boutique', roupas: 'clothes|fashion|boutique', vestuario: 'clothes|fashion|boutique', moda: 'clothes|fashion|boutique',
  'loja de roupa': 'clothes|fashion|boutique', 'loja de roupas': 'clothes|fashion|boutique',
  veiculo: 'car|car_repair|motorcycle', carro: 'car|car_repair', oficina: 'car_repair|craft',
  mecanico: 'car_repair|car_parts|tyres|car', mecanica: 'car_repair|car_parts|tyres|car',
  'mecanico automotivo': 'car_repair|car_parts|tyres|car', 'mecanica automotiva': 'car_repair|car_parts|tyres|car', 'oficina mecanica': 'car_repair|car_parts|tyres|car',
  'material de construcao': 'hardware|doityourself|building_materials',
  'materiais de construcao': 'hardware|doityourself|building_materials',
  'material de contrucao': 'hardware|doityourself|building_materials',
  'materiais de contrucao': 'hardware|doityourself|building_materials',
  'loja de material de construcao': 'hardware|doityourself|building_materials',
  farmacia: 'pharmacy', hotel: 'hotel|guest_house|hostel', pousada: 'guest_house|hostel|hotel',
  academia: 'fitness_centre|sports_centre', pet: 'pet|veterinary', veterinaria: 'veterinary',
  imobiliaria: 'estate_agent', advogado: 'lawyer', advocacia: 'lawyer', contabilidade: 'accountant', contador: 'accountant',
  construtora: 'construction', escola: 'school|college', floricultura: 'florist', papelaria: 'stationery',
  posto: 'fuel', posto_de_gasolina: 'fuel', transporte: 'taxi|bus_station|car_rental', eletricista: 'electrician',
  encanador: 'plumber', fisioterapia: 'physiotherapist|clinic', fotografia: 'photographer', hotelaria: 'hotel|guest_house|hostel',
};

export function normalizeText(value) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim().replace(/\s+/g, ' ');
}

export function normalizeNiche(value) {
  const normalized = normalizeText(value);
  return normalized.endsWith('s') ? normalized.slice(0, -1) : normalized;
}

export function escapeRegex(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function nicheTerms(segment) {
  const niche = normalizeNiche(segment);
  return NICHE_ALIASES[niche] || (niche ? escapeRegex(segment) : '');
}

export function matchesNiche(tags = {}, segment = '') {
  const needle = normalizeNiche(segment);
  if (!needle) return true;
  const values = [tags.name, tags.brand, tags.description, ...BUSINESS_TAG_KEYS.map(key => tags[key])]
    .map(normalizeText).filter(Boolean);
  const aliases = nicheTerms(segment).split('|').filter(Boolean);
  if (aliases.some(alias => values.some(value => value.includes(alias)))) return true;
  const tokens = needle.split(/\s+/).filter(token => token.length > 2);
  return values.some(value => value.includes(needle) || (tokens.length > 0 && tokens.every(token => value.includes(token))));
}

export function buildNicheSelectors(segment) {
  const terms = nicheTerms(segment);
  const tagSearches = BUSINESS_TAG_KEYS.map(key =>
    `nwr["name"]["${key}"${terms ? `~"${terms}",i` : ''}](area.searchArea);`
  ).join('');
  const nameSearch = terms ? `nwr["name"~"${escapeRegex(segment)}",i](area.searchArea);` : '';
  return `${tagSearches}${nameSearch}`;
}
