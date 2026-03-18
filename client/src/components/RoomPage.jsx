import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import CollabEditor from './CollabEditor';
import VoiceChat from './VoiceChat';

const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:1234';
const WS_URL     = SERVER_URL.replace(/^http/, 'ws');

const STATUS_STYLES = {
  connected:    'bg-green-900 text-green-400',
  connecting:   'bg-yellow-900 text-yellow-400',
  disconnected: 'bg-red-900 text-red-400',
};

export default function RoomPage() {
  const { roomId } = useParams();
  const navigate   = useNavigate();
  const [status, setStatus] = useState('connecting');
  const [yjs, setYjs]       = useState(null);
  const [output, setOutput] = useState(null);
  const [running, setRunning] = useState(false);
  const docRef = useRef(null);

  useEffect(() => {
    const doc      = new Y.Doc();
    const provider = new WebsocketProvider(WS_URL, roomId, doc);
    docRef.current = doc;

    provider.on('status', ({ status }) => setStatus(status));
    setYjs({ doc, provider });

    // Listen for run_start / run_result broadcast from server over the Yjs WS
    function attachListener(p) {
      if (!p.ws) return;
      p.ws.addEventListener('message', onServerMsg);
    }

    function onServerMsg(event) {
      if (typeof event.data !== 'string') return; // Yjs uses binary
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === 'run_start') { setRunning(true); setOutput(null); }
        else if (msg.type === 'run_result') {
          setRunning(false);
          setOutput({ text: msg.error || msg.output || '(no output)', isError: !!msg.error, exitCode: msg.exitCode });
        }
      } catch {}
    }

    provider.on('sync', () => attachListener(provider));
    attachListener(provider);

    return () => {
      provider.destroy();
      doc.destroy();
    };
  }, [roomId]);

  const runCode = async () => {
    if (!docRef.current) return;
    const code = docRef.current.getText('codenest').toString();
    if (!code.trim()) return;
    setRunning(true);
    setOutput(null);
    try {
      await fetch(`${SERVER_URL}/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, roomId }),
      });
    } catch {
      setRunning(false);
      setOutput({ text: 'Could not reach the server.', isError: true, exitCode: 1 });
    }
  };

  return (
    <div className="h-screen bg-gray-950 flex flex-col">

      {/* ── Top header ───────────────────────────────────────────────────── */}
      <header className="flex items-center justify-between px-5 py-3 bg-gray-900 border-b border-gray-800 shrink-0">
        <div className="flex items-center gap-3">
          <span
            className="text-gray-400 text-sm cursor-pointer hover:text-white transition"
            onClick={() => navigate('/')}
          >
            🪺 CodeNest
          </span>
          <span className="text-gray-700">/</span>
          <span className="text-blue-400 font-mono text-sm">{roomId}</span>
          <span className="text-gray-700">·</span>
          <span className="text-gray-500 text-xs font-mono">Python 3</span>
        </div>

        <div className="flex items-center gap-3">
          <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${STATUS_STYLES[status] ?? STATUS_STYLES.disconnected}`}>
            {status}
          </span>
          <button
            onClick={runCode}
            disabled={running || status !== 'connected'}
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm px-4 py-1.5 rounded-lg font-semibold transition"
          >
            {running ? (
              <><span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />Running…</>
            ) : (
              <>▶ Run</>
            )}
          </button>
        </div>
      </header>

      {/* ── Voice chat bar ───────────────────────────────────────────────── */}
      <VoiceChat roomId={roomId} />

      {/* ── Editor + Output ──────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className={output !== null || running ? 'flex-1 overflow-hidden' : 'h-full overflow-hidden'}>
          {yjs ? (
            <CollabEditor doc={yjs.doc} provider={yjs.provider} />
          ) : (
            <div className="flex items-center justify-center h-full text-gray-600 text-sm">
              Connecting to room…
            </div>
          )}
        </div>

        {(output !== null || running) && (
          <div className="h-48 bg-gray-900 border-t border-gray-800 flex flex-col shrink-0">
            <div className="flex items-center px-4 py-2 border-b border-gray-800 gap-2">
              <span className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Output</span>
              {output && (
                <span className={`text-xs font-mono px-2 py-0.5 rounded ${output.isError ? 'bg-red-900 text-red-400' : 'bg-green-900 text-green-400'}`}>
                  exit {output.exitCode}
                </span>
              )}
              <button
                onClick={() => setOutput(null)}
                className="text-gray-600 hover:text-gray-300 text-xs ml-auto transition"
              >
                ✕ close
              </button>
            </div>
            <div className="flex-1 overflow-auto px-4 py-3 font-mono text-sm">
              {running && !output ? (
                <span className="text-yellow-500 animate-pulse">Running Python…</span>
              ) : (
                <pre className={`whitespace-pre-wrap break-words ${output?.isError ? 'text-red-400' : 'text-green-300'}`}>
                  {output?.text}
                </pre>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
