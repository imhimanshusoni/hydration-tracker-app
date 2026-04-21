// HomeScreen — Refined water-tracking experience.
//
// Critique-driven redesign:
// - Removed emoji icons (replaced with clean text + subtle drop SVG)
// - Removed redundant "QUICK LOG" label
// - Removed "Daily goal" from header (already shown in ring)
// - Tightened ring section spacing
// - Added motivational subtext that changes with progress
// - Quick-log buttons are now bold numeric buttons, not cards with emoji
// - Warmer accent (amber) used for the Custom button to break monochrome

import {
  Animated,
  AppState,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import React, { useCallback, useEffect, useRef, useState } from 'react';

import { Fonts } from '../fonts';
import { LogWaterModal } from '../components/LogWaterModal';
import { StreakCounter } from '../components/StreakCounter';
import { WaterProgressBar } from '../components/WaterProgressBar';
import { WeatherCard } from '../components/WeatherCard';
import { WeeklyChart } from '../components/WeeklyChart';
import { getTheme } from '../theme';
import { getTodayActiveMinutes } from '../utils/healthService';
import { scheduleReminders } from '../utils/notificationScheduler';
import { useGoalStore } from '../store/useGoalStore';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useUserStore } from '../store/useUserStore';
import { useWaterStore } from '../store/useWaterStore';

const QUICK_LOG = [150, 250, 500];

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

function getMotivation(progress: number): string {
  if (progress === 0) return 'Start your day with a glass of water';
  if (progress < 0.25) return 'Great start, keep going';
  if (progress < 0.5) return "You're making progress";
  if (progress < 0.75) return 'More than halfway there';
  if (progress < 1) return 'Almost at your goal';
  return 'Daily goal reached';
}

