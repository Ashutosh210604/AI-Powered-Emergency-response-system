const http = require('http');
const { hospitals, clinics } = require('./data');
const PORT = process.env.PORT || 4001;
const send = (res, code, obj) => { res.writeHead(code, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(obj)); };

http.createServer((req, res) => {
  const u = new URL(req.url, 'http://x');
  if (u.pathname === '/health') return send(res, 200, { ok: true });
  if (req.method === 'GET' && u.pathname === '/hospitals') return send(res, 200, hospitals);
  if (req.method === 'GET' && u.pathname === '/clinics') return send(res, 200, clinics);
  const m = u.pathname.match(/^\/hospitals\/(\w+)$/);
  if (m && req.method === 'PATCH') {           // hospital-side status update (occupancy, capabilities...)
    let body = '';
    req.on('data', d => body += d);
    req.on('end', () => {
      const h = hospitals.find(x => x.id === m[1]);
      if (!h) return send(res, 404, { error: 'hospital not found' });
      const patch = JSON.parse(body || '{}');
      for (const k of ['occupancy', 'doctors', 'capabilities']) if (k in patch) h[k] = patch[k];
      send(res, 200, h);
    });
    return;
  }
  send(res, 404, { error: 'not found' });
}).listen(PORT, () => console.log('hospital-service on', PORT));
