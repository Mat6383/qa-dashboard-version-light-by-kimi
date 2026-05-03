import logger from '../services/logger.service';

const RETRYABLE_ERRORS = new Set([
  'ECONNRESET',
  'ETIMEDOUT',
  'ENOTFOUND',
  'ECONNREFUSED',
  'EAI_AGAIN',
  'NETWORK_ERROR',
]);

function isRetryable(error: any) {
  if (!error) return false;
  const status = error.response?.status;
  if (status === 429) return true;
  if (status >= 500 && status < 600) return true;
  const code = error.code || error.message;
  if (RETRYABLE_ERRORS.has(code)) return true;
  if (typeof code === 'string' && code.includes('timeout')) return true;
  return false;
}

async function sleep(ms: any) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function withResilience(fn: any, breaker: any, retryOptions: any = {}) {
  const { maxRetries = 3, baseDelayMs = 500, label = 'operation' } = retryOptions as any;

  return breaker.execute(async () => {
    let lastError;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await fn();
      } catch (err) {
        lastError = err;

        const isLastAttempt = attempt === maxRetries;
        if (isLastAttempt || !isRetryable(err)) {
          throw err;
        }

        const delay = baseDelayMs * Math.pow(2, attempt);
        logger.warn(`[${label}] Retry ${attempt + 1}/${maxRetries} after ${delay}ms — ${(err as any).message || (err as any).code}`);
        await sleep(delay);
      }
    }

    throw lastError;
  });
}

export { withResilience, isRetryable };
