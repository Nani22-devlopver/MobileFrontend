import React from 'react';
import { View, Text, StyleSheet } from '../rn';
export default function RecordRow({ title, subtitle, status }) { return <View style={s.row}><View style={{flex:1}}><Text style={s.title}>{title}</Text>{!!subtitle && <Text style={s.sub}>{subtitle}</Text>}</View>{!!status && <Text style={s.status}>{String(status).replaceAll('_',' ')}</Text>}</View>; }
const s=StyleSheet.create({row:{backgroundColor:'#fff',padding:14,borderRadius:12,marginBottom:9,flexDirection:'row',alignItems:'center',borderWidth:1,borderColor:'#e7efed'},title:{fontSize:14,fontWeight:'700',color:'#1b3934'},sub:{fontSize:12,color:'#71827e',marginTop:4},status:{fontSize:10,fontWeight:'700',color:'#0d7669',backgroundColor:'#e8f5f1',padding:7,borderRadius:8,marginLeft:8}});
