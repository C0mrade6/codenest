import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function LandingPage() {
  const [roomId, setRoomId] = useState('');
  const navigate = useNavigate();

  const handleJoin = () => {
    const trimmed = roomId.trim();
    if (trimmed) navigate(`/room/${trimmed}`);
  };

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <div className="bg-gray-900 border border-gray-700 p-10 rounded-2xl shadow-2xl w-full max-w-sm">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-white tracking-tight">🪺 CodeNest</h1>
          <p className="text-gray-400 text-sm mt-1">Real-time collaborative code editing</p>
        </div>

        <label className="block text-gray-400 text-xs font-semibold uppercase mb-2 tracking-widest">
          Room ID
        </label>
        <input
          className="w-full bg-gray-800 text-white placeholder-gray-600 px-4 py-2.5 rounded-lg border border-gray-700 outline-none focus:ring-2 focus:ring-blue-500 font-mono mb-4 transition"
          placeholder="e.g. project-alpha"
          value={roomId}
          onChange={(e) => setRoomId(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
          autoFocus
        />
        <button
          onClick={handleJoin}
          disabled={!roomId.trim()}
          className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white py-2.5 rounded-lg font-semibold transition"
        >
          Join Room →
        </button>
      </div>
    </div>
  );
}
