# Goal Celebration — Subtle Ripple Animation

## Context

When users hit their daily water goal, nothing visually happens beyond the motivational text changing to "Daily goal reached." This is a missed moment. A subtle celebration reinforces the habit loop — the user logs water, sees the ring fill, and gets a satisfying visual reward. This builds the intrinsic motivation that keeps users coming back.

The celebration must align with the app's "quiet confidence" brand — no confetti, no badges, no interruptive text. The ripple should feel intrinsic to the ring, like a natural consequence of it being full, not a bolted-on reward.

## Feature

A double-pulse radial ripple animation in warm amber on the progress ring when the user's daily consumption reaches or exceeds their effective goal for the first time that day.

## Trigger

- **When:** `consumed >= effectiveGoal` transitions from false to true (i.e., the log that crosses the threshold)
- **Once per day:** Tracked via a `goalCelebratedToday: boolean` field in `useWaterStore`. Reset to `false` at midnight alongside the consumption reset.
- **Not on app open:** If the user already hit the goal earlier and reopens the app, no replay. The celebration only fires on the exact log that crosses the line.
- **Persistence:** `goalCelebratedToday` must be included in `partialize` so it survives app restart. Without persistence, reopening the app after hitting the goal would replay the animation (since `consumed` rehydrates but `goalCelebratedToday` would default to `false`).

## Animation

**Double-pulse amber ripple:**

Two concentric rings expand outward from the progress ring's edge with a 150ms stagger:

*First ring:*
- Circular ring (2px stroke, warm amber `#F0A050`) starts at the progress arc's outer edge (radius = 119px, computed from `(SIZE - STROKE_WIDTH) / 2`)
- Scales outward to 1.4x its initial size over 800ms
- Fades from 0.5 opacity to 0
- Easing: ease-out (fast start, slow finish — energy dissipating)

*Second ring (150ms delayed):*
- Same as first, but starts at 0.9x the initial radius (slightly inset)
- Scales to 1.3x over 700ms
- Fades from 0.35 opacity to 0
- Easing: ease-out

**Consumed value glow:**
- Instead of swapping text, the consumed number (e.g., "3.4") shifts color from white (`#F0F4F8`) to amber (`#F0A050`) over 300ms
- Holds amber for 2 seconds
- Fades back to white over 500ms
- This feels intrinsic — the number itself glows — not interruptive like text replacement

**No text flash.** The "of X.X L" text stays as-is. The ripple + number glow is the entire celebration.

**Total duration:** ~1000ms for ripples, ~2800ms for the number glow.

**Implementation:**
- Uses `Animated.stagger` for the two ripples + `Animated.sequence` for the number color
- All animations use `useNativeDriver: true` (except color — which requires `useNativeDriver: false` or an interpolated opacity approach)
- For the number glow: overlay a second `Text` in amber with animated opacity (0 → 1 → 0) positioned exactly on top of the white text. This avoids non-native color animation.

## Files to Modify

- `src/components/WaterProgressBar.tsx` — Add the two ripple `Animated.View`s around the ring, and the amber text overlay for the number glow. Accept a `celebrate: boolean` prop.
- `src/store/useWaterStore.ts` — Add `goalCelebratedToday` field. Set to `true` inside `logWater()` when crossing the goal. Reset at midnight. Include in `partialize`.
- `src/screens/HomeScreen.tsx` — Read `goalCelebratedToday` from store, detect the transition (was false, now true after log), pass `celebrate={true}` to `WaterProgressBar` once.

## State Changes

### useWaterStore additions:
```
goalCelebratedToday: boolean  // default false, persisted, reset at midnight
```

Set to `true` inside `logWater()` when:
- `goalCelebratedToday` is currently `false`
- New `consumed` (after adding amount) >= `effectiveGoal`

Reset to `false` inside `checkMidnightReset()` alongside consumed/lastLoggedAt/lastLogAmount.

Include in `partialize` so it persists across app restarts.

## What This Does NOT Include

- No haptic feedback (separate feature)
- No sound effect (separate feature)  
- No persistent visual change to the ring after celebration (it returns to normal)
- No celebration for exceeding goal on subsequent logs (only the first crossing)
- No confetti or particle effects
- No text replacement ("Goal reached" flash) — the number glow replaces this

## Verification

1. Log water until just below the goal (e.g., goal is 3400ml, log to 3300ml)
2. Log 150ml — this crosses the threshold
3. Verify: two amber ripple rings expand from the progress arc with a stagger
4. Verify: the consumed number glows amber for ~2 seconds, then fades back to white
5. Verify: "of X.X L" text does NOT change
6. Log another 250ml — verify: NO ripple or glow plays (already celebrated)
7. Kill and reopen the app — verify: no replay (goalCelebratedToday persisted as true)
8. Simulate midnight reset — verify: `goalCelebratedToday` resets to false
9. Next day, cross the goal again — verify: ripple + glow plays again
