import React, { useState, useRef, useEffect } from 'react';
import DateTimePicker from '@react-native-community/datetimepicker';
import {
  SafeAreaView,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  Animated,
  StyleSheet,
} from 'react-native';

import { Camera } from 'react-native-camera-kit';
import Feather from 'react-native-vector-icons/Feather';

import { registerProduct } from '../services/ProductApi';
import { getUserDetails } from '../services/AuthService';
import { useAppTheme } from '../services/theme';


const parseQR = (raw) => {
  if (!raw) return null;

  const result = {};

  const patterns = [
    {
      key: 'Device Name',
      regex: /Device Name\s*:\s*(.*?)\s*(?=Model No\s*:|$)/i,
    },
    {
      key: 'Model No',
      regex: /Model No\s*:\s*(.*?)\s*(?=Serial No\s*:|$)/i,
    },
    {
      key: 'Serial No',
      regex: /Serial No\s*:\s*(.*?)\s*(?=MAC ID\s*:|$)/i,
    },
    {
      key: 'MAC ID',
      regex: /MAC ID\s*:\s*(.*?)\s*(?=MDF By\s*:|$)/i,
    },
    {
      key: 'MDF By',
      regex: /MDF By\s*:\s*(.*)$/i,
    },
  ];

  patterns.forEach(({ key, regex }) => {
    const match = raw.match(regex);

    if (match) {
      result[key] = match[1].trim();
    }
  });

  return result;
};


const EMPTY_FORM = {
  'Device Name': '',
  'Model No': '',
  'Serial No': '',
  'MAC ID': '',
  'MDF By': '',
};


