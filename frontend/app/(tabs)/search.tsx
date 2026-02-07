import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView,
  ActivityIndicator, Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { searchNotes } from '../../src/api';
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
  created_at: string;
}

export default function SearchScreen() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Note[]>([]);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);

  const handleSearch = async () => {
    if (!query.trim()) return;
    setSearching(true);
    setSearched(true);
    try {
      const data = await searchNotes(query.trim());
      setResults(data.notes || []);
    } catch (e) {
      console.error('Search failed:', e);
    } finally {
      setSearching(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>AI Search</Text>
        <Text style={styles.subtitle}>Find anything by describing what you remember</Text>
      </View>

      <View style={styles.searchBar}>
        <Feather name="search" size={18} color={colors.text.muted} />
        <TextInput
          testID="search-input"
          style={styles.searchInput}
          placeholder="e.g. that react tutorial from youtube..."
          placeholderTextColor={colors.text.muted}
          value={query}
          onChangeText={setQuery}
          onSubmitEditing={handleSearch}
          returnKeyType="search"
        />
        {query.length > 0 && (
          <TouchableOpacity testID="clear-search-btn" onPress={() => { setQuery(''); setResults([]); setSearched(false); }}>
            <Feather name="x" size={18} color={colors.text.muted} />
          </TouchableOpacity>
        )}
      </View>

      <TouchableOpacity
        testID="search-btn"
        style={[styles.searchBtn, !query.trim() && styles.searchBtnDisabled]}
        onPress={handleSearch}
        disabled={!query.trim() || searching}
      >
        {searching ? (
          <ActivityIndicator size="small" color={colors.primaryForeground} />
        ) : (
          <>
            <Feather name="zap" size={16} color={colors.primaryForeground} />
            <Text style={styles.searchBtnText}>Search with AI</Text>
          </>
        )}
      </TouchableOpacity>

      <ScrollView style={styles.results} showsVerticalScrollIndicator={false}>
        {searching ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="large" color={colors.status.aiProcessing} />
            <Text style={styles.loadingText}>AI is searching your stash...</Text>
          </View>
        ) : searched && results.length === 0 ? (
          <View style={styles.emptyWrap}>
            <Feather name="search" size={40} color={colors.text.muted} />
            <Text style={styles.emptyText}>No results found</Text>
            <Text style={styles.emptyHint}>Try different keywords or a broader description</Text>
          </View>
        ) : (
          results.map((note) => {
            const platform = platformIcons[note.source_platform] || platformIcons.web;
            return (
              <TouchableOpacity
                key={note.note_id}
                testID={`search-result-${note.note_id}`}
                style={styles.resultCard}
                onPress={() => router.push(`/note/${note.note_id}`)}
              >
                {note.thumbnail ? (
                  <Image source={{ uri: note.thumbnail }} style={styles.resultThumb} />
                ) : (
                  <View style={styles.resultThumbPlaceholder}>
                    <Feather name={note.type === 'link' ? 'link' : note.type === 'voice' ? 'mic' : 'file-text'} size={16} color={colors.text.muted} />
                  </View>
                )}
                <View style={styles.resultContent}>
                  <View style={styles.resultHeader}>
                    <Feather name={platform.icon as any} size={10} color={platform.color} />
                    <Text style={styles.resultPlatform}>{note.source_platform || note.type}</Text>
                  </View>
                  <Text style={styles.resultTitle} numberOfLines={1}>{note.title || 'Untitled'}</Text>
                  {note.summary ? <Text style={styles.resultSummary} numberOfLines={2}>{note.summary}</Text> : null}
                  {note.tags.length > 0 && (
                    <View style={styles.resultTags}>
                      {note.tags.slice(0, 3).map((t, i) => (
                        <Text key={i} style={styles.resultTag}>#{t}</Text>
                      ))}
                    </View>
                  )}
                </View>
              </TouchableOpacity>
            );
          })
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
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  title: {
    fontSize: fontSize['2xl'],
    fontWeight: '900',
    color: colors.text.heading,
  },
  subtitle: {
    fontSize: fontSize.sm,
    color: colors.text.muted,
    marginTop: 2,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: spacing.lg,
    backgroundColor: colors.surfaceHighlight,
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  searchInput: {
    flex: 1,
    color: colors.text.heading,
    fontSize: fontSize.base,
    paddingVertical: spacing.md,
  },
  searchBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    backgroundColor: colors.primary,
    borderRadius: borderRadius.full,
    paddingVertical: 14,
  },
  searchBtnDisabled: {
    opacity: 0.4,
  },
  searchBtnText: {
    fontSize: fontSize.sm,
    fontWeight: '700',
    color: colors.primaryForeground,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  results: {
    flex: 1,
    marginTop: spacing.lg,
  },
  loadingWrap: {
    alignItems: 'center',
    paddingTop: 60,
    gap: spacing.md,
  },
  loadingText: {
    fontSize: fontSize.sm,
    color: colors.status.aiProcessing,
    fontWeight: '500',
  },
  emptyWrap: {
    alignItems: 'center',
    paddingTop: 60,
    gap: spacing.sm,
  },
  emptyText: {
    fontSize: fontSize.lg,
    fontWeight: '700',
    color: colors.text.heading,
  },
  emptyHint: {
    fontSize: fontSize.sm,
    color: colors.text.muted,
  },
  resultCard: {
    flexDirection: 'row',
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
  },
  resultThumb: {
    width: 80,
    height: 80,
    resizeMode: 'cover',
  },
  resultThumbPlaceholder: {
    width: 80,
    height: 80,
    backgroundColor: colors.surfaceHighlight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resultContent: {
    flex: 1,
    padding: spacing.sm,
    justifyContent: 'center',
  },
  resultHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  resultPlatform: {
    fontSize: 10,
    color: colors.text.muted,
    textTransform: 'capitalize',
  },
  resultTitle: {
    fontSize: fontSize.sm,
    fontWeight: '700',
    color: colors.text.heading,
    marginTop: 2,
  },
  resultSummary: {
    fontSize: 11,
    color: colors.text.body,
    marginTop: 2,
    lineHeight: 14,
  },
  resultTags: {
    flexDirection: 'row',
    gap: 4,
    marginTop: 4,
  },
  resultTag: {
    fontSize: 10,
    color: colors.primary,
    fontWeight: '600',
  },
});
