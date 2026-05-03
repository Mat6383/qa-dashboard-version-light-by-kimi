/**
 * Load test — Option B
 * Scénarios : health baseline, dashboard, PDF, Excel, health/ready, mixed realistic
 */
import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend } from 'k6/metrics';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3003';
const TOKEN = __ENV.TOKEN || '';

const authHeaders = {
  'Content-Type': 'application/json',
  ...(TOKEN && { Authorization: `Bearer ${TOKEN}` }),
};

// Custom metrics
const pdfQueueFullRate = new Rate('pdf_queue_full_rate');
const pdfSlowRate = new Rate('pdf_slow_rate');
const errorRate = new Rate('errors');

export const options = {
  thresholds: {
    http_req_duration: ['p(95)<5000'], // 95% under 5s globally
    http_req_failed: ['rate<0.1'], // <10% errors globally
    'http_req_duration{scenario:health_baseline}': ['p(95)<500'],
    'http_req_duration{scenario:dashboard_load}': ['p(95)<10000'],
    'http_req_duration{scenario:pdf_heavy}': ['p(95)<30000'],
    'http_req_duration{scenario:excel_heavy}': ['p(95)<30000'],
    'http_req_duration{scenario:health_ready}': ['p(95)<5000'],
  },
  scenarios: {
    health_baseline: {
      executor: 'constant-vus',
      vus: 50,
      duration: '30s',
      exec: 'healthBaseline',
    },
    dashboard_load: {
      executor: 'constant-vus',
      vus: 50,
      duration: '30s',
      exec: 'dashboardLoad',
      startTime: '5s',
    },
    pdf_heavy: {
      executor: 'constant-vus',
      vus: 10,
      duration: '30s',
      exec: 'pdfHeavy',
      startTime: '10s',
    },
    excel_heavy: {
      executor: 'constant-vus',
      vus: 20,
      duration: '30s',
      exec: 'excelHeavy',
      startTime: '10s',
    },
    health_ready: {
      executor: 'constant-vus',
      vus: 20,
      duration: '30s',
      exec: 'healthReady',
      startTime: '15s',
    },
    mixed_realistic: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '10s', target: 25 },
        { duration: '20s', target: 50 },
        { duration: '20s', target: 50 },
        { duration: '10s', target: 0 },
      ],
      exec: 'mixedRealistic',
      startTime: '20s',
    },
  },
};

export function healthBaseline() {
  const res = http.get(`${BASE_URL}/api/health`);
  const ok = check(res, {
    'health status 200': (r) => r.status === 200,
    'health < 500ms': (r) => r.timings.duration < 500,
  });
  if (!ok) errorRate.add(1);
  sleep(0.5);
}

export function dashboardLoad() {
  const res = http.get(`${BASE_URL}/api/dashboard/1`);
  const ok = check(res, {
    'dashboard status 200': (r) => r.status === 200,
    'dashboard < 10s': (r) => r.timings.duration < 10000,
  });
  if (!ok) errorRate.add(1);
  sleep(1);
}

export function pdfHeavy() {
  if (!TOKEN) {
    sleep(1);
    return;
  }
  const res = http.post(
    `${BASE_URL}/api/pdf/generate`,
    JSON.stringify({ projectId: 1, format: 'A4', darkMode: false }),
    { headers: authHeaders }
  );
  const ok = check(res, {
    'pdf status 200': (r) => r.status === 200,
    'pdf content-type': (r) => r.headers['Content-Type'] === 'application/pdf',
    'pdf < 30s': (r) => r.timings.duration < 30000,
  });
  if (!ok) {
    errorRate.add(1);
    if (res.status === 429 || res.body?.includes('queue full')) {
      pdfQueueFullRate.add(1);
    }
  }
  if (res.timings.duration > 10000) pdfSlowRate.add(1);
  sleep(2);
}

export function excelHeavy() {
  if (!TOKEN) {
    sleep(1);
    return;
  }
  const res = http.post(`${BASE_URL}/api/export/excel`, JSON.stringify({ projectId: 1 }), { headers: authHeaders });
  const ok = check(res, {
    'excel status 200': (r) => r.status === 200,
    'excel < 30s': (r) => r.timings.duration < 30000,
  });
  if (!ok) errorRate.add(1);
  sleep(1);
}

export function healthReady() {
  const res = http.get(`${BASE_URL}/api/health/ready`);
  const ok = check(res, {
    'health/ready status 200|503': (r) => r.status === 200 || r.status === 503,
    'health/ready < 5s': (r) => r.timings.duration < 5000,
  });
  if (!ok) errorRate.add(1);
  sleep(1);
}

export function mixedRealistic() {
  const rand = Math.random();
  if (rand < 0.4) {
    healthBaseline();
  } else if (rand < 0.7) {
    dashboardLoad();
  } else if (rand < 0.85) {
    healthReady();
  } else if (rand < 0.95) {
    excelHeavy();
  } else {
    pdfHeavy();
  }
}
