import React, { useState, useEffect } from 'react';
import { View, StyleSheet, TextInput, Pressable, ActivityIndicator, Image, Alert, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as AppleAuthentication from 'expo-apple-authentication';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { Button } from '@/components/Button';
import { KeyboardAwareScrollViewCompat } from '@/components/KeyboardAwareScrollViewCompat';
import { useTheme } from '@/hooks/useTheme';
import { useAuth } from '@/context/AuthContext';
import { Spacing, BorderRadius, Colors } from '@/constants/theme';

export default function AuthScreen() {
  const insets = useSafeAreaInsets();
  const { theme, isDark } = useTheme();
  const { signIn, signUp, signInWithApple, resetPassword } = useAuth();
  
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isAppleLoading, setIsAppleLoading] = useState(false);
  const [isAppleAvailable, setIsAppleAvailable] = useState(false);

  useEffect(() => {
    if (Platform.OS === 'ios') {
      AppleAuthentication.isAvailableAsync().then(setIsAppleAvailable);
    }
  }, []);

  const handleSubmit = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Error', 'Please fill in all required fields');
      return;
    }
    
    if (!isLogin && !displayName.trim()) {
      Alert.alert('Error', 'Please enter your name');
      return;
    }

    setIsLoading(true);
    try {
      if (isLogin) {
        await signIn(email.trim(), password);
      } else {
        await signUp(email.trim(), password, displayName.trim());
      }
    } catch (error: any) {
      let message = 'Authentication failed. Please try again.';
      const code = error?.code;
      if (code === 'auth/invalid-email') {
        message = 'Please enter a valid email address.';
      } else if (code === 'auth/user-not-found') {
        message = 'No account found with this email. Please sign up.';
      } else if (code === 'auth/wrong-password') {
        message = 'Incorrect password. Please try again.';
      } else if (code === 'auth/email-already-in-use') {
        message = 'This email is already registered. Please sign in.';
      } else if (code === 'auth/weak-password') {
        message = 'Password should be at least 6 characters.';
      } else if (code === 'auth/invalid-credential') {
        message = 'Invalid email or password. Please check and try again.';
      } else if (code === 'auth/operation-not-allowed') {
        message = 'Email/password sign-in is not enabled. Please enable it in Firebase Console.';
      } else if (code === 'auth/invalid-api-key') {
        message = 'Firebase configuration error. Please check your API key.';
      } else if (error?.message) {
        message = error.message;
      }
      Alert.alert('Error', message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAppleSignIn = async () => {
    setIsAppleLoading(true);
    try {
      await signInWithApple();
    } catch (error: any) {
      if (error?.code === 'ERR_REQUEST_CANCELED') {
        return;
      }
      console.error('Apple Sign-In error:', error);
      const errorMessage = error?.message || '';
      if (errorMessage.includes('unknown reason') || errorMessage.includes('authorization attempt failed')) {
        Alert.alert(
          'Apple Sign-In Unavailable',
          'Apple Sign-In requires a production app build. Please use email/password sign-in for now, or test on a published app.'
        );
      } else {
        Alert.alert('Error', 'Failed to sign in with Apple. Please try again.');
      }
    } finally {
      setIsAppleLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!email.trim()) {
      Alert.alert('Enter Email', 'Please enter your email address first, then tap Forgot Password.');
      return;
    }

    try {
      await resetPassword(email.trim());
      Alert.alert('Email Sent', 'Check your email for a link to reset your password.');
    } catch (error: any) {
      let message = 'Failed to send reset email. Please try again.';
      if (error?.code === 'auth/user-not-found') {
        message = 'No account found with this email.';
      } else if (error?.code === 'auth/invalid-email') {
        message = 'Please enter a valid email address.';
      }
      Alert.alert('Error', message);
    }
  };

  const inputStyle = [
    styles.input,
    {
      backgroundColor: theme.backgroundDefault,
      color: theme.text,
      borderColor: theme.border,
    },
  ];

  return (
    <ThemedView style={styles.container}>
      <KeyboardAwareScrollViewCompat
        style={styles.scrollView}
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: insets.top + Spacing['4xl'],
            paddingBottom: insets.bottom + Spacing['2xl'],
          },
        ]}
      >
        <View style={styles.header}>
          <Image
            source={require('../../assets/images/icon.png')}
            style={styles.logo}
            resizeMode="contain"
          />
          <ThemedText type="h1" style={styles.title}>DriveIQ</ThemedText>
          <ThemedText type="body" style={[styles.subtitle, { color: theme.textSecondary }]}>
            Smart vehicle maintenance tracking
          </ThemedText>
        </View>

        <View style={styles.form}>
          {!isLogin ? (
            <TextInput
              style={inputStyle}
              placeholder="Your Name"
              placeholderTextColor={theme.textSecondary}
              value={displayName}
              onChangeText={setDisplayName}
              autoCapitalize="words"
              autoComplete="name"
            />
          ) : null}
          
          <TextInput
            style={inputStyle}
            placeholder="Email"
            placeholderTextColor={theme.textSecondary}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
          />
          
          <TextInput
            style={inputStyle}
            placeholder="Password"
            placeholderTextColor={theme.textSecondary}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete={isLogin ? 'current-password' : 'new-password'}
          />

          <Button onPress={handleSubmit} disabled={isLoading || isAppleLoading}>
            {isLoading ? (
              <ActivityIndicator color={theme.buttonText} />
            ) : (
              isLogin ? 'Sign In' : 'Create Account'
            )}
          </Button>

          {isLogin ? (
            <Pressable onPress={handleForgotPassword} style={styles.forgotPassword}>
              <ThemedText type="body" style={{ color: theme.primary }}>
                Forgot Password?
              </ThemedText>
            </Pressable>
          ) : null}
        </View>

        {Platform.OS === 'ios' ? (
          <View style={styles.appleSection}>
            <View style={styles.divider}>
              <View style={[styles.dividerLine, { backgroundColor: theme.border }]} />
              <ThemedText type="body" style={{ color: theme.textSecondary, paddingHorizontal: Spacing.md }}>
                or
              </ThemedText>
              <View style={[styles.dividerLine, { backgroundColor: theme.border }]} />
            </View>

            <AppleAuthentication.AppleAuthenticationButton
              buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
              buttonStyle={isDark ? AppleAuthentication.AppleAuthenticationButtonStyle.WHITE : AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
              cornerRadius={BorderRadius.sm}
              style={styles.appleButton}
              onPress={handleAppleSignIn}
            />
          </View>
        ) : null}

        <View style={styles.footer}>
          <ThemedText type="body" style={{ color: theme.textSecondary }}>
            {isLogin ? "Don't have an account?" : 'Already have an account?'}
          </ThemedText>
          <Pressable onPress={() => setIsLogin(!isLogin)}>
            <ThemedText type="link" style={styles.switchText}>
              {isLogin ? 'Sign Up' : 'Sign In'}
            </ThemedText>
          </Pressable>
        </View>
      </KeyboardAwareScrollViewCompat>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: Spacing.xl,
    justifyContent: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: Spacing['4xl'],
  },
  logo: {
    width: 100,
    height: 100,
    marginBottom: Spacing.lg,
  },
  title: {
    marginBottom: Spacing.sm,
  },
  subtitle: {
    textAlign: 'center',
  },
  form: {
    gap: Spacing.lg,
    marginBottom: Spacing['3xl'],
  },
  input: {
    height: Spacing.inputHeight,
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.lg,
    fontSize: 16,
    borderWidth: 1,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  switchText: {
    fontWeight: '600',
  },
  forgotPassword: {
    alignItems: 'center',
    paddingVertical: Spacing.sm,
  },
  appleSection: {
    marginBottom: Spacing['2xl'],
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  dividerLine: {
    flex: 1,
    height: 1,
  },
  appleButton: {
    width: '100%',
    height: Spacing.buttonHeight,
  },
});
