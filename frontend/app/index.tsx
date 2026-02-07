import React, { useEffect, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../src/auth';
import { exchangeSession } from '../src/api';
import { colors, spacing, fontSize, borderRadius } from '../src/theme';

export default function LoginScreen() {
  const router = useRouter();
  const { user, loading, setUser } = useAuth();
  const [authLoading, setAuthLoading] = useState(false);

  // Check for session_id in URL hash (after Google Auth redirect)
  useEffect(() => {
    if (Platform.OS === 'web') {
      const hash = window.location.hash;
      if (hash && hash.includes('session_id=')) {
        const sessionId = hash.split('session_id=')[1]?.split('&')[0];
        if (sessionId) {
          handleSessionExchange(sessionId);
          // Clean hash
          window.history.replaceState(null, '', window.location.pathname);
        }
      }
    }
  }, []);

  // Redirect to home if already authenticated
  useEffect(() => {
    if (!loading && user) {
      router.replace('/(tabs)/home');
    }
  }, [user, loading]);

  const handleSessionExchange = async (sessionId: string) => {
    setAuthLoading(true);
    try {
      const userData = await exchangeSession(sessionId);
      setUser({
        user_id: userData.user_id,
        email: userData.email,
        name: userData.name,
        picture: userData.picture,
      });
      router.replace('/(tabs)/home');
    } catch (e) {
      console.error('Auth exchange failed:', e);
    } finally {
      setAuthLoading(false);
    }
  };

  const handleGoogleLogin = () => {
    if (Platform.OS === 'web') {
      // REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
      const redirectUrl = window.location.origin + '/';
      window.location.href = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
    }
  };

  if (loading || authLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color={colors.primary} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.logoSection}>
          <View style={styles.iconWrap}>
            <Feather name="bookmark" size={40} color={colors.primary} />
          </View>
          <Text style={styles.appName}>LinkStash</Text>
          <Text style={styles.tagline}>Save anything. Find everything.</Text>
          <Text style={styles.subtitle}>
            Quick-capture links, voice notes & screenshots{'\n'}with AI-powered tagging and search
          </Text>
        </View>

        <View style={styles.features}>
          {[
            { icon: 'link', text: 'Auto-extract metadata from links' },
            { icon: 'mic', text: 'Voice-to-note with transcription' },
            { icon: 'camera', text: 'Screenshot OCR capture' },
            { icon: 'search', text: 'AI-powered semantic search' },
          ].map((f, i) => (
            <View key={i} style={styles.featureRow}>
              <View style={styles.featureIcon}>
                <Feather name={f.icon as any} size={18} color={colors.primary} />
              </View>
              <Text style={styles.featureText}>{f.text}</Text>
            </View>
          ))}
        </View>

        <TouchableOpacity
          testID="google-login-btn"
          style={styles.loginBtn}
          onPress={handleGoogleLogin}
          activeOpacity={0.8}
        >
          <Feather name="log-in" size={20} color={colors.primaryForeground} />
          <Text style={styles.loginText}>Sign in with Google</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    justifyContent: 'center',
  },
  logoSection: {
    alignItems: 'center',
    marginBottom: spacing['2xl'],
  },
  iconWrap: {
    width: 80,
    height: 80,
    borderRadius: 20,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  appName: {
    fontSize: fontSize['4xl'],
    fontWeight: '900',
    color: colors.text.heading,
    letterSpacing: -1,
  },
  tagline: {
    fontSize: fontSize.lg,
    color: colors.primary,
    fontWeight: '600',
    marginTop: spacing.xs,
  },
  subtitle: {
    fontSize: fontSize.sm,
    color: colors.text.muted,
    textAlign: 'center',
    marginTop: spacing.sm,
    lineHeight: 20,
  },
  features: {
    marginBottom: spacing['2xl'],
    gap: spacing.md,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  featureIcon: {
    width: 36,
    height: 36,
    borderRadius: borderRadius.md,
    backgroundColor: colors.surfaceHighlight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureText: {
    fontSize: fontSize.base,
    color: colors.text.body,
  },
  loginBtn: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.full,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
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
  loginText: {
    fontSize: fontSize.base,
    fontWeight: '700',
    color: colors.primaryForeground,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
});
