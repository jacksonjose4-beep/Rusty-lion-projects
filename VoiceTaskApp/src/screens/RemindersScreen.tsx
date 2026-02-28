import React, { useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
} from 'react-native';
import { useRemindersStore } from '../store/useRemindersStore';
import { Reminder } from '../types';

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function groupReminders(reminders: Reminder[]): Record<string, Reminder[]> {
  const now = new Date();
  const today = now.toDateString();
  const weekMs = 7 * 24 * 60 * 60 * 1000;
  const monthMs = 30 * 24 * 60 * 60 * 1000;

  return reminders.reduce<Record<string, Reminder[]>>(
    (acc, r) => {
      const d = new Date(r.scheduledAt);
      let group: string;
      if (d.toDateString() === today) group = 'Today';
      else if (d.getTime() - now.getTime() < weekMs) group = 'This Week';
      else if (d.getTime() - now.getTime() < monthMs) group = 'This Month';
      else group = 'Later';
      acc[group] = [...(acc[group] ?? []), r];
      return acc;
    },
    { Today: [], 'This Week': [], 'This Month': [], Later: [] }
  );
}

function ReminderCard({ reminder }: { reminder: Reminder }) {
  const { completeReminder, removeReminder } = useRemindersStore();
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
        <TouchableOpacity onPress={() => completeReminder(reminder.id)} style={styles.actionBtn}>
          <Text style={styles.checkText}>✓</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => removeReminder(reminder.id)} style={styles.actionBtn}>
          <Text style={styles.deleteText}>✕</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default function RemindersScreen() {
  const { reminders, loadReminders, addReminder } = useRemindersStore();

  useEffect(() => {
    loadReminders();
  }, []);

  const groups = groupReminders(reminders);
  const sections = Object.entries(groups).filter(([, items]) => items.length > 0);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Reminders</Text>
      </View>

      {reminders.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyIcon}>🔔</Text>
          <Text style={styles.emptyText}>No reminders yet.</Text>
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

      {/* Placeholder — InputBar replaces this in Phase 3 */}
      <TouchableOpacity
        style={styles.addBtn}
        onPress={() => {
          const tomorrow = new Date(Date.now() + 86400000).toISOString();
          addReminder('Sample reminder', tomorrow);
        }}
      >
        <Text style={styles.addBtnText}>+ Add Reminder (placeholder)</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  header: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12 },
  title: { fontSize: 28, fontWeight: '700', color: '#f1f5f9' },
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
  addBtn: {
    margin: 16,
    backgroundColor: '#6366f1',
    padding: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  addBtnText: { color: '#fff', fontWeight: '600', fontSize: 15 },
});
