const http = require('http');
const express = require('express');
const WebSocket = require('ws');
const { setupWSConnection } = require('y-websocket/bin/utils');
const { spawn } = require('child_process');
const { randomUUID } = require('crypto');

const app = express();
app.use(express.json());

app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// ── Yjs rooms (for run broadcast) ────────────────────────────────────────────
const rooms = new Map(); // roomId -> Set<ws>

// ── Signaling rooms (for WebRTC voice) ───────────────────────────────────────
const signalRooms = new Map(); // roomId -> Map<peerId, ws>

function broadcastToRoom(roomId, payload) {
  const clients = rooms.get(roomId);
  if (!clients) return;
  const msg = JSON.stringify(payload);
  clients.forEach((ws) => {
    if (ws.readyState === WebSocket.OPEN) ws.send(msg);
  });
}

wss.on('connection', (ws, req) => {
  const url = req.url || '';

  // ── Signaling path: /signal/<roomId> ───────────────────────────────────────
  if (url.startsWith('/signal/')) {
    const roomId = url.slice('/signal/'.length);
    const peerId = randomUUID();

    if (!signalRooms.has(roomId)) signalRooms.set(roomId, new Map());
    const room = signalRooms.get(roomId);
    room.set(peerId, ws);

    // Tell the new peer their ID + who is already here
    ws.send(JSON.stringify({
      type: 'signal_init',
      peerId,
      peers: [...room.keys()].filter(id => id !== peerId),
    }));

    // Tell existing peers someone joined
    room.forEach((peerWs, id) => {
      if (id !== peerId && peerWs.readyState === WebSocket.OPEN) {
        peerWs.send(JSON.stringify({ type: 'signal_peer_joined', peerId }));
      }
    });

    ws.on('message', (data) => {
      try {
        const msg = JSON.parse(data.toString());
        if (msg.to) {
          const target = room.get(msg.to);
          if (target?.readyState === WebSocket.OPEN) {
            target.send(JSON.stringify({ ...msg, from: peerId }));
          }
        }
      } catch { /* binary Yjs frames will land here — safe to ignore */ }
    });

    ws.on('close', () => {
      room.delete(peerId);
      if (room.size === 0) signalRooms.delete(roomId);
      room.forEach((peerWs) => {
        if (peerWs.readyState === WebSocket.OPEN) {
          peerWs.send(JSON.stringify({ type: 'signal_peer_left', peerId }));
        }
      });
    });

    return; // don't fall through to Yjs handler
  }

  // ── Yjs path: /<roomId> ────────────────────────────────────────────────────
  const roomId = url.slice(1) || 'default';
  if (!rooms.has(roomId)) rooms.set(roomId, new Set());
  rooms.get(roomId).add(ws);

  setupWSConnection(ws, req, { gc: true });

  ws.on('close', () => {
    rooms.get(roomId)?.delete(ws);
    if (rooms.get(roomId)?.size === 0) rooms.delete(roomId);
  });
});

// ── POST /run ─────────────────────────────────────────────────────────────────
app.post('/run', (req, res) => {
  const { code, roomId } = req.body;
  if (!code || !roomId) return res.status(400).json({ error: 'Missing code or roomId' });

  broadcastToRoom(roomId, { type: 'run_start' });

  let output = '';
  let errorOutput = '';

  const isWin = process.platform === 'win32';
  const py = spawn(isWin ? 'python' : 'python3', ['-u', '-c', code], { timeout: 10000 });

  py.stdout.on('data', (d) => { output += d.toString(); });
  py.stderr.on('data', (d) => { errorOutput += d.toString(); });

  py.on('close', (exitCode) => {
    const payload = { type: 'run_result', output: output || null, error: errorOutput || null, exitCode };
    broadcastToRoom(roomId, payload);
    res.json(payload);
  });

  py.on('error', (err) => {
    const payload = {
      type: 'run_result', output: null, exitCode: 1,
      error: `Failed to start Python: ${err.message}\nMake sure Python 3 is installed and on PATH.`,
    };
    broadcastToRoom(roomId, payload);
    res.json(payload);
  });
});

app.get('/', (_req, res) => res.send('CodeNest server is running.'));

const PORT = process.env.PORT || 1234;
server.listen(PORT, () => {
  console.log(`✅ CodeNest server listening on http://localhost:${PORT}`);
});
