import React, { useEffect, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Platform,
  TextInput, KeyboardAvoidingView, ScrollView, Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../src/auth';
import { exchangeSession, registerEmail, loginEmail } from '../src/api';
import { colors, spacing, fontSize, borderRadius } from '../src/theme';

export default function LoginScreen() {
  const router = useRouter();
  const { user, loading, setUser } = useAuth();
  const [authLoading, setAuthLoading] = useState(false);
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');

  // Check for session_id in URL hash (after Google Auth redirect)
  useEffect(() => {
    if (Platform.OS === 'web') {
      const hash = window.location.hash;
      if (hash && hash.includes('session_id=')) {
        const sessionId = hash.split('session_id=')[1]?.split('&')[0];
        if (sessionId) {
          handleSessionExchange(sessionId);
          window.history.replaceState(null, '', window.location.pathname);
        }
      }
    }
  }, []);

  useEffect(() => {
    if (!loading && user) {
      router.replace('/(tabs)/home');
    }
  }, [user, loading]);

  const handleSessionExchange = async (sessionId: string) => {
    setAuthLoading(true);
    try {
      const userData = await exchangeSession(sessionId);
      setUser({ user_id: userData.user_id, email: userData.email, name: userData.name, picture: userData.picture });
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

  const handleEmailSubmit = async () => {
    setError('');
    if (!email.trim() || !password.trim()) {
      setError('Email and password are required');
      return;
    }
    if (isSignUp && !name.trim()) {
      setError('Name is required');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setAuthLoading(true);
    try {
      let userData;
      if (isSignUp) {
        userData = await registerEmail(email.trim(), password, name.trim());
      } else {
        userData = await loginEmail(email.trim(), password);
      }
      setUser({ user_id: userData.user_id, email: userData.email, name: userData.name, picture: userData.picture || '' });
      router.replace('/(tabs)/home');
    } catch (e: any) {
      setError(e.message || 'Authentication failed');
    } finally {
      setAuthLoading(false);
    }
  };

  if (loading || (authLoading && !showEmailForm)) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          {/* Logo */}
          <View style={styles.logoSection}>
            <View style={styles.iconWrap}>
              <Feather name="bookmark" size={40} color={colors.primary} />
            </View>
            <Text style={styles.appName}>LinkStash</Text>
            <Text style={styles.tagline}>Save anything. Find everything.</Text>
          </View>

          {!showEmailForm ? (
            <>
              {/* Feature list */}
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

              {/* Google Login */}
              <TouchableOpacity
                testID="google-login-btn"
                style={styles.googleBtn}
                onPress={handleGoogleLogin}
                activeOpacity={0.8}
              >
                <Feather name="log-in" size={20} color={colors.primaryForeground} />
                <Text style={styles.googleBtnText}>Sign in with Google</Text>
              </TouchableOpacity>

              {/* Divider */}
              <View style={styles.divider}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>or</Text>
                <View style={styles.dividerLine} />
              </View>

              {/* Email Login Button */}
              <TouchableOpacity
                testID="show-email-form-btn"
                style={styles.emailToggleBtn}
                onPress={() => setShowEmailForm(true)}
                activeOpacity={0.8}
              >
                <Feather name="mail" size={20} color={colors.text.heading} />
                <Text style={styles.emailToggleText}>Continue with Email</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              {/* Email/Password Form */}
              <View style={styles.formSection}>
                <Text style={styles.formTitle}>{isSignUp ? 'Create Account' : 'Welcome Back'}</Text>

                {error ? (
                  <View style={styles.errorBox}>
                    <Feather name="alert-circle" size={14} color={colors.status.error} />
                    <Text style={styles.errorText}>{error}</Text>
                  </View>
                ) : null}

                {isSignUp && (
                  <TextInput
                    testID="name-input"
                    style={styles.input}
                    placeholder="Full Name"
                    placeholderTextColor={colors.text.muted}
                    value={name}
                    onChangeText={setName}
                    autoCapitalize="words"
                  />
                )}

                <TextInput
                  testID="email-input"
                  style={styles.input}
                  placeholder="Email"
                  placeholderTextColor={colors.text.muted}
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  keyboardType="email-address"
                />

                <TextInput
                  testID="password-input"
                  style={styles.input}
                  placeholder="Password (min 6 chars)"
                  placeholderTextColor={colors.text.muted}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                />

                <TouchableOpacity
                  testID="email-submit-btn"
                  style={[styles.submitBtn, authLoading && styles.submitBtnDisabled]}
                  onPress={handleEmailSubmit}
                  disabled={authLoading}
                  activeOpacity={0.8}
                >
                  {authLoading ? (
                    <ActivityIndicator size="small" color={colors.primaryForeground} />
                  ) : (
                    <Text style={styles.submitBtnText}>
                      {isSignUp ? 'Create Account' : 'Sign In'}
                    </Text>
                  )}
                </TouchableOpacity>

                {/* Toggle Login/Signup */}
                <TouchableOpacity
                  testID="toggle-auth-mode-btn"
                  style={styles.toggleRow}
                  onPress={() => { setIsSignUp(!isSignUp); setError(''); }}
                >
                  <Text style={styles.toggleText}>
                    {isSignUp ? 'Already have an account? ' : "Don't have an account? "}
                  </Text>
                  <Text style={styles.toggleLink}>
                    {isSignUp ? 'Sign In' : 'Sign Up'}
                  </Text>
                </TouchableOpacity>

                {/* Divider */}
                <View style={styles.divider}>
                  <View style={styles.dividerLine} />
                  <Text style={styles.dividerText}>or</Text>
                  <View style={styles.dividerLine} />
                </View>

                {/* Google Login (secondary) */}
                <TouchableOpacity
                  testID="google-login-secondary-btn"
                  style={styles.emailToggleBtn}
                  onPress={handleGoogleLogin}
                  activeOpacity={0.8}
                >
                  <Feather name="log-in" size={18} color={colors.text.heading} />
                  <Text style={styles.emailToggleText}>Sign in with Google</Text>
                </TouchableOpacity>

                {/* Back to main */}
                <TouchableOpacity
                  testID="back-to-main-btn"
                  style={styles.backRow}
                  onPress={() => { setShowEmailForm(false); setError(''); }}
                >
                  <Feather name="arrow-left" size={16} color={colors.text.muted} />
                  <Text style={styles.backText}>Back</Text>
                </TouchableOpacity>
              </View>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: spacing.lg,
    justifyContent: 'center',
    paddingVertical: spacing.xl,
  },
  logoSection: {
    alignItems: 'center',
    marginBottom: spacing.xl,
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
  features: {
    marginBottom: spacing.xl,
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
  googleBtn: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.full,
    paddingVertical: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  googleBtnText: {
    fontSize: fontSize.base,
    fontWeight: '700',
    color: colors.primaryForeground,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: spacing.md,
    gap: spacing.md,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.border,
  },
  dividerText: {
    fontSize: fontSize.sm,
    color: colors.text.muted,
  },
  emailToggleBtn: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.full,
    paddingVertical: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  emailToggleText: {
    fontSize: fontSize.base,
    fontWeight: '600',
    color: colors.text.heading,
  },
  formSection: {
    gap: spacing.md,
  },
  formTitle: {
    fontSize: fontSize['2xl'],
    fontWeight: '900',
    color: colors.text.heading,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderRadius: borderRadius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },
  errorText: {
    fontSize: fontSize.sm,
    color: colors.status.error,
    flex: 1,
  },
  input: {
    backgroundColor: colors.surfaceHighlight,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    color: colors.text.heading,
    fontSize: fontSize.base,
    borderWidth: 1,
    borderColor: colors.border,
  },
  submitBtn: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.full,
    paddingVertical: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.sm,
  },
  submitBtnDisabled: {
    opacity: 0.6,
  },
  submitBtnText: {
    fontSize: fontSize.base,
    fontWeight: '700',
    color: colors.primaryForeground,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  toggleText: {
    fontSize: fontSize.sm,
    color: colors.text.muted,
  },
  toggleLink: {
    fontSize: fontSize.sm,
    color: colors.primary,
    fontWeight: '700',
  },
  backRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
  backText: {
    fontSize: fontSize.sm,
    color: colors.text.muted,
  },
});
