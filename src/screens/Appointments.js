import React, {useState} from 'react';
import {View, Alert} from '../rn';
import {api} from '../api/client';
import {Card, Title, Muted, Empty, Err, Ok, Btn, Field, Pill, Spinner, DateTimeField, useLoad, slotLabel, slotToLocalInput, localToSlot, isPast, validSlot, human, s} from '../ui';
import {joinVideo} from './video';

// Appointments list. Navigators, specialists and medical officers can manage them; health workers can view and join.
export default function Appointments({user, onChanged}) {
  const {data, error, reload} = useLoad('/appointments');
  const [msg, setMsg] = useState(''), [err, setErr] = useState(''), [links, setLinks] = useState({}), [resched, setResched] = useState({});
  const canManage = ['navigator', 'specialist', 'medical_officer'].includes(user.role);
  const canJoin = ['specialist', 'health_worker'].includes(user.role); // video belongs to the specialist (health worker sits with the patient)
  const run = async (fn, ok) => { setErr(''); setMsg(''); try { await fn(); setMsg(ok); onChanged && onChanged(); await reload(); } catch (e) { setErr(e.message); } };
  const patch = (a, status, extra = {}) => run(() => api(`/appointments/${a.id}`, {method: 'PATCH', body: {status, ...extra}}), `Marked ${human(status).toLowerCase()}. Others were notified.`);
  const confirmDo = (title, text, fn) => Alert.alert(title, text, [{text: 'Cancel', style: 'cancel'}, {text: 'Yes', style: 'destructive', onPress: fn}]);
  if (!data) return <Spinner />;
  const rows = [...data].sort((a, b) => String(a.slot).localeCompare(String(b.slot)));
  return <>
    <Muted>Hospital visits and the specialist's video consultations. Everyone involved is notified of changes.</Muted>
    <Err text={err || error} /><Ok text={msg} />
    {rows.map(a => {
      const pending = a.approval_status === 'PENDING';
      const rv = resched[a.id] ?? slotToLocalInput(a.slot);
      return <Card key={a.id}>
        <Title>{a.kind === 'video' ? 'Video consultation (Google Meet)' : 'Hospital visit'}</Title>
        <Muted>{slotLabel(a.slot)}{a.hospital_name ? ` · ${a.hospital_name}${a.hospital_mandal ? ', ' + a.hospital_mandal : ''}` : ''}{a.specialist_name ? ` · ${a.specialist_name}` : ''}</Muted>
        <Pill text={a.status} />
        {!!a.patient_name && <Muted>Patient: {a.patient_name}{a.patient_phone ? ` · ${a.patient_phone}` : ''}{a.patient_address ? ` · ${a.patient_address}` : ''}{'\n'}Specialist: {a.nav_specialist_name || 'any available'}{a.nav_specialist_phone ? ` · ${a.nav_specialist_phone}` : ''}{a.nav_hospital_address ? `\n${a.nav_hospital_name}: ${a.nav_hospital_address}` : ''}</Muted>}
        {a.cross_mandal && <Muted>Cross-mandal visit · {pending ? 'waiting for the medical officer' : String(a.approval_status || '').toLowerCase()}{a.cross_reason ? ` · ${a.cross_reason}` : ''}{a.approval_note ? ` · Officer: ${a.approval_note}` : ''}</Muted>}
        {a.kind === 'video' && a.has_meet_link && a.status !== 'CANCELLED' && canJoin && <Btn title="Join call" onPress={() => joinVideo(a.id)} />}
        {canManage && pending && <Btn small secondary title="Withdraw request" onPress={() => patch(a, 'CANCELLED')} />}
        {user.role === 'specialist' && a.kind === 'video' && !a.has_meet_link && <View>
          <Field label="Google Meet link" value={links[a.id] || ''} onChangeText={v => setLinks({...links, [a.id]: v})} placeholder="https://meet.google.com/abc-defg-hij" keyboardType="url" />
          <Btn small title="Save link" disabled={!links[a.id]} onPress={() => run(() => api(`/appointments/${a.id}`, {method: 'PATCH', body: {status: a.status, meet_url: links[a.id]}}), 'Google Meet link saved')} />
        </View>}
        {canManage && !pending && !(a.kind === 'video' && user.role !== 'specialist') && <>
          <View style={s.row}>
            {['CONFIRMED', 'COMPLETED', 'MISSED', 'CANCELLED'].map(st => <Btn key={st} small secondary title={human(st)} onPress={() => patch(a, st)} />)}
            {a.kind === 'video' && a.has_meet_link && a.status !== 'CANCELLED' && <Btn small secondary title="End call" onPress={() => confirmDo('End this Google Meet?', "The link is removed and everyone's alerts about it are withdrawn.", () => run(async () => { const r = await api(`/appointments/${a.id}/end`, {method: 'POST'}); setMsg(`Call ended. ${r.alerts_removed} alert(s) rolled back.`); }, 'Call ended'))} />}
            <Btn small danger title="Delete" onPress={() => confirmDo('Delete this appointment?', 'Its Meet link and all alerts about it are removed for everyone.', () => run(() => api(`/appointments/${a.id}`, {method: 'DELETE'}), 'Appointment deleted'))} />
          </View>
          <DateTimeField label="Reschedule to" value={rv} onChange={v => setResched({...resched, [a.id]: v})} />
          <Btn small title="Reschedule" disabled={!validSlot(rv) || isPast(rv)} onPress={() => patch(a, 'RESCHEDULED', {slot: localToSlot(rv)})} />
        </>}
      </Card>;
    })}
    {!rows.length && <Empty text="No appointments found." />}
  </>;
}
