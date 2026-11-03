import React, {useEffect, useMemo, useState, useCallback} from 'react';
import {View, Text, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, RefreshControl, StyleSheet, Alert, Image, Linking, Pressable, Dimensions} from '../rn';
import * as ImagePicker from 'expo-image-picker';
import NetInfo from '@react-native-community/netinfo';
import MetricCard from '../components/MetricCard';
import RecordRow from '../components/RecordRow';
import AIAssessment from '../components/AIAssessment';
import {api} from '../api/client';
import {createPatient, getPatient, getConsents, addConsent, getTimeline, getScreenings, getScreening, createScreening, uploadScreeningImage, analyzeScreening, getVideoLink} from '../api/endpoints';
import {queueCount, syncOutbox, enqueue} from '../offline';

const tabs=[{name:'Overview',icon:'⌂',hint:'Dashboard'},{name:'Patients',icon:'♙',hint:'Patient directory'},{name:'Register',icon:'＋',hint:'Add a patient'},{name:'Screenings',icon:'◉',hint:'Oral screening records'},{name:'Appointments',icon:'▣',hint:'Upcoming visits'},{name:'Notifications',icon:'♢',hint:'Alerts and updates'},{name:'Offline sync',icon:'⇅',hint:'Pending submissions'}];
const arr=v=>Array.isArray(v)?v:(v?.items||v?.data||[]);
const label=v=>String(v||'—').replaceAll('_',' ');
const Field=({label:caption,value,onChangeText,placeholder,multiline=false,keyboardType})=><View style={s.field}><Text style={s.label}>{caption}</Text><TextInput style={[s.input,multiline&&s.multiline]} value={value} onChangeText={onChangeText} placeholder={placeholder||caption} multiline={multiline} keyboardType={keyboardType}/></View>;
const Btn=({title,onPress,secondary=false,disabled=false})=><TouchableOpacity disabled={disabled} onPress={onPress} style={[s.button,secondary&&s.secondary,disabled&&{opacity:.45}]}><Text style={[s.buttonText,secondary&&s.secondaryText]}>{title}</Text></TouchableOpacity>;
const Section=({title,children})=><View style={s.sectionWrap}><Text style={s.section}>{title}</Text>{children}</View>;
const Empty=({text})=><Text style={s.empty}>{text}</Text>;

