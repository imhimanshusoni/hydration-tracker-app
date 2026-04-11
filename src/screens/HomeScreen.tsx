// Home screen: shows greeting, circular progress ring, log button, and undo toast.
// Checks for midnight reset on foreground and reschedules notifications on log.

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  useColorScheme,
  AppState,
  Animated,
} from 'react-native';
import { getTheme } from '../theme';
import { useUserStore } from '../store/useUserStore';
import { useWaterStore } from '../store/useWaterStore';
import { WaterProgressBar } from '../components/WaterProgressBar';
import { LogWaterModal } from '../components/LogWaterModal';
import { scheduleReminders } from '../utils/notificationScheduler';

export function HomeScreen() {
  const colorScheme = useColorScheme();
  const theme = getTheme(colorScheme);

  const name = useUserStore((s) => s.name);
  const dailyGoal = useUserStore((s) => s.dailyGoal);
  const wakeUpTime = useUserStore((s) => s.wakeUpTime);
  const sleepTime = useUserStore((s) => s.sleepTime);
  const remindersEnabled = useUserStore((s) => s.remindersEnabled);

  const consumed = useWaterStore((s) => s.consumed);
  const lastLogAmount = useWaterStore((s) => s.lastLogAmount);
  const logWater = useWaterStore((s) => s.logWater);
  const undoLastLog = useWaterStore((s) => s.undoLastLog);
  const checkMidnightReset = useWaterStore((s) => s.checkMidnightReset);

  const [modalVisible, setModalVisible] = useState(false);
  const [showUndo, setShowUndo] = useState(false);
  const undoOpacity = useRef(new Animated.Value(0)).current;
  const undoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Midnight reset on app foreground
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        checkMidnightReset();
        // Reschedule notifications in case day rolled over
        scheduleReminders(wakeUpTime, sleepTime, useWaterStore.getState().consumed, dailyGoal, remindersEnabled);
      }
    });
    return () => sub.remove();
  }, [checkMidnightReset, wakeUpTime, sleepTime, dailyGoal, remindersEnabled]);

  // Also check on mount
  useEffect(() => {
    checkMidnightReset();
  }, [checkMidnightReset]);

  const handleLog = useCallback((amount: number) => {
    logWater(amount);
    const newConsumed = consumed + amount;

    // Reschedule notifications with updated consumption
    scheduleReminders(wakeUpTime, sleepTime, newConsumed, dailyGoal, remindersEnabled);

    // Show undo toast
    if (undoTimer.current) clearTimeout(undoTimer.current);
    setShowUndo(true);
    Animated.timing(undoOpacity, {
      toValue: 1,
      duration: 200,
      useNativeDriver: true,
    }).start();

    undoTimer.current = setTimeout(() => {
      Animated.timing(undoOpacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start(() => setShowUndo(false));
    }, 5000);
  }, [consumed, logWater, wakeUpTime, sleepTime, dailyGoal, remindersEnabled, undoOpacity]);

  const handleUndo = useCallback(() => {
    undoLastLog();
    if (undoTimer.current) clearTimeout(undoTimer.current);
    setShowUndo(false);
    undoOpacity.setValue(0);

    // Reschedule with reverted consumption
    const reverted = useWaterStore.getState().consumed;
    scheduleReminders(wakeUpTime, sleepTime, reverted, dailyGoal, remindersEnabled);
  }, [undoLastLog, wakeUpTime, sleepTime, dailyGoal, remindersEnabled, undoOpacity]);

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <Text style={[styles.greeting, { color: theme.text }]}>Hi, {name}</Text>

      <View style={styles.progressContainer}>
        <WaterProgressBar consumed={consumed} dailyGoal={dailyGoal} theme={theme} />
      </View>

      <TouchableOpacity
        style={[styles.logButton, { backgroundColor: theme.accent }]}
        onPress={() => setModalVisible(true)}
      >
        <Text style={styles.logButtonText}>Log Water</Text>
      </TouchableOpacity>

      <LogWaterModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        onLog={handleLog}
        theme={theme}
      />

      {/* Undo toast */}
      {showUndo && (
        <Animated.View style={[styles.undoToast, { backgroundColor: theme.surface, borderColor: theme.border, opacity: undoOpacity }]}>
          <Text style={{ color: theme.text }}>
            Logged {lastLogAmount} ml
          </Text>
          <TouchableOpacity onPress={handleUndo}>
            <Text style={{ color: theme.accent, fontWeight: '700', marginLeft: 16 }}>Undo</Text>
          </TouchableOpacity>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingTop: 60 },
  greeting: { fontSize: 24, fontWeight: '700', paddingHorizontal: 24 },
  progressContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  logButton: {
    marginHorizontal: 24,
    marginBottom: 32,
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
  },
  logButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  undoToast: {
    position: 'absolute',
    bottom: 100,
    left: 24,
    right: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    borderWidth: 1,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
  },
});
