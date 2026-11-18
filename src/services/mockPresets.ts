import type { IncidentPreset, IncidentRecord } from '../types';

export const LOCAL_PRESETS: IncidentPreset[] = [
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

export function createMockIncident(preset: IncidentPreset): IncidentRecord {
  const id = `inc-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
  const now = new Date().toISOString();

  let severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' = 'HIGH';
  let summary = '';
  let blastRadius = '';
  let hypothesis = '';
  let confidence = 90;
  const actions: any[] = [];
  const diagnosticCommands: any[] = [];

  if (preset.id === 'k8s-oomkilled') {
    severity = 'CRITICAL';
    summary = 'Node.js session worker exceeded container cgroup memory limits (2.00 GiB), resulting in kernel OOM termination (exit code 137) and a persistent CrashLoopBackOff cycle.';
    blastRadius = '50% of active login attempts failing with HTTP 502 Bad Gateway. 4 of 8 pod replicas unavailable.';
    hypothesis = 'Unbounded in-memory session cache accumulation in SessionCache.bulkInsert() without LRU eviction led to heap exhaustion.';
    actions.push({
      id: 'act-1',
      description: 'Increase Kubernetes memory limits to 3.5Gi to stabilize pods immediately',
      type: 'immediate_mitigation',
      status: 'pending',
      command: 'kubectl set resources deployment/auth-session-worker --limits=memory=3.5Gi --requests=memory=2Gi -n production',
      explanation: 'Prevents immediate OOM restarts while permanent memory leak patch is deployed'
    });
    actions.push({
      id: 'act-2',
      description: 'Trigger graceful rolling restart of crashed pods to clear dead sockets',
      type: 'immediate_mitigation',
      status: 'pending',
      command: 'kubectl rollout restart deployment/auth-session-worker -n production',
      explanation: 'Spawns fresh containers with clean memory heaps'
    });
    actions.push({
      id: 'act-3',
      description: 'Implement LRU eviction bounds on SessionStore memory buffer',
      type: 'permanent_fix',
      status: 'pending',
      explanation: 'Caps session cache size at 50,000 entries and writes overflow to Redis'
    });
    diagnosticCommands.push({
      label: 'Inspect Termination Reason & OOM Code',
      command: 'kubectl describe pod -l app=auth-session-worker -n production | grep -E "Exit Code|OOMKilled|Restart Count"',
      explanation: 'Confirms whether Linux kernel killed the container with SIGKILL 137',
      category: 'kubernetes'
    });
    diagnosticCommands.push({
      label: 'Fetch Previous Crash Logs',
      command: 'kubectl logs -l app=auth-session-worker -n production --previous --tail=150',
      explanation: 'Dumps the V8 garbage collection logs right before heap exhaustion',
      category: 'logs'
    });
    diagnosticCommands.push({
      label: 'Real-time Pod Memory Metrics',
      command: 'kubectl top pod -l app=auth-session-worker -n production --containers',
      explanation: 'Displays active memory utilization across all running replicas',
      category: 'system'
    });
  } else if (preset.id === 'postgres-deadlock') {
    severity = 'CRITICAL';
    summary = 'PostgreSQL transaction deadlock between concurrent account balance updates exhausted the connection pool, locking all available pool connections (100/100).';
    blastRadius = 'Checkout and billing payment settlement halted. All dependent APIs returning HTTP 500.';
    hypothesis = 'Circular locking order in AccountService.transferBalance() between account_balances rows (42, 18) acquired in reverse order across two concurrent threads.';
    actions.push({
      id: 'act-1',
      description: 'Terminate blocking queries holding ExclusiveLock',
      type: 'immediate_mitigation',
      status: 'pending',
      command: `psql -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE state = 'active' AND age(clock_timestamp(), query_start) > interval '2 minutes';"`,
      explanation: 'Frees locked rows and unblocks waiting transactions in pool'
    });
    actions.push({
      id: 'act-2',
      description: 'Enforce deterministic row sorting (SELECT ... FOR UPDATE ORDER BY id)',
      type: 'permanent_fix',
      status: 'pending',
      explanation: 'Guarantees transactions acquire row locks in strict ascending ID order, making deadlocks mathematically impossible'
    });
    diagnosticCommands.push({
      label: 'Inspect Blocking Locks Graph',
      command: `psql -c "SELECT blocked_locks.pid AS blocked_pid, blocking_locks.pid AS blocking_pid, blocked_activity.query AS blocked_statement FROM pg_catalog.pg_locks blocked_locks JOIN pg_catalog.pg_stat_activity blocked_activity ON blocked_activity.pid = blocked_locks.pid JOIN pg_catalog.pg_locks blocking_locks ON blocking_locks.locktype = blocked_locks.locktype WHERE NOT blocked_locks.granted;"`,
      explanation: 'Reveals which PID is blocking which query statement',
      category: 'database'
    });
    diagnosticCommands.push({
      label: 'Check Pooler Active & Waiting Clients',
      command: 'psql -p 6432 -U pgbouncer -c "SHOW POOLS;"',
      explanation: 'Shows client connection starvation and queue depth',
      category: 'database'
    });
  } else {
    severity = 'HIGH';
    summary = preset.description;
    blastRadius = 'High volume of customer requests degraded or timing out';
    hypothesis = 'Service integration or resource threshold bottleneck';
    actions.push({
      id: 'act-1',
      description: 'Verify upstream gateway status and error logs',
      type: 'diagnostic',
      status: 'pending',
      command: `curl -iv https://api.production.internal/health -H "Host: ${preset.service}"`,
      explanation: 'Tests connectivity and latency to service endpoint'
    });
    diagnosticCommands.push({
      label: 'Tail System Error Logs',
      command: `journalctl -u ${preset.service} -n 100 --no-pager -p err`,
      explanation: 'Fetches most recent 100 error entries',
      category: 'logs'
    });
  }

  return {
    id,
    title: preset.name,
    severity,
    status: 'INVESTIGATING',
    service: preset.service,
    environment: preset.environment,
    createdAt: now,
    updatedAt: now,
    summary,
    blastRadius,
    rawLogs: preset.logs,
    errorDescription: preset.description,
    rootCauses: [
      {
        hypothesis,
        confidence,
        evidence: [preset.logs.split('\n').filter(l => l.includes('ERROR') || l.includes('FATAL') || l.includes('OOM'))[0] || 'High error frequency in logs'],
        contributingFactors: ['High concurrent client traffic', 'Missing defensive resource threshold safeguards']
      }
    ],
    actionItems: actions,
    diagnosticCommands,
    metrics: {
      errorRate: severity === 'CRITICAL' ? '42.8%' : '14.2%',
      p99Latency: severity === 'CRITICAL' ? '4,850ms' : '1,200ms',
      affectedReplicas: '4 of 8',
      blastRadiusScore: severity === 'CRITICAL' ? 'Critical' : 'Moderate'
    },
    messages: [
      {
        id: `msg-${Date.now()}-1`,
        sender: 'user',
        timestamp: now,
        content: `**Investigating incident logs for ${preset.service}:**\n\`\`\`\n${preset.logs.slice(0, 800)}\n\`\`\`\n\n**Context:** ${preset.description}`
      },
      {
        id: `msg-${Date.now()}-2`,
        sender: 'assistant',
        timestamp: new Date().toISOString(),
        content: `### SRE Incident Triage Report\n\n**Primary Finding:** ${summary}\n\n**Root Cause Hypothesis:** ${hypothesis} *(Confidence: ${confidence}%)*\n\n**Immediate Next Steps:**\n1. Review the immediate mitigation actions in the right-hand panel.\n2. Execute the pre-configured diagnostic commands to confirm container state.\n3. Reply below with diagnostic command output or questions about rollback/patch procedures.`,
        isInitialTriage: true
      }
    ]
  };
}
