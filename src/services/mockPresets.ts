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
    id: 'sparse-ambiguous',
    name: 'Ambiguous Microservice Timeout (Low Confidence / Missing Logs)',
    category: 'Edge Cases / Low Confidence',
    service: 'notification-dispatcher',
    environment: 'staging',
    description: 'Intermittent socket hangup reported without full stack trace. Tests the assistant safety guards when evidence is incomplete.',
    logs: `2026-11-17T20:10:04.112Z [WARN] Socket hangup after 15000ms
2026-11-17T20:10:05.801Z [ERROR] Request failed
2026-11-17T20:10:09.914Z [WARN] Retrying batch dispatch...`
  }
];

export function createMockIncident(preset: IncidentPreset): IncidentRecord {
  const id = `inc-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
  const now = new Date().toISOString();

  if (preset.id === 'sparse-ambiguous') {
    return {
      id,
      title: 'Ambiguous Dispatcher Timeout (Low Confidence: 35%)',
      severity: 'MEDIUM',
      status: 'INVESTIGATING',
      service: preset.service,
      environment: preset.environment,
      createdAt: now,
      updatedAt: now,
      summary: 'The submitted log snippet is sparse and lacks stack traces or HTTP error codes. Root cause cannot be confirmed with certainty.',
      blastRadius: 'Intermittent delivery delays for staging notification jobs.',
      rawLogs: preset.logs,
      errorDescription: preset.description,
      errorUnderstanding: {
        failureMechanism: 'Undetermined socket hangup or transport timeout',
        affectedComponent: preset.service,
        extractedErrorCodes: ['SOCKET_HANGUP', 'TIMEOUT_15000MS'],
        timeline: ['Socket hangup after 15s', 'Generic request failure logged', 'Retry initiated'],
      },
      severityAssessment: {
        severity: 'MEDIUM',
        justification: 'Degradation is restricted to asynchronous batch notifications in staging without cascade.',
        blastRadius: 'Non-blocking background queues.',
        impactedAudiences: ['Staging QA engineers'],
      },
      confidenceAssessment: {
        isConfident: false,
        primaryConfidence: 35,
        ambiguityExplanation: 'Logs do not provide the destination host, HTTP status code, or socket stack trace. Upstream firewall drop vs worker thread hang remain equally probable.',
        missingTelemetry: [
          'Full application stack trace with line numbers',
          'Destination IP and port of the remote socket',
          'Network packet capture (tcpdump / ss metrics)',
          'Dispatcher worker thread pool saturation metrics',
        ],
      },
      crossIncidentReferences: [],
      rootCauses: [
        {
          hypothesis: 'Remote service latency exceeded client-side 15-second socket timeout',
          confidence: 35,
          evidence: ['Socket hangup after 15000ms'],
          contributingFactors: ['Missing connection timeout jitter', 'Log verbosity level too low'],
        },
      ],
      actionItems: [
        {
          id: 'act-1',
          description: 'Enable DEBUG logging on notification dispatcher to capture remote host',
          type: 'diagnostic',
          priority: 'p1',
          status: 'pending',
          command: `kubectl set env deployment/${preset.service} DEBUG=http,socket*`,
          explanation: 'Exposes target URL and socket connection milestones',
        },
        {
          id: 'act-2',
          description: 'Verify network connectivity to external notification gateways',
          type: 'diagnostic',
          priority: 'p2',
          status: 'pending',
          command: 'curl -iv --max-time 5 https://fcm.googleapis.com/fcm/send',
          explanation: 'Checks for DNS resolution or TLS handshake blocking',
        },
      ],
      diagnosticCommands: [
        {
          label: 'Tail Live Dispatcher Logs',
          command: `kubectl logs -f -l app=${preset.service} --tail=100`,
          explanation: 'Monitors incoming and outgoing socket requests in real time',
          category: 'logs',
        },
      ],
      metrics: {
        errorRate: '12% of queue tasks',
        p99Latency: '15,000ms (timeout limit)',
        affectedReplicas: '1 of 2',
        blastRadiusScore: 'Low-to-Moderate',
      },
      messages: [
        {
          id: `msg-${Date.now()}-1`,
          sender: 'user',
          timestamp: now,
          content: `**Investigating logs for ${preset.service}:**\n\`\`\`\n${preset.logs}\n\`\`\`\n\n**Context:** ${preset.description}`,
        },
        {
          id: `msg-${Date.now()}-2`,
          sender: 'assistant',
          timestamp: new Date().toISOString(),
          content: `### ⚠️ Inconclusive Triage (Confidence: 35%)\n\nThe submitted logs indicate a socket timeout, but do not contain destination URLs or stack traces.\n\n**Why this diagnosis is ambiguous:**\n- No remote IP address or port specified.\n- No DNS or TLS handshake telemetry recorded.\n\nI have prioritized non-destructive diagnostic actions (P1/P2) in the right panel to capture definitive telemetry without risking production disruptions.`,
          isInitialTriage: true,
        },
      ],
    };
  }

  if (preset.id === 'k8s-oomkilled') {
    return {
      id,
      title: 'Kubernetes Pod OOMKilled & CrashLoopBackOff',
      severity: 'CRITICAL',
      status: 'INVESTIGATING',
      service: preset.service,
      environment: preset.environment,
      createdAt: now,
      updatedAt: now,
      summary: 'Node.js session worker exceeded container cgroup memory limits (2.00 GiB), resulting in kernel OOM termination (exit code 137) and a persistent CrashLoopBackOff cycle.',
      blastRadius: '50% of active login attempts failing with HTTP 502 Bad Gateway. 4 of 8 pod replicas unavailable.',
      rawLogs: preset.logs,
      errorDescription: preset.description,
      errorUnderstanding: {
        failureMechanism: 'Linux kernel OOM killer termination (SIGKILL exit code 137)',
        affectedComponent: 'V8 Old Space Heap / SessionCache.bulkInsert()',
        extractedErrorCodes: ['Exit Code: 137', 'OOMKilled', 'CrashLoopBackOff', 'JavaScript heap out of memory'],
        timeline: [
          '21:44:02 Initializing SessionStore with max_cache_size=100000',
          '21:44:15 Memory usage at 85% (1.70GiB / 2.00GiB limit)',
          '21:44:28 Failed to allocate 128MB buffer for user session batch',
          '21:44:30 Mark-compact GC allocation failure & SIGKILL 137',
        ],
      },
      severityAssessment: {
        severity: 'CRITICAL',
        justification: 'Critical customer-facing outage: Authentication service is crash-looping, preventing users from logging in.',
        blastRadius: '50% of user logins failing. Cascading 502s on API gateway.',
        impactedAudiences: ['All unauthenticated user sessions', 'SSO authentication flow'],
      },
      confidenceAssessment: {
        isConfident: true,
        primaryConfidence: 96,
        missingTelemetry: ['V8 heap snapshot profile to pinpoint exact lingering object retainers'],
      },
      crossIncidentReferences: [],
      rootCauses: [
        {
          hypothesis: 'Unbounded in-memory session cache accumulation in SessionCache.bulkInsert() without LRU eviction led to heap exhaustion',
          confidence: 96,
          evidence: [
            'FATAL ERROR: Ineffective mark-compacts near heap limit Allocation failed - JavaScript heap out of memory',
            'Pod auth-session-worker-7df9bf885c-4kx9z terminated with Exit Code: 137 (OOMKilled)',
          ],
          contributingFactors: [
            'High batch insertion rate during peak login traffic',
            'Missing cgroup memory ceiling headroom (limit set at 2.0GiB)',
          ],
        },
      ],
      actionItems: [
        {
          id: 'act-1',
          description: 'Scale deployment container memory limits to 3.5Gi immediately to halt crash loop',
          type: 'immediate_mitigation',
          priority: 'p1',
          status: 'pending',
          command: 'kubectl set resources deployment/auth-session-worker --limits=memory=3.5Gi --requests=memory=2Gi -n production',
          explanation: 'Provides immediate memory ceiling to stabilize running pods',
        },
        {
          id: 'act-2',
          description: 'Trigger graceful rolling restart of crashed pods to clear dead sockets',
          type: 'immediate_mitigation',
          priority: 'p1',
          status: 'pending',
          command: 'kubectl rollout restart deployment/auth-session-worker -n production',
          explanation: 'Spawns fresh containers with clean memory heaps',
        },
        {
          id: 'act-3',
          description: 'Inspect live memory metrics after restart to verify stabilization',
          type: 'diagnostic',
          priority: 'p2',
          status: 'pending',
          command: 'kubectl top pod -l app=auth-session-worker -n production --containers',
          explanation: 'Confirms memory plateau below 60% of new limit',
        },
        {
          id: 'act-4',
          description: 'Implement LRU eviction bounds and externalize session store to Redis cluster',
          type: 'permanent_fix',
          priority: 'p3',
          status: 'pending',
          explanation: 'Caps in-memory session cache at 50,000 entries to prevent process heap leaks',
        },
      ],
      diagnosticCommands: [
        {
          label: 'Inspect Pod OOM Status & Restart Reason',
          command: 'kubectl describe pod -l app=auth-session-worker -n production | grep -E "Exit Code|OOMKilled|Restart Count"',
          explanation: 'Confirms container was terminated by kernel OOM killer with code 137',
          category: 'kubernetes',
        },
        {
          label: 'Fetch Previous Crash GC Logs',
          command: 'kubectl logs -l app=auth-session-worker -n production --previous --tail=150',
          explanation: 'Dumps V8 memory allocation failure stats right before termination',
          category: 'logs',
        },
        {
          label: 'Real-time Pod Resource Metrics',
          command: 'kubectl top pod -l app=auth-session-worker -n production --containers',
          explanation: 'Displays CPU and memory utilization across active replicas',
          category: 'system',
        },
      ],
      metrics: {
        errorRate: '48.2%',
        p99Latency: '4,200ms',
        affectedReplicas: '4 of 8',
        blastRadiusScore: 'Critical',
      },
      messages: [
        {
          id: `msg-${Date.now()}-1`,
          sender: 'user',
          timestamp: now,
          content: `**Investigating incident logs for ${preset.service}:**\n\`\`\`\n${preset.logs.slice(0, 800)}\n\`\`\`\n\n**Context:** ${preset.description}`,
        },
        {
          id: `msg-${Date.now()}-2`,
          sender: 'assistant',
          timestamp: new Date().toISOString(),
          content: `### SRE Structured Incident Triage (Stage 1-4)\n\n**Stage 1: Error Understanding**\n- **Failure Mechanism:** Linux kernel OOM termination (SIGKILL exit code 137).\n- **Affected Component:** V8 Heap / \`SessionCache.bulkInsert()\`, failing at 1.98 GB.\n\n**Stage 2: Severity Categorization**\n- **Severity:** \`CRITICAL\`\n- **Justification:** Cascading 502 Bad Gateway errors affecting 50% of user authentication traffic.\n\n**Stage 3: Root Cause Analysis (Confidence: 96%)**\n- **Primary Hypothesis:** Unbounded in-memory session cache buffer without LRU expiration under high concurrent logins.\n\n**Stage 4: Prioritized Troubleshooting Plan**\n- **P1 Immediate:** Increase memory limits to 3.5Gi (\`kubectl set resources\`) and execute rolling restart.\n- **P2 Diagnostic:** Monitor live memory curves with \`kubectl top pod\`.\n- **P3 Permanent:** Enforce LRU cache limits and offload session state to Redis.\n\nReview the prioritized plan in the right panel and execute P1 steps immediately.`,
          isInitialTriage: true,
        },
      ],
    };
  }

  // Default Postgres Deadlock or fallback
  return {
    id,
    title: 'PostgreSQL Connection Exhaustion & Deadlock',
    severity: 'CRITICAL',
    status: 'INVESTIGATING',
    service: preset.service,
    environment: preset.environment,
    createdAt: now,
    updatedAt: now,
    summary: 'PostgreSQL transaction deadlock between concurrent account balance updates exhausted the connection pool (100/100 active connections), blocking incoming billing settlements.',
    blastRadius: 'All settlement batches failing with HTTP 500. Upstream checkout timeouts.',
    rawLogs: preset.logs,
    errorDescription: preset.description,
    errorUnderstanding: {
      failureMechanism: 'Mutual ExclusiveLock circular wait & pg-pool slot exhaustion',
      affectedComponent: 'PostgreSQL relation `account_balances` / pg-pool',
      extractedErrorCodes: ['deadlock detected', 'remaining connection slots reserved', 'HTTP 500'],
      timeline: [
        '21:30:05 Process 41284 ExclusiveLock on 16402 blocked by 41299',
        '21:30:12 Pool acquisition timeout after 5000ms (100/100 active)',
        '21:30:15 Connection slots reserved for non-replication superuser',
      ],
    },
    severityAssessment: {
      severity: 'CRITICAL',
      justification: 'Database connection pool completely saturated; all billing and settlement transactions halted.',
      blastRadius: '100% of payment settlements failing.',
      impactedAudiences: ['Checkout payment processor', 'Billing batch ledger'],
    },
    confidenceAssessment: {
      isConfident: true,
      primaryConfidence: 92,
      missingTelemetry: ['Full query text for PID 41284 and 41299 from pg_stat_activity'],
    },
    crossIncidentReferences: [],
    rootCauses: [
      {
        hypothesis: 'Circular transaction lock ordering on account_balances tuples (42, 18) acquired in reverse order across two concurrent threads',
        confidence: 92,
        evidence: [
          'Process 41284 waits for ExclusiveLock on relation 16402; blocked by process 41299',
          'Connection pool acquisition timeout after 5000ms. Active: 100/100',
        ],
        contributingFactors: ['Missing deterministic ordering in batch UPDATE queries', 'Connection pool size insufficient for slow transactions'],
      },
    ],
    actionItems: [
      {
        id: 'act-1',
        description: 'Terminate blocking queries holding locks over 2 minutes',
        type: 'immediate_mitigation',
        priority: 'p1',
        status: 'pending',
        command: `psql -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE state = 'active' AND age(clock_timestamp(), query_start) > interval '2 minutes';"`,
        explanation: 'Instantly releases ExclusiveLock and drains the saturated connection pool',
      },
      {
        id: 'act-2',
        description: 'Verify connection pooler (PgBouncer) queue depth',
        type: 'diagnostic',
        priority: 'p2',
        status: 'pending',
        command: 'psql -p 6432 -U pgbouncer -c "SHOW POOLS;"',
        explanation: 'Ensures waiting clients are served once deadlocks are terminated',
      },
      {
        id: 'act-3',
        description: 'Enforce deterministic row sorting (SELECT ... FOR UPDATE ORDER BY id)',
        type: 'permanent_fix',
        priority: 'p3',
        status: 'pending',
        explanation: 'Guarantees transactions acquire row locks in strict ascending ID order, making deadlocks mathematically impossible',
      },
    ],
    diagnosticCommands: [
      {
        label: 'Inspect Blocking Locks Graph',
        command: `psql -c "SELECT blocked_locks.pid AS blocked_pid, blocking_locks.pid AS blocking_pid, blocked_activity.query AS blocked_statement FROM pg_catalog.pg_locks blocked_locks JOIN pg_catalog.pg_stat_activity blocked_activity ON blocked_activity.pid = blocked_locks.pid JOIN pg_catalog.pg_locks blocking_locks ON blocking_locks.locktype = blocked_locks.locktype WHERE NOT blocked_locks.granted;"`,
        explanation: 'Identifies which PID is blocking which query statement',
        category: 'database',
      },
      {
        label: 'Check Pooler Active & Waiting Clients',
        command: 'psql -p 6432 -U pgbouncer -c "SHOW POOLS;"',
        explanation: 'Shows client connection starvation and queue depth',
        category: 'database',
      },
    ],
    metrics: {
      errorRate: '100% of batch settlements',
      p99Latency: '5,000ms (pool acquisition timeout)',
      affectedReplicas: 'All API workers connecting to primary DB',
      blastRadiusScore: 'Critical',
    },
    messages: [
      {
        id: `msg-${Date.now()}-1`,
        sender: 'user',
        timestamp: now,
        content: `**Investigating incident logs for ${preset.service}:**\n\`\`\`\n${preset.logs.slice(0, 800)}\n\`\`\`\n\n**Context:** ${preset.description}`,
      },
      {
        id: `msg-${Date.now()}-2`,
        sender: 'assistant',
        timestamp: new Date().toISOString(),
        content: `### SRE Structured Incident Triage (Stage 1-4)\n\n**Stage 1: Error Understanding**\n- **Failure Mechanism:** PostgreSQL transaction deadlock between PIDs 41284 and 41299 holding exclusive locks on \`account_balances\`.\n- **Cascade:** Pool exhaustion (100/100 active) blocking all subsequent connections.\n\n**Stage 2: Severity:** \`CRITICAL\` (Billing ledger settlement completely halted).\n\n**Stage 3: Root Cause (Confidence: 92%)**\n- Circular locking sequence on tuples (42, 18).\n\n**Stage 4: Prioritized Troubleshooting Plan**\n- **P1 Immediate:** Terminate blocking backends via \`pg_terminate_backend\` to unblock pool.\n- **P2 Diagnostic:** Run lock graph query to confirm no orphaned locks remain.\n- **P3 Permanent:** Enforce sorted lock acquisition (\`ORDER BY id\`).`,
        isInitialTriage: true,
      },
    ],
  };
}
