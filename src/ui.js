import {dyn} from './theme';
import React, {useEffect, useState} from 'react';
import {View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator} from './rn';
import {api} from './api/client';
import Dropdown from './components/Dropdown';

// ---------- helpers shared by every role workspace ----------
export const arr = v => (Array.isArray(v) ? v : (v?.items || v?.data || []));
export const human = v => String(v ?? '—').replaceAll('_', ' ').replace(/\b\w/g, c => c.toUpperCase());
export const stripTags = t => String(t || '').replace(/\s*\[(appt|xmandal|xref):[0-9a-f-]{36}\]/g, '');
export const tagId = (t, name) => (String(t || '').match(new RegExp(`\\[${name}:([0-9a-f-]{36})\\]`)) || [])[1];
const p2 = n => String(n).padStart(2, '0');
export const slotLabel = slot => { const d = new Date(slot); return Number.isNaN(d.getTime()) ? String(slot || 'To be confirmed') : d.toLocaleString([], {weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'}); };
export const slotToLocalInput = slot => { const d = new Date(slot); return Number.isNaN(d.getTime()) ? '' : `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}T${p2(d.getHours())}:${p2(d.getMinutes())}`; };
export const localToSlot = value => {
  const d = new Date(String(value).trim().replace(' ', 'T'));
  if (Number.isNaN(d.getTime())) return null;
  const off = -d.getTimezoneOffset(), sign = off >= 0 ? '+' : '-', o = Math.abs(off);
  return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}T${p2(d.getHours())}:${p2(d.getMinutes())}:00${sign}${p2(Math.floor(o / 60))}:${p2(o % 60)}`;
};
export const defaultSlotInput = () => { const d = new Date(Date.now() + 24 * 3600 * 1000); d.setMinutes(0, 0, 0); return slotToLocalInput(d.toISOString()); };
export const isPast = v => { const d = new Date(String(v).replace(' ', 'T')); return !Number.isNaN(d.getTime()) && d.getTime() < Date.now() - 60000; };
export const validSlot = v => !Number.isNaN(new Date(String(v).replace(' ', 'T')).getTime());

// ---------- UI primitives ----------
export const Btn = ({title, onPress, secondary, danger, disabled, small}) => (
  <TouchableOpacity onPress={onPress} disabled={disabled} style={[s.btn, secondary && s.btnAlt, danger && s.btnDanger, small && s.btnSmall, disabled && {opacity: .45}]}>
    <Text style={[s.btnText, secondary && s.btnAltText, danger && s.btnDangerText]}>{title}</Text>
  </TouchableOpacity>
);
export const Card = ({children, style}) => <View style={[s.card, style]}>{children}</View>;
export const Line = ({label, value}) => <View style={s.line}><Text style={s.label}>{label}</Text><Text style={s.value}>{value || 'Not provided'}</Text></View>;
export const Muted = ({children}) => <Text style={s.muted}>{children}</Text>;
export const Title = ({children}) => <Text style={s.rowTitle}>{children}</Text>;
export const Empty = ({text}) => <Text style={s.empty}>{text}</Text>;
export const Err = ({text}) => (text ? <Text style={s.error}>{text}</Text> : null);
export const Ok = ({text}) => (text ? <Text style={s.okmsg}>{text}</Text> : null);
export const Section = ({children}) => <Text style={s.section}>{children}</Text>;
export const Pill = ({text}) => (text ? <Text style={s.pill}>{human(text)}</Text> : null);
export const Spinner = () => <ActivityIndicator color="#0d7669" style={{margin: 12}} />;
export const Field = ({label, value, onChangeText, placeholder, multiline, secure, keyboardType, autoCapitalize = 'none'}) => {
  const [show, setShow] = useState(false);
  return (
    <View style={{marginBottom: 4}}>
      {!!label && <Text style={s.fieldLabel}>{label}</Text>}
      <View style={secure ? s.pwRow : null}>
        <TextInput style={[s.input, multiline && s.multiline, secure && {flex: 1, borderWidth: 0}]} value={value ?? ''} onChangeText={onChangeText} placeholder={placeholder || label} multiline={multiline}
          secureTextEntry={secure && !show} keyboardType={keyboardType} autoCapitalize={autoCapitalize} autoCorrect={false} />
        {secure && <TouchableOpacity onPress={() => setShow(!show)} style={{paddingHorizontal: 12}}><Text style={dyn({color: '#0d7669', fontWeight: '900'})}>{show ? 'Hide' : 'Show'}</Text></TouchableOpacity>}
      </View>
    </View>
  );
};
// Up to 5 options show as chips; more than that becomes a selectable drop-down so rows never overlap on small screens.
export const Chips = ({options, value, onChange, label}) => {
  const opts = options.map(o => (Array.isArray(o) ? o : [o, human(o)]));
  if (opts.length > 5) return <Dropdown label={label} options={opts} value={value} onChange={onChange} />;
  return (
    <View>
      {!!label && <Text style={s.fieldLabel}>{label}</Text>}
      <View style={s.chips}>
        {opts.map(([k, l]) => <TouchableOpacity key={String(k)} onPress={() => onChange(k)} style={[s.chip, value === k && s.chipOn]}><Text style={value === k ? s.chipOnText : s.chipText}>{l}</Text></TouchableOpacity>)}
      </View>
    </View>
  );
};
export const Tabs = ({tabs, value, onChange}) => <Chips options={tabs} value={value} onChange={onChange} />;

// Date + time entry that always shows the weekday. value / onChange use "YYYY-MM-DDTHH:mm" (local time).
export function DateTimeField({value, onChange, label = 'Date and time'}) {
  const bump = ms => onChange(slotToLocalInput(new Date((validSlot(value) ? new Date(String(value).replace(' ', 'T')).getTime() : Date.now()) + ms).toISOString()));
  const d = new Date(String(value).replace(' ', 'T'));
  return (
    <View>
      <Text style={s.fieldLabel}>{label} (YYYY-MM-DD HH:MM, 24h)</Text>
      <TextInput style={s.input} value={value} onChangeText={onChange} placeholder="2026-11-05 10:30" autoCapitalize="none" placeholderTextColor="#9aa8a4" />
      <View style={s.chips}>
        <TouchableOpacity style={s.chip} onPress={() => bump(-3600000)}><Text style={s.chipText}>−1 h</Text></TouchableOpacity>
        <TouchableOpacity style={s.chip} onPress={() => bump(3600000)}><Text style={s.chipText}>+1 h</Text></TouchableOpacity>
        <TouchableOpacity style={s.chip} onPress={() => bump(-86400000)}><Text style={s.chipText}>−1 day</Text></TouchableOpacity>
        <TouchableOpacity style={s.chip} onPress={() => bump(86400000)}><Text style={s.chipText}>+1 day</Text></TouchableOpacity>
      </View>
      {validSlot(value) ? <Text style={s.dayChip}>{d.toLocaleDateString([], {weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'})} · {p2(d.getHours())}:{p2(d.getMinutes())}</Text> : <Text style={s.error}>Enter a valid date and time.</Text>}
    </View>
  );
}

// District -> mandal chooser fed by the public /geo master list (falls back to text boxes when none exist yet).
export function GeoPicker({district, mandal, onChange, required}) {
  const [districts, setDistricts] = useState(null);
  useEffect(() => { api('/geo').then(r => setDistricts(r.districts || [])).catch(() => setDistricts([])); }, []);
  if (districts === null) return <Spinner />;
  if (!districts.length) return <><Field label={`District${required ? ' *' : ''}`} value={district} onChangeText={v => onChange({district: v, mandal})} autoCapitalize="words" /><Field label={`Mandal${required ? ' *' : ''}`} value={mandal} onChangeText={v => onChange({district, mandal: v})} autoCapitalize="words" /></>;
  const cur = districts.find(d => d.name === district);
  return (
    <View>
      <Dropdown label={`District${required ? ' *' : ''}`} placeholder="Select district" options={districts.map(d => [d.name, d.name])} value={district} onChange={v => onChange({district: v, mandal: ''})} />
      {!!cur && (cur.mandals.length
        ? <Dropdown label={`Mandal${required ? ' *' : ''}`} placeholder="Select mandal" options={cur.mandals.map(m => [m.name, m.name])} value={mandal} onChange={v => onChange({district, mandal: v})} />
        : <Text style={s.muted}>No mandals listed for this district.</Text>)}
    </View>
  );
}

// hospital -> specialist chooser used for referrals and bookings
export function HospitalPicker({district, mandal, hospitalId, specialistId, onChange, onGeo, showGeo = true}) {
  const [hospitals, setHospitals] = useState([]), [specialists, setSpecialists] = useState([]);
  useEffect(() => {
    if (!district || !mandal) { setHospitals([]); return; }
    api(`/hospitals?district=${encodeURIComponent(district)}&mandal=${encodeURIComponent(mandal)}`).then(r => setHospitals(arr(r))).catch(() => setHospitals([]));
  }, [district, mandal]);
  useEffect(() => {
    if (!hospitalId) { setSpecialists([]); return; }
    api(`/specialists?hospital_id=${encodeURIComponent(hospitalId)}`).then(r => setSpecialists(arr(r))).catch(() => setSpecialists([]));
  }, [hospitalId]);
  return (
    <View>
      {showGeo && <GeoPicker district={district} mandal={mandal} onChange={g => { onGeo(g); onChange({hospitalId: '', specialistId: ''}); }} required />}
      {hospitals.length
        ? <Dropdown label="Hospital" placeholder="Select hospital" options={hospitals.map(h => [h.id, `${h.name} — ${h.mandal}${h.address ? `, ${h.address}` : ''}`])} value={hospitalId} onChange={v => onChange({hospitalId: v, specialistId: ''})} />
        : <><Text style={s.fieldLabel}>Hospital</Text><Text style={s.muted}>{mandal ? 'No hospitals listed in this mandal.' : 'Select a district and mandal first.'}</Text></>}
      {!!hospitalId && <Dropdown label="Specialist (optional)" options={[['', 'Any available'], ...specialists.map(sp => [sp.id, `${sp.full_name}${sp.specialty ? ` · ${sp.specialty}` : ''}`])]} value={specialistId || ''} onChange={v => onChange({hospitalId, specialistId: v})} />}
    </View>
  );
}

// small data hook: loads on mount, exposes reload
export function useLoad(path, deps = []) {
  const [data, setData] = useState(null), [error, setError] = useState('');
  const load = React.useCallback(async () => { setError(''); try { setData(await api(path)); } catch (e) { setError(e.message); setData(d => d || []); } }, [path]);
  useEffect(() => { load(); }, [load, ...deps]);
  return {data, error, reload: load, setData};
}

export const s = StyleSheet.create({
  btn: {backgroundColor: '#0d7669', padding: 12, borderRadius: 10, alignItems: 'center', marginTop: 10},
  btnSmall: {paddingVertical: 8, paddingHorizontal: 12, marginRight: 8},
  btnAlt: {backgroundColor: '#e8f3f0'}, btnDanger: {backgroundColor: '#fdecea'},
  btnText: {color: '#fff', fontWeight: '800', fontSize: 13}, btnAltText: {color: '#0d5d54'}, btnDangerText: {color: '#b42318'},
  card: {backgroundColor: '#fff', padding: 14, borderRadius: 13, marginBottom: 10, borderWidth: 1, borderColor: '#e3ece9'},
  line: {marginTop: 9}, label: {fontSize: 10, fontWeight: '800', color: '#52716a'}, value: {fontSize: 13, color: '#24443e', marginTop: 2},
  muted: {fontSize: 11, color: '#71827e', marginTop: 4, lineHeight: 16}, rowTitle: {fontSize: 14, fontWeight: '800', color: '#173c38'},
  empty: {textAlign: 'center', color: '#81918c', padding: 20, fontSize: 13}, error: {color: '#b42318', marginVertical: 8, fontSize: 12},
  okmsg: {color: '#0d6b3d', backgroundColor: '#e6f6ee', padding: 10, borderRadius: 9, marginVertical: 8, fontSize: 12},
  section: {fontSize: 15, fontWeight: '900', color: '#24443e', marginTop: 16, marginBottom: 8},
  pill: {alignSelf: 'flex-start', fontSize: 10, fontWeight: '800', color: '#0d7669', backgroundColor: '#e8f3f0', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20, marginTop: 6, overflow: 'hidden'},
  fieldLabel: {fontSize: 11, fontWeight: '800', color: '#52716a', marginTop: 10, marginBottom: 5},
  pwRow: {flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#d8e4e1', borderRadius: 10, backgroundColor: '#fff'},
  input: {backgroundColor: '#fff', borderWidth: 1, borderColor: '#d8e4e1', borderRadius: 10, padding: 11, color: '#173c38'},
  multiline: {minHeight: 70, textAlignVertical: 'top'},
  chips: {flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginBottom: 6},
  chip: {paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, backgroundColor: '#eef4f2', borderWidth: 1, borderColor: '#d8e4e1'},
  chipOn: {backgroundColor: '#0d7669', borderColor: '#0d7669'}, chipText: {color: '#35524c', fontSize: 12, fontWeight: '700'}, chipOnText: {color: '#fff', fontSize: 12, fontWeight: '800'},
  select: {backgroundColor: '#fff', padding: 11, borderRadius: 10, marginBottom: 7, borderWidth: 1, borderColor: '#d8e4e1'}, selectOn: {borderColor: '#0d7669', backgroundColor: '#e8f3f0'},
  dayChip: {fontSize: 12, fontWeight: '800', color: '#0d5d54', marginTop: 4},
  row: {flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', marginTop: 4},
});
