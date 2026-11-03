import React, {useState} from 'react';
import {View, Text, TouchableOpacity, StyleSheet} from '../rn';
import {useLang} from '../i18n';

// Parse whatever the backend stored: object, JSON string, or plain text.
export function parseFeedback(v) {
  if (!v) return null;
  if (typeof v === 'string') { try { return parseFeedback(JSON.parse(v)); } catch { return {analysis: v}; } }
  return typeof v === 'object' ? v : null;
}
const list = v => (Array.isArray(v) ? v : v ? [v] : []).map(x => String(x)).filter(Boolean);
const URG = {urgent: '#b42318', soon: '#b45309', routine: '#0d6b3d'};

/**
 * Readable AI result for phones. The backend (ollama_adapter.py) returns English plus `feedback.translations.te`;
 * this card shows Telugu when the app language is Telugu (falling back to English per field).
 * audience: 'worker' (field health worker) or 'clinician' (medical officer) decides which professional blocks show.
 */
export default function AIAssessment({analysis, audience = 'worker'}) {
  const {lang, t} = useLang();
  const [more, setMore] = useState(false);
  const fb = parseFeedback(analysis?.feedback);
  const te = lang === 'te' ? (fb?.translations?.te || {}) : {};
  const pick = k => (te[k] !== undefined && te[k] !== '' && !(Array.isArray(te[k]) && !te[k].length) ? te[k] : fb?.[k]);
  const cond = fb?.predicted_condition || {}, teCond = te.predicted_condition || {};
  const name = teCond.name || cond.name;
  const others = list(teCond.other_possibilities?.length ? teCond.other_possibilities : cond.other_possibilities);
  const issues = list(te.image_assessment?.issues?.length ? te.image_assessment.issues : fb?.image_assessment?.issues);
  const pm = fb?.patient_message; const pmText = lang === 'te' ? (te.patient_message || pm?.te || pm?.en) : (typeof pm === 'string' ? pm : pm?.en);
  const urgency = fb?.suggested_urgency;

  return (
    <View style={s.card}>
      <View style={s.top}>
        <Text style={s.kind}>{t('AI assessment')}</Text>
        {!!urgency && <Text style={[s.badge, {backgroundColor: URG[urgency] || '#52716a'}]}>{t(urgency[0].toUpperCase() + urgency.slice(1))}</Text>}
      </View>
      <Text style={s.warn}>{t('NOT FOR CLINICAL USE. This research aid is not a diagnosis. A qualified clinician must review the patient.')}</Text>

      {!fb && <Text style={s.p}>{t(analysis?.status === 'image_insufficient' ? 'Photo issues' : 'No AI analysis yet.')}</Text>}

      {!!name && <><Text style={s.h}>{t('Likely condition')}</Text><Text style={s.cond}>{name}</Text>
        {!!cond.likelihood && <Text style={s.meta}>{t('Likelihood')}: {t(cond.likelihood[0].toUpperCase() + cond.likelihood.slice(1))}{fb?.confidence ? `  ·  ${t('Confidence')}: ${t(fb.confidence[0].toUpperCase() + fb.confidence.slice(1))}` : ''}</Text>}</>}
      {!!others.length && <><Text style={s.h}>{t('Other possibilities')}</Text>{others.map((x, i) => <Text key={i} style={s.p}>• {x}</Text>)}</>}
      {!!issues.length && <><Text style={s.h}>{t('Photo issues')}</Text>{issues.map((x, i) => <Text key={i} style={s.p}>• {x}</Text>)}</>}
      {!!list(pick('recapture_tips')).length && <><Text style={s.h}>{t('Photo tips')}</Text>{list(pick('recapture_tips')).map((x, i) => <Text key={i} style={s.p}>• {x}</Text>)}</>}
      {!!pick('consult_advice') && <><Text style={s.h}>{t('See a doctor')}</Text><Text style={s.p}>{pick('consult_advice')}</Text></>}
      {!!pmText && <View style={s.msg}><Text style={s.h2}>{t('Message for the patient')}</Text><Text style={s.p}>{pmText}</Text></View>}

      {more && <>
        {!!pick('analysis') && <><Text style={s.h}>{t('Analysis')}</Text><Text style={s.p}>{pick('analysis')}</Text></>}
        {audience === 'clinician' && !!pick('clinician_summary') && <><Text style={s.h}>{t('Note for the doctor')}</Text><Text style={s.p}>{pick('clinician_summary')}</Text></>}
        {!!list(pick('health_suggestions')).length && <><Text style={s.h}>{t('Health suggestions')}</Text>{list(pick('health_suggestions')).map((x, i) => <Text key={i} style={s.p}>• {x}</Text>)}</>}
        {!!list(pick('warning_signs')).length && <><Text style={s.h}>{t('Warning signs')}</Text>{list(pick('warning_signs')).map((x, i) => <Text key={i} style={s.p}>• {x}</Text>)}</>}
        {audience === 'worker' && !!list(pick('health_worker_guidance')).length && <><Text style={s.h}>{t('For the health worker')}</Text>{list(pick('health_worker_guidance')).map((x, i) => <Text key={i} style={s.p}>• {x}</Text>)}</>}
        {!!pick('limitations') && <Text style={s.meta}>{pick('limitations')}</Text>}
        <Text style={s.meta}>{t('Provider')}: {analysis?.provider || '—'} · {t('Model')}: {analysis?.model_version || '—'}{fb?.research_label ? ` · ${t(fb.research_label)}` : ''}</Text>
      </>}
      {!!fb && <TouchableOpacity onPress={() => setMore(!more)} style={s.toggle}><Text style={s.toggleText}>{more ? t('Hide details') : t('Show details')} {more ? '▲' : '▼'}</Text></TouchableOpacity>}
    </View>
  );
}

const s = StyleSheet.create({
  card: {backgroundColor: '#ffffff', borderRadius: 14, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: '#d8e4e1'},
  top: {flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 6},
  kind: {fontSize: 15, fontWeight: '900', color: '#0d5d54', flexShrink: 1}, badge: {color: '#fff', fontSize: 11, fontWeight: '900', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, overflow: 'hidden'},
  warn: {fontSize: 11, color: '#b42318', backgroundColor: '#fdecea', padding: 8, borderRadius: 8, marginTop: 8},
  h: {fontSize: 12, fontWeight: '900', color: '#52716a', marginTop: 12, marginBottom: 3}, h2: {fontSize: 12, fontWeight: '900', color: '#0d5d54', marginBottom: 4},
  cond: {fontSize: 17, fontWeight: '900', color: '#173c38', flexShrink: 1}, p: {fontSize: 13, color: '#24443e', lineHeight: 20, flexShrink: 1, marginTop: 2},
  meta: {fontSize: 11, color: '#71827e', marginTop: 6, lineHeight: 16, flexShrink: 1},
  msg: {backgroundColor: '#e8f3f0', borderRadius: 10, padding: 10, marginTop: 12},
  toggle: {alignSelf: 'flex-start', marginTop: 12, paddingVertical: 8, paddingHorizontal: 14, borderRadius: 20, backgroundColor: '#e8f3f0'}, toggleText: {color: '#0d5d54', fontWeight: '800', fontSize: 12},
});
