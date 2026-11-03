import React from 'react';
import { View, Text, StyleSheet } from '../rn';
export default function MetricCard({ label, value, hint }) { return <View style={s.card}><Text style={s.value}>{value}</Text><Text style={s.label}>{label}</Text>{hint ? <Text style={s.hint}>{hint}</Text> : null}</View>; }
const s=StyleSheet.create({card:{backgroundColor:'#fff',borderRadius:15,padding:15,flex:1,minWidth:'45%',marginBottom:10,borderWidth:1,borderColor:'#e5eeeb'},value:{fontSize:26,fontWeight:'800',color:'#0d7669'},label:{fontSize:13,fontWeight:'700',color:'#24443e',marginTop:4},hint:{fontSize:11,color:'#71827e',marginTop:3}});
