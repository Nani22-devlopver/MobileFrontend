# Aarogya Drishti — Start Here

This archive contains the FastAPI backend and the Expo React Native Health Worker app.

## 1. Configure the backend

1. Open a terminal in `backend`.
2. Copy `.env.example` to `.env`.
3. Set your Supabase/PostgreSQL connection string, Supabase URL and server-side service role key.
4. Change `JWT_SECRET` and the super-admin password before using real data.
5. Install and start:

```bash
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

The backend needs a working database and Supabase configuration. Those credentials are intentionally not included in this ZIP.

## 2. Configure the mobile app

1. Open a second terminal in `mobile`.
2. Copy `.env.example` to `.env`.
3. Set `EXPO_PUBLIC_API_URL`:
   - Android emulator: `http://10.0.2.2:8000`
   - Physical phone: `http://YOUR_COMPUTER_LAN_IP:8000` (phone and computer must share Wi-Fi)
4. Install and start:

```bash
npm install
npx expo start
```

## 3. Navigation

Tap the ☰ menu in the app header to open the side drawer. Select Overview, Patients, Register, Screenings, Appointments, Notifications or Offline sync. Tap the × button or the dark area outside the drawer to close it. The horizontal tab bar has been removed to give the page more room.

## Role scope

Corrected roles: district admin and super admin have their own workspaces (the district admin sees their own district only); video consultations belong to the specialist and need the patient's video privilege (set by the health worker at registration); the medical officer assigns the specialist from the patient's page, and cross-mandal / cross-district requests go to that district's medical officers. See README.md.

The mobile app now supports Health Worker, Medical Officer, Specialist, Navigator, District Admin and Super Admin accounts, matching the web app. See `README.md` for the per-role screen list.

AI image assessment is a research/demo aid only and is **not for clinical use**. A qualified clinician must review patients.
