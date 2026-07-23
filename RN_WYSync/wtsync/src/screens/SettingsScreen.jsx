import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Switch,
  Alert,
  Animated,
} from 'react-native';

import React, { useEffect, useState, useCallback, useRef } from 'react';

import { getUserDetails } from '../services/AuthService';

import { getProducts } from '../services/ProductApi';

import { logoutUser } from '../services/AuthService';

import Feather from 'react-native-vector-icons/Feather';

const SettingsScreen = ({ navigation }) => {
  const [user, setuser] = useState(null);

  const [loading, setLoading] = useState(true);

  const [products, setProducts] = useState([]);
  const [productCount, setProductCount] = useState(null);

  // Notification preferences
  const [smsEnabled, setSmsEnabled] = useState(false);
  const [smsNumber, setSmsNumber] = useState('');
  const [emailEnabled, setEmailEnabled] = useState(false);
  const [notificationEmail, setNotificationEmail] = useState('');
  const [notificationErrors, setNotificationErrors] = useState({});

  // Header fade-in animation
  const headerFade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    loadSettingData();

    Animated.timing(headerFade, {
      toValue: 1,
      duration: 400,
      useNativeDriver: true,
    }).start();
  }, []);

  const loadSettingData = async () => {
    try {
      setLoading(true);

      const userResult = await getUserDetails();

      if (userResult.success) {
        console.log('sejal want to see this user details ', userResult.user);
        setuser(userResult.user);

        // Default the notification destinations to the account's
        // email/contact the first time we load, user can still change them
        setSmsNumber((prev) => prev || userResult.user?.contact || '');
        setNotificationEmail((prev) => prev || userResult.user?.email || '');
      }

      const productResult = await getProducts();
      if (productResult.success) {
        console.log(
          'sejal want to see the product list and no',
          productResult.products,
        );
        console.log(
          'sejal want to see the product list and no',
          productResult.products.length,
        );

        setProducts(productResult.products);
        setProductCount(productResult.products.length);
      }
    } catch (error) {
      console.log('Setting screen ', error);
    } finally {
      setLoading(false);
    }
  };

  const userName = user?.name || '';
  const email = user?.email || '';
  const contact = user?.contact || '';

  const validateNotificationSettings = useCallback(() => {
    const newErrors = {};

    if (smsEnabled) {
      const digitsOnly = (smsNumber || '').replace(/\D/g, '');
      if (!digitsOnly) {
        newErrors.smsNumber = 'Enter a phone number for SMS alerts';
      } else if (digitsOnly.length !== 10) {
        newErrors.smsNumber = 'Phone number must be 10 digits';
      }
    }

    if (emailEnabled) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!notificationEmail || !notificationEmail.trim()) {
        newErrors.notificationEmail = 'Enter an email for alerts';
      } else if (!emailRegex.test(notificationEmail.trim())) {
        newErrors.notificationEmail = 'Enter a valid email address';
      }
    }

    setNotificationErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [smsEnabled, smsNumber, emailEnabled, notificationEmail]);

  const handleSaveNotifications = useCallback(() => {
    const isValid = validateNotificationSettings();

    if (!isValid) {
      Alert.alert('Please fix the highlighted fields', 'Some information needs your attention.');
      return;
    }

    const notificationSettings = {
      smsEnabled,
      smsNumber: smsEnabled ? smsNumber.trim() : '',
      emailEnabled,
      notificationEmail: emailEnabled ? notificationEmail.trim() : '',
    };

    console.log(notificationSettings);

    // API integration will be added here later
  }, [validateNotificationSettings, smsEnabled, smsNumber, emailEnabled, notificationEmail]);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      {/* Header */}
      <Animated.View style={[styles.header, { opacity: headerFade }]}>
        <Text style={styles.greeting}>Account</Text>
        <Text style={styles.screenTitle}>Settings</Text>
      </Animated.View>

      {/* Identity Card */}
      <View style={styles.identityCard}>
        <View style={styles.identityTop}>
          <View style={styles.identityAvatar}>
            <Text style={styles.identityAvatarText}>
              {userName ? userName.charAt(0).toUpperCase() : 'U'}
            </Text>
          </View>
          <View style={styles.identityInfo}>
            <Text style={styles.identityName} numberOfLines={1}>
              {userName || '—'}
            </Text>
            <Text style={styles.identityEmail} numberOfLines={1}>
              {email || '—'}
            </Text>
          </View>
          <View style={styles.statusBadge}>
            <View style={styles.statusDot} />
            <Text style={styles.statusText}>ACTIVE</Text>
          </View>
        </View>
      </View>

      {/* Profile Section */}
      <View style={styles.section}>
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>Profile</Text>
          <Feather name="user" size={16} color="#9CA3AF" />
        </View>

        <View style={styles.card}>
          <View style={styles.dataRow}>
            <Text style={styles.dataLabel}>Name</Text>
            <Text style={styles.dataValue} numberOfLines={1}>
              {userName || 'Not set'}
            </Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.dataRow}>
            <Text style={styles.dataLabel}>Email</Text>
            <Text style={styles.dataValue} numberOfLines={1}>
              {email || 'Not set'}
            </Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.dataRow}>
            <Text style={styles.dataLabel}>Phone</Text>
            <Text style={styles.dataValue} numberOfLines={1}>
              {contact || 'Not available'}
            </Text>
          </View>

          <TouchableOpacity
            style={styles.editButton}
            activeOpacity={0.85}
            onPress={() => navigation.navigate('EditProfile')}
          >
            <Text style={styles.editButtonText}>Edit Profile</Text>
            <Feather name="arrow-right" size={16} color="#4F46E5" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Notifications Section */}
      <View style={styles.section}>
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>Notifications</Text>
          <Feather name="bell" size={16} color="#9CA3AF" />
        </View>

        <View style={styles.card}>
          {/* SMS Alerts */}
          <View style={styles.switchRow}>
            <View style={styles.switchTextWrapper}>
              <Text style={styles.deviceLabel}>SMS Alerts</Text>
              <Text style={styles.deviceSubLabel}>
                Receive updates via text message
              </Text>
            </View>
            <Switch
              value={smsEnabled}
              onValueChange={setSmsEnabled}
              trackColor={{ false: '#E5E7EB', true: '#34D399' }}
              thumbColor="#FFFFFF"
              ios_backgroundColor="#E5E7EB"
            />
          </View>

          {smsEnabled ? (
            <View style={styles.fieldWrapper}>
              <Text style={styles.fieldLabel}>Send SMS To</Text>
              <View
                style={[
                  styles.inputRow,
                  notificationErrors.smsNumber && styles.inputRowError,
                ]}
              >
                <TextInput
                  style={styles.textInput}
                  value={smsNumber}
                  onChangeText={setSmsNumber}
                  placeholder="Enter phone number"
                  placeholderTextColor="#B4B8C2"
                  keyboardType="phone-pad"
                />
              </View>
              {notificationErrors.smsNumber ? (
                <Text style={styles.errorText}>{notificationErrors.smsNumber}</Text>
              ) : null}
            </View>
          ) : null}

          <View style={styles.divider} />

          {/* Email Alerts */}
          <View style={styles.switchRow}>
            <View style={styles.switchTextWrapper}>
              <Text style={styles.deviceLabel}>Email Alerts</Text>
              <Text style={styles.deviceSubLabel}>
                Receive updates via email
              </Text>
            </View>
            <Switch
              value={emailEnabled}
              onValueChange={setEmailEnabled}
              trackColor={{ false: '#E5E7EB', true: '#34D399' }}
              thumbColor="#FFFFFF"
              ios_backgroundColor="#E5E7EB"
            />
          </View>

          {emailEnabled ? (
            <View style={[styles.fieldWrapper, styles.fieldWrapperLast]}>
              <Text style={styles.fieldLabel}>Send Email To</Text>
              <View
                style={[
                  styles.inputRow,
                  notificationErrors.notificationEmail && styles.inputRowError,
                ]}
              >
                <TextInput
                  style={styles.textInput}
                  value={notificationEmail}
                  onChangeText={setNotificationEmail}
                  placeholder="Enter email address"
                  placeholderTextColor="#B4B8C2"
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
              </View>
              {notificationErrors.notificationEmail ? (
                <Text style={styles.errorText}>
                  {notificationErrors.notificationEmail}
                </Text>
              ) : null}
            </View>
          ) : null}

          {smsEnabled || emailEnabled ? (
            <TouchableOpacity
              style={styles.editButton}
              activeOpacity={0.85}
              onPress={handleSaveNotifications}
            >
              <Text style={styles.editButtonText}>Save Notification Preferences</Text>
              <Feather name="check" size={16} color="#4F46E5" />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      {/* Devices Section */}
      <View style={styles.section}>
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>My Devices</Text>
          <Feather name="cpu" size={16} color="#9CA3AF" />
        </View>

        <View style={styles.card}>
          <View style={styles.deviceRow}>
            <View>
              <Text style={styles.deviceLabel}>Registered Devices</Text>
              <Text style={styles.deviceSubLabel}>
                Connected to your account
              </Text>
            </View>
            <Text style={styles.deviceCount}>
              {loading ? '—' : productCount}
            </Text>
          </View>
        </View>
      </View>

      {/* Logout */}
      <TouchableOpacity
        style={styles.logoutButton}
        activeOpacity={0.85}
        onPress={() => {
          logoutUser();
          navigation.replace('Login');
        }}
      >
        <Feather
          name="log-out"
          size={18}
          color="#EF4444"
          style={styles.logoutIcon}
        />
        <Text style={styles.logoutText}>Logout</Text>
      </TouchableOpacity>

      <Text style={styles.version}>WireTempSync v1.0.0</Text>
    </ScrollView>
  );
};

