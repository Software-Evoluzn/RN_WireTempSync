import React, { useState, useRef, useEffect } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  View, Text, TouchableOpacity, TextInput,
  Alert, ActivityIndicator, ScrollView,
} from 'react-native';
import WifiManager from 'react-native-wifi-reborn';
import styles from '../styles/PasswordStyles';

const ESP_AP_IP = 'http://192.168.4.1';

// Verification tuning
const POLL_EVERY_MS = 3000;     // har 3s me ESP ko ping karo
const MAX_VERIFY_MS = 30000;    // 30s tak verify karo, uske baad fail maan lo
const UNREACHABLE_STREAK_OK = 2; // 2 baar lagataar unreachable = AP band = success

// State machine ke liye saaf-saaf status values
const STATUS = {
  IDLE: 'idle',
  SENDING: 'sending',     // /wifisave pe POST ja raha hai
  VERIFYING: 'verifying', // ESP connect kar raha hai, hum monitor kar rahe hain
  SUCCESS: 'success',     // ESP ne target WiFi join kar liya
  FAILED: 'failed',       // wrong password / network na mila
};

export default function PasswordScreen({ route, navigation }) {
  const { network } = route.params;

  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [status, setStatus] = useState(STATUS.IDLE);
  const [errorMsg, setErrorMsg] = useState('');

  const [phoneConnected, setPhoneConnected] = useState(false)
  const phoneWifiTimer = useRef(null)

  const stopPhoneWifiPolling = () => {
    if (phoneWifiTimer.current) {
      clearInterval(phoneWifiTimer.current);
      phoneWifiTimer.current = null

    }

  };

  const startPhoneWifiPolling = () => {
    setPhoneConnected(false);

    phoneWifiTimer.current = setInterval(async () => {
      try {

        const ssid = await WifiManager.getCurrentWifiSSID();

        // Android sometimes returns SSID with quotes
        const currentSSID = ssid.replace(/"/g, "");

        console.log("Current SSID:", currentSSID);
        console.log("Target SSID :", network.SSID);

        if (currentSSID === network.SSID) {
          stopPhoneWifiPolling();
          setPhoneConnected(true);
        }

      } catch (error) {
        console.log("SSID Check Error:", error);
      }

    }, 2000);
  }

  useEffect(() => {
    return () => {
      stopPolling();
      stopPhoneWifiPolling();
    };
  }, []);

  // verification loop ke internal counters (re-render trigger na karein isliye refs)
  const pollTimer = useRef(null);
  const elapsedRef = useRef(0);
  const unreachableStreak = useRef(0);



  const stopPolling = () => {
    if (pollTimer.current) {
      clearInterval(pollTimer.current);
      pollTimer.current = null;
    }
  };

  // ----------------------------------------------------------------
  // ESP AP (192.168.4.1) reachable hai ya nahi — short timeout ke saath
  // ----------------------------------------------------------------
  const isEspApReachable = async () => {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), 2000);
    try {
      await fetch(`${ESP_AP_IP}/`, { method: 'GET', signal: controller.signal });
      clearTimeout(t);
      return true; // jawab aaya => AP abhi up hai => portal abhi khula hai
    } catch (e) {
      clearTimeout(t);
      return false; // timeout/abort => AP gir gaya => ESP ne WiFi switch kar liya (ya channel jump)
    }
  };

  // ----------------------------------------------------------------
  // STEP 1: creds bhejo  (WiFiManager ka /wifisave, params: s + p)
  // ----------------------------------------------------------------
  const handleConnect = async () => {
    if (password.length < 8) {
      Alert.alert('Error', 'Password length is less that 8 ');
      return;
    }

    setErrorMsg('');
    setStatus(STATUS.SENDING);

    // Phone ko ESP32 AP pe pinned rakho (Android internet-less network se bhaagta hai)
    try {
      await WifiManager.forceWifiUsageWithOptions(true, { noResetOnDisconnect: false });
    } catch (e) {
      // non-fatal — kuch devices pe ye method available nahi hota
    }

    try {
      const controller = new AbortController();
      const t = setTimeout(() => controller.abort(), 12000);

      const res = await fetch(`${ESP_AP_IP}/wifisave`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `s=${encodeURIComponent(network.SSID)}&p=${encodeURIComponent(password)}`,
        signal: controller.signal,
      });
      clearTimeout(t);

      // NOTE: WiFiManager yahan 200 deta hai chahe password sahi ho ya galat.
      // Iska matlab sirf itna hai ki creds receive ho gaye — connect ka result abhi pata nahi.
      console.log('[wifisave] status:', res.status);

    } catch (e) {
      // POST ke beech AP drop ho sakta hai (ESP switch kar raha hai) — ye normal hai,
      // hum verification phase me asli result nikaalenge.
      console.log('[wifisave] post error (expected possible):', e.message);
    }

    // STEP 2: ab verify karo
    startVerification();
  };

  // ----------------------------------------------------------------
  // STEP 2: ESP connect hua ya nahi — AP reachability se infer karo
  //   - baar baar reachable rehna  => portal khula => connect FAIL (wrong pass)
  //   - reachable hona band ho jaye => AP band => connect SUCCESS
  // ----------------------------------------------------------------
  const startVerification = () => {
    setStatus(STATUS.VERIFYING);
    elapsedRef.current = 0;
    unreachableStreak.current = 0;
    stopPolling();

    pollTimer.current = setInterval(async () => {
      elapsedRef.current += POLL_EVERY_MS;

      const reachable = await isEspApReachable();

      if (reachable) {
        // AP abhi bhi zinda — ESP ne abhi tak target WiFi join nahi kiya
        unreachableStreak.current = 0;
      } else {
        // AP gir gaya — possibly ESP ne WiFi join kar liya
        unreachableStreak.current += 1;
        if (unreachableStreak.current >= UNREACHABLE_STREAK_OK) {
          stopPolling();
          onSuccess();
          return;
        }
      }

      // Time khatam aur AP abhi bhi reachable => connect fail (sabse common: wrong password)
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

  const onFailed = () => {
    setErrorMsg(
      'Device not connected to wifi . because: Wrong password, ' +
      'network is 5Ghz (ESP32 support 2.4GHz ). ' +
      'Please check password .'
    );
    setStatus(STATUS.FAILED);
  };

  const handleRetry = () => {
    setStatus(STATUS.IDLE);
    setErrorMsg('');
  };

  const busy = status === STATUS.SENDING || status === STATUS.VERIFYING;

  // ----------------------------------------------------------------
  // UI
  // ----------------------------------------------------------------
  return (
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

        {/* ---- IDLE: configure button ---- */}
        {status === STATUS.IDLE && (
          <TouchableOpacity style={styles.button} onPress={handleConnect}>
            <Text style={styles.buttonText}>Configure Device</Text>
          </TouchableOpacity>
        )}

        {/* ---- SENDING / VERIFYING: spinner ---- */}
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

        {/* ---- SUCCESS ---- */}
        {status === STATUS.SUCCESS && (
          <View style={cardStyle.success}>
            <Text style={cardStyle.successTitle}>✓ Connected</Text>
            <Text style={cardStyle.muted}>
              Device connected to this  "{network.SSID}" .
            </Text>
            <Text style={cardStyle.muted}>
              {phoneConnected
                ? `✓ Phone connected to "${network.SSID}".`
                : `Waiting for phone to connect to "${network.SSID}"...`
              }

            </Text>
            ``
            <TouchableOpacity
              disabled={!phoneConnected}

              onPress={() => navigation.navigate('WtsDashboard')}
              style={[
                cardStyle.primaryBtn,
                !phoneConnected && { opacity: 0.5 }
              ]}
            >
              <Text style={cardStyle.primaryBtnText}>Continue</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ---- FAILED ---- */}
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
  );
}

// Inline styles for the new success/error cards (taaki tumhari styles file ko chhedna na pade)
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