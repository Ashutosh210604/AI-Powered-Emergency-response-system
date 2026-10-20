const token = localStorage.getItem('token');
if (!token) location.href = '/login';
const user = JSON.parse(localStorage.getItem('user') || '{}');
document.getElementById('who').textContent = user.name ? user.name + ' (' + String(user.role).replace('_', ' ') + ')' : '';
const $ = id => document.getElementById(id);
const logout = () => { localStorage.clear(); location.href = '/login'; };
$('logout').onclick = logout;
const api = async (url, method = 'GET', body) => {
  const r = await fetch(url, { method, headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }, body: body ? JSON.stringify(body) : undefined });
  if (r.status === 401) logout();
  return r.json();
};

const TYPES = { general: 'General', cardiac: 'Cardiac', stroke: 'Stroke', trauma: 'Trauma' };
const PLACES = [['Connaught Place', 28.6315, 77.2167], ['Saket', 28.5245, 77.2066], ['Lajpat Nagar', 28.5677, 77.2433],
  ['Dwarka Sector 10', 28.5823, 77.0500], ['Rohini', 28.7495, 77.0565], ['Gurugram Cyber Hub', 28.4950, 77.0890]];
const state = { type: 'general', lat: PLACES[0][1], lng: PLACES[0][2], ranked: [], selected: null };

// ---- map ----
const map = L.map('map').setView([state.lat, state.lng], 11);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; OpenStreetMap contributors' }).addTo(map);
const patient = L.circleMarker([state.lat, state.lng], { radius: 9, color: '#fff', weight: 3, fillColor: '#c8372d', fillOpacity: 1 }).addTo(map).bindTooltip('Patient');
const pin = L.marker([state.lat, state.lng], { draggable: true, opacity: 0, title: 'Drag to move patient' }).addTo(map);
const hospLayer = L.layerGroup().addTo(map), routeLayer = L.layerGroup().addTo(map);
const setLoc = (lat, lng, pan) => { state.lat = lat; state.lng = lng; patient.setLatLng([lat, lng]); pin.setLatLng([lat, lng]); if (pan) map.setView([lat, lng], 12); run(); };
map.on('click', e => setLoc(e.latlng.lat, e.latlng.lng));
pin.on('dragend', () => { const p = pin.getLatLng(); setLoc(p.lat, p.lng); });

// ---- controls ----
$('types').innerHTML = Object.entries(TYPES).map(([k, v]) => `<button type="button" data-t="${k}" aria-pressed="${k === state.type}">${v}</button>`).join('');
$('types').onclick = e => { const b = e.target.closest('button'); if (!b) return; state.type = b.dataset.t; state.selected = null;
  [...$('types').children].forEach(x => x.setAttribute('aria-pressed', x === b)); run(); };
$('loc').innerHTML = PLACES.map((p, i) => `<option value="${i}">${p[0]}</option>`).join('');
$('loc').onchange = () => { const p = PLACES[$('loc').value]; setLoc(p[1], p[2], true); };
$('gps').onclick = () => navigator.geolocation ? navigator.geolocation.getCurrentPosition(p => setLoc(p.coords.latitude, p.coords.longitude, true),
  () => alert('Location permission denied. Pick an area from the list or click the map.')) : alert('Location is not supported in this browser.');
$('traffic').oninput = async () => { const v = +$('traffic').value;
  $('trafficOut').textContent = v === 1 ? 'normal' : v < 2 ? 'busy' : v < 3 ? 'heavy' : 'gridlock';
  await api('/api/congestion', 'POST', { congestion: v }); run(); };
$('hosp').onchange = syncOcc;
$('occ').oninput = async () => { $('occOut').textContent = Math.round($('occ').value * 100) + '%';
  await api('/api/hospitals/' + $('hosp').value, 'PATCH', { occupancy: +$('occ').value }); run(); };
async function syncOcc() { const h = await api('/api/hospitals'); if (!$('hosp').options.length) $('hosp').innerHTML = h.map(x => `<option value="${x.id}">${x.name}</option>`).join('');
  const x = h.find(i => i.id === $('hosp').value); $('occ').value = x.occupancy; $('occOut').textContent = Math.round(x.occupancy * 100) + '%'; }

