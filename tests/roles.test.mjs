import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');
const definitions = source.slice(source.indexOf('const rolePermissions ='), source.indexOf('const defaultEmployees ='));
const roles = vm.runInNewContext(`${definitions}\nJSON.parse(JSON.stringify(defaultRoles));`);

test('catálogo contém CEO, Vendedor e Gerente, sem Dono', () => {
  assert.deepEqual(Array.from(roles, role => role.name).sort(), ['CEO', 'Gerente', 'Vendedor']);
});

test('CEO preserva identidade administrativa e todas as permissões', () => {
  const ceo = roles.find(role => role.name === 'CEO');
  assert.equal(ceo.id, 'role-owner');
  assert.equal(ceo.protected, true);
  assert.ok(ceo.permissions.includes('team'));
  assert.ok(ceo.permissions.includes('sensitive'));
});

test('Gerente edita projetos e Vendedor trabalha leads, sem acesso confidencial padrão', () => {
  const manager = roles.find(role => role.name === 'Gerente');
  const sales = roles.find(role => role.name === 'Vendedor');
  assert.ok(manager.permissions.includes('project-edit'));
  assert.ok(!sales.permissions.includes('project-edit'));
  for (const role of [manager, sales]) {
    assert.ok(role.permissions.includes('leads'));
    assert.ok(role.permissions.includes('projects'));
    assert.ok(!role.permissions.includes('sensitive'));
    assert.ok(!role.permissions.includes('team'));
  }
});

test('navegar para Projetos limpa o painel de projeto anterior', () => {
  const navigate = source.slice(source.indexOf('function navigate(view)'), source.indexOf('function openModal'));
  assert.match(navigate, /if \(view === 'projects'\)/);
  assert.match(navigate, /state\.activeProjectId = null/);
  assert.match(navigate, /state\.projectFormOpen = false/);
  assert.match(navigate, /state\.editingProjectId = null/);
});
