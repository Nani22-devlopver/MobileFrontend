import {useCallback, useEffect, useState} from 'react';
import {getPatients, getScreenings, getAppointments, getNotifications} from '../api/endpoints';

const asArray=value=>Array.isArray(value)?value:(value?.items||value?.data||[]);

export default function useHealthWorkerData(enabled=false){
 const [data,setData]=useState({patients:[],screenings:[],appointments:[],notifications:[]});
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState('');
 const refresh=useCallback(async()=>{
  if(!enabled)return;
  setLoading(true);setError('');
  const results=await Promise.allSettled([getPatients(),getScreenings(),getAppointments(),getNotifications()]);
  const keys=['patients','screenings','appointments','notifications'];
  const failures=[];
  results.forEach((result,index)=>{if(result.status==='rejected')failures.push(`${keys[index]}: ${result.reason?.message||'Request failed'}`);});
  setData(previous=>{
   const next={...previous};
   results.forEach((result,index)=>{if(result.status==='fulfilled')next[keys[index]]=asArray(result.value);});
   return next;
  });
  setError(failures.join('\n'));
  setLoading(false);
 },[enabled]);
 useEffect(()=>{if(enabled)refresh();},[enabled,refresh]);
 return {...data,loading,error,refresh};
}
