(() => {
  const gate = document.getElementById('auth-gate');
  const shell = document.querySelector('.app-shell');
  const form = document.getElementById('auth-form');
  const errorNode = document.getElementById('auth-error');
  const submit = document.getElementById('auth-submit');
  const sessionKey = 'verdi-supabase-session-v1';
  const session = (() => { try { return JSON.parse(sessionStorage.getItem(sessionKey) || 'null'); } catch { return null; } })();
  const showGate = (message = '') => {
    gate.hidden = false;
    shell.hidden = true;
    if (message) { errorNode.textContent = message; errorNode.hidden = false; }
  };
  const configRequest = fetch('/api/auth/config').then(response => response.json());

  window.verdiAuthReady = (async () => {
    const config = await configRequest.catch(() => null);
    window.verdiAuth = { config, session, user: null, profile: null };
    if (!config?.configured) {
      showGate('O login ainda não foi configurado. Defina SUPABASE_URL e SUPABASE_PUBLISHABLE_KEY no ambiente do site.');
      return false;
    }
    if (!session?.access_token) { showGate(); return false; }
    try {
      const response = await fetch('/api/auth/session', { headers: { Authorization: `Bearer ${session.access_token}` } });
      const result = await response.json();
      if (!response.ok || !result.user || !result.profile?.active) throw new Error('Sessão inválida ou usuário desativado. Entre novamente.');
      window.verdiAuth.user = result.user;
      window.verdiAuth.profile = result.profile;
      gate.hidden = true;
      shell.hidden = false;
      return true;
    } catch {
      sessionStorage.removeItem(sessionKey);
      window.verdiAuth.session = null;
      showGate('Sua sessão expirou. Entre novamente.');
      return false;
    }
  })();

  form.addEventListener('submit', async event => {
    event.preventDefault();
    errorNode.hidden = true;
    submit.disabled = true;
    submit.textContent = 'Verificando…';
    try {
      const config = await configRequest;
      if (!config.configured) throw new Error('O administrador precisa configurar o Supabase no ambiente do site.');
      const fields = new FormData(form);
      const response = await fetch(`${config.url}/auth/v1/token?grant_type=password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: config.publishableKey },
        body: JSON.stringify({ email: fields.get('email'), password: fields.get('password') }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.msg || result.message || 'E-mail ou senha incorretos.');
      sessionStorage.setItem(sessionKey, JSON.stringify({ access_token: result.access_token, refresh_token: result.refresh_token }));
      location.reload();
    } catch (error) {
      errorNode.textContent = error.message || 'Não foi possível entrar. Tente novamente.';
      errorNode.hidden = false;
      submit.disabled = false;
      submit.innerHTML = 'Entrar <span>↗</span>';
    }
  });
})();
