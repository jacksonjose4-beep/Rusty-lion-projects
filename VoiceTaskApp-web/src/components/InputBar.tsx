import React, { useState, useRef } from 'react';
import { useTodosStore }    from '../store/useTodosStore';
import { useThoughtsStore } from '../store/useThoughtsStore';
import { useDraftsStore }   from '../store/useDraftsStore';
import { ping, parseTranscript } from '../services/ollamaService';
import { createItemFromOllamaResult } from '../utils/itemCreator';
import ReminderModal from './ReminderModal';
import VoiceRecorder from './VoiceRecorder';

type Category    = 'todo' | 'reminder' | 'thought';
type InputMode   = 'text' | 'voice';
type SendingState = 'idle' | 'processing';

interface Props {
  defaultCategory?: Category;
  onCreated?: () => void;
}

const CATEGORIES: { key: Category; label: string; icon: string }[] = [
  { key: 'todo',     label: 'Todo',    icon: '✓'  },
  { key: 'reminder', label: 'Remind',  icon: '🔔' },
  { key: 'thought',  label: 'Thought', icon: '💭' },
];

export default function InputBar({ defaultCategory, onCreated }: Props) {
  const [text,               setText]               = useState('');
  const [category,           setCategory]           = useState<Category>(defaultCategory ?? 'todo');
  const [inputMode,          setInputMode]          = useState<InputMode>('text');
  const [sendingState,       setSendingState]       = useState<SendingState>('idle');
  const [statusMsg,          setStatusMsg]          = useState('');
  const [showReminderModal,  setShowReminderModal]  = useState(false);
  const [pendingReminderText, setPendingReminderText] = useState('');

  const inputRef = useRef<HTMLTextAreaElement>(null);

  const addTodo    = useTodosStore((s) => s.addTodo);
  const addThought = useThoughtsStore((s) => s.addThought);
  const addDraft   = useDraftsStore((s) => s.addDraft);

  const handleSend = async () => {
    const trimmed = text.trim();
    if (!trimmed) return;

    const sourceType = inputMode === 'voice' ? 'voice' as const : 'text' as const;
    setText('');
    setInputMode('text');
    setSendingState('processing');

    try {
      const ollamaReachable = await ping();

      if (ollamaReachable) {
        setStatusMsg('Parsing with AI…');
        const result  = await parseTranscript(trimmed);
        const outcome = await createItemFromOllamaResult(result, sourceType);

        if (!outcome.created) {
          setPendingReminderText(outcome.needsReminderDate);
          setShowReminderModal(true);
        } else {
          onCreated?.();
        }
      } else {
        await handleOfflineFallback(trimmed, sourceType);
      }
    } catch {
      await handleOfflineFallback(trimmed, sourceType);
    } finally {
      setSendingState('idle');
      setStatusMsg('');
    }
  };

  const handleOfflineFallback = async (value: string, sourceType: 'voice' | 'text') => {
    if (defaultCategory === 'todo') {
      await addTodo(value);
      onCreated?.();
    } else if (defaultCategory === 'reminder') {
      setPendingReminderText(value);
      setShowReminderModal(true);
    } else if (defaultCategory === 'thought') {
      await addThought(value, sourceType);
      onCreated?.();
    } else {
      await addDraft(value);
      setStatusMsg('Saved as draft — will parse when Ollama is back online');
      setTimeout(() => setStatusMsg(''), 3000);
      onCreated?.();
    }
  };

  const handleTranscript = (transcript: string) => {
    if (!transcript.trim()) return;
    setInputMode('text');
    setText(transcript);
    setTimeout(() => inputRef.current?.focus(), 80);
  };

  const handleVoiceError = (msg: string) => {
    setInputMode('text');
    alert(msg);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const placeholder =
    category === 'todo'
      ? 'Add a task for today…'
      : category === 'reminder'
      ? 'What do you want to be reminded of?'
      : 'Capture a thought…';

  const isBusy = sendingState === 'processing';

  return (
    <>
      <div className="bg-slate-800 border-t border-slate-700 px-3 pt-2.5 pb-safe">
        {/* Category chips — hidden when defaultCategory is locked */}
        {!defaultCategory && (
          <div className="flex gap-2 mb-2.5">
            {CATEGORIES.map(({ key, label, icon }) => (
              <button
                key={key}
                disabled={isBusy}
                onClick={() => setCategory(key)}
                className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                  category === key
                    ? 'bg-indigo-950 border-indigo-500 text-indigo-300 font-bold'
                    : 'bg-slate-950 border-slate-700 text-slate-500'
                }`}
              >
                {icon} {label}
              </button>
            ))}
          </div>
        )}

        {/* Processing state */}
        {isBusy ? (
          <div className="flex items-center justify-center gap-3 py-3.5">
            <div className="w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
            <span className="text-sm text-slate-400">{statusMsg || 'Parsing with AI…'}</span>
          </div>
        ) : (
          <>
            {inputMode === 'voice' ? (
              <VoiceRecorder onTranscript={handleTranscript} onError={handleVoiceError} />
            ) : (
              <div className="flex items-end gap-2">
                <textarea
                  ref={inputRef}
                  rows={1}
                  className="flex-1 bg-slate-950 rounded-xl px-3.5 py-2.5 text-sm text-slate-200 placeholder-slate-500 outline-none resize-none max-h-28 leading-5"
                  placeholder={placeholder}
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  onKeyDown={handleKeyDown}
                />
                <button
                  onClick={handleSend}
                  disabled={!text.trim()}
                  className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 text-lg font-bold transition-colors ${
                    text.trim() ? 'bg-indigo-500 text-white' : 'bg-slate-700 text-slate-500'
                  }`}
                >
                  ↑
                </button>
              </div>
            )}

            {statusMsg !== '' && (
              <p className="text-xs text-indigo-400 text-center mt-1.5">{statusMsg}</p>
            )}

            <button
              onClick={() => setInputMode((m) => (m === 'text' ? 'voice' : 'text'))}
              className="block mx-auto mt-2 text-xs text-slate-500 py-1 px-3"
            >
              {inputMode === 'text' ? '🎤 Use voice' : '⌨️ Use keyboard'}
            </button>
          </>
        )}

        {/* Safe area spacer for iPhone home bar */}
        <div className="h-1" />
      </div>

      <ReminderModal
        visible={showReminderModal}
        text={pendingReminderText}
        onClose={() => { setShowReminderModal(false); setPendingReminderText(''); }}
        onScheduled={() => { setShowReminderModal(false); setPendingReminderText(''); onCreated?.(); }}
      />
    </>
  );
}
