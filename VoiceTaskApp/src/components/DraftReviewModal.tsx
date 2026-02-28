/**
 * DraftReviewModal — lets the user manually categorize voice notes that were
 * saved as drafts when Ollama was unreachable.
 *
 * Also offers a "Retry with AI" button to re-process all drafts via Ollama.
 */

import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  Platform,
  Alert,
} from 'react-native';
import { useDraftsStore }   from '../store/useDraftsStore';
import { useTodosStore }    from '../store/useTodosStore';
import { useThoughtsStore } from '../store/useThoughtsStore';
import { useRemindersStore } from '../store/useRemindersStore';
import { ping, parseTranscript } from '../services/ollamaService';
import { createItemFromOllamaResult } from '../utils/itemCreator';
import { scheduleReminder } from '../services/notificationService';
import { Draft } from '../types';
import ReminderModal from './ReminderModal';

interface Props {
  visible: boolean;
  onClose: () => void;
}

type DraftAction = 'todo' | 'reminder' | 'thought' | 'delete';

export default function DraftReviewModal({ visible, onClose }: Props) {
  const { drafts, loadDrafts, removeDraft, updateDraftStatus, loadDraftCount } = useDraftsStore();
  const addTodo    = useTodosStore((s) => s.addTodo);
  const addThought = useThoughtsStore((s) => s.addThought);

  const [retrying,  setRetrying]  = useState(false);
  const [retryProgress, setRetryProgress] = useState('');

  // Reminder modal for when a draft is manually assigned as "Reminder"
  const [reminderDraft, setReminderDraft] = useState<Draft | null>(null);

  useEffect(() => {
    if (visible) loadDrafts();
  }, [visible, loadDrafts]);

  // ── Manual categorisation ──────────────────────────────────────────────────
  const handleAction = async (draft: Draft, action: DraftAction) => {
    if (action === 'delete') {
      Alert.alert('Delete draft', 'Remove this draft permanently?', [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await removeDraft(draft.id);
            await loadDraftCount();
          },
        },
      ]);
      return;
    }

    if (action === 'reminder') {
      // Open date picker with draft text
      setReminderDraft(draft);
      return;
    }

    if (action === 'todo') {
      await addTodo(draft.transcript);
    } else {
      await addThought(draft.transcript, 'voice');
    }

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

  // ── Retry all with Ollama ──────────────────────────────────────────────────
  const retryAll = useCallback(async () => {
    const reachable = await ping();
    if (!reachable) {
      Alert.alert('Ollama unreachable', 'Make sure Ollama is running on your PC and you are on the same WiFi network.');
      return;
    }

    setRetrying(true);
    let succeeded = 0;
    let failed    = 0;

    for (const draft of drafts) {
      setRetryProgress(`Parsing ${succeeded + failed + 1} of ${drafts.length}…`);
      await updateDraftStatus(draft.id, 'processing');

      try {
        const result  = await parseTranscript(draft.transcript);
        const outcome = await createItemFromOllamaResult(result, 'voice');

        if (outcome.created) {
          await removeDraft(draft.id);
          succeeded++;
        } else {
          // Reminder with no date — keep as draft, user must handle manually
          await updateDraftStatus(draft.id, 'pending');
          failed++;
        }
      } catch {
        await updateDraftStatus(draft.id, 'pending');
        failed++;
      }
    }

    await loadDrafts();
    await loadDraftCount();
    setRetrying(false);
    setRetryProgress('');

    Alert.alert(
      'Done',
      `${succeeded} parsed automatically.${failed > 0 ? `\n${failed} still need a date — assign them manually.` : ''}`
    );
  }, [drafts, updateDraftStatus, removeDraft, loadDrafts, loadDraftCount]);

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <>
      <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />

        <View style={styles.sheet}>
          <View style={styles.handle} />

          <View style={styles.headerRow}>
            <Text style={styles.title}>
              {drafts.length} Pending {drafts.length === 1 ? 'Draft' : 'Drafts'}
            </Text>
            <TouchableOpacity
              style={[styles.retryBtn, retrying && styles.retryBtnDisabled]}
              onPress={retryAll}
              disabled={retrying}
            >
              {retrying ? (
                <ActivityIndicator size="small" color="#a5b4fc" />
              ) : (
                <Text style={styles.retryBtnText}>Retry all with AI</Text>
              )}
            </TouchableOpacity>
          </View>

          {retrying && retryProgress !== '' && (
            <Text style={styles.retryProgress}>{retryProgress}</Text>
          )}

          {drafts.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyText}>All caught up!</Text>
            </View>
          ) : (
            <FlatList
              data={drafts}
              keyExtractor={(d) => d.id}
              renderItem={({ item }) => <DraftItem draft={item} onAction={handleAction} />}
              contentContainerStyle={styles.list}
              style={styles.scrollArea}
            />
          )}
        </View>
      </Modal>

      {/* Date picker for reminders assigned manually */}
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

