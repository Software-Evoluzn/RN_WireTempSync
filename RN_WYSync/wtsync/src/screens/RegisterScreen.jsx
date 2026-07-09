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

import { registerUser } from '../services/AuthService';

const RegisterScreen = ({ navigation }) => {
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
    const result = await registerUser(name,email, password,contact);
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
    <>
      <Text style={styles.label}>{placeholder}</Text>
      <TextInput
        placeholder={placeholder}
        placeholderTextColor="#94A3B8"
        style={[styles.input, focused === key && styles.inputFocused]}
        value={value}
        onChangeText={setter}
        onFocus={() => setFocused(key)}
        onBlur={() => setFocused(null)}
        {...extraProps}
      />
    </>
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
        <Text style={styles.subtitle}>Sign up to get started</Text>

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

          <Text style={styles.label}>Password</Text>
          <View
            style={[
              styles.passwordWrapper,
              focused === 'password' && styles.inputFocused,
            ]}>
            <TextInput
              placeholder="Password"
              placeholderTextColor="#94A3B8"
              style={styles.passwordInput}
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              onFocus={() => setFocused('password')}
              onBlur={() => setFocused(null)}
            />
            <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
              <Text style={styles.showText}>
                {showPassword ? 'Hide' : 'Show'}
              </Text>
            </TouchableOpacity>
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

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: '#F8FAFC' },
  container: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
    paddingVertical: 48,
  },
  logoCircle: {
    width: 72,
    height: 72,
    borderRadius: 22,
    backgroundColor: '#f3f3f7',
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
    marginBottom: 20,
    shadowColor: '#490735',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 14,
    elevation: 8,
  },
  logoText: { fontSize: 34, fontWeight: '800', color: '#fff' },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#0F172A',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 15,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 6,
    marginBottom: 28,
  },
  form: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 20,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.06,
    shadowRadius: 24,
    elevation: 4,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
    marginBottom: 6,
    marginTop: 6,
  },
  input: {
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 15,
    color: '#0F172A',
    marginBottom: 6,
  },
  inputFocused: { borderColor: '#6366F1', backgroundColor: '#fff' },
  passwordWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    paddingHorizontal: 14,
    marginBottom: 6,
  },
  passwordInput: {
    flex: 1,
    paddingVertical: 13,
    fontSize: 15,
    color: '#0F172A',
  },
  showText: { color: '#6366F1', fontWeight: '600', fontSize: 13 },
  button: {
    backgroundColor: '#6366F1',
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
    marginTop: 18,
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  footer: { marginTop: 24, alignItems: 'center' },
  footerText: { color: '#64748B', fontSize: 14 },
  footerLink: { color: '#6366F1', fontWeight: '700' },
});