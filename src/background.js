import * as TaskManager from 'expo-task-manager';
import * as BackgroundFetch from 'expo-background-fetch';
import {syncOutbox} from './offline';
export const SYNC_TASK='aarogya-background-sync';
TaskManager.defineTask(SYNC_TASK,async()=>{
 try{const r=await syncOutbox();return r.offline?BackgroundFetch.BackgroundFetchResult.NoData:BackgroundFetch.BackgroundFetchResult.NewData;}
 catch{return BackgroundFetch.BackgroundFetchResult.Failed;}
});
export async function registerBackgroundSync(){
 try{await BackgroundFetch.registerTaskAsync(SYNC_TASK,{minimumInterval:15*60,stopOnTerminate:false,startOnBoot:true});}catch(e){console.warn('Background sync registration:',e.message);}
}
