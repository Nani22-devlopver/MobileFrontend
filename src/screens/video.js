import {Alert, Linking} from '../rn';
import {api} from '../api/client';
// Opens the Google Meet link of a video appointment (specialists, health workers and medical officers).
export async function joinVideo(id) {
  try {
    const info = await api(`/appointments/${encodeURIComponent(id)}/video`);
    if (!info?.url) throw new Error('No Google Meet link has been added yet.');
    await Linking.openURL(info.url);
  } catch (e) { Alert.alert('Cannot join call', e.message); }
}
export const openMeetNew = () => Linking.openURL('https://meet.new').catch(() => {});
