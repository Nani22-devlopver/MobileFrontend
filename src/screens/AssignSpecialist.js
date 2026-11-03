import React, {useCallback, useEffect, useState} from 'react';
import {TouchableOpacity, View, Text} from '../rn';
import {api} from '../api/client';
import Dropdown from '../components/Dropdown';
import {Card, Title, Muted, Empty, Err, Ok, Btn, Field, Pill, Spinner, Chips, Section, Line, HospitalPicker, human, s} from '../ui';

// Medical officer: opened by tapping a patient. Assign a hospital + specialist.
//  - Same mandal as the patient: the specialist of the patient's own mandal is assigned at once.
//  - Another mandal or district: a request is sent to the medical officers of that district, who accept or decline it.
export default function AssignSpecialist({patient, onBack, onDone}) {
  const [data, setData] = useState(null), [err, setErr] = useState(''), [msg, setMsg] = useState(''), [busy, setBusy] = useState(false);
  const [reviewId, setReviewId] = useState(''), [mode, setMode] = useState('local');
  const [hospitalId, setHospitalId] = useState(''), [specialistId, setSpecialistId] = useState('');
  const [geo, setGeo] = useState({district: '', mandal: ''}), [other, setOther] = useState({hospitalId: '', specialistId: ''});
  const [priority, setPriority] = useState('urgent'), [specialty, setSpecialty] = useState('Oral surgery / ENT'), [reason, setReason] = useState(''), [crossReason, setCrossReason] = useState('');

  const load = useCallback(async () => {
    setErr('');
    try {
      const d = await api(`/patients/${encodeURIComponent(patient.id)}/assignment-options`);
      setData(d);
      const open = d.reviews.find(r => !r.referral_id);
      setReviewId(open ? open.id : '');
    } catch (e) { setErr(e.message); setData({patient, reviews: [], hospitals: []}); }
  }, [patient.id]);
  useEffect(() => { load(); }, [load]);

  const p = data?.patient || patient;
  const cross = mode === 'other';
  const hid = cross ? other.hospitalId : hospitalId;
  const sid = cross ? other.specialistId : specialistId;
  const submit = async () => {
    setErr(''); setMsg('');
    if (!reviewId) return setErr('This patient has no signed review waiting for a specialist. Sign a review with outcome "Refer" first.');
    if (!hid) return setErr('Choose the hospital.');
    if (cross && crossReason.trim().length < 5) return setErr('Write the reason for going outside the patient\'s mandal / district.');
    setBusy(true);
    try {
      const r = await api('/referrals', {method: 'POST', body: {review_id: reviewId, hospital_id: hid, specialist_id: sid || null, specialty: specialty.trim() || 'Oral surgery / ENT', priority, reason: reason.trim() || null, cross_reason: cross ? crossReason.trim() : null}});
      setMsg(r.approval_status === 'PENDING' ? 'Request sent to the medical officers of that district. The specialist is told only after they accept.' : 'Specialist assigned. The specialist and navigator were notified.');
      onDone && onDone(r);
      await load();
    } catch (e) { setErr(e.message); } finally { setBusy(false); }
  };

  if (!data) return <Spinner />;
  const open = data.reviews.filter(r => !r.referral_id);
  return <>
    <Btn secondary title="← Back to patient" onPress={onBack} />
    <Card><Title>{p.full_name}</Title><Muted>{[p.age && `${p.age} yrs`, p.sex, p.village].filter(Boolean).join(' · ')}</Muted>
      <Line label="Patient's area" value={[p.mandal, p.district].filter(Boolean).join(', ')} /><Line label="Symptoms" value={p.symptoms} />
      <Pill text={p.video_allowed ? 'Video consultation allowed' : 'No video consultation'} /></Card>
    <Err text={err} /><Ok text={msg} />

    <Section>Referral from signed review</Section>
    {data.reviews.map(r => <Card key={r.id}><Muted>{r.signed_at ? new Date(r.signed_at).toLocaleDateString() : ''} · {r.finding}</Muted>
      {r.referral_id ? <Pill text={`Assigned · ${r.referral_status}`} /> : <Pill text="Waiting for a specialist" />}</Card>)}
    {!data.reviews.length && <Empty text="No signed review with outcome Refer for this patient yet." />}

    {!!open.length && <>
      <Section>Where should the patient go?</Section>
      <Chips options={[['local', `Patient's mandal (${p.mandal || '—'})`], ['other', 'Another mandal / district']]} value={mode} onChange={m => { setMode(m); setErr(''); }} />

      {!cross && <>
        <Muted>Hospitals and available specialists in {p.mandal}, {p.district}. Leave the specialist on "Any available" and any specialist of that hospital can accept.</Muted>
        {!!data.hospitals.length && <Dropdown label="Hospital" placeholder="Select hospital" options={data.hospitals.map(h => [h.id, `${h.name}${h.address ? ` · ${h.address}` : ''}`])} value={hospitalId} onChange={v => { setHospitalId(v); setSpecialistId(''); }} />}
        {data.hospitals.filter(h => h.id === hospitalId).map(h => <View key={h.id}>
          {!!h.contact_phone && <Muted>{h.contact_phone}</Muted>}
          <Dropdown label={`Specialist at ${h.name}`} options={[['', 'Any available'], ...h.specialists.map(sp => [sp.id, `${sp.full_name}${sp.specialty ? ` · ${sp.specialty}` : ''} · ${sp.open_cases} open`])]} value={specialistId || ''} onChange={setSpecialistId} />
          {!h.specialists.length && <Muted>No active specialist is registered at this hospital yet.</Muted>}
        </View>)}
        {!data.hospitals.length && <Empty text="No hospital is listed in the patient's mandal. Use 'Another mandal / district'." />}
      </>}

      {cross && <>
        <Muted>Pick the district and mandal of the hospital. The request goes to the medical officers of that district; the patient is assigned only after they accept.</Muted>
        <HospitalPicker district={geo.district} mandal={geo.mandal} hospitalId={other.hospitalId} specialistId={other.specialistId} onGeo={setGeo} onChange={h => setOther({hospitalId: h.hospitalId, specialistId: h.specialistId})} />
        <Field label="Reason for the cross-mandal / cross-district request *" value={crossReason} onChangeText={setCrossReason} multiline autoCapitalize="sentences" placeholder="e.g. No oral surgeon in the patient's mandal" />
      </>}

      <Field label="Specialty" value={specialty} onChangeText={setSpecialty} autoCapitalize="words" />
      <Chips label="Priority" options={['routine', 'urgent', 'emergency']} value={priority} onChange={setPriority} />
      <Field label="Note for the specialist" value={reason} onChangeText={setReason} multiline autoCapitalize="sentences" />
      <Btn disabled={busy || !hid} title={cross ? 'Send request to that district\'s medical officers' : 'Assign specialist'} onPress={submit} />
    </>}
  </>;
}
