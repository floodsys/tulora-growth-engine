import { IncomingMessage, ServerResponse } from 'http';
import { COMMIT_SHA, BUILD_ID, BUILD_TIMESTAMP } from '../lib/build-info';

const startTime = Date.now();

export default function handler(req: IncomingMessage, res: ServerResponse) {
  // Set strict no-cache headers
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Surrogate-Control', 'no-store');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('Content-Type', 'application/json');

  const uptimeMs = Date.now() - startTime;
  const uptimeSec = Math.floor(uptimeMs / 1000);

  const healthResponse = {
    status: 'ok',
    commit: COMMIT_SHA,
    buildId: BUILD_ID,
    buildTimestamp: BUILD_TIMESTAMP,
    uptimeSec
  };

  res.statusCode = 200;
  res.end(JSON.stringify(healthResponse, null, 2));
}