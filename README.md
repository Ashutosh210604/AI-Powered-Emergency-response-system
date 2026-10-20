# Emergency hospital routing (microservices)

Run: `npm start` (Node 18+, no dependencies) then open http://localhost:4000 (home, /login, /signup, /app). Add `auth-service` (4005): accounts, scrypt-hashed passwords, signed tokens. Map: Leaflet + OpenStreetMap tiles; directions from the public OSRM server (needs internet). Set AUTH_SECRET before deploying. AI: `ai-service` (4006, Claude triage + explanation when ANTHROPIC_API_KEY is set, rule fallback otherwise) and `forecast-service` (4007, trained regression predicting ER arrivals, used by wait-service).

| Service | Port | Job |
|---|---|---|
| gateway | 4000 | serves frontend, routes /api/* |
| hospital-service | 4001 | hospital + clinic data, status updates (PATCH) |
| traffic-service | 4002 | travel time (distance, time-of-day, congestion) |
| wait-service | 4003 | ER wait via M/M/c Erlang C queue |
| recommendation-service | 4004 | capability filter + weighted score + clinic bridge |

Flow: request -> recommendation-service -> (1) capability filter -> (2) traffic ETA -> (3) wait estimate -> (4) score = w_time*1/(1+T/30) + w_load*(1-occupancy) + w_ready*preferred coverage -> ranked list.
Data is simulated (see hospital-service/data.js). Weights/capabilities live in recommendation-service/capabilities.js.
