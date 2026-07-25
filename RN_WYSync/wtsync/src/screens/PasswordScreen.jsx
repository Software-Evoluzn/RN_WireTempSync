import React, { useState, useRef, useEffect } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import WifiManager from 'react-native-wifi-reborn';
import styles from '../styles/PasswordStyles';

const ESP_AP_IP = 'http://192.168.4.1';

// Verification tuning
const POLL_EVERY_MS = 3000;
const MAX_VERIFY_MS = 30000;
const UNREACHABLE_STREAK_OK = 2;

// Status state enum
const STATUS = {
  IDLE: 'idle',
  SENDING: 'sending',
  VERIFYING: 'verifying',
  SUCCESS: 'success',
  FAILED: 'failed',
};

export default function PasswordScreen({ route, navigation }) {
  const { network, product, firebase_uid } = route.params;
  const BASE_URL = "http://192.168.1.42:5006";

  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [status, setStatus] = useState(STATUS.IDLE);
  const [errorMsg, setErrorMsg] = useState('');
  const [phoneConnected, setPhoneConnected] = useState(false);
  const [isSavingDb, setIsSavingDb] = useState(false);

  const phoneWifiTimer = useRef(null);
  const pollTimer = useRef(null);
  const elapsedRef = useRef(0);
  const unreachableStreak = useRef(0);

  const stopPhoneWifiPolling = () => {
    if (phoneWifiTimer.current) {
      clearInterval(phoneWifiTimer.current);
      phoneWifiTimer.current = null;
    }
  };

  const stopPolling = () => {
    if (pollTimer.current) {
      clearInterval(pollTimer.current);
      pollTimer.current = null;
    }
  };

  useEffect(() => {
    return () => {
      stopPolling();
      stopPhoneWifiPolling();
    };
  }, []);

  const startPhoneWifiPolling = () => {
    setPhoneConnected(false);

    phoneWifiTimer.current = setInterval(async () => {
      try {
        const ssid = await WifiManager.getCurrentWifiSSID();
        const currentSSID = ssid.replace(/"/g, "");

        if (currentSSID === network.SSID) {
          stopPhoneWifiPolling();
          setPhoneConnected(true);
        }
      } catch (error) {
        console.log("SSID Check Error:", error);
      }
    }, 2000);
  };

  const isEspApReachable = async () => {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), 2000);
    try {
      await fetch(`${ESP_AP_IP}/`, { method: 'GET', signal: controller.signal });
      clearTimeout(t);
      return true;
    } catch (e) {
      clearTimeout(t);
      return false;
    }
  };

  const saveWifiToDatabase = async () => {
    const targetDeviceId = product?.serial_no;

    if (!targetDeviceId) {
      console.log("❌ Missing device serial number (product.serial_no)");
      return false;
    }

    try {
      setIsSavingDb(true);
      console.log("Saving Wi-Fi details to database...");

      const response = await fetch(`${BASE_URL}/save-device-wifi`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          device_id: targetDeviceId,
          firebase_uid: firebase_uid || "unknown",
          ssid: network?.SSID,
          password: password,
        }),
      });

      const result = await response.json();

      if (response.ok) {
        console.log("✅ WiFi saved successfully to DB", result);
        return true;
      } else {
        console.log("❌ Save failed on backend:", result);
        return false;
      }
    } catch (error) {
      console.log("❌ API Error:", error);
      return false;
    } finally {
      setIsSavingDb(false);
    }
  };

  const handleConnect = async () => {
    if (password.length < 8) {
      Alert.alert('Error', 'Password length must be at least 8 characters');
      return;
    }

    setErrorMsg('');
    setStatus(STATUS.SENDING);

    try {
      await WifiManager.forceWifiUsageWithOptions(true, { noResetOnDisconnect: false });
    } catch (e) {
      // Non-fatal
    }

    try {
      const controller = new AbortController();
      const t = setTimeout(() => controller.abort(), 12000);

      await fetch(`${ESP_AP_IP}/save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `s=${encodeURIComponent(network.SSID)}&p=${encodeURIComponent(password)}`,
        signal: controller.signal,
      });
      clearTimeout(t);
    } catch (e) {
      console.log('[wifisave] post error (expected):', e.message);
    }

    startVerification();
  };

  const startVerification = () => {
    setStatus(STATUS.VERIFYING);
    elapsedRef.current = 0;
    unreachableStreak.current = 0;
    stopPolling();

    pollTimer.current = setInterval(async () => {
      elapsedRef.current += POLL_EVERY_MS;

      const reachable = await isEspApReachable();

      if (reachable) {
        unreachableStreak.current = 0;
      } else {
        unreachableStreak.current += 1;
        if (unreachableStreak.current >= UNREACHABLE_STREAK_OK) {
          stopPolling();
          onSuccess();
          return;
        }
      }

      if (elapsedRef.current >= MAX_VERIFY_MS) {
        stopPolling();
        onFailed();
      }
    }, POLL_EVERY_MS);
  };

  const onSuccess = () => {
    setStatus(STATUS.SUCCESS);
    startPhoneWifiPolling();
  };

  const handleFinish = async () => {
    const saved = await saveWifiToDatabase();

    if (saved) {
      navigation.navigate('Home');
    } else {
      Alert.alert(
        "Database Error",
        "ESP32 connected successfully, but failed to save Wi-Fi details to the server. Continue to Home?",
        [
          { text: "Retry", onPress: () => handleFinish() },
          { text: "Continue Anyway", onPress: () => navigation.navigate('Home') }
        ]
      );
    }
  };

  const onFailed = () => {
    setErrorMsg(
      'Device not connected to wifi because: Wrong password, or ' +
      'network is 5GHz (ESP32 supports 2.4GHz only). ' +
      'Please check your password.'
    );
    setStatus(STATUS.FAILED);
  };

  const handleRetry = () => {
    setStatus(STATUS.IDLE);
    setErrorMsg('');
  };

  const busy = status === STATUS.SENDING || status === STATUS.VERIFYING;

  return (
    <SafeAreaView style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
        <View style={styles.container}>
          <TouchableOpacity onPress={() => navigation.goBack()} disabled={busy}>
            <Text style={styles.backText}>‹ Back</Text>
          </TouchableOpacity>

          <Text style={styles.heading}>Configure Device</Text>

          <TextInput style={styles.input} value={network.SSID} editable={false} />

          <View style={styles.passwordWrap}>
            <TextInput
              style={styles.passwordInput}
              placeholder="Enter Password"
              secureTextEntry={!showPassword}
              value={password}
              onChangeText={setPassword}
              editable={status === STATUS.IDLE}
            />
            <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
              <Text>{showPassword ? '🙈' : '👁️'}</Text>
            </TouchableOpacity>
          </View>

          {status === STATUS.IDLE && (
            <TouchableOpacity style={styles.button} onPress={handleConnect}>
              <Text style={styles.buttonText}>Configure Device</Text>
            </TouchableOpacity>
          )}

          {busy && (
            <View style={[styles.button, { opacity: 0.85 }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
                <ActivityIndicator size="small" color="#fff" />
                <Text style={styles.buttonText}>
                  {status === STATUS.SENDING ? 'Sending credentials...' : 'Verifying connection...'}
                </Text>
              </View>
            </View>
          )}

          {status === STATUS.SUCCESS && (
            <View style={cardStyle.success}>
              <Text style={cardStyle.successTitle}>✓ Connected</Text>
              <Text style={cardStyle.muted}>
                Device connected to "{network.SSID}".
              </Text>
              <Text style={cardStyle.muted}>
                {phoneConnected
                  ? `✓ Phone connected to "${network.SSID}".`
                  : `Waiting for phone to connect to "${network.SSID}"...`
                }
              </Text>

              <TouchableOpacity
                disabled={!phoneConnected || isSavingDb}
                onPress={handleFinish}
                style={[
                  cardStyle.primaryBtn,
                  (!phoneConnected || isSavingDb) && { opacity: 0.5 }
                ]}
              >
                {isSavingDb ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={cardStyle.primaryBtnText}>Continue</Text>
                )}
              </TouchableOpacity>
            </View>
          )}

          {status === STATUS.FAILED && (
            <View style={cardStyle.error}>
              <Text style={cardStyle.errorTitle}>✕ Not Connected</Text>
              <Text style={cardStyle.errorMsg}>{errorMsg}</Text>

              <TouchableOpacity onPress={handleRetry} style={cardStyle.retryBtn}>
                <Text style={cardStyle.primaryBtnText}>Try Again</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const cardStyle = {
  success: {
    marginTop: 25, padding: 20, borderRadius: 18,
    backgroundColor: '#F0FDF4', borderWidth: 1, borderColor: '#BBF7D0',
  },
  successTitle: {
    fontSize: 20, fontWeight: '700', color: '#0F6E56', textAlign: 'center', marginBottom: 10,
  },
  error: {
    marginTop: 25, padding: 20, borderRadius: 18,
    backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: '#FECACA',
  },
  errorTitle: {
    fontSize: 20, fontWeight: '700', color: '#DC2626', textAlign: 'center', marginBottom: 10,
  },
  errorMsg: {
    color: '#7F1D1D', textAlign: 'center', lineHeight: 20,
  },
  muted: {
    marginTop: 6, textAlign: 'center', color: '#64748B',
  },
  primaryBtn: {
    marginTop: 18, padding: 14, borderRadius: 12, backgroundColor: '#1D9E75',
  },
  retryBtn: {
    marginTop: 18, padding: 14, borderRadius: 12, backgroundColor: '#DC2626',
  },
  primaryBtnText: {
    color: '#fff', textAlign: 'center', fontWeight: '700',
  },
};