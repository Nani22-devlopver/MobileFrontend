import AIAssessment from '../components/AIAssessment';
import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {View, Text, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, RefreshControl, StyleSheet, Alert, Pressable, Dimensions} from '../rn';
import {api} from '../api/client';
import {getScreening, markNotificationRead} from '../api/endpoints';
import {HospitalPicker} from '../ui';
import Appointments from '../screens/Appointments';
import Referrals from '../screens/Referrals';
import AssignSpecialist from '../screens/AssignSpecialist';
import CrossMandal from '../screens/CrossMandal';
import Patients from '../screens/Patients';
import Investigations from '../screens/Investigations';
import Audit from '../screens/Audit';
import NotificationsScreen from '../screens/Notifications';
import {AdminDashboard} from '../screens/AdminScreens';

const nav=[
 {name:'Overview',icon:'⌂',hint:'Clinical summary'},
 {name:'Review queue',icon:'✓',hint:'Screenings awaiting review'},
 {name:'Referrals',icon:'⇢',hint:'Assigned specialists and status'},
 {name:'Appointments',icon:'▣',hint:'Patient appointments'},
 {name:'Patients',icon:'♙',hint:'Open a patient to assign a specialist'},
 {name:'Investigations',icon:'⚗',hint:'Biopsies and reports'},
 {name:'Cross-mandal',icon:'⇄',hint:'Requests from other mandals / districts'},
 {name:'District dashboard',icon:'▤',hint:'Programme indicators'},
 {name:'Audit trail',icon:'☰',hint:'Access and change log'},
 {name:'Notifications',icon:'♢',hint:'Alerts and updates'},
];
const arr=v=>Array.isArray(v)?v:(v?.items||v?.data||[]);
const human=v=>String(v||'—').replaceAll('_',' ');
const feedbackLines=v=>{if(!v)return [];if(typeof v==='string'){try{v=JSON.parse(v);}catch{return [['Assessment details',v]];}}if(Array.isArray(v))return v.map((x,i)=>[`Item ${i+1}`,typeof x==='object'?JSON.stringify(x):String(x)]);if(typeof v==='object')return Object.entries(v).map(([k,val])=>[human(k),typeof val==='object'&&val!==null?JSON.stringify(val):String(val)]);return [['Assessment details',String(v)]];};
const Field=({label,value,onChangeText,placeholder,multiline=false})=><View style={s.field}><Text style={s.label}>{label}</Text><TextInput style={[s.input,multiline&&s.multiline]} value={value} onChangeText={onChangeText} placeholder={placeholder||label} multiline={multiline}/></View>;
const Btn=({title,onPress,secondary=false,disabled=false})=><TouchableOpacity disabled={disabled} onPress={onPress} style={[s.btn,secondary&&s.secondary,disabled&&{opacity:.45}]}><Text style={[s.btnText,secondary&&s.secondaryText]}>{title}</Text></TouchableOpacity>;
const Row=({title,subtitle,status,onPress})=><TouchableOpacity disabled={!onPress} onPress={onPress} style={s.row}><View style={{flex:1}}><Text style={s.rowTitle}>{title||'Record'}</Text><Text style={s.sub}>{subtitle||''}</Text></View>{!!status&&<Text style={s.status}>{human(status)}</Text>}</TouchableOpacity>;
const Metric=({label,value})=><View style={s.metric}><Text style={s.metricValue}>{value}</Text><Text style={s.metricLabel}>{label}</Text></View>;

