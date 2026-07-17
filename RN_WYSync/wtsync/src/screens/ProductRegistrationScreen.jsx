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
  Animated
} from 'react-native';

import { Camera } from 'react-native-camera-kit';
import { styles } from '../styles/styles';

import { registerProduct } from '../services/ProductApi';
import { getUserDetails } from '../services/AuthService';


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
  // mode: 'scan' | 'manual'
  const [mode, setMode] = useState('scan');

  const [product, setProduct] = useState(null);

  const [manualForm, setManualForm] = useState(EMPTY_FORM);

  const [showDatePicker, setShowDatePicker] = useState(false);

  const [purchaseDate, setPurchaseDate] = useState(new Date());

  const [user, setUser] = useState('');


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

      <ScrollView showsVerticalScrollIndicator={false}>

        <Text style={styles.screenTitle}>
          Register Product
        </Text>


        {/* Mode Toggle: Scan QR / Manual Entry */}

        <View style={styles.modeToggleContainer}>

          <TouchableOpacity
            style={[
              styles.modeButton,
              mode === 'scan' && styles.modeButtonActive,
            ]}
            onPress={() => switchMode('scan')}>

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
            onPress={() => switchMode('manual')}>

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
              Align QR Code inside the frame
            </Text>

          </View>
        )}


        {/* Manual Entry Form (only in manual mode, before product is set) */}

        {mode === 'manual' && !product && (
          <View style={styles.card}>

            <Text style={styles.cardTitle}>
              Enter Product Details
            </Text>

            <Text style={styles.inputLabel}>Device Name *</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Smart Router X200"
              placeholderTextColor="#999"
              value={manualForm['Device Name']}
              onChangeText={(text) => updateManualField('Device Name', text)}
            />

            <Text style={styles.inputLabel}>Model No *</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. RX-200-IN"
              placeholderTextColor="#999"
              autoCapitalize="characters"
              value={manualForm['Model No']}
              onChangeText={(text) => updateManualField('Model No', text)}
            />

            <Text style={styles.inputLabel}>Serial No *</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. SN123456789"
              placeholderTextColor="#999"
              autoCapitalize="characters"
              value={manualForm['Serial No']}
              onChangeText={(text) => updateManualField('Serial No', text)}
            />

            <Text style={styles.inputLabel}>MAC ID *</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. AA:BB:CC:DD:EE:FF"
              placeholderTextColor="#999"
              autoCapitalize="characters"
              value={manualForm['MAC ID']}
              onChangeText={(text) => updateManualField('MAC ID', text)}
            />

            <Text style={styles.inputLabel}>Manufacturer (optional)</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. ABC Electronics"
              placeholderTextColor="#999"
              value={manualForm['MDF By']}
              onChangeText={(text) => updateManualField('MDF By', text)}
            />

            <TouchableOpacity
              style={styles.registerButton}
              onPress={onManualSubmit}>

              <Text style={styles.registerButtonText}>
                Continue
              </Text>

            </TouchableOpacity>

          </View>
        )}


        {/* Product Details */}

        {product && (

          <View style={styles.card}>

            <Text style={styles.cardTitle}>
              Product Details
            </Text>

            <Row
              label="Device Name"
              value={product['Device Name']}
            />

            <Row
              label="Model No"
              value={product['Model No']}
            />

            <Row
              label="Serial No"
              value={product['Serial No']}
            />

            <Row
              label="MAC ID"
              value={product['MAC ID']}
            />

            <Row
              label="Manufacturer"
              value={product['MDF By']}
            />

            {/* Edit / rescan option */}
            <TouchableOpacity
              onPress={() => {
                if (mode === 'manual') {
                  // go back to the form with existing values
                  setManualForm({ ...EMPTY_FORM, ...product });
                }
                setProduct(null);
              }}>

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
              onPress={() => {
                setShowDatePicker(true);
              }}>

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


        {/* Register */}

        {product && (

          <TouchableOpacity
            style={styles.registerButton}
            onPress={onRegister}>

            <Text style={styles.registerButtonText}>
              Register Product
            </Text>

          </TouchableOpacity>

        )}

      </ScrollView>
    </SafeAreaView>
  );
};

const Row = ({ label, value }) => {
  return (
    <View style={styles.row}>

      <Text style={styles.label}>
        {label}
      </Text>

      <Text style={styles.value}>
        {value || '-'}
      </Text>

    </View>
  );
};

export default ProductRegistrationScreen;