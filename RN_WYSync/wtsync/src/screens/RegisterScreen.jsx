import React, { useState } from 'react';
import {
  View,
  Image,
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

import { registerUser } from '../services/AuthService';
import { useAppTheme } from '../services/theme';

const RegisterScreen = ({ navigation }) => {
  const { colors } = useAppTheme();
  const styles = createStyles(colors);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [focused, setFocused] = useState(null);
  const [loading, setLoading] = useState(false);
  const [contact, setContact] = useState('')

  const handleRegister = async () => {
    if (!name || !email || !password || !confirmPassword || !contact) {
      Alert.alert('Error', 'Please fill all fields');
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match');
      return;
    }

    if (password.length < 6) {
      Alert.alert('Error', 'Password should be at least 6 characters');
      return;
    }

    setLoading(true);
    const result = await registerUser(name, email, password, contact);
    setLoading(false);

    if (result.success) {
      Alert.alert('Success', 'Registration Successful');
      navigation.replace('Main');
    } else {
      Alert.alert('Registration Failed', result.message);
    }
  };

  const renderInput = (
    key,
    placeholder,
    value,
    setter,
    extraProps = {},
  ) => (
    <View style={styles.fieldGroup}>
      <Text style={styles.label}>{placeholder}</Text>
      <TextInput
        placeholder={placeholder}
        placeholderTextColor={colors.subText}
        style={[styles.input, focused === key && styles.inputFocused]}
        value={value}
        onChangeText={setter}
        onFocus={() => setFocused(key)}
        onBlur={() => setFocused(null)}
        {...extraProps}
      />
    </View>
  );

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>
        <View style={styles.logoCircle}>
          <Image
            source={require('../assests/images/logo.png')}
            style={styles.logo}
            resizeMode="contain"
          />
        </View>

        <Text style={styles.title}>Create account</Text>
        <Text style={styles.subtitle}>Sign up to get started with WireTempSync</Text>

        <View style={styles.form}>
          {renderInput('name', 'Full Name', name, setName)}
          {renderInput('email', 'Email', email, setEmail, {
            keyboardType: 'email-address',
            autoCapitalize: 'none',
          })}

          {renderInput(
            'contact',
            'Contact Number',
            contact,
            setContact,
            {
              keyboardType: 'phone-pad',
              maxLength: 10,
            },
          )}

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Password</Text>
            <View
              style={[
                styles.passwordWrapper,
                focused === 'password' && styles.inputFocused,
              ]}>
              <TextInput
                placeholder="Password"
                placeholderTextColor={colors.subText}
                style={styles.passwordInput}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                onFocus={() => setFocused('password')}
                onBlur={() => setFocused(null)}
              />
              <TouchableOpacity
                onPress={() => setShowPassword(!showPassword)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Feather
                  name={showPassword ? 'eye-off' : 'eye'}
                  size={18}
                  color={colors.subText}
                />
              </TouchableOpacity>
            </View>
          </View>

          {renderInput(
            'confirm',
            'Confirm Password',
            confirmPassword,
            setConfirmPassword,
            { secureTextEntry: !showPassword },
          )}

          <TouchableOpacity
            style={styles.button}
            onPress={handleRegister}
            activeOpacity={0.85}
            disabled={loading}>
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Register</Text>
            )}
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          onPress={() => navigation.navigate('Login')}
          style={styles.footer}>
          <Text style={styles.footerText}>
            Already have an account?{' '}
            <Text style={styles.footerLink}>Login</Text>
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

export default RegisterScreen;

const createStyles = (colors) => StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  container: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
    paddingVertical: 48,
  },
  logoCircle: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: colors.card,
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
    marginBottom: 24,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#0B0D12',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.05,
    shadowRadius: 16,
    elevation: 2,
  },
  logo: {
    width: 34,
    height: 34,
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
    marginTop: 6,
    marginBottom: 32,
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
    marginBottom: 14,
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
  passwordWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.background,
    borderRadius: 12,
    paddingHorizontal: 14,
  },
  passwordInput: {
    flex: 1,
    paddingVertical: 14,
    fontSize: 15,
    fontWeight: '500',
    color: colors.text,
  },
  button: {
    backgroundColor: '#0B0D12',
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
    marginTop: 8,
    shadowColor: '#0B0D12',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.16,
    shadowRadius: 14,
    elevation: 3,
  },
  buttonText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  footer: { marginTop: 28, alignItems: 'center' },
  footerText: { color: colors.subText, fontSize: 14 },
  footerLink: { color: '#4F46E5', fontWeight: '700' },
});