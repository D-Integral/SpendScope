import http from 'http';
import { config } from './config.js';
import { createApp } from './app.js';
import { initWebSocket } from './ws/wsServer.js';

const { app, sessionParser } = createApp();
const server = http.createServer(app);
initWebSocket(server, sessionParser);

server.listen(config.port, '0.0.0.0', () => {
  console.log(`API listening on http://0.0.0.0:${config.port}`);
  console.log(`WebSocket path: ws://localhost:${config.port}/ws`);
  if (config.authTestMode) {
    console.log('AUTH_TEST_MODE is enabled (POST /api/auth/test/login).');
  }
  if (!config.google.enabled) {
    console.log('Google SSO is not configured (set GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET).');
  }
  if (!config.github.enabled) {
    console.log('GitHub SSO is not configured (set GITHUB_CLIENT_ID / GITHUB_CLIENT_SECRET).');
  }
});
