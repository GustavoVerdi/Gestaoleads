import test from 'node:test';
import assert from 'node:assert/strict';
import { buildNicheSelectors, matchesNiche, nicheTerms } from '../prospecting-search.mjs';

test('material de construção encontra tags de lojas de material', () => {
  assert.match(nicheTerms('Material de construção'), /hardware/);
  assert.match(buildNicheSelectors('Materiais de construção'), /building_materials/);
  assert.equal(matchesNiche({ name: 'Depósito Central', shop: 'hardware' }, 'Material de construção'), true);
  assert.equal(matchesNiche({ shop: 'building_materials' }, 'material de contrução'), true);
});

test('loja de roupas encontra lojas mapeadas como clothes ou boutique', () => {
  assert.equal(matchesNiche({ name: 'Moda Sul', shop: 'clothes' }, 'Loja de roupas'), true);
  assert.equal(matchesNiche({ shop: 'boutique' }, 'Roupas'), true);
  assert.match(buildNicheSelectors('Loja de roupas'), /clothes\|fashion\|boutique/);
});

test('mecânico encontra oficinas mapeadas como car_repair', () => {
  assert.equal(matchesNiche({ name: 'Auto Center', shop: 'car_repair' }, 'Mecânico'), true);
  assert.equal(matchesNiche({ craft: 'car_repair' }, 'Mecânica automotiva'), true);
  assert.match(buildNicheSelectors('Mecânico'), /car_repair/);
});

test('pesquisas sem nicho incluem todas as categorias comerciais mapeadas', () => {
  const selectors = buildNicheSelectors('');
  assert.match(selectors, /\["shop"\]/);
  assert.match(selectors, /\["trade"\]/);
});

test('segmento não relacionado não aceita empresa de outro nicho', () => {
  assert.equal(matchesNiche({ name: 'Auto Center', shop: 'car_repair' }, 'Floricultura'), false);
});
