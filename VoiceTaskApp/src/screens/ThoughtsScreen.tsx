import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useThoughtsStore } from '../store/useThoughtsStore';
import { Thought } from '../types';
import InputBar from '../components/InputBar';
import DraftBanner from '../components/DraftBanner';

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  return `${Math.floor(hr / 24)}d ago`;
}

function ThoughtCard({ thought, onDelete }: { thought: Thought; onDelete: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const isLong = thought.text.length > 120;
  const displayText =
    isLong && !expanded ? thought.text.slice(0, 120) + '…' : thought.text;

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={() => isLong && setExpanded(!expanded)}
      onLongPress={onDelete}
      activeOpacity={0.8}
    >
      <View style={styles.cardTop}>
        <Text style={styles.sourceIcon}>{thought.sourceType === 'voice' ? '🎤' : '⌨️'}</Text>
        <Text style={styles.time}>{relativeTime(thought.createdAt)}</Text>
      </View>
      <Text style={styles.text}>{displayText}</Text>
      {isLong && (
        <Text style={styles.expandHint}>{expanded ? 'Show less' : 'Tap to expand'}</Text>
      )}
    </TouchableOpacity>
  );
}

export default function ThoughtsScreen() {
  const { thoughts, loadThoughts, searchThoughts, removeThought } = useThoughtsStore();
  const [query, setQuery] = useState('');

  useEffect(() => {
    loadThoughts();
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => searchThoughts(query), 300);
    return () => clearTimeout(timer);
  }, [query]);

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <DraftBanner />

        <View style={styles.header}>
          <Text style={styles.title}>Thoughts</Text>
        </View>

        <View style={styles.searchRow}>
          <TextInput
            style={styles.searchInput}
            placeholder="Search thoughts…"
            placeholderTextColor="#475569"
            value={query}
            onChangeText={setQuery}
          />
          {query.length > 0 && (
            <TouchableOpacity style={styles.clearBtn} onPress={() => setQuery('')}>
              <Text style={styles.clearText}>✕</Text>
            </TouchableOpacity>
          )}
        </View>

        {thoughts.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>💭</Text>
            <Text style={styles.emptyText}>
              {query ? 'No matching thoughts.' : 'Capture your first thought below.'}
            </Text>
            {!query && (
              <Text style={styles.emptyHint}>Long-press any thought to delete it</Text>
            )}
          </View>
        ) : (
          <FlatList
            data={thoughts}
            keyExtractor={(t) => t.id}
            renderItem={({ item }) => (
              <ThoughtCard thought={item} onDelete={() => removeThought(item.id)} />
            )}
            contentContainerStyle={styles.list}
            keyboardShouldPersistTaps="handled"
          />
        )}

        <InputBar
          defaultCategory="thought"
          onCreated={() => { if (!query) loadThoughts(); }}
        />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  flex: { flex: 1 },
  header: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8 },
  title: { fontSize: 28, fontWeight: '700', color: '#f1f5f9' },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  searchInput: {
    flex: 1,
    backgroundColor: '#1e293b',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: '#e2e8f0',
    fontSize: 15,
  },
  clearBtn: { marginLeft: 8, padding: 6 },
  clearText: { color: '#475569', fontSize: 14 },
  list: { paddingHorizontal: 16, paddingBottom: 8 },
  card: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
  },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  sourceIcon: { fontSize: 14 },
  time: { fontSize: 12, color: '#64748b' },
  text: { fontSize: 15, color: '#e2e8f0', lineHeight: 22 },
  expandHint: { fontSize: 12, color: '#6366f1', marginTop: 6 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyText: { fontSize: 16, color: '#475569' },
  emptyHint: { fontSize: 13, color: '#334155', marginTop: 4 },
});
