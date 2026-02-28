import React, { useEffect, useState, useCallback } from 'react';
import { useDraftsStore }   from '../store/useDraftsStore';
import { useTodosStore }    from '../store/useTodosStore';
import { useThoughtsStore } from '../store/useThoughtsStore';
import { ping, parseTranscript } from '../services/ollamaService';
import { createItemFromOllamaResult } from '../utils/itemCreator';
import { Draft } from '../types';
import ReminderModal from './ReminderModal';

interface Props {
  visible: boolean;
  onClose: () => void;
}

type DraftAction = 'todo' | 'reminder' | 'thought' | 'delete';

const ACTION_BUTTONS: { action: DraftAction; label: string; textColor: string; bg: string }[] = [
  { action: 'todo',     label: '✓ Todo',    textColor: 'text-indigo-300', bg: 'bg-indigo-950' },
  { action: 'reminder', label: '🔔 Remind', textColor: 'text-amber-300',  bg: 'bg-amber-950'  },
  { action: 'thought',  label: '💭 Thought', textColor: 'text-emerald-300', bg: 'bg-emerald-950' },
  { action: 'delete',   label: '✕',          textColor: 'text-slate-400',  bg: 'bg-slate-800'  },
];

function DraftItem({ draft, onAction }: { draft: Draft; onAction: (d: Draft, a: DraftAction) => void }) {
  const ago = (() => {
    const diff = Date.now() - new Date(draft.createdAt).getTime();
    const min  = Math.floor(diff / 60000);
    if (min < 60) return `${min}m ago`;
    const hr = Math.floor(min / 60);
    if (hr < 24) return `${hr}h ago`;
    return `${Math.floor(hr / 24)}d ago`;
  })();

  return (
    <div className="bg-slate-950 border border-slate-700 rounded-xl p-3.5 space-y-2.5">
      <div className="flex justify-between items-center">
        <span className="text-xs text-slate-500">{ago}</span>
        {draft.status === 'processing' && (
          <div className="w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        )}
      </div>
      <p className="text-sm text-slate-200 italic leading-snug">"{draft.transcript}"</p>
      <div className="flex flex-wrap gap-1.5">
        {ACTION_BUTTONS.map(({ action, label, textColor, bg }) => (
          <button
            key={action}
            onClick={() => onAction(draft, action)}
            className={`${bg} ${textColor} text-xs font-semibold px-2.5 py-1.5 rounded-lg`}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function DraftReviewModal({ visible, onClose }: Props) {
  const { drafts, loadDrafts, removeDraft, updateDraftStatus, loadDraftCount } = useDraftsStore();
  const addTodo    = useTodosStore((s) => s.addTodo);
  const addThought = useThoughtsStore((s) => s.addThought);

  const [retrying,      setRetrying]      = useState(false);
  const [retryProgress, setRetryProgress] = useState('');
  const [reminderDraft, setReminderDraft] = useState<Draft | null>(null);

  useEffect(() => { if (visible) loadDrafts(); }, [visible]);

  const handleAction = async (draft: Draft, action: DraftAction) => {
    if (action === 'delete') {
      if (!window.confirm('Remove this draft permanently?')) return;
      await removeDraft(draft.id);
      await loadDraftCount();
      return;
    }

    if (action === 'reminder') { setReminderDraft(draft); return; }
    if (action === 'todo')     { await addTodo(draft.transcript); }
    else                       { await addThought(draft.transcript, 'voice'); }

    await removeDraft(draft.id);
    await loadDraftCount();
  };

  const handleReminderScheduled = async () => {
    if (!reminderDraft) return;
    await removeDraft(reminderDraft.id);
    await loadDraftCount();
    setReminderDraft(null);
    await loadDrafts();
  };

  const retryAll = useCallback(async () => {
    const reachable = await ping();
    if (!reachable) {
      alert('Ollama is unreachable. Make sure it is running on your PC on the same WiFi network.');
      return;
    }

    setRetrying(true);
    let succeeded = 0, failed = 0;

    for (const draft of drafts) {
      setRetryProgress(`Parsing ${succeeded + failed + 1} of ${drafts.length}…`);
      await updateDraftStatus(draft.id, 'processing');
      try {
        const result  = await parseTranscript(draft.transcript);
        const outcome = await createItemFromOllamaResult(result, 'voice');
        if (outcome.created) { await removeDraft(draft.id); succeeded++; }
        else { await updateDraftStatus(draft.id, 'pending'); failed++; }
      } catch {
        await updateDraftStatus(draft.id, 'pending'); failed++;
      }
    }

    await loadDrafts();
    await loadDraftCount();
    setRetrying(false);
    setRetryProgress('');
    alert(`${succeeded} parsed. ${failed > 0 ? `${failed} still need a date — assign manually.` : ''}`);
  }, [drafts, updateDraftStatus, removeDraft, loadDrafts, loadDraftCount]);

  if (!visible) return null;

  return (
    <>
      <div className="fixed inset-0 z-50 flex flex-col justify-end">
        <div className="absolute inset-0 bg-black/60" onClick={onClose} />

        <div className="relative bg-slate-800 rounded-t-2xl p-5 pb-8 max-w-[480px] w-full mx-auto max-h-[80vh] flex flex-col">
          <div className="w-10 h-1 bg-slate-500 rounded-full mx-auto mb-4" />

          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-bold text-slate-100">
              {drafts.length} Pending {drafts.length === 1 ? 'Draft' : 'Drafts'}
            </h2>
            <button
              onClick={retryAll}
              disabled={retrying}
              className="bg-indigo-950 text-indigo-300 text-xs font-semibold px-3 py-1.5 rounded-lg disabled:opacity-60"
            >
              {retrying ? '…' : 'Retry with AI'}
            </button>
          </div>

          {retrying && retryProgress && (
            <p className="text-xs text-slate-500 text-center mb-2">{retryProgress}</p>
          )}

          <div className="overflow-y-auto no-scrollbar space-y-3">
            {drafts.length === 0 ? (
              <p className="text-slate-500 text-center py-8">All caught up!</p>
            ) : (
              drafts.map((d) => <DraftItem key={d.id} draft={d} onAction={handleAction} />)
            )}
          </div>
        </div>
      </div>

      {reminderDraft && (
        <ReminderModal
          visible={!!reminderDraft}
          text={reminderDraft.transcript}
          onClose={() => setReminderDraft(null)}
          onScheduled={handleReminderScheduled}
        />
      )}
    </>
  );
}
