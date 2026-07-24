import React, { useState, useCallback, useEffect, memo } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Switch,
  KeyboardAvoidingView,
  SafeAreaView,
  Platform,
  Alert,
} from 'react-native';
import Feather from 'react-native-vector-icons/Feather';
import { updateProfile } from "../services/AuthService";
import { getUserDetails } from "../services/AuthService";

/* -------------------------------------------------------------------------- */
/*  Reusable Components                                                       */
/* -------------------------------------------------------------------------- */

const SectionCard = memo(({ title, icon, children, style }) => {
  return (
    <View style={[styles.section, style]}>
      {title ? (
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>{title}</Text>
          {icon ? <Feather name={icon} size={16} color="#9CA3AF" /> : null}
        </View>
      ) : null}
      <View style={styles.card}>{children}</View>
    </View>
  );
});

const InputField = memo(
  ({
    label,
    value,
    onChangeText,
    placeholder,
    keyboardType = 'default',
    error,
    isPassword = false,
    passwordVisible = false,
    onTogglePassword,
    autoCapitalize = 'sentences',
    isLast = false,
  }) => {
    return (
      <View style={[styles.fieldWrapper, isLast && styles.fieldWrapperLast]}>
        <Text style={styles.fieldLabel}>{label}</Text>
        <View style={[styles.inputRow, error && styles.inputRowError]}>
          <TextInput
            style={styles.textInput}
            value={value}
            onChangeText={onChangeText}
            placeholder={placeholder}
            placeholderTextColor="#B4B8C2"
            keyboardType={keyboardType}
            autoCapitalize={autoCapitalize}
            secureTextEntry={isPassword && !passwordVisible}
          />
          {isPassword ? (
            <TouchableOpacity
              onPress={onTogglePassword}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Feather
                name={passwordVisible ? 'eye-off' : 'eye'}
                size={18}
                color="#9CA3AF"
              />
            </TouchableOpacity>
          ) : null}
        </View>
        {error ? <Text style={styles.errorText}>{error}</Text> : null}
      </View>
    );
  }
);

const ReadOnlyRow = memo(({ label, value, isLast = false }) => {
  return (
    <View>
      <View style={styles.dataRow}>
        <Text style={styles.dataLabel}>{label}</Text>
        <Text style={styles.dataValue} numberOfLines={1}>
          {value || 'Not available'}
        </Text>
      </View>
      {!isLast ? <View style={styles.divider} /> : null}
    </View>
  );
});

const NotificationSwitch = memo(({ label, subLabel, value, onValueChange, isLast = false }) => {
  return (
    <View>
      <View style={styles.switchRow}>
        <View style={styles.switchTextWrapper}>
          <Text style={styles.deviceLabel}>{label}</Text>
          {subLabel ? <Text style={styles.deviceSubLabel}>{subLabel}</Text> : null}
        </View>
        <Switch
          value={value}
          onValueChange={onValueChange}
          trackColor={{ false: '#E5E7EB', true: '#34D399' }}
          thumbColor="#FFFFFF"
          ios_backgroundColor="#E5E7EB"
        />
      </View>
      {!isLast ? <View style={styles.divider} /> : null}
    </View>
  );
});

const ActionButton = memo(({ label, onPress, variant = 'primary', icon }) => {
  const isPrimary = variant === 'primary';
  return (
    <TouchableOpacity
      style={[styles.actionButton, isPrimary ? styles.primaryButton : styles.secondaryButton]}
      activeOpacity={0.85}
      onPress={onPress}
    >
      {icon ? (
        <Feather
          name={icon}
          size={16}
          color={isPrimary ? '#FFFFFF' : '#4B5563'}
          style={{ marginRight: 8 }}
        />
      ) : null}
      <Text style={isPrimary ? styles.primaryButtonText : styles.secondaryButtonText}>
        {label}
      </Text>
    </TouchableOpacity>
  );
});

const ProfileHeader = memo(({ name, email, phone, onChangePicture }) => {
  const initial = name ? name.charAt(0).toUpperCase() : 'U';
  return (
    <View style={styles.identityCard}>
      <View style={styles.identityTop}>
        <View style={styles.identityAvatarWrapper}>
          <View style={styles.identityAvatar}>
            <Text style={styles.identityAvatarText}>{initial}</Text>
          </View>
          <TouchableOpacity
            style={styles.editAvatarBadge}
            activeOpacity={0.85}
            onPress={onChangePicture}
          >
            <Feather name="camera" size={13} color="#0B0D12" />
          </TouchableOpacity>
        </View>

        <View style={styles.identityInfo}>
          <Text style={styles.identityName} numberOfLines={1}>
            {name || '—'}
          </Text>
          <Text style={styles.identityEmail} numberOfLines={1}>
            {email || '—'}
          </Text>
          <Text style={styles.identityPhone} numberOfLines={1}>
            {phone || '—'}
          </Text>
        </View>
      </View>
    </View>
  );
});

