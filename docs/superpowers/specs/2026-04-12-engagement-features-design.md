# Engagement Features Design — Streak, History Chart, Health Feedback

## Problem

The app's core loop (open → log → close) has no retention mechanism. There's nothing that builds over time — no streak, no weekly pattern, no sense of consistency. Without this, most users disengage within 2 weeks.

Additionally, the Health Connect integration feels invisible. Settings shows "Connected" but the home screen gives no persistent indication that activity data affects the goal.

## Decisions Made

| Decision | Choice | Rationale |
|----------|--------|-----------|
| History retention | Rolling 30 days | Enough for streaks + weekly chart. MMKV handles it easily. |
| Architecture | New `useHistoryStore` | Separates "today" (useWaterStore) from "the past" (useHistoryStore). Clean responsibilities. |
| Streak logic | `consumed >= effectiveGoal` | Simple boolean. No frozen goals, no 80% thresholds. Active days need more water — that's correct. |
| Streak includes today | Yes, live | Counter ticks up the moment you hit 100%. Delayed reward defeats the purpose. |
| Chart type | Rolling last 7 days | Always ends with today on the right. Fills up faster than Mon–Sun view. |
| Empty days in chart | Empty bars (2px stub) | The chart is always 7 columns wide. Missing days are visible data ("you didn't track"). |
| Health feedback | Active minutes line on home screen | Persistent, replaces motivational text when active. Makes the connection tangible. |
| Snapshot trigger | Midnight reset only | If user doesn't open the app, that day is a gap. Acceptable — no background tasks. |

## Data Layer

### New Store: `useHistoryStore`

**File:** `src/store/useHistoryStore.ts`

```typescript
interface DailySnapshot {
  date: string;            // "YYYY-MM-DD"
  consumed: number;        // ml, final value at end of day
  effectiveGoal: number;   // ml, effective goal at time of archive
  goalMet: boolean;        // consumed >= effectiveGoal
  activeMinutes: number;   // from Health Connect/HealthKit
  weatherBonus: number;    // ml, for context
}

interface HistoryState {
  snapshots: Record<string, DailySnapshot>;  // keyed by date string

  // Actions
  archiveDay: (snapshot: DailySnapshot) => void;
  pruneOldEntries: () => void;

  // Derived
  getCurrentStreak: () => number;
  getLast7Days: () => (DailySnapshot | null)[];
}
```

**Persistence:** Zustand + MMKV, same pattern as existing stores. Only `snapshots` is persisted.

### Archive Trigger

Inside `useWaterStore.checkMidnightReset()`, before zeroing `consumed`:

```typescript
useHistoryStore.getState().archiveDay({
  date: previousDate,
  consumed: currentConsumed,
  effectiveGoal: useGoalStore.getState().effectiveGoal,
  goalMet: currentConsumed >= useGoalStore.getState().effectiveGoal,
  activeMinutes: useGoalStore.getState().lastActiveMinutes,
  weatherBonus: useGoalStore.getState().weatherBonus,
});
```

### Pruning

`pruneOldEntries()` runs on every `archiveDay()` call. Iterates snapshot keys, deletes any older than 30 days.

### Streak Calculation

`getCurrentStreak()` walks backwards from yesterday, counting consecutive `goalMet === true` days. Stops at first `false` or missing day. Returns the count. Today is added to the display count (not the store count) if `consumed >= effectiveGoal` in the current session.

### getLast7Days

Returns array of 7 entries: today minus 6 through today minus 1 (from snapshots), plus a live entry for today built from `useWaterStore.consumed` and `useGoalStore.effectiveGoal`. Null for missing days.

## UI Components

### Streak Counter (`StreakCounter.tsx`)

**Placement:** Below the hero ring, above the contextual line. 8px margin below.

**Rendering:**
- Streak >= 1: 6px filled amber circle + `"{n} day streak"` (always "day", not "days" — e.g., "12 day streak")
- Streak 0: nothing renders, space collapses
- Live update: adds 1 to historical streak if today's `consumed >= effectiveGoal`

