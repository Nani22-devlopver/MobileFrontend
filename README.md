# Aarogya Drishti — Mobile App

Offline-capable, bilingual (English / తెలుగు) field app for community **oral-cancer screening** in rural and tribal districts of Andhra Pradesh. Health workers register patients and capture oral photographs, an AI "junior doctor" gives a provisional impression, and medical officers, specialists and navigators carry each case through to care.

> **Research demo — NOT FOR CLINICAL USE.** The AI output is advisory only. It is not a diagnosis and every case must be reviewed by a qualified clinician.

Built with **Expo SDK 54 · React Native 0.81 · React 19**. Backend: **FastAPI** (separate repository / folder). The AI model runs on the backend through **Ollama Cloud**; the phone never talks to the model directly.

---

## Contents
1. [Features](#1-features)
2. [Roles](#2-roles)
3. [What changed in this release](#3-what-changed-in-this-release)
4. [Project structure](#4-project-structure)
5. [Getting started](#5-getting-started)
6. [Configuration](#6-configuration)
7. [Offline mode and auto-sync](#7-offline-mode-and-auto-sync)
8. [Telugu (తెలుగు) support](#8-telugu-తెలుగు-support)
9. [AI assessment (English + Telugu)](#9-ai-assessment-english--telugu)
10. [Themes, safe area and layout](#10-themes-safe-area-and-layout)
11. [Build and release](#11-build-and-release)
12. [Test checklist](#12-test-checklist)
13. [Known limitations](#13-known-limitations)
14. [Troubleshooting](#14-troubleshooting)
15. [Privacy and safety](#15-privacy-and-safety)

---

## 1. Features
- Patient registration, consent capture, oral screening with camera / gallery photo upload
- AI image assessment: likely condition, urgency, self-care advice, when to see a doctor, a calm message for the patient
- Clinical review, referral and specialist assignment (including cross-mandal / cross-district requests)
- Appointments and video consultation (Google Meet link) handled by the specialist
- Navigator tasks, notifications, audit trail, district monitoring and admin tools
- **Works offline**, syncs automatically
- **English and Telugu** interface and AI output
- **Light / dark / automatic** theme, larger readable text, safe-area aware layout

## 2. Roles
| Role | Main screens |
|---|---|
| Health worker | Overview, Patients, Register, Screenings (photo + AI), Appointments, Notifications, Offline sync |
| Medical officer | Review queue and signed review, Referrals, Appointments, Patients, Investigations, Cross-mandal, District dashboard, Audit |
| Specialist | My patients (accept direct / video, reschedule, analysis), Appointments, Investigations, Patients |
| Navigator | Navigation tasks, Referrals, Appointments, Notifications |
| District admin | Dashboard, Monitoring, Approvals, Users, Districts and mandals, Hospitals, Specialists, Audit |
| Super admin | Everything above plus Users and admins, Cross-mandal, Data manager |

The server enforces every permission and geographic scope; the app can never grant more than the API allows. Earlier role changes are recorded in [`CHANGELOG-roles.md`](CHANGELOG-roles.md).

## 3. What changed in this release

| # | Request | What was done | Where |
|---|---|---|---|
| 1 | Text more visible, password entry not visible | Every font size is boosted (about +15 % for small text); all inputs now have an explicit text colour, 17 px size and a 52 px height. Login password field has a **Show / Hide** toggle (also on every password field in the app) and scrolls above the keyboard | `src/theme.js`, `src/rn.js`, `App.js`, `src/ui.js` |
| 2 | Stay inside the safe area; light and dark mode | `react-native-safe-area-context` insets plus extra margin keep content away from the status bar, notch and gesture bar. Theme can be **Auto (follows phone) / Light / Dark** and is remembered | `src/Screen.js`, `src/theme.js`, `app.json` |
| 3 | No overlapping UI; many items as selectable drop-downs | New searchable bottom-sheet **Dropdown**. `Chips` automatically becomes a drop-down above 5 options. District, mandal, hospital and specialist pickers, the admin hospital picker and the specialist-assignment screen use it. Long mandal lists are collapsible | `src/components/Dropdown.js`, `src/ui.js`, `src/screens/*` |
| 4 | AI response not displayed properly on mobile | New **AIAssessment** card replaces the raw JSON dump: condition, urgency badge, doctor advice and patient message up front, the rest behind *Show details*. Wraps long text and works for any screen width | `src/components/AIAssessment.js` |
| 5 | Offline use with automatic sync | SQLite read cache for every list/detail already opened, outbox for new patients and screenings, auto-sync on reconnect, on app start and every 60 s while online, pending counter in the top bar. The app no longer signs the user out when opened offline | `src/api/client.js`, `src/offline.js`, `src/db.js` |
| 6 | Telugu everywhere possible, including AI output | In-app language switch (EN / తెలుగు). About 400 UI strings translated, applied automatically to every screen. AI results show the backend's Telugu translation | `src/i18n.js`, `src/te.js`, `src/rn.js` |

## 4. Project structure
```
mobile/
├─ App.js                     Providers, sign-in, top status bar, role routing
├─ app.json · eas.json        Expo / EAS configuration
├─ .env.example               API URL template
├─ scripts/check.js           Parses every source file (npm run check)
└─ src/
   ├─ rn.js                   Drop-in for 'react-native': translated Text/TextInput/Alert + themed StyleSheet
   ├─ theme.js                Light/dark palettes, font boost, themed() and dyn() style mapping
   ├─ i18n.js · te.js         Language provider, tr() lookup, English→Telugu dictionary
   ├─ Screen.js               Safe-area container
   ├─ db.js                   SQLite handle, read cache
   ├─ offline.js              Outbox, auto-sync, queue counter
   ├─ api/                    client.js (fetch + cache) · endpoints.js
   ├─ components/             Dropdown · AIAssessment · PrefBar · MetricCard · RecordRow
   ├─ pages/                  Health worker, medical officer, workspaces, registration
   ├─ screens/                Role screens (admin, specialist, navigator, audit, ...)
   ├─ hooks/                  useHealthWorkerData
   ├─ ui.js · Shell.js        Shared UI kit and drawer layout
   └─ background.js           Background sync task (every 15 min)
```

## 5. Getting started
**Requirements:** Node 18+, npm, Android Studio emulator or a phone with Expo Go / a dev build, a running backend.

```bash
cd mobile
cp .env.example .env            # then edit EXPO_PUBLIC_API_URL
npm install
npx expo install react-native-safe-area-context   # only if npm did not already add it
npx expo start
```
- Android emulator: `EXPO_PUBLIC_API_URL=http://10.0.2.2:8000`
- Physical phone: `http://<your-computer-LAN-IP>:8000` (same Wi-Fi)
- Hosted backend: `https://<your-backend>` (the app falls back to the staging URL in `src/api/client.js` when the variable is empty)

Run the backend first: see `START-HERE.md` (`uvicorn app.main:app --host 0.0.0.0 --port 8000`).

Native modules (SQLite, notifications, image picker, safe-area) need a **development build** or EAS build for push notifications and background sync; the rest runs in Expo Go.

## 6. Configuration
**Mobile `.env`**

| Variable | Meaning |
|---|---|
| `EXPO_PUBLIC_API_URL` | Base URL of the FastAPI backend |

**Backend `.env`** (AI adapter, `ollama_adapter.py`)

| Variable | Meaning |
|---|---|
| `OLLAMA_API_KEY` | Ollama Cloud key (required; analysis fails with a clear message if missing) |
| `OLLAMA_BASE_URL` | Default `https://ollama.com` |
| `OLLAMA_MODEL` / `OLLAMA_FALLBACK_MODEL` | Vision-capable model and optional fallback |
| `OLLAMA_TIMEOUT_SECONDS` | Raise if analysis times out (the app tells users it can take up to two minutes) |
| `OLLAMA_MAX_IMAGE_PX` | Longest image side after downsizing before upload to the model |

`mock_adapter.py` is a deterministic demo provider that returns only a label and the not-for-clinical-use flag (no `feedback`); the app shows it without the detailed card sections.

## 7. Offline mode and auto-sync
**Reads.** Every successful `GET` is stored in SQLite. With no connection the last copy is shown (patients, screenings, appointments, notifications, referrals, dashboards, geography lists). The top bar shows *Offline — showing last loaded data*.

**Writes.** A new **patient** or **screening** created offline is placed in an outbox on the device with an idempotency key.

**Automatic sync** runs
- the moment connectivity returns,
- when the app starts,
- every 60 seconds while online and items are pending,
- every ~15 minutes in the background (development / EAS builds).

The top bar shows `N pending` until the outbox is empty. Rejected items (HTTP 4xx) are kept and retried a limited number of times; the app stops and waits when it gets a network error or `401`. The *Offline sync* page still offers a manual **Sync now**.

**Sign-in and sign-out.** Opening the app offline keeps the saved session. Logging out clears the cached data (so the next user never sees it) and warns if unsynced items remain; those items stay on the device and upload after the next sign-in.

**Needs internet:** first sign-in, registration, photo upload, AI analysis, video links, and actions by roles other than the health worker (reviews, referrals, approvals).

## 8. Telugu (తెలుగు) support
- Switch language from the **⚙** button in the top bar, the side drawer, or the sign-in / register screen. The choice is remembered.
- Headings, buttons, labels, placeholders, alerts, statuses, role names and navigation are translated through one dictionary, `src/te.js` (English text → Telugu). Lookup ignores case, a trailing `*`, and `(…)` / `·` parts.
- Line height is increased automatically for Telugu so characters are not clipped.
- Text that comes from the server (patient names, addresses, hospital names, clinician notes) is shown as entered.
- **Add or fix a translation:** add `'English text': 'తెలుగు',` to `src/te.js`. Nothing else is needed. Untranslated strings simply stay in English.

## 9. AI assessment (English + Telugu)
The backend sends the photograph and the health worker's context (age, sex, symptoms, duration, habits, notes — never name, phone, address or village) to the model with a "junior doctor" prompt and returns structured JSON:

```
feedback.predicted_condition / analysis / suggested_urgency / confidence
        .health_suggestions / warning_signs / consult_advice
        .health_worker_guidance / recapture_tips / clinician_summary / limitations
        .patient_message { en, te }
        .translations.te { …the same fields in Telugu… }
```
A second model call translates every text field into Telugu; if it fails the English result is still returned and the app falls back per field.

On the phone, `AIAssessment` shows, in order: urgency badge and warning banner → likely condition (+ likelihood / confidence) → other possibilities → photo issues and re-capture tips → who to see → calm patient message. *Show details* reveals the analysis, self-care, warning signs, guidance for the health worker, clinician note (medical officers), limitations, and provider/model. Telugu is used when the app language is Telugu.

## 10. Themes, safe area and layout
- **Theme:** Auto / Light / Dark. All existing styles pass through `themed()`, which maps colours for dark mode and increases font sizes, so new screens only need `StyleSheet.create` imported from `src/rn`.
- **Safe area:** `Screen` pads for the status bar, camera cut-out and gesture bar plus a small extra margin. Edge-to-edge is enabled for Android.
- **Inputs:** keyboard-aware sign-in and registration; forms scroll with `keyboardShouldPersistTaps`.
- **No overlap:** option lists use `Dropdown` (bottom sheet with search above 7 items); chips are limited to 5 and wrap.
- **Rules for new code:** import `View, Text, TextInput, StyleSheet, Alert…` from `src/rn` (not `react-native`); use `Dropdown` for lists longer than 5; put user-visible strings in plain English so they can be translated.

## 11. Build and release
```bash
npx expo prebuild                      # native projects
eas build -p android --profile preview # installable APK
eas build -p android --profile production
```
Package `org.aarogyadrishti.mobile`, EAS project id in `app.json`. Before release set a production `EXPO_PUBLIC_API_URL`, change the backend `JWT_SECRET` and super-admin password, and use HTTPS.

## 12. Test checklist
- [ ] Sign in: password visible with **Show**, text readable in light and dark, keyboard does not hide the fields
- [ ] Top and bottom content clear of status bar and gesture bar on a gesture-navigation phone
- [ ] Switch EN ↔ తెలుగు on sign-in, drawer, forms, alerts; Telugu text not clipped
- [ ] Switch Auto / Light / Dark; follows phone setting in Auto
- [ ] District → mandal → hospital → specialist use drop-downs; nothing overlaps on a small phone
- [ ] Airplane mode: open previously viewed lists; register a patient and create a screening; reconnect and confirm `pending` drops to 0 and records appear on the server
- [ ] Capture photo → Run AI assessment → card readable; Telugu shown in Telugu mode
- [ ] Log out with pending items shows the warning

## 13. Known limitations
- Photographs and AI analysis cannot be queued offline; a screening created offline gets its photo after it syncs.
- Only patient and screening creation is queued; other write actions need a connection.
- Strings built from data at run time (for example sentences with names or counts) are not fully translated; fixed words inside them are.
- Dark mode and larger text apply through the shared style mapper; a one-off inline colour that is not wrapped in `dyn()` may stay light.
- Dates and numbers use the phone's locale.
- This release was prepared without running the app on a device; all files were syntax-checked, so please run the checklist above on an Android phone and an emulator.

## 14. Troubleshooting
| Symptom | Fix |
|---|---|
| "Cannot reach API" | Check `EXPO_PUBLIC_API_URL`, that the backend listens on `0.0.0.0`, and phone and computer share Wi-Fi |
| Stuck on `pending` | Confirm internet, then use *Offline sync → Sync now*; a persistent 4xx means the server rejected the record |
| AI says key rejected / model not found | Check `OLLAMA_API_KEY` and `OLLAMA_MODEL` in the backend `.env` |
| AI analysis times out | Increase `OLLAMA_TIMEOUT_SECONDS`; reduce `OLLAMA_MAX_IMAGE_PX` |
| Telugu shows English in places | Add the string to `src/te.js`, or it is server-supplied text |
| Safe-area / native module error after update | Rebuild the dev client (`npx expo run:android`) |

## 15. Privacy and safety
- Photos and records are tied to consent; imaging consent is required before upload.
- The AI receives no name, phone, address or village.
- Cached data is cleared on logout; the session token is stored with AsyncStorage on the device.
- AI results are advisory, always tell the patient to see a doctor, and never name medicines or doses.

---
*Aarogya Drishti — research demonstration. Not a medical device.*