// ---- directions (OSRM public demo server) ----
const verb = m => m.type === 'depart' ? 'Start' : m.type === 'arrive' ? 'Arrive' : /roundabout|rotary/.test(m.type) ? 'Take the roundabout'
  : ['turn', 'end of road', 'fork', 'on ramp', 'off ramp'].includes(m.type) ? ('Turn ' + (m.modifier || '')).trim() : 'Continue';
const dist = m => m >= 1000 ? (m / 1000).toFixed(1) + ' km' : Math.round(m) + ' m';
async function drawRoute(h) {
  routeLayer.clearLayers();
  const box = $('route'); box.hidden = false;
  box.innerHTML = `<h2>Route to ${h.name}</h2><p class="hint">Loading directions...</p>`;
  try {
    const r = await (await fetch(`https://router.project-osrm.org/route/v1/driving/${state.lng},${state.lat};${h.lng},${h.lat}?overview=full&geometries=geojson&steps=true`)).json();
    if (r.code !== 'Ok') throw new Error(r.code);
    const rt = r.routes[0];
    const line = L.geoJSON(rt.geometry, { style: { color: '#1f6f8b', weight: 6, opacity: .9 } }).addTo(routeLayer);
    map.fitBounds(line.getBounds(), { padding: [40, 40] });
    const steps = rt.legs[0].steps.map(s => `<li><b>${verb(s.maneuver)}</b>${s.name ? ' onto ' + s.name : ''} (${dist(s.distance)})</li>`).join('');
    box.innerHTML = `<h2>Route to ${h.name}: ${dist(rt.distance)} by road</h2>
      <p class="hint">Time to treatment used for ranking: ${h.totalMin.toFixed(0)} min (${h.travelMin.toFixed(0)} travel, modelled with traffic, plus ${h.waitMin.toFixed(0)} wait). The map route does not include live traffic.</p>
      <details><summary>Turn-by-turn directions</summary><ol>${steps}</ol></details>`;
  } catch {
    L.polyline([[state.lat, state.lng], [h.lat, h.lng]], { color: '#1f6f8b', weight: 4, dashArray: '8 8' }).addTo(routeLayer);
    map.fitBounds([[state.lat, state.lng], [h.lat, h.lng]], { padding: [40, 40] });
    box.innerHTML = `<h2>Route to ${h.name}</h2><p class="hint">Road directions are unavailable right now, so a straight line is shown. Check your internet connection.</p>`;
  }
}

