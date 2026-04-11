// HomeScreen — Premium dark-mode instrument panel design.
//
// Design decisions:
// - Deep navy (#0A0F1E) base creates depth and lets the teal progress ring glow
// - Time-aware greeting ("Good morning/afternoon/evening") adds personality
// - The progress ring is the hero: large, centered, with gradient arc and
//   decorative concentric rings for an instrument-panel feel
// - Quick-log buttons are frosted glass cards with emoji icons — tactile, not flat
// - Today's log section shows recent entries as a subtle timeline
// - Undo toast uses the accent border for visibility without being loud
// - All touch targets are 48pt+ for iOS HIG compliance
// - Generous spacing (24px horizontal, 16-20px vertical gaps) prevents cramping

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  AppState,
  Animated,
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getTheme } from '../theme';
import { useUserStore } from '../store/useUserStore';
import { useWaterStore } from '../store/useWaterStore';
import { WaterProgressBar } from '../components/WaterProgressBar';
import { LogWaterModal } from '../components/LogWaterModal';
import { scheduleReminders } from '../utils/notificationScheduler';
import { Fonts } from '../fonts';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Quick-log presets with icons
const QUICK_LOG = [
  { ml: 150, label: '150ml', icon: '💧' },
  { ml: 250, label: '250ml', icon: '🥤' },
  { ml: 500, label: '500ml', icon: '🫗' },
];

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
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

  const name = useUserStore((s) => s.name);
  const dailyGoal = useUserStore((s) => s.dailyGoal);
  const wakeUpTime = useUserStore((s) => s.wakeUpTime);
  const sleepTime = useUserStore((s) => s.sleepTime);
  const remindersEnabled = useUserStore((s) => s.remindersEnabled);

  const consumed = useWaterStore((s) => s.consumed);
  const lastLogAmount = useWaterStore((s) => s.lastLogAmount);
  const lastLoggedAt = useWaterStore((s) => s.lastLoggedAt);
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
        scheduleReminders(
          wakeUpTime,
          sleepTime,
          useWaterStore.getState().consumed,
          dailyGoal,
          remindersEnabled,
        );
      }
    });
    return () => sub.remove();
  }, [checkMidnightReset, wakeUpTime, sleepTime, dailyGoal, remindersEnabled]);

  useEffect(() => {
    checkMidnightReset();
  }, [checkMidnightReset]);

  const handleQuickLog = useCallback(
    (amount: number) => {
      logWater(amount);
      const newConsumed = consumed + amount;
      scheduleReminders(wakeUpTime, sleepTime, newConsumed, dailyGoal, remindersEnabled);
      showUndoToast();
    },
    [consumed, logWater, wakeUpTime, sleepTime, dailyGoal, remindersEnabled],
  );

  const handleModalLog = useCallback(
    (amount: number) => {
      logWater(amount);
      const newConsumed = consumed + amount;
      scheduleReminders(wakeUpTime, sleepTime, newConsumed, dailyGoal, remindersEnabled);
      showUndoToast();
    },
    [consumed, logWater, wakeUpTime, sleepTime, dailyGoal, remindersEnabled],
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
    scheduleReminders(wakeUpTime, sleepTime, reverted, dailyGoal, remindersEnabled);
  }, [undoLastLog, wakeUpTime, sleepTime, dailyGoal, remindersEnabled, undoOpacity]);

  const goalL = (dailyGoal / 1000).toFixed(1);

  return (
    <View style={[styles.screen, { backgroundColor: theme.background, paddingTop: insets.top }]}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={[styles.greeting, { color: theme.textSecondary }]}>
            {getGreeting()},
          </Text>
          <Text style={[styles.name, { color: theme.text }]}>{name}</Text>
          <Text style={[styles.goalLabel, { color: theme.textSecondary }]}>
            Daily goal: {goalL}L
          </Text>
        </View>

        {/* Hero progress ring */}
        <View style={styles.ringSection}>
          <WaterProgressBar consumed={consumed} dailyGoal={dailyGoal} theme={theme} />
        </View>

        {/* Quick-log buttons */}
        <View style={styles.quickLogSection}>
          <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>
            QUICK LOG
          </Text>
          <View style={styles.quickLogRow}>
            {QUICK_LOG.map(({ ml, label, icon }) => (
              <TouchableOpacity
                key={ml}
                style={[
                  styles.quickLogButton,
                  { backgroundColor: theme.surface, borderColor: theme.border },
                ]}
                onPress={() => handleQuickLog(ml)}
                activeOpacity={0.7}
              >
                <Text style={styles.quickLogIcon}>{icon}</Text>
                <Text style={[styles.quickLogAmount, { color: theme.text }]}>{label}</Text>
              </TouchableOpacity>
            ))}
            {/* Custom button */}
            <TouchableOpacity
              style={[
                styles.quickLogButton,
                { backgroundColor: theme.surface, borderColor: theme.accent },
              ]}
              onPress={() => setModalVisible(true)}
              activeOpacity={0.7}
            >
              <Text style={[styles.quickLogIcon, { fontSize: 18 }]}>+</Text>
              <Text style={[styles.quickLogAmount, { color: theme.accent }]}>Custom</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Last logged indicator */}
        {lastLoggedAt && (
          <View style={[styles.lastLogCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <View style={[styles.logDot, { backgroundColor: theme.accent }]} />
            <View style={styles.lastLogContent}>
              <Text style={[styles.lastLogText, { color: theme.text }]}>
                Last logged {lastLogAmount}ml
              </Text>
              <Text style={[styles.lastLogTime, { color: theme.textSecondary }]}>
                {formatLogTime(lastLoggedAt)}
              </Text>
            </View>
          </View>
        )}

        {/* Bottom spacer for tab bar */}
        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Log Water Modal */}
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
              borderColor: theme.accent,
              opacity: undoOpacity,
              bottom: 100 + insets.bottom,
            },
          ]}
        >
          <View style={[styles.undoAccent, { backgroundColor: theme.accent }]} />
          <Text style={[styles.undoText, { color: theme.text }]}>
            +{lastLogAmount}ml logged
          </Text>
          <TouchableOpacity
            onPress={handleUndo}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Text style={[styles.undoAction, { color: theme.accent }]}>Undo</Text>
          </TouchableOpacity>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
  },

  // Header
  header: {
    paddingTop: 16,
    marginBottom: 8,
  },
  greeting: {
    fontSize: 16,
    fontFamily: Fonts.medium,
    letterSpacing: 0.3,
  },
  name: {
    fontSize: 28,
    fontFamily: Fonts.bold,
    letterSpacing: -0.3,
    marginTop: 2,
  },
  goalLabel: {
    fontSize: 13,
    fontFamily: Fonts.medium,
    marginTop: 6,
    letterSpacing: 0.2,
  },

  // Progress ring
  ringSection: {
    alignItems: 'center',
    paddingVertical: 24,
  },

  // Quick log
  quickLogSection: {
    marginTop: 8,
  },
  sectionLabel: {
    fontSize: 11,
    fontFamily: Fonts.bold,
    letterSpacing: 1.5,
    marginBottom: 12,
  },
  quickLogRow: {
    flexDirection: 'row',
    gap: 10,
  },
  quickLogButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 16,
    borderRadius: 16,
    borderWidth: 1,
    minHeight: 80,
    justifyContent: 'center',
  },
  quickLogIcon: {
    fontSize: 22,
    marginBottom: 6,
  },
  quickLogAmount: {
    fontSize: 13,
    fontFamily: Fonts.bold,
    letterSpacing: 0.3,
  },

  // Last log
  lastLogCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 20,
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
  },
  logDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 14,
  },
  lastLogContent: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  lastLogText: {
    fontSize: 14,
    fontFamily: Fonts.semiBold,
  },
  lastLogTime: {
    fontSize: 13,
    fontFamily: Fonts.medium,
  },

  // Undo toast
  undoToast: {
    position: 'absolute',
    left: 24,
    right: 24,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 14,
    borderWidth: 1,
    overflow: 'hidden',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  undoAccent: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 3,
  },
  undoText: {
    flex: 1,
    fontSize: 14,
    fontFamily: Fonts.semiBold,
    marginLeft: 8,
  },
  undoAction: {
    fontSize: 14,
    fontFamily: Fonts.bold,
    letterSpacing: 0.3,
  },
});
