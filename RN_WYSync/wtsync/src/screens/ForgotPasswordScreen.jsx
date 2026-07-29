import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  StyleSheet,
  KeyboardAvoidingView,
  ScrollView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import Feather from 'react-native-vector-icons/Feather';

import { forgotPassword } from '../services/AuthService';
import { useAppTheme } from '../services/theme';

const ForgotPasswordScreen = ({ navigation }) => {
  const { colors } = useAppTheme();
  const styles = createStyles(colors);

  const [email, setEmail] = useState('');
  const [focused, setFocused] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleReset = async () => {
    if (!email) {
      Alert.alert('Error', 'Please enter your email');
      return;
    }

    setLoading(true);
    const result = await forgotPassword(email);
    setLoading(false);

    if (result.success) {
      Alert.alert('Success', 'Password reset link sent to your email.');
      navigation.goBack();
    } else {
      Alert.alert('Error', result.message);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Feather name="arrow-left" size={18} color={colors.text} />
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>

        <View style={styles.iconCircle}>
          <Feather name="lock" size={28} color="#4F46E5" />
        </View>

        <Text style={styles.title}>Forgot Password?</Text>
        <Text style={styles.subtitle}>
          Enter your email and we'll send you a link to reset your password.
        </Text>

        <View style={styles.form}>
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Email</Text>
            <TextInput
              placeholder="you@example.com"
              placeholderTextColor={colors.subText}
              value={email}
              onChangeText={setEmail}
              style={[styles.input, focused && styles.inputFocused]}
              keyboardType="email-address"
              autoCapitalize="none"
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
            />
          </View>

          <TouchableOpacity
            style={styles.button}
            onPress={handleReset}
            activeOpacity={0.85}
            disabled={loading}>
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Send Reset Link</Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

export default ForgotPasswordScreen;

const createStyles = (colors) => StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  container: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
  },
  backButton: {
    position: 'absolute',
    top: 48,
    left: 24,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  backText: { color: colors.text, fontSize: 14, fontWeight: '600' },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 22,
    backgroundColor: '#F4F4FE',
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
    letterSpacing: -0.4,
  },
  subtitle: {
    fontSize: 14,
    color: colors.subText,
    textAlign: 'center',
    marginTop: 10,
    marginBottom: 32,
    lineHeight: 21,
    paddingHorizontal: 12,
  },
  form: {
    backgroundColor: colors.card,
    borderRadius: 22,
    padding: 20,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#0B0D12',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.04,
    shadowRadius: 20,
    elevation: 2,
  },
  fieldGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.subText,
    marginBottom: 8,
    letterSpacing: 0.2,
  },
  input: {
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.background,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: 15,
    fontWeight: '500',
    color: colors.text,
  },
  inputFocused: { borderColor: '#4F46E5', backgroundColor: colors.card },
  button: {
    backgroundColor: '#0B0D12',
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
    shadowColor: '#0B0D12',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.16,
    shadowRadius: 14,
    elevation: 3,
  },
  buttonText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});