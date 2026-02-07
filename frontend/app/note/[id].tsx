import React, { useEffect, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator,
  Image, Linking, Alert,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getNote, deleteNote } from '../../src/api';
import { colors, spacing, fontSize, borderRadius, platformIcons } from '../../src/theme';

interface NoteDetail {
  note_id: string;
  type: string;
  title: string;
  url: string;
  summary: string;
  tags: string[];
  thumbnail: string;
  raw_content: string;
  source_platform: string;
  is_processing: boolean;
  created_at: string;
  updated_at: string;
}

export default function NoteDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [note, setNote] = useState<NoteDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (id) fetchNote();
  }, [id]);

  const fetchNote = async () => {
    try {
      const data = await getNote(id!);
      setNote(data);
    } catch (e) {
      console.error('Failed to fetch note:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = () => {
    Alert.alert('Delete Note', 'Are you sure you want to delete this note?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setDeleting(true);
          try {
            await deleteNote(id!);
            router.back();
          } catch (e) {
            Alert.alert('Error', 'Could not delete note');
            setDeleting(false);
          }
        },
      },
    ]);
  };

  const handleOpenUrl = () => {
    if (note?.url) {
      Linking.openURL(note.url);
    }
  };

  const formatDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    } catch {
      return dateStr;
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 100 }} />
      </SafeAreaView>
    );
  }

  if (!note) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <Feather name="arrow-left" size={24} color={colors.text.heading} />
          </TouchableOpacity>
        </View>
        <View style={styles.errorWrap}>
          <Text style={styles.errorText}>Note not found</Text>
        </View>
      </SafeAreaView>
    );
  }

  const platform = platformIcons[note.source_platform] || platformIcons.web;
  const typeIcon = note.type === 'link' ? 'link' : note.type === 'voice' ? 'mic' :
    note.type === 'image' ? 'image' : 'file-text';

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity testID="back-btn" onPress={() => router.back()}>
          <Feather name="arrow-left" size={24} color={colors.text.heading} />
        </TouchableOpacity>
        <View style={styles.headerActions}>
          {note.url ? (
            <TouchableOpacity testID="open-url-btn" style={styles.headerBtn} onPress={handleOpenUrl}>
              <Feather name="external-link" size={18} color={colors.primary} />
            </TouchableOpacity>
          ) : null}
          <TouchableOpacity testID="delete-note-btn" style={styles.headerBtn} onPress={handleDelete} disabled={deleting}>
            {deleting ? (
              <ActivityIndicator size="small" color={colors.status.error} />
            ) : (
              <Feather name="trash-2" size={18} color={colors.status.error} />
            )}
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Thumbnail */}
        {note.thumbnail ? (
          <Image source={{ uri: note.thumbnail }} style={styles.thumbnail} />
        ) : null}

        {/* Meta */}
        <View style={styles.metaRow}>
          <View style={styles.typeBadge}>
            <Feather name={typeIcon as any} size={12} color={colors.primary} />
            <Text style={styles.typeText}>{note.type}</Text>
          </View>
          <View style={styles.platformBadge}>
            <Feather name={platform.icon as any} size={12} color={platform.color} />
            <Text style={styles.platformText}>{note.source_platform || 'note'}</Text>
          </View>
          {note.is_processing && (
            <View style={styles.processingBadge}>
              <ActivityIndicator size="small" color={colors.status.aiProcessing} />
              <Text style={styles.processingBadgeText}>Processing</Text>
            </View>
          )}
        </View>

        {/* Title */}
        <Text style={styles.title}>{note.title || 'Untitled'}</Text>

        {/* Date */}
        <Text style={styles.date}>{formatDate(note.created_at)}</Text>

        {/* URL */}
        {note.url ? (
          <TouchableOpacity testID="note-url" style={styles.urlCard} onPress={handleOpenUrl}>
            <Feather name="link" size={14} color={colors.primary} />
            <Text style={styles.urlText} numberOfLines={2}>{note.url}</Text>
            <Feather name="external-link" size={14} color={colors.text.muted} />
          </TouchableOpacity>
        ) : null}

        {/* Summary */}
        {note.summary ? (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Feather name="zap" size={14} color={colors.status.aiProcessing} />
              <Text style={styles.sectionTitle}>AI Summary</Text>
            </View>
            <Text style={styles.summaryText}>{note.summary}</Text>
          </View>
        ) : null}

        {/* Tags */}
        {note.tags.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Feather name="tag" size={14} color={colors.primary} />
              <Text style={styles.sectionTitle}>Tags</Text>
            </View>
            <View style={styles.tagsWrap}>
              {note.tags.map((tag, i) => (
                <View key={i} style={styles.tagChip}>
                  <Text style={styles.tagChipText}>{tag}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Raw Content */}
        {note.raw_content ? (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Feather name="file-text" size={14} color={colors.text.body} />
              <Text style={styles.sectionTitle}>Content</Text>
            </View>
            <Text style={styles.contentText}>{note.raw_content}</Text>
          </View>
        ) : null}

        <View style={{ height: 60 }} />
      </ScrollView>
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
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  headerActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  headerBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  scrollView: {
    flex: 1,
    paddingHorizontal: spacing.lg,
  },
  thumbnail: {
    width: '100%',
    height: 200,
    borderRadius: borderRadius.xl,
    resizeMode: 'cover',
    marginBottom: spacing.md,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  typeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(204, 255, 0, 0.1)',
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: borderRadius.full,
  },
  typeText: {
    fontSize: fontSize.xs,
    color: colors.primary,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  platformBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.surfaceHighlight,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: borderRadius.full,
  },
  platformText: {
    fontSize: fontSize.xs,
    color: colors.text.body,
    textTransform: 'capitalize',
  },
  processingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(6, 182, 212, 0.15)',
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: borderRadius.full,
  },
  processingBadgeText: {
    fontSize: fontSize.xs,
    color: colors.status.aiProcessing,
    fontWeight: '500',
  },
  title: {
    fontSize: fontSize['2xl'],
    fontWeight: '900',
    color: colors.text.heading,
    lineHeight: 30,
  },
  date: {
    fontSize: fontSize.xs,
    color: colors.text.muted,
    marginTop: spacing.xs,
    marginBottom: spacing.md,
  },
  urlCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  urlText: {
    flex: 1,
    fontSize: fontSize.sm,
    color: colors.primary,
  },
  section: {
    marginBottom: spacing.lg,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  sectionTitle: {
    fontSize: fontSize.sm,
    fontWeight: '700',
    color: colors.text.heading,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  summaryText: {
    fontSize: fontSize.base,
    color: colors.text.body,
    lineHeight: 24,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    borderLeftWidth: 3,
    borderLeftColor: colors.status.aiProcessing,
  },
  tagsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  tagChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    backgroundColor: colors.surfaceHighlight,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tagChipText: {
    fontSize: fontSize.sm,
    color: colors.primary,
    fontWeight: '600',
  },
  contentText: {
    fontSize: fontSize.sm,
    color: colors.text.body,
    lineHeight: 22,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
  },
  errorWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorText: {
    fontSize: fontSize.lg,
    color: colors.text.muted,
  },
});