/* -------------------------------------------------------------------------- */
/*  Main Screen                                                               */
/* -------------------------------------------------------------------------- */

const EditProfile = ({ navigation }) => {
  // Profile fields
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [country, setCountry] = useState('');
  const [pincode, setPincode] = useState('');
  const [company, setCompany] = useState('');
  const [designation, setDesignation] = useState('');

  // Password fields
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Notification settings
  const [smsEnabled, setSmsEnabled] = useState(true);
  const [emailEnabled, setEmailEnabled] = useState(true);

  // Misc
  const [profileImage, setProfileImage] = useState(null);
  const [errors, setErrors] = useState({});

  // Read-only account info (would come from backend later)
  const [accountInfo, setAccountInfo] = useState({
    firebaseUid: '',
    accountCreated: '',
    lastLogin: '',
    appVersion: '1.0.0',
    registeredDevices: 6,
  });

  const loadUser = async () => {
    try {
      const result = await getUserDetails();

      if (result.success) {
        setName(result.user.name || '');
        setEmail(result.user.email || '');
        setPhone(result.user.contact || '');
      }
    } catch (e) {
      console.log(e);
    }
  };

  useEffect(() => {
    loadUser();

    setAccountInfo((prev) => ({
      ...prev,
      firebaseUid: 'fb_9f21a7c3e88b4d0c',
      accountCreated: '12 Jan 2025',
      lastLogin: '20 Jul 2026, 09:42 AM',
    }));
  }, []);

  const handleChangePicture = useCallback(() => {
    console.log('Change Profile Picture pressed');
    Alert.alert('Change Profile Picture', 'Photo picker will be connected here.');
  }, []);

  const validateForm = useCallback(() => {
    const newErrors = {};

    if (!name || !name.trim()) {
      newErrors.name = 'Name cannot be empty';
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !email.trim()) {
      newErrors.email = 'Email cannot be empty';
    } else if (!emailRegex.test(email.trim())) {
      newErrors.email = 'Enter a valid email address';
    }

    const digitsOnly = (phone || '').replace(/\D/g, '');
    if (!digitsOnly) {
      newErrors.phone = 'Phone number cannot be empty';
    } else if (digitsOnly.length !== 10) {
      newErrors.phone = 'Phone number must be 10 digits';
    }

    if (pincode && pincode.trim().length > 0 && pincode.trim().length !== 6) {
      newErrors.pincode = 'Pincode must be 6 digits';
    }

    if (currentPassword || newPassword || confirmPassword) {
      if (!currentPassword) {
        newErrors.currentPassword = 'Enter your current password';
      }
      if (newPassword && newPassword.length < 6) {
        newErrors.newPassword = 'Password must be at least 6 characters';
      }
      if (newPassword !== confirmPassword) {
        newErrors.confirmPassword = 'Passwords do not match';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [name, email, phone, pincode, currentPassword, newPassword, confirmPassword]);

  const handleSave = useCallback(async () => {
    const isValid = validateForm();

    if (!isValid) {
      Alert.alert(
        "Please fix the highlighted fields",
        "Some information needs your attention."
      );
      return;
    }

    const user = await getUserDetails();

    if (!user.success) {
      Alert.alert("Error", "Unable to load user.");
      return;
    }

    const body = {
      firebase_uid: user.user.firebase_uid,
      name: name.trim(),
      email: email.trim(),
      contact: phone.trim(),
    };

    const result = await updateProfile(body);

    if (result.success) {
      Alert.alert(
        "Success",
        "Profile Updated Successfully",
        [
          {
            text: "OK",
            onPress: () => navigation.goBack(),
          },
        ]
      );
    } else {
      Alert.alert(
        "Error",
        result.message
      );
    }
  }, [validateForm, name, email, phone, navigation]);

  const handleCancel = useCallback(() => {
    navigation.goBack();
  }, [navigation]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.flexOne}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 64 : 0}
      >
        <ScrollView
          style={styles.container}
          contentContainerStyle={styles.contentContainer}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity
              style={styles.backButton}
              activeOpacity={0.8}
              onPress={() => navigation.goBack()}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Feather name="arrow-left" size={20} color="#0B0D12" />
              <Text style={styles.backButtonText}>Back</Text>
            </TouchableOpacity>
            <Text style={styles.screenTitle}>Edit Profile</Text>
          </View>

          {/* Profile Card */}
          <ProfileHeader
            name={name}
            email={email}
            phone={phone}
            onChangePicture={handleChangePicture}
          />

          {/* Personal Information */}
          <SectionCard title="Personal Information" icon="user">
            <InputField
              label="Name"
              value={name}
              onChangeText={setName}
              placeholder="Enter your full name"
              error={errors.name}
            />
            <InputField
              label="Email"
              value={email}
              onChangeText={setEmail}
              placeholder="Enter your email"
              keyboardType="email-address"
              autoCapitalize="none"
              error={errors.email}
            />
            <InputField
              label="Phone Number"
              value={phone}
              onChangeText={setPhone}
              placeholder="Enter your phone number"
              keyboardType="phone-pad"
              error={errors.phone}
            />
          </SectionCard>

          {/* Notifications */}
          <SectionCard title="Notifications" icon="bell">
            <NotificationSwitch
              label="SMS Alerts"
              subLabel="Receive updates via text message"
              value={smsEnabled}
              onValueChange={setSmsEnabled}
            />
            <NotificationSwitch
              label="Email Alerts"
              subLabel="Receive updates via email"
              value={emailEnabled}
              onValueChange={setEmailEnabled}
              isLast
            />
          </SectionCard>

          {/* Device Preferences */}
          <SectionCard title="Device Preferences" icon="cpu">
            <View style={styles.deviceRow}>
              <View>
                <Text style={styles.deviceLabel}>Registered Devices</Text>
                <Text style={styles.deviceSubLabel}>Connected to your account</Text>
              </View>
              <Text style={styles.deviceCount}>{accountInfo.registeredDevices}</Text>
            </View>
          </SectionCard>

          {/* Action Buttons */}
          <View style={styles.buttonGroup}>
            <ActionButton label="Save Changes" onPress={handleSave} variant="primary" icon="check" />
            <ActionButton label="Cancel" onPress={handleCancel} variant="secondary" />
          </View>

          <Text style={styles.version}>WireTempSync v1.0.0</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

export default EditProfile;

/* -------------------------------------------------------------------------- */
/*  Styles                                                                     */
/* -------------------------------------------------------------------------- */

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FAFAFB',
  },
  flexOne: {
    flex: 1,
  },
  container: {
    flex: 1,
    backgroundColor: '#FAFAFB',
  },
  contentContainer: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 48,
  },

  // Header
  header: {
    marginBottom: 24,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    marginBottom: 14,
  },
  backButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#0B0D12',
    marginLeft: 6,
  },
  screenTitle: {
    fontSize: 30,
    fontWeight: '800',
    color: '#0B0D12',
    letterSpacing: -0.6,
  },

  // Identity / Profile Card
  identityCard: {
    backgroundColor: '#0B0D12',
    borderRadius: 24,
    padding: 22,
    marginBottom: 28,
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
  identityAvatarWrapper: {
    position: 'relative',
    marginRight: 16,
  },
  identityAvatar: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: 'rgba(255,255,255,0.12)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  identityAvatarText: {
    fontSize: 26,
    fontWeight: '700',
    color: '#fff',
  },
  editAvatarBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#0B0D12',
  },
  identityInfo: {
    flex: 1,
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
    marginBottom: 2,
  },
  identityPhone: {
    fontSize: 13,
    fontWeight: '400',
    color: 'rgba(255,255,255,0.5)',
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

  // Input fields
  fieldWrapper: {
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#EEEFF2',
  },
  fieldWrapperLast: {
    borderBottomWidth: 0,
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
    paddingVertical: Platform.OS === 'ios' ? 12 : 6,
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

  // Read only rows
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

  // Switch rows
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

  // Buttons
  buttonGroup: {
    marginTop: 8,
    gap: 12,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 16,
  },
  primaryButton: {
    backgroundColor: '#4F46E5',
    shadowColor: '#4F46E5',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 3,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 15,
  },
  secondaryButton: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  secondaryButtonText: {
    color: '#4B5563',
    fontWeight: '700',
    fontSize: 15,
  },

  version: {
    textAlign: 'center',
    color: '#C7C9D1',
    fontSize: 12,
    fontWeight: '500',
    letterSpacing: 0.2,
    marginTop: 24,
  },
});