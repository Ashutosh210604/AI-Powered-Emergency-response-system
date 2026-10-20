// Learns ER arrival rate (patients/hour) from history using linear regression (normal equations, no libraries).
// TRAINING DATA IS SYNTHETIC (generated from assumed daily patterns + noise). To make it real,
// replace makeHistory() with rows exported from hospital ED logs: { hour, weekend, occupancy, arrivals }.
const http = require('http');
const PORT = process.env.PORT || 4007;
const send = (res, code, o) => { res.writeHead(code, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(o)); };
const TAU = 2 * Math.PI;
const feats = (h, wk, occ) => [1, Math.sin(TAU * h / 24), Math.cos(TAU * h / 24), Math.sin(2 * TAU * h / 24), Math.cos(2 * TAU * h / 24), wk, occ];

function rng(seed) { let s = seed; return () => (s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296; }
function makeHistory(n) {
  const rand = rng(42), rows = [];
  for (let i = 0; i < n; i++) {
    const hour = Math.floor(rand() * 24), weekend = rand() < 2 / 7 ? 1 : 0, occupancy = 0.2 + rand() * 0.8;
    const base = 10 * (0.4 + 1.2 * occupancy) * (1 + 0.25 * Math.sin(TAU * (hour - 14) / 24) + 0.12 * Math.cos(2 * TAU * (hour - 19) / 24)) * (weekend ? 1.1 : 1);
    const noise = (rand() + rand() + rand() - 1.5) * 2.4;     // roughly bell-shaped noise
    rows.push({ hour, weekend, occupancy, arrivals: Math.max(0.5, base + noise) });
  }
  return rows;
}
function solve(A, b) {                       // Gaussian elimination with partial pivoting
  const n = b.length, M = A.map((r, i) => [...r, b[i]]);
  for (let i = 0; i < n; i++) {
    let p = i; for (let r = i + 1; r < n; r++) if (Math.abs(M[r][i]) > Math.abs(M[p][i])) p = r;
    [M[i], M[p]] = [M[p], M[i]];
    for (let r = i + 1; r < n; r++) { const f = M[r][i] / M[i][i]; for (let c = i; c <= n; c++) M[r][c] -= f * M[i][c]; }
  }
  const x = Array(n).fill(0);
  for (let i = n - 1; i >= 0; i--) { x[i] = M[i][n]; for (let c = i + 1; c < n; c++) x[i] -= M[i][c] * x[c]; x[i] /= M[i][i]; }
  return x;
}
function train(rows) {
  const X = rows.map(r => feats(r.hour, r.weekend, r.occupancy)), y = rows.map(r => r.arrivals), k = X[0].length;
  const A = Array.from({ length: k }, (_, i) => Array.from({ length: k }, (_, j) => X.reduce((s, r) => s + r[i] * r[j], 0) + (i === j ? 1e-6 : 0)));
  return solve(A, Array.from({ length: k }, (_, i) => X.reduce((s, r, n) => s + r[i] * y[n], 0)));
}
const predict = (w, h, wk, occ) => Math.max(1, feats(h, wk, occ).reduce((s, v, i) => s + v * w[i], 0));

const all = makeHistory(4000), cut = 3200, w = train(all.slice(0, cut));
const mae = all.slice(cut).reduce((s, r) => s + Math.abs(predict(w, r.hour, r.weekend, r.occupancy) - r.arrivals), 0) / (all.length - cut);
const info = { model: 'Linear regression (hour-of-day sin/cos terms, weekend, occupancy)', trainedOn: 'synthetic history, 3200 rows', testRows: 800, testMAE: +mae.toFixed(2), unit: 'patients/hour' };
console.log('forecast-service trained. test MAE', info.testMAE);

http.createServer((req, res) => {
  if (req.url === '/health') return send(res, 200, { ok: true });
  if (req.url === '/model-info') return send(res, 200, info);
  if (req.url === '/predict' && req.method === 'POST') {
    let b = ''; req.on('data', d => b += d);
    req.on('end', () => { const q = JSON.parse(b || '{}'); send(res, 200, { lambda: +predict(w, q.hour, q.weekend ? 1 : 0, q.occupancy).toFixed(2) }); });
    return;
  }
  send(res, 404, { error: 'not found' });
}).listen(PORT, () => console.log('forecast-service on', PORT));
