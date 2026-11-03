import React from 'react';
import {View, Text, TouchableOpacity, StyleSheet} from '../rn';
import {useTheme} from '../theme';
import {useLang} from '../i18n';

// Small language + theme switcher: English | తెలుగు  and  Auto / Light / Dark.
export default function PrefBar({onDark}) {
  const {lang, setLang} = useLang();
  const {pref, setPref} = useTheme();
  const next = {auto: 'light', light: 'dark', dark: 'auto'}[pref];
  const icon = {auto: '◐ Auto', light: '☀ Light', dark: '☾ Dark'}[pref];
  return (
    <View style={s.row}>
      <View style={[s.seg, onDark && s.segDark]}>
        {[['en', 'EN'], ['te', 'తెలుగు']].map(([k, l]) => <TouchableOpacity key={k} onPress={() => setLang(k)} style={[s.opt, lang === k && s.on]} accessibilityLabel={`Language ${l}`}><Text style={[s.txt, onDark && s.txtDark, lang === k && s.txtOn]}>{l}</Text></TouchableOpacity>)}
      </View>
      <TouchableOpacity onPress={() => setPref(next)} style={[s.seg, onDark && s.segDark, s.opt]} accessibilityLabel="Theme"><Text style={[s.txt, onDark && s.txtDark]}>{icon}</Text></TouchableOpacity>
    </View>
  );
}
const s = StyleSheet.create({
  row: {flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap'},
  seg: {flexDirection: 'row', borderWidth: 1, borderColor: '#d8e4e1', borderRadius: 18, overflow: 'hidden'}, segDark: {borderColor: '#ffffff66'},
  opt: {paddingHorizontal: 11, paddingVertical: 6}, on: {backgroundColor: '#0d7669'},
  txt: {fontSize: 12, fontWeight: '800', color: '#35524c'}, txtDark: {color: '#ffffff'}, txtOn: {color: '#ffffff'},
});
