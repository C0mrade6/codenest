import { useEffect, useRef, useState } from 'react';

const STUN_CONFIG = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
};

function getSignalUrl(roomId) {
  const base = import.meta.env.VITE_SERVER_URL || 'http://localhost:1234';
  return base.replace(/^http/, 'ws') + '/signal/' + roomId;
}

export default function VoiceChat({ roomId }) {
  const [joined, setJoined]   = useState(false);
  const [muted, setMuted]     = useState(false);
  const [peers, setPeers]     = useState([]); // [peerId, ...]
  const [error, setError]     = useState(null);

  const wsRef      = useRef(null);
  const streamRef  = useRef(null);
  const pcsRef     = useRef({});    // peerId → RTCPeerConnection
  const audiosRef  = useRef({});    // peerId → HTMLAudioElement

  // ── helpers ──────────────────────────────────────────────────────────────
  function makePC(peerId) {
    const pc = new RTCPeerConnection(STUN_CONFIG);
    pcsRef.current[peerId] = pc;

    // Attach local mic tracks
    streamRef.current?.getTracks().forEach(t => pc.addTrack(t, streamRef.current));

    // Play remote audio
    pc.ontrack = ({ streams }) => {
      if (!audiosRef.current[peerId]) {
        const el = new Audio();
        el.autoplay = true;
        audiosRef.current[peerId] = el;
      }
      audiosRef.current[peerId].srcObject = streams[0];
    };

    // Forward ICE candidates via signaling WS
    pc.onicecandidate = ({ candidate }) => {
      if (candidate && wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'signal_ice', to: peerId, candidate }));
      }
    };

    pc.onconnectionstatechange = () => {
      if (['disconnected', 'failed', 'closed'].includes(pc.connectionState)) {
        removePeer(peerId);
      }
    };

    return pc;
  }

  function removePeer(peerId) {
    pcsRef.current[peerId]?.close();
    delete pcsRef.current[peerId];
    audiosRef.current[peerId]?.pause();
    delete audiosRef.current[peerId];
    setPeers(prev => prev.filter(id => id !== peerId));
  }

  function cleanup() {
    wsRef.current?.close();
    streamRef.current?.getTracks().forEach(t => t.stop());
    Object.values(pcsRef.current).forEach(pc => pc.close());
    pcsRef.current  = {};
    audiosRef.current = {};
    streamRef.current = null;
    wsRef.current   = null;
  }

  // ── join ─────────────────────────────────────────────────────────────────
  async function joinVoice() {
    setError(null);
    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    } catch {
      setError('Microphone access denied.');
      return;
    }
    streamRef.current = stream;

    const ws = new WebSocket(getSignalUrl(roomId));
    wsRef.current = ws;

    ws.onclose = () => {
      if (joined) leaveVoice();
    };

    ws.onmessage = async ({ data }) => {
      let msg;
      try { msg = JSON.parse(data); } catch { return; }

      if (msg.type === 'signal_init') {
        // New joiner → create offer to every existing peer
        setJoined(true);
        for (const pid of msg.peers) {
          setPeers(prev => prev.includes(pid) ? prev : [...prev, pid]);
          const pc = makePC(pid);
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          ws.send(JSON.stringify({ type: 'signal_offer', to: pid, offer }));
        }

      } else if (msg.type === 'signal_peer_joined') {
        // Someone else joined — they'll send us an offer; just track them
        setPeers(prev => prev.includes(msg.peerId) ? prev : [...prev, msg.peerId]);

      } else if (msg.type === 'signal_offer') {
        // Received offer from new joiner → answer
        let pc = pcsRef.current[msg.from];
        if (!pc) {
          setPeers(prev => prev.includes(msg.from) ? prev : [...prev, msg.from]);
          pc = makePC(msg.from);
        }
        await pc.setRemoteDescription(msg.offer);
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        ws.send(JSON.stringify({ type: 'signal_answer', to: msg.from, answer }));

      } else if (msg.type === 'signal_answer') {
        await pcsRef.current[msg.from]?.setRemoteDescription(msg.answer);

      } else if (msg.type === 'signal_ice') {
        try { await pcsRef.current[msg.from]?.addIceCandidate(msg.candidate); } catch {}

      } else if (msg.type === 'signal_peer_left') {
        removePeer(msg.peerId);
      }
    };
  }

  // ── leave ─────────────────────────────────────────────────────────────────
  function leaveVoice() {
    cleanup();
    setJoined(false);
    setMuted(false);
    setPeers([]);
  }

  function toggleMute() {
    streamRef.current?.getAudioTracks().forEach(t => { t.enabled = muted; });
    setMuted(m => !m);
  }

  useEffect(() => () => cleanup(), []);

  // ── UI ────────────────────────────────────────────────────────────────────
  return (
    <div className="flex items-center gap-3 px-5 py-2 bg-gray-900 border-b border-gray-800 shrink-0">
      <span className="text-xs font-semibold text-gray-500 uppercase tracking-widest">Voice</span>

      {!joined ? (
        <button
          onClick={joinVoice}
          className="flex items-center gap-1.5 text-xs bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1 rounded-lg font-medium transition"
        >
          🎙 Join Voice
        </button>
      ) : (
        <>
          <button
            onClick={toggleMute}
            className={`text-xs px-3 py-1 rounded-lg font-medium transition ${
              muted
                ? 'bg-red-800 hover:bg-red-700 text-red-200'
                : 'bg-gray-700 hover:bg-gray-600 text-white'
            }`}
          >
            {muted ? '🔇 Muted' : '🎙 Live'}
          </button>

          <button
            onClick={leaveVoice}
            className="text-xs text-gray-500 hover:text-red-400 transition"
          >
            Leave
          </button>

          {/* Peer indicators */}
          <div className="flex items-center gap-1 ml-1">
            <span
              className="w-6 h-6 rounded-full bg-indigo-700 flex items-center justify-center text-xs"
              title="You"
            >
              {muted ? '🔇' : '🎙'}
            </span>
            {peers.map(pid => (
              <span
                key={pid}
                className="w-6 h-6 rounded-full bg-gray-600 flex items-center justify-center text-xs"
                title={`Peer ${pid.slice(0, 6)}`}
              >
                🎧
              </span>
            ))}
            {peers.length === 0 && (
              <span className="text-xs text-gray-600 italic">waiting for others…</span>
            )}
          </div>
        </>
      )}

      {error && <span className="text-xs text-red-400 ml-2">{error}</span>}
    </div>
  );
}
