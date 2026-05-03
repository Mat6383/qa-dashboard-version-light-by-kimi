/**
 * Smoke test — validate endpoints before load test
 */
import http from 'k6/http';
import { check, sleep } from 'k6';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3001';
const TOKEN = __ENV.TOKEN || '';

const headers = {
  'Content-Type': 'application/json',
  ...(TOKEN && { Authorization: `Bearer ${TOKEN}` }),
};

export const options = {
  vus: 1,
  iterations: 1,
};

export default function () {
  // 1. Health (public)
  const health = http.get(`${BASE_URL}/api/health`);
  check(health, {
    'health status is 200': (r) => r.status === 200,
    'health response time < 500ms': (r) => r.timings.duration < 500,
  });

  // 2. Health ready (external APIs)
  const ready = http.get(`${BASE_URL}/api/health/ready`);
  check(ready, {
    'health/ready status is 200 or 503': (r) => r.status === 200 || r.status === 503,
    'health/ready response time < 5000ms': (r) => r.timings.duration < 5000,
  });

  // 3. Dashboard metrics (public-ish, no auth required)
  const dashboard = http.get(`${BASE_URL}/api/dashboard/1`);
  check(dashboard, {
    'dashboard status is 200': (r) => r.status === 200,
    'dashboard response time < 10000ms': (r) => r.timings.duration < 10000,
  });

  // 4. PDF generate (protected)
  if (TOKEN) {
    const pdf = http.post(
      `${BASE_URL}/api/pdf/generate`,
      JSON.stringify({ projectId: 1, format: 'A4', darkMode: false }),
      { headers }
    );
    check(pdf, {
      'pdf status is 200': (r) => r.status === 200,
      'pdf content-type is application/pdf': (r) => r.headers['Content-Type'] === 'application/pdf',
      'pdf response time < 30000ms': (r) => r.timings.duration < 30000,
    });
  }

  // 5. Export Excel (protected)
  if (TOKEN) {
    const excel = http.post(`${BASE_URL}/api/export/excel`, JSON.stringify({ projectId: 1 }), { headers });
    check(excel, {
      'excel status is 200': (r) => r.status === 200,
      'excel content-type is correct': (r) =>
        r.headers['Content-Type'] === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'excel response time < 30000ms': (r) => r.timings.duration < 30000,
    });
  }

  sleep(1);
}
