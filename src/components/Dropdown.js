import React, {useMemo, useState} from 'react';
import {View, Text, TextInput, TouchableOpacity, Modal, FlatList, StyleSheet, Pressable} from '../rn';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {palette} from '../theme';
import {useLang} from '../i18n';

/**
 * Compact selectable list. Replaces rows of chips / long stacks of buttons that overlapped on small screens.
 * options: array of strings or [value, label]. Opens a bottom sheet with search (when > 7 items).
 */
export default function Dropdown({label, options = [], value, onChange, placeholder = 'Select', allowClear, searchable, disabled}) {
  const [open, setOpen] = useState(false), [q, setQ] = useState('');
  const insets = useSafeAreaInsets();
  const {t} = useLang();
  const items = useMemo(() => options.map(o => (Array.isArray(o) ? {k: o[0], l: String(o[1])} : {k: o, l: String(o).replaceAll('_', ' ').replace(/\b\w/g, c => c.toUpperCase())})), [options]);
  const sel = items.find(i => i.k === value);
  const showSearch = searchable ?? items.length > 7;
  const shown = items.filter(i => !q.trim() || t(i.l).toLowerCase().includes(q.trim().toLowerCase()) || i.l.toLowerCase().includes(q.trim().toLowerCase()));
  const pick = k => { onChange(k); setOpen(false); setQ(''); };
  return (
    <View style={{marginBottom: 6}}>
      {!!label && <Text style={s.label}>{label}</Text>}
      <TouchableOpacity disabled={disabled} onPress={() => setOpen(true)} style={[s.box, disabled && {opacity: .5}]} accessibilityRole="button">
        <Text style={[s.boxText, !sel && {color: palette().placeholder}]} numberOfLines={1}>{sel ? sel.l : placeholder}</Text>
        <Text style={s.caret}>▾</Text>
      </TouchableOpacity>
      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)} statusBarTranslucent navigationBarTranslucent>
        <Pressable style={s.backdrop} onPress={() => setOpen(false)} />
        <View style={[s.sheet, {paddingBottom: Math.max(insets.bottom, 12) + 12, maxHeight: '75%'}]}>
          <View style={s.grab} />
          <View style={s.head}><Text style={s.title} numberOfLines={1}>{label || placeholder}</Text><TouchableOpacity onPress={() => setOpen(false)}><Text style={s.close}>✕</Text></TouchableOpacity></View>
          {showSearch && <TextInput style={s.search} value={q} onChangeText={setQ} placeholder="Search…" autoCapitalize="none" />}
          <FlatList data={shown} keyExtractor={i => String(i.k)} keyboardShouldPersistTaps="handled"
            ListHeaderComponent={allowClear ? <TouchableOpacity style={s.item} onPress={() => pick('')}><Text style={s.muted}>— {t('Clear')} —</Text></TouchableOpacity> : null}
            ListEmptyComponent={<Text style={s.muted}>{t('No results')}</Text>}
            renderItem={({item}) => <TouchableOpacity style={[s.item, item.k === value && s.itemOn]} onPress={() => pick(item.k)}><Text style={[s.itemText, item.k === value && s.itemTextOn]}>{item.l}</Text>{item.k === value && <Text style={s.tick}>✓</Text>}</TouchableOpacity>} />
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  label: {fontSize: 11, fontWeight: '800', color: '#52716a', marginTop: 10, marginBottom: 5},
  box: {flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderWidth: 1, borderColor: '#d8e4e1', borderRadius: 10, paddingHorizontal: 12, minHeight: 46},
  boxText: {flex: 1, fontSize: 14, color: '#173c38'}, caret: {fontSize: 16, color: '#52716a', marginLeft: 8},
  backdrop: {flex: 1, backgroundColor: '#00000066'},
  sheet: {backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingHorizontal: 16, paddingTop: 8},
  grab: {alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: '#d8e4e1', marginBottom: 8},
  head: {flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8}, title: {flex: 1, fontSize: 16, fontWeight: '900', color: '#173c38'}, close: {fontSize: 20, color: '#52716a', padding: 6},
  search: {borderWidth: 1, borderColor: '#d8e4e1', borderRadius: 10, padding: 10, marginBottom: 8, backgroundColor: '#fff', color: '#173c38'},
  item: {flexDirection: 'row', alignItems: 'center', paddingVertical: 13, paddingHorizontal: 10, borderRadius: 10}, itemOn: {backgroundColor: '#e8f3f0'},
  itemText: {flex: 1, fontSize: 14, color: '#24443e'}, itemTextOn: {fontWeight: '900', color: '#0d5d54'}, tick: {color: '#0d7669', fontWeight: '900'},
  muted: {fontSize: 12, color: '#71827e', textAlign: 'center', padding: 12},
});
