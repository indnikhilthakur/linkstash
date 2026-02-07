import React, { useState, useCallback, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView, RefreshControl,
  ActivityIndicator, Image,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../src/auth';
import { listNotes } from '../../src/api';
import { colors, spacing, fontSize, borderRadius, platformIcons } from '../../src/theme';

interface Note {
  note_id: string;
  type: string;
  title: string;
  url: string;
  summary: string;
  tags: string[];
  thumbnail: string;
  source_platform: string;
  is_processing: boolean;
  created_at: string;
}

function NoteCard({ note, onPress, index }: { note: Note; onPress: () => void; index: number }) {
  const platform = platformIcons[note.source_platform] || platformIcons.web;
  const typeIcon = note.type === 'link' ? 'link' : note.type === 'voice' ? 'mic' :
    note.type === 'image' ? 'image' : 'file-text';

  return (
    <TouchableOpacity
      testID={`note-card-${note.note_id}`}
      style={[styles.card, index % 3 === 0 && styles.cardTall]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      {note.thumbnail ? (
        <Image source={{ uri: note.thumbnail }} style={styles.cardImage} />
      ) : (
        <View style={[styles.cardImagePlaceholder, { backgroundColor: index % 2 === 0 ? colors.surfaceHighlight : colors.surface }]}>
          <Feather name={typeIcon as any} size={24} color={colors.text.muted} />
        </View>
      )}

      {note.is_processing && (
        <View style={styles.processingBadge}>
          <ActivityIndicator size="small" color={colors.status.aiProcessing} />
          <Text style={styles.processingText}>AI Processing</Text>
        </View>
      )}

      <View style={styles.cardContent}>
        <View style={styles.cardHeader}>
          <Feather name={platform.icon as any} size={12} color={platform.color} />
          <Text style={styles.platformText}>{note.source_platform || note.type}</Text>
        </View>

        <Text style={styles.cardTitle} numberOfLines={2}>{note.title || 'Untitled'}</Text>

        {note.summary ? (
          <Text style={styles.cardSummary} numberOfLines={2}>{note.summary}</Text>
        ) : null}

        {note.tags.length > 0 && (
          <View style={styles.tagsRow}>
            {note.tags.slice(0, 3).map((tag, i) => (
              <View key={i} style={styles.tag}>
                <Text style={styles.tagText}>{tag}</Text>
              </View>
            ))}
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}

export default function HomeScreen() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedTag, setSelectedTag] = useState<string | null>(null);

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!authLoading && !user) {
      router.replace('/');
    }
  }, [user, authLoading]);

  const fetchNotes = useCallback(async () => {
    try {
      const data = await listNotes(selectedTag || undefined);
      setNotes(data.notes || []);
    } catch (e) {
      console.error('Failed to fetch notes:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedTag]);

  useFocusEffect(
    useCallback(() => {
      fetchNotes();
    }, [fetchNotes])
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchNotes();
  };

  // Get all unique tags from notes
  const allTags = Array.from(new Set(notes.flatMap(n => n.tags))).slice(0, 10);

  // Split notes into two columns for masonry
  const leftCol = notes.filter((_, i) => i % 2 === 0);
  const rightCol = notes.filter((_, i) => i % 2 !== 0);

  if (authLoading || loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 100 }} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Hey, {user?.name?.split(' ')[0] || 'there'}</Text>
          <Text style={styles.noteCount}>{notes.length} stashed</Text>
        </View>
        <TouchableOpacity
          testID="add-note-btn"
          style={styles.addBtn}
          onPress={() => router.push('/capture')}
        >
          <Feather name="plus" size={24} color={colors.primaryForeground} />
        </TouchableOpacity>
      </View>

      {/* Tag filter */}
      {allTags.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.tagFilter}
          contentContainerStyle={styles.tagFilterContent}
        >
          <TouchableOpacity
            testID="filter-all"
            style={[styles.filterChip, !selectedTag && styles.filterChipActive]}
            onPress={() => setSelectedTag(null)}
          >
            <Text style={[styles.filterChipText, !selectedTag && styles.filterChipTextActive]}>All</Text>
          </TouchableOpacity>
          {allTags.map((tag) => (
            <TouchableOpacity
              key={tag}
              testID={`filter-${tag}`}
              style={[styles.filterChip, selectedTag === tag && styles.filterChipActive]}
              onPress={() => setSelectedTag(selectedTag === tag ? null : tag)}
            >
              <Text style={[styles.filterChipText, selectedTag === tag && styles.filterChipTextActive]}>
                {tag}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {/* Notes masonry grid */}
      <ScrollView
        style={styles.scrollView}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        showsVerticalScrollIndicator={false}
      >
        {notes.length === 0 ? (
          <View style={styles.emptyState}>
            <Feather name="inbox" size={48} color={colors.text.muted} />
            <Text style={styles.emptyTitle}>No notes yet</Text>
            <Text style={styles.emptySubtitle}>Tap + to save your first link or note</Text>
          </View>
        ) : (
          <View style={styles.masonry}>
            <View style={styles.masonryCol}>
              {leftCol.map((note, i) => (
                <NoteCard
                  key={note.note_id}
                  note={note}
                  index={i * 2}
                  onPress={() => router.push(`/note/${note.note_id}`)}
                />
              ))}
            </View>
            <View style={styles.masonryCol}>
              {rightCol.map((note, i) => (
                <NoteCard
                  key={note.note_id}
                  note={note}
                  index={i * 2 + 1}
                  onPress={() => router.push(`/note/${note.note_id}`)}
                />
              ))}
            </View>
          </View>
        )}
        <View style={{ height: 100 }} />
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
  greeting: {
    fontSize: fontSize['2xl'],
    fontWeight: '900',
    color: colors.text.heading,
  },
  noteCount: {
    fontSize: fontSize.sm,
    color: colors.text.muted,
    marginTop: 2,
  },
  addBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  tagFilter: {
    maxHeight: 44,
    marginBottom: spacing.sm,
  },
  tagFilterContent: {
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
  },
  filterChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    backgroundColor: colors.surfaceHighlight,
    marginRight: spacing.sm,
  },
  filterChipActive: {
    backgroundColor: colors.primary,
  },
  filterChipText: {
    fontSize: fontSize.xs,
    color: colors.text.body,
    fontWeight: '600',
  },
  filterChipTextActive: {
    color: colors.primaryForeground,
  },
  scrollView: {
    flex: 1,
  },
  masonry: {
    flexDirection: 'row',
    paddingHorizontal: spacing.md,
    gap: spacing.md,
  },
  masonryCol: {
    flex: 1,
    gap: spacing.md,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.xl,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardTall: {},
  cardImage: {
    width: '100%',
    height: 120,
    resizeMode: 'cover',
  },
  cardImagePlaceholder: {
    width: '100%',
    height: 80,
    alignItems: 'center',
    justifyContent: 'center',
  },
  processingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    backgroundColor: 'rgba(6, 182, 212, 0.15)',
  },
  processingText: {
    fontSize: 10,
    color: colors.status.aiProcessing,
    fontWeight: '600',
  },
  cardContent: {
    padding: spacing.md,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: spacing.xs,
  },
  platformText: {
    fontSize: fontSize.xs,
    color: colors.text.muted,
    textTransform: 'capitalize',
  },
  cardTitle: {
    fontSize: fontSize.sm,
    fontWeight: '700',
    color: colors.text.heading,
    lineHeight: 18,
  },
  cardSummary: {
    fontSize: fontSize.xs,
    color: colors.text.body,
    marginTop: spacing.xs,
    lineHeight: 16,
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginTop: spacing.sm,
  },
  tag: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.surfaceHighlight,
  },
  tagText: {
    fontSize: 10,
    color: colors.primary,
    fontWeight: '600',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 120,
    gap: spacing.md,
  },
  emptyTitle: {
    fontSize: fontSize.xl,
    fontWeight: '700',
    color: colors.text.heading,
  },
  emptySubtitle: {
    fontSize: fontSize.sm,
    color: colors.text.muted,
    textAlign: 'center',
  },
});
