// Travel-time model. Swappable: replace etaMinutes() with Google Distance Matrix duration_in_traffic.
const http = require('http');
const PORT = process.env.PORT || 4002;
let congestion = 1.0;   // scenario control: 1 = normal, 2 = heavy
const send = (res, code, obj) => { res.writeHead(code, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(obj)); };

function haversineKm(a, b) {
  const R = 6371, rad = x => x * Math.PI / 180;
  const dLat = rad(b.lat - a.lat), dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
function timeOfDayFactor(hour) {            // peak hours slow traffic
  if ((hour >= 8 && hour <= 11) || (hour >= 17 && hour <= 21)) return 1.5;
  if (hour >= 0 && hour <= 5) return 0.8;
  return 1.0;
}
function etaMinutes(from, to, hour) {
  const roadKm = haversineKm(from, to) * 1.35;                 // straight line -> road distance
  const speed = 35 / (timeOfDayFactor(hour) * congestion);      // ambulance base speed km/h
  return { km: +roadKm.toFixed(1), minutes: +(roadKm / speed * 60).toFixed(1) };
}
const readBody = (req, cb) => { let b = ''; req.on('data', d => b += d); req.on('end', () => cb(JSON.parse(b || '{}'))); };

http.createServer((req, res) => {
  const u = new URL(req.url, 'http://x');
  if (u.pathname === '/health') return send(res, 200, { ok: true });
  if (u.pathname === '/congestion' && req.method === 'GET') return send(res, 200, { congestion });
  if (u.pathname === '/congestion' && req.method === 'POST')
    return readBody(req, b => { congestion = Math.min(4, Math.max(0.5, +b.congestion || 1)); send(res, 200, { congestion }); });
  if (u.pathname === '/eta' && req.method === 'POST')
    return readBody(req, ({ from, destinations, hour }) => {
      const h = hour ?? new Date().getHours();
      send(res, 200, destinations.map(d => ({ id: d.id, ...etaMinutes(from, d, h) })));
    });
  send(res, 404, { error: 'not found' });
}).listen(PORT, () => console.log('traffic-service on', PORT));
