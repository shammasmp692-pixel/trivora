'use strict';
// Fixed-window in-memory limiter: `max` hits per `windowMs` per key.
function createLimiter(max, windowMs) {
  const hits = new Map();
  const timer = setInterval(() => {
    const now = Date.now();
    for (const [k, v] of hits) if (v.reset <= now) hits.delete(k);
  }, Math.min(windowMs, 60000));
  timer.unref();
  return function take(key) {
    const now = Date.now();
    let e = hits.get(key);
    if (!e || e.reset <= now) { e = { n: 0, reset: now + windowMs }; hits.set(key, e); }
    e.n += 1;
    return { allowed: e.n <= max, retryAfter: Math.ceil((e.reset - now) / 1000) };
  };
}
module.exports = { createLimiter };
