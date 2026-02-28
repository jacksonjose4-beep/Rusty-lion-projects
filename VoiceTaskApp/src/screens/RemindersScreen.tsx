import React, { useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRemindersStore } from '../store/useRemindersStore';
import { cancelNotification } from '../services/notificationService';
import { Reminder } from '../types';
import InputBar from '../components/InputBar';
import DraftBanner from '../components/DraftBanner';

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function groupReminders(reminders: Reminder[]): [string, Reminder[]][] {
  const now = new Date();
  const weekMs = 7 * 24 * 60 * 60 * 1000;
  const monthMs = 30 * 24 * 60 * 60 * 1000;

  const groups: Record<string, Reminder[]> = {
    Today: [],
    'This Week': [],
    'This Month': [],
    Later: [],
  };

  for (const r of reminders) {
    const d = new Date(r.scheduledAt);
    const diff = d.getTime() - now.getTime();
    if (d.toDateString() === now.toDateString()) groups['Today'].push(r);
    else if (diff < weekMs) groups['This Week'].push(r);
    else if (diff < monthMs) groups['This Month'].push(r);
    else groups['Later'].push(r);
  }

  return Object.entries(groups).filter(([, items]) => items.length > 0);
}

function ReminderCard({ reminder }: { reminder: Reminder }) {
  const { completeReminder, removeReminder } = useRemindersStore();

  const handleComplete = async () => {
    if (reminder.notificationId) await cancelNotification(reminder.notificationId);
    completeReminder(reminder.id);
  };

  const handleDelete = async () => {
    if (reminder.notificationId) await cancelNotification(reminder.notificationId);
    removeReminder(reminder.id);
  };

  return (
    <View style={styles.card}>
      <View style={styles.cardBody}>
        {reminder.recurring !== 'none' && (
          <View style={styles.recurringBadge}>
            <Text style={styles.recurringText}>↻ {reminder.recurring}</Text>
          </View>
        )}
        <Text style={styles.cardText}>{reminder.text}</Text>
        <Text style={styles.cardDate}>{formatDate(reminder.scheduledAt)}</Text>
      </View>
      <View style={styles.cardActions}>
        <TouchableOpacity onPress={handleComplete} style={styles.actionBtn}>
          <Text style={styles.checkText}>✓</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={handleDelete} style={styles.actionBtn}>
          <Text style={styles.deleteText}>✕</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default function RemindersScreen() {
  const { reminders, loadReminders } = useRemindersStore();

  useEffect(() => {
    loadReminders();
  }, []);

  const sections = groupReminders(reminders);

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <DraftBanner />

        <View style={styles.header}>
          <Text style={styles.title}>Reminders</Text>
          {reminders.length > 0 && (
            <Text style={styles.subtitle}>{reminders.length} upcoming</Text>
          )}
        </View>

        {reminders.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>🔔</Text>
            <Text style={styles.emptyText}>No reminders yet.</Text>
            <Text style={styles.emptyHint}>Type below and tap "Remind"</Text>
          </View>
        ) : (
          <FlatList
            data={sections}
            keyExtractor={([group]) => group}
            renderItem={({ item: [group, items] }) => (
              <View>
                <Text style={styles.sectionHeader}>{group}</Text>
                {items.map((r) => <ReminderCard key={r.id} reminder={r} />)}
              </View>
            )}
            contentContainerStyle={styles.list}
          />
        )}

        <InputBar defaultCategory="reminder" onCreated={() => loadReminders()} />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  flex: { flex: 1 },
  header: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12 },
  title: { fontSize: 28, fontWeight: '700', color: '#f1f5f9' },
  subtitle: { fontSize: 14, color: '#64748b', marginTop: 2 },
  list: { paddingHorizontal: 16 },
  sectionHeader: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6366f1',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginTop: 16,
    marginBottom: 6,
  },
  card: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  cardBody: { flex: 1 },
  cardText: { fontSize: 15, color: '#e2e8f0', marginBottom: 4 },
  cardDate: { fontSize: 13, color: '#64748b' },
  recurringBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#312e81',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginBottom: 6,
  },
  recurringText: { fontSize: 11, color: '#a5b4fc' },
  cardActions: { flexDirection: 'row', gap: 8 },
  actionBtn: { padding: 6 },
  checkText: { color: '#22c55e', fontSize: 18 },
  deleteText: { color: '#475569', fontSize: 16 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyText: { fontSize: 16, color: '#475569' },
  emptyHint: { fontSize: 13, color: '#334155', marginTop: 4 },
});
