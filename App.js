import React, {useEffect, useState, useCallback} from 'react';
import {View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, AppState, ScrollView, KeyboardAvoidingView, StatusBar} from './src/rn';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import * as Notifications from 'expo-notifications';
import NetInfo from '@react-native-community/netinfo';
import {api, session} from './src/api/client';
import {initOffline, queueCount, subscribeQueue, startAutoSync, clearCacheOnly} from './src/offline';
import {registerBackgroundSync} from './src/background';
import {getMe, markNotificationRead} from './src/api/endpoints';
import useHealthWorkerData from './src/hooks/useHealthWorkerData';
import HealthWorkerDashboard from './src/pages/HealthWorkerDashboard';
import MedicalOfficerDashboard from './src/pages/MedicalOfficerDashboard';
import RoleWorkspace from './src/pages/Workspaces';
import RegisterScreen from './src/pages/RegisterScreen';
import Screen from './src/Screen';
import PrefBar from './src/components/PrefBar';
import {ThemeProvider, useTheme} from './src/theme';
import {I18nProvider, useLang} from './src/i18n';

const ALLOWED = ['health_worker', 'medical_officer', 'navigator', 'specialist', 'admin', 'super_admin'];
// Suppress banners while the app is active; allow OS presentation only in background/closed state.
Notifications.setNotificationHandler({handleNotification: async () => ({
  shouldShowAlert: AppState.currentState !== 'active', shouldPlaySound: AppState.currentState !== 'active', shouldSetBadge: false,
})});

function App() {
  const {mode, c} = useTheme();
  const {t} = useLang();
  const [user, setUser] = useState(null), [email, setEmail] = useState(''), [password, setPassword] = useState(''), [showPw, setShowPw] = useState(false);
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [online, setOnline] = useState(true), [page, setPage] = useState('Overview');
  const [authMode, setAuthMode] = useState('login'), [notice, setNotice] = useState(''), [pending, setPending] = useState(0), [prefs, setPrefs] = useState(false), [booting, setBooting] = useState(true);
  const data = useHealthWorkerData(!!user && user.role === 'health_worker');

  useEffect(() => {
    let stopSync = () => {};
    (async () => {
      await initOffline(); await registerBackgroundSync();
      const s = await session.get();
      if (s.token) {
        try { const me = await getMe(); setUser(me); await session.set(s.token, me); }
        catch (e) {
          if (e.status === 401 || e.status === 403) await session.clear();   // token really rejected
          else if (s.user) setUser(s.user);                                    // offline / server down: stay signed in with the saved profile
        }
      }
      setBooting(false);
    })();
    const unNet = NetInfo.addEventListener(st => setOnline(!!st.isConnected && st.isInternetReachable !== false));
    const unQ = subscribeQueue(setPending);
    stopSync = startAutoSync(() => { data.refresh && data.refresh(); });      // auto-upload queued work when internet returns
    return () => { unNet(); unQ(); stopSync(); };
  }, []);
  useEffect(() => { if (user && !ALLOWED.includes(user.role)) { Alert.alert('Access restricted', 'This app supports Health Worker, Medical Officer, Navigator, Specialist, District Admin and Super Admin accounts only.'); logout(true); } }, [user]);
  useEffect(() => { if (!user) return; const sub = AppState.addEventListener('change', st => { if (st === 'active' && user.role === 'health_worker') data.refresh(); }); return () => sub.remove(); }, [user]);

  const login = async () => {
    setBusy(true); setError('');
    try {
      const d = await api('/auth/login', {method: 'POST', body: {email: email.trim(), password}});
      await session.set(d.token || d.access_token, d.user);
      if (!ALLOWED.includes(d.user?.role)) { await session.clear(); throw new Error('This app supports Health Worker, Medical Officer, Navigator, Specialist, District Admin and Super Admin accounts only.'); }
      setUser(d.user); setPassword('');
    } catch (e) { setError(e.network ? t('Cannot reach API') + ' — ' + t('Offline — showing last loaded data') : e.message); } finally { setBusy(false); }
  };
  const doLogout = async () => { await session.clear(); clearCacheOnly(); setUser(null); setPage('Overview'); setAuthMode('login'); };
  const logout = force => {
    if (force === true || !queueCount()) return doLogout();
    Alert.alert('Log out', `${queueCount()} item(s) are not synced yet. They stay on this device and upload after you sign in again with an internet connection.`, [{text: 'Cancel', style: 'cancel'}, {text: 'Log out', style: 'destructive', onPress: doLogout}]);
  };
  const readNotification = useCallback(async n => { try { await markNotificationRead(n.id); await data.refresh(); } catch (e) { Alert.alert('Could not update notification', e.message); } }, [data.refresh]);
  const bar = mode === 'dark' ? 'light-content' : 'light-content';

  if (booting) return <Screen bg={c.bg}><StatusBar barStyle={bar} /><ActivityIndicator style={{marginTop: 80}} size="large" color={c.brand} /></Screen>;
  if (!user && authMode === 'register') return <RegisterScreen onBack={() => setAuthMode('login')} onDone={em => { setEmail(em); setNotice('Registration submitted. An admin must approve it before you can sign in.'); }} />;

  if (!user) return (
    <Screen bg={c.brandDark}>
      <StatusBar barStyle="light-content" />
      <KeyboardAvoidingView style={{flex: 1}} behavior="padding">
        <ScrollView style={{flex: 1, backgroundColor: c.bg}} contentContainerStyle={{flexGrow: 1}} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
          <View style={s.hero}>
            <View style={{alignItems: 'flex-end', marginBottom: 10}}><PrefBar onDark /></View>
            <Text style={s.logo}>◉ Aarogya Drishti</Text>
            <Text style={s.sub}>Health Worker, Medical Officer, Navigator, Specialist and Admin workspace</Text>
          </View>
          <View style={s.panel}>
            <Text style={s.heading}>Sign in</Text>
            <TextInput style={s.input} autoCapitalize="none" autoCorrect={false} keyboardType="email-address" textContentType="username" autoComplete="email" placeholder="Email address" value={email} onChangeText={setEmail} />
            <View style={s.pwRow}>
              <TextInput style={[s.input, {flex: 1, marginBottom: 0, borderWidth: 0}]} placeholder="Password" secureTextEntry={!showPw} autoCapitalize="none" autoCorrect={false} textContentType="password" autoComplete="password" value={password} onChangeText={setPassword} onSubmitEditing={login} returnKeyType="go" />
              <TouchableOpacity onPress={() => setShowPw(!showPw)} style={s.eye} accessibilityLabel={showPw ? 'Hide' : 'Show'}><Text style={s.eyeText}>{showPw ? 'Hide' : 'Show'}</Text></TouchableOpacity>
            </View>
            <TouchableOpacity style={s.primary} onPress={login} disabled={busy}>{busy ? <ActivityIndicator color="#fff" /> : <Text style={s.primaryText}>Sign in</Text>}</TouchableOpacity>
            {!!error && <Text style={s.error}>{error}</Text>}
            {!!notice && <Text style={s.notice}>{notice}</Text>}
            <Text style={s.hint}>Sign in with your approved role account.</Text>
            <TouchableOpacity style={s.regBtn} onPress={() => { setError(''); setAuthMode('register'); }}><Text style={s.regText}>New here? Register</Text></TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );

  return (
    <Screen bg={c.brandDark}>
      <StatusBar barStyle="light-content" />
      <View style={{flex: 1, backgroundColor: c.bg}}>
        <View style={s.net}>
          <View style={s.netRow}>
            <View style={[s.dot, {backgroundColor: online ? '#15966b' : '#d97706'}]} />
            <Text style={s.netText} numberOfLines={2}>{online ? (pending ? 'Syncing…' : 'Connected to server') : 'Offline — showing last loaded data'}{pending ? `  ·  ${pending} ${t('pending')}` : ''}</Text>
            <TouchableOpacity onPress={() => setPrefs(!prefs)} style={s.gear} accessibilityLabel="Language and theme"><Text style={s.gearText}>⚙</Text></TouchableOpacity>
            <TouchableOpacity onPress={() => logout()}><Text style={s.logout}>Logout</Text></TouchableOpacity>
          </View>
          {prefs && <View style={{marginTop: 8}}><PrefBar /></View>}
        </View>
        {user.role === 'medical_officer' ? <MedicalOfficerDashboard user={user} onLogout={() => logout()} />
          : ['navigator', 'specialist', 'admin', 'super_admin'].includes(user.role) ? <RoleWorkspace user={user} onLogout={() => logout()} />
          : <HealthWorkerDashboard user={user} data={data} loading={data.loading} error={data.error} refresh={data.refresh} page={page} setPage={setPage} onReadNotification={readNotification} onLogout={() => logout()} />}
      </View>
    </Screen>
  );
}

