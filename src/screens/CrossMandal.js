import React, {useState} from 'react';
import {View} from '../rn';
import {api} from '../api/client';
import {Card, Title, Muted, Empty, Err, Ok, Btn, Field, Pill, Spinner, Tabs, useLoad, slotLabel} from '../ui';

// Medical officer (and super admin): accept or decline bookings outside the patient's own mandal.
export default function CrossMandal({onChanged}) {
  const [tab, setTab] = useState('PENDING');
  const {data, error, reload} = useLoad(`/cross-mandal-requests?status=${tab === 'PENDING' ? 'PENDING' : 'all'}`);
  const [notes, setNotes] = useState({}), [err, setErr] = useState(''), [msg, setMsg] = useState('');
  const decide = async (a, decision) => {
    setErr(''); setMsg('');
    try { await api(a.kind === 'referral' ? `/referrals/${a.id}/cross-mandal/decision` : `/appointments/${a.id}/cross-mandal/decision`, {method: 'POST', body: {decision, note: notes[a.id] || null}}); setMsg(decision === 'approve' ? 'Accepted. The booking team was told.' : 'Declined. The booking team was told.'); onChanged && onChanged(); reload(); } catch (e) { setErr(e.message); }
  };
  const list = tab === 'PENDING' ? data : (data || []).filter(r => r.approval_status !== 'PENDING');
  return <>
    <Muted>Medical officers of other mandals / districts ask to place their patient with a specialist in your district. Accept or decline; the requesting officer is told.</Muted>
    <Tabs tabs={[['PENDING', 'Waiting for you'], ['HISTORY', 'Decided']]} value={tab} onChange={t => { setTab(t); }} />
    <Err text={err || error} /><Ok text={msg} />
    {!list ? <Spinner /> : list.map(a => <Card key={a.id}>
      <Title>{a.hospital_name} · {a.hospital_mandal}, {a.hospital_district}</Title><Pill text={a.approval_status} />{!!a.specialist_name && <Muted>Specialist: {a.specialist_name}</Muted>}
      <Muted>Patient's area: {a.patient_village ? `${a.patient_village}, ` : ''}{a.patient_mandal}, {a.patient_district || '—'} · {a.slot ? slotLabel(a.slot) : ''}{a.priority ? ` · ${a.priority}` : ''}{a.specialty ? ` · ${a.specialty}` : ''}</Muted>
      <Muted>Special reason: {a.cross_reason}</Muted>
      {!!a.approval_note && <Muted>Decision note: {a.approval_note}</Muted>}
      {a.approval_status === 'PENDING' && <View>
        <Field label="Note for the requesting officer (required to decline)" value={notes[a.id] || ''} onChangeText={v => setNotes({...notes, [a.id]: v})} autoCapitalize="sentences" />
        <View style={{flexDirection: 'row'}}><Btn small title="Accept" onPress={() => decide(a, 'approve')} /><Btn small danger title="Decline" disabled={!(notes[a.id] || '').trim()} onPress={() => decide(a, 'reject')} /></View>
      </View>}
    </Card>)}
    {list && !list.length && <Empty text={tab === 'PENDING' ? 'No requests waiting.' : 'No decided requests yet.'} />}
  </>;
}
