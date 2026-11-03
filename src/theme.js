import React, {createContext, useContext, useEffect, useMemo, useState} from 'react';
import {Appearance, useColorScheme} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

/* Light / dark theme + readable text size.
 * Existing screens keep their StyleSheets: `themed(StyleSheet.create({...}))` returns a Proxy that re-maps colours for dark mode
 * and bumps small font sizes, so a colour change needs no per-screen work. */
export const PALETTES = {
  light: {bg: '#f3f7f6', card: '#ffffff', text: '#173c38', sub: '#52716a', border: '#d8e4e1', brand: '#0d7669', brandDark: '#0d5d54', tint: '#e8f3f0', danger: '#b42318', ok: '#0d6b3d', placeholder: '#8a9a96'},
  dark:  {bg: '#0e1514', card: '#18231f', text: '#e8f1ef', sub: '#9fb3ae', border: '#2d423e', brand: '#0d7669', brandDark: '#0a4a43', tint: '#243633', danger: '#ff9a90', ok: '#6fdca4', placeholder: '#7c908b'},
};
const cur = {mode: 'light', lang: 'en'};
export const current = () => cur;
export const palette = () => PALETTES[cur.mode];
export const fontBoost = f => (f <= 16 ? Math.round(f * 1.15 * 2) / 2 : Math.round(f * 1.08));

const hex = h => { h = String(h); if (!/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(h)) return null; if (h.length === 4) h = '#' + [...h.slice(1)].map(c => c + c).join(''); return [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16)); };
const lum = ([r, g, b]) => (0.299 * r + 0.587 * g + 0.114 * b) / 255;
function darkBg(v) {
  const c = hex(v); if (!c) return v; const [r, g, b] = c, l = lum(c);
  if (v.toLowerCase() === '#f3f7f6') return PALETTES.dark.bg;
  if (l >= 0.93) return PALETTES.dark.card;
  if (l >= 0.6) { if (r > g + 8 && r > b + 8 && r - b > 20 && g > b + 25) return '#3a3012'; if (r > g + 8 && r > b + 8) return '#3b1f1d'; return PALETTES.dark.tint; }
  return v;
}
function darkText(v) {
  const c = hex(v); if (!c) return v; const [r, g, b] = c, l = lum(c);
  if (l > 0.75) return v;
  if (r > g + 60 && r > b + 60 && g < 120) return PALETTES.dark.danger;
  if (r > b + 60 && g > b + 30) return '#f5c26b';
  if (g - r > 45) return g - r > 90 && l > 0.3 && b < g - 30 && r < 60 && g < 0x80 && b < 0x50 ? PALETTES.dark.ok : '#58d3c2';
  return l < 0.35 ? PALETTES.dark.text : PALETTES.dark.sub;
}
const darkBorder = v => { const c = hex(v); return c && lum(c) > 0.7 ? PALETTES.dark.border : v; };

const cache = new Map();
function mapStyle(style, key) {
  const ck = `${cur.mode}|${cur.lang}|${key}`;
  let perSheet = cache.get(style); if (!perSheet) { perSheet = new Map(); cache.set(style, perSheet); }
  if (perSheet.has(ck)) return perSheet.get(ck);
  const out = {...style};
  if (cur.mode === 'dark') {
    for (const k of Object.keys(out)) {
      const v = out[k]; if (typeof v !== 'string') continue;
      if (k === 'backgroundColor') out[k] = darkBg(v);
      else if (k === 'color' || k === 'tintColor') out[k] = darkText(v);
      else if (/^border.*Color$/.test(k)) out[k] = darkBorder(v);
    }
  }
  if (typeof out.fontSize === 'number') {
    const f = out.fontSize; out.fontSize = fontBoost(f);
    if (typeof out.lineHeight === 'number') out.lineHeight = Math.round(out.lineHeight * out.fontSize / f);
    else if (cur.lang === 'te') out.lineHeight = Math.round(out.fontSize * 1.5);   // Telugu glyphs need more vertical room
  }
  if (/input|multiline|field/i.test(key) && out.color === undefined && (out.borderWidth || out.minHeight)) { out.color = palette().text; if (!out.fontSize) out.fontSize = 15; }
  perSheet.set(ck, out);
  return out;
}
export const themed = sheet => new Proxy(sheet, {get: (t, k) => (typeof k === 'string' && t[k] && typeof t[k] === 'object' ? mapStyle(t[k], k) : t[k])});

const Ctx = createContext({mode: 'light', pref: 'auto', setPref: () => {}, c: PALETTES.light});
export const useTheme = () => useContext(Ctx);
export function ThemeProvider({children}) {
  const sys = useColorScheme();
  const [pref, setPrefState] = useState('auto');
  useEffect(() => { AsyncStorage.getItem('pref_theme').then(v => v && setPrefState(v)).catch(() => {}); }, []);
  const mode = pref === 'auto' ? (sys === 'dark' ? 'dark' : 'light') : pref;
  cur.mode = mode;                                  // set during render so every child below reads the new mode
  useEffect(() => { Appearance.setColorScheme?.(pref === 'auto' ? null : pref); }, [pref]);   // native dialogs / keyboard follow too
  const setPref = v => { setPrefState(v); AsyncStorage.setItem('pref_theme', v).catch(() => {}); };
  const value = useMemo(() => ({mode, pref, setPref, c: PALETTES[mode]}), [mode, pref]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
export const setLangForStyles = l => { cur.lang = l; };

// For the few inline style={{...}} objects: same dark-mode / font mapping as StyleSheet.create.
export const dyn = o => mapStyle(o, JSON.stringify(o));