// ── DraftItem ─────────────────────────────────────────────────────────────────

const ACTION_BUTTONS: { action: DraftAction; label: string; color: string; bg: string }[] = [
  { action: 'todo',     label: '✓ Todo',    color: '#a5b4fc', bg: '#312e81' },
  { action: 'reminder', label: '🔔 Remind', color: '#fcd34d', bg: '#422006' },
  { action: 'thought',  label: '💭 Thought', color: '#6ee7b7', bg: '#064e3b' },
  { action: 'delete',   label: '✕',         color: '#94a3b8', bg: '#1e293b' },
];

function DraftItem({
  draft,
  onAction,
}: {
  draft: Draft;
  onAction: (draft: Draft, action: DraftAction) => void;
}) {
  const ago = (() => {
    const diff = Date.now() - new Date(draft.createdAt).getTime();
    const min  = Math.floor(diff / 60000);
    if (min < 60) return `${min}m ago`;
    const hr = Math.floor(min / 60);
    if (hr < 24) return `${hr}h ago`;
    return `${Math.floor(hr / 24)}d ago`;
  })();

  return (
    <View style={itemStyles.card}>
      <View style={itemStyles.header}>
        <Text style={itemStyles.time}>{ago}</Text>
        {draft.status === 'processing' && (
          <ActivityIndicator size="small" color="#6366f1" />
        )}
      </View>
      <Text style={itemStyles.transcript} numberOfLines={3}>
        "{draft.transcript}"
      </Text>
      <View style={itemStyles.actions}>
        {ACTION_BUTTONS.map(({ action, label, color, bg }) => (
          <TouchableOpacity
            key={action}
            style={[itemStyles.actionBtn, { backgroundColor: bg }]}
            onPress={() => onAction(draft, action)}
            activeOpacity={0.8}
          >
            <Text style={[itemStyles.actionBtnText, { color }]}>{label}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)' },
  sheet: {
    backgroundColor: '#1e293b',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
    maxHeight: '80%',
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#475569',
    alignSelf: 'center',
    marginBottom: 16,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  title: { fontSize: 18, fontWeight: '700', color: '#f1f5f9' },
  retryBtn: {
    backgroundColor: '#312e81',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 7,
    minWidth: 50,
    alignItems: 'center',
  },
  retryBtnDisabled: { opacity: 0.6 },
  retryBtnText: { color: '#a5b4fc', fontSize: 13, fontWeight: '600' },
  retryProgress: { fontSize: 12, color: '#64748b', marginBottom: 8, textAlign: 'center' },
  scrollArea: { flexGrow: 0 },
  list: { gap: 10 },
  empty: { alignItems: 'center', paddingVertical: 32 },
  emptyText: { color: '#64748b', fontSize: 16 },
});

const itemStyles = StyleSheet.create({
  card: {
    backgroundColor: '#0f172a',
    borderRadius: 12,
    padding: 14,
    gap: 10,
    borderWidth: 1,
    borderColor: '#334155',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  time: { fontSize: 12, color: '#475569' },
  transcript: {
    fontSize: 14,
    color: '#e2e8f0',
    lineHeight: 20,
    fontStyle: 'italic',
  },
  actions: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  actionBtn: {
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  actionBtnText: { fontSize: 12, fontWeight: '600' },
});