function formatLogTime(isoString: string): string {
  const d = new Date(isoString);
  const h = d.getHours();
  const m = String(d.getMinutes()).padStart(2, '0');
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${h12}:${m} ${ampm}`;
}

export function HomeScreen() {
  const theme = getTheme(null);
  const insets = useSafeAreaInsets();

  const name = useUserStore(s => s.name);
  const wakeUpTime = useUserStore(s => s.wakeUpTime);
  const sleepTime = useUserStore(s => s.sleepTime);
  const remindersEnabled = useUserStore(s => s.remindersEnabled);

  const effectiveGoal = useGoalStore(s => s.effectiveGoal);
  const goalAdjustmentToast = useGoalStore(s => s.goalAdjustmentToast);
  const clearToast = useGoalStore(s => s.clearToast);
  const lastActiveMinutes = useGoalStore(s => s.lastActiveMinutes);
  const activityBump = useGoalStore(s => s.activityBump);

  const consumed = useWaterStore(s => s.consumed);
  const lastLogAmount = useWaterStore(s => s.lastLogAmount);
  const lastLoggedAt = useWaterStore(s => s.lastLoggedAt);
  const logWater = useWaterStore(s => s.logWater);
  const undoLastLog = useWaterStore(s => s.undoLastLog);
  const checkMidnightReset = useWaterStore(s => s.checkMidnightReset);
  const goalCelebratedToday = useWaterStore(s => s.goalCelebratedToday);

  const [modalVisible, setModalVisible] = useState(false);
  const [showUndo, setShowUndo] = useState(false);
  const [showGoalToast, setShowGoalToast] = useState(false);
  const [triggerCelebration, setTriggerCelebration] = useState(false);
  const undoOpacity = useRef(new Animated.Value(0)).current;
  const goalToastOpacity = useRef(new Animated.Value(0)).current;
  const undoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const goalToastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevCelebratedRef = useRef(goalCelebratedToday);

  const progress = effectiveGoal > 0 ? consumed / effectiveGoal : 0;

  useEffect(() => {
    const sub = AppState.addEventListener('change', state => {
      if (state === 'active') {
        checkMidnightReset();
        const currentGoal = useGoalStore.getState().effectiveGoal;
        scheduleReminders(
          wakeUpTime,
          sleepTime,
          useWaterStore.getState().consumed,
          currentGoal,
          remindersEnabled,
        );
        // Check for activity bumps
        getTodayActiveMinutes().then(minutes => {
          useGoalStore.getState().applyActivityBump(minutes);
        });
      }
    });
    return () => sub.remove();
  }, [checkMidnightReset, wakeUpTime, sleepTime, remindersEnabled]);

  useEffect(() => {
    checkMidnightReset();
    // Initial activity check on mount
    getTodayActiveMinutes().then(minutes => {
      useGoalStore.getState().applyActivityBump(minutes);
    });
  }, [checkMidnightReset]);

  // Detect goal celebration transition (false → true)
  useEffect(() => {
    if (goalCelebratedToday && !prevCelebratedRef.current) {
      setTriggerCelebration(true);
    }
    prevCelebratedRef.current = goalCelebratedToday;
  }, [goalCelebratedToday]);

  // Goal adjustment toast
  useEffect(() => {
    if (goalAdjustmentToast) {
      if (goalToastTimer.current) clearTimeout(goalToastTimer.current);
      setShowGoalToast(true);
      Animated.timing(goalToastOpacity, {
        toValue: 1,
        duration: 250,
        useNativeDriver: true,
      }).start();
      goalToastTimer.current = setTimeout(() => {
        Animated.timing(goalToastOpacity, {
          toValue: 0,
          duration: 250,
          useNativeDriver: true,
        }).start(() => {
          setShowGoalToast(false);
          clearToast();
        });
      }, 4000);
    }
  }, [goalAdjustmentToast, goalToastOpacity, clearToast]);

  const handleQuickLog = useCallback(
    (amount: number) => {
      logWater(amount, 'quick');
      const newConsumed = consumed + amount;
      scheduleReminders(
        wakeUpTime,
        sleepTime,
        newConsumed,
        effectiveGoal,
        remindersEnabled,
      );
      showUndoToast();
    },
    [
      consumed,
      logWater,
      wakeUpTime,
      sleepTime,
      effectiveGoal,
      remindersEnabled,
    ],
  );

  const handleModalLog = useCallback(
    (amount: number) => {
      logWater(amount, 'custom');
      const newConsumed = consumed + amount;
      scheduleReminders(
        wakeUpTime,
        sleepTime,
        newConsumed,
        effectiveGoal,
        remindersEnabled,
      );
      showUndoToast();
    },
    [
      consumed,
      logWater,
      wakeUpTime,
      sleepTime,
      effectiveGoal,
      remindersEnabled,
    ],
  );

  function showUndoToast() {
    if (undoTimer.current) clearTimeout(undoTimer.current);
    setShowUndo(true);
    Animated.timing(undoOpacity, {
      toValue: 1,
      duration: 250,
      useNativeDriver: true,
    }).start();
    undoTimer.current = setTimeout(() => {
      Animated.timing(undoOpacity, {
        toValue: 0,
        duration: 250,
        useNativeDriver: true,
      }).start(() => setShowUndo(false));
    }, 5000);
  }

  const handleUndo = useCallback(() => {
    undoLastLog();
    if (undoTimer.current) clearTimeout(undoTimer.current);
    setShowUndo(false);
    undoOpacity.setValue(0);
    const reverted = useWaterStore.getState().consumed;
    scheduleReminders(
      wakeUpTime,
      sleepTime,
      reverted,
      effectiveGoal,
      remindersEnabled,
    );
  }, [
    undoLastLog,
    wakeUpTime,
    sleepTime,
    effectiveGoal,
    remindersEnabled,
    undoOpacity,
  ]);

  return (
    <View
      style={[
        styles.screen,
        { backgroundColor: theme.background, paddingTop: insets.top },
      ]}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header — just greeting + name, no redundant goal */}
        <View style={styles.header}>
          <Text style={[styles.greeting, { color: theme.textSecondary }]}>
            {getGreeting()},
          </Text>
          <Text style={[styles.name, { color: theme.text }]}>{name}</Text>
        </View>

        {/* Weather card */}
        <WeatherCard theme={theme} />

        {/* Hero progress ring with water fill */}
        <View style={styles.ringSection}>
          <WaterProgressBar
            consumed={consumed}
            dailyGoal={effectiveGoal}
            theme={theme}
            celebrate={triggerCelebration}
          />
        </View>

        {/* Streak counter — hidden when 0 */}
        <StreakCounter theme={theme} />

        {/* Contextual line: active minutes (if available) or motivational text */}
        {lastActiveMinutes > 0 && activityBump > 0 ? (
          <Text style={[styles.motivation, { color: theme.textSecondary }]}>
            {lastActiveMinutes} min active{'\u2009\u00B7\u2009'}
            <Text style={{ color: theme.accent, fontFamily: Fonts.medium }}>
              +{activityBump}ml
            </Text>
          </Text>
        ) : (
          <Text style={[styles.motivation, { color: theme.textSecondary }]}>
            {getMotivation(progress)}
          </Text>
        )}

        {/* Quick-log buttons */}
        <View style={styles.quickLogRow}>
          {QUICK_LOG.map(ml => (
            <TouchableOpacity
              key={ml}
              style={[
                styles.quickLogButton,
                { backgroundColor: theme.surface },
              ]}
              onPress={() => handleQuickLog(ml)}
              activeOpacity={0.7}
            >
              <Text style={[styles.quickLogAmount, { color: theme.text }]}>
                {ml}
              </Text>
              <Text
                style={[styles.quickLogUnit, { color: theme.textSecondary }]}
              >
                ml
              </Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity
            style={[styles.customButton, { backgroundColor: theme.accentWarm }]}
            onPress={() => setModalVisible(true)}
            activeOpacity={0.7}
          >
            <Text style={[styles.customPlus, { color: '#FFFFFF' }]}>+</Text>
            <Text style={[styles.customLabel, { color: '#FFFFFF' }]}>
              Custom
            </Text>
          </TouchableOpacity>
        </View>

        {/* 7-day history chart — hidden until 2+ days of data */}
        <WeeklyChart theme={theme} />

        {/* Last logged */}
        {lastLoggedAt && (
          <View style={styles.lastLogCard}>
            <View style={[styles.logDot, { backgroundColor: theme.accent }]} />
            <Text style={[styles.lastLogText, { color: theme.text }]}>
              {lastLogAmount}ml
            </Text>
            <Text style={[styles.lastLogTime, { color: theme.textSecondary }]}>
              {formatLogTime(lastLoggedAt)}
            </Text>
          </View>
        )}
      </ScrollView>

      <LogWaterModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        onLog={handleModalLog}
        theme={theme}
      />

      {/* Undo toast */}
      {showUndo && (
        <Animated.View
          style={[
            styles.undoToast,
            {
              backgroundColor: theme.surface,
              borderColor: theme.border,
              opacity: undoOpacity,
              bottom: 100 + insets.bottom,
            },
          ]}
        >
          <View style={[styles.undoBar, { backgroundColor: theme.accent }]} />
          <Text style={[styles.undoText, { color: theme.text }]}>
            +{lastLogAmount}ml
          </Text>
          <TouchableOpacity
            onPress={handleUndo}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Text style={[styles.undoAction, { color: theme.accent }]}>
              Undo
            </Text>
          </TouchableOpacity>
        </Animated.View>
      )}

      {/* Goal adjustment toast */}
      {showGoalToast && goalAdjustmentToast && (
        <Animated.View
          style={[
            styles.undoToast,
            {
              backgroundColor: theme.surface,
              borderColor: theme.accentWarm,
              opacity: goalToastOpacity,
              bottom: (showUndo ? 156 : 100) + insets.bottom,
            },
          ]}
        >
          <View
            style={[styles.undoBar, { backgroundColor: theme.accentWarm }]}
          />
          <Text style={[styles.undoText, { color: theme.text }]}>
            {goalAdjustmentToast}
          </Text>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  scrollContent: { paddingHorizontal: 24 },

  header: { paddingTop: 16, marginBottom: 4 },
  greeting: { fontSize: 15, fontFamily: Fonts.regular, letterSpacing: 0.2 },
  name: {
    fontSize: 26,
    fontFamily: Fonts.semiBold,
    letterSpacing: -0.3,
    marginTop: 2,
  },

  ringSection: { alignItems: 'center', paddingTop: 12, paddingBottom: 8 },

  motivation: {
    fontSize: 13,
    fontFamily: Fonts.regular,
    textAlign: 'center',
    marginBottom: 28,
    letterSpacing: 0.2,
  },

  quickLogRow: { flexDirection: 'row', gap: 10 },
  quickLogButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 4,
    borderRadius: 14,
    minHeight: 68,
    justifyContent: 'center',
    gap: 2,
  },
  quickLogAmount: { fontSize: 18, fontFamily: Fonts.bold },
  quickLogUnit: { fontSize: 11, fontFamily: Fonts.regular },
  customButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 4,
    borderRadius: 14,
    minHeight: 68,
    justifyContent: 'center',
    gap: 2,
  },
  customPlus: { fontSize: 18, fontFamily: Fonts.light, marginBottom: -2 },
  customLabel: { fontSize: 12, fontFamily: Fonts.semiBold },

  lastLogCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
    paddingVertical: 12,
    paddingHorizontal: 16,
    gap: 10,
  },
  logDot: { width: 6, height: 6, borderRadius: 3 },
  lastLogText: { fontSize: 14, fontFamily: Fonts.medium, flex: 1 },
  lastLogTime: { fontSize: 13, fontFamily: Fonts.regular },

  undoToast: {
    position: 'absolute',
    left: 24,
    right: 24,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  undoBar: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 3 },
  undoText: {
    flex: 1,
    fontSize: 14,
    fontFamily: Fonts.semiBold,
    marginLeft: 8,
  },
  undoAction: { fontSize: 14, fontFamily: Fonts.bold, letterSpacing: 0.3 },
});
