import React, { useEffect, useState } from 'react';
import { useThoughtsStore } from '../store/useThoughtsStore';
import { Thought } from '../types';
import InputBar from '../components/InputBar';
import DraftBanner from '../components/DraftBanner';

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min  = Math.floor(diff / 60000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  return `${Math.floor(hr / 24)}d ago`;
}

function ThoughtCard({ thought, onDelete }: { thought: Thought; onDelete: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const isLong       = thought.text.length > 120;
  const displayText  = isLong && !expanded ? thought.text.slice(0, 120) + '…' : thought.text;

  return (
    <div
      className="bg-slate-800 rounded-xl p-3.5 mb-2 cursor-pointer select-none"
      onClick={() => isLong && setExpanded(!expanded)}
    >
      <div className="flex justify-between items-center mb-1.5">
        <span className="text-sm">{thought.sourceType === 'voice' ? '🎤' : '⌨️'}</span>
        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-500">{relativeTime(thought.createdAt)}</span>
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            className="text-slate-600 text-sm leading-none"
          >
            ✕
          </button>
        </div>
      </div>
      <p className="text-sm text-slate-200 leading-relaxed">{displayText}</p>
      {isLong && (
        <p className="text-xs text-indigo-400 mt-1.5">{expanded ? 'Show less' : 'Tap to expand'}</p>
      )}
    </div>
  );
}

export default function ThoughtsScreen() {
  const { thoughts, loadThoughts, searchThoughts, removeThought } = useThoughtsStore();
  const [query, setQuery] = useState('');

  useEffect(() => { loadThoughts(); }, []);

  useEffect(() => {
    const timer = setTimeout(() => searchThoughts(query), 300);
    return () => clearTimeout(timer);
  }, [query]);

  return (
    <div className="flex flex-col flex-1 min-h-0 bg-slate-950">
      <DraftBanner />

      <div className="px-5 pt-4 pb-3">
        <h1 className="text-3xl font-bold text-slate-100">Thoughts</h1>
      </div>

      {/* Search bar */}
      <div className="flex items-center px-4 mb-2 gap-2">
        <input
          type="text"
          className="flex-1 bg-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-200 placeholder-slate-500 outline-none"
          placeholder="Search thoughts…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        {query && (
          <button onClick={() => setQuery('')} className="text-slate-500 text-sm px-1">✕</button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto no-scrollbar px-4 pb-2">
        {thoughts.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <span className="text-5xl mb-3">💭</span>
            <p className="text-slate-500">
              {query ? 'No matching thoughts.' : 'Capture your first thought below.'}
            </p>
          </div>
        ) : (
          thoughts.map((t) => (
            <ThoughtCard key={t.id} thought={t} onDelete={() => removeThought(t.id)} />
          ))
        )}
      </div>

      <InputBar defaultCategory="thought" onCreated={() => { if (!query) loadThoughts(); }} />
    </div>
  );
}
