const leadWorkspaceState = { trash: false, status: '', niche: '', author: '', drafts: new Map() };
function leadAuthor() {
  const auth = window.verdiAuth;
  return auth?.user?.id ? { createdBy: auth.user.id, createdByName: auth.profile?.full_name || auth.user.email || 'Usuário', createdByEmail: auth.user.email || '' } : { createdBy: null, createdByName: 'Autor não registrado' };
}
function leadDate(value) { const date = new Date(value); return value && !Number.isNaN(date.getTime()) ? date.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : 'Data não registrada'; }
function leadAuthorLabel(lead) { return lead.createdByName || lead.createdByEmail || 'Autor não registrado'; }
function leadWorkspaceSave(id, changes) {
  if (!hasPermission('leads')) { toast('Seu cargo não tem acesso a leads.'); return false; }
  const previous = state.leads;
  state.leads = state.leads.map(lead => lead.id === id ? { ...lead, ...changes } : lead);
  try { saveLeads(); return true; } catch { state.leads = previous; toast('Não foi possível salvar. Seus dados anteriores foram mantidos.'); return false; }
}
function leadWorkspaceView() {
  const e = escapeHtml;
  const active = state.leads.find(lead => lead.id === state.activeLeadId && !lead.deletedAt);
  if (active) return leadWorkspaceDetail(active);
  const live = state.leads.filter(lead => !lead.deletedAt);
  const deleted = state.leads.filter(lead => lead.deletedAt);
  const source = leadWorkspaceState.trash ? deleted : live;
  const query = state.search.trim().toLocaleLowerCase('pt-BR');
  const filtered = source.filter(lead => `${lead.company} ${lead.segment} ${lead.city} ${lead.whatsapp} ${leadAuthorLabel(lead)}`.toLocaleLowerCase('pt-BR').includes(query) && (!leadWorkspaceState.status || lead.stage === leadWorkspaceState.status) && (!leadWorkspaceState.niche || lead.segment === leadWorkspaceState.niche) && (!leadWorkspaceState.author || (lead.createdBy || 'unknown') === leadWorkspaceState.author));
  const options = (values, selected) => values.map(value => `<option value="${e(value)}" ${value === selected ? 'selected' : ''}>${e(value)}</option>`).join('');
  const authors = [...new Map(state.leads.map(lead => [lead.createdBy || 'unknown', leadAuthorLabel(lead)])).entries()];
  return `<div class="page-heading"><div><p class="eyebrow">Relacionamento antes da venda</p><h1>Leads</h1><p>Conheça o negócio. Converse com contexto. Avance no ritmo do cliente.</p></div><div class="heading-actions"><button class="button ghost" data-view-link="prospect">Buscar empresas ↗</button><button class="button primary" data-action="new-lead">＋ Novo lead</button></div></div>
    <div class="outreach-summary"><div><strong>${live.length}</strong><span>Leads ativos</span></div><div><strong>${live.filter(l => ['Novo','Novo lead'].includes(l.stage)).length}</strong><span>Para conhecer</span></div><div><strong>${live.filter(l => ['Contatado','Respondeu','Interessado'].includes(l.stage)).length}</strong><span>Em conversa</span></div><div><strong>${live.filter(l => l.stage === 'Cliente').length}</strong><span>Clientes</span></div></div>
    <p class="lead-storage-note">Registros deste navegador. A autoria é registrada pela conta conectada; esta lista ainda não é compartilhada entre dispositivos.</p>
    ${state.leadFormOpen ? `<section class="project-form-panel"><h2>Novo lead</h2><form id="manual-lead-form" class="admin-form"><div class="lead-form-fields"><label>Nome da loja<input name="company" required maxlength="100"></label><label>WhatsApp<input name="whatsapp" type="tel" required placeholder="DDD + número"></label><label>Nicho<input name="segment" required placeholder="Ex.: Loja de carros"></label><label>Cidade<input name="city" maxlength="100"></label></div><p class="lead-storage-note">Cadastrado por: ${e(leadAuthor().createdByName)}</p><div class="admin-form-actions"><button type="button" class="button ghost" data-action="cancel-lead">Cancelar</button><button class="button primary" type="submit">Salvar lead</button></div></form></section>` : ''}
    <div class="outreach-tabs" aria-label="Lista de leads"><button class="button ${!leadWorkspaceState.trash ? 'primary' : 'ghost'}" data-lead-list="active" aria-pressed="${!leadWorkspaceState.trash}">Ativos · ${live.length}</button><button class="button ${leadWorkspaceState.trash ? 'primary' : 'ghost'}" data-lead-list="trash" aria-pressed="${leadWorkspaceState.trash}">Lixeira · ${deleted.length}</button></div>
    <div class="outreach-filters"><label>Buscar<input id="workspace-lead-search" type="search" value="${e(state.search)}" placeholder="Loja, nicho, cidade ou autor"></label><label>Status<select data-lead-filter="status"><option value="">Todos</option>${options([...new Set(source.map(l=>l.stage || 'Novo'))], leadWorkspaceState.status)}</select></label><label>Nicho<select data-lead-filter="niche"><option value="">Todos</option>${options([...new Set(source.map(l=>l.segment || 'Empresa'))], leadWorkspaceState.niche)}</select></label><label>Cadastrado por<select data-lead-filter="author"><option value="">Todos</option>${authors.map(([id,name])=>`<option value="${e(id)}" ${id === leadWorkspaceState.author ? 'selected' : ''}>${e(name)}</option>`).join('')}</select></label></div>
    <p class="lead-storage-note" role="status">${filtered.length} lead(s) nesta seleção${leadWorkspaceState.trash ? ' · Excluídos podem ser restaurados a qualquer momento.' : ''}</p>
    <div class="lead-list-grid">${filtered.map(lead=>`<article class="lead-list-card"><div class="lead-list-card-top"><span class="lead-card-icon">${e((lead.company || 'L').slice(0,1))}</span><span class="lead-status-badge">${e(lead.stage || 'Novo')}</span></div><h2>${e(lead.company)}</h2><p class="lead-card-segment">${e(lead.segment || 'Nicho não informado')}</p><div class="lead-list-meta"><span>${e(lead.city || 'Cidade não informada')}</span><span>${e(lead.whatsapp || 'Sem WhatsApp')}</span></div><div class="lead-attribution"><span>Cadastrado por</span><strong>${e(leadAuthorLabel(lead))}</strong><small>${e(leadDate(lead.createdAt))}</small></div><div class="outreach-card-actions">${leadWorkspaceState.trash ? `<button class="button ghost" data-lead-restore="${e(lead.id)}">Restaurar lead</button>` : `<button class="button ghost" data-action="open-lead-details" data-id="${e(lead.id)}">Conversar ↗</button><button class="button ghost danger-text" data-lead-delete="${e(lead.id)}" aria-label="Excluir lead ${e(lead.company)}">Excluir</button>`}</div></article>`).join('')}</div>
    ${!filtered.length ? `<div class="lead-empty"><h2>${leadWorkspaceState.trash ? 'Lixeira vazia nesta seleção' : 'Nenhum lead nesta seleção'}</h2><p>${source.length ? 'Ajuste a busca ou os filtros para encontrar seus leads.' : leadWorkspaceState.trash ? 'Os leads excluídos aparecerão aqui para recuperação.' : 'Cadastre uma loja ou busque empresas para começar.'}</p><button class="button ghost" data-lead-clear-filters>Limpar filtros</button></div>` : ''}`;
}
function leadWorkspaceDetail(lead) {
  const e = escapeHtml;
  const saved = lead.outreach || {};
  const channel = saved.channel || 'whatsapp';
  const templates = VerdiMessages.templates(lead, channel);
  const template = templates.find(item=>item.id === saved.template) || templates[0];
  const message = saved.drafts?.[`${channel}:${template.id}`] ?? template.text;
  const statuses = ['Novo','Contatado','Respondeu','Interessado','Sem interesse','Cliente'];
  return `<div class="page-heading"><div><button class="button ghost" data-action="back-leads">← Todos os leads</button><p class="eyebrow">Uma conversa de cada vez</p><h1>${e(lead.company)}</h1><p>${e(lead.segment || 'Defina o nicho')} · ${e(lead.city || 'Cidade não informada')}</p></div><button class="button ghost danger-text" data-lead-delete="${e(lead.id)}">Excluir lead</button></div>
    <div class="lead-detail-grid"><section class="lead-contact-card"><p class="eyebrow">Dados e contexto</p><div class="lead-attribution"><span>Cadastrado por</span><strong>${e(leadAuthorLabel(lead))}</strong><small>${e(leadDate(lead.createdAt))}</small></div><p>${e(lead.whatsapp || 'Sem WhatsApp')}</p><p class="lead-storage-note">${e(lead.address || lead.city || '')}</p>
    <label class="lead-template-label">Status<select id="lead-status" data-id="${e(lead.id)}">${statuses.map(s=>`<option ${s === lead.stage ? 'selected' : ''}>${e(s)}</option>`).join('')}</select></label>
    <form id="outreach-context" class="outreach-context"><label>Nicho da loja<input name="segment" value="${e(lead.segment || '')}" maxlength="100" required></label><label>Elogio sincero<input name="compliment" value="${e(saved.compliment || '')}" maxlength="140" placeholder="Ex.: Gostei da clareza das fotos"></label><label>Detalhe que você observou<input name="detail" value="${e(saved.detail || '')}" maxlength="180" placeholder="Ex.: fotos do interior de cada carro"></label><label>O que o cliente contou<textarea name="reply" rows="3" maxlength="600" placeholder="O que vende, de onde vêm os clientes, como atende…">${e(saved.reply || '')}</textarea></label><label>Instagram da loja<input name="instagram" value="${e(saved.instagram || '')}" placeholder="@nomedaloja" maxlength="30"></label><button type="submit" class="button ghost">Salvar contexto</button><p class="lead-storage-note">Use só observações verdadeiras. Salvar não substitui uma mensagem que você já editou.</p></form></section>
    <section class="lead-composer"><div class="lead-composer-heading"><div><p class="eyebrow">Conexão antes da oferta</p><h2>Prepare a conversa</h2><p>Pergunta → escuta → comentário → próxima pergunta. Os modelos são um ponto de partida, não um texto para repetir sem ouvir.</p></div><span class="lead-niche-chip">${e(lead.segment || 'Geral')}</span></div>
    <div class="outreach-channel-row"><label class="lead-template-label">Canal<select id="outreach-channel"><option value="whatsapp" ${channel==='whatsapp'?'selected':''}>1 · WhatsApp</option><option value="instagram" ${channel==='instagram'?'selected':''}>2 · Instagram DM</option><option value="call" ${channel==='call'?'selected':''}>3 · Ligação</option></select></label><label class="lead-template-label">Tipo de mensagem<select id="outreach-template">${templates.map(t=>`<option value="${t.id}" ${t.id === template.id ? 'selected' : ''}>${e(t.name)}</option>`).join('')}</select></label></div>
    <div class="outreach-guidance"><strong>${e(template.name)}</strong><p>${e(template.hint)}</p></div><label class="lead-template-label" for="outreach-message">Seu rascunho · revise antes de usar</label><textarea id="outreach-message" class="lead-message" rows="8">${e(message)}</textarea><p id="outreach-save-state" class="lead-storage-note" role="status">Rascunhos separados por etapa e canal, salvos neste navegador.</p>
    <div class="outreach-actions"><button class="button ghost" data-outreach="regenerate">Gerar com contexto atual</button><button class="button ghost" data-outreach="copy">Copiar</button><button class="button primary" data-outreach="open">${channel === 'instagram' ? 'Abrir Instagram ↗' : channel === 'call' ? 'Ligar ↗' : 'Abrir WhatsApp ↗'}</button></div><p class="lead-send-note">Nada é enviado automaticamente. No Instagram, copie o texto e cole na DM da loja. Na ligação, use o texto como apoio e espere as respostas.</p>
    ${VerdiMessages.niche(lead)==='cars' ? '<details class="outreach-proof"><summary>Trabalho real para mostrar após permissão</summary><p>Catálogo de veículos da Verdi Tech. Mostre como exemplo de navegação, sem prometer vendas.</p><a href="https://web-cars-six.vercel.app/" target="_blank" rel="noopener noreferrer">Abrir demonstração ↗</a></details>' : ''}</section></div>`;
}
function bindLeadWorkspace() {
  if (state.view !== 'leads') return;
  const rerender = () => render();
  $$('[data-lead-list]').forEach(button=>button.addEventListener('click',()=>{ leadWorkspaceState.trash = button.dataset.leadList === 'trash'; state.activeLeadId=null; rerender(); }));
  $$('[data-lead-filter]').forEach(select=>select.addEventListener('change',()=>{leadWorkspaceState[select.dataset.leadFilter]=select.value; rerender();}));
  $('[data-lead-clear-filters]')?.addEventListener('click',()=>{state.search='';leadWorkspaceState.status='';leadWorkspaceState.niche='';leadWorkspaceState.author='';rerender();});
  $('#workspace-lead-search')?.addEventListener('input',event=>{ const input=event.target; state.search=input.value; render(); $('#workspace-lead-search')?.focus(); });
  $$('[data-lead-delete]').forEach(button=>button.addEventListener('click',()=>{
    const lead=state.leads.find(l=>l.id===button.dataset.leadDelete);
    if(!lead || !hasPermission('leads')) return;
    if(!confirm(`Mover “${lead.company}” para a lixeira? Você poderá restaurar este lead.`)) return;
    if(leadWorkspaceSave(lead.id,{deletedAt:new Date().toISOString()})){state.activeLeadId=null;render();toast('Lead movido para a lixeira. Você pode restaurá-lo.');}
  }));
  $$('[data-lead-restore]').forEach(button=>button.addEventListener('click',()=>{if(leadWorkspaceSave(button.dataset.leadRestore,{deletedAt:null})){render();toast('Lead restaurado na lista de ativos.');}}));
  const current = () => state.leads.find(l=>l.id===state.activeLeadId && !l.deletedAt);
  const persist = (changes) => {const lead=current(); return lead && leadWorkspaceSave(lead.id,{outreach:{...lead.outreach,...changes}});};
  $('#outreach-context')?.addEventListener('submit',event=>{event.preventDefault();const lead=current();if(!lead)return;const data=Object.fromEntries(new FormData(event.target));const segment=data.segment.trim();if(!segment)return;const {segment:unused,...context}=data;if(leadWorkspaceSave(lead.id,{segment,outreach:{...lead.outreach,...context}})){render();toast('Contexto salvo. Gere uma nova mensagem quando quiser.');}});
  for(const key of ['channel','template']) $(`#outreach-${key}`)?.addEventListener('change',event=>{if(persist({[key]:event.target.value})){render();$(`#outreach-${key}`)?.focus();}});
  function saveDraft(text) {const lead=current();if(!lead)return false;const o=lead.outreach||{};const key=`${o.channel||'whatsapp'}:${o.template||'connect'}`;return persist({drafts:{...o.drafts,[key]:text}});}
  $('#outreach-message')?.addEventListener('input',event=>{const ok=saveDraft(event.target.value);$('#outreach-save-state').textContent=ok?'Rascunho salvo neste navegador.':'Não foi possível salvar o rascunho. Copie seu texto antes de sair.';});
  $$('[data-outreach]').forEach(button=>button.addEventListener('click',async()=>{
    const lead=current();if(!lead || !hasPermission('leads'))return;const o=lead.outreach||{};const templateId=o.template||'connect';const channel=o.channel||'whatsapp';const field=$('#outreach-message');
    if(button.dataset.outreach==='regenerate'){const model=VerdiMessages.templates(lead,channel).find(t=>t.id===templateId)||VerdiMessages.templates(lead,channel)[0];if(field.value!==model.text && !confirm('Substituir o rascunho desta etapa pelo modelo com o contexto atual?'))return;if(saveDraft(model.text)){field.value=model.text;toast('Modelo atualizado. Revise para soar como você.');}return;}
    const text=field.value.trim();const error=VerdiMessages.validate(text,templateId);if(error)return toast(error);
    if(button.dataset.outreach==='copy'){try{await navigator.clipboard.writeText(text);toast('Copiado. Revise o destinatário antes de enviar.');}catch{toast('Não foi possível copiar. Selecione o texto manualmente.');}return;}
    if(channel==='instagram'){const handle=String(o.instagram||'').trim().replace(/^@/,'');if(!/^[A-Za-z0-9._]{1,30}$/.test(handle))return toast('Salve o @ da loja no contexto antes de abrir o Instagram.');window.open(`https://www.instagram.com/${encodeURIComponent(handle)}/`,'_blank','noopener,noreferrer');return;}
    const phone=whatsappNumber(lead.whatsapp);if(!/^55\d{10,11}$/.test(phone))return toast('Confira o número com DDD antes de continuar.');
    if(channel==='call')window.location.href=`tel:+${phone}`;else window.open(`https://wa.me/${phone}?text=${encodeURIComponent(text)}`,'_blank','noopener,noreferrer');
  }));
}
