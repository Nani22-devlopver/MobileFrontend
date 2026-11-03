# fixed-mobile-1 — Aarogya Drishti (FastAPI backend + Expo mobile app)

This is your mobile project with the web app's role privileges brought into the mobile app.
The backend is unchanged. The changes are all in `mobile/`.

## Corrected roles (this release)

| Area | Change |
|---|---|
| **District admin / Super admin (mobile)** | No longer land on the health-worker dashboard; each has its own drawer workspace (Dashboard, District monitoring, Pending approvals, Users, Districts & mandals, Hospitals, Specialists, Audit; super admin also Users & admins, Cross-mandal, Data manager). |
| **District admin scope** | Locked to their own district on the server (`/dashboard/summary`, `/admin/monitoring`, `/admin/users` and approvals ignore any other district); they can only narrow to a mandal. Demo `admin@demo.local` is tied to *Alluri Sitharama Raju*. *Reset demo data* is super admin only. Super admin still sees every district or all. |
| **Video consultation** | Moved from MO / navigator to the **specialist**. Only a specialist can create one, and only for a patient whose health worker chose **Video consultation: Allowed** at registration (`patients.video_allowed`; patients registered before this change keep video). MO and navigator no longer book or join video. |
| **MO assigns the specialist** | New page: *Patients -> tap a patient -> Assign specialist* (`GET /patients/{id}/assignment-options`, `POST /referrals`). Lists hospitals of the **patient's own mandal** with their available specialists (open-case count) or "Any available". The picker inside Clinical review is replaced by a button to this page. |
| **Cross-mandal / cross-district** | A hospital outside the patient's mandal or district needs a reason and becomes a request (`referrals.approval_status = PENDING`) sent to the **medical officers of that hospital's district** (never the requester). Specialist and navigator hear of the patient only after acceptance (`POST /referrals/{id}/cross-mandal/decision`). The mobile *Cross-mandal* screen lists referral and appointment requests. |
| **Specialist** | Accepts (direct visit; video only if the privilege exists) or reschedules, as before. |
| **Referrals screen (MO / navigator)** | Read-only status list; booking moved to the specialist. |

New columns (auto-added on start): `patients.video_allowed`, `referrals.cross_mandal / cross_reason / approval_status / approval_note / decided_by`.
The web frontend still shows the old MO/navigator video buttons; the server now answers those with a clear 403.

## What was fixed / added

### 1. Register button on the login screen
The sign-in screen now has a small **"New here? Register"** button. It opens a registration form
(`mobile/src/pages/RegisterScreen.js`) that works like the web "Register" tab:
name, email, password, designation (Health worker / Navigator / Medical officer / Specialist),
district + mandal chosen from the admin's master list, and a hospital picker for specialists.
The account stays *pending* until an admin approves it.

### 2. Specialist can accept patients (direct visit or video consultation)
`mobile/src/screens/SpecialistReferrals.js` — same flow as the web "My patients" page:
- **New requests / Accepted / Completed** tabs.
- **Accept patient** → choose **Direct visit** at the hospital *or* **Video consult**
  (date/time + Google Meet link, or *Start now*).
- Reschedule, join Google Meet, record analysis + outcome after the visit.
- Specialists also get Appointments, Investigations, Patients and Notifications.

### 3. Role privileges now match the web app

| Role | Mobile screens |
|---|---|
| Health worker | Overview, Patients, Register patient, Screenings, Appointments (join video), Notifications, Offline sync *(unchanged)* |
| Medical officer | Review queue + sign review, Referrals (book video / hospital slot), Appointments (manage), Patients, Investigations, Cross-mandal requests, District dashboard, Audit trail, Notifications |
| Specialist | My patients (accept direct/video, reschedule, analysis), Appointments, Investigations, Patients, Notifications |
| Navigator | Navigation tasks (accept / escalate / close, call patient), Referrals (book video / hospital slot incl. cross-mandal), Appointments, Notifications |
| District admin | Dashboard, District monitoring, Pending approvals, Users, Districts & mandals, Hospitals, Specialists, Audit trail, Notifications |
| Super admin | Everything an admin has + Users & admins, Cross-mandal requests, Data manager, Patients |

Also fixed: the Medical Officer's review outcome used values (`REFERRED`, `FOLLOW_UP` …) that differ
from the web (`refer`, `follow_up`, `recapture`). Mobile now sends the same values, and the referral form
only appears for outcome *refer*, with the same district → mandal → hospital → specialist picker as web.
Admin and Super admin accounts were previously blocked on mobile; they now have full workspaces.

The backend still enforces every permission and geographic scope, so the mobile menus can never
grant more than the API allows.

## New files
```
mobile/src/ui.js                       shared UI kit, date/time field, district/mandal + hospital pickers
mobile/src/Shell.js                    slide-out drawer layout used by the role workspaces
mobile/src/pages/Workspaces.js         Specialist / Navigator / Admin / Super admin workspaces (menus per role)
mobile/src/pages/RegisterScreen.js     self-registration
mobile/src/screens/                    Appointments, Referrals (booking), SpecialistReferrals, NavigatorTasks,
                                       CrossMandal, Investigations, Patients, Audit, Notifications, AdminScreens, video
```
Edited: `App.js`, `src/api/client.js` (errors now carry `status`), `src/pages/MedicalOfficerDashboard.js`.
Removed: `src/pages/RoleWorkspace.js` (replaced by `Workspaces.js`).

## Run it

Backend:
```bash
cd backend
cp .env.example .env     # set DB / Supabase values, JWT_SECRET, super-admin password
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Mobile:
```bash
cd mobile
cp .env.example .env     # EXPO_PUBLIC_API_URL=http://10.0.2.2:8000  (emulator) or http://<LAN-IP>:8000 (phone)
npm install
npx expo start
```
Demo accounts (if seeded): `hw / mo / spec / nav / admin / superadmin @demo.local`, password `Demo@123`.

## Notes
- Dates are typed as `YYYY-MM-DD HH:MM` (24 h) with +/- 1 h / 1 day buttons; the weekday is always shown.
- Google Meet links open in the phone's browser / Meet app.
- The code was syntax-checked and bundled with esbuild, but not run on a device or emulator
  (no Expo runtime here), so please do a quick test pass per role.
- AI image assessment is a research/demo aid only and is not for clinical use.
