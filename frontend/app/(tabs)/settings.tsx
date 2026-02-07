import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Alert, ActivityIndicator, Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-image-picker';
import { useAuth } from '../../src/auth';
import { logout as apiLogout, exportBackup, importBackup } from '../../src/api';
import { colors, spacing, fontSize, borderRadius } from '../../src/theme';

export default function SettingsScreen() {
  const router = useRouter();
  const { user, signOut } = useAuth();
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);

  const handleExport = async () => {
    setExporting(true);
    try {
      const data = await exportBackup();
      const jsonStr = JSON.stringify(data, null, 2);

      if (Platform.OS === 'web') {
        const blob = new Blob([jsonStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `linkstash-backup-${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
      } else {
        const fileUri = FileSystem.documentDirectory + `linkstash-backup.json`;
        await FileSystem.writeAsStringAsync(fileUri, jsonStr);
        await Sharing.shareAsync(fileUri);
      }

      Alert.alert('Export Complete', `Exported ${data.count} notes`);
    } catch (e) {
      Alert.alert('Export Failed', 'Could not export your notes');
    } finally {
      setExporting(false);
    }
  };

  const handleImport = async () => {
    setImporting(true);
    try {
      if (Platform.OS === 'web') {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.onchange = async (e: any) => {
          const file = e.target.files[0];
          if (!file) return;
          const text = await file.text();
          const data = JSON.parse(text);
          const notes = data.notes || [];
          const result = await importBackup(notes);
          Alert.alert('Import Complete', result.message);
          setImporting(false);
        };
        input.click();
      } else {
        Alert.alert('Import', 'Import is available on web. Use the web app to import backups.');
        setImporting(false);
      }
    } catch (e) {
      Alert.alert('Import Failed', 'Could not import notes');
      setImporting(false);
    }
  };

  const handleLogout = async () => {
    try {
      await apiLogout();
      await signOut();
      router.replace('/');
    } catch (e) {
      await signOut();
      router.replace('/');
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Settings</Text>
      </View>

      {/* Profile */}
      <View style={styles.profileCard}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{user?.name?.[0]?.toUpperCase() || '?'}</Text>
        </View>
        <View style={styles.profileInfo}>
          <Text style={styles.profileName}>{user?.name || 'User'}</Text>
          <Text style={styles.profileEmail}>{user?.email || ''}</Text>
        </View>
      </View>

      {/* Backup Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>BACKUP & RESTORE</Text>

        <TouchableOpacity
          testID="export-backup-btn"
          style={styles.menuItem}
          onPress={handleExport}
          disabled={exporting}
        >
          <View style={[styles.menuIcon, { backgroundColor: 'rgba(34, 197, 94, 0.15)' }]}>
            <Feather name="download" size={18} color={colors.status.success} />
          </View>
          <View style={styles.menuContent}>
            <Text style={styles.menuLabel}>Export Backup</Text>
            <Text style={styles.menuDesc}>Download all notes as JSON</Text>
          </View>
          {exporting ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <Feather name="chevron-right" size={18} color={colors.text.muted} />
          )}
        </TouchableOpacity>

        <TouchableOpacity
          testID="import-backup-btn"
          style={styles.menuItem}
          onPress={handleImport}
          disabled={importing}
        >
          <View style={[styles.menuIcon, { backgroundColor: 'rgba(6, 182, 212, 0.15)' }]}>
            <Feather name="upload" size={18} color={colors.status.aiProcessing} />
          </View>
          <View style={styles.menuContent}>
            <Text style={styles.menuLabel}>Import Backup</Text>
            <Text style={styles.menuDesc}>Restore notes from JSON file</Text>
          </View>
          {importing ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <Feather name="chevron-right" size={18} color={colors.text.muted} />
          )}
        </TouchableOpacity>
      </View>

      {/* About */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>ABOUT</Text>
        <View style={styles.menuItem}>
          <View style={[styles.menuIcon, { backgroundColor: 'rgba(204, 255, 0, 0.1)' }]}>
            <Feather name="bookmark" size={18} color={colors.primary} />
          </View>
          <View style={styles.menuContent}>
            <Text style={styles.menuLabel}>LinkStash v1.0</Text>
            <Text style={styles.menuDesc}>AI-powered link & note management</Text>
          </View>
        </View>
      </View>

      {/* Logout */}
      <TouchableOpacity
        testID="logout-btn"
        style={styles.logoutBtn}
        onPress={handleLogout}
      >
        <Feather name="log-out" size={18} color={colors.status.error} />
        <Text style={styles.logoutText}>Sign Out</Text>
      </TouchableOpacity>
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
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: spacing.lg,
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.md,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: fontSize.xl,
    fontWeight: '900',
    color: colors.primaryForeground,
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    fontSize: fontSize.lg,
    fontWeight: '700',
    color: colors.text.heading,
  },
  profileEmail: {
    fontSize: fontSize.sm,
    color: colors.text.muted,
    marginTop: 2,
  },
  section: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.lg,
  },
  sectionTitle: {
    fontSize: fontSize.xs,
    fontWeight: '700',
    color: colors.text.muted,
    letterSpacing: 1.5,
    marginBottom: spacing.sm,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
    gap: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  menuIcon: {
    width: 36,
    height: 36,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuContent: {
    flex: 1,
  },
  menuLabel: {
    fontSize: fontSize.base,
    fontWeight: '600',
    color: colors.text.heading,
  },
  menuDesc: {
    fontSize: fontSize.xs,
    color: colors.text.muted,
    marginTop: 2,
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    marginHorizontal: spacing.lg,
    marginTop: spacing['2xl'],
    paddingVertical: spacing.md,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.status.error,
  },
  logoutText: {
    fontSize: fontSize.base,
    fontWeight: '600',
    color: colors.status.error,
  },
});
