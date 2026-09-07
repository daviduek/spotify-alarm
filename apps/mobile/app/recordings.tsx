import { RecordingPresets, requestRecordingPermissionsAsync, setAudioModeAsync, useAudioRecorder, useAudioRecorderState } from 'expo-audio';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { Button, Divider, Note, Row, Screen, Section, Subtitle, Title } from '../src/components/ui';
import { alarmAudioEngine } from '../src/services/audio/alarmAudioEngine';
import { logger } from '../src/services/logger';
import { deleteRecording, listRecordings, renameRecording, saveRecording, type Recording } from '../src/services/recordings/recordingsRepository';
import { setTestSource } from '../src/services/settings';
import { colors, radius, spacing, type } from '../src/theme';
import { formatDuration } from '../src/utils/async';

/** Spec §18 — record, name, play, rename, delete, use for alarm. Stored on device only (spec §44). */
export default function RecordingsScreen() {
  const router = useRouter();
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
      setMessage('Microphone permission is needed to record a wake-up message.');
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
      setName(`Wake-up ${new Date().toLocaleDateString()}`);
    }
  };

  const save = async () => {
    if (!pendingUri) return;
    const rec = await saveRecording({ sourceUri: pendingUri, name: name.trim() || 'My recording', durationMs: pendingDuration });
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
        <Title>My Recordings</Title>
        <Subtitle>Record your own wake-up. “David, son las siete. Levantate.”</Subtitle>
      </View>

      <Section title={recorderState.isRecording ? 'Recording' : 'New wake-up'}>
        <View style={styles.recorder}>
          <Text style={styles.timer} accessibilityLabel={`Recording time ${formatDuration(recorderState.durationMillis)}`}>
            {formatDuration(recorderState.isRecording ? recorderState.durationMillis : pendingUri ? pendingDuration : 0)}
          </Text>
          <Text style={styles.recState}>{recorderState.isRecording ? '● Recording' : pendingUri ? 'Ready to save' : 'Tap to record'}</Text>
          {recorderState.isRecording ? (
            <Button title="Stop" variant="danger" onPress={stopRecording} />
          ) : pendingUri ? (
            <View style={{ gap: spacing.sm, width: '100%' }}>
              <TextInput value={name} onChangeText={setName} placeholder="Name your recording" placeholderTextColor={colors.textMuted} style={styles.input} accessibilityLabel="Recording name" />
              <Button title="Save" variant="primary" onPress={save} />
              <Button title="Discard" variant="ghost" onPress={() => setPendingUri(null)} />
            </View>
          ) : (
            <Button title="+ Record a new wake-up" variant="primary" onPress={startRecording} />
          )}
        </View>
      </Section>
      {message ? <Note tone="warning">{message}</Note> : null}

      <Section title={`Saved (${recordings.length})`} hint="Recordings stay on this device. Android plays them natively at alarm time; iOS plays them when the app opens.">
        {recordings.length === 0 ? <Note>{'\n'}  No recordings yet.{'\n'}</Note> : null}
        {recordings.map((rec, i) => (
          <View key={rec.id}>
            {renamingId === rec.id ? (
              <View style={{ padding: spacing.md, gap: spacing.sm }}>
                <TextInput value={name} onChangeText={setName} style={styles.input} autoFocus accessibilityLabel="New name" />
                <Button title="Save name" onPress={() => rename(rec)} />
                <Button title="Cancel" variant="ghost" onPress={() => setRenamingId(null)} />
              </View>
            ) : (
              <>
                <Row label={`▶ ${rec.name}`} value={formatDuration(rec.durationMs)} onPress={() => void play(rec)} accessibilityLabel={`Play ${rec.name}`} />
                <View style={styles.actions}>
                  <Button title="Use for alarm" onPress={() => useForAlarm(rec)} style={{ flex: 1 }} />
                  <Button
                    title="Rename"
                    variant="ghost"
                    onPress={() => {
                      setName(rec.name);
                      setRenamingId(rec.id);
                    }}
                  />
                  <Button title="Delete" variant="danger" onPress={() => remove(rec)} />
                </View>
              </>
            )}
            {i < recordings.length - 1 ? <Divider /> : null}
          </View>
        ))}
      </Section>
      <Button title="Stop playback" variant="ghost" onPress={() => alarmAudioEngine.stop()} />
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