// ---- main refresh ----
async function run() {
  const r = await api('/api/recommend', 'POST', { lat: state.lat, lng: state.lng, emergencyType: state.type });
  if (r.error) { $('list').innerHTML = `<li class="hosp">${r.error}</li>`; return; }
  state.ranked = r.ranked; state.last = r; $('explain').textContent = '';
  if (!r.ranked.find(h => h.id === state.selected)) state.selected = r.ranked[0] ? r.ranked[0].id : null;
  $('warning').hidden = !r.warning; $('warning').textContent = r.warning || '';
  $('clinic').hidden = !r.clinicBridge;
  if (r.clinicBridge) $('clinic').innerHTML = `<strong>Stop for first aid: ${r.clinicBridge.name}</strong><br>${r.clinicBridge.travelMin.toFixed(0)} min away (${r.clinicBridge.distanceKm} km). Offers ${r.clinicBridge.capabilities.join(', ').replace(/_/g, ' ')} while the patient is moved on to hospital care.`;
  const max = Math.max(...r.ranked.map(h => h.totalMin), 1);
  $('list').innerHTML = r.ranked.map((h, i) => `
    <li class="hosp ${i === 0 ? 'best' : ''} ${h.id === state.selected ? 'sel' : ''}" data-id="${h.id}" tabindex="0" role="button" aria-label="Show route to ${h.name}">
      <header><h2><span class="rank">${i + 1}.</span> ${h.name}</h2><div class="total">${h.totalMin.toFixed(0)} <small>min to treatment</small></div></header>
      <div class="bar" role="img" aria-label="${h.travelMin.toFixed(0)} minutes travel, ${h.waitMin.toFixed(0)} minutes wait" style="width:${Math.max(25, h.totalMin / max * 100)}%">
        <span class="t" style="flex:${h.travelMin}"></span><span class="w" style="flex:${Math.max(h.waitMin, 0.3)}"></span></div>
      <div class="legend"><span><i style="background:var(--travel)"></i>Travel ${h.travelMin.toFixed(0)} min (${h.distanceKm} km)</span>
        <span><i style="background:var(--wait)"></i>Expected wait ${h.waitMin.toFixed(0)} min${h.saturated ? ' (ER saturated)' : ''}</span></div>
      <p class="meta">Wait estimate: ${h.waitSource || 'n/a'}. Score ${h.score}/100. Time ${h.parts.time}, load ${h.parts.load}, readiness ${h.parts.ready}. ER ${Math.round(h.occupancy * 100)}% full.</p>
      ${h.note ? `<p class="note">${h.note}</p>` : ''}</li>`).join('');
  $('excludedBox').hidden = !r.excluded.length;
  $('excluded').innerHTML = r.excluded.map(e => `<li>${e.name}: missing ${e.missing.join(', ').replace(/_/g, ' ')}</li>`).join('');
  hospLayer.clearLayers();
  r.ranked.forEach((h, i) => L.circleMarker([h.lat, h.lng], { radius: i === 0 ? 11 : 8, color: '#fff', weight: 2, fillColor: i === 0 ? '#2c7a4b' : '#1f6f8b', fillOpacity: 1 })
    .bindTooltip(`${i + 1}. ${h.name}: ${h.totalMin.toFixed(0)} min`).on('click', () => select(h.id)).addTo(hospLayer));
  r.excluded.forEach(e => L.circleMarker([e.lat, e.lng], { radius: 6, color: '#fff', weight: 2, fillColor: '#8a979c', fillOpacity: 1 })
    .bindTooltip(`${e.name}: lacks ${e.missing.join(', ').replace(/_/g, ' ')}`).addTo(hospLayer));
  const sel = r.ranked.find(h => h.id === state.selected);
  if (sel) drawRoute(sel); else { routeLayer.clearLayers(); $('route').hidden = true; }
}
function select(id) { state.selected = id; const h = state.ranked.find(x => x.id === id); document.querySelectorAll('.hosp').forEach(el => el.classList.toggle('sel', el.dataset.id === id)); if (h) drawRoute(h); }
$('list').onclick = e => { const li = e.target.closest('.hosp'); if (li && li.dataset.id) select(li.dataset.id); };
$('list').onkeydown = e => { if (e.key === 'Enter') { const li = e.target.closest('.hosp'); if (li && li.dataset.id) select(li.dataset.id); } };

syncOcc(); run();

// ---- AI features ----
const esc = t => String(t).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
$('analyse').onclick = async () => {
  const text = $('symptoms').value.trim(), out = $('aiResult');
  if (text.length < 5) { out.textContent = 'Describe the patient in at least a short sentence.'; return; }
  $('analyse').disabled = true; out.textContent = 'Analysing...';
  try {
    const r = await api('/api/ai/triage', 'POST', { text });
    if (r.error) throw new Error(r.error);
    out.innerHTML = `<p><strong>${esc(TYPES[r.emergencyType])} emergency</strong>, urgency ${r.urgency}/5, confidence ${Math.round(r.confidence * 100)}%</p>
      <ul>${r.reasons.map(x => `<li>${esc(x)}</li>`).join('')}</ul>
      <p class="hint">Source: ${esc(r.source)}. ${esc(r.disclaimer)} The type below was selected for you; change it if you disagree.</p>`;
    state.type = r.emergencyType; state.selected = null;
    [...$('types').children].forEach(x => x.setAttribute('aria-pressed', x.dataset.t === state.type));
    run();
  } catch (e) { out.textContent = 'AI triage failed: ' + e.message + '. Choose the emergency type manually.'; }
  $('analyse').disabled = false;
};
$('explainBtn').onclick = async () => {
  const r = state.last; if (!r) return;
  $('explain').textContent = 'Writing explanation...';
  const slim = { emergencyType: r.emergencyType, ranked: r.ranked.slice(0, 3).map(h => ({ name: h.name, travelMin: h.travelMin, waitMin: h.waitMin, totalMin: h.totalMin, occupancyPct: Math.round(h.occupancy * 100) })),
    excluded: r.excluded.map(e => ({ name: e.name, missing: e.missing })), clinicBridge: r.clinicBridge && r.clinicBridge.name };
  const d = await api('/api/ai/explain', 'POST', { result: slim });
  $('explain').textContent = d.text + '  (' + d.source + ')';
};
api('/api/forecast/model-info').then(m => { if (m.model) $('modelInfo').textContent = `Wait-time model: ${m.model}, trained on ${m.trainedOn}, test error ${m.testMAE} ${m.unit}.`; }).catch(() => {});