export default function HealthWorkerDashboard({user,data,loading,error,refresh,page,setPage,onReadNotification,onLogout}){
 const [search,setSearch]=useState('');
 const [patients,setPatients]=useState(data.patients||[]);
 const [selected,setSelected]=useState(null);
 const [consents,setConsents]=useState([]);
 const [timeline,setTimeline]=useState([]);
 const [patientScreenings,setPatientScreenings]=useState([]);
 const [form,setForm]=useState({full_name:'',age:'',sex:'female',phone:'',email:'',address:'',village:'',habitation:'',gram_panchayat:'',district:user?.district||'',mandal:user?.mandal||'',phc:user?.assigned_facility||'',tobacco_use:'',symptoms:'',medical_history:'',video_allowed:false});
 const [screen,setScreen]=useState({symptoms:'',duration:'',tobacco:'',exam_notes:''});
 const [screeningId,setScreeningId]=useState('');
 const [activeImage,setActiveImage]=useState(null);
 const [view,setView]=useState('cheek');
 const [screenDetail,setScreenDetail]=useState(null);
 const [busy,setBusy]=useState(false);
 const [message,setMessage]=useState('');
 const [offlineN,setOfflineN]=useState(0);
 const [consentPurpose,setConsentPurpose]=useState('examination');
 const [detailTab,setDetailTab]=useState('Summary');
 const [drawerOpen,setDrawerOpen]=useState(false);
 const navigate=next=>{setMessage('');setPage(next);setDrawerOpen(false);if(next==='Patients')loadPatients();};

 useEffect(()=>{setPatients(data.patients||[]);},[data.patients]);
 useEffect(()=>{queueCount()&&setOfflineN(queueCount());},[]);
 const loadPatients=useCallback(async()=>{const p=arr(await api(`/patients${search?`?q=${encodeURIComponent(search)}`:''}`));setPatients(p);},[search]);
 const openPatient=async p=>{
  setBusy(true);setMessage('');setSelected(p);setPage('Patient details');
  try{
   const [full,c,t,sc]=await Promise.all([getPatient(p.id),getConsents(p.id),getTimeline(p.id),getScreenings(p.id)]);
   setSelected(full);setConsents(arr(c));setTimeline(t?.events||[]);setPatientScreenings(arr(sc));
  }catch(e){setMessage(e.message);}
  finally{setBusy(false);}
 };
 const savePatient=async()=>{
  if(!form.full_name.trim()){Alert.alert('Required','Enter the patient name.');return;}
  setBusy(true);setMessage('');
  try{
   const payload={...form,age:form.age?Number(form.age):null};
   const key=`mobile-${Date.now()}-${Math.random().toString(36).slice(2)}`;
   const net=await NetInfo.fetch();
   if(!net.isConnected){
    enqueue('/patients','POST',payload);
    setOfflineN(queueCount());
    setMessage('Patient saved on this device. It will upload automatically when internet is available.');
    setForm({...form,full_name:'',age:'',phone:'',email:'',address:'',tobacco_use:'',symptoms:'',medical_history:'',video_allowed:false});
   }else{
    const created=await createPatient(payload,key);
    await loadPatients();setForm({...form,full_name:'',age:'',phone:'',email:'',address:'',tobacco_use:'',symptoms:'',medical_history:'',video_allowed:false});
    setMessage('Patient registered successfully.');await openPatient(created);
   }
  }catch(e){setMessage(e.message);}
  finally{setBusy(false);}
 };
 const saveConsent=async()=>{
  if(!selected)return;
  setBusy(true);setMessage('');
  try{await addConsent(selected.id,{purpose:consentPurpose,language:'en',method:'verbal_plus_checkbox',granted:true});setConsents(arr(await getConsents(selected.id)));setMessage(`${label(consentPurpose)} consent saved.`);}
  catch(e){setMessage(e.message);}finally{setBusy(false);}
 };
 const startScreening=async()=>{
  if(!selected){Alert.alert('Select patient','Open a patient record first.');return;}
  const examOk=consents.some(c=>c.purpose==='examination'&&c.granted);
  if(!examOk){Alert.alert('Consent required','Record examination consent before starting screening.');return;}
  setBusy(true);setMessage('');
  try{
   const net=await NetInfo.fetch();
   if(!net.isConnected){
    enqueue('/screenings','POST',{patient_id:selected.id,...screen});
    setOfflineN(queueCount());
    setMessage('Screening saved on this device. It will upload automatically when internet is available. Photo and AI analysis need an internet connection.');
    setPage('Offline sync');
   }else{
    const r=await createScreening({patient_id:selected.id,...screen});
    setScreeningId(r.id);setScreenDetail(await getScreening(r.id));setActiveImage(null);setPage('Screening workflow');setMessage('Screening draft created. Add imaging consent before uploading a photo.');
    setPatientScreenings(arr(await getScreenings(selected.id)));
   }
  }catch(e){setMessage(e.message);}finally{setBusy(false);}
 };
 const choosePhoto=async(camera)=>{
  if(!screeningId){Alert.alert('Start screening','Create a screening record first.');return;}
  if(!consents.some(c=>c.purpose==='imaging'&&c.granted)){Alert.alert('Imaging consent required','Save imaging consent in the patient record before taking or uploading a photo.');return;}
  setMessage('');
  try{
   const perm=camera?await ImagePicker.requestCameraPermissionsAsync():await ImagePicker.requestMediaLibraryPermissionsAsync();
   if(!perm.granted){Alert.alert('Permission needed',`Allow ${camera?'camera':'photo library'} access in device settings.`);return;}
   const result=camera?await ImagePicker.launchCameraAsync({mediaTypes:['images'],quality:.85}):await ImagePicker.launchImageLibraryAsync({mediaTypes:['images'],quality:.85});
   if(result.canceled||!result.assets?.[0])return;
   setBusy(true);const uploaded=await uploadScreeningImage(screeningId,result.assets[0],view);setActiveImage(uploaded);setScreenDetail(await getScreening(screeningId));setMessage(`Photo uploaded. Quality: ${label(uploaded.quality_status)}. ${uploaded.warning||''}`);
  }catch(e){setMessage(e.message);}finally{setBusy(false);}
 };
 const runAnalysis=async()=>{
  if(!activeImage?.id){Alert.alert('Photo required','Upload a new photo before analysis.');return;}
  setBusy(true);setMessage('AI analysis is running. This can take up to two minutes.');
  try{const r=await analyzeScreening(screeningId,activeImage.id);setScreenDetail(await getScreening(screeningId));setMessage(`Analysis status: ${label(r.status)}. ${r.warning||'NOT FOR CLINICAL USE'}`);}
  catch(e){setMessage(e.message);setScreenDetail(await getScreening(screeningId).catch(()=>screenDetail));}
  finally{setBusy(false);}
 };
 const openScreening=async id=>{
  setBusy(true);setMessage('');
  try{const d=await getScreening(id);setScreenDetail(d);setScreeningId(id);setActiveImage(d.images?.[d.images.length-1]||null);setPage('Screening workflow');}
  catch(e){setMessage(e.message);}finally{setBusy(false);}
 };
 const sync=async()=>{setBusy(true);try{const r=await syncOutbox();setOfflineN(r.remaining||0);Alert.alert('Offline sync',`${r.synced||0} item(s) synced. ${r.remaining||0} remaining.`);refresh();}catch(e){Alert.alert('Sync failed',e.message);}finally{setBusy(false);}};
 const joinVideo=async id=>{try{const r=await getVideoLink(id);if(r.url)await Linking.openURL(r.url);else Alert.alert('No meeting link','The meeting link has not been added yet.');}catch(e){Alert.alert('Unable to join',e.message);}};
 const unread=(data.notifications||[]).filter(n=>!n.read).length;
 const pending=(data.screenings||[]).filter(x=>['AWAITING_CLINICIAN','SCREENED','PENDING'].includes(String(x.status||'').toUpperCase())).length;
 const shownPatients=useMemo(()=>patients.filter(p=>`${p.full_name||''} ${p.phone||''} ${p.village||''}`.toLowerCase().includes(search.toLowerCase())),[patients,search]);

 return <View style={s.root}>
  <View style={s.header}>
   <TouchableOpacity accessibilityRole="button" accessibilityLabel="Open navigation menu" onPress={()=>setDrawerOpen(true)} style={s.menuButton}><Text style={s.menuIcon}>☰</Text></TouchableOpacity>
   <View style={{flex:1}}><Text style={s.brand}>Aarogya Drishti</Text><Text style={s.welcome}>{page==='Overview'?'Health Worker workspace':page}</Text></View>
   <TouchableOpacity accessibilityRole="button" accessibilityLabel="Refresh dashboard" onPress={refresh} style={s.refresh}><Text style={s.refreshText}>↻</Text></TouchableOpacity>
  </View>
  <ScrollView style={s.content} keyboardShouldPersistTaps="handled" refreshControl={<RefreshControl refreshing={loading||busy} onRefresh={refresh} tintColor="#0d7669"/>}>
   <Text style={s.heading}>{page}</Text>
   {!!error&&<Text style={s.error}>{error}</Text>}
   {!!message&&<Text style={s.notice}>{message}</Text>}
   {(loading||busy)&&<ActivityIndicator color="#0d7669" style={{margin:12}}/>}

   {page==='Overview'&&<>
    <Text style={s.section}>Your activity at a glance</Text><View style={s.metrics}>
     <MetricCard label="Patients registered" value={data.patients.length}/>
     <MetricCard label="Screenings recorded" value={data.screenings.length}/>
     <MetricCard label="Awaiting clinician" value={pending}/>
     <MetricCard label="Appointments" value={data.appointments.length}/>
    </View>
    <Section title="Quick actions"><View style={s.actionGrid}><Btn title="+ Register patient" onPress={()=>setPage('Register')}/><Btn title="View patients" secondary onPress={()=>setPage('Patients')}/><Btn title="Start screening" secondary onPress={()=>setPage('Patients')}/><Btn title="Notifications" secondary onPress={()=>setPage('Notifications')}/></View></Section>
    <Section title="Recent patients">{data.patients.slice(0,5).map((p,i)=><TouchableOpacity key={p.id||i} onPress={()=>openPatient(p)}><RecordRow title={p.full_name||p.patient_name||'Patient'} subtitle={[p.age&&`${p.age} years`,p.sex,p.village||p.mandal,p.phone].filter(Boolean).join(' · ')} status={p.status}/></TouchableOpacity>)}{!data.patients.length&&<Empty text="No patient records returned by the server yet."/>}</Section>
    <Section title="Recent screenings">{data.screenings.slice(0,4).map((r,i)=><TouchableOpacity key={r.id||i} onPress={()=>openScreening(r.id)}><RecordRow title={r.patient_name||'Screening'} subtitle={new Date(r.created_at).toLocaleString()} status={r.status}/></TouchableOpacity>)}{!data.screenings.length&&<Empty text="No screenings yet."/>}</Section>
   </>}

   {page==='Patients'&&<>
    <Field label="Search patients" value={search} onChangeText={setSearch} placeholder="Name, phone or village"/>
    <Btn title="Search / refresh" onPress={loadPatients}/>
    <Btn title="+ Register new patient" secondary onPress={()=>setPage('Register')}/>
    {shownPatients.map((p,i)=><TouchableOpacity key={p.id||i} onPress={()=>openPatient(p)}><RecordRow title={p.full_name||'Patient'} subtitle={[p.age&&`${p.age} yrs`,p.sex,p.village,p.phone].filter(Boolean).join(' · ')} status={p.duplicate_hint?'Possible duplicate':'Open record'}/></TouchableOpacity>)}
    {!shownPatients.length&&<Empty text="No matching patients."/>}
   </>}

   {page==='Register'&&<>
    <Text style={s.help}>Register a patient at your assigned facility. The record is saved to FastAPI.</Text>
    <Field label="Full name *" value={form.full_name} onChangeText={v=>setForm({...form,full_name:v})}/>
    <Field label="Age" value={form.age} onChangeText={v=>setForm({...form,age:v})} keyboardType="numeric"/>
    <Text style={s.label}>Sex</Text><View style={s.chips}>{['female','male','other'].map(v=><TouchableOpacity key={v} onPress={()=>setForm({...form,sex:v})} style={[s.chip,form.sex===v&&s.chipOn]}><Text style={form.sex===v?s.chipTextOn:s.chipText}>{label(v)}</Text></TouchableOpacity>)}</View>
    <Field label="Phone" value={form.phone} onChangeText={v=>setForm({...form,phone:v})} keyboardType="phone-pad"/>
    <Field label="Email" value={form.email} onChangeText={v=>setForm({...form,email:v})} keyboardType="email-address"/>
    <Field label="Address" value={form.address} onChangeText={v=>setForm({...form,address:v})}/>
    <Field label="Village" value={form.village} onChangeText={v=>setForm({...form,village:v})}/>
    <Field label="Habitation" value={form.habitation} onChangeText={v=>setForm({...form,habitation:v})}/>
    <Field label="Gram Panchayat" value={form.gram_panchayat} onChangeText={v=>setForm({...form,gram_panchayat:v})}/>
    <Field label="District" value={form.district} onChangeText={v=>setForm({...form,district:v})}/>
    <Field label="Mandal" value={form.mandal} onChangeText={v=>setForm({...form,mandal:v})}/>
    <Field label="PHC / Facility" value={form.phc} onChangeText={v=>setForm({...form,phc:v})}/>
    <Field label="Tobacco use" value={form.tobacco_use} onChangeText={v=>setForm({...form,tobacco_use:v})}/>
    <Field label="Symptoms" value={form.symptoms} onChangeText={v=>setForm({...form,symptoms:v})} multiline/>
    <Field label="Medical history" value={form.medical_history} onChangeText={v=>setForm({...form,medical_history:v})} multiline/>
    <Text style={s.label}>Video consultation with the specialist</Text><Text style={s.help}>Only patients with this privilege can be offered a video consultation. Others are seen at the hospital.</Text>
    <View style={s.chips}>{[[true,'Allowed'],[false,'Not allowed']].map(([v,l])=><TouchableOpacity key={l} onPress={()=>setForm({...form,video_allowed:v})} style={[s.chip,form.video_allowed===v&&s.chipOn]}><Text style={form.video_allowed===v?s.chipOnText:s.chipText}>{l}</Text></TouchableOpacity>)}</View>
    <Btn title={busy?'Saving…':'Save patient record'} onPress={savePatient} disabled={busy}/>
   </>}

   {page==='Patient details'&&selected&&<>
    <View style={s.profile}><Text style={s.profileName}>{selected.full_name}</Text><Text style={s.help}>{[selected.age&&`${selected.age} years`,selected.sex,selected.phone,selected.village,selected.mandal,selected.district].filter(Boolean).join(' · ')}</Text></View>
    <View style={s.chips}>{['Summary','Consent','Screenings','Timeline'].map(v=><TouchableOpacity key={v} onPress={()=>setDetailTab(v)} style={[s.chip,detailTab===v&&s.chipOn]}><Text style={detailTab===v?s.chipTextOn:s.chipText}>{v}</Text></TouchableOpacity>)}</View>
    {detailTab==='Summary'&&<Section title="Patient information">{[['Phone',selected.phone],['Email',selected.email],['Address',selected.address],['Village',selected.village],['Habitation',selected.habitation],['Gram Panchayat',selected.gram_panchayat],['PHC',selected.phc],['Tobacco use',selected.tobacco_use],['Symptoms',selected.symptoms],['Medical history',selected.medical_history]].map(([k,v])=><Text key={k} style={s.detailLine}><Text style={s.label}>{k}: </Text>{v||'—'}</Text>)}</Section>}
    {detailTab==='Consent'&&<Section title="Patient consent"><Text style={s.help}>Record consent before examination and before taking/uploading oral photographs.</Text><Text style={s.label}>Consent purpose</Text><View style={s.chips}>{['examination','imaging','teleconsultation','data_processing'].map(v=><TouchableOpacity key={v} onPress={()=>setConsentPurpose(v)} style={[s.chip,consentPurpose===v&&s.chipOn]}><Text style={consentPurpose===v?s.chipTextOn:s.chipText}>{label(v)}</Text></TouchableOpacity>)}</View><Btn title="Record consent granted" onPress={saveConsent}/>{consents.map(c=><RecordRow key={c.id} title={label(c.purpose)} subtitle={`${c.language||'en'} · ${c.created_at?new Date(c.created_at).toLocaleDateString():''}`} status={c.granted?'Granted':'Not granted'}/>)}</Section>}
    {detailTab==='Screenings'&&<Section title="Screening records"><Btn title="+ Start new oral screening" onPress={()=>{setScreen({symptoms:selected.symptoms||'',duration:'',tobacco:selected.tobacco_use||'',exam_notes:''});setPage('Screening workflow');setScreeningId('');setScreenDetail(null);setActiveImage(null);}}/>{patientScreenings.map(r=><TouchableOpacity key={r.id} onPress={()=>openScreening(r.id)}><RecordRow title={`Screening ${r.id.slice(0,8)}`} subtitle={r.created_at?new Date(r.created_at).toLocaleString():''} status={r.status}/></TouchableOpacity>)}{!patientScreenings.length&&<Empty text="No screening records for this patient."/>}</Section>}
    {detailTab==='Timeline'&&<Section title="Patient care timeline">{timeline.map((e,i)=><RecordRow key={`${e.type}-${i}`} title={e.summary} subtitle={`${label(e.type)} · ${new Date(e.at).toLocaleString()}`} status={e.type}/>)}</Section>}
   </>}

   {page==='Screening workflow'&&<>
    {!screeningId?<><Text style={s.help}>Select a patient from Patients, open their record and start a screening.</Text><Btn title="Go to patients" onPress={()=>setPage('Patients')}/><Field label="Symptoms" value={screen.symptoms} onChangeText={v=>setScreen({...screen,symptoms:v})} multiline/><Field label="Duration" value={screen.duration} onChangeText={v=>setScreen({...screen,duration:v})}/><Field label="Tobacco use" value={screen.tobacco} onChangeText={v=>setScreen({...screen,tobacco:v})}/><Field label="Examination notes" value={screen.exam_notes} onChangeText={v=>setScreen({...screen,exam_notes:v})} multiline/><Btn title="Create screening" onPress={startScreening}/></>:<>
     <Text style={s.help}>Screening ID: {screeningId}</Text>
     <Field label="Symptoms" value={screen.symptoms} onChangeText={v=>setScreen({...screen,symptoms:v})} multiline/>
     <Field label="Duration" value={screen.duration} onChangeText={v=>setScreen({...screen,duration:v})}/>
     <Field label="Tobacco use" value={screen.tobacco} onChangeText={v=>setScreen({...screen,tobacco:v})}/>
     <Field label="Examination notes" value={screen.exam_notes} onChangeText={v=>setScreen({...screen,exam_notes:v})} multiline/>
     <Section title="Oral photograph"><Text style={s.help}>Imaging consent is required. Select the anatomical view, then capture a new photo or choose one from the device.</Text><View style={s.chips}>{['cheek','tongue','gum','other'].map(v=><TouchableOpacity key={v} onPress={()=>setView(v)} style={[s.chip,view===v&&s.chipOn]}><Text style={view===v?s.chipTextOn:s.chipText}>{label(v)}</Text></TouchableOpacity>)}</View>
      <View style={s.actionGrid}><Btn title="Take photo" onPress={()=>choosePhoto(true)}/><Btn title="Choose photo" secondary onPress={()=>choosePhoto(false)}/></View>
      {!!activeImage&&<RecordRow title="Latest uploaded photo" subtitle={`Image ${activeImage.id?.slice(0,8)} · ${label(activeImage.quality_status)}`} status="Uploaded"/>}
      {screenDetail?.images?.map(im=><RecordRow key={im.id} title={`Image · ${label(im.view)}`} subtitle={label(im.quality_reason)} status={im.quality_status}/>)}
      <Btn title="Run AI image assessment" onPress={runAnalysis} disabled={!activeImage?.id||busy}/>
     </Section>
     <Section title="AI assessment results">{(screenDetail?.ai_analyses||[]).map(a=><AIAssessment key={a.id} analysis={a} audience="worker"/>)}{!screenDetail?.ai_analyses?.length&&<Empty text="No AI analysis yet."/>}</Section>
     <Btn title="Back to patient details" secondary onPress={()=>selected?setPage('Patient details'):setPage('Patients')}/>
    </>}
   </>}

   {page==='Screenings'&&<>
    {data.screenings.map((r,i)=><TouchableOpacity key={r.id||i} onPress={()=>openScreening(r.id)}><RecordRow title={r.patient_name||'Screening'} subtitle={[r.village,r.created_at&&new Date(r.created_at).toLocaleString()].filter(Boolean).join(' · ')} status={r.status}/></TouchableOpacity>)}
    {!data.screenings.length&&<Empty text="No screenings found."/>}
   </>}

   {page==='Appointments'&&<>
    <Text style={s.help}>Appointments linked to your facility. Health Workers can view and join active video consultations; scheduling and clinical decisions are handled by the appropriate care team.</Text>
    {data.appointments.map((a,i)=><View key={a.id||i} style={s.appointment}><Text style={s.cardTitle}>{a.kind==='video'?'Video consultation':'Hospital visit'}</Text><Text style={s.help}>{a.patient_name||'Patient'} · {a.slot?new Date(a.slot).toLocaleString():''}</Text><Text style={s.help}>{a.hospital_name||a.facility||''} · {a.specialist_name||'Specialist not assigned'}</Text><Text style={s.status}>{label(a.status)}{a.approval_status?` · ${label(a.approval_status)}`:''}</Text>{a.kind==='video'&&a.status!=='CANCELLED'&&<Btn title="Join video consultation" onPress={()=>joinVideo(a.id)}/>}</View>)}
    {!data.appointments.length&&<Empty text="No appointments available."/>}
   </>}

   {page==='Notifications'&&<>
    <Text style={s.help}>In-app alerts are shown here while the app is open. Remote push delivery requires push-token registration and a server push sender.</Text>
    {(data.notifications||[]).map(n=><TouchableOpacity key={n.id} style={[s.noticeCard,!n.read&&s.unread]} onPress={()=>onReadNotification(n)}><Text style={s.cardTitle}>{n.title}</Text><Text style={s.help}>{n.body}</Text><Text style={s.meta}>{n.created_at?new Date(n.created_at).toLocaleString():''} · {n.read?'Read':'Unread'}</Text>{n.kind==='meet'&&<Text style={s.status}>Video-call notification</Text>}</TouchableOpacity>)}
    {!data.notifications.length&&<Empty text="You're all caught up."/>}
   </>}

   {page==='Offline sync'&&<><Text style={s.help}>Offline drafts are stored on this device and submitted when a connection is available. Review pending items before syncing.</Text><Text style={s.offlineCount}>Pending sync items: {offlineN}</Text><Btn title="Sync now" onPress={sync}/></>}
  </ScrollView>
  {drawerOpen&&<View style={s.drawerLayer}>
   <Pressable accessibilityRole="button" accessibilityLabel="Close navigation menu" style={s.drawerBackdrop} onPress={()=>setDrawerOpen(false)}/>
   <View style={s.drawer}>
    <View style={s.drawerTop}>
     <View style={s.drawerBrandMark}><Text style={s.drawerBrandMarkText}>A</Text></View>
     <View style={{flex:1}}><Text style={s.drawerBrand}>Aarogya Drishti</Text><Text style={s.drawerCaption}>HEALTH WORKER PORTAL</Text></View>
     <TouchableOpacity accessibilityRole="button" accessibilityLabel="Close menu" onPress={()=>setDrawerOpen(false)} style={s.closeDrawer}><Text style={s.closeDrawerText}>×</Text></TouchableOpacity>
    </View>
    <Text style={s.drawerSection}>WORKSPACE</Text>
    <ScrollView showsVerticalScrollIndicator={false}>
     {tabs.map(item=><TouchableOpacity key={item.name} accessibilityRole="button" onPress={()=>navigate(item.name)} style={[s.drawerItem,page===item.name&&s.drawerItemActive]}>
      <Text style={[s.drawerItemIcon,page===item.name&&s.drawerItemIconActive]}>{item.icon}</Text>
      <View style={{flex:1}}><Text style={[s.drawerItemText,page===item.name&&s.drawerItemTextActive]}>{item.name}</Text><Text style={s.drawerItemHint}>{item.hint}</Text></View>
      {item.name==='Notifications'&&unread>0?<View style={s.unreadBadge}><Text style={s.unreadBadgeText}>{unread}</Text></View>:null}
      {page===item.name?<View style={s.activeRail}/>:null}
     </TouchableOpacity>)}
    </ScrollView>
    <View style={s.drawerFooter}>
     <View style={s.avatar}><Text style={s.avatarText}>{(user.full_name||user.email||'H').trim().charAt(0).toUpperCase()}</Text></View>
     <View style={{flex:1}}><Text numberOfLines={1} style={s.drawerUserName}>{user.full_name||'Health Worker'}</Text><Text numberOfLines={1} style={s.drawerUserRole}>{user.assigned_facility||user.email||'Health Worker'}</Text></View>
    </View>
    <TouchableOpacity style={s.logoutRow} onPress={()=>{setDrawerOpen(false);Alert.alert('Log out','Are you sure you want to log out?',[{text:'Cancel',style:'cancel'},{text:'Log out',style:'destructive',onPress:onLogout}]);}}><Text style={s.logoutRowText}>↪  Log out</Text></TouchableOpacity>
   </View>
  </View>}
 </View>;
}

