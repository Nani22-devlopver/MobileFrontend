import React, {useEffect, useState} from 'react';
import {TouchableOpacity} from '../rn';
import {api} from '../api/client';
import {Card, Title, Muted, Empty, Err, Btn, Field, Line, Section, Spinner, Pill, human} from '../ui';

// Read-only patient directory + record (health workers also register / edit in their own workspace).
export default function Patients({onAssign}) {
  const [q, setQ] = useState(''), [rows, setRows] = useState(null), [err, setErr] = useState(''), [sel, setSel] = useState(null), [tl, setTl] = useState([]);
  const load = async () => { setErr(''); try { setRows(await api(`/patients${q ? `?q=${encodeURIComponent(q)}` : ''}`)); } catch (e) { setErr(e.message); setRows([]); } };
  useEffect(() => { load(); }, []);
  const open = async p => { setErr(''); try { setSel(await api(`/patients/${encodeURIComponent(p.id)}`)); api(`/patients/${encodeURIComponent(p.id)}/timeline`).then(t => setTl(Array.isArray(t) ? t : (t?.events || []))).catch(() => setTl([])); } catch (e) { setErr(e.message); } };
  if (sel) return <>
    <Btn secondary title="← Back to patients" onPress={() => { setSel(null); setTl([]); }} />
    {!!onAssign && <Btn title="Assign specialist" onPress={() => onAssign(sel)} />}
    <Card><Title>{sel.full_name}</Title><Muted>{[sel.age && `${sel.age} yrs`, sel.sex, sel.village].filter(Boolean).join(' · ')}</Muted>
      {[['Phone', sel.phone], ['Address', sel.address], ['Habitation', sel.habitation], ['Gram panchayat', sel.gram_panchayat], ['Mandal', sel.mandal], ['District', sel.district], ['PHC', sel.phc], ['Tobacco use', sel.tobacco_use], ['Symptoms', sel.symptoms], ['Medical history', sel.medical_history], ['Video consultation', sel.video_allowed ? 'Allowed' : 'Not enabled']].map(([k, v]) => <Line key={k} label={k} value={v} />)}
    </Card>
    <Section>Timeline</Section>
    {tl.map((e, i) => <Card key={e.id || i}><Title>{human(e.type || e.event || e.kind || 'Event')}</Title><Muted>{e.summary || e.detail || e.status || ''}{e.at || e.created_at ? ` · ${new Date(e.at || e.created_at).toLocaleString()}` : ''}</Muted></Card>)}
    {!tl.length && <Empty text="No timeline events." />}
  </>;
  return <>
    <Field label="Search patients" value={q} onChangeText={setQ} placeholder="Name, village or phone" />
    <Btn title="Search" onPress={load} />
    <Err text={err} />
    {!rows ? <Spinner /> : rows.map(p => <TouchableOpacity key={p.id} onPress={() => open(p)}><Card><Title>{p.full_name}</Title><Muted>{p.village || ''}{p.phone ? ` · ${p.phone}` : ''}</Muted>{!!p.duplicate_hint && <Pill text={p.duplicate_hint} />}</Card></TouchableOpacity>)}
    {rows && !rows.length && <Empty text="No patients found." />}
  </>;
}