**Styling:**
- 13px Poppins SemiBold, `theme.accentWarm` (#F0A050)
- 6px filled circle prefix in amber, 6px gap to text
- Horizontally centered

### Active Minutes / Contextual Line

**Placement:** Below streak counter, above quick-log buttons. Occupies the same slot as motivational text.

**Logic:**
- If Health connected AND `lastActiveMinutes > 0`: show `"42 min active · +350ml"`
- Else: show motivational text (existing behavior)

**Styling:**
- "42 min active ·" — 13px Poppins Regular, `theme.textSecondary` (#7A8BA8)
- "+350ml" — 13px Poppins Medium, `theme.accent` (#3B9FE3)
- Thin-space padded middle dot separator (`\u2009·\u2009`)
- 8px margin above (below streak counter)

### 7-Day Mini Bar Chart (`WeeklyChart.tsx`)

**Placement:** Below quick-log buttons, above last-log display. 24px top margin.

**Visibility:** Hidden until user has 2+ days of history data. Before that, the ring and streak carry the experience.

**Layout:**
- Section label: "Last 7 days" — 13px Poppins SemiBold, `theme.textSecondary`, left-aligned
- 7 bars in a row, flex-based containers (`flex: 1`), bars at ~60% container width
- Bottom-aligned bars with day initials below

**Bar Rendering:**
- Height formula: `max(12, (consumed / effectiveGoal) * 80)` for non-zero days, `2` for zero/missing days
- Max height: 80px
- Top border-radius: 10px, flat bottom
- Built with `react-native-svg` `<Rect>` elements (already installed)

**Bar Colors:**
- Goal met (past): `theme.accent` (#3B9FE3) full opacity
- Goal not met (past): `theme.accent` (#3B9FE3) at 0.6 opacity
- Today: `theme.accentWarm` (#F0A050) amber
- Missing/zero day stub: `theme.accent` at 0.3 opacity

**Day Initials:**
- Past days: 12px Poppins Regular, `theme.textSecondary` (#7A8BA8)
- Today: 12px Poppins SemiBold, `theme.accentWarm` (#F0A050) amber

**Animation:** Smooth 200ms ease transition on today's bar height when logging water.

**Spacing:**
- 24px top margin above label
- 16px between label and bar tops
- 12px below day initials before last-log card
- Total vertical footprint: ~164px

## Home Screen Layout — Full Revised Flow

1. **Greeting + Name** — unchanged
2. **Weather Card** — unchanged, conditional
3. **Hero Ring** (250px) — unchanged
4. **Streak Counter** — hidden when 0, 8px margin below
5. **Contextual Line** (one slot):
   - Active minutes line (if health connected + activeMinutes > 0)
   - OR motivational text (fallback)
6. **Quick-Log Buttons** — unchanged
7. **7-Day Chart** — hidden until 2+ days of history
8. **Last Log Display** — unchanged

## Files Changed

| File | Change |
|------|--------|
| `src/store/useHistoryStore.ts` | **New.** History store with snapshots, archiveDay, pruning, streak, getLast7Days. |
| `src/components/StreakCounter.tsx` | **New.** Amber dot + streak text, hidden when 0, live today inclusion. |
| `src/components/WeeklyChart.tsx` | **New.** SVG bar chart, flex layout, amber today bar, 200ms animation. |
| `src/screens/HomeScreen.tsx` | **Modified.** Add StreakCounter, contextual line swap (active minutes vs motivational), WeeklyChart section. |
| `src/store/useWaterStore.ts` | **Modified.** Call `useHistoryStore.getState().archiveDay()` in `checkMidnightReset()` before zeroing consumed. |

## No New Dependencies

- Chart built with existing `react-native-svg`
- Animation uses React Native's built-in `Animated` API or `LayoutAnimation`
- Storage uses existing MMKV + Zustand persist pattern

## What This Does NOT Include

- Monthly/yearly stats screen
- Export functionality
- Notification copy changes based on streaks
- Writing water data back to Health Connect/HealthKit
- Tap-to-expand on chart bars
- Achievement badges or milestones

These are all potential future additions but are out of scope for this iteration.
