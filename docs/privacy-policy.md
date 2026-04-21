---
layout: default
title: Privacy Policy
permalink: /privacy-policy/
---

# Water Reminder — Privacy Policy

**Last updated:** 2026-04-21

Water Reminder ("the app", "we") is a personal hydration tracker for iOS and Android. This policy describes what data the app collects, where it goes, and your rights.

## Short version

- The app stores your profile and logs **on your device**. It does not sync to any account or cloud service we operate — there is no server.
- Product analytics are sent to **Mixpanel** (third party). This includes your name, age, weight, gender, activity level, and app-usage events.
- Weather-based goal adjustments use your **approximate location** (one fetch per goal recalculation) via **OpenWeatherMap**. Coordinates are not stored by us or retained by OpenWeatherMap beyond the request.
- We do not collect email addresses, phone numbers, precise location history, or any payment information.

## Data the app collects and where it is stored

### On your device (not transmitted anywhere by us)

- Your display name, weight, age, gender, activity level, climate preference, wake-up time, sleep time, and daily hydration goal.
- Your daily water-log history (up to 30 days).
- Streak counts and goal-celebration state.
- App preferences (reminders on/off, health-integration permissions).

This data lives in MMKV storage on your device. Uninstalling the app wipes it.

### Sent to Mixpanel (analytics)

We use Mixpanel (Mixpanel, Inc.) for product analytics — to understand how the app is used and improve it. The following user-profile data is attached to your Mixpanel user profile:

- Display name (as entered in Settings)
- Weight (kg), age (years), gender
- Activity level, climate preference
- Wake-up and sleep times
- Daily hydration goal (ml)
- Install date
- Platform (iOS / Android), app version, build number

In addition, **product events** are sent — hydration logs, goal-met events, screen views, app open/close, notification delivery/tap, onboarding steps, health-permission prompts, profile edits. Events are tagged with the above profile fields as "super properties" for analysis.

**What is not sent to Mixpanel:** email addresses, phone numbers, passwords, precise GPS coordinates, exact timestamps beyond Mixpanel's own `$time` field, contents of notifications, or any data from Apple Health / Health Connect beyond a summary count of active minutes.

Mixpanel's own privacy policy: <https://mixpanel.com/legal/privacy-policy/>. The data is hosted in the EU region (Mixpanel EU residency).

### Sent to OpenWeatherMap (weather)

When the app calculates your smart daily goal, it fetches the current weather for your approximate location. Your device sends one request to OpenWeatherMap containing latitude and longitude (rounded). OpenWeatherMap does not receive your name or any other identifier. OpenWeatherMap's privacy policy: <https://openweather.co.uk/privacy-policy>.

We do not store your location history.

### Optional: Apple Health / Android Health Connect

If you grant permission, the app reads **active minutes** from Apple Health (iOS) or Health Connect (Android) to adjust your daily goal. This data is read on-demand and never transmitted off your device. Only an aggregate bump amount (e.g. "+350 ml") is derived and sent to Mixpanel as part of goal-recalculation events.

### Notifications

Hydration reminders are scheduled and delivered locally by your device's notification system. The reminder text contains your current hydration progress (e.g. "1.2L of 2.8L today"). We do not receive the delivery or tap events — they are tracked locally only, then sent to Mixpanel as anonymized counts (scheduled hour, current consumption, goal).

## Your rights

- **Access:** The app's Settings screen shows all personal data we collect.
- **Correction:** Edit any profile field in Settings. Changes sync to Mixpanel.
- **Deletion:** Uninstalling the app wipes all on-device data permanently. To delete your Mixpanel profile, email the contact below with your device's "distinct ID" (shown in the app's developer tools if needed — contact us for help). Under GDPR / CCPA, we will action deletion within 30 days.
- **Portability:** On-device data is not sync'd, so there is nothing to export today. If this changes in a future version, we will update this policy.
- **Opt-out of analytics:** A Settings toggle is planned but not shipping in 1.4.0. If you want to opt out before it ships, uninstall the app.

## Children's privacy

The app is not directed to children under 13. We do not knowingly collect data from children.

## Changes to this policy

We may update this policy when we add or change features. The "Last updated" date at the top reflects the most recent change. If the change affects what data is collected or shared, we will mention it in the release notes for that version.

## Contact

For privacy questions, data-deletion requests, or concerns:

**engineering@habuild.in**

---

*This policy reflects the app's actual behavior as of version 1.4.0. The source lives at `docs/privacy-policy.md` in the project repo.*
