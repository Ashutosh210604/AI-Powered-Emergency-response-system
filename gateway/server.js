// Single entry point: serves pages, forwards /api/* to services, and checks the login token first.
const http = require('http'), fs = require('fs'), path = require('path');
const PORT = process.env.PORT || 4000;
const AUTH = process.env.AUTH_URL || 'http://localhost:4005';
const ROUTES = [  // [public prefix, service base URL, service path prefix, needs login]
  ['/api/auth',       AUTH, '', false],
  ['/api/recommend',  process.env.RECOMMEND_URL || 'http://localhost:4004', '/recommend', true],
  ['/api/hospitals',  process.env.HOSPITAL_URL  || 'http://localhost:4001', '/hospitals', true],
  ['/api/ai',         process.env.AI_URL       || 'http://localhost:4006', '', true],
  ['/api/forecast',   process.env.FORECAST_URL || 'http://localhost:4007', '', true],
  ['/api/congestion', process.env.TRAFFIC_URL   || 'http://localhost:4002', '/congestion', true]
];
const PAGES = { '/': 'index.html', '/login': 'login.html', '/signup': 'signup.html', '/app': 'app.html' };
const TYPES = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript' };
const FRONT = path.join(__dirname, '..', 'frontend');
const json = (res, code, o) => { res.writeHead(code, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(o)); };

http.createServer((req, res) => {
  const route = ROUTES.find(r => req.url.startsWith(r[0]));
  if (route) {
    const chunks = []; req.on('data', d => chunks.push(d));
    req.on('end', async () => {
      try {
        if (route[3]) {
          const v = await fetch(AUTH + '/verify', { method: 'POST', headers: { Authorization: req.headers.authorization || '' } });
          if (!v.ok) return json(res, 401, { error: 'Please log in again.' });
        }
        const r = await fetch(route[1] + route[2] + req.url.slice(route[0].length), {
          method: req.method, headers: { 'Content-Type': 'application/json', Authorization: req.headers.authorization || '' },
          body: ['GET', 'HEAD'].includes(req.method) ? undefined : Buffer.concat(chunks) });
        res.writeHead(r.status, { 'Content-Type': 'application/json' }); res.end(await r.text());
      } catch (e) { json(res, 502, { error: 'Service unavailable: ' + e.message }); }
    });
    return;
  }
  const clean = req.url.split('?')[0];
  const file = path.join(FRONT, PAGES[clean] || clean);
  if (!file.startsWith(FRONT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); return res.end('Not found'); }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'text/plain' });
  fs.createReadStream(file).pipe(res);
}).listen(PORT, () => console.log('gateway on http://localhost:' + PORT));
