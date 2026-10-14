const WORKSPACE_KEY = 'verdi-tech-solucoes';
const CEO_PERMISSIONS = ['dashboard', 'projects', 'leads', 'project-edit', 'sensitive', 'team'];

function config() { return { url: String(process.env.SUPABASE_URL || '').replace(/\/$/, ''), serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '' }; }
function headers() { const { serviceRoleKey } = config(); return { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}`, 'Content-Type': 'application/json', Accept: 'application/json' }; }
function json(response, status, body) { response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }); response.end(JSON.stringify(body)); }
async function body(request) { let value = ''; for await (const chunk of request) value += chunk; return JSON.parse(value || '{}'); }
async function auth(request) {
  const { url, serviceRoleKey } = config();
  const token = request.headers.authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!url || !serviceRoleKey || !token) return null;
  const userResponse = await fetch(`${url}/auth/v1/user`, { headers: { apikey: serviceRoleKey, Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(8000) });
  if (!userResponse.ok) return null;
  const user = await userResponse.json();
  const profileResponse = await fetch(`${url}/rest/v1/profiles?id=eq.${encodeURIComponent(user.id)}&select=id,role_id,active`, { headers: headers(), signal: AbortSignal.timeout(8000) });
  const [profile] = profileResponse.ok ? await profileResponse.json() : [];
  if (!profile?.active) return null;
  const roleResponse = await fetch(`${url}/rest/v1/app_roles?id=eq.${encodeURIComponent(profile.role_id)}&select=id,name,permissions`, { headers: headers(), signal: AbortSignal.timeout(8000) });
  const [role] = roleResponse.ok ? await roleResponse.json() : [];
  const permissions = role?.id === 'owner' || role?.name === 'CEO' ? CEO_PERMISSIONS : role?.permissions || [];
  return { id: user.id, permissions };
}
async function readTable(table) {
  const { url } = config();
  const result = await fetch(`${url}/rest/v1/${table}?workspace_key=eq.${encodeURIComponent(WORKSPACE_KEY)}&select=id,payload,updated_at&order=updated_at.desc`, { headers: headers(), signal: AbortSignal.timeout(8000) });
  if (!result.ok) throw new Error('Não foi possível carregar os dados salvos.');
  return (await result.json()).map(item => item.payload).filter(Boolean);
}
async function upsert(table, records, ownerId) {
  if (!Array.isArray(records) || !records.length) return;
  const { url } = config();
  const payload = records.filter(item => item?.id).map(item => ({ id: String(item.id), workspace_key: WORKSPACE_KEY, created_by: ownerId, payload: item, updated_at: new Date().toISOString() }));
  if (!payload.length) return;
  const result = await fetch(`${url}/rest/v1/${table}?on_conflict=id`, { method: 'POST', headers: { ...headers(), Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify(payload), signal: AbortSignal.timeout(10000) });
  if (!result.ok) throw new Error('Não foi possível salvar os dados no Supabase.');
}

export default async function handler(request, response) {
  try {
    const current = await auth(request);
    if (!current) return json(response, 401, { error: 'Entre no sistema para acessar os dados salvos.' });
    const { url, serviceRoleKey } = config();
    if (!url || !serviceRoleKey) return json(response, 503, { error: 'Configure as credenciais do Supabase no Vercel.' });
    if (request.method === 'GET') {
      const [projects, leads] = await Promise.all([
        current.permissions.includes('projects') ? readTable('workspace_projects') : [],
        current.permissions.includes('leads') ? readTable('workspace_leads') : [],
      ]);
      return json(response, 200, { projects, leads });
    }
    if (request.method === 'POST') {
      const data = await body(request);
      if (current.permissions.includes('project-edit')) await upsert('workspace_projects', data.projects, current.id);
      if (current.permissions.includes('leads')) await upsert('workspace_leads', data.leads, current.id);
      return json(response, 200, { ok: true });
    }
    return json(response, 405, { error: 'Método não permitido.' });
  } catch (error) { return json(response, 500, { error: error.message || 'Não foi possível sincronizar o banco.' }); }
}
