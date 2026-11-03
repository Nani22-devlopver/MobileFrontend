import React, {useState} from 'react';
import {View, Alert} from '../rn';
import {api} from '../api/client';
import {Card, Title, Muted, Empty, Err, Ok, Btn, Field, Pill, Section, Spinner, useLoad, human, arr} from '../ui';

const STATES = ['SCHEDULED', 'SAMPLE_COLLECTED', 'REPORT_PENDING', 'REPORT_RECEIVED', 'CLINICIAN_REVIEWED'];

// Specialists and medical officers: order biopsies for a referral and move each investigation through its stages.
export default function Investigations() {
  const refs = useLoad('/referrals'), inv = useLoad('/investigations');
  const [err, setErr] = useState(''), [msg, setMsg] = useState(''), [notes, setNotes] = useState({});
  const run = async (fn, ok) => { setErr(''); setMsg(''); try { await fn(); setMsg(ok); await inv.reload(); } catch (e) { setErr(e.message); } };
  const order = r => run(() => api('/investigations', {method: 'POST', body: {referral_id: r.id, kind: 'biopsy'}}), 'Biopsy investigation ordered');
  const advance = (i, state) => run(() => api(`/investigations/${i.id}`, {method: 'PATCH', body: {state, report_note: state === 'REPORT_RECEIVED' ? (notes[i.id] || 'Report received.') : undefined, clinician_result: state === 'CLINICIAN_REVIEWED' ? (notes[i.id] || 'Reviewed by clinician.') : undefined}}), `Moved to ${human(state)}`);
  if (!inv.data || !refs.data) return <Spinner />;
  return <>
    <Muted>Order and track biopsies and reports.</Muted><Err text={err || inv.error} /><Ok text={msg} />
    <Section>Order a biopsy</Section>
    {arr(refs.data).map(r => <Btn key={r.id} secondary title={`Order biopsy · ${r.patient_name || r.id.slice(0, 8)}`} onPress={() => order(r)} />)}
    {!arr(refs.data).length && <Empty text="No referrals to order for." />}
    <Section>Investigations</Section>
    {arr(inv.data).map(i => <Card key={i.id}>
      <Title>{human(i.kind)}</Title><Pill text={i.state} />
      {!!i.report_note && <Muted>Report: {i.report_note}</Muted>}{!!i.clinician_result && <Muted>Result: {i.clinician_result}</Muted>}
      <Field label="Note for the next stage (report / clinician result)" value={notes[i.id] || ''} onChangeText={v => setNotes({...notes, [i.id]: v})} autoCapitalize="sentences" />
      <View style={{flexDirection: 'row', flexWrap: 'wrap', marginTop: 4}}>{STATES.map(st => <Btn key={st} small secondary={st !== i.state} title={human(st)} onPress={() => advance(i, st)} />)}</View>
    </Card>)}
    {!arr(inv.data).length && <Empty text="No investigations." />}
  </>;
}
