// MMKV storage instance and Zustand adapter.
// Also provides direct MMKV access for widget-readable keys.

import { createMMKV } from 'react-native-mmkv';
import { StateStorage } from 'zustand/middleware';

export const storage = createMMKV();

// Zustand-compatible storage adapter
export const zustandStorage: StateStorage = {
  setItem: (name, value) => {
    storage.set(name, value);
  },
  getItem: (name) => {
    return storage.getString(name) ?? null;
  },
  removeItem: (name) => {
    storage.remove(name);
  },
};

// Widget-readable MMKV keys — written directly so native widgets
// can read them without going through Zustand's JSON serialization.
export function writeWidgetData(dailyGoal: number, consumed: number, lastLogged: string | null) {
  storage.set('widget:dailyGoal', dailyGoal);
  storage.set('widget:consumed', consumed);
  if (lastLogged) {
    storage.set('widget:lastLogged', lastLogged);
  } else {
    storage.remove('widget:lastLogged');
  }
}