export default function MedicalOfficerDashboard({user,onLogout}){
 const [page,setPage]=useState('Overview'),[drawer,setDrawer]=useState(false),[loading,setLoading]=useState(false),[error,setError]=useState('');
 const [screenings,setScreenings]=useState([]),[referrals,setReferrals]=useState([]),[appointments,setAppointments]=useState([]),[notifications,setNotifications]=useState([]),[hospitals,setHospitals]=useState([]);
 const [selected,setSelected]=useState(null),[detail,setDetail]=useState(null),[finding,setFinding]=useState(''),[outcome,setOutcome]=useState('refer'),[agreement,setAgreement]=useState('deferred'),[review,setReview]=useState(null),[hospitalId,setHospitalId]=useState(''),[specialistId,setSpecialistId]=useState(''),[specialty,setSpecialty]=useState('Oral surgery / ENT'),[priority,setPriority]=useState('urgent'),[reason,setReason]=useState('');
 const [assignPatient,setAssignPatient]=useState(null),[specialists,setSpecialists]=useState([]),[busy,setBusy]=useState(false),[geo,setGeo]=useState({district:user?.district||'',mandal:user?.mandal||''});
 const refresh=useCallback(async()=>{
  setLoading(true);setError('');
  const requests=await Promise.allSettled([
   api('/screenings?awaiting_review=true'),api('/referrals'),api('/appointments'),api('/notifications'),
   (user?.district&&user?.mandal?api(`/hospitals?district=${encodeURIComponent(user.district)}&mandal=${encodeURIComponent(user.mandal)}`):Promise.resolve([]))
  ]);
  const setters=[setScreenings,setReferrals,setAppointments,setNotifications,setHospitals];
  const names=['review queue','referrals','appointments','notifications','hospitals'];const errors=[];
  requests.forEach((r,i)=>{if(r.status==='fulfilled')setters[i](arr(r.value));else errors.push(`${names[i]}: ${r.reason?.message||'Request failed'}`);});
  setError(errors.join('\n'));setLoading(false);
 },[user?.district,user?.mandal]);
 useEffect(()=>{refresh();},[refresh]);
 const openScreening=async item=>{setSelected(item);setDetail(null);setReview(null);setFinding('');setOutcome('refer');setGeo({district:item.patient_district||user?.district||'',mandal:item.patient_mandal||user?.mandal||''});setAgreement('deferred');setHospitalId('');setSpecialistId('');setReason('');setPage('Clinical review');setDrawer(false);setBusy(true);try{const d=await getScreening(item.id);setDetail(d);if(d.reviews?.length)setReview(d.reviews[0]);}catch(e){Alert.alert('Unable to open screening',e.message);}finally{setBusy(false);}};
 const signReview=async()=>{if(!selected?.id||!finding.trim()){Alert.alert('Required','Enter the clinical finding before signing.');return;}setBusy(true);try{const r=await api('/reviews',{method:'POST',body:{screening_id:selected.id,finding:finding.trim(),outcome,ai_agreement:agreement}});setReview(r);setMessageAndRefresh('Clinical review signed successfully.');}catch(e){Alert.alert('Review could not be saved',e.message);}finally{setBusy(false);}};
 const [toast,setToast]=useState('');
 const setMessageAndRefresh=msg=>{setToast(msg);refresh();};
 const loadSpecialists=async id=>{setHospitalId(id);setSpecialistId('');if(!id){setSpecialists([]);return;}try{setSpecialists(arr(await api(`/specialists?hospital_id=${encodeURIComponent(id)}`)));}catch(e){Alert.alert('Unable to load specialists',e.message);}};
 const createReferral=async()=>{if(!review?.id){Alert.alert('Review required','Sign the clinical review before creating a referral.');return;}if(!hospitalId){Alert.alert('Select hospital','Choose an available hospital.');return;}setBusy(true);try{await api('/referrals',{method:'POST',body:{review_id:review.id,hospital_id:hospitalId,specialist_id:specialistId||null,specialty:specialty.trim()||'Oral surgery / ENT',priority,reason:reason.trim()||null}});Alert.alert('Referral created','The referral was saved and the relevant care team was notified.');setPage('Referrals');refresh();}catch(e){Alert.alert('Referral could not be created',e.message);}finally{setBusy(false);}};
 const unread=notifications.filter(n=>!n.read).length;
 const pending=screenings.length;
 const navigate=p=>{setPage(p);setDrawer(false);setToast('');};
 const markRead=async n=>{try{await markNotificationRead(n.id);refresh();}catch(e){Alert.alert('Could not update notification',e.message);}};
 const openReferralPatients=useMemo(()=>referrals.filter(r=>r.status!=='CANCELLED'),[referrals]);
 return <View style={s.root}>
  <View style={s.header}>
   <TouchableOpacity accessibilityRole="button" accessibilityLabel="Open navigation menu" onPress={()=>setDrawer(true)} style={s.menu}><Text style={s.menuText}>☰</Text></TouchableOpacity>
   <View style={{flex:1}}><Text style={s.brand}>Aarogya Drishti</Text><Text style={s.welcome}>Medical Officer workspace · {page}</Text></View>
   <TouchableOpacity onPress={refresh} style={s.refresh}><Text style={s.menuText}>↻</Text></TouchableOpacity>
  </View>
  <ScrollView style={s.content} refreshControl={<RefreshControl refreshing={loading||busy} onRefresh={refresh} tintColor="#0d7669"/>} keyboardShouldPersistTaps="handled">
   <Text style={s.heading}>{page}</Text>
   {!!error&&<Text style={s.error}>{error}</Text>}{!!toast&&<Text style={s.toast}>{toast}</Text>}{(loading||busy)&&<ActivityIndicator color="#0d7669" style={{margin:12}}/>}
   {page==='Overview'&&<>
    <Text style={s.section}>Your clinical workload</Text><View style={s.metrics}><Metric label="Awaiting review" value={pending}/><Metric label="Referrals" value={referrals.length}/><Metric label="Appointments" value={appointments.length}/><Metric label="Unread alerts" value={unread}/></View>
    <Text style={s.section}>Priority actions</Text><Btn title={`Review pending screenings (${pending})`} onPress={()=>navigate('Review queue')}/><Btn title="Manage referrals" secondary onPress={()=>navigate('Referrals')}/>
    <Text style={s.section}>Latest screenings awaiting review</Text>{screenings.slice(0,6).map(x=><Row key={x.id} title={x.patient_name||'Patient screening'} subtitle={[x.village,x.patient_mandal,x.created_at?new Date(x.created_at).toLocaleDateString():null].filter(Boolean).join(' · ')} status={x.status} onPress={()=>openScreening(x)}/>)}{!screenings.length&&<Text style={s.empty}>No screenings are waiting for your review.</Text>}
   </>}
   {page==='Review queue'&&<><Text style={s.help}>Review screenings in your assigned facility and geographic scope. Check the clinical notes and AI research output, then record your own clinical finding. AI output is not a diagnosis.</Text>{screenings.map(x=><Row key={x.id} title={x.patient_name||'Patient screening'} subtitle={[x.village,x.patient_mandal,x.created_at?new Date(x.created_at).toLocaleString():null].filter(Boolean).join(' · ')} status={x.status} onPress={()=>openScreening(x)}/>)}{!screenings.length&&<Text style={s.empty}>No pending clinical reviews.</Text>}</>}
   {page==='Clinical review'&&<>
    <Btn title="← Back to review queue" secondary onPress={()=>navigate('Review queue')}/>
    <View style={s.patientCard}><Text style={s.patientName}>{selected?.patient_name||'Patient screening'}</Text><Text style={s.help}>Screening ID: {selected?.id}</Text><Text style={s.help}>Status: {human(detail?.status||selected?.status)} · {selected?.created_at?new Date(selected.created_at).toLocaleString():''}</Text></View>
    <Text style={s.section}>Screening details</Text>
    {[['Symptoms',detail?.symptoms],['Duration',detail?.duration],['Tobacco use',detail?.tobacco],['Health worker examination notes',detail?.exam_notes]].map(([k,v])=><View key={k} style={s.info}><Text style={s.label}>{k}</Text><Text style={s.infoValue}>{v||'Not provided'}</Text></View>)}
    <Text style={s.section}>AI research assessment</Text>{(detail?.ai_analyses||[]).map(a=><AIAssessment key={a.id} analysis={a} audience="clinician"/>)}{!detail?.ai_analyses?.length&&<Text style={s.empty}>No AI assessment is attached to this screening.</Text>}
    <Text style={s.section}>Clinical decision</Text>{review?<View style={s.aiCard}><Text style={s.rowTitle}>Signed review: {human(review.outcome)}</Text><Text style={s.sub}>{review.finding}</Text><Text style={s.sub}>AI agreement: {human(review.ai_agreement)} · {review.signed_at?new Date(review.signed_at).toLocaleString():''}</Text></View>:<>
     <Field label="Clinical finding *" value={finding} onChangeText={setFinding} multiline placeholder="Enter your clinical observations and assessment"/>
     <Text style={s.label}>Clinical outcome</Text><View style={s.chips}>{[['refer','Refer'],['follow_up','Follow up'],['recapture','Request recapture']].map(([v,l])=><TouchableOpacity key={v} onPress={()=>setOutcome(v)} style={[s.chip,outcome===v&&s.chipOn]}><Text style={outcome===v?s.chipOnText:s.chipText}>{l}</Text></TouchableOpacity>)}</View>
     <Text style={s.label}>AI agreement</Text><View style={s.chips}>{['agree','disagree','deferred'].map(v=><TouchableOpacity key={v} onPress={()=>setAgreement(v)} style={[s.chip,agreement===v&&s.chipOn]}><Text style={agreement===v?s.chipOnText:s.chipText}>{human(v)}</Text></TouchableOpacity>)}</View>
     <Btn title="Sign clinical review" onPress={signReview} disabled={busy}/>
    </>}
    {!!review&&review.outcome==='refer'&&<><Text style={s.section}>Assign a specialist</Text><Text style={s.help}>Assigning is done on the patient's own page: choose an available specialist of the patient's mandal, or send a cross-mandal / cross-district request.</Text><Btn title="Assign specialist for this patient" onPress={()=>{setAssignPatient({id:detail?.patient_id||selected?.patient_id,full_name:selected?.patient_name});setPage('Assign specialist');}} disabled={!(detail?.patient_id||selected?.patient_id)}/></>}
   </>}
   {page==='Referrals'&&<><Referrals onChanged={refresh}/></>}
   {false&&<>{openReferralPatients.map(r=><View key={r.id} style={s.card}><Text style={s.rowTitle}>{r.patient_name||'Patient'} · {r.specialty||'Specialist referral'}</Text><Text style={s.sub}>{r.hospital_name||r.facility} · {r.hospital_mandal||''}</Text><Text style={s.sub}>{r.specialist_name||'Any available specialist'} · {human(r.priority)}</Text><Text style={s.status}>{human(r.status)}</Text>{!!r.reason&&<Text style={s.sub}>{r.reason}</Text>}</View>)}{!openReferralPatients.length&&<Text style={s.empty}>No referrals found in your area.</Text>}</>}
   {page==='Appointments'&&<Appointments user={user} onChanged={refresh}/>}
   {page==='Patients'&&<Patients onAssign={p=>{setAssignPatient(p);setPage('Assign specialist');}}/>}
   {page==='Assign specialist'&&!!assignPatient&&<AssignSpecialist patient={assignPatient} onBack={()=>setPage('Patients')} onDone={refresh}/>}
   {page==='Investigations'&&<Investigations/>}
   {page==='Cross-mandal'&&<CrossMandal onChanged={refresh}/>}
   {page==='District dashboard'&&<AdminDashboard user={user}/>}
   {page==='Audit trail'&&<Audit/>}
   {page==='Notifications'&&<NotificationsScreen user={user} onNavigate={navigate} onChanged={refresh}/>}
  </ScrollView>
  {drawer&&<View style={s.drawerLayer}><Pressable accessibilityRole="button" accessibilityLabel="Close navigation menu" style={s.backdrop} onPress={()=>setDrawer(false)}/><View style={s.drawerPanel}>
   <View style={s.drawerTop}><View style={s.logoMark}><Text style={s.logoMarkText}>A</Text></View><View style={{flex:1}}><Text style={s.drawerBrand}>Aarogya Drishti</Text><Text style={s.drawerCaption}>MEDICAL OFFICER PORTAL</Text></View><TouchableOpacity onPress={()=>setDrawer(false)} style={s.close}><Text style={s.closeText}>×</Text></TouchableOpacity></View>
   <Text style={s.drawerSection}>CLINICAL WORKSPACE</Text><ScrollView>{nav.map(n=><TouchableOpacity key={n.name} onPress={()=>navigate(n.name)} style={[s.navItem,page===n.name&&s.navActive]}><Text style={[s.navIcon,page===n.name&&s.navIconActive]}>{n.icon}</Text><View style={{flex:1}}><Text style={[s.navTitle,page===n.name&&s.navTitleActive]}>{n.name}</Text><Text style={s.navHint}>{n.hint}</Text></View>{n.name==='Notifications'&&unread>0&&<Text style={s.badge}>{unread}</Text>}</TouchableOpacity>)}</ScrollView>
   <View style={s.userFoot}><View style={s.avatar}><Text style={s.avatarText}>{(user.full_name||user.email||'M').charAt(0).toUpperCase()}</Text></View><View style={{flex:1}}><Text style={s.userName}>{user.full_name||'Medical Officer'}</Text><Text style={s.userMeta}>{[user.assigned_facility,user.mandal,user.district].filter(Boolean).join(' · ')||user.email}</Text></View></View><TouchableOpacity style={s.logout} onPress={()=>{setDrawer(false);Alert.alert('Log out','Are you sure you want to log out?',[{text:'Cancel',style:'cancel'},{text:'Log out',style:'destructive',onPress:onLogout}]);}}><Text style={s.logoutText}>↪  Log out</Text></TouchableOpacity>
  </View></View>}
 </View>;
}
const s=StyleSheet.create({root:{flex:1,backgroundColor:'#f3f7f6'},header:{backgroundColor:'#0d5d54',paddingHorizontal:15,paddingVertical:12,flexDirection:'row',alignItems:'center',gap:12},menu:{width:40,height:40,borderRadius:12,backgroundColor:'#ffffff22',alignItems:'center',justifyContent:'center'},menuText:{color:'#fff',fontSize:22,fontWeight:'800'},brand:{fontSize:19,fontWeight:'900',color:'#fff'},welcome:{fontSize:11,color:'#d5eeea',marginTop:3},refresh:{padding:9,backgroundColor:'#ffffff22',borderRadius:10},content:{flex:1,padding:15},heading:{fontSize:23,fontWeight:'900',color:'#173c38',marginBottom:12},section:{fontSize:15,fontWeight:'900',color:'#24443e',marginTop:17,marginBottom:9},metrics:{flexDirection:'row',flexWrap:'wrap',justifyContent:'space-between',marginBottom:5},metric:{width:'48%',backgroundColor:'#fff',padding:15,borderRadius:13,marginBottom:9,borderWidth:1,borderColor:'#e3ece9'},metricValue:{fontSize:25,fontWeight:'900',color:'#0d7669'},metricLabel:{fontSize:11,color:'#71827e',marginTop:4},row:{backgroundColor:'#fff',padding:13,borderRadius:12,marginBottom:8,borderWidth:1,borderColor:'#e3ece9',flexDirection:'row',alignItems:'center',gap:10},rowTitle:{fontSize:14,fontWeight:'800',color:'#173c38'},sub:{fontSize:11,color:'#788984',marginTop:4,lineHeight:16},status:{fontSize:10,fontWeight:'800',color:'#0d7669',marginTop:5},empty:{textAlign:'center',color:'#81918c',padding:20,fontSize:13},help:{fontSize:12,color:'#6f817c',lineHeight:18,marginBottom:12},btn:{backgroundColor:'#0d7669',padding:13,borderRadius:10,alignItems:'center',marginBottom:9},btnText:{color:'#fff',fontWeight:'800',fontSize:13},secondary:{backgroundColor:'#e8f3f0'},secondaryText:{color:'#0d7669'},field:{marginBottom:12},label:{fontSize:12,fontWeight:'800',color:'#36534d',marginBottom:5},input:{backgroundColor:'#fff',borderWidth:1,borderColor:'#d8e4e1',borderRadius:10,paddingHorizontal:12,paddingVertical:11,color:'#173c38',fontSize:14},multiline:{minHeight:85,textAlignVertical:'top'},chips:{flexDirection:'row',flexWrap:'wrap',gap:7,marginBottom:12},chip:{borderWidth:1,borderColor:'#d7e5e1',paddingHorizontal:11,paddingVertical:8,borderRadius:20,backgroundColor:'#fff'},chipOn:{backgroundColor:'#0d7669',borderColor:'#0d7669'},chipText:{fontSize:11,color:'#46615b'},chipOnText:{fontSize:11,color:'#fff',fontWeight:'800'},patientCard:{backgroundColor:'#fff',padding:14,borderRadius:12,marginBottom:10},patientName:{fontSize:19,fontWeight:'900',color:'#173c38'},info:{backgroundColor:'#fff',padding:12,borderRadius:10,marginBottom:7},infoValue:{fontSize:13,color:'#294a43'},aiCard:{backgroundColor:'#fff',padding:13,borderRadius:11,marginBottom:9,borderWidth:1,borderColor:'#e3ece9'},warning:{fontSize:11,color:'#9a5a12',marginTop:7,lineHeight:16},feedbackValue:{fontSize:12,color:'#294a43',lineHeight:18,flexWrap:'wrap'},selectRow:{padding:12,borderWidth:1,borderColor:'#dce8e4',borderRadius:11,backgroundColor:'#fff',marginBottom:7},selectOn:{borderColor:'#0d7669',backgroundColor:'#eaf5f2'},card:{backgroundColor:'#fff',padding:13,borderRadius:12,marginBottom:9,borderWidth:1,borderColor:'#e3ece9'},unread:{borderColor:'#0d7669',borderLeftWidth:4},error:{color:'#b42318',backgroundColor:'#fff0ee',padding:10,borderRadius:9,marginBottom:10},toast:{color:'#155e50',backgroundColor:'#e4f4ee',padding:10,borderRadius:9,marginBottom:10},drawerLayer:{...StyleSheet.absoluteFillObject,zIndex:30,flexDirection:'row'},backdrop:{...StyleSheet.absoluteFillObject,backgroundColor:'rgba(8,28,25,.48)'},drawerPanel:{width:Math.min(Dimensions.get('window').width*.82,310),maxWidth:310,height:'100%',backgroundColor:'#fff',padding:14,elevation:18},drawerTop:{flexDirection:'row',alignItems:'center',gap:9,paddingVertical:14,borderBottomWidth:1,borderBottomColor:'#edf2f0',marginBottom:18},logoMark:{width:40,height:40,borderRadius:13,backgroundColor:'#0d7669',alignItems:'center',justifyContent:'center'},logoMarkText:{fontSize:21,fontWeight:'900',color:'#fff'},drawerBrand:{fontSize:15,fontWeight:'900',color:'#173c38'},drawerCaption:{fontSize:9,fontWeight:'800',letterSpacing:1,color:'#82928e',marginTop:3},close:{width:32,height:32,borderRadius:9,backgroundColor:'#f1f6f4',alignItems:'center',justifyContent:'center'},closeText:{fontSize:24,color:'#526b66'},drawerSection:{fontSize:10,fontWeight:'900',letterSpacing:1.2,color:'#98a7a2',marginHorizontal:7,marginBottom:9},navItem:{minHeight:57,borderRadius:12,paddingHorizontal:10,marginBottom:5,flexDirection:'row',alignItems:'center',gap:10},navActive:{backgroundColor:'#eaf5f2'},navIcon:{width:31,height:31,borderRadius:9,backgroundColor:'#f3f7f6',textAlign:'center',textAlignVertical:'center',fontSize:17,color:'#61766f'},navIconActive:{backgroundColor:'#d4ebe4',color:'#0d7669'},navTitle:{fontSize:13,fontWeight:'800',color:'#415b54'},navTitleActive:{color:'#0d7669'},navHint:{fontSize:10,color:'#899994',marginTop:3},badge:{backgroundColor:'#d94b42',color:'#fff',overflow:'hidden',borderRadius:10,paddingHorizontal:7,paddingVertical:3,fontSize:10,fontWeight:'900'},userFoot:{flexDirection:'row',alignItems:'center',gap:9,borderTopWidth:1,borderTopColor:'#edf2f0',paddingTop:14,marginTop:10},avatar:{width:34,height:34,borderRadius:17,backgroundColor:'#dcefe9',alignItems:'center',justifyContent:'center'},avatarText:{fontWeight:'900',color:'#0d7669'},userName:{fontSize:12,fontWeight:'800',color:'#24443e'},userMeta:{fontSize:10,color:'#82928e',marginTop:2},logout:{marginTop:12,padding:11,borderRadius:10,backgroundColor:'#fff3f1'},logoutText:{fontSize:12,fontWeight:'800',color:'#b42318'}});