const ProductRegistrationScreen = ({ navigation }) => {
  const { colors } = useAppTheme();
  const styles = createStyles(colors);

  // mode: 'scan' | 'manual'
  const [mode, setMode] = useState('scan');

  const [product, setProduct] = useState(null);

  const [manualForm, setManualForm] = useState(EMPTY_FORM);

  const [showDatePicker, setShowDatePicker] = useState(false);

  const [purchaseDate, setPurchaseDate] = useState(new Date());

  const [user, setUser] = useState('');
  const [thresholdValue, setThresholdValue] = useState('');
  const [emailEnabled, setEmailEnabled] = useState(false);
  const [smsEnabled, setSmsEnabled] = useState(false);
  const [alertEmail, setAlertEmail] = useState('');
  const [smsPhone, setSmsPhone] = useState('');


  useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    try {
      const result = await getUserDetails();

      console.log(result);
      if (result?.success) setUser(result.user);
    } catch (e) {
      console.log('Failed to load user:', e);
    }
  };

  // Switch between scan / manual and reset previous data
  const switchMode = (newMode) => {
    if (newMode === mode) return;

    setMode(newMode);
    setProduct(null);

    setManualForm(EMPTY_FORM);
  };

  const updateManualField = (key, value) => {
    setManualForm((prev) => ({ ...prev, [key]: value }));
  };

  // Validate manual form and move to product details
  const onManualSubmit = () => {
    const required = ['Device Name', 'Model No', 'Serial No', 'MAC ID'];

    const missing = required.filter(
      (key) => !manualForm[key] || !manualForm[key].trim()
    );

    if (missing.length > 0) {
      Alert.alert(
        'Missing Fields',
        `Please fill: ${missing.join(', ')}`
      );
      return;
    }

    // trim all values before saving
    const cleaned = {};
    Object.keys(manualForm).forEach((key) => {
      cleaned[key] = manualForm[key].trim();
    });

    setProduct(cleaned);
  };

  const onRegister = async () => {
    if (!user) {
      Alert.alert('Please wait', 'User information is loading.');
      return;
    }

    const body = {
      firebase_uid: user.firebase_uid,

      user_name: user.name,

      email: user.email,

      contact: user.contact,

      device_name: product['Device Name'],

      model_no: product['Model No'],

      serial_no: product['Serial No'],

      mac_id: product['MAC ID'],

      purchase_date: purchaseDate
        .toISOString()
        .split('T')[0],

      threshold_value: parseFloat(thresholdValue),

      email_enabled: emailEnabled,

      alert_email: alertEmail,

      sms_enabled: smsEnabled,

      sms_phone: smsPhone,
    };

    try {
      const response = await registerProduct(body);

      if (response.success) {
        Alert.alert(
          'Success',
          response.message, [
          {
            text: 'OK',
            onPress: () => navigation.goBack(),
          },
        ]
        );
      } else {
        Alert.alert(
          'Error',
          response.message
        );
      }
    } catch (e) {
      Alert.alert(
        'Error',
        'Unable to connect to server.'
      );
    }
  };


  const scanAnimation = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(scanAnimation, {
          toValue: 240,
          duration: 1800,
          useNativeDriver: true,
        }),

        Animated.timing(scanAnimation, {
          toValue: 0,
          duration: 1800,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  const onReadCode = (event) => {
    const qrData = event.nativeEvent.codeStringValue;

    const parsed = parseQR(qrData);

    if (!parsed) {
      Alert.alert('Invalid QR Code');
      return;
    }

    setProduct(parsed);
  };

  const onDateChange = (event, selectedDate) => {
    setShowDatePicker(false);

    if (selectedDate) {
      setPurchaseDate(selectedDate);
    }
  };


  return (
    <SafeAreaView style={styles.container}>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>

        <Text style={styles.screenTitle}>
          Register Product
        </Text>
        <Text style={styles.screenSubtitle}>
          Scan a device QR code or enter its details manually
        </Text>


        {/* Mode Toggle: Scan QR / Manual Entry */}

        <View style={styles.modeToggleContainer}>

          <TouchableOpacity
            style={[
              styles.modeButton,
              mode === 'scan' && styles.modeButtonActive,
            ]}
            activeOpacity={0.85}
            onPress={() => switchMode('scan')}>

            <Feather
              name="camera"
              size={15}
              color={mode === 'scan' ? colors.text : colors.subText}
              style={styles.modeIcon}
            />

            <Text
              style={[
                styles.modeButtonText,
                mode === 'scan' && styles.modeButtonTextActive,
              ]}>
              Scan QR
            </Text>

          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.modeButton,
              mode === 'manual' && styles.modeButtonActive,
            ]}
            activeOpacity={0.85}
            onPress={() => switchMode('manual')}>

            <Feather
              name="edit-3"
              size={15}
              color={mode === 'manual' ? colors.text : colors.subText}
              style={styles.modeIcon}
            />

            <Text
              style={[
                styles.modeButtonText,
                mode === 'manual' && styles.modeButtonTextActive,
              ]}>
              Enter Manually
            </Text>

          </TouchableOpacity>

        </View>


        {/* Scanner (only in scan mode, before product is captured) */}

        {mode === 'scan' && !product && (
          <View style={styles.scannerContainer}>

            <View style={styles.cameraBox}>

              <Camera
                style={styles.camera}
                scanBarcode={true}
                onReadCode={onReadCode}
              />

              <Animated.View
                style={[
                  styles.scanLine,
                  {
                    transform: [
                      {
                        translateY: scanAnimation,
                      },
                    ],
                  },
                ]}
              />

              <View style={[styles.corner, styles.topLeft]} />

              <View style={[styles.corner, styles.topRight]} />

              <View style={[styles.corner, styles.bottomLeft]} />

              <View style={[styles.corner, styles.bottomRight]} />

            </View>

            <Text style={styles.scanText}>
              Align QR code inside the frame
            </Text>

          </View>
        )}


        {/* Manual Entry Form (only in manual mode, before product is set) */}

        {mode === 'manual' && !product && (
          <View style={styles.card}>

            <Text style={styles.cardTitle}>
              Enter Product Details
            </Text>

            <View style={styles.fieldGroup}>
              <Text style={styles.inputLabel}>Device Name *</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. Smart Router X200"
                placeholderTextColor={colors.subText}
                value={manualForm['Device Name']}
                onChangeText={(text) => updateManualField('Device Name', text)}
              />
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.inputLabel}>Model No *</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. RX-200-IN"
                placeholderTextColor={colors.subText}
                autoCapitalize="characters"
                value={manualForm['Model No']}
                onChangeText={(text) => updateManualField('Model No', text)}
              />
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.inputLabel}>Serial No *</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. SN123456789"
                placeholderTextColor={colors.subText}
                autoCapitalize="characters"
                value={manualForm['Serial No']}
                onChangeText={(text) => updateManualField('Serial No', text)}
              />
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.inputLabel}>MAC ID *</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. AA:BB:CC:DD:EE:FF"
                placeholderTextColor={colors.subText}
                autoCapitalize="characters"
                value={manualForm['MAC ID']}
                onChangeText={(text) => updateManualField('MAC ID', text)}
              />
            </View>

            <View style={[styles.fieldGroup, { marginBottom: 4 }]}>
              <Text style={styles.inputLabel}>Manufacturer (optional)</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. ABC Electronics"
                placeholderTextColor={colors.subText}
                value={manualForm['MDF By']}
                onChangeText={(text) => updateManualField('MDF By', text)}
              />
            </View>

            <TouchableOpacity
              style={styles.registerButton}
              activeOpacity={0.85}
              onPress={onManualSubmit}>

              <Text style={styles.registerButtonText}>
                Continue
              </Text>
              <Feather name="arrow-right" size={16} color="#fff" />

            </TouchableOpacity>

          </View>
        )}


        {/* Product Details */}

        {product && (

          <View style={styles.card}>

            <View style={styles.cardTitleRow}>
              <Text style={styles.cardTitle}>
                Product Details
              </Text>
              <Feather name="check-circle" size={16} color="#22C55E" />
            </View>

            <Row
              label="Device Name"
              value={product['Device Name']}
              styles={styles}
            />

            <Row
              label="Model No"
              value={product['Model No']}
              styles={styles}
            />

            <Row
              label="Serial No"
              value={product['Serial No']}
              styles={styles}
            />

            <Row
              label="MAC ID"
              value={product['MAC ID']}
              styles={styles}
            />

            <Row
              label="Manufacturer"
              value={product['MDF By']}
              last
              styles={styles}
            />

            {/* Edit / rescan option */}
            <TouchableOpacity
              style={styles.editLinkRow}
              onPress={() => {
                if (mode === 'manual') {
                  // go back to the form with existing values
                  setManualForm({ ...EMPTY_FORM, ...product });
                }
                setProduct(null);
              }}>

              <Feather
                name={mode === 'scan' ? 'refresh-cw' : 'edit-3'}
                size={14}
                color="#4F46E5"
              />

              <Text style={styles.editLink}>
                {mode === 'scan' ? 'Scan Again' : 'Edit Details'}
              </Text>

            </TouchableOpacity>

          </View>

        )}

        {/* Purchase Date */}

        {product && (
          <View style={styles.card}>

            <Text style={styles.cardTitle}>
              Purchase Date
            </Text>

            <TouchableOpacity
              style={styles.dateButton}
              activeOpacity={0.85}
              onPress={() => {
                setShowDatePicker(true);
              }}>

              <Feather name="calendar" size={16} color={colors.subText} />

              <Text style={styles.dateText}>
                {purchaseDate.toLocaleDateString()}
              </Text>

            </TouchableOpacity>

            {showDatePicker && (
              <DateTimePicker
                value={purchaseDate}
                mode="date"
                display="default"
                onChange={onDateChange}
              />
            )}

          </View>
        )}
        {product && (
          <View style={styles.card}>

            <Text style={styles.cardTitle}>
              Alert Settings
            </Text>

            <Text style={styles.inputLabel}>
              Threshold Value
            </Text>


            <TextInput
              style={styles.input}
              placeholder="Enter threshold"
              placeholderTextColor={colors.subText}
              keyboardType="numeric"
              value={thresholdValue}
              onChangeText={setThresholdValue}
            />

            <View style={{ marginTop: 20 }}>

              <TouchableOpacity
                style={styles.checkboxRow}
                onPress={() => setEmailEnabled(!emailEnabled)}>

                <Text style={styles.checkbox}>
                  {emailEnabled ? "☑" : "☐"}
                </Text>

                <Text style={styles.checkboxLabel}>Email Alert</Text>

              </TouchableOpacity>

              {emailEnabled && (
                <TextInput
                  style={styles.input}
                  placeholder="Enter Email"
                  placeholderTextColor={colors.subText}
                  keyboardType="email-address"
                  value={alertEmail}
                  onChangeText={setAlertEmail}
                />
              )}


            </View>

            <View style={{ marginTop: 20 }}>

              <TouchableOpacity
                style={styles.checkboxRow}
                onPress={() => setSmsEnabled(!smsEnabled)}>

                <Text style={styles.checkbox}>
                  {smsEnabled ? "☑" : "☐"}
                </Text>

                <Text style={styles.checkboxLabel}>SMS Alert</Text>

              </TouchableOpacity>

              {smsEnabled && (

                <TextInput
                  style={styles.input}
                  placeholder="Enter Phone Number"
                  placeholderTextColor={colors.subText}
                  keyboardType="phone-pad"
                  value={smsPhone}
                  onChangeText={setSmsPhone}
                />

              )}


            </View>


          </View>
        )}


        {/* Register */}

        {product && (

          <TouchableOpacity
            style={styles.registerButton}
            activeOpacity={0.85}
            onPress={onRegister}>

            <Text style={styles.registerButtonText}>
              Register Product
            </Text>
            <Feather name="arrow-right" size={16} color="#fff" />

          </TouchableOpacity>

        )}

      </ScrollView>
    </SafeAreaView>
  );
};

