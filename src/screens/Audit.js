import React, {useState, useMemo} from 'react';
import {Card, Title, Muted, Empty, Err, Spinner, Chips, Field, useLoad, human} from '../ui';

const CATS = [['all', 'All'], ['auth', 'Sign-in & registration'], ['access', 'Record access'], ['clinical', 'Clinical actions'], ['admin', 'Admin']];
const catOf = (ev = '') => /^(login|user\.register)/.test(ev) ? 'auth' : /^admin\.|^demo\.|^dashboard/.test(ev) ? 'admin' : /(view|read|download|open|list)/.test(ev) ? 'access' : 'clinical';

export default function Audit() {
  const {data, error} = useLoad('/audit');
  const [cat, setCat] = useState('all'), [q, setQ] = useState('');
  const rows = useMemo(() => (data || []).filter(a => (cat === 'all' || catOf(a.event) === cat) && `${a.event} ${a.actor_name || ''} ${a.resource || ''}`.toLowerCase().includes(q.trim().toLowerCase())), [data, cat, q]);
  if (!data) return <Spinner />;
  const today = new Date().toDateString();
  return <>
    <Muted>Every access and change is recorded. Latest 500 events.</Muted>
    <Card><Title>{data.length} events · {data.filter(a => new Date(a.created_at).toDateString() === today).length} today · {new Set(data.map(a => a.actor_id).filter(Boolean)).size} active users</Title></Card>
    <Chips options={CATS} value={cat} onChange={setCat} />
    <Field label="Search" value={q} onChangeText={setQ} placeholder="Search events or people" />
    <Err text={error} />
    {rows.slice(0, 200).map(a => <Card key={a.id}>
      <Title>{a.event}</Title><Muted>{a.actor_name ? `${a.actor_name} (${human(a.actor_role)})` : 'system'} · {new Date(a.created_at).toLocaleString()}</Muted>{!!a.resource && <Muted>{a.resource}</Muted>}
    </Card>)}
    {!rows.length && <Empty text="No events match." />}
  </>;
}
