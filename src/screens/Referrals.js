import React from 'react';
import {Card, Title, Muted, Empty, Err, Pill, Spinner, useLoad, slotLabel, arr} from '../ui';

// Medical officers and navigators: referred patients with their hospital, specialist and booking status (read-only).
// The medical officer assigns the specialist from the patient's page (Patients -> Assign specialist);
// the specialist then accepts, reschedules, or holds a video consultation if the health worker enabled it.
export default function Referrals() {
  const {data, error} = useLoad('/referrals');
  if (!data) return <Spinner />;
  return <>
    <Muted>Referred patients and who will see them. Hospital visits and video consultations are accepted or rescheduled by the specialist.</Muted>
    <Err text={error} />
    {arr(data).map(r => <Card key={r.id}>
      <Title>{r.patient_name || r.id.slice(0, 8)}</Title>
      <Muted>{[r.village, r.hospital_name || r.facility, r.hospital_mandal].filter(Boolean).join(' · ')}</Muted>
      <Muted>Specialist: {r.specialist_name || 'any available at the hospital'}</Muted>
      <Pill text={r.priority} /><Pill text={r.status} />
      {r.cross_mandal && <Muted>Cross-mandal / district · {String(r.approval_status || '').toLowerCase()}{r.cross_reason ? ` · ${r.cross_reason}` : ''}{r.approval_note ? ` · Officer: ${r.approval_note}` : ''}</Muted>}
      {!!r.reason && <Muted>Medical officer's note: {r.reason}</Muted>}
      {!!r.appointment && <Muted>{r.appointment.kind === 'video' ? 'Video consult' : 'Hospital visit'} · {slotLabel(r.appointment.slot)} · {String(r.appointment.status).replace(/_/g, ' ')}</Muted>}
    </Card>)}
    {!arr(data).length && <Empty text="No referrals yet." />}
  </>;
}