const Row = ({ label, value, last, styles }) => {
  return (
    <View style={[styles.row, last && { marginBottom: 0 }]}>

      <Text style={styles.label}>
        {label}
      </Text>

      <Text style={styles.value} numberOfLines={1}>
        {value || '-'}
      </Text>

    </View>
  );
};

export default ProductRegistrationScreen;

const createStyles = (colors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 48,
  },

  screenTitle: {
    fontSize: 26,
    fontWeight: '700',
    color: colors.text,
    letterSpacing: -0.4,
  },
  screenSubtitle: {
    fontSize: 14,
    color: colors.subText,
    marginTop: 6,
    marginBottom: 28,
  },

  // Mode toggle
  modeToggleContainer: {
    flexDirection: 'row',
    backgroundColor: colors.border,
    borderRadius: 14,
    padding: 4,
    marginBottom: 28,
  },
  modeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 11,
    borderRadius: 11,
  },
  modeButtonActive: {
    backgroundColor: colors.card,
    shadowColor: '#0B0D12',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  modeIcon: {
    marginRight: 6,
  },
  modeButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.subText,
  },
  modeButtonTextActive: {
    color: colors.text,
  },

  // Scanner
  scannerContainer: {
    alignItems: 'center',
    marginBottom: 28,
  },
  cameraBox: {
    width: '100%',
    height: 300,
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: '#0B0D12',
    borderWidth: 1,
    borderColor: colors.border,
  },
  camera: {
    width: '100%',
    height: '100%',
  },
  scanLine: {
    position: 'absolute',
    left: 20,
    right: 20,
    top: 28,
    height: 2,
    backgroundColor: '#4F46E5',
    borderRadius: 2,
  },
  corner: {
    position: 'absolute',
    width: 28,
    height: 28,
    borderColor: '#fff',
  },
  topLeft: {
    top: 20,
    left: 20,
    borderTopWidth: 2.5,
    borderLeftWidth: 2.5,
    borderTopLeftRadius: 8,
  },
  topRight: {
    top: 20,
    right: 20,
    borderTopWidth: 2.5,
    borderRightWidth: 2.5,
    borderTopRightRadius: 8,
  },
  bottomLeft: {
    bottom: 20,
    left: 20,
    borderBottomWidth: 2.5,
    borderLeftWidth: 2.5,
    borderBottomLeftRadius: 8,
  },
  bottomRight: {
    bottom: 20,
    right: 20,
    borderBottomWidth: 2.5,
    borderRightWidth: 2.5,
    borderBottomRightRadius: 8,
  },
  scanText: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.subText,
    marginTop: 16,
  },

  // Cards
  card: {
    backgroundColor: colors.card,
    borderRadius: 20,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#0B0D12',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.04,
    shadowRadius: 16,
    elevation: 1,
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 18,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 18,
  },

  // Manual form
  fieldGroup: {
    marginBottom: 14,
  },
  inputLabel: {
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

  // Product details rows
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    marginBottom: 2,
  },
  label: {
    fontSize: 14,
    fontWeight: '400',
    color: colors.subText,
  },
  value: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    maxWidth: '60%',
    textAlign: 'right',
  },

  editLinkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    marginTop: 16,
    gap: 6,
  },
  editLink: {
    fontSize: 13,
    fontWeight: '700',
    color: '#4F46E5',
  },

  // Date
  dateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.background,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  dateText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
  },

  // Buttons
  registerButton: {
    backgroundColor: '#0B0D12',
    paddingVertical: 16,
    borderRadius: 14,
    marginTop: 4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: '#0B0D12',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.16,
    shadowRadius: 14,
    elevation: 3,
  },
  registerButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },

  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },

  checkbox: {
    fontSize: 22,
    marginRight: 10,
    color: colors.text,
  },

  checkboxLabel: {
    color: colors.text,
  },
});