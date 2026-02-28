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
import { useTodosStore } from '../store/useTodosStore';
import { useDraftsStore } from '../store/useDraftsStore';
import { Todo } from '../types';
import InputBar from '../components/InputBar';
import DraftBanner from '../components/DraftBanner';

const PRIORITY_COLORS = {
  high: '#ef4444',
  medium: '#f59e0b',
  low: '#22c55e',
};

function TodoRow({ todo }: { todo: Todo }) {
  const toggleTodo = useTodosStore((s) => s.toggleTodo);
  const removeTodo = useTodosStore((s) => s.removeTodo);

  return (
    <View style={styles.row}>
      <TouchableOpacity onPress={() => toggleTodo(todo.id)} style={styles.checkbox}>
        {todo.completed && <View style={styles.checkmark} />}
      </TouchableOpacity>
      <View style={[styles.priorityDot, { backgroundColor: PRIORITY_COLORS[todo.priority] }]} />
      <Text style={[styles.todoText, todo.completed && styles.completed]}>
        {todo.text}
      </Text>
      <TouchableOpacity onPress={() => removeTodo(todo.id)} style={styles.deleteBtn}>
        <Text style={styles.deleteText}>✕</Text>
      </TouchableOpacity>
    </View>
  );
}

export default function TodayScreen() {
  const { todos, loadTodos } = useTodosStore();
  const { loadDraftCount } = useDraftsStore();

  useEffect(() => {
    loadTodos();
    loadDraftCount();
  }, []);

  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  });

  const done = todos.filter((t) => t.completed).length;
  const total = todos.length;

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <DraftBanner />

        <View style={styles.header}>
          <Text style={styles.title}>Today</Text>
          <Text style={styles.subtitle}>{today}</Text>
          {total > 0 && (
            <Text style={styles.progress}>
              {done}/{total} done
            </Text>
          )}
        </View>

        {todos.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>✓</Text>
            <Text style={styles.emptyText}>Nothing yet. Add a task below.</Text>
          </View>
        ) : (
          <FlatList
            data={todos}
            keyExtractor={(t) => t.id}
            renderItem={({ item }) => <TodoRow todo={item} />}
            contentContainerStyle={styles.list}
          />
        )}

        <InputBar defaultCategory="todo" onCreated={() => loadTodos()} />
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
  progress: { fontSize: 13, color: '#6366f1', marginTop: 4, fontWeight: '600' },
  list: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 8 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#475569',
    marginRight: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkmark: {
    width: 12,
    height: 12,
    borderRadius: 3,
    backgroundColor: '#6366f1',
  },
  priorityDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 10,
  },
  todoText: { flex: 1, fontSize: 15, color: '#e2e8f0' },
  completed: { textDecorationLine: 'line-through', color: '#475569' },
  deleteBtn: { padding: 4 },
  deleteText: { color: '#475569', fontSize: 16 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyText: { fontSize: 16, color: '#475569' },
});
