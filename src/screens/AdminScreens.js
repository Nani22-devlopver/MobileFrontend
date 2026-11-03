import {dyn} from '../theme';
import React, {useEffect, useMemo, useState} from 'react';
import {View, Text, Alert} from '../rn';
import {api} from '../api/client';
import Dropdown from '../components/Dropdown';
import {Card, Title, Muted, Empty, Err, Ok, Btn, Field, Pill, Spinner, Chips, Section, GeoPicker, useLoad, arr, human, s} from '../ui';

const confirmDo = (title, text, fn) => Alert.alert(title, text, [{text: 'Cancel', style: 'cancel'}, {text: 'Yes', style: 'destructive', onPress: fn}]);
const qs = scope => { const p = []; if (scope.district) p.push(`district=${encodeURIComponent(scope.district)}`); if (scope.mandal) p.push(`mandal=${encodeURIComponent(scope.mandal)}`); return p.length ? `?${p.join('&')}` : ''; };
const scopeTitle = (sc, base) => (sc?.mandal ? `${sc.mandal} mandal — ${sc.district}` : sc?.district ? `${sc.district} district` : `${base} · all districts`);
const ROLE_NAME = {health_worker: 'Health worker', navigator: 'Navigator', medical_officer: 'Medical officer', specialist: 'Specialist', admin: 'District admin', super_admin: 'Super admin'};

