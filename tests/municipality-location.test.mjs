import test from 'node:test';
import assert from 'node:assert/strict';
import { createMunicipalityResolver, locationFromGeometry } from '../municipality-location.mjs';

const geometry = { features: [{ geometry: { type: 'Polygon', coordinates: [[[-50.13, -27.41], [-49.82, -27.19], [-50.13, -27.41]]] } }] };

test('calcula coordenadas e raio a partir da malha real, incluindo multipolígonos', () => {
  const location = locationFromGeometry(geometry);
  assert.ok(Number(location.lat) < -27 && Number(location.lon) < -49);
  assert.ok(location.radius >= 20000);
  const multi = { features: [{ geometry: { coordinates: [geometry.features[0].geometry.coordinates] } }] };
  assert.deepEqual(locationFromGeometry(multi), location);
  assert.throws(() => locationFromGeometry({ features: [] }), /área/);
});

test('resolve cidade e UF sem acentos e compartilha cache, sem guardar empresas', async () => {
  const calls = [];
  const resolve = createMunicipalityResolver({ fetchImpl: async url => {
    calls.push(url);
    return { ok: true, json: async () => url.includes('/localidades/') ? [{ id: 4203204, nome: 'Camboriú' }] : geometry };
  } });
  const [first, second] = await Promise.all([resolve({ city: ' Camboriu ', state: 'sc' }), resolve({ city: 'Camboriú', state: 'SC' })]);
  assert.deepEqual(first, second);
  assert.equal(calls.length, 2);
  assert.match(calls[0], /estados\/SC\/municipios/);
  assert.match(calls[1], /municipios\/4203204\?/);
  await assert.rejects(resolve({ city: 'Cidade inexistente', state: 'SC' }), /Cidade não encontrada/);
  await assert.rejects(resolve({ city: 'Camboriú', state: '' }), /sigla do estado/);
});

test('falha de localização não fica presa no cache e pode ser tentada novamente', async () => {
  let failed = true;
  const resolve = createMunicipalityResolver({ fetchImpl: async url => {
    if (failed) throw new DOMException('The operation was aborted due to timeout', 'TimeoutError');
    return { ok: true, json: async () => url.includes('/localidades/') ? [{ id: 4213708, nome: 'Pouso Redondo' }] : geometry };
  } });
  await assert.rejects(resolve({ city: 'Pouso Redondo', state: 'SC' }), /localizar a cidade no IBGE/);
  failed = false;
  assert.ok((await resolve({ city: 'Pouso Redondo', state: 'SC' })).radius > 0);
});
