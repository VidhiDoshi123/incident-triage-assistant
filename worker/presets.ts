export interface IncidentPreset {
  id: string;
  name: string;
  category: string;
  service: string;
  environment: 'production' | 'staging' | 'canary';
  description: string;
  logs: string;
}

export const INCIDENT_PRESETS: IncidentPreset[] = [
  {
    id: 'k8s-oomkilled',
    name: 'Kubernetes Pod OOMKilled & CrashLoopBackOff',
    category: 'Infrastructure / Kubernetes',
    service: 'auth-session-worker',
    environment: 'production',
    description: 'Auth service pod is crashing repeatedly under load. Users report intermittent 502 Bad Gateway when trying to log in.',
    logs: `2026-11-17T21:44:02.112Z [INFO] Initializing SessionStore with max_cache_size=100000
2026-11-17T21:44:15.890Z [WARN] Memory usage at 85% (1.70GiB / 2.00GiB limit)
2026-11-17T21:44:22.331Z [WARN] High heap allocation detected in SessionCache.bulkInsert()
2026-11-17T21:44:28.914Z [ERROR] Failed to allocate 128MB buffer for user session batch
2026-11-17T21:44:30.002Z [FATAL] Node.js process: <--- Last few GCs --->
[1:0x128000000]    42011 ms: Mark-Compact (reduce) 1980.2 (2048.0) -> 1978.4 (2048.0) MB, 412.3 / 0.0 ms (average mu = 0.120, current mu = 0.010) allocation failure GC in old space requested
<--- JS stacktrace --->
FATAL ERROR: Ineffective mark-compacts near heap limit Allocation failed - JavaScript heap out of memory
1: 0xb73e40 node::Abort() [node]
2: 0xa8c523 node::FatalError(char const*, char const*) [node]
3: 0xd3891e v8::Utils::ReportOOMFailure(v8::internal::Isolate*, char const*, bool) [node]
k8s event: Pod auth-session-worker-7df9bf885c-4kx9z terminated with Exit Code: 137 (OOMKilled)
k8s event: Back-off restarting failed container auth-session in pod auth-session-worker-7df9bf885c-4kx9z (CrashLoopBackOff)`
  },
  {
    id: 'postgres-deadlock',
    name: 'PostgreSQL Connection Exhaustion & Deadlock',
    category: 'Database / Relational',
    service: 'billing-ledger-api',
    environment: 'production',
    description: 'Payment settlement job started failing. Upstream checkout API started throwing connection timeout exceptions to Postgres.',
    logs: `2026-11-17T21:30:05.102Z [ERROR] [TypeORM] QueryFailedError: deadlock detected
DETAIL: Process 41284 waits for ExclusiveLock on relation 16402 of database 16384; blocked by process 41299.
Process 41299 waits for ExclusiveLock on relation 16408 of database 16384; blocked by process 41284.
HINT: See server log for query details.
CONTEXT: while updating tuple (42, 18) in relation "account_balances"
2026-11-17T21:30:12.441Z [WARN] [pg-pool] Connection pool acquisition timeout after 5000ms. Active: 100/100, Idle: 0, Pending: 142
2026-11-17T21:30:15.980Z [FATAL] [express] Unhandled exception: error: remaining connection slots are reserved for non-replication superuser connections
    at Parser.parseErrorMessage (/app/node_modules/pg-protocol/dist/parser.js:287:98)
    at ConnectionPool.checkout (/app/dist/db/pool.js:45:19)
    at async AccountService.transferBalance (/app/dist/services/account.js:112:22)
HTTP/1.1 500 Internal Server Error - /api/v1/ledger/batch-settle`
  },
  {
    id: 'redis-stampede',
    name: 'Redis Cache Stampede & Cascading Upstream Timeout',
    category: 'Caching / Distributed Systems',
    service: 'catalog-search-service',
    environment: 'production',
    description: 'Cache cluster memory maxed out causing key eviction. Thousands of concurrent requests bypassed cache and hit MySQL simultaneously.',
    logs: `2026-11-17T21:15:10.005Z [WARN] Redis memory policy 'allkeys-lru' triggered. Evicted 45,000 keys in 1000ms.
2026-11-17T21:15:11.230Z [ERROR] Cache miss for key 'catalog:trending:v2:category_all'. Lock acquisition failed.
2026-11-17T21:15:12.001Z [WARN] Dogpiling detected: 4,200 concurrent queries executing 'SELECT * FROM products JOIN inventory...'
2026-11-17T21:15:14.891Z [ERROR] MySQL server has gone away (wait_timeout=10 exceeded)
2026-11-17T21:15:16.120Z [ERROR] [ioredis] ConnectionTimeoutError: Connection to redis-primary.internal:6379 timed out after 3000ms
2026-11-17T21:15:18.455Z [FATAL] CircuitBreaker[CatalogDB] tripped state: OPEN. 100% of fallback responses returned.`
  },
  {
    id: 'webhook-signature',
    name: 'Stripe Webhook Signature Verification 400/500 Spikes',
    category: 'Third-party Integrations / Security',
    service: 'checkout-webhook-gateway',
    environment: 'production',
    description: 'Post-deployment of raw body parser middleware broke signature verification on incoming payment webhooks.',
    logs: `2026-11-17T20:55:01.320Z [INFO] Incoming POST /api/webhooks/stripe [event: customer.subscription.created]
2026-11-17T20:55:01.325Z [ERROR] StripeSignatureVerificationError: No signatures found matching the expected signature for payload.
Are you passing the raw request body you received from Stripe?
If a webhook request is being modified by a body-parsing middleware, signature verification will fail.
    at Stripe.webhooks.constructEvent (/app/node_modules/stripe/lib/Webhooks.js:68:15)
    at /app/dist/controllers/webhook.js:34:31
2026-11-17T20:55:04.110Z [WARN] Retry attempt 1 from Stripe (ip: 54.187.174.169) returned HTTP 400 Bad Request
2026-11-17T20:55:10.981Z [ALERT] Webhook error rate exceeded 50% threshold over 5-minute rolling window.`
  }
];
