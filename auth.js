(() => {
  const gate = document.getElementById('auth-gate');
  const shell = document.querySelector('.app-shell');
  const form = document.getElementById('auth-form');
  const emailInput = form.elements.email;
  const stepFields = document.getElementById('auth-step-fields');
  const copy = document.getElementById('auth-copy');
  const errorNode = document.getElementById('auth-error');
  const submit = document.getElementById('auth-submit');
  const sessionKey = 'verdi-supabase-session-v1';
  const firstAccessKey = 'verdi-first-access-v1';
  const session = (() => { try { return JSON.parse(sessionStorage.getItem(sessionKey) || 'null'); } catch { return null; } })();
  let step = 'login';
  let loginEmail = '';
  const showGate = (message = '') => {
    gate.hidden = false;
    shell.hidden = true;
    if (message) { errorNode.textContent = message; errorNode.hidden = false; }
  };
  const setError = (message, success = false) => { errorNode.textContent = message; errorNode.classList.toggle('success', success); errorNode.hidden = !message; };
  const setBusy = (busy, label) => { submit.disabled = busy; submit.textContent = label; };
  const showLoginStep = () => {
    step = 'login'; emailInput.readOnly = false;
    stepFields.innerHTML = '<label>Senha<input name="password" type="password" autocomplete="current-password" required placeholder="Sua senha" /></label><button id="auth-first-access" class="auth-link" type="button">Primeiro acesso? Confirmar e-mail e criar senha</button>';
    copy.textContent = 'Entre com seu e-mail e senha. Se ainda não criou uma senha, confirme seu e-mail para fazer o primeiro acesso.';
    submit.innerHTML = 'Entrar <span>↗</span>';
    document.getElementById('auth-first-access')?.addEventListener('click', requestFirstAccessCode);
  };
  const showCodeStep = () => {
    step = 'code'; emailInput.readOnly = true;
    stepFields.innerHTML = '<label>Código do e-mail<input name="email-code" type="text" inputmode="numeric" autocomplete="one-time-code" required minlength="6" maxlength="8" placeholder="Digite o código recebido" /></label><button id="auth-change-email" class="auth-link" type="button">Usar outro e-mail</button>';
    copy.textContent = 'Enviamos um código ou link de confirmação. Digite o código aqui ou abra o link recebido no mesmo navegador.';
    submit.innerHTML = 'Confirmar e-mail <span>↗</span>';
    document.getElementById('auth-change-email')?.addEventListener('click', () => { setError(''); showLoginStep(); emailInput.focus(); });
  };
  const showPasswordStep = () => {
    step = 'password'; emailInput.readOnly = true;
    stepFields.innerHTML = '<label>Escolha uma senha<input name="new-password" type="password" autocomplete="new-password" required minlength="10" placeholder="Pelo menos 10 caracteres" /></label><label>Confirme a senha<input name="confirm-password" type="password" autocomplete="new-password" required minlength="10" placeholder="Digite novamente" /></label>';
    copy.textContent = 'E-mail confirmado. Crie uma senha pessoal para entrar nas próximas vezes.';
    submit.innerHTML = 'Salvar senha e entrar <span>↗</span>';
  };
  const authError = async response => {
    const result = await response.json().catch(() => ({}));
    return result.msg || result.message || result.error_description || result.error || 'Não foi possível concluir. Confira os dados e tente novamente.';
  };
  const configRequest = fetch('/api/auth/config').then(response => response.json());

  window.verdiAuthReady = (async () => {
    const config = await configRequest.catch(() => null);
    window.verdiAuth = { config, session, user: null, profile: null };
    if (!config?.configured) {
      showGate('O login ainda não foi configurado. Defina SUPABASE_URL e SUPABASE_PUBLISHABLE_KEY no ambiente do site.');
      return false;
    }
    let activeSession = session;
    const params = new URLSearchParams(location.search);
    const hashParams = new URLSearchParams(location.hash.replace(/^#/, ''));
    const tokenHash = params.get('token_hash');
    const tokenType = params.get('type');
    const hashAccessToken = hashParams.get('access_token');
    if (hashParams.has('error_description')) {
      history.replaceState({}, document.title, location.pathname);
      showLoginStep();
      showGate(hashParams.get('error_description'));
      return false;
    }
    if (hashAccessToken) {
      activeSession = { access_token: hashAccessToken, refresh_token: hashParams.get('refresh_token') || '' };
      sessionStorage.setItem(sessionKey, JSON.stringify(activeSession));
      history.replaceState({}, document.title, location.pathname + location.search);
    } else if (tokenHash && tokenType) {
      showGate();
      copy.textContent = 'Confirmando seu e-mail…';
      setBusy(true, 'Confirmando…');
      try {
        const response = await fetch(`${config.url}/auth/v1/verify`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', apikey: config.publishableKey },
          body: JSON.stringify({ token_hash: tokenHash, type: tokenType }),
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.msg || result.message || 'O link expirou ou já foi usado. Solicite outro e-mail.');
        activeSession = result;
        sessionStorage.setItem(sessionKey, JSON.stringify({ access_token: result.access_token, refresh_token: result.refresh_token }));
        history.replaceState({}, document.title, location.pathname);
      } catch (error) {
        setBusy(false, 'Entrar'); showLoginStep();
        showGate(error.message || 'Não foi possível confirmar o link.');
        return false;
      }
    }
    window.verdiAuth.session = activeSession;
    if (!activeSession?.access_token) { showLoginStep(); showGate(); return false; }
    try {
      const response = await fetch('/api/auth/session', { headers: { Authorization: `Bearer ${activeSession.access_token}` } });
      const result = await response.json();
      if (!response.ok || !result.user || !result.profile?.active) throw new Error('Sessão inválida ou usuário desativado. Entre novamente.');
      window.verdiAuth.user = result.user;
      window.verdiAuth.profile = result.profile;
      if (result.profile.must_change_password) { emailInput.value = result.user.email || ''; showPasswordStep(); showGate(); return false; }
      if (sessionStorage.getItem(firstAccessKey) === 'true') {
        sessionStorage.removeItem(sessionKey);
        sessionStorage.removeItem(firstAccessKey);
        window.verdiAuth.session = null;
        showLoginStep();
        showGate('Esta conta já concluiu o primeiro acesso. Entre com o e-mail e a senha escolhida.');
        return false;
      }
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
    setError('');
    setBusy(true, step === 'login' ? 'Entrando…' : step === 'code' ? 'Confirmando…' : 'Salvando…');
    try {
      const config = await configRequest;
      if (!config?.configured) throw new Error('O administrador precisa configurar o Supabase no ambiente do site.');
      if (step === 'login') {
        const fields = new FormData(form);
        loginEmail = emailInput.value.trim().toLowerCase();
        const response = await fetch(`${config.url}/auth/v1/token?grant_type=password`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', apikey: config.publishableKey },
          body: JSON.stringify({ email: loginEmail, password: fields.get('password') }),
        });
        if (!response.ok) throw new Error(await authError(response));
        const result = await response.json();
        sessionStorage.setItem(sessionKey, JSON.stringify({ access_token: result.access_token, refresh_token: result.refresh_token }));
        sessionStorage.removeItem(firstAccessKey);
        location.reload();
      } else if (step === 'code') {
        const code = String(new FormData(form).get('email-code') || '').trim();
        const response = await fetch(`${config.url}/auth/v1/verify`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', apikey: config.publishableKey },
          body: JSON.stringify({ email: loginEmail || emailInput.value.trim().toLowerCase(), token: code, type: 'email' }),
        });
        if (!response.ok) throw new Error(await authError(response));
        const verifiedSession = await response.json();
        sessionStorage.setItem(sessionKey, JSON.stringify({ access_token: verifiedSession.access_token, refresh_token: verifiedSession.refresh_token }));
        sessionStorage.setItem(firstAccessKey, 'true');
        location.reload();
      } else {
        const fields = new FormData(form);
        const password = String(fields.get('new-password') || '');
        if (password.length < 10) throw new Error('Escolha uma senha com pelo menos 10 caracteres.');
        if (password !== fields.get('confirm-password')) throw new Error('As senhas não são iguais.');
        const token = window.verdiAuth?.session?.access_token;
        if (!token) throw new Error('Sua confirmação expirou. Comece novamente pelo e-mail.');
        const passwordResponse = await fetch(`${config.url}/auth/v1/user`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', apikey: config.publishableKey, Authorization: `Bearer ${token}` },
          body: JSON.stringify({ password }),
        });
        if (!passwordResponse.ok) throw new Error(await authError(passwordResponse));
        const profileResponse = await fetch(`${config.url}/rest/v1/profiles?id=eq.${encodeURIComponent(window.verdiAuth.user.id)}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', apikey: config.publishableKey, Authorization: `Bearer ${token}`, Prefer: 'return=minimal' },
          body: JSON.stringify({ must_change_password: false }),
        });
        if (!profileResponse.ok) throw new Error('A senha foi atualizada, mas falta aplicar a migração de primeiro acesso no Supabase.');
        sessionStorage.removeItem(firstAccessKey);
        location.reload();
      }
    } catch (error) {
      setError(error.message || 'Não foi possível concluir. Tente novamente.');
    } finally {
      if (step === 'login') setBusy(false, 'Entrar ↗');
      else if (step === 'code') setBusy(false, 'Confirmar e-mail ↗');
      else if (step === 'password') setBusy(false, 'Salvar senha e entrar ↗');
    }
  });

  async function requestFirstAccessCode() {
    setError('');
    setBusy(true, 'Enviando…');
    try {
      const config = await configRequest;
      if (!config?.configured) throw new Error('O administrador precisa configurar o Supabase no ambiente do site.');
      loginEmail = emailInput.value.trim().toLowerCase();
      if (!loginEmail) throw new Error('Informe o e-mail cadastrado.');
      const otpUrl = new URL('/auth/v1/otp', config.url);
      otpUrl.searchParams.set('redirect_to', location.origin);
      const response = await fetch(otpUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: config.publishableKey },
        body: JSON.stringify({ email: loginEmail, create_user: false }),
      });
      if (!response.ok) throw new Error(await authError(response));
      sessionStorage.setItem(firstAccessKey, 'true');
      showCodeStep();
      setError('Se esse e-mail tem uma conta ativa, enviamos a confirmação. Confira também o spam.', true);
    } catch (error) {
      setError(error.message || 'Não foi possível enviar a confirmação.');
    } finally {
      if (step === 'code') setBusy(false, 'Confirmar e-mail ↗');
      else setBusy(false, 'Entrar ↗');
    }
  }

  showLoginStep();
})();
