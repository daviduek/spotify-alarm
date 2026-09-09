import { RecordingPresets, requestRecordingPermissionsAsync, setAudioModeAsync, useAudioRecorder, useAudioRecorderState } from 'expo-audio';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { Button, Divider, Note, Row, Screen, Section, Subtitle, Title } from '../src/components/ui';
import { alarmAudioEngine } from '../src/services/audio/alarmAudioEngine';
import { getLocale, type Locale } from '../src/services/i18n';
import { logger } from '../src/services/logger';
import { deleteRecording, listRecordings, renameRecording, saveRecording, type Recording } from '../src/services/recordings/recordingsRepository';
import { setTestSource } from '../src/services/settings';
import { colors, radius, spacing, type } from '../src/theme';
import { formatDuration } from '../src/utils/async';

const STR: Record<Locale, {
  title: string; subtitle: string; recording: string; newWakeUp: string; recordingTimeA11y: string;
  recDot: string; readyToSave: string; tapToRecord: string; stop: string; namePlaceholder: string; nameA11y: string;
  save: string; discard: string; recordNew: string; micDenied: string; defaultName: string; wakeUpPrefix: string;
  saved: string; savedHint: string; noRecordings: string; newNameA11y: string; saveName: string; cancel: string;
  playA11y: string; useForAlarm: string; rename: string; deleteBtn: string; stopPlayback: string;
}> = {
  en: {
    title: 'My Recordings',
    subtitle: 'Record your own wake-up. “David, it’s seven o’clock. Get up.”',
    recording: 'Recording',
    newWakeUp: 'New wake-up',
    recordingTimeA11y: 'Recording time',
    recDot: '● Recording',
    readyToSave: 'Ready to save',
    tapToRecord: 'Tap to record',
    stop: 'Stop',
    namePlaceholder: 'Name your recording',
    nameA11y: 'Recording name',
    save: 'Save',
    discard: 'Discard',
    recordNew: '+ Record a new wake-up',
    micDenied: 'Microphone permission is needed to record a wake-up message.',
    defaultName: 'My recording',
    wakeUpPrefix: 'Wake-up',
    saved: 'Saved',
    savedHint: 'Recordings stay on this device. Android plays them natively at alarm time; iOS plays them when the app opens.',
    noRecordings: 'No recordings yet.',
    newNameA11y: 'New name',
    saveName: 'Save name',
    cancel: 'Cancel',
    playA11y: 'Play',
    useForAlarm: 'Use for alarm',
    rename: 'Rename',
    deleteBtn: 'Delete',
    stopPlayback: 'Stop playback',
  },
  es: {
    title: 'Mis grabaciones',
    subtitle: 'Graba tu propio despertar. “David, son las siete. Levántate.”',
    recording: 'Grabando',
    newWakeUp: 'Nuevo despertar',
    recordingTimeA11y: 'Tiempo de grabación',
    recDot: '● Grabando',
    readyToSave: 'Listo para guardar',
    tapToRecord: 'Toca para grabar',
    stop: 'Detener',
    namePlaceholder: 'Ponle nombre a tu grabación',
    nameA11y: 'Nombre de la grabación',
    save: 'Guardar',
    discard: 'Descartar',
    recordNew: '+ Grabar un nuevo despertar',
    micDenied: 'Se necesita permiso de micrófono para grabar un mensaje de despertar.',
    defaultName: 'Mi grabación',
    wakeUpPrefix: 'Despertar',
    saved: 'Guardadas',
    savedHint: 'Las grabaciones se quedan en este dispositivo. Android las reproduce de forma nativa al sonar la alarma; iOS las reproduce al abrir la app.',
    noRecordings: 'Aún no hay grabaciones.',
    newNameA11y: 'Nuevo nombre',
    saveName: 'Guardar nombre',
    cancel: 'Cancelar',
    playA11y: 'Reproducir',
    useForAlarm: 'Usar para la alarma',
    rename: 'Renombrar',
    deleteBtn: 'Eliminar',
    stopPlayback: 'Detener reproducción',
  },
};

