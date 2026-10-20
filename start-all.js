// Starts every microservice as its own process (each folder is independently deployable).
const { spawn } = require('child_process');
['hospital-service', 'traffic-service', 'wait-service', 'recommendation-service', 'auth-service', 'forecast-service', 'ai-service', 'gateway'].forEach(s => {
  const p = spawn('node', [`${s}/server.js`], { cwd: __dirname, stdio: 'inherit' });
  p.on('exit', c => console.log(s, 'exited', c));
});
