import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
const messages = await readFile(new URL('../lead-messages.js', import.meta.url), 'utf8');
const workspace = await readFile(new URL('../lead-workspace.js', import.meta.url), 'utf8');
const app = await readFile(new URL('../app.js', import.meta.url), 'utf8');
test('renderização ativa os controles da aba leads', () => {
  const renderSource = app.slice(app.indexOf('function render()'), app.indexOf('function decorateProspectActions()'));
  assert.match(renderSource, /bindLeadWorkspace\(\)/);
});

test('trocar tipo atualiza o texto e preserva rascunhos por tipo e canal', () => {
  const c = setup();
  const controls = new Map();
  const control = id => {
    if (!controls.has(id)) controls.set(id, { listeners: {}, addEventListener(event, fn) { this.listeners[event] = fn; }, focus() {} });
    return controls.get(id);
  };
  c.$ = control;
  c.$$ = () => [];
  c.state.view = 'leads';
  c.state.activeLeadId = '1';
  c.state.leads = [{ id: '1', company: 'Auto Teste', segment: 'Loja de carros' }];
  let html = '';
  c.render = () => { html = c.leadWorkspaceDetail(c.state.leads[0]); c.bindLeadWorkspace(); };
  c.render();
  const change = (id, value, event = 'change') => control(id).listeners[event]({ target: { value } });
  change('#outreach-message', 'Minha abordagem personalizada', 'input');
  change('#outreach-template', 'solution');
  assert.match(html, /catálogo do estoque/);
  assert.ok(!html.includes('Minha abordagem personalizada'));
  change('#outreach-message', 'Oferta personalizada', 'input');
  change('#outreach-template', 'connect');
  assert.ok(html.includes('Minha abordagem personalizada'));
  change('#outreach-channel', 'call');
  assert.match(html, /bom momento/);
  assert.ok(!html.includes('Minha abordagem personalizada'));
  change('#outreach-channel', 'whatsapp');
  assert.ok(html.includes('Minha abordagem personalizada'));
  change('#outreach-template', 'solution');
  assert.ok(html.includes('Oferta personalizada'));
});
function setup() {
  const context=vm.createContext({window:{verdiAuth:{user:{id:'sales-1',email:'vendedor@example.com'},profile:{full_name:'Vendedor teste'}}}, state:{leads:[],search:'',activeLeadId:null},escapeHtml:value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])),hasPermission:()=>true,saveLeads:()=>{},toast:()=>{}});
  vm.runInContext(messages+'\n'+workspace,context);return context;
}
test('modelos de conexão não vendem nem inventam observações',()=>{const c=setup();for(const segment of ['Loja de carros','Roupas','Mecânico','Material de construção','Restaurante','Clínica','Mercado','Outro']){const list=c.VerdiMessages.templates({company:'Loja teste',segment});assert.equal(list.length,7);assert.ok(list[0].text.includes('[elogio sincero]'));assert.ok(!/https?:|R\$|faço sites|proposta/i.test(list[0].text));assert.equal((list[0].text.match(/\?/g)||[]).length,1);assert.ok(c.VerdiMessages.validate(list[0].text,'connect'));}});
test('modelos respeitam contexto, nicho e canal',()=>{const c=setup();const lead={company:'Auto Teste',segment:'Loja de carros',outreach:{compliment:'Gostei das fotos',detail:'imagens do interior dos veículos',reply:'os clientes perguntam pelo estoque'}};const list=c.VerdiMessages.templates(lead);assert.equal(c.VerdiMessages.validate(list[0].text,'connect'),'');assert.match(list[1].text,/os clientes perguntam pelo estoque/);assert.match(list[3].text,/catálogo do estoque/);assert.match(c.VerdiMessages.templates(lead,'call')[0].text,/bom momento/);assert.ok(c.VerdiMessages.validate(list[0].text+' https://exemplo.com','connect'));assert.equal(c.VerdiMessages.niche({segment:'Oficina de veículos'}),'mechanic');});
test('excluir e restaurar preserva todos os dados e autor',()=>{const c=setup();const lead={id:'1',company:'Teste',createdBy:'sales-1',outreach:{reply:'contexto'}};const deleted=c.VerdiMessages.archive([lead],'1',true,'2026-10-12');assert.equal(deleted[0].deletedAt,'2026-10-12');assert.equal(lead.deletedAt,undefined);const restored=c.VerdiMessages.archive(deleted,'1',false);assert.equal(restored[0].createdBy,'sales-1');assert.equal(restored[0].outreach.reply,'contexto');assert.equal(restored[0].deletedAt,null);});
test('autoria usa usuário conectado e não atribui registros antigos',()=>{const c=setup();assert.equal(c.leadAuthor().createdBy,'sales-1');assert.equal(c.leadAuthor().createdByName,'Vendedor teste');assert.equal(c.leadAuthorLabel({company:'Antigo'}),'Autor não registrado');c.window.verdiAuth=null;assert.equal(c.leadAuthor().createdBy,null);});
test('lixeira oculta registros ativos e filtros incluem autor',()=>{const c=setup();c.state.leads=[{id:'1',company:'Loja ativa',createdBy:'sales-1',createdByName:'Ana',createdAt:'2026-10-12T10:00:00Z'},{id:'2',company:'Loja excluída',deletedAt:'2026-10-12'}];let html=c.leadWorkspaceView();assert.ok(html.includes('Loja ativa'));assert.ok(!html.includes('<h2>Loja excluída'));c.state.search='Ana';assert.ok(c.leadWorkspaceView().includes('<h2>Loja ativa'));vm.runInContext('leadWorkspaceState.trash=true;state.search="";',c);html=c.leadWorkspaceView();assert.ok(html.includes('<h2>Loja excluída'));assert.ok(!html.includes('<h2>Loja ativa'));assert.ok(html.includes('Restaurar lead'));});
test('erro de armazenamento reverte alteração e permissão bloqueia edição',()=>{const c=setup();c.state.leads=[{id:'1',company:'Antes'}];c.saveLeads=()=>{throw Error('quota');};assert.equal(c.leadWorkspaceSave('1',{company:'Depois'}),false);assert.equal(c.state.leads[0].company,'Antes');c.hasPermission=()=>false;assert.equal(c.leadWorkspaceSave('1',{deletedAt:'hoje'}),false);assert.equal(c.state.leads[0].deletedAt,undefined);});
test('HTML escapa dados do lead e preserva rascunhos por canal',()=>{const c=setup();const lead={id:'1',company:'<script>teste</script>',outreach:{channel:'instagram',template:'followup',drafts:{'instagram:followup':'Meu rascunho <seguro>'}}};const html=c.leadWorkspaceDetail(lead);assert.ok(!html.includes('<script>teste'));assert.ok(html.includes('Meu rascunho &lt;seguro&gt;'));assert.ok(html.includes('Abrir Instagram'));});
