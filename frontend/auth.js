const form = document.getElementById('form'), err = document.getElementById('err');
if (localStorage.getItem('token')) location.href = '/app';
form.onsubmit = async e => {
  e.preventDefault(); err.textContent = '';
  const mode = form.dataset.mode, v = id => document.getElementById(id)?.value;
  const body = { email: v('email'), password: v('password') };
  if (mode === 'signup') { body.name = v('name'); body.role = v('role'); }
  try {
    const r = await fetch('/api/auth/' + (mode === 'signup' ? 'register' : 'login'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const d = await r.json();
    if (!r.ok) { err.textContent = d.error || 'Something went wrong. Try again.'; return; }
    localStorage.setItem('token', d.token); localStorage.setItem('user', JSON.stringify(d.user));
    location.href = '/app';
  } catch { err.textContent = 'Cannot reach the server. Check that npm start is running.'; }
};