/** Spec §18 — record, name, play, rename, delete, use for alarm. Stored on device only (spec §44). */
export default function RecordingsScreen() {
  const router = useRouter();
  const str = STR[getLocale()];
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recorderState = useAudioRecorderState(recorder, 250);
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [pendingUri, setPendingUri] = useState<string | null>(null);
  const [pendingDuration, setPendingDuration] = useState(0);
  const [name, setName] = useState('');
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const refresh = useCallback(async () => setRecordings(await listRecordings()), []);

  useEffect(() => {
    void refresh();
    return () => {
      void alarmAudioEngine.stop();
    };
  }, [refresh]);

  const startRecording = async () => {
    setMessage(null);
    const perm = await requestRecordingPermissionsAsync();
    if (!perm.granted) {
      setMessage(str.micDenied);
      return;
    }
    await alarmAudioEngine.stop();
    await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
    await recorder.prepareToRecordAsync();
    recorder.record();
    logger.info('recording_started');
  };

  const stopRecording = async () => {
    await recorder.stop();
    await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
    if (recorder.uri) {
      setPendingUri(recorder.uri);
      setPendingDuration(recorderState.durationMillis);
      setName(`${str.wakeUpPrefix} ${new Date().toLocaleDateString()}`);
    }
  };

  const save = async () => {
    if (!pendingUri) return;
    const rec = await saveRecording({ sourceUri: pendingUri, name: name.trim() || str.defaultName, durationMs: pendingDuration });
    logger.info('recording_saved', { id: rec.id, durationMs: rec.durationMs });
    setPendingUri(null);
    await refresh();
  };

  const play = (rec: Recording) => alarmAudioEngine.preview({ type: 'recording', recordingId: rec.id, fileUri: rec.fileUri, title: rec.name });

  const useForAlarm = async (rec: Recording) => {
    await setTestSource({ type: 'recording', recordingId: rec.id, fileUri: rec.fileUri, title: rec.name });
    logger.info('recording_selected', { id: rec.id });
    router.back();
  };

  const remove = async (rec: Recording) => {
    await alarmAudioEngine.stop();
    await deleteRecording(rec.id);
    await refresh();
  };

  const rename = async (rec: Recording) => {
    await renameRecording(rec.id, name.trim() || rec.name);
    setRenamingId(null);
    await refresh();
  };

  return (
    <Screen>
      <View>
        <Title>{str.title}</Title>
        <Subtitle>{str.subtitle}</Subtitle>
      </View>

      <Section title={recorderState.isRecording ? str.recording : str.newWakeUp}>
        <View style={styles.recorder}>
          <Text style={styles.timer} accessibilityLabel={`${str.recordingTimeA11y} ${formatDuration(recorderState.durationMillis)}`}>
            {formatDuration(recorderState.isRecording ? recorderState.durationMillis : pendingUri ? pendingDuration : 0)}
          </Text>
          <Text style={styles.recState}>{recorderState.isRecording ? str.recDot : pendingUri ? str.readyToSave : str.tapToRecord}</Text>
          {recorderState.isRecording ? (
            <Button title={str.stop} variant="danger" onPress={stopRecording} />
          ) : pendingUri ? (
            <View style={{ gap: spacing.sm, width: '100%' }}>
              <TextInput value={name} onChangeText={setName} placeholder={str.namePlaceholder} placeholderTextColor={colors.textMuted} style={styles.input} accessibilityLabel={str.nameA11y} />
              <Button title={str.save} variant="primary" onPress={save} />
              <Button title={str.discard} variant="ghost" onPress={() => setPendingUri(null)} />
            </View>
          ) : (
            <Button title={str.recordNew} variant="primary" onPress={startRecording} />
          )}
        </View>
      </Section>
      {message ? <Note tone="warning">{message}</Note> : null}

      <Section title={`${str.saved} (${recordings.length})`} hint={str.savedHint}>
        {recordings.length === 0 ? <Note>{'\n'}  {str.noRecordings}{'\n'}</Note> : null}
        {recordings.map((rec, i) => (
          <View key={rec.id}>
            {renamingId === rec.id ? (
              <View style={{ padding: spacing.md, gap: spacing.sm }}>
                <TextInput value={name} onChangeText={setName} style={styles.input} autoFocus accessibilityLabel={str.newNameA11y} />
                <Button title={str.saveName} onPress={() => rename(rec)} />
                <Button title={str.cancel} variant="ghost" onPress={() => setRenamingId(null)} />
              </View>
            ) : (
              <>
                <Row label={`▶ ${rec.name}`} value={formatDuration(rec.durationMs)} onPress={() => void play(rec)} accessibilityLabel={`${str.playA11y} ${rec.name}`} />
                <View style={styles.actions}>
                  <Button title={str.useForAlarm} onPress={() => useForAlarm(rec)} style={{ flex: 1 }} />
                  <Button
                    title={str.rename}
                    variant="ghost"
                    onPress={() => {
                      setName(rec.name);
                      setRenamingId(rec.id);
                    }}
                  />
                  <Button title={str.deleteBtn} variant="danger" onPress={() => remove(rec)} />
                </View>
              </>
            )}
            {i < recordings.length - 1 ? <Divider /> : null}
          </View>
        ))}
      </Section>
      <Button title={str.stopPlayback} variant="ghost" onPress={() => alarmAudioEngine.stop()} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  recorder: { alignItems: 'center', padding: spacing.lg, gap: spacing.md },
  timer: { ...type.display, fontSize: 56, color: colors.text },
  recState: { ...type.body, color: colors.danger },
  input: { minHeight: 50, borderRadius: radius.sm, backgroundColor: colors.surface2, color: colors.text, paddingHorizontal: spacing.md, ...type.body },
  actions: { flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.md, paddingBottom: spacing.md },
});
