const http = require('http');
const MODEL = require('./capabilities');
const PORT = process.env.PORT || 4004;
const URLS = {
  hospital: process.env.HOSPITAL_URL || 'http://localhost:4001',
  traffic:  process.env.TRAFFIC_URL  || 'http://localhost:4002',
  wait:     process.env.WAIT_URL     || 'http://localhost:4003'
};
const CLINIC_BRIDGE_MIN = 20;   // if best hospital is further than this, suggest a clinic for first aid
const send = (res, code, obj) => { res.writeHead(code, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(obj)); };
const get = async u => (await fetch(u)).json();
const post = async (u, body) => (await fetch(u, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })).json();

// time score: 1 at 0 min, 0.5 at 30 min, ~0.25 at 90 min (smooth, so 5 vs 8 min barely differs but 10 vs 40 does)
const timeScore = totalMin => 1 / (1 + totalMin / 30);

async function recommend({ lat, lng, emergencyType = 'general', hour }) {
  const model = MODEL[emergencyType] || MODEL.general;
  const from = { lat, lng };
  const hospitals = await get(URLS.hospital + '/hospitals');

  // Step 1: hard capability filter
  const eligible = [], excluded = [];
  for (const h of hospitals) {
    const missing = model.required.filter(c => !h.capabilities.includes(c));
    (missing.length ? excluded : eligible).push(missing.length ? { id: h.id, name: h.name, lat: h.lat, lng: h.lng, missing } : h);
  }

  // Step 2: travel time + wait time for eligible hospitals
  const etas = eligible.length ? await post(URLS.traffic + '/eta', { from, destinations: eligible, hour }) : [];
  const ranked = [];
  for (const h of eligible) {
    const eta = etas.find(e => e.id === h.id);
    const w = await post(URLS.wait + '/wait', { emergencyType, doctors: h.doctors, occupancy: h.occupancy, hour });
    const total = eta.minutes + w.waitMin;
    const preferredHit = model.preferred.filter(c => h.capabilities.includes(c)).length;
    const ready = preferredHit / model.preferred.length;
    const parts = { time: timeScore(total), load: 1 - h.occupancy, ready };
    const score = model.weights.time * parts.time + model.weights.load * parts.load + model.weights.ready * parts.ready;
    ranked.push({
      id: h.id, name: h.name, lat: h.lat, lng: h.lng, distanceKm: eta.km, travelMin: eta.minutes, waitMin: w.waitMin,
      totalMin: +total.toFixed(1), waitSource: w.lambdaSource, occupancy: h.occupancy, saturated: w.saturated,
      score: +(score * 100).toFixed(1), parts: { time: +parts.time.toFixed(2), load: +parts.load.toFixed(2), ready: +parts.ready.toFixed(2) }
    });
  }
  ranked.sort((a, b) => b.score - a.score);
  const nearest = [...ranked].sort((a, b) => a.travelMin - b.travelMin)[0];
  if (ranked[0]) ranked[0].note = nearest && nearest.id !== ranked[0].id
    ? `Ranked above ${nearest.name} (closer) because total time to treatment is ${(nearest.totalMin - ranked[0].totalMin).toFixed(0)} min ${nearest.totalMin > ranked[0].totalMin ? 'shorter' : 'longer but readiness/load score is higher'}.`
    : 'Closest suitable hospital is also the best overall.';

  // Step 3: clinic bridge when the hospital is far, or no hospital qualifies
  let clinicBridge = null;
  if (!ranked.length || ranked[0].travelMin > CLINIC_BRIDGE_MIN) {
    const clinics = await get(URLS.hospital + '/clinics');
    const ce = await post(URLS.traffic + '/eta', { from, destinations: clinics, hour });
    const best = ce.sort((a, b) => a.minutes - b.minutes)[0];
    const c = clinics.find(x => x.id === best.id);
    clinicBridge = { name: c.name, capabilities: c.capabilities, travelMin: best.minutes, distanceKm: best.km };
  }
  return { emergencyType: model.label, required: model.required, weights: model.weights, ranked, excluded, clinicBridge,
           warning: ranked.length ? null : 'No hospital has all required capabilities. Call 112 / 102 and go to the nearest ER for stabilisation.' };
}

http.createServer((req, res) => {
  if (req.url === '/health') return send(res, 200, { ok: true });
  if (req.url === '/recommend' && req.method === 'POST') {
    let b = ''; req.on('data', d => b += d);
    req.on('end', async () => { try { send(res, 200, await recommend(JSON.parse(b || '{}'))); } catch (e) { send(res, 500, { error: e.message }); } });
    return;
  }
  send(res, 404, { error: 'not found' });
}).listen(PORT, () => console.log('recommendation-service on', PORT));
