import React, {useState} from 'react';
import PrefBar from './components/PrefBar';
import {View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert, Pressable} from './rn';

// Common slide-out drawer layout used by every role workspace (Specialist, Navigator, Admin, Super admin).
export default function Shell({user, roleLabel, items, page, setPage, onLogout, unread = 0, onRefresh, children}) {
  const [drawer, setDrawer] = useState(false);
  const go = p => { setPage(p); setDrawer(false); };
  return (
    <View style={s.root}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => setDrawer(true)} style={s.menu}><Text style={s.menuText}>☰</Text></TouchableOpacity>
        <View style={{flex: 1}}><Text style={s.brand}>Aarogya Drishti</Text><Text style={s.sub} numberOfLines={1}>{roleLabel} · {page}</Text></View>
        {!!onRefresh && <TouchableOpacity onPress={onRefresh} style={s.menu}><Text style={s.menuText}>↻</Text></TouchableOpacity>}
      </View>
      <ScrollView style={s.content} contentContainerStyle={{paddingBottom: 40}} keyboardShouldPersistTaps="handled">
        <Text style={s.heading}>{page}</Text>
        {children}
      </ScrollView>
      {drawer && <View style={s.drawerLayer}>
        <Pressable style={s.backdrop} onPress={() => setDrawer(false)} />
        <View style={s.drawer}>
          <View style={s.drawerHead}><Text style={s.brandDark}>Aarogya Drishti</Text><TouchableOpacity onPress={() => setDrawer(false)}><Text style={s.close}>×</Text></TouchableOpacity></View>
          <Text style={s.role}>{String(roleLabel).toUpperCase()}</Text>
          <PrefBar />
          <ScrollView>
            {items.map(([n, d]) => (
              <TouchableOpacity key={n} onPress={() => go(n)} style={[s.navItem, page === n && s.navOn]}>
                <View style={{flex: 1}}><Text style={[s.navTitle, page === n && s.navTitleOn]}>{n}</Text><Text style={s.muted}>{d}</Text></View>
                {n === 'Notifications' && unread > 0 && <Text style={s.badge}>{unread}</Text>}
              </TouchableOpacity>
            ))}
          </ScrollView>
          <View style={s.user}><Text style={s.rowTitle}>{user.full_name || user.email}</Text><Text style={s.muted}>{[user.specialty, user.assigned_facility, user.mandal, user.district].filter(Boolean).join(' · ') || user.email}</Text></View>
          <TouchableOpacity style={s.logout} onPress={() => { setDrawer(false); Alert.alert('Log out', 'Are you sure?', [{text: 'Cancel', style: 'cancel'}, {text: 'Log out', style: 'destructive', onPress: onLogout}]); }}><Text style={s.logoutText}>Log out</Text></TouchableOpacity>
        </View>
      </View>}
    </View>
  );
}

const s = StyleSheet.create({
  root: {flex: 1, backgroundColor: '#f3f7f6'},
  header: {backgroundColor: '#0d5d54', padding: 12, flexDirection: 'row', alignItems: 'center', gap: 11},
  menu: {width: 40, height: 40, borderRadius: 11, backgroundColor: '#ffffff22', alignItems: 'center', justifyContent: 'center'},
  menuText: {color: '#fff', fontSize: 22, fontWeight: '900'}, brand: {fontSize: 18, fontWeight: '900', color: '#fff'}, sub: {fontSize: 10, color: '#d5eeea', marginTop: 3},
  content: {flex: 1, padding: 15}, heading: {fontSize: 23, fontWeight: '900', color: '#173c38', marginBottom: 12},
  drawerLayer: {position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, flexDirection: 'row', zIndex: 20},
  backdrop: {position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, backgroundColor: '#00000066'},
  drawer: {width: '82%', maxWidth: 340, backgroundColor: '#fff', padding: 16, paddingTop: 16},
  drawerHead: {flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between'}, brandDark: {fontSize: 19, fontWeight: '900', color: '#0d5d54'}, close: {fontSize: 30, color: '#52716a'},
  role: {fontSize: 10, fontWeight: '900', color: '#71827e', marginVertical: 12, letterSpacing: 1},
  navItem: {padding: 12, borderRadius: 11, marginBottom: 4, flexDirection: 'row', alignItems: 'center'}, navOn: {backgroundColor: '#e8f3f0'},
  navTitle: {fontSize: 14, fontWeight: '800', color: '#35524c'}, navTitleOn: {color: '#0d5d54'}, muted: {fontSize: 11, color: '#71827e', marginTop: 3},
  badge: {backgroundColor: '#b42318', color: '#fff', fontSize: 11, fontWeight: '800', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 10, overflow: 'hidden'},
  user: {borderTopWidth: 1, borderTopColor: '#e3ece9', paddingTop: 12, marginTop: 8}, rowTitle: {fontSize: 14, fontWeight: '800', color: '#173c38'},
  logout: {backgroundColor: '#e8f3f0', padding: 12, borderRadius: 10, alignItems: 'center', marginTop: 10}, logoutText: {color: '#0d5d54', fontWeight: '800'},
});
