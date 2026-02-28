import React, { useEffect, useState } from 'react';
import { Routes, Route, Navigate, NavLink, useLocation } from 'react-router-dom';
import { initDB } from './services/db';
import { requestPermissions } from './services/notificationService';
import { useDraftRetry } from './utils/useDraftRetry';
import TodayScreen     from './screens/TodayScreen';
import RemindersScreen from './screens/RemindersScreen';
import ThoughtsScreen  from './screens/ThoughtsScreen';
import SettingsScreen  from './screens/SettingsScreen';

const TABS = [
  { to: '/today',     label: 'Today',     icon: '✓'  },
  { to: '/reminders', label: 'Reminders', icon: '🔔' },
  { to: '/thoughts',  label: 'Thoughts',  icon: '💭' },
  { to: '/settings',  label: 'Settings',  icon: '⚙️' },
];

function BottomNav() {
  const { pathname } = useLocation();
  return (
    <nav className="bg-slate-900 border-t border-slate-800 flex flex-shrink-0">
      {TABS.map(({ to, label, icon }) => {
        const active = pathname.startsWith(to);
        return (
          <NavLink
            key={to}
            to={to}
            className={`flex-1 flex flex-col items-center justify-center py-2.5 gap-0.5 transition-colors ${
              active ? 'text-indigo-400' : 'text-slate-600'
            }`}
          >
            <span className="text-lg leading-none">{icon}</span>
            <span className="text-[10px] font-medium">{label}</span>
          </NavLink>
        );
      })}
    </nav>
  );
}

function AppRoot() {
  useDraftRetry();
  return (
    <>
      <div className="flex flex-col flex-1 min-h-0">
        <Routes>
          <Route path="/"          element={<Navigate to="/today" replace />} />
          <Route path="/today"     element={<TodayScreen />} />
          <Route path="/reminders" element={<RemindersScreen />} />
          <Route path="/thoughts"  element={<ThoughtsScreen />} />
          <Route path="/settings"  element={<SettingsScreen />} />
        </Routes>
      </div>
      <BottomNav />
    </>
  );
}

export default function App() {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([initDB(), requestPermissions()])
      .then(() => setReady(true))
      .catch((e) => setError(String(e)));
  }, []);

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center flex-1 p-8 text-center">
        <p className="text-red-400 font-semibold mb-2">Startup error</p>
        <p className="text-slate-500 text-sm">{error}</p>
      </div>
    );
  }

  if (!ready) {
    return (
      <div className="flex flex-col items-center justify-center flex-1 gap-3">
        <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-slate-500 text-sm">Loading…</p>
      </div>
    );
  }

  return <AppRoot />;
}
