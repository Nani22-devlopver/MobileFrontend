import React from 'react';
import {TouchableOpacity} from '../rn';
import {api} from '../api/client';
import {Card, Title, Muted, Empty, Err, Btn, Spinner, useLoad, stripTags, tagId, human} from '../ui';
import {joinVideo} from './video';

export default function Notifications({user, onNavigate, onChanged}) {
  const {data, error, reload} = useLoad('/notifications');
  const canJoin = ['specialist', 'health_worker'].includes(user.role);
  const mark = async n => {
    if ((n.kind === 'meet' || n.action_pending) && n.read) return;
    try { await api(`/notifications/${n.id}`, {method: 'PATCH'}); onChanged && onChanged(); reload(); } catch (e) {}
  };
  if (!data) return <Spinner />;
  return <>
    <Muted>Alerts clear once you act on them. Video-call links stay until the scheduled day is over. Reminders omit clinical details.</Muted>
    <Err text={error} />
    {data.map(n => {
      const appt = tagId(n.body, 'appt'), x = tagId(n.body, 'xmandal') || tagId(n.body, 'xref');
      return <TouchableOpacity key={n.id} activeOpacity={.8} onPress={() => mark(n)}>
        <Card style={!n.read && {borderColor: '#0d7669', backgroundColor: '#f1faf8'}}>
          <Title>{n.title}</Title><Muted>{stripTags(n.body)}</Muted>
          <Muted>{n.created_at ? new Date(n.created_at).toLocaleString() : ''} · {n.read ? 'Read' : 'Unread'}</Muted>
          {n.kind === 'meet' && n.expires_at && <Muted>Shown until the end of {new Date(n.expires_at).toLocaleDateString()}</Muted>}
          {!!appt && n.kind === 'meet' && canJoin && <Btn small title="Join video call" onPress={() => joinVideo(appt)} />}
          {!!appt && n.kind !== 'meet' && onNavigate && <Btn small secondary title="View appointment" onPress={() => onNavigate('Appointments')} />}
          {!!x && onNavigate && <Btn small secondary title="Review request" onPress={() => onNavigate('Cross-mandal')} />}
          {n.kind !== 'meet' && !n.action_pending && !n.read && <Btn small secondary title="Done" onPress={() => mark(n)} />}
        </Card>
      </TouchableOpacity>;
    })}
    {!data.length && <Empty text="You're all caught up." />}
  </>;
}
