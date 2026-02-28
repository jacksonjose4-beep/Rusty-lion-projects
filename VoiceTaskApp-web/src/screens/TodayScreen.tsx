import React, { useEffect } from 'react';
import { useTodosStore } from '../store/useTodosStore';
import { useDraftsStore } from '../store/useDraftsStore';
import { Todo } from '../types';
import InputBar from '../components/InputBar';
import DraftBanner from '../components/DraftBanner';

const PRIORITY_COLORS: Record<Todo['priority'], string> = {
  high:   'bg-red-500',
  medium: 'bg-amber-500',
  low:    'bg-green-500',
};

function TodoRow({ todo }: { todo: Todo }) {
  const toggleTodo = useTodosStore((s) => s.toggleTodo);
  const removeTodo = useTodosStore((s) => s.removeTodo);

  return (
    <div className="flex items-center bg-slate-800 rounded-xl p-3.5 mb-2 gap-2.5">
      <button
        onClick={() => toggleTodo(todo.id)}
        className="w-5 h-5 rounded-md border-2 border-slate-500 flex items-center justify-center flex-shrink-0"
      >
        {todo.completed && <div className="w-2.5 h-2.5 rounded-sm bg-indigo-500" />}
      </button>

      <div className={`w-2 h-2 rounded-full flex-shrink-0 ${PRIORITY_COLORS[todo.priority]}`} />

      <span className={`flex-1 text-sm ${todo.completed ? 'line-through text-slate-500' : 'text-slate-200'}`}>
        {todo.text}
      </span>

      <button
        onClick={() => removeTodo(todo.id)}
        className="text-slate-500 text-base px-1 flex-shrink-0"
      >
        ✕
      </button>
    </div>
  );
}

export default function TodayScreen() {
  const { todos, loadTodos } = useTodosStore();
  const { loadDraftCount }   = useDraftsStore();

  useEffect(() => {
    loadTodos();
    loadDraftCount();
  }, []);

  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  });

  const done  = todos.filter((t) => t.completed).length;
  const total = todos.length;

  return (
    <div className="flex flex-col flex-1 min-h-0 bg-slate-950">
      <DraftBanner />

      <div className="px-5 pt-4 pb-3">
        <h1 className="text-3xl font-bold text-slate-100">Today</h1>
        <p className="text-sm text-slate-500 mt-0.5">{today}</p>
        {total > 0 && (
          <p className="text-xs text-indigo-400 font-semibold mt-1">{done}/{total} done</p>
        )}
      </div>

      <div className="flex-1 overflow-y-auto no-scrollbar px-4 pb-2">
        {todos.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <span className="text-5xl mb-3">✓</span>
            <p className="text-slate-500">Nothing yet. Add a task below.</p>
          </div>
        ) : (
          todos.map((todo) => <TodoRow key={todo.id} todo={todo} />)
        )}
      </div>

      <InputBar defaultCategory="todo" onCreated={() => loadTodos()} />
    </div>
  );
}
