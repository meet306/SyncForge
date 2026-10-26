import WebSocket from 'ws';
import * as Y from 'yjs';
import * as syncProtocol from 'y-protocols/sync';
import * as encoding from 'lib0/encoding';
import * as decoding from 'lib0/decoding';

const BASE_URL = process.env.API_URL || 'http://localhost:5000';
const WS_BASE_URL = process.env.WS_URL || 'ws://localhost:5000';

const NUM_CLIENTS = parseInt(process.env.LOAD_CLIENTS || '15', 10);
const EDITS_PER_CLIENT = parseInt(process.env.LOAD_EDITS || '10', 10);

async function runLoadTest() {
  console.log(`=======================================================`);
  console.log(`⚡ SyncForge Real-Time Collaboration Load Testing Engine`);
  console.log(`Target: ${BASE_URL} / ${WS_BASE_URL}`);
  console.log(`Virtual Collaborators: ${NUM_CLIENTS}`);
  console.log(`Edits per Collaborator: ${EDITS_PER_CLIENT}`);
  console.log(`Total Target Mutations: ${NUM_CLIENTS * EDITS_PER_CLIENT}`);
  console.log(`=======================================================\n`);

  const startTime = Date.now();
  const apiLatencies = [];
  const wsHandshakeLatencies = [];
  const syncLatencies = [];
  let successfulEdits = 0;
  let connectionErrors = 0;

  // 1. Register & Login a master user to create the test document
  const masterEmail = `load_master_${Date.now()}@syncforge.local`;
  const t0 = performance.now();
  const regRes = await fetch(`${BASE_URL}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Load Master',
      email: masterEmail,
      password: 'Password123!'
    })
  });
  apiLatencies.push(performance.now() - t0);

  if (!regRes.ok) {
    throw new Error(`Failed to create master user: ${await regRes.text()}`);
  }
  const { token: masterToken, user: masterUser } = await regRes.json();

  // 2. Create target document
  const tDoc0 = performance.now();
  const docRes = await fetch(`${BASE_URL}/api/documents`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${masterToken}`
    },
    body: JSON.stringify({
      title: `Load Test Benchmark Document [${new Date().toISOString()}]`
    })
  });
  apiLatencies.push(performance.now() - tDoc0);
  const { document: testDoc } = await docRes.json();
  const documentId = testDoc._id;
  console.log(`[Setup] Created target document ${documentId}`);

  // 3. Register client users and add them as editors
  console.log(`[Setup] Registering ${NUM_CLIENTS} virtual collaborators...`);
  const clients = [];

  for (let i = 0; i < NUM_CLIENTS; i++) {
    const email = `load_client_${i}_${Date.now()}@syncforge.local`;
    const tStart = performance.now();
    const r = await fetch(`${BASE_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: `Collaborator ${i + 1}`,
        email,
        password: 'Password123!'
      })
    });
    apiLatencies.push(performance.now() - tStart);
    const data = await r.json();

    // Add user as editor to document
    await fetch(`${BASE_URL}/api/documents/${documentId}/members`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${masterToken}`
      },
      body: JSON.stringify({
        email,
        role: 'editor'
      })
    });

    clients.push({
      id: i,
      user: data.user,
      token: data.token,
      ydoc: new Y.Doc(),
      ws: null,
      receivedUpdates: 0
    });
  }

  // 4. Connect WebSockets simultaneously
  console.log(`[WebSocket] Establishing ${NUM_CLIENTS} concurrent real-time connections...`);
  const connectionPromises = clients.map((c) => {
    return new Promise((resolve, reject) => {
      const connStart = performance.now();
      const wsUrl = `${WS_BASE_URL}/collaboration/${documentId}?token=${c.token}`;
      const ws = new WebSocket(wsUrl);

      ws.on('open', () => {
        wsHandshakeLatencies.push(performance.now() - connStart);
        c.ws = ws;
        resolve(ws);
      });

      ws.on('error', (err) => {
        connectionErrors++;
        console.error(`Client ${c.id} WS error:`, err.message);
        resolve(null);
      });

      ws.on('message', (data) => {
        try {
          const decoder = decoding.createDecoder(new Uint8Array(data));
          const messageType = decoding.readVarUint(decoder);
          if (messageType === 0 /* MESSAGE_SYNC */) {
            const syncType = decoding.readVarUint(decoder);
            if (syncType === syncProtocol.messageYjsSyncStep1) {
              const reply = encoding.createEncoder();
              encoding.writeVarUint(reply, 0);
              syncProtocol.writeSyncStep2(reply, c.ydoc, decoding.readVarUint8Array(decoder));
              ws.send(encoding.toUint8Array(reply));
            } else if (syncType === syncProtocol.messageYjsSyncStep2 || syncType === syncProtocol.messageYjsUpdate) {
              const update = decoding.readVarUint8Array(decoder);
              Y.applyUpdate(c.ydoc, update, 'remote');
              c.receivedUpdates++;
            }
          }
        } catch (e) {
          // ignore parsing error in test
        }
      });
    });
  });

  await Promise.all(connectionPromises);
  console.log(`[WebSocket] Connected: ${clients.filter((c) => c.ws && c.ws.readyState === 1).length} / ${NUM_CLIENTS}`);

  // 5. Fire concurrent edits across all clients
  console.log(`[Load Phase] Emitting concurrent CRDT edits across all clients...`);
  const editPromises = [];

  for (let round = 0; round < EDITS_PER_CLIENT; round++) {
    for (const c of clients) {
      if (!c.ws || c.ws.readyState !== 1) continue;

      const editPromise = new Promise((resolve) => {
        setTimeout(() => {
          const tEditStart = performance.now();
          const text = c.ydoc.getText('content');
          text.insert(text.length, `[C${c.id}-R${round}] `);

          const update = Y.encodeStateAsUpdate(c.ydoc);
          const encoder = encoding.createEncoder();
          encoding.writeVarUint(encoder, 0 /* MESSAGE_SYNC */);
          syncProtocol.writeUpdate(encoder, update);

          c.ws.send(encoding.toUint8Array(encoder), (err) => {
            if (!err) {
              successfulEdits++;
              syncLatencies.push(performance.now() - tEditStart);
            }
            resolve();
          });
        }, round * 30 + Math.random() * 20); // semi-staggered realistic user cadence
      });

      editPromises.push(editPromise);
    }
  }

  await Promise.all(editPromises);

  // Give 1 second for remaining packets to settle
  await new Promise((r) => setTimeout(r, 1000));

  // 6. Fetch server metrics
  let serverMetrics = null;
  try {
    const metricsRes = await fetch(`${BASE_URL}/api/metrics`);
    if (metricsRes.ok) {
      serverMetrics = await metricsRes.json();
    }
  } catch {
    // server metrics optional if running standalone
  }

  // 7. Cleanup WebSocket connections
  for (const c of clients) {
    if (c.ws) c.ws.close();
  }

  const durationSec = (Date.now() - startTime) / 1000;
  const throughput = (successfulEdits / durationSec).toFixed(2);

  // Compute statistics helper
  const calcStats = (arr) => {
    if (arr.length === 0) return { mean: 0, p50: 0, p95: 0, p99: 0 };
    const sorted = [...arr].sort((a, b) => a - b);
    const sum = sorted.reduce((acc, v) => acc + v, 0);
    return {
      mean: (sum / sorted.length).toFixed(2),
      p50: sorted[Math.floor(sorted.length * 0.5)].toFixed(2),
      p95: sorted[Math.floor(sorted.length * 0.95)].toFixed(2),
      p99: sorted[Math.floor(sorted.length * 0.99)].toFixed(2)
    };
  };

  const apiStats = calcStats(apiLatencies);
  const wsStats = calcStats(wsHandshakeLatencies);
  const syncStats = calcStats(syncLatencies);

  console.log(`\n=======================================================`);
  console.log(`📊 SyncForge Load Test Benchmark Results`);
  console.log(`=======================================================`);
  console.log(`Total Duration:           ${durationSec.toFixed(2)}s`);
  console.log(`Successful CRDT Edits:    ${successfulEdits} / ${NUM_CLIENTS * EDITS_PER_CLIENT}`);
  console.log(`Throughput:               ${throughput} ops/sec`);
  console.log(`Connection Drops / Errors: ${connectionErrors}`);
  console.log(`-------------------------------------------------------`);
  console.log(`REST API Latency:         Mean: ${apiStats.mean}ms | p50: ${apiStats.p50}ms | p95: ${apiStats.p95}ms | p99: ${apiStats.p99}ms`);
  console.log(`WS Handshake Latency:     Mean: ${wsStats.mean}ms | p50: ${wsStats.p50}ms | p95: ${wsStats.p95}ms | p99: ${wsStats.p99}ms`);
  console.log(`Sync Latency:             Mean: ${syncStats.mean}ms | p50: ${syncStats.p50}ms | p95: ${syncStats.p95}ms | p99: ${syncStats.p99}ms`);
  if (serverMetrics) {
    console.log(`-------------------------------------------------------`);
    console.log(`Server Heap Memory:       ${serverMetrics.process.memory.heapUsedMb} MB / ${serverMetrics.process.memory.heapTotalMb} MB`);
    console.log(`Server RSS Memory:        ${serverMetrics.process.memory.rssMb} MB`);
    console.log(`Server Active Rooms:      ${serverMetrics.collaboration.activeRooms}`);
  }
  console.log(`=======================================================\n`);
}

runLoadTest().catch((err) => {
  console.error('[Load Test Error]:', err);
  process.exit(1);
});
