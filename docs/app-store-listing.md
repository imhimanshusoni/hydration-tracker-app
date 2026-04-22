# App Store Listing — Water Reminder by Habuild

Source of truth for App Store Connect copy. Update here, then paste into App Store Connect → your app → Distribution.

## App Information (set-once, version-independent)

- **Name:** Water Reminder by Habuild
- **Subtitle (30 chars):** `Smart hydration tracker`
- **Bundle ID:** `in.habuild.waterreminder`
- **SKU:** `waterreminder-ios`
- **Primary category:** Health & Fitness
- **Secondary category:** Lifestyle
- **Content rights:** Does not contain third-party content
- **Age rating:** 4+ (no objectionable content)
- **Privacy Policy URL:** `https://habuild.in/water-reminder/privacy-policy/`

## Version 1.0 page

### Promotional Text (170 chars, can be updated without re-review)

```
Your daily water goal isn't a fixed number — it's a moving target. We adapt yours to today's weather, your workouts, and your profile. Stay hydrated, smarter.
```

(161 chars)

### Description (4,000 chars)

```
Water Reminder is a smart hydration tracker that adapts to you. Instead of nagging you with the same daily goal, it personalizes your target based on your weight, age, activity level, the weather outside, and how much you've moved today.

WHAT MAKES IT SMART
• Personalized goal — set up your profile once; the app calculates a starting target using a multi-factor formula.
• Weather-aware — fetches local weather and raises your goal in hot or humid conditions.
• Activity-aware — reads active minutes from Apple Health (with your permission) and adds hydration when you exercise.
• Climate fallback — pick your climate (cold / temperate / hot / tropical) for offline-friendly adjustments.

QUICK LOGGING
• Tap 150 ml, 250 ml, or 500 ml to log instantly.
• Or enter any custom amount from 50–1000 ml.
• Five-second undo on every log.
• Midnight auto-reset; the previous day is archived to history.

PROGRESS YOU CAN SEE
• Beautiful circular progress ring with a water-fill effect that rises as you drink.
• 7-day chart so you can spot patterns at a glance.
• Streak counter — see how many consecutive days you've hit 80% of your goal.
• Subtle goal-met celebration without overdoing it.

SMART REMINDERS
• Hourly reminders between your wake-up and sleep times.
• Each reminder reflects your current intake — no generic "drink water" pings.
• Time-sensitive notifications that respect Focus modes.

DESIGNED FOR FOCUS
• Premium dark mode out of the box.
• Poppins typography.
• No accounts. No ads. No upsells.

PRIVACY
Your profile and water-log history live on your device. Anonymous usage events go to our analytics provider (Mixpanel, EU region) to help us improve the app — never email, password, contacts, or precise location. Full policy at https://habuild.in/water-reminder/privacy-policy/.

PERMISSIONS (all optional)
• Apple Health — read active minutes only, never write.
• Location (when in use) — fetch local weather; coordinates are not stored.
• Notifications — for hydration reminders.

The app works fully without granting any of these — they unlock the smarter goal adjustments.
```

### Keywords (100 chars, comma-separated, no spaces)

```
drink,h2o,intake,fitness,wellness,health,goal,daily,habit,thirst,glass,bottle,routine,log,goals
```

(95 chars. Avoids words already in the title/subtitle — Apple's algorithm searches title + subtitle + keywords, so duplicating wastes the field.)

### Support URL

```
https://habuild.in/water-reminder/support/
```

(Needs a one-pager at that path — sibling to the privacy policy. Apple requires an actual URL, not `mailto:`. The page can be one paragraph: "For support, contact engineering@habuild.in.")

### Marketing URL (optional)

```
https://habuild.in/water-reminder/
```

(Skip if no landing page exists yet.)

### Version

```
1.0
```

(First App Store release. Independent of `MARKETING_VERSION = 1.4.0` in pbxproj — the App Store version is its own counter that starts at 1.0 for the first release on this platform.)

### Copyright

```
2026 Habuild Healthtech Pvt. Ltd.
```

(Apple prepends © automatically.)

### Routing App Coverage File / App Clip / iMessage App

Skip all three — not applicable.

### Build

Empty until you upload an .ipa via TestFlight. After upload + processing (~15 min), the dropdown will list build `1.4.0 (8)`. Select it.

## App Review Information

### Sign-In Information

- **Sign-in required:** unchecked (no account)

### Contact Information

- **First name:** Himanshu
- **Last name:** Soni
- **Phone number:** (your number)
- **Email:** engineering@habuild.in

### Notes (4,000 chars)

```
Water Reminder is a personal hydration tracker. It does not require an account or any sign-in.

PERMISSIONS (all optional — the app functions fully without any):

• HealthKit (read-only): The app reads HKQuantityTypeIdentifierAppleExerciseTime to bump the daily water goal when the user has been active. We do NOT write to HealthKit. Active-minutes are summarized to a goal-bump amount (e.g. "+250 ml") locally; no raw health data is transmitted off-device.

• Location (when in use): Used once per smart-goal recalculation to fetch local weather from OpenWeatherMap, to determine if conditions are hot/humid (which raises the goal). Coordinates are not stored. We do not operate a server — only OpenWeatherMap receives the lat/lng.

• Notifications: Hourly hydration reminders the user opts into during onboarding. Use the Time Sensitive interruption level so they respect Focus modes. Schedule is between the user's chosen wake-up and sleep times.

DATA COLLECTION: The app sends anonymous product analytics to Mixpanel (EU region). Profile fields (name, age, weight, gender, activity level, climate preference, sleep schedule, daily goal) are attached to a Mixpanel distinct ID generated locally on first install. We do not collect email, phone, or precise location. Privacy policy: https://habuild.in/water-reminder/privacy-policy/

HOW TO TEST:
1. Open the app — onboarding asks for name, weight, age, gender, activity level.
2. You can skip the Health/Location/Notification prompts; the app still works.
3. On the home screen, tap any of the 150/250/500 ml buttons to log water; you'll see the ring fill.
4. Long-press a bar in the 7-day chart to see that day's history.
5. Open Settings to edit profile fields, toggle reminders on/off, or grant Health permission.

There is no demo account because there is no account system.
```

### Attachment

Skip unless reviewer asks. (If they reject for HealthKit ambiguity later, attach a screenshot showing the active-minutes-to-goal-bump path on the home screen.)

### App Store Version Release

- **Manually release this version** ✓

(Recommended for first release: once approved, you can verify the listing once more, then click Release at a chosen time. Switch to "Automatically release after App Review, no earlier than" or full automatic for later releases.)
