// Estimates expected wait before a doctor sees the patient, using an M/M/c queue (Erlang C).
// lambda (arrivals/hr) is MODELLED from hour-of-day and current occupancy: not live data.
const http = require('http');
const PORT = process.env.PORT || 4003;
const FORECAST = process.env.FORECAST_URL || 'http://localhost:4007';
const send = (res, code, obj) => { res.writeHead(code, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(obj)); };

const MU = { cardiac: 2.5, stroke: 3, trauma: 2, general: 4 };   // patients/hr one doctor can handle (assumption)
const BASE_LAMBDA = 10;                                            // arrivals/hr at a mid-load ER (assumption)
const MAX_WAIT = 90;                                               // cap when the queue is saturated

function hourFactor(h) { return (h >= 10 && h <= 13) || (h >= 18 && h <= 22) ? 1.25 : (h >= 1 && h <= 6) ? 0.7 : 1; }

function erlangC(lambda, mu, c) {
  const a = lambda / mu, rho = a / c;
  if (rho >= 1) return { rho, pWait: 1, waitMin: MAX_WAIT, saturated: true };
  let sum = 0, term = 1;                       // term = a^k / k!
  for (let k = 0; k < c; k++) { sum += term; term *= a / (k + 1); }
  const top = term * (c / (c - a));            // term is now a^c / c!
  const pWait = top / (sum + top);
  const wq = pWait / (c * mu - lambda);        // hours
  return { rho, pWait, waitMin: Math.min(MAX_WAIT, wq * 60), saturated: false };
}
async function getLambda(hour, occupancy) {   // trained model first, hand formula as fallback
  try {
    const r = await fetch(FORECAST + '/predict', { method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(800),
      body: JSON.stringify({ hour, occupancy, weekend: [0, 6].includes(new Date().getDay()) }) });
    const d = await r.json(); if (d.lambda) return { lambda: d.lambda, source: 'trained model' };
  } catch {}
  return { lambda: BASE_LAMBDA * hourFactor(hour) * (0.4 + 1.2 * occupancy), source: 'fallback formula' };
}
async function estimate({ emergencyType, doctors, occupancy, hour }) {
  const mu = MU[emergencyType] || MU.general;
  const { lambda, source: lambdaSource } = await getLambda(hour, occupancy);
  const r = erlangC(lambda, mu, Math.max(1, doctors));
  return { lambda: +lambda.toFixed(1), mu, c: doctors, rho: +r.rho.toFixed(2), pWait: +r.pWait.toFixed(2), waitMin: +r.waitMin.toFixed(1), saturated: r.saturated, lambdaSource };
}

http.createServer((req, res) => {
  if (req.url === '/health') return send(res, 200, { ok: true });
  if (req.url === '/wait' && req.method === 'POST') {
    let b = ''; req.on('data', d => b += d);
    req.on('end', () => { const q = JSON.parse(b || '{}'); q.hour = q.hour ?? new Date().getHours(); estimate(q).then(r => send(res, 200, r)); });
    return;
  }
  send(res, 404, { error: 'not found' });
}).listen(PORT, () => console.log('wait-service on', PORT));
