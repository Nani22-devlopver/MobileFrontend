import React, {createContext, useContext, useEffect, useMemo, useState} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import TE from './te';
import {setLangForStyles} from './theme';

const LOWER = {}; Object.keys(TE).forEach(k => { LOWER[k.toLowerCase()] = TE[k]; });
let lang = 'en';
export const getLang = () => lang;

/** Translate one English UI string (exact match, case-insensitive). Unknown text is returned unchanged. */
export function tr(s) {
  if (lang === 'en' || typeof s !== 'string' || !s) return s;
  const t = s.trim(); if (!t) return s;
  const hit = TE[t] || LOWER[t.toLowerCase()] || LOWER[t.replaceAll('_', ' ').toLowerCase()];
  if (hit) return s.replace(t, hit);
  const star = t.match(/^(.*?)\s*\*$/); if (star) { const b = tr(star[1]); if (b !== star[1]) return s.replace(t, `${b} *`); }
  const par = t.match(/^(.*?)\s*\((.*)\)$/); if (par) { const a = tr(par[1]), b = tr(par[2]); if (a !== par[1] || b !== par[2]) return s.replace(t, `${a} (${b})`); }
  const dot = t.split(' · '); if (dot.length > 1) { const m = dot.map(tr); if (m.join() !== dot.join()) return s.replace(t, m.join(' · ')); }
  return s;
}

const Ctx = createContext({lang: 'en', setLang: () => {}, t: x => x});
export const useLang = () => useContext(Ctx);
export function I18nProvider({children}) {
  const [l, setL] = useState('en');
  useEffect(() => { AsyncStorage.getItem('pref_lang').then(v => { if (v) setL(v); }).catch(() => {}); }, []);
  lang = l; setLangForStyles(l);                    // set during render so children translate on the same pass
  const setLang = v => { setL(v); AsyncStorage.setItem('pref_lang', v).catch(() => {}); };
  const value = useMemo(() => ({lang: l, setLang, t: tr}), [l]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
