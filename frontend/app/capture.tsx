import React, { useState, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView,
  ActivityIndicator, KeyboardAvoidingView, Platform, Keyboard, Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { Audio } from 'expo-av';
import { createNote } from '../src/api';
import { colors, spacing, fontSize, borderRadius } from '../src/theme';

type CaptureMode = 'link' | 'text' | 'voice' | 'image';

export default function CaptureScreen() {
  const router = useRouter();
  const [mode, setMode] = useState<CaptureMode>('link');
  const [url, setUrl] = useState('');
  const [textContent, setTextContent] = useState('');
  const [title, setTitle] = useState('');
  const [saving, setSaving] = useState(false);
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const modes: { key: CaptureMode; icon: string; label: string }[] = [
    { key: 'link', icon: 'link', label: 'Link' },
    { key: 'text', icon: 'type', label: 'Text' },
    { key: 'voice', icon: 'mic', label: 'Voice' },
    { key: 'image', icon: 'camera', label: 'Image' },
  ];

  const startRecording = async () => {
    try {
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Microphone access is required for voice notes');
        return;
      }
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      const { recording: rec } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      setRecording(rec);
      setIsRecording(true);
      setRecordingDuration(0);
      intervalRef.current = setInterval(() => {
        setRecordingDuration(d => d + 1);
      }, 1000);
    } catch (e) {
      console.error('Failed to start recording:', e);
      Alert.alert('Error', 'Could not start recording');
    }
  };

  const stopRecording = async () => {
    if (!recording) return;
    setIsRecording(false);
    if (intervalRef.current) clearInterval(intervalRef.current);
    try {
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      setRecording(null);
      if (uri) {
        await saveVoiceNote(uri);
      }
    } catch (e) {
      console.error('Failed to stop recording:', e);
    }
  };

  const saveVoiceNote = async (uri: string) => {
    setSaving(true);
    try {
      const response = await fetch(uri);
      const blob = await response.blob();
      const reader = new FileReader();
      reader.onload = async () => {
        const base64 = (reader.result as string).split(',')[1];
        await createNote({
          type: 'voice',
          title: title || undefined,
          audio_base64: base64,
        });
        router.back();
      };
      reader.readAsDataURL(blob);
    } catch (e) {
      console.error('Failed to save voice note:', e);
      Alert.alert('Error', 'Could not save voice note');
      setSaving(false);
    }
  };

  const handleImageCapture = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Gallery access is required');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        base64: true,
        quality: 0.7,
      });
      if (!result.canceled && result.assets[0]?.base64) {
        setSaving(true);
        try {
          await createNote({
            type: 'image',
            title: title || undefined,
            image_base64: result.assets[0].base64,
          });
          router.back();
        } catch (e) {
          Alert.alert('Error', 'Could not save image note');
          setSaving(false);
        }
      }
    } catch (e) {
      console.error('Image pick failed:', e);
    }
  };

  const handleSave = async () => {
    if (mode === 'link' && !url.trim()) {
      Alert.alert('Missing URL', 'Please paste a link');
      return;
    }
    if (mode === 'text' && !textContent.trim()) {
      Alert.alert('Missing Content', 'Please enter some text');
      return;
    }

    Keyboard.dismiss();
    setSaving(true);
    try {
      if (mode === 'link') {
        await createNote({ type: 'link', url: url.trim(), title: title || undefined });
      } else if (mode === 'text') {
        await createNote({ type: 'text', raw_content: textContent.trim(), title: title || undefined });
      }
      router.back();
    } catch (e) {
      console.error('Save failed:', e);
      Alert.alert('Error', 'Could not save note');
      setSaving(false);
    }
  };

  const formatDuration = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity testID="close-capture-btn" onPress={() => router.back()}>
            <Feather name="x" size={24} color={colors.text.heading} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Quick Capture</Text>
          <View style={{ width: 24 }} />
        </View>

        {/* Mode Tabs */}
        <View style={styles.modeRow}>
          {modes.map((m) => (
            <TouchableOpacity
              key={m.key}
              testID={`mode-${m.key}`}
              style={[styles.modeTab, mode === m.key && styles.modeTabActive]}
              onPress={() => setMode(m.key)}
            >
              <Feather name={m.icon as any} size={18} color={mode === m.key ? colors.primaryForeground : colors.text.muted} />
              <Text style={[styles.modeLabel, mode === m.key && styles.modeLabelActive]}>{m.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <ScrollView style={styles.content} keyboardShouldPersistTaps="handled">
          {/* Optional title */}
          <TextInput
            testID="capture-title-input"
            style={styles.titleInput}
            placeholder="Title (optional, AI will generate)"
            placeholderTextColor={colors.text.muted}
            value={title}
            onChangeText={setTitle}
          />

          {/* Link mode */}
          {mode === 'link' && (
            <View style={styles.inputSection}>
              <Text style={styles.inputLabel}>Paste URL</Text>
              <View style={styles.urlInputWrap}>
                <Feather name="link" size={16} color={colors.text.muted} />
                <TextInput
                  testID="url-input"
                  style={styles.urlInput}
                  placeholder="https://youtube.com/watch?v=..."
                  placeholderTextColor={colors.text.muted}
                  value={url}
                  onChangeText={setUrl}
                  autoCapitalize="none"
                  keyboardType="url"
                />
              </View>
              <Text style={styles.inputHint}>AI will extract title, thumbnail, summary & tags</Text>
            </View>
          )}

          {/* Text mode */}
          {mode === 'text' && (
            <View style={styles.inputSection}>
              <Text style={styles.inputLabel}>Quick Note</Text>
              <TextInput
                testID="text-input"
                style={styles.textArea}
                placeholder="Type anything... AI will auto-tag it"
                placeholderTextColor={colors.text.muted}
                value={textContent}
                onChangeText={setTextContent}
                multiline
                numberOfLines={6}
                textAlignVertical="top"
              />
              <Text style={styles.inputHint}>AI will generate summary & tags automatically</Text>
            </View>
          )}

          {/* Voice mode */}
          {mode === 'voice' && (
            <View style={styles.voiceSection}>
              <View style={styles.voiceVisual}>
                <Feather name="mic" size={48} color={isRecording ? colors.status.error : colors.text.muted} />
                {isRecording && (
                  <Text style={styles.recordingTime}>{formatDuration(recordingDuration)}</Text>
                )}
              </View>
              <Text style={styles.voiceHint}>
                {isRecording ? 'Recording... Tap to stop' : 'Tap to start recording'}
              </Text>
              <TouchableOpacity
                testID="record-btn"
                style={[styles.recordBtn, isRecording && styles.recordBtnActive]}
                onPress={isRecording ? stopRecording : startRecording}
              >
                <Feather name={isRecording ? 'square' : 'mic'} size={28} color={isRecording ? '#FFF' : colors.primaryForeground} />
              </TouchableOpacity>
              <Text style={styles.inputHint}>Audio will be transcribed and auto-tagged by AI</Text>
            </View>
          )}

          {/* Image mode */}
          {mode === 'image' && (
            <View style={styles.imageSection}>
              <TouchableOpacity
                testID="pick-image-btn"
                style={styles.imagePickBtn}
                onPress={handleImageCapture}
              >
                <Feather name="image" size={40} color={colors.text.muted} />
                <Text style={styles.imagePickText}>Tap to pick an image</Text>
                <Text style={styles.inputHint}>AI will extract text & generate tags via OCR</Text>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>

        {/* Save Button (for link and text modes) */}
        {(mode === 'link' || mode === 'text') && (
          <View style={styles.footer}>
            <TouchableOpacity
              testID="save-note-btn"
              style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
              onPress={handleSave}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator size="small" color={colors.primaryForeground} />
              ) : (
                <>
                  <Feather name="zap" size={18} color={colors.primaryForeground} />
                  <Text style={styles.saveBtnText}>Save & Generate Metadata</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        )}

        {saving && mode !== 'link' && mode !== 'text' && (
          <View style={styles.footer}>
            <View style={styles.processingBar}>
              <ActivityIndicator size="small" color={colors.status.aiProcessing} />
              <Text style={styles.processingText}>AI is processing your note...</Text>
            </View>
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  headerTitle: {
    fontSize: fontSize.lg,
    fontWeight: '700',
    color: colors.text.heading,
  },
  modeRow: {
    flexDirection: 'row',
    marginHorizontal: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: 4,
    gap: 4,
  },
  modeTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
  },
  modeTabActive: {
    backgroundColor: colors.primary,
  },
  modeLabel: {
    fontSize: fontSize.xs,
    fontWeight: '600',
    color: colors.text.muted,
  },
  modeLabelActive: {
    color: colors.primaryForeground,
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
  },
  titleInput: {
    backgroundColor: colors.surfaceHighlight,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    color: colors.text.heading,
    fontSize: fontSize.base,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  inputSection: {
    gap: spacing.sm,
  },
  inputLabel: {
    fontSize: fontSize.sm,
    fontWeight: '700',
    color: colors.text.heading,
    letterSpacing: 0.5,
  },
  urlInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceHighlight,
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
  },
  urlInput: {
    flex: 1,
    color: colors.text.heading,
    fontSize: fontSize.base,
    paddingVertical: spacing.md,
  },
  textArea: {
    backgroundColor: colors.surfaceHighlight,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    color: colors.text.heading,
    fontSize: fontSize.base,
    minHeight: 150,
  },
  inputHint: {
    fontSize: fontSize.xs,
    color: colors.text.muted,
    fontStyle: 'italic',
  },
  voiceSection: {
    alignItems: 'center',
    paddingTop: spacing.xl,
    gap: spacing.lg,
  },
  voiceVisual: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.border,
  },
  recordingTime: {
    fontSize: fontSize.lg,
    fontWeight: '700',
    color: colors.status.error,
    marginTop: spacing.xs,
  },
  voiceHint: {
    fontSize: fontSize.sm,
    color: colors.text.body,
  },
  recordBtn: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 5,
  },
  recordBtnActive: {
    backgroundColor: colors.status.error,
  },
  imageSection: {
    alignItems: 'center',
    paddingTop: spacing.lg,
  },
  imagePickBtn: {
    width: '100%',
    height: 200,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.xl,
    borderWidth: 2,
    borderColor: colors.border,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  imagePickText: {
    fontSize: fontSize.base,
    color: colors.text.body,
    fontWeight: '600',
  },
  footer: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
    paddingTop: spacing.sm,
  },
  saveBtn: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.full,
    paddingVertical: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 5,
  },
  saveBtnDisabled: {
    opacity: 0.6,
  },
  saveBtnText: {
    fontSize: fontSize.base,
    fontWeight: '700',
    color: colors.primaryForeground,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  processingBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: 'rgba(6, 182, 212, 0.1)',
    borderRadius: borderRadius.lg,
    paddingVertical: spacing.md,
  },
  processingText: {
    fontSize: fontSize.sm,
    color: colors.status.aiProcessing,
    fontWeight: '500',
  },
});