// A district admin is tied to one district: the dashboard is always that district (only the mandal can be narrowed).
// A super admin can pick any district or look at all of them.
const lockedDistrict = user => (user?.role === 'admin' && user?.district ? user.district : '');
function ScopeFilter({value, onChange, user}) {
  const locked = lockedDistrict(user);
  const [mandals, setMandals] = useState([]);
  useEffect(() => { if (locked) api('/geo').then(r => setMandals(((r.districts || []).find(d => d.name === locked) || {}).mandals || [])).catch(() => {}); }, [locked]);
  if (locked) return <Card><Title>{locked} district</Title><Muted>You see this district only. Pick a mandal to narrow it down.</Muted>
    <Chips options={[['', 'Whole district'], ...mandals.map(m => [m.name, m.name])]} value={value.mandal || ''} onChange={m => onChange({district: locked, mandal: m})} /></Card>;
  return <Card><Title>Dashboard level</Title><GeoPicker district={value.district} mandal={value.mandal} onChange={onChange} />{(!!value.district || !!value.mandal) && <Btn small secondary title="Show all districts" onPress={() => onChange({district: '', mandal: ''})} />}</Card>;
}
const Bars = ({data, color = '#0d7669'}) => {
  const rows = Object.entries(data || {}).sort((a, b) => b[1] - a[1]); const max = Math.max(1, ...rows.map(r => r[1]));
  if (!rows.length) return <Muted>No data yet.</Muted>;
  return rows.map(([k, v]) => <View key={k} style={{marginVertical: 5}}><View style={{flexDirection: 'row', justifyContent: 'space-between'}}><Text style={dyn({fontSize: 12, color: '#35524c'})}>{human(k)}</Text><Text style={dyn({fontWeight: '800', color: '#173c38'})}>{v}</Text></View><View style={dyn({height: 6, backgroundColor: '#e8f3f0', borderRadius: 3})}><View style={{height: 6, borderRadius: 3, width: `${Math.round(v / max * 100)}%`, backgroundColor: color}} /></View></View>);
};
const Kpis = ({items}) => <View style={{flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between'}}>{items.map(([k, v]) => <View key={k} style={dyn({width: '48%', backgroundColor: '#fff', padding: 13, borderRadius: 12, marginBottom: 9, borderWidth: 1, borderColor: '#e3ece9'})}><Text style={dyn({fontSize: 24, fontWeight: '900', color: '#0d7669'})}>{v}</Text><Text style={s.muted}>{k}</Text></View>)}</View>;

// ---------------- Dashboard (admin, super admin) ----------------
export function AdminDashboard({user}) {
  const [scope, setScope] = useState({district: lockedDistrict(user), mandal: ''}), [d, setD] = useState(null), [err, setErr] = useState(''), [msg, setMsg] = useState('');
  const load = () => api(`/dashboard/summary${qs(scope)}`).then(setD).catch(e => setErr(e.message));
  useEffect(() => { setD(null); load(); }, [scope.district, scope.mandal]);
  const reset = () => confirmDo('Reset ALL synthetic demo data?', 'Patients, screenings, referrals… are cleared. User accounts and districts are kept.', async () => { try { await api('/admin/reset-demo', {method: 'POST'}); setMsg('Synthetic demo data reset.'); load(); } catch (e) { setErr(e.message); } });
  return <>
    <ScopeFilter value={scope} onChange={setScope} user={user} /><Err text={err} /><Ok text={msg} />
    {!d ? <Spinner /> : <>
      <Title>{scopeTitle(d.scope, 'Dashboard')}</Title>{!!d.note && <Muted>{d.note}</Muted>}
      <View style={{height: 8}} />
      <Kpis items={Object.entries(d).filter(([, v]) => typeof v === 'number').map(([k, v]) => [human(k), v])} />
      {user?.role === 'super_admin' && <Btn secondary title="Reset synthetic demo data" onPress={reset} />}
    </>}
  </>;
}

// ---------------- District monitoring ----------------
export function AdminMonitoring({user}) {
  const [scope, setScope] = useState({district: lockedDistrict(user), mandal: ''}), [d, setD] = useState(null), [err, setErr] = useState('');
  const load = () => api(`/admin/monitoring${qs(scope)}`).then(x => { setD(x); setErr(''); }).catch(e => setErr(e.message));
  useEffect(() => { load(); const t = setInterval(load, 60000); return () => clearInterval(t); }, [scope.district, scope.mandal]);
  return <>
    <ScopeFilter value={scope} onChange={setScope} user={user} /><Err text={err} />
    {!d ? <Spinner /> : <>
      <Title>{scopeTitle(d.scope, 'Monitoring')}</Title>{!!d.note && <Muted>{d.note}</Muted>}
      <View style={{height: 8}} /><Kpis items={d.funnel.map(f => [f.stage, f.value])} />
      <Section>Needs attention</Section><Card>{d.alerts.map(a => <View key={a.label} style={{flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6}}><Text style={dyn({flex: 1, color: '#35524c'})}>{a.label}</Text><Text style={dyn({fontWeight: '900', color: a.value ? '#b42318' : '#0d6b3d'})}>{a.value}</Text></View>)}</Card>
      <Section>Screenings — last 14 days</Section><Card><View style={{flexDirection: 'row', alignItems: 'flex-end', height: 110, gap: 3}}>{(() => { const m = Math.max(1, ...d.trend.map(p => p.count)); return d.trend.map(p => <View key={p.date} style={{flex: 1, alignItems: 'center', justifyContent: 'flex-end', height: '100%'}}><Text style={{fontSize: 9}}>{p.count || ''}</Text><View style={{width: '100%', height: `${Math.max(3, p.count / m * 85)}%`, backgroundColor: p.count ? '#0d7669' : '#dfe8e5', borderRadius: 3}} /></View>); })()}</View></Card>
      <Section>Staff (active)</Section><Card>{Object.entries(d.staff.by_role).map(([r, n]) => <View key={r} style={{flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4}}><Text>{human(r)}</Text><Text style={{fontWeight: '800'}}>{n}</Text></View>)}<Muted>Pending approvals: {d.staff.pending} · Suspended: {d.staff.suspended}</Muted></Card>
      {!scope.district && !lockedDistrict(user) && <><Section>District-wise activity</Section>{d.by_district.map(a => <Card key={a.area}><Title>{a.area}</Title><Muted>Patients {a.patients} · Screenings {a.screenings} · Referrals {a.referrals}</Muted>{a.area !== 'Unspecified' && <Btn small secondary title="Open district" onPress={() => setScope({district: a.area, mandal: ''})} />}</Card>)}</>}
      {!scope.mandal && <><Section>Mandal-wise activity{scope.district ? ` — ${scope.district}` : ''}</Section>{d.by_area.map(a => <Card key={a.area}><Title>{a.area}</Title><Muted>Patients {a.patients} · Screenings {a.screenings} · Referrals {a.referrals}</Muted>{!!scope.district && a.area !== 'Unspecified' && <Btn small secondary title="Open mandal" onPress={() => setScope({district: scope.district, mandal: a.area})} />}</Card>)}</>}
      {[['Screening status', 'screening_status'], ['Referral status', 'referral_status'], ['Referral priority', 'referral_priority'], ['Appointments', 'appointment_status'], ['Investigations', 'investigation_state'], ['Patient navigation', 'navigation_status'], ['AI screening labels (research only)', 'ai_labels']].map(([t, k]) => <View key={k}><Section>{t}</Section><Card><Bars data={d[k]} /></Card></View>)}
      <Muted>Updated {new Date(d.generated_at).toLocaleString()} · auto-refreshes every minute</Muted>
    </>}
  </>;
}

// ---------------- Pending approvals ----------------
export function AdminPending({onChanged}) {
  const {data, error, reload} = useLoad('/admin/users?status=pending');
  const [err, setErr] = useState(''), [msg, setMsg] = useState('');
  const decide = async (u, a) => { setErr(''); setMsg(''); try { await api(`/admin/users/${u.id}/${a}`, {method: 'POST'}); setMsg(a === 'approve' ? `${u.full_name} approved.` : `${u.full_name} declined.`); onChanged && onChanged(); reload(); } catch (e) { setErr(e.message); } };
  if (!data) return <Spinner />;
  return <>
    <Muted>New registrations can sign in only after you approve them.</Muted><Err text={err || error} /><Ok text={msg} />
    {data.map(u => <Card key={u.id}><Title>{u.full_name}</Title><Muted>{u.email} · {ROLE_NAME[u.role] || human(u.role)}{'\n'}{[u.assigned_facility, u.mandal, u.district].filter(Boolean).join(' · ')}</Muted>
      <View style={{flexDirection: 'row'}}><Btn small title="Approve" onPress={() => decide(u, 'approve')} /><Btn small secondary title="Decline" onPress={() => decide(u, 'reject')} /></View></Card>)}
    {!data.length && <Empty text="No registrations waiting." />}
  </>;
}

// ---------------- Users (view, suspend / reactivate) ----------------
const METRIC_LABEL = {patients_registered: 'Patients registered', screenings_done: 'Screenings done', photos_uploaded: 'Photos uploaded', awaiting_clinician: 'Awaiting clinician', reviews_signed: 'Reviews signed', referrals_created: 'Referrals created', cases_waiting_review: 'Cases waiting review', referrals_in_system: 'Referrals in system', appointments_completed: 'Appointments completed', appointments_open: 'Appointments open', investigations_reviewed: 'Investigations reviewed', investigations_pending: 'Investigations pending'};
export function AdminUsers({user}) {
  const {data, error, reload} = useLoad('/admin/users');
  const [role, setRole] = useState(''), [status, setStatus] = useState(''), [q, setQ] = useState(''), [detail, setDetail] = useState(null), [reason, setReason] = useState(''), [err, setErr] = useState(''), [msg, setMsg] = useState('');
  const rows = useMemo(() => (data || []).filter(u => (!role || u.role === role) && (!status || u.status === status) && `${u.full_name} ${u.email}`.toLowerCase().includes(q.trim().toLowerCase())), [data, role, status, q]);
  const open = async u => { setErr(''); try { setDetail(await api(`/admin/users/${u.id}`)); } catch (e) { setErr(e.message); } };
  const act = async (u, action) => { setErr(''); setMsg(''); try { await api(`/admin/users/${u.id}/${action}`, {method: 'POST', body: {reason}}); setMsg(`${u.full_name} ${action === 'suspend' ? 'suspended' : 'reactivated'}.`); setReason(''); setDetail(null); reload(); } catch (e) { setErr(e.message); } };
  if (detail) { const u = detail.user, w = detail.work || {}; return <>
    <Btn secondary title="← Back to users" onPress={() => setDetail(null)} />
    <Card><Title>{u.full_name}</Title><Muted>{u.email} · {ROLE_NAME[u.role] || human(u.role)}{'\n'}{[u.assigned_facility, u.mandal, u.district].filter(Boolean).join(' · ')}</Muted><Pill text={u.status} />
      {u.id !== user.id && (u.status === 'active' ? <><Field label="Suspension reason (optional)" value={reason} onChangeText={setReason} autoCapitalize="sentences" /><Btn danger title="Suspend user" onPress={() => act(u, 'suspend')} /></> : u.status === 'suspended' ? <Btn title="Reactivate user" onPress={() => act(u, 'reactivate')} /> : null)}</Card>
    <Err text={err} />
    <Section>Work status</Section><Kpis items={Object.entries(w.metrics || {}).map(([k, v]) => [METRIC_LABEL[k] || human(k), v])} />
    <Section>Recent activity</Section>{(w.recent_activity || []).map((a, i) => <Card key={i}><Title>{a.event}</Title><Muted>{new Date(a.created_at).toLocaleString()} {a.resource || ''}</Muted></Card>)}{!(w.recent_activity || []).length && <Empty text="No recorded actions yet." />}
  </>; }
  return <>
    <Muted>All health workers, navigators, medical officers and specialists{user.role === 'super_admin' ? ', including district admins' : ''}. Select one to see their work status, or to suspend / reactivate them.</Muted>
    <Chips options={[['', 'All'], ['health_worker', 'Health workers'], ['navigator', 'Navigators'], ['medical_officer', 'Medical officers'], ['specialist', 'Specialists'], ...(user.role === 'super_admin' ? [['admin', 'District admins'], ['super_admin', 'Super admins']] : [])]} value={role} onChange={setRole} />
    <Chips options={[['', 'Any status'], ['active', 'Active'], ['pending', 'Pending'], ['suspended', 'Suspended'], ['rejected', 'Declined']]} value={status} onChange={setStatus} />
    <Field label="Search" value={q} onChangeText={setQ} placeholder="Name or email" /><Err text={err || error} /><Ok text={msg} />
    {!data ? <Spinner /> : rows.map(u => <Card key={u.id}><Title>{u.full_name}</Title><Muted>{u.email} · {ROLE_NAME[u.role] || human(u.role)}</Muted><Pill text={u.status} /><Btn small secondary title="View" onPress={() => open(u)} /></Card>)}
    {data && !rows.length && <Empty text="No users match." />}
  </>;
}

// ---------------- Districts & mandals ----------------
export function AdminGeography({user}) {
  const {data, error, reload} = useLoad('/geo');
  const [newD, setNewD] = useState(''), [mand, setMand] = useState({}), [ren, setRen] = useState(null), [openM, setOpenM] = useState({}), [err, setErr] = useState(''), [msg, setMsg] = useState('');
  const call = async (path, opt, ok) => { setErr(''); setMsg(''); try { await api(path, opt); setMsg(ok); reload(); return true; } catch (e) { setErr(e.message); return e; } };
  const list = t => t.split(/[\n,]/).map(x => x.trim()).filter(Boolean);
  const remove = (kind, item) => confirmDo(`Remove ${kind} "${item.name}"?`, kind === 'district' ? 'Its mandals are removed too.' : '', async () => {
    const r = await call(`/admin/geo/${kind}s/${item.id}`, {method: 'DELETE'}, `${item.name} removed`);
    if (r && r.status === 409 && user.role === 'super_admin') confirmDo('In use', `${r.message}\n\nRemove it from the list anyway? Existing records keep their saved text.`, () => call(`/admin/geo/${kind}s/${item.id}?force=true`, {method: 'DELETE'}, `${item.name} removed`));
  });
  if (!data) return <Spinner />;
  const districts = data.districts || [];
  return <>
    <Muted>This list fills the district and mandal choices on every registration form and drives the district / mandal dashboards.</Muted><Err text={err || error} /><Ok text={msg} />
    <Card><Title>Add districts</Title><Field label="District names — one per line, or separated by commas" value={newD} onChangeText={setNewD} multiline autoCapitalize="words" /><Btn title="Add districts" disabled={!list(newD).length} onPress={async () => { if (await call('/admin/geo/districts', {method: 'POST', body: {names: list(newD)}}, 'Districts added') === true) setNewD(''); }} /></Card>
    {districts.map(d => <Card key={d.id}>
      <Title>{d.name}</Title><Muted>{d.mandals.length} mandals</Muted>
      <View style={{flexDirection: 'row', flexWrap: 'wrap'}}><Btn small secondary title="Rename" onPress={() => setRen({kind: 'district', item: d, name: d.name})} /><Btn small danger title="Remove" onPress={() => remove('district', d)} /></View>
      {!!d.mandals.length && <Btn small secondary title={openM[d.id] ? `▲ ${d.mandals.length} mandals` : `▼ ${d.mandals.length} mandals`} onPress={() => setOpenM({...openM, [d.id]: !openM[d.id]})} />}
      {!!openM[d.id] && d.mandals.map(m => <View key={m.id} style={dyn({flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#e3ece9'})}><Text style={{flex: 1}}>{m.name}</Text><Text style={dyn({color: '#0d7669', fontWeight: '900', padding: 8})} onPress={() => setRen({kind: 'mandal', item: m, name: m.name})}>✎</Text><Text style={dyn({color: '#b42318', fontWeight: '900', padding: 8})} onPress={() => remove('mandal', m)}>✕</Text></View>)}
      <Field label="Add mandals (one per line or comma separated)" value={mand[d.id] || ''} onChangeText={v => setMand({...mand, [d.id]: v})} multiline autoCapitalize="words" />
      <Btn small title="Add mandals" disabled={!list(mand[d.id] || '').length} onPress={async () => { if (await call('/admin/geo/mandals', {method: 'POST', body: {district_id: d.id, names: list(mand[d.id])}}, 'Mandals added') === true) setMand({...mand, [d.id]: ''}); }} />
    </Card>)}
    {!districts.length && <Empty text="No districts yet. Add your first district above." />}
    {!!ren && <Card style={dyn({borderColor: '#0d7669'})}><Title>Rename {ren.kind} "{ren.item.name}"</Title><Field value={ren.name} onChangeText={v => setRen({...ren, name: v})} autoCapitalize="words" /><View style={{flexDirection: 'row'}}><Btn small title="Save" disabled={!ren.name.trim() || ren.name.trim() === ren.item.name} onPress={async () => { if (await call(`/admin/geo/${ren.kind}s/${ren.item.id}`, {method: 'PATCH', body: {name: ren.name}}, 'Renamed — existing records were updated too') === true) setRen(null); }} /><Btn small secondary title="Cancel" onPress={() => setRen(null)} /></View></Card>}
  </>;
}

// ---------------- Hospitals ----------------
export function AdminHospitals({user}) {
  const {data, error, reload} = useLoad('/hospitals?include_unavailable=true');
  const blank = {name: '', district: user.role === 'admin' ? user.district || '' : '', mandal: '', address: '', contact_phone: '', contact_email: ''};
  const [form, setForm] = useState(blank), [edit, setEdit] = useState(null), [q, setQ] = useState(''), [err, setErr] = useState(''), [msg, setMsg] = useState('');
  const run = async (fn, ok) => { setErr(''); setMsg(''); try { await fn(); setMsg(ok); reload(); return true; } catch (e) { setErr(e.message); return false; } };
  const rows = (data || []).filter(h => `${h.name} ${h.mandal} ${h.district}`.toLowerCase().includes(q.trim().toLowerCase()));
  const F = (st, set, k, label, extra = {}) => <Field label={label} value={st[k]} onChangeText={v => set({...st, [k]: v})} autoCapitalize="words" {...extra} />;
  return <>
    <Muted>Add and update the hospitals of each mandal. Medical officers choose from this list when they refer a patient.</Muted><Err text={err || error} /><Ok text={msg} />
    <Card><Title>Add hospital</Title>{F(form, setForm, 'name', 'Hospital name *')}<GeoPicker district={form.district} mandal={form.mandal} onChange={g => setForm({...form, ...g})} required />{F(form, setForm, 'address', 'Address')}{F(form, setForm, 'contact_phone', 'Contact phone', {keyboardType: 'phone-pad'})}{F(form, setForm, 'contact_email', 'Contact email', {keyboardType: 'email-address'})}
      <Btn title="Add hospital" disabled={!form.name.trim() || !form.district || !form.mandal} onPress={async () => { if (await run(() => api('/hospitals', {method: 'POST', body: form}), 'Hospital added')) setForm(blank); }} /></Card>
    <Field label="Search hospitals" value={q} onChangeText={setQ} />
    {!data ? <Spinner /> : rows.map(h => <Card key={h.id}>
      <Title>{h.name}</Title><Muted>{h.mandal}, {h.district}{h.address ? ` · ${h.address}` : ''}{h.contact_phone ? ` · ${h.contact_phone}` : ''}</Muted><Pill text={h.available ? 'Available' : 'Unavailable'} />
      {edit?.id === h.id ? <View>{F(edit, setEdit, 'name', 'Name')}{F(edit, setEdit, 'address', 'Address')}{F(edit, setEdit, 'contact_phone', 'Contact phone')}{F(edit, setEdit, 'contact_email', 'Contact email')}
        <View style={{flexDirection: 'row'}}><Btn small title="Save" onPress={async () => { const {id, ...body} = edit; if (await run(() => api(`/hospitals/${h.id}`, {method: 'PATCH', body}), 'Hospital updated')) setEdit(null); }} /><Btn small secondary title="Cancel" onPress={() => setEdit(null)} /></View></View>
        : <View style={{flexDirection: 'row', flexWrap: 'wrap'}}><Btn small secondary title="Edit" onPress={() => setEdit({id: h.id, name: h.name, address: h.address || '', contact_phone: h.contact_phone || '', contact_email: h.contact_email || ''})} /><Btn small secondary title={h.available ? 'Mark unavailable' : 'Mark available'} onPress={() => run(() => api(`/hospitals/${h.id}`, {method: 'PATCH', body: {available: !h.available}}), 'Hospital updated')} /><Btn small danger title="Remove" onPress={() => confirmDo(`Remove ${h.name}?`, 'This cannot be undone.', () => run(() => api(`/hospitals/${h.id}`, {method: 'DELETE'}), 'Hospital removed'))} /></View>}
    </Card>)}
    {data && !rows.length && <Empty text="No hospitals yet." />}
  </>;
}

// ---------------- Specialists ----------------
export function AdminSpecialists({user}) {
  const specs = useLoad('/specialists?include_inactive=true'), hosp = useLoad('/hospitals?include_unavailable=true');
  const blank = {full_name: '', email: '', password: '', phone: '', specialty: '', hospital_id: ''};
  const [form, setForm] = useState(blank), [edit, setEdit] = useState(null), [q, setQ] = useState(''), [err, setErr] = useState(''), [msg, setMsg] = useState('');
  const run = async (fn, ok) => { setErr(''); setMsg(''); try { await fn(); setMsg(ok); specs.reload(); return true; } catch (e) { setErr(e.message); return false; } };
  const hospitals = arr(hosp.data), rows = arr(specs.data).filter(u => `${u.full_name} ${u.hospital_name || ''} ${u.specialty || ''}`.toLowerCase().includes(q.trim().toLowerCase()));
  const HospChips = ({value, onChange}) => <Dropdown label="Hospital *" placeholder="Select hospital" options={hospitals.map(h => [h.id, `${h.name} · ${h.mandal}`])} value={value} onChange={onChange} />;
  return <>
    <Muted>Register the doctors of each hospital. They only receive patients that a medical officer refers to them or to their hospital.</Muted><Err text={err || specs.error} /><Ok text={msg} />
    <Card><Title>Register specialist</Title>
      <Field label="Name *" value={form.full_name} onChangeText={v => setForm({...form, full_name: v})} autoCapitalize="words" />
      <Field label="Email *" value={form.email} onChangeText={v => setForm({...form, email: v})} keyboardType="email-address" />
      <Field label="Password (min 8 characters) *" value={form.password} onChangeText={v => setForm({...form, password: v})} secure />
      <Field label="Specialty" value={form.specialty} onChangeText={v => setForm({...form, specialty: v})} autoCapitalize="words" placeholder="Oral surgery / ENT" />
      <Field label="Phone" value={form.phone} onChangeText={v => setForm({...form, phone: v})} keyboardType="phone-pad" />
      <HospChips value={form.hospital_id} onChange={v => setForm({...form, hospital_id: v})} />
      <Btn title="Register specialist" disabled={!form.full_name.trim() || !form.email.trim() || form.password.length < 8 || !form.hospital_id} onPress={async () => { if (await run(() => api('/specialists', {method: 'POST', body: form}), 'Specialist registered')) setForm({...blank, hospital_id: form.hospital_id}); }} /></Card>
    <Field label="Search specialists" value={q} onChangeText={setQ} />
    {!specs.data ? <Spinner /> : rows.map(u => <Card key={u.id}>
      <Title>{u.full_name}</Title><Muted>{u.hospital_name ? `${u.hospital_name}, ${u.hospital_mandal}` : 'No hospital assigned'}{u.specialty ? ` · ${u.specialty}` : ''}{u.phone ? ` · ${u.phone}` : ''}</Muted><Pill text={u.status === 'pending' ? 'Pending' : u.available ? 'Available' : 'Unavailable'} />
      {edit?.id === u.id ? <View><Field label="Name" value={edit.full_name} onChangeText={v => setEdit({...edit, full_name: v})} autoCapitalize="words" /><Field label="Specialty" value={edit.specialty} onChangeText={v => setEdit({...edit, specialty: v})} /><Field label="Phone" value={edit.phone} onChangeText={v => setEdit({...edit, phone: v})} /><Field label="New password (blank = keep)" value={edit.password} onChangeText={v => setEdit({...edit, password: v})} secure /><HospChips value={edit.hospital_id} onChange={v => setEdit({...edit, hospital_id: v})} />
        <View style={{flexDirection: 'row'}}><Btn small title="Save" onPress={async () => { const {id, ...body} = edit; if (!body.password) delete body.password; if (await run(() => api(`/specialists/${u.id}`, {method: 'PATCH', body}), 'Specialist updated')) setEdit(null); }} /><Btn small secondary title="Cancel" onPress={() => setEdit(null)} /></View></View>
        : <View style={{flexDirection: 'row', flexWrap: 'wrap'}}><Btn small secondary title="Edit" onPress={() => setEdit({id: u.id, full_name: u.full_name, specialty: u.specialty || '', phone: u.phone || '', hospital_id: u.hospital_id || '', password: ''})} /><Btn small secondary title={u.status === 'pending' ? 'Approve' : u.available ? 'Mark unavailable' : 'Mark available'} onPress={() => run(() => api(`/specialists/${u.id}`, {method: 'PATCH', body: {available: u.status === 'pending' ? true : !u.available}}), 'Specialist updated')} /><Btn small danger title="Remove" onPress={() => confirmDo(`Remove ${u.full_name}?`, 'This cannot be undone.', () => run(() => api(`/specialists/${u.id}`, {method: 'DELETE'}), 'Specialist removed'))} /></View>}
    </Card>)}
    {specs.data && !rows.length && <Empty text="No specialists yet." />}
  </>;
}

// ---------------- Users & admins (super admin) ----------------
export function SuperUsers({user}) {
  const {data, error, reload} = useLoad('/admin/users');
  const blank = {full_name: '', email: '', password: '', role: 'admin', assigned_facility: '', district: '', mandal: ''};
  const [form, setForm] = useState(blank), [edit, setEdit] = useState(null), [q, setQ] = useState(''), [role, setRole] = useState(''), [err, setErr] = useState(''), [msg, setMsg] = useState('');
  const STAFF = ['health_worker', 'navigator', 'medical_officer', 'specialist'];
  const run = async (fn, ok) => { setErr(''); setMsg(''); try { await fn(); if (ok) setMsg(ok); reload(); return true; } catch (e) { setErr(e.message); return false; } };
  const rows = (data || []).filter(u => (!role || u.role === role) && `${u.full_name} ${u.email}`.toLowerCase().includes(q.trim().toLowerCase()));
  const remove = u => confirmDo(`Permanently delete ${u.full_name}?`, `${u.email}\n\nSuspend keeps their history; delete removes the account.`, async () => {
    try { await api(`/super/users/${u.id}`, {method: 'DELETE'}); setMsg(`${u.full_name} deleted`); reload(); }
    catch (e) { if (e.status === 409) confirmDo('Has linked records', `${e.message}\n\nDelete the account together with its dependent records?`, () => run(() => api(`/super/users/${u.id}?cascade=true`, {method: 'DELETE'}), `${u.full_name} deleted`)); else setErr(e.message); }
  });
  const roles = Object.entries(ROLE_NAME);
  return <>
    <Muted>Add district admins or any other account directly (no approval needed), edit details, reset passwords, suspend or delete.</Muted><Err text={err || error} /><Ok text={msg} />
    <Card><Title>Add account</Title>
      <Field label="Full name" value={form.full_name} onChangeText={v => setForm({...form, full_name: v})} autoCapitalize="words" />
      <Field label="Email" value={form.email} onChangeText={v => setForm({...form, email: v})} keyboardType="email-address" />
      <Field label="Password (min 8 characters)" value={form.password} onChangeText={v => setForm({...form, password: v})} secure />
      <Chips label="Role" options={[['admin', 'District admin'], ['super_admin', 'Super admin'], ...STAFF.map(r => [r, ROLE_NAME[r]])]} value={form.role} onChange={v => setForm({...form, role: v})} />
      {STAFF.includes(form.role) && <Field label="Facility (optional)" value={form.assigned_facility} onChangeText={v => setForm({...form, assigned_facility: v})} autoCapitalize="words" />}
      {form.role !== 'super_admin' && <GeoPicker district={form.district} mandal={form.mandal} onChange={g => setForm({...form, ...g})} required={STAFF.includes(form.role)} />}
      <Btn title="Add account" disabled={form.full_name.trim().length < 2 || !form.email.trim() || form.password.length < 8} onPress={async () => { if (await run(() => api('/super/users', {method: 'POST', body: form}), 'Account added. They can sign in right away.')) setForm(blank); }} /></Card>
    <Chips options={[['', 'All'], ...roles]} value={role} onChange={setRole} />
    <Field label="Search" value={q} onChangeText={setQ} placeholder="Name or email" />
    {!data ? <Spinner /> : rows.map(u => <Card key={u.id}>
      <Title>{u.full_name}</Title><Muted>{u.email}{u.district ? ` · ${u.mandal || '—'}, ${u.district}` : ''}</Muted><Pill text={ROLE_NAME[u.role] || u.role} /><Pill text={u.status} />
      <View style={{flexDirection: 'row', flexWrap: 'wrap'}}>
        <Btn small secondary title={edit?.id === u.id ? 'Close' : 'Edit'} onPress={() => setEdit(edit?.id === u.id ? null : {id: u.id, full_name: u.full_name, email: u.email, role: u.role, status: u.status, assigned_facility: u.assigned_facility || '', district: u.district || '', mandal: u.mandal || '', password: ''})} />
        {u.id !== user.id && u.status === 'active' && <Btn small secondary title="Suspend" onPress={() => confirmDo(`Suspend ${u.full_name}?`, 'Their data stays saved.', () => run(() => api(`/admin/users/${u.id}/suspend`, {method: 'POST', body: {reason: ''}}), 'Suspended'))} />}
        {u.id !== user.id && u.status === 'suspended' && <Btn small title="Reactivate" onPress={() => run(() => api(`/admin/users/${u.id}/reactivate`, {method: 'POST', body: {reason: ''}}), 'Reactivated')} />}
        {u.id !== user.id && <Btn small danger title="Delete" onPress={() => remove(u)} />}
      </View>
      {edit?.id === u.id && <View>
        <Field label="Full name" value={edit.full_name} onChangeText={v => setEdit({...edit, full_name: v})} autoCapitalize="words" />
        <Field label="Email" value={edit.email} onChangeText={v => setEdit({...edit, email: v})} keyboardType="email-address" />
        <Chips label="Role" options={roles} value={edit.role} onChange={v => setEdit({...edit, role: v})} />
        <Chips label="Status" options={['active', 'pending', 'rejected', 'suspended']} value={edit.status} onChange={v => setEdit({...edit, status: v})} />
        <Field label="Facility" value={edit.assigned_facility} onChangeText={v => setEdit({...edit, assigned_facility: v})} autoCapitalize="words" />
        <GeoPicker district={edit.district} mandal={edit.mandal} onChange={g => setEdit({...edit, ...g})} />
        <Field label="New password (leave blank to keep)" value={edit.password} onChangeText={v => setEdit({...edit, password: v})} secure />
        <Btn title="Save changes" onPress={async () => { const {id, ...body} = edit; if (!body.password) delete body.password; if (await run(() => api(`/super/users/${u.id}`, {method: 'PATCH', body}), 'Saved')) setEdit(null); }} />
      </View>}
    </Card>)}
    {data && !rows.length && <Empty text="No accounts match." />}
  </>;
}

// ---------------- Data manager (super admin) ----------------
const LIMIT = 20;
const short = v => { if (v === null || v === undefined) return '—'; const t = typeof v === 'object' ? JSON.stringify(v) : String(v); return t.length > 60 ? `${t.slice(0, 57)}…` : t; };
export function SuperData() {
  const [tables, setTables] = useState(null), [table, setTable] = useState(''), [data, setData] = useState(null), [q, setQ] = useState(''), [offset, setOffset] = useState(0), [editor, setEditor] = useState(null), [err, setErr] = useState(''), [msg, setMsg] = useState('');
  useEffect(() => { api('/super/data').then(t => { setTables(t); if (t.length) setTable(t[0].table); }).catch(e => { setErr(e.message); setTables([]); }); }, []);
  const load = (t = table, query = q, off = offset) => { if (!t) return; setData(null); api(`/super/data/${t}?limit=${LIMIT}&offset=${off}${query ? `&q=${encodeURIComponent(query)}` : ''}`).then(setData).catch(e => { setErr(e.message); setData({columns: [], rows: [], total: 0}); }); };
  useEffect(() => { setOffset(0); setQ(''); setEditor(null); setErr(''); load(table, '', 0); }, [table]);
  const cols = data?.columns || [], pk = cols.find(c => c.pk)?.name || 'id';
  const openEditor = row => {
    if (row) return setEditor({id: row[pk], text: JSON.stringify(row, null, 2)});
    const tpl = {}; cols.forEach(c => { if (!c.pk && c.name !== 'created_at') tpl[c.name] = c.type === 'boolean' ? false : null; }); if (table === 'users') tpl.password = '';
    setEditor({id: null, text: JSON.stringify(tpl, null, 2)});
  };
  const save = async () => {
    let body; try { body = JSON.parse(editor.text); } catch { return setErr('That is not valid JSON'); }
    setErr(''); setMsg('');
    try { if (editor.id) await api(`/super/data/${table}/${editor.id}`, {method: 'PATCH', body: {data: body}}); else await api(`/super/data/${table}`, {method: 'POST', body: {data: body}}); setMsg(editor.id ? 'Row updated' : 'Row added'); setEditor(null); load(); api('/super/data').then(setTables).catch(() => {}); } catch (e) { setErr(e.message); }
  };
  const remove = row => confirmDo(`Delete this ${table} row?`, String(row[pk]), async () => {
    try { await api(`/super/data/${table}/${row[pk]}`, {method: 'DELETE'}); setMsg('Row deleted'); load(); }
    catch (e) { if (e.status === 409) confirmDo('Cascade delete?', `${e.message}\n\nAlso delete every record that depends on this row (optional links are just cleared).`, async () => { try { await api(`/super/data/${table}/${row[pk]}?cascade=true`, {method: 'DELETE'}); setMsg('Row and dependent records deleted'); load(); } catch (e2) { setErr(e2.message); } }); else setErr(e.message); }
  });
  if (!tables) return <Spinner />;
  const total = data?.total || 0;
  return <>
    <Muted>Super admin only. View, add, edit or delete any record in any table. Every change is written to the audit trail.</Muted><Err text={err} /><Ok text={msg} />
    <Chips options={tables.map(t => [t.table, `${t.table} (${t.rows})`])} value={table} onChange={setTable} />
    <Field label="Search this table" value={q} onChangeText={setQ} /><View style={{flexDirection: 'row'}}><Btn small secondary title="Search" onPress={() => { setOffset(0); load(table, q, 0); }} /><Btn small title="Add row" disabled={!data} onPress={() => openEditor(null)} /></View>
    {!!editor && <Card style={dyn({borderColor: '#0d7669'})}><Title>{editor.id ? `Edit ${table} row` : `New ${table} row`}</Title><Muted>JSON — only include the columns you want to set{table === 'users' ? '; use "password" to set a password' : ''}.</Muted><Field value={editor.text} onChangeText={t => setEditor({...editor, text: t})} multiline /><View style={{flexDirection: 'row'}}><Btn small title={editor.id ? 'Save changes' : 'Add row'} onPress={save} /><Btn small secondary title="Cancel" onPress={() => setEditor(null)} /></View></Card>}
    {!data ? <Spinner /> : data.rows.map(r => <Card key={r[pk]}>{cols.filter(c => !c.pk || true).slice(0, 8).map(c => <Muted key={c.name}><Text style={{fontWeight: '800'}}>{c.name}: </Text>{short(r[c.name])}</Muted>)}<View style={{flexDirection: 'row'}}><Btn small secondary title="Edit" onPress={() => openEditor(r)} /><Btn small danger title="Delete" onPress={() => remove(r)} /></View></Card>)}
    {data && !data.rows.length && <Empty text="No rows." />}
    {!!data && <View style={{flexDirection: 'row', alignItems: 'center'}}><Btn small secondary title="Previous" disabled={offset === 0} onPress={() => { const o = Math.max(0, offset - LIMIT); setOffset(o); load(table, q, o); }} /><Muted>{total ? `${offset + 1}–${Math.min(offset + LIMIT, total)} of ${total}` : '0'}</Muted><View style={{width: 8}} /><Btn small secondary title="Next" disabled={offset + LIMIT >= total} onPress={() => { const o = offset + LIMIT; setOffset(o); load(table, q, o); }} /></View>}
  </>;
}
