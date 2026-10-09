import test from 'node:test';
import assert from 'node:assert/strict';
import { buildMapsKeyword, getGoogleMapsScraperJob, mapGoogleMapsPlace, searchGoogleMapsScraper } from '../google-maps-scraper.mjs';

test('monta consulta Maps com nicho, cidade, estado e região', () => {
  assert.equal(buildMapsKeyword({ segment: 'Loja de roupas', city: 'Pouso Redondo', state: 'sc', region: 'Alto Vale' }), 'Loja de roupas em Pouso Redondo, SC - Alto Vale');
});

test('converte os campos publicados em um resultado de prospecção', () => {
  const place = mapGoogleMapsPlace({ title: 'Loja Verdi', category: 'Clothing store', complete_address: 'Centro, Pouso Redondo', website: 'https://exemplo.com', phone: '+55 47 99999-0000', review_rating: 4.8, review_count: 42, link: 'https://maps.google.com/?cid=123' }, { city: 'Pouso Redondo', state: 'SC' });
  assert.deepEqual({ name: place.name, type: place.type, city: place.city, address: place.address, site: place.site, rating: place.rating, reviews: place.reviews, sourceUrl: place.sourceUrl }, {
    name: 'Loja Verdi', type: 'Clothing store', city: 'Pouso Redondo - SC', address: 'Centro, Pouso Redondo', site: 'https://exemplo.com', rating: '4.8', reviews: '42', sourceUrl: 'https://maps.google.com/?cid=123',
  });
});

test('transforma o endereço JSON do Google Maps em endereço legível', () => {
  const place = mapGoogleMapsPlace({ title: 'Oficina do Vale', complete_address: '{"borough":"Centro","street":"Rua das Flores, 10","city":"Pouso Redondo","postal_code":"89172-000","state":"Santa Catarina","country":"BR"}' });
  assert.equal(place.address, 'Rua das Flores, 10, Centro, Pouso Redondo, Santa Catarina, 89172-000');
});

test('submete e acompanha um job do scraper e converte o CSV em leads', async () => {
  const calls = [];
  const payloads = [
    { ID: 'job-123' },
    { Status: 'pending' },
    { Status: 'ok' },
  ];
  const fetchImpl = async (url, options = {}) => {
    calls.push({ url, options });
    if (url.endsWith('/download')) {
      return { ok: true, status: 200, text: async () => 'title,category,complete_address,phone,website,review_rating,review_count,link\n"Mecânica Central","Auto repair shop","Centro, Pouso Redondo","4733330000","https://oficina.example",4.7,12,"https://maps.google.com/place/central"\n' };
    }
    const payload = payloads.shift();
    return { ok: true, status: 200, text: async () => JSON.stringify(payload) };
  };
  const result = await searchGoogleMapsScraper({ segment: 'Mecânico', city: 'Pouso Redondo', state: 'SC' }, {
    baseUrl: 'http://127.0.0.1:8080/', fetchImpl, sleep: async () => {}, pollIntervalMs: 0,
  });
  assert.equal(calls[0].url, 'http://127.0.0.1:8080/api/v1/jobs');
  assert.equal(JSON.parse(calls[0].options.body).keywords[0], 'Mecânico em Pouso Redondo, SC');
  assert.equal(calls[1].url, 'http://127.0.0.1:8080/api/v1/jobs/job-123');
  assert.equal(calls[3].url, 'http://127.0.0.1:8080/api/v1/jobs/job-123/download');
  assert.equal(result.provider, 'google-maps-scraper');
  assert.equal(result.results[0].name, 'Mecânica Central');
  assert.equal(result.results[0].reviews, '12');
  assert.equal(result.results[0].site, 'https://oficina.example');
});

test('consulta o job remoto diretamente em cada chamada, sem depender de memória do servidor web', async () => {
  let status = 'running';
  const calls = [];
  const fetchImpl = async url => {
    calls.push(url);
    if (url.endsWith('/download')) return { ok: true, status: 200, text: async () => 'title,category,complete_address,phone,website,review_rating,review_count,link\n"Mercado Central","Supermarket","Centro, Ituporanga","4733330000","",4.6,20,"https://maps.google.com/place/central"\n' };
    return { ok: true, status: 200, text: async () => JSON.stringify({ Status: status === 'running' ? 'pending' : 'ok' }) };
  };

  const pending = await getGoogleMapsScraperJob('remote-456', { city: 'Ituporanga', state: 'SC' }, { baseUrl: 'https://scraper.example', fetchImpl });
  assert.equal(pending.status, 'processing');
  status = 'done';
  const completed = await getGoogleMapsScraperJob('remote-456', { city: 'Ituporanga', state: 'SC' }, { baseUrl: 'https://scraper.example', fetchImpl });
  assert.equal(completed.status, 'completed');
  assert.equal(completed.results[0].name, 'Mercado Central');
  assert.equal(completed.results[0].city, 'Ituporanga - SC');
  assert.equal(calls.filter(url => url.endsWith('/api/v1/jobs/remote-456')).length, 2);
});

test('explica configuração ausente em vez de inventar resultados', async () => {
  await assert.rejects(() => searchGoogleMapsScraper({ city: 'Pouso Redondo' }, { baseUrl: '', apiKey: '' }), /não configurado/i);
});
