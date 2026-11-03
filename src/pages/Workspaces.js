import React, {useCallback, useEffect, useState} from 'react';
import {api} from '../api/client';
import Shell from '../Shell';
import {Card, Title, Muted, Btn, Section, human} from '../ui';
import Notifications from '../screens/Notifications';
import Appointments from '../screens/Appointments';
import Referrals from '../screens/Referrals';
import SpecialistReferrals from '../screens/SpecialistReferrals';
import Investigations from '../screens/Investigations';
import Patients from '../screens/Patients';
import NavigatorTasks from '../screens/NavigatorTasks';
import CrossMandal from '../screens/CrossMandal';
import Audit from '../screens/Audit';
import {AdminDashboard, AdminMonitoring, AdminPending, AdminUsers, AdminGeography, AdminHospitals, AdminSpecialists, SuperUsers, SuperData} from '../screens/AdminScreens';

// Same role privileges as the web app (see web Layout.jsx / App.jsx route guards).
const MENU = {
  specialist: [['My patients', 'Accept (direct or video), reschedule, analysis'], ['Appointments', 'Consultation schedule'], ['Investigations', 'Biopsies and reports'], ['Patients', 'Patient records'], ['Notifications', 'Alerts and updates']],
  navigator: [['Navigation tasks', 'Guide patients to care'], ['Referrals', 'Referred patients and their specialist'], ['Appointments', 'Patient visit schedule'], ['Notifications', 'Alerts and updates']],
  admin: [['Dashboard', 'Your district indicators'], ['District monitoring', 'Live monitoring of your district'], ['Pending approvals', 'New registrations'], ['Users', 'Staff accounts'], ['Districts & mandals', 'Geography master list'], ['Hospitals', 'Referral hospitals'], ['Specialists', 'Hospital doctors'], ['Audit trail', 'Every access and change'], ['Notifications', 'Alerts and updates']],
  super_admin: [['Dashboard', 'Programme indicators'], ['District monitoring', 'Live monitoring'], ['Pending approvals', 'New registrations'], ['Users', 'All accounts'], ['Users & admins', 'Add / edit / delete accounts'], ['Districts & mandals', 'Geography master list'], ['Hospitals', 'Referral hospitals'], ['Specialists', 'Hospital doctors'], ['Cross-mandal requests', 'Decide outside-mandal bookings'], ['Data manager', 'Any table, any row'], ['Patients', 'Patient records'], ['Audit trail', 'Every access and change'], ['Notifications', 'Alerts and updates']],
};
const LABEL = {specialist: 'Specialist', navigator: 'Patient Navigator', admin: 'District Admin', super_admin: 'Super Admin'};

export default function RoleWorkspace({user, onLogout}) {
  const items = MENU[user.role] || [];
  const [page, setPage] = useState(items[0][0]), [unread, setUnread] = useState(0), [pending, setPending] = useState(0), [tick, setTick] = useState(0);
  const isAdmin = user.role === 'admin' || user.role === 'super_admin';
  const refreshBadges = useCallback(() => {
    api('/notifications').then(r => setUnread((Array.isArray(r) ? r : []).filter(n => !n.read).length)).catch(() => {});
    if (isAdmin) api('/admin/users?status=pending').then(r => setPending(r.length)).catch(() => {});
  }, [isAdmin]);
  useEffect(() => { refreshBadges(); const t = setInterval(refreshBadges, 20000); return () => clearInterval(t); }, [refreshBadges]);
  const changed = () => { refreshBadges(); };
  const menu = items.map(([n, d]) => [n, n === 'Pending approvals' && pending ? `${d} (${pending} waiting)` : d]);
  const views = {
    'My patients': <SpecialistReferrals onChanged={changed} />,
    'Appointments': <Appointments user={user} onChanged={changed} />,
    'Investigations': <Investigations />,
    'Patients': <Patients />,
    'Notifications': <Notifications user={user} onNavigate={setPage} onChanged={changed} />,
    'Navigation tasks': <NavigatorTasks user={user} />,
    'Referrals': <Referrals onChanged={changed} />,
    'Dashboard': <AdminDashboard user={user} />,
    'District monitoring': <AdminMonitoring user={user} />,
    'Pending approvals': <AdminPending onChanged={changed} />,
    'Users': <AdminUsers user={user} />,
    'Users & admins': <SuperUsers user={user} />,
    'Districts & mandals': <AdminGeography user={user} />,
    'Hospitals': <AdminHospitals user={user} />,
    'Specialists': <AdminSpecialists user={user} />,
    'Cross-mandal requests': <CrossMandal onChanged={changed} />,
    'Data manager': <SuperData />,
    'Audit trail': <Audit />,
  };
  return <Shell user={user} roleLabel={LABEL[user.role]} items={menu} page={page} setPage={setPage} onLogout={onLogout} unread={unread} onRefresh={() => { setTick(t => t + 1); refreshBadges(); }}>
    <React.Fragment key={`${page}:${tick}`}>{views[page]}</React.Fragment>
  </Shell>;
}