const s=StyleSheet.create({
 root:{flex:1,backgroundColor:'#f3f7f6'},header:{backgroundColor:'#0d5d54',paddingHorizontal:16,paddingTop:12,paddingBottom:16,flexDirection:'row',alignItems:'center',gap:12},menuButton:{width:40,height:40,borderRadius:12,backgroundColor:'#ffffff20',alignItems:'center',justifyContent:'center'},menuIcon:{fontSize:22,color:'#fff',fontWeight:'800'},brand:{fontSize:20,fontWeight:'900',color:'#fff'},welcome:{fontSize:13,color:'#d5eeea',marginTop:3},user:{fontSize:11,color:'#c0dfd9',marginTop:5},refresh:{padding:9,backgroundColor:'#ffffff22',borderRadius:10},refreshText:{color:'#fff',fontSize:23},content:{flex:1,padding:15},heading:{fontSize:22,fontWeight:'900',color:'#173c38',marginBottom:12},section:{fontSize:15,fontWeight:'800',color:'#24443e',marginBottom:10},sectionWrap:{marginTop:18},metrics:{flexDirection:'row',flexWrap:'wrap',justifyContent:'space-between'},empty:{color:'#82928e',textAlign:'center',padding:20,fontSize:13},error:{color:'#b42318',backgroundColor:'#fff0ee',padding:10,borderRadius:9,marginBottom:10},notice:{color:'#155e50',backgroundColor:'#e4f4ee',padding:10,borderRadius:9,marginBottom:10,fontSize:12},field:{marginBottom:12},label:{fontSize:12,fontWeight:'800',color:'#36534d',marginBottom:5},input:{backgroundColor:'#fff',borderWidth:1,borderColor:'#d8e4e1',borderRadius:10,paddingHorizontal:12,paddingVertical:11,color:'#173c38',fontSize:14},multiline:{minHeight:75,textAlignVertical:'top'},button:{backgroundColor:'#0d7669',padding:13,borderRadius:10,alignItems:'center',marginBottom:9,flexGrow:1},buttonText:{color:'#fff',fontWeight:'800',fontSize:13},secondary:{backgroundColor:'#e8f3f0'},secondaryText:{color:'#0d7669'},actionGrid:{flexDirection:'row',flexWrap:'wrap',gap:8},help:{fontSize:12,color:'#6f817c',lineHeight:18,marginBottom:12},chips:{flexDirection:'row',flexWrap:'wrap',gap:7,marginBottom:12},chip:{borderWidth:1,borderColor:'#d7e5e1',paddingHorizontal:12,paddingVertical:8,borderRadius:20,backgroundColor:'#fff'},chipOn:{backgroundColor:'#0d7669',borderColor:'#0d7669'},chipText:{fontSize:12,color:'#46615b'},chipTextOn:{fontSize:12,color:'#fff',fontWeight:'800'},profile:{backgroundColor:'#fff',padding:15,borderRadius:13,marginBottom:12},profileName:{fontSize:20,fontWeight:'900',color:'#173c38'},detailLine:{fontSize:13,color:'#46615b',paddingVertical:5,borderBottomWidth:1,borderBottomColor:'#eef2f1'},result:{backgroundColor:'#fff',borderRadius:12,padding:13,marginBottom:9,borderWidth:1,borderColor:'#e3ece9'},resultTitle:{fontSize:14,fontWeight:'800',color:'#173c38'},warning:{fontSize:11,color:'#9a5a12',marginTop:8,lineHeight:16},appointment:{backgroundColor:'#fff',borderRadius:12,padding:13,marginBottom:10,borderWidth:1,borderColor:'#e3ece9'},cardTitle:{fontSize:14,fontWeight:'800',color:'#173c38'},status:{fontSize:11,color:'#0d7669',fontWeight:'800',marginTop:6},meta:{fontSize:10,color:'#8a9995',marginTop:7},noticeCard:{backgroundColor:'#fff',padding:13,borderRadius:12,marginBottom:9,borderWidth:1,borderColor:'#e3ece9'},unread:{borderColor:'#0d7669',borderLeftWidth:4},offlineCount:{fontSize:18,fontWeight:'900',color:'#0d7669',marginVertical:15},drawerLayer:{...StyleSheet.absoluteFillObject,zIndex:20,flexDirection:'row'},drawerBackdrop:{...StyleSheet.absoluteFillObject,backgroundColor:'rgba(8,28,25,0.48)'},drawer:{width:Math.min(Dimensions.get('window').width*0.82,310),maxWidth:310,height:'100%',backgroundColor:'#fff',paddingTop:14,paddingHorizontal:14,paddingBottom:18,elevation:18,shadowColor:'#000',shadowOpacity:.2,shadowRadius:14,shadowOffset:{width:4,height:0}},drawerTop:{flexDirection:'row',alignItems:'center',gap:10,paddingVertical:14,paddingHorizontal:4,borderBottomWidth:1,borderBottomColor:'#edf2f0',marginBottom:18},drawerBrandMark:{width:40,height:40,borderRadius:13,backgroundColor:'#0d7669',alignItems:'center',justifyContent:'center'},drawerBrandMarkText:{fontSize:21,fontWeight:'900',color:'#fff'},drawerBrand:{fontSize:15,fontWeight:'900',color:'#173c38'},drawerCaption:{fontSize:9,fontWeight:'800',letterSpacing:1.1,color:'#82928e',marginTop:3},closeDrawer:{width:32,height:32,borderRadius:9,backgroundColor:'#f1f6f4',alignItems:'center',justifyContent:'center'},closeDrawerText:{fontSize:24,color:'#526b66',lineHeight:27},drawerSection:{fontSize:10,fontWeight:'900',letterSpacing:1.3,color:'#98a7a2',marginHorizontal:8,marginBottom:9},drawerItem:{minHeight:59,borderRadius:12,paddingHorizontal:10,marginBottom:5,flexDirection:'row',alignItems:'center',gap:11,overflow:'hidden'},drawerItemActive:{backgroundColor:'#eaf5f2'},drawerItemIcon:{width:32,height:32,borderRadius:10,backgroundColor:'#f3f7f6',textAlign:'center',textAlignVertical:'center',overflow:'hidden',fontSize:18,color:'#61766f'},drawerItemIconActive:{backgroundColor:'#d4ebe4',color:'#0d7669'},drawerItemText:{fontSize:13,fontWeight:'800',color:'#415b54'},drawerItemTextActive:{color:'#0d7669'},drawerItemHint:{fontSize:10,color:'#899994',marginTop:3},activeRail:{position:'absolute',right:0,top:10,bottom:10,width:3,borderRadius:3,backgroundColor:'#0d7669'},unreadBadge:{backgroundColor:'#d94b42',borderRadius:10,minWidth:20,paddingHorizontal:6,paddingVertical:3,alignItems:'center'},unreadBadgeText:{fontSize:10,fontWeight:'900',color:'#fff'},drawerFooter:{flexDirection:'row',alignItems:'center',gap:9,borderTopWidth:1,borderTopColor:'#edf2f0',paddingTop:14,marginTop:10},avatar:{width:34,height:34,borderRadius:17,backgroundColor:'#dcefe9',alignItems:'center',justifyContent:'center'},avatarText:{fontWeight:'900',color:'#0d7669'},drawerUserName:{fontSize:12,fontWeight:'800',color:'#24443e'},drawerUserRole:{fontSize:10,color:'#82928e',marginTop:2},logoutRow:{marginTop:12,paddingVertical:11,paddingHorizontal:12,borderRadius:10,backgroundColor:'#fff3f1'},logoutRowText:{fontSize:12,fontWeight:'800',color:'#b42318'}
});
