// Drop-in replacement for 'react-native' used across the app. Same exports, except Text / TextInput / Alert
// which translate their strings (English -> Telugu) and get theme-aware default colours.
import React from 'react';
import {Text as RNText, TextInput as RNTextInput, Alert as RNAlert, StyleSheet as RNStyleSheet} from 'react-native';
import {tr} from './i18n';
import {palette, fontBoost, current, themed} from './theme';
export * from 'react-native';

const trChildren = c => (typeof c === 'string' ? tr(c) : Array.isArray(c) ? c.map(x => (typeof x === 'string' ? tr(x) : x)) : c);

const InText = React.createContext(false);
export const Text = React.forwardRef(({style, children, ...rest}, ref) => {
  const nested = React.useContext(InText);
  const flat = RNStyleSheet.flatten(style) || {};
  const base = {color: palette().text};
  const size = typeof flat.fontSize === 'number' ? null : {fontSize: fontBoost(14)};   // Text with no size set: a comfortable default
  const te = current().lang === 'te' && !flat.lineHeight ? {lineHeight: Math.round((flat.fontSize || fontBoost(14)) * 1.5)} : null;
  return <InText.Provider value><RNText ref={ref} {...rest} style={nested ? [style, te] : [base, size, style, te]}>{trChildren(children)}</RNText></InText.Provider>;
});

export const TextInput = React.forwardRef(({style, placeholder, ...rest}, ref) => {
  const p = palette();
  return <RNTextInput ref={ref} {...rest} placeholder={tr(placeholder)} placeholderTextColor={rest.placeholderTextColor || p.placeholder}
    style={[{color: p.text, fontSize: fontBoost(14), backgroundColor: p.card}, style]} />;
});

export const Alert = {
  ...RNAlert,
  alert: (title, message, buttons, opts) => RNAlert.alert(tr(title), typeof message === 'string' ? tr(message) : message, buttons?.map(b => ({...b, text: tr(b.text)})), opts),
};

// Every StyleSheet.create in the app goes through the theme mapper (dark mode + readable font sizes).
export const StyleSheet = {...RNStyleSheet, create: o => themed(RNStyleSheet.create(o))};
