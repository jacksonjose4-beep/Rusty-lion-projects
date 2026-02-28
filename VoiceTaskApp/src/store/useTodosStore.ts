import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import { Todo } from '../types';
import * as db from '../services/db';

function todayDate(): string {
  return new Date().toISOString().split('T')[0];
}

interface TodosState {
  todos: Todo[];
  loadTodos: (date?: string) => Promise<void>;
  addTodo: (text: string, priority?: Todo['priority'], date?: string) => Promise<void>;
  toggleTodo: (id: string) => Promise<void>;
  removeTodo: (id: string) => Promise<void>;
}

export const useTodosStore = create<TodosState>((set, get) => ({
  todos: [],

  loadTodos: async (date = todayDate()) => {
    const todos = await db.getTodosByDate(date);
    set({ todos });
  },

  addTodo: async (text, priority = 'medium', date = todayDate()) => {
    const todo: Todo = {
      id: uuidv4(),
      text,
      completed: false,
      date,
      priority,
      createdAt: new Date().toISOString(),
    };
    await db.createTodo(todo);
    set((s) => ({ todos: [...s.todos, todo] }));
  },

  toggleTodo: async (id) => {
    const todo = get().todos.find((t) => t.id === id);
    if (!todo) return;
    const completed = !todo.completed;
    await db.updateTodoCompleted(id, completed);
    set((s) => ({
      todos: s.todos.map((t) => (t.id === id ? { ...t, completed } : t)),
    }));
  },

  removeTodo: async (id) => {
    await db.deleteTodo(id);
    set((s) => ({ todos: s.todos.filter((t) => t.id !== id) }));
  },
}));
