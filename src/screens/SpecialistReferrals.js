import React, {useMemo, useState} from 'react';
import {View} from '../rn';
import {api} from '../api/client';
import {Card, Title, Muted, Empty, Err, Ok, Btn, Field, Pill, Spinner, Tabs, Chips, DateTimeField, useLoad, defaultSlotInput, slotToLocalInput, localToSlot, isPast, validSlot, slotLabel, arr} from '../ui';
import {joinVideo, openMeetNew} from './video';

export const OUTCOMES = [['follow_up', 'Follow-up visit needed'], ['treatment_started', 'Treatment started'], ['biopsy_advised', 'Biopsy / investigation advised'], ['referred_higher', 'Referred to a higher centre'], ['no_issue', 'No issue found']];

// Doctor's "My patients": accept a referred patient (direct hospital visit or video consult), reschedule, record the analysis.
export default function SpecialistReferrals({onChanged}) {
  const {data, error, reload} = useLoad('/referrals');
  const [tab, setTab] = useState('new'), [open, setOpen] = useState('');
  const [slot, setSlot] = useState(defaultSlotInput()), [kind, setKind] = useState('physical'), [meet, setMeet] = useState('');
  const [analysis, setAnalysis] = useState(''), [outcome, setOutcome] = useState('follow_up');
  const [err, setErr] = useState(''), [msg, setMsg] = useState(''), [busy, setBusy] = useState(false), [timing, setTiming] = useState('later');
  const groups = useMemo(() => {
    const g = {new: [], accepted: [], done: []};
    arr(data).forEach(r => (r.status === 'ASSESSED' || r.status === 'CARE_LINKED' ? g.done : r.appointment ? g.accepted : g.new).push(r));
    return g;
  }, [data]);
  const toggle = (r, what) => {
    const key = `${r.id}:${what}`; setErr(''); setMsg('');
    if (open === key) return setOpen('');
    setOpen(key); setSlot(what === 'resched' && r.appointment ? slotToLocalInput(r.appointment.slot) : defaultSlotInput());
    setKind('physical'); setMeet(''); setTiming('later'); setAnalysis(r.specialist_analysis || ''); setOutcome(r.analysis_outcome || 'follow_up');
  };
  const run = async (fn, ok) => { setErr(''); setMsg(''); setBusy(true); try { await fn(); setMsg(ok); setOpen(''); onChanged && onChanged(); await reload(); } catch (e) { setErr(e.message); } finally { setBusy(false); } };
  const startNow = kind === 'video' && timing === 'now';
  const accept = r => {
    if (!startNow && (!validSlot(slot) || isPast(slot))) return setErr('Pick a date and time in the future.');
    if (kind === 'video' && !meet.trim()) return setErr('Paste a Google Meet link for the video consult.');
    run(async () => {
      const created = await api('/appointments', {method: 'POST', body: {referral_id: r.id, kind, slot: localToSlot(slot) || new Date().toISOString(), status: 'CONFIRMED', meet_url: kind === 'video' ? meet.trim() : null, start_now: startNow}});
      if (startNow && created?.id) await joinVideo(created.id);
    }, startNow ? 'Call started. The team was notified to join.' : 'Patient accepted. Navigator and team notified.');
  };
  const resched = r => { if (!validSlot(slot) || isPast(slot)) return setErr('Pick a date and time in the future.'); run(() => api(`/appointments/${r.appointment.id}`, {method: 'PATCH', body: {status: 'RESCHEDULED', slot: localToSlot(slot)}}), 'Rescheduled. Everyone involved was notified.'); };
  const saveAnalysis = r => run(() => api(`/referrals/${r.id}/analysis`, {method: 'POST', body: {analysis, outcome}}), 'Analysis saved.');
  if (!data) return <Spinner />;
  const list = groups[tab];
  return <>
    <Muted>Patients the medical officer referred to you or your hospital. Accept (direct hospital visit or video consult), reschedule, and record your analysis after the visit.</Muted>
    <Tabs tabs={[['new', `New requests (${groups.new.length})`], ['accepted', `Accepted (${groups.accepted.length})`], ['done', `Completed (${groups.done.length})`]]} value={tab} onChange={t => { setTab(t); setOpen(''); setErr(''); }} />
    <Err text={err || error} /><Ok text={msg} />
    {list.map(r => {
      const a = r.appointment;
      return <Card key={r.id}>
        <Title>{r.patient_name || r.id.slice(0, 8)}</Title>
        <Muted>{[r.patient_age && `${r.patient_age} yrs`, r.patient_sex, r.village].filter(Boolean).join(' · ')} · {r.hospital_name || r.facility}</Muted>
        <Pill text={r.priority} />
        {!!r.reason && <Muted>Medical officer's finding: {r.reason}</Muted>}
        {a && <Muted>{a.kind === 'video' ? 'Video consult' : 'Direct hospital visit'} · {slotLabel(a.slot)} · {String(a.status).replace(/_/g, ' ')}{a.approval_status === 'PENDING' ? " · waiting for the medical officer's approval" : ''}</Muted>}
        {a && a.kind === 'video' && a.has_meet_link && a.status !== 'CANCELLED' && <Btn small title="Join call" onPress={() => joinVideo(a.id)} />}
        {!!r.specialist_analysis && <Muted>Your analysis ({(OUTCOMES.find(o => o[0] === r.analysis_outcome) || [])[1] || 'recorded'}): {r.specialist_analysis}</Muted>}
        <View style={{flexDirection: 'row', flexWrap: 'wrap'}}>
          {tab === 'new' && <Btn small title="Accept patient" onPress={() => toggle(r, 'accept')} />}
          {tab === 'accepted' && a && a.approval_status !== 'PENDING' && <Btn small secondary title="Reschedule" onPress={() => toggle(r, 'resched')} />}
          {tab === 'accepted' && a && <Btn small title="Update analysis" onPress={() => toggle(r, 'analysis')} />}
          {tab === 'done' && <Btn small secondary title="Edit analysis" onPress={() => toggle(r, 'analysis')} />}
        </View>
        {open === `${r.id}:accept` && <View style={{marginTop: 8}}>
          <Chips label="Accept as" options={[['physical', `Direct visit${r.hospital_name ? ' at ' + r.hospital_name : ''}`], ...(r.video_allowed ? [['video', 'Video consult']] : [])]} value={kind} onChange={setKind} />
          {!r.video_allowed && <Muted>Video consultation is not enabled for this patient (the health worker grants it at registration).</Muted>}
          {kind === 'video' && <Chips options={[['later', 'Schedule for later'], ['now', 'Start now']]} value={timing} onChange={setTiming} />}
          {!startNow && <DateTimeField value={slot} onChange={setSlot} label="Date and time" />}
          {kind === 'video' && <>
            <Field label="Google Meet link" value={meet} onChangeText={setMeet} placeholder="https://meet.google.com/abc-defg-hij" keyboardType="url" />
            <Btn small secondary title="Create a Meet link" onPress={openMeetNew} />
          </>}
          <View style={{flexDirection: 'row'}}><Btn disabled={busy} title={startNow ? 'Start call now' : 'Confirm'} onPress={() => accept(r)} /><Btn secondary title="Cancel" onPress={() => setOpen('')} /></View>
        </View>}
        {open === `${r.id}:resched` && <View style={{marginTop: 8}}>
          <DateTimeField value={slot} onChange={setSlot} label="Reschedule to" />
          <View style={{flexDirection: 'row'}}><Btn disabled={busy} title="Reschedule" onPress={() => resched(r)} /><Btn secondary title="Cancel" onPress={() => setOpen('')} /></View>
        </View>}
        {open === `${r.id}:analysis` && <View style={{marginTop: 8}}>
          <Field label="Your analysis after seeing the patient" value={analysis} onChangeText={setAnalysis} placeholder="Findings, diagnosis, plan" multiline autoCapitalize="sentences" />
          <Chips label="Outcome" options={OUTCOMES} value={outcome} onChange={setOutcome} />
          <View style={{flexDirection: 'row'}}><Btn disabled={busy || analysis.trim().length < 5} title="Save analysis" onPress={() => saveAnalysis(r)} /><Btn secondary title="Cancel" onPress={() => setOpen('')} /></View>
        </View>}
      </Card>;
    })}
    {!list.length && <Empty text={tab === 'new' ? 'No new patients waiting.' : 'Nothing here yet.'} />}
  </>;
}
