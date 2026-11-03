import {dyn} from '../theme';
import React, {useEffect, useState} from 'react';
import {View, Text, ScrollView, TouchableOpacity, StyleSheet,  ActivityIndicator} from '../rn';
import {api} from '../api/client';
import Screen from '../Screen';
import PrefBar from '../components/PrefBar';
import {Field, Chips, GeoPicker, Err, Ok, Muted, s as ui} from '../ui';

const DESIGNATIONS = [['health_worker', 'Health worker'], ['navigator', 'Navigator'], ['medical_officer', 'Medical officer'], ['specialist', 'Specialist (doctor)']];
const EMPTY = {full_name: '', email: '', password: '', role: 'health_worker', assigned_facility: '', district: '', mandal: '', hospital_id: '', specialty: '', phone: ''};

// Self-registration (same form as the web Register tab). An admin must approve the account before sign-in.
export default function RegisterScreen({onBack, onDone}) {
  const [reg, setReg] = useState(EMPTY), [hospitals, setHospitals] = useState([]), [busy, setBusy] = useState(false), [err, setErr] = useState(''), [ok, setOk] = useState('');
  const set = k => v => setReg(r => ({...r, [k]: v}));
  useEffect(() => {
    if (reg.role !== 'specialist' || !reg.district || !reg.mandal) { setHospitals([]); return; }
    api(`/public/hospitals?district=${encodeURIComponent(reg.district)}&mandal=${encodeURIComponent(reg.mandal)}`).then(setHospitals).catch(() => setHospitals([]));
  }, [reg.role, reg.district, reg.mandal]);
  const submit = async () => {
    setErr(''); setOk(''); setBusy(true);
    try { const r = await api('/auth/register', {method: 'POST', body: reg}); setOk(r.message || 'Registration received. An admin must approve it before you can sign in.'); onDone && onDone(reg.email); setReg(EMPTY); }
    catch (e) { setErr(e.message); } finally { setBusy(false); }
  };
  const valid = reg.full_name.trim().length >= 2 && reg.email.includes('@') && reg.password.length >= 8 && reg.district && reg.mandal && (reg.role !== 'specialist' || reg.hospital_id);
  return (
    <Screen bg="#0d5d54"><View style={dyn({flex: 1, backgroundColor: '#f3f7f6'})}>
      <View style={st.hero}><View style={{alignItems: 'flex-end', marginBottom: 8}}><PrefBar onDark /></View><Text style={st.logo}>◉ Create account</Text><Text style={st.sub}>An admin must approve your account before you can sign in.</Text></View>
      <ScrollView style={{flex: 1}} contentContainerStyle={{padding: 20, paddingBottom: 60}} keyboardShouldPersistTaps="handled">
        <View style={st.panel}>
          <Field label="Full name" value={reg.full_name} onChangeText={set('full_name')} autoCapitalize="words" />
          <Field label="Email address" value={reg.email} onChangeText={set('email')} keyboardType="email-address" />
          <Field label="Password (min 8 characters)" value={reg.password} onChangeText={set('password')} secure />
          <Chips label="Designation you are applying for" options={DESIGNATIONS} value={reg.role} onChange={v => setReg(r => ({...r, role: v, hospital_id: ''}))} />
          <GeoPicker district={reg.district} mandal={reg.mandal} onChange={g => setReg(r => ({...r, ...g, hospital_id: ''}))} required />
          {reg.role === 'specialist' ? <>
            <Text style={ui.fieldLabel}>Your hospital *</Text>
            {hospitals.map(h => <TouchableOpacity key={h.id} onPress={() => set('hospital_id')(h.id)} style={[ui.select, reg.hospital_id === h.id && ui.selectOn]}><Text style={ui.rowTitle}>{h.name}</Text></TouchableOpacity>)}
            {!hospitals.length && <Muted>{reg.mandal ? 'No hospitals listed here. Ask the district admin to add yours.' : 'Select district and mandal first.'}</Muted>}
            <Field label="Specialty (optional)" value={reg.specialty} onChangeText={set('specialty')} placeholder="Oral surgery / ENT" autoCapitalize="words" />
            <Field label="Phone (optional)" value={reg.phone} onChangeText={set('phone')} keyboardType="phone-pad" />
          </> : <Field label="Facility (optional)" value={reg.assigned_facility} onChangeText={set('assigned_facility')} placeholder="PHC G. Madugula" autoCapitalize="words" />}
          <Ok text={ok} /><Err text={err} />
          <TouchableOpacity style={[st.primary, (!valid || busy) && {opacity: .5}]} disabled={!valid || busy} onPress={submit}>{busy ? <ActivityIndicator color="#fff" /> : <Text style={st.primaryText}>Submit for approval</Text>}</TouchableOpacity>
          <TouchableOpacity style={st.back} onPress={onBack}><Text style={st.backText}>← Back to sign in</Text></TouchableOpacity>
        </View>
      </ScrollView>
    </View></Screen>
  );
}
const st = StyleSheet.create({
  screen: {flex: 1, backgroundColor: '#f3f7f6'}, hero: {backgroundColor: '#0d5d54', padding: 24, paddingTop: 16, borderBottomLeftRadius: 28, borderBottomRightRadius: 28},
  logo: {fontSize: 22, fontWeight: '900', color: '#fff'}, sub: {color: '#d5eeea', marginTop: 6, fontSize: 12},
  panel: {backgroundColor: '#fff', padding: 18, borderRadius: 18, elevation: 2},
  primary: {backgroundColor: '#0d7669', padding: 14, borderRadius: 10, alignItems: 'center', marginTop: 12}, primaryText: {color: '#fff', fontWeight: '700'},
  back: {alignItems: 'center', padding: 14}, backText: {color: '#0d7669', fontWeight: '800'},
});