export default SettingsScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFAFB',
  },
  contentContainer: {
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 48,
  },

  // Header
  header: {
    width: '100%',
    marginBottom: 32,
  },
  greeting: {
    fontSize: 13,
    fontWeight: '500',
    color: '#9CA3AF',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  screenTitle: {
    fontSize: 34,
    fontWeight: '800',
    color: '#0B0D12',
    letterSpacing: -0.6,
    width: '100%',
  },

  // Identity Card
  identityCard: {
    backgroundColor: '#0B0D12',
    borderRadius: 24,
    padding: 22,
    marginBottom: 32,
    shadowColor: '#0B0D12',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.18,
    shadowRadius: 24,
    elevation: 3,
  },
  identityTop: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  identityAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(255,255,255,0.12)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  identityAvatarText: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
  },
  identityInfo: {
    flex: 1,
    marginRight: 10,
  },
  identityName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 3,
  },
  identityEmail: {
    fontSize: 13,
    fontWeight: '400',
    color: 'rgba(255,255,255,0.5)',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(52,211,153,0.16)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#34D399',
    marginRight: 6,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#34D399',
    letterSpacing: 0.4,
  },

  // Sections
  section: {
    marginBottom: 28,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0B0D12',
    letterSpacing: -0.2,
  },

  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingHorizontal: 18,
    paddingVertical: 6,
    shadowColor: '#0B0D12',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.04,
    shadowRadius: 16,
    elevation: 1,
    borderWidth: 1,
    borderColor: '#F0F1F4',
  },

  dataRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
  },
  dataLabel: {
    fontSize: 14,
    fontWeight: '400',
    color: '#8A8F98',
  },
  dataValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0B0D12',
    maxWidth: '60%',
    textAlign: 'right',
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#EEEFF2',
  },

  editButton: {
    marginTop: 10,
    marginBottom: 16,
    backgroundColor: '#F4F4FE',
    borderRadius: 14,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  editButtonText: {
    color: '#4F46E5',
    fontWeight: '700',
    fontSize: 14,
  },

  // Notification switches
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
  },
  switchTextWrapper: {
    flex: 1,
    marginRight: 12,
  },

  // Notification destination fields
  fieldWrapper: {
    paddingBottom: 16,
  },
  fieldWrapperLast: {
    paddingBottom: 6,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#9CA3AF',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F7F7F9',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#F0F1F4',
  },
  inputRowError: {
    borderColor: '#FCA5A5',
    backgroundColor: '#FEF4F4',
  },
  textInput: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: '#0B0D12',
    padding: 0,
  },
  errorText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#EF4444',
    marginTop: 6,
  },

  // Devices
  deviceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 18,
  },
  deviceLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0B0D12',
    marginBottom: 3,
  },
  deviceSubLabel: {
    fontSize: 12,
    fontWeight: '400',
    color: '#9CA3AF',
  },
  deviceCount: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0B0D12',
    letterSpacing: -0.4,
  },

  // Logout
  logoutButton: {
    marginTop: 8,
    marginBottom: 24,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#FCE4E4',
    paddingVertical: 16,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoutIcon: {
    marginRight: 8,
  },
  logoutText: {
    color: '#EF4444',
    fontWeight: '700',
    fontSize: 15,
  },  

  version: {
    textAlign: 'center',
    color: '#C7C9D1',
    fontSize: 12,
    fontWeight: '500',
    letterSpacing: 0.2,
  },
});