export default function Root() {
  return <SafeAreaProvider><ThemeProvider><I18nProvider><App /></I18nProvider></ThemeProvider></SafeAreaProvider>;
}

const s = StyleSheet.create({
  hero: {backgroundColor: '#0d5d54', padding: 24, paddingTop: 18, borderBottomLeftRadius: 28, borderBottomRightRadius: 28},
  logo: {fontSize: 26, fontWeight: '900', color: '#fff'}, sub: {color: '#d5eeea', marginTop: 8, fontSize: 13, lineHeight: 19},
  panel: {margin: 18, marginTop: 24, backgroundColor: '#fff', padding: 20, borderRadius: 18, elevation: 2},
  heading: {fontSize: 22, fontWeight: '800', color: '#173c38', marginBottom: 14},
  input: {borderWidth: 1, borderColor: '#b9ccc8', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 13, marginBottom: 12, backgroundColor: '#fff', color: '#173c38', fontSize: 17, minHeight: 52},
  pwRow: {flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#b9ccc8', borderRadius: 12, marginBottom: 12, backgroundColor: '#fff', minHeight: 52},
  eye: {paddingHorizontal: 14, paddingVertical: 12}, eyeText: {color: '#0d7669', fontWeight: '900', fontSize: 14},
  primary: {backgroundColor: '#0d7669', padding: 15, borderRadius: 12, alignItems: 'center', marginTop: 5, minHeight: 50, justifyContent: 'center'}, primaryText: {color: '#fff', fontWeight: '800', fontSize: 16},
  hint: {color: '#71827e', fontSize: 12, marginTop: 14}, error: {color: '#b42318', marginTop: 12, fontSize: 13}, notice: {color: '#0d6b3d', marginTop: 12, fontSize: 13},
  regBtn: {alignSelf: 'center', marginTop: 16, paddingVertical: 9, paddingHorizontal: 18, borderRadius: 22, borderWidth: 1, borderColor: '#0d7669'}, regText: {color: '#0d7669', fontWeight: '800', fontSize: 13},
  net: {backgroundColor: '#fff', paddingHorizontal: 15, paddingVertical: 9}, netRow: {flexDirection: 'row', alignItems: 'center'},
  dot: {width: 9, height: 9, borderRadius: 5, marginRight: 8}, netText: {fontSize: 12, color: '#526b66', flex: 1},
  gear: {paddingHorizontal: 10, paddingVertical: 4}, gearText: {fontSize: 18, color: '#0d7669'}, logout: {color: '#0d7669', fontWeight: '800', fontSize: 13, paddingVertical: 4},
});
