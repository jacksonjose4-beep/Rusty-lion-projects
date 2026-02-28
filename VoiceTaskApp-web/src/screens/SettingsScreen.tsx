import React, { useEffect, useState } from 'react';
import * as db from '../services/db';

const OLLAMA_MODELS = ['phi3:mini', 'llama3.2:3b', 'mistral:7b'];

export default function SettingsScreen() {
  const [ollamaUrl,        setOllamaUrl]        = useState('http://localhost:11434');
  const [ollamaModel,      setOllamaModel]      = useState('phi3:mini');
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'ok' | 'error'>('idle');
  const [testing,          setTesting]          = useState(false);

  useEffect(() => {
    (async () => {
      setOllamaUrl(  await db.getSetting('ollamaUrl',   'http://localhost:11434'));
      setOllamaModel(await db.getSetting('ollamaModel', 'phi3:mini'));
    })();
  }, []);

  const save = (key: string, value: string) => db.setSetting(key, value);

  const testConnection = async () => {
    setTesting(true);
    setConnectionStatus('idle');
    try {
      const res = await fetch(`${ollamaUrl}/api/tags`);
      setConnectionStatus(res.ok ? 'ok' : 'error');
    } catch {
      setConnectionStatus('error');
    } finally {
      setTesting(false);
    }
  };

  const confirmClearAll = async () => {
    if (!window.confirm('This permanently deletes ALL todos, reminders, thoughts, and drafts. Are you sure?')) return;
    // Delete all IndexedDB databases and reload
    const dbs = await indexedDB.databases();
    for (const d of dbs) { if (d.name) indexedDB.deleteDatabase(d.name); }
    window.location.reload();
  };

  return (
    <div className="flex flex-col flex-1 min-h-0 bg-slate-950 overflow-y-auto no-scrollbar">
      <div className="p-5">
        <h1 className="text-3xl font-bold text-slate-100 mb-6">Settings</h1>

        {/* ── Ollama ─────────────────────────────────────────────────── */}
        <p className="text-xs font-semibold text-indigo-400 uppercase tracking-widest mb-2">
          Ollama (LLM)
        </p>
        <div className="bg-slate-800 rounded-2xl p-4 mb-5 space-y-3">
          <div>
            <label className="text-xs text-slate-400 font-semibold block mb-1">Base URL</label>
            <input
              type="url"
              className="w-full bg-slate-950 rounded-lg px-3 py-2 text-sm text-slate-200 font-mono outline-none"
              value={ollamaUrl}
              onChange={(e) => { setOllamaUrl(e.target.value); save('ollamaUrl', e.target.value); }}
              placeholder="http://localhost:11434"
            />
          </div>

          <div>
            <label className="text-xs text-slate-400 font-semibold block mb-1.5">Model</label>
            <div className="flex flex-wrap gap-2">
              {OLLAMA_MODELS.map((m) => (
                <button
                  key={m}
                  onClick={() => { setOllamaModel(m); save('ollamaModel', m); }}
                  className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
                    ollamaModel === m
                      ? 'bg-indigo-600 border-indigo-500 text-white font-semibold'
                      : 'bg-slate-950 border-slate-700 text-slate-400'
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={testConnection}
            disabled={testing}
            className="w-full bg-slate-700 hover:bg-slate-600 text-slate-200 font-semibold py-2.5 rounded-lg text-sm transition-colors"
          >
            {testing ? 'Testing…' : 'Test Connection'}
          </button>

          {connectionStatus === 'ok'    && <p className="text-green-500 text-sm">✓ Connected</p>}
          {connectionStatus === 'error' && (
            <p className="text-red-400 text-sm">
              Could not reach Ollama. Make sure Ollama is running and set{' '}
              <code className="bg-slate-900 px-1 rounded">OLLAMA_ORIGINS=*</code> when starting it.
            </p>
          )}
        </div>

        {/* ── Voice ──────────────────────────────────────────────────── */}
        <p className="text-xs font-semibold text-indigo-400 uppercase tracking-widest mb-2">
          Voice Input
        </p>
        <div className="bg-slate-800 rounded-2xl p-4 mb-5">
          <p className="text-sm text-slate-300">
            This web app uses your browser's built-in speech recognition (no download needed).
          </p>
          <p className="text-xs text-slate-500 mt-2">
            Works on Chrome, Edge, and Safari. Requires an internet connection on Safari (iOS).
          </p>
        </div>

        {/* ── Data ───────────────────────────────────────────────────── */}
        <p className="text-xs font-semibold text-indigo-400 uppercase tracking-widest mb-2">
          Data
        </p>
        <div className="bg-slate-800 rounded-2xl p-4 mb-5">
          <p className="text-xs text-slate-500 mb-3">
            All data is stored locally in your browser (IndexedDB). Nothing is sent to any server.
          </p>
          <button
            onClick={confirmClearAll}
            className="w-full bg-red-950 border border-red-900 text-red-300 font-semibold py-2.5 rounded-lg text-sm"
          >
            Clear All Data
          </button>
        </div>

        {/* ── About ──────────────────────────────────────────────────── */}
        <p className="text-xs font-semibold text-indigo-400 uppercase tracking-widest mb-2">
          How to use Ollama
        </p>
        <div className="bg-slate-800 rounded-2xl p-4 mb-5 space-y-2">
          <p className="text-xs text-slate-400">1. Install Ollama from ollama.com on your PC</p>
          <p className="text-xs text-slate-400">2. Run: <code className="bg-slate-900 px-1 rounded">OLLAMA_ORIGINS=* ollama serve</code></p>
          <p className="text-xs text-slate-400">3. Pull a model: <code className="bg-slate-900 px-1 rounded">ollama pull phi3:mini</code></p>
          <p className="text-xs text-slate-400">4. Set the URL above to your PC's local IP (e.g. http://192.168.1.x:11434)</p>
        </div>
      </div>
    </div>
  );
}
