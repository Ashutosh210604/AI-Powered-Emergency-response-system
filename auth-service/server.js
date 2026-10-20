// Accounts + signed tokens using only Node's crypto (scrypt password hashing, HMAC-SHA256 token).
const http = require('http'), crypto = require('crypto'), fs = require('fs'), path = require('path');
const PORT = process.env.PORT || 4005;
const SECRET = process.env.AUTH_SECRET || 'change-this-secret-before-deploying';
const FILE = path.join(__dirname, 'users.json');
const ROLES = ['dispatcher', 'hospital_staff', 'citizen'];
let users = fs.existsSync(FILE) ? JSON.parse(fs.readFileSync(FILE)) : [];
const save = () => fs.writeFileSync(FILE, JSON.stringify(users, null, 2));
const send = (res, code, obj) => { res.writeHead(code, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(obj)); };
const b64 = o => Buffer.from(JSON.stringify(o)).toString('base64url');
const sign = p => crypto.createHmac('sha256', SECRET).update(p).digest('base64url');

function hash(pw, salt = crypto.randomBytes(16).toString('hex')) {
  return { salt, hash: crypto.scryptSync(pw, salt, 64).toString('hex') };
}
function makeToken(u) { const p = b64({ sub: u.id, name: u.name, role: u.role, exp: Date.now() + 8 * 3600e3 }); return p + '.' + sign(p); }
function readToken(t = '') {
  const [p, s] = t.replace('Bearer ', '').split('.');
  if (!p || !s || sign(p) !== s) return null;
  const d = JSON.parse(Buffer.from(p, 'base64url'));
  return d.exp > Date.now() ? d : null;
}
const pub = u => ({ id: u.id, name: u.name, email: u.email, role: u.role });

http.createServer((req, res) => {
  if (req.url === '/health') return send(res, 200, { ok: true });
  if (req.method === 'POST' && req.url === '/verify') { const d = readToken(req.headers.authorization); return send(res, d ? 200 : 401, d || { error: 'invalid token' }); }
  if (req.method === 'GET' && req.url === '/me') { const d = readToken(req.headers.authorization); return d ? send(res, 200, d) : send(res, 401, { error: 'invalid token' }); }
  if (req.method !== 'POST') return send(res, 404, { error: 'not found' });
  let b = ''; req.on('data', d => b += d);
  req.on('end', () => {
    let body; try { body = JSON.parse(b || '{}'); } catch { return send(res, 400, { error: 'Invalid request.' }); }
    const email = String(body.email || '').trim().toLowerCase(), pw = String(body.password || '');
    if (req.url === '/register') {
      if (!body.name || !/^\S+@\S+\.\S+$/.test(email)) return send(res, 400, { error: 'Enter your name and a valid email address.' });
      if (pw.length < 8) return send(res, 400, { error: 'Password must be at least 8 characters.' });
      if (users.some(u => u.email === email)) return send(res, 409, { error: 'An account with this email already exists. Log in instead.' });
      const u = { id: crypto.randomUUID(), name: String(body.name).trim(), email, role: ROLES.includes(body.role) ? body.role : 'citizen', ...hash(pw) };
      users.push(u); save();
      return send(res, 201, { token: makeToken(u), user: pub(u) });
    }
    if (req.url === '/login') {
      const u = users.find(x => x.email === email);
      const ok = u && crypto.timingSafeEqual(Buffer.from(hash(pw, u.salt).hash), Buffer.from(u.hash));
      return ok ? send(res, 200, { token: makeToken(u), user: pub(u) }) : send(res, 401, { error: 'Email or password is incorrect.' });
    }
    send(res, 404, { error: 'not found' });
  });
}).listen(PORT, () => console.log('auth-service on', PORT));
