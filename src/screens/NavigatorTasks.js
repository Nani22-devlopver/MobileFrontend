import React, {useState} from 'react';
import {View, Linking} from '../rn';
import {api} from '../api/client';
import {Card, Title, Muted, Empty, Err, Ok, Btn, Field, Pill, Spinner, useLoad, slotLabel, arr} from '../ui';

// Patient navigator: see the patient, specialist and hospital for each referral and guide the patient to care.
export default function NavigatorTasks({user}) {
  const {data, error, reload} = useLoad('/navigation');
  const [note, setNote] = useState(''), [err, setErr] = useState(''), [msg, setMsg] = useState('');
  const canWrite = user.role === 'navigator';
  const update = async (t, status) => {
    setErr(''); setMsg('');
    try { await api(`/navigation/${t.id}`, {method: 'PATCH', body: {status, contact_log: note.trim() || (status === 'CLOSED' ? 'Care coordination completed' : 'Follow-up reviewed')}}); setMsg('Task updated.'); setNote(''); reload(); } catch (e) { setErr(e.message); }
  };
  const call = n => n && Linking.openURL(`tel:${n}`).catch(() => {});
  if (!data) return <Spinner />;
  return <>
    <Muted>Guide each patient to the hospital and specialist chosen for them, until they reach care. Navigators see coordination details, not screening photographs or clinical notes.</Muted>
    <Err text={err || error} /><Ok text={msg} />
    {canWrite && <Field label="Contact log note" value={note} onChangeText={setNote} placeholder="e.g. Contacted family; transport arranged" multiline autoCapitalize="sentences" />}
    {arr(data).map(t => <Card key={t.id}>
      <Title>{t.patient_name || t.id.slice(0, 8)}</Title>
      <Muted>{[t.patient_age && `${t.patient_age} yrs`, t.patient_sex].filter(Boolean).join(' · ')} · due {t.due}</Muted>
      <Pill text={t.status} />
      <Muted>Patient: {t.patient_phone || 'No phone on record'}{'\n'}{t.patient_address || t.village || 'No address on record'}</Muted>
      {!!t.patient_phone && <Btn small secondary title={`Call patient ${t.patient_phone}`} onPress={() => call(t.patient_phone)} />}
      <Muted>Specialist: {t.nav_specialist_name ? `${t.nav_specialist_name}${t.nav_specialist_specialty ? ` (${t.nav_specialist_specialty})` : ''}${t.nav_specialist_phone ? ` · ${t.nav_specialist_phone}` : ''}` : 'Any available specialist at the hospital'}{'\n'}Hospital: {t.nav_hospital_name || t.facility}{t.nav_hospital_place ? `, ${t.nav_hospital_place}` : ''}{'\n'}{[t.nav_hospital_address, t.nav_hospital_phone].filter(Boolean).join(' · ')}</Muted>
      <Muted>{t.appointment_slot ? `Appointment (${t.appointment_kind}): ${slotLabel(t.appointment_slot)} · ${t.appointment_status}` : 'No appointment booked yet'}{t.priority ? ` · priority ${t.priority}` : ''}</Muted>
      {!!t.contact_log && <Muted>{t.contact_log}</Muted>}
      {canWrite && <View style={{flexDirection: 'row', flexWrap: 'wrap'}}>
        <Btn small title="Accept" onPress={() => update(t, 'IN_PROGRESS')} /><Btn small secondary title="Escalate" onPress={() => update(t, 'OVERDUE')} /><Btn small secondary title="Close after linkage" onPress={() => update(t, 'CLOSED')} />
      </View>}
    </Card>)}
    {!arr(data).length && <Empty text="No tasks." />}
  </>;
}
