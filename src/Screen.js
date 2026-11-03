import React from 'react';
import {View} from './rn';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {palette} from './theme';

// Keeps everything inside the safe area and adds a small extra margin so nothing sits under the status bar,
// the notch / camera cut-out, or the gesture / navigation bar at the bottom.
export const EXTRA_TOP = 6, EXTRA_BOTTOM = 14;
export default function Screen({children, style, bg}) {
  const i = useSafeAreaInsets();
  return <View style={[{flex: 1, backgroundColor: bg || palette().bg, paddingTop: i.top + EXTRA_TOP, paddingBottom: i.bottom + EXTRA_BOTTOM, paddingLeft: i.left, paddingRight: i.right}, style]}>{children}</View>;
}
