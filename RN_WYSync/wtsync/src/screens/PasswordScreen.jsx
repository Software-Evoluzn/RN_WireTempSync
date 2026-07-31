import React, { useState, useRef, useEffect } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  View, Text, TouchableOpacity, TextInput,
  Alert, ActivityIndicator, ScrollView, StyleSheet, Animated,
} from 'react-native';
import WifiManager from 'react-native-wifi-reborn';
import Feather from 'react-native-vector-icons/Feather';
import { useAppTheme } from '../services/theme';

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

  // ── Theme (unchanged) ─────────────────────────────────
  // Follows Android system Light/Dark mode automatically via
  // useColorScheme() inside useAppTheme(). No manual toggle.
  const { colors, isDark } = useAppTheme();
  const styles = createStyles(colors);

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

      const res = await fetch(`${ESP_AP_IP}/save`, {
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

  // ── Visual-only entrance animation (new) ──────────────
  // Mirrors DeviceConfig's header/card entrance treatment. Purely
  // presentational — does not touch state machine, polling, or nav.
  const headerFade = useRef(new Animated.Value(0)).current;
  const headerSlide = useRef(new Animated.Value(10)).current;
  const accentLineWidth = useRef(new Animated.Value(0)).current;
  const eyebrowFade = useRef(new Animated.Value(0)).current;
  const cardFade = useRef(new Animated.Value(0)).current;
  const cardSlide = useRef(new Animated.Value(14)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(headerFade, { toValue: 1, duration: 550, useNativeDriver: true }),
      Animated.timing(headerSlide, { toValue: 0, duration: 550, useNativeDriver: true }),
      Animated.timing(eyebrowFade, { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.timing(accentLineWidth, { toValue: 56, duration: 700, delay: 200, useNativeDriver: false }),
      Animated.timing(cardFade, { toValue: 1, duration: 600, delay: 150, useNativeDriver: true }),
      Animated.timing(cardSlide, { toValue: 0, duration: 600, delay: 150, useNativeDriver: true }),
    ]).start();
  }, []);

  // Theme-aware tints for status cards / pills (unchanged logic,
  // restyled to match the reference screen's soft-tint system —
  // background tint + foreground color, no saturated fills).
  const statusColors = {
    success: {
      bg: isDark ? 'rgba(29,158,117,0.14)' : '#F0FDF4',
      border: isDark ? 'rgba(29,158,117,0.35)' : '#BBF7D0',
      fg: isDark ? '#34D399' : '#0F6E56',
    },
    error: {
      bg: isDark ? 'rgba(220,38,38,0.14)' : '#FEF2F2',
      border: isDark ? 'rgba(220,38,38,0.35)' : '#FECACA',
      fg: isDark ? '#F87171' : '#B91C1C',
    },
  };

  // ----------------------------------------------------------------
  // UI
  // ----------------------------------------------------------------
  return (
    <ScrollView
      contentContainerStyle={{ flexGrow: 1, backgroundColor: colors.background }}
      keyboardShouldPersistTaps="handled"
    >
      <View style={[styles.container, { backgroundColor: colors.background }]}>

        <TouchableOpacity
          onPress={() => navigation.goBack()}
          disabled={busy}
          activeOpacity={0.7}
          style={styles.backRow}
        >
          <Feather name="chevron-left" size={18} color={colors.subText} />
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>

        <Animated.View
          style={[
            styles.header,
            { opacity: headerFade, transform: [{ translateY: headerSlide }] },
          ]}
        >
          <Animated.Text style={[styles.eyebrow, { opacity: eyebrowFade }]}>
            DEVICE SETUP
          </Animated.Text>
          <Text style={styles.heading}>Configure Device</Text>
          <Text style={styles.subtitle}>
            Enter the WiFi password so your ESP32 device can join this network.
          </Text>
          <Animated.View style={[styles.accentLine, { width: accentLineWidth }]} />
        </Animated.View>

        <Animated.View style={{ opacity: cardFade, transform: [{ translateY: cardSlide }] }}>

          {/* Target network row */}
          <View style={styles.networkCard}>
            <View style={styles.networkIconWrap}>
              <Feather name="wifi" size={18} color={colors.text} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.networkLabel}>CONNECTING TO</Text>
              <Text style={styles.networkSsid} numberOfLines={1}>{network.SSID}</Text>
            </View>
          </View>

          {/* Password field */}
          <View style={styles.fieldCard}>
            <View style={styles.fieldIconWrap}>
              <Feather name="lock" size={16} color={colors.subText} />
            </View>
            <TextInput
              style={styles.passwordInput}
              placeholder="Enter Password"
              placeholderTextColor={colors.subText}
              secureTextEntry={!showPassword}
              value={password}
              onChangeText={setPassword}
              editable={status === STATUS.IDLE}
            />
            <TouchableOpacity
              onPress={() => setShowPassword(!showPassword)}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              activeOpacity={0.7}
            >
              <Feather
                name={showPassword ? 'eye-off' : 'eye'}
                size={18}
                color={colors.subText}
              />
            </TouchableOpacity>
          </View>

          {/* ---- IDLE: configure button ---- */}
          {status === STATUS.IDLE && (
            <TouchableOpacity style={styles.button} onPress={handleConnect} activeOpacity={0.85}>
              <Feather name="link" size={16} color="#fff" />
              <Text style={styles.buttonText}>Configure Device</Text>
            </TouchableOpacity>
          )}

          {/* ---- SENDING / VERIFYING: spinner ---- */}
          {busy && (
            <View style={[styles.button, styles.buttonBusy]}>
              <ActivityIndicator size="small" color="#fff" />
              <Text style={styles.buttonText}>
                {status === STATUS.SENDING ? 'Sending credentials...' : 'Verifying connection...'}
              </Text>
            </View>
          )}

          {/* ---- SUCCESS ---- */}
          {status === STATUS.SUCCESS && (
            <View
              style={[
                styles.statusCard,
                { backgroundColor: statusColors.success.bg, borderColor: statusColors.success.border },
              ]}
            >
              <View style={[styles.statusIconWrap, { backgroundColor: `${statusColors.success.fg}1A` }]}>
                <Feather name="check" size={22} color={statusColors.success.fg} />
              </View>
              <Text style={[styles.statusTitle, { color: statusColors.success.fg }]}>
                Connected
              </Text>
              <Text style={styles.statusBody}>
                Device connected to "{network.SSID}".
              </Text>

              <View style={styles.phonePill}>
                <View
                  style={[
                    styles.phonePillDot,
                    { backgroundColor: phoneConnected ? statusColors.success.fg : colors.subText },
                  ]}
                />
                <Text style={styles.phonePillText} numberOfLines={1}>
                  {phoneConnected
                    ? `Phone connected to "${network.SSID}"`
                    : `Waiting for phone to connect to "${network.SSID}"...`}
                </Text>
              </View>

              <TouchableOpacity
                disabled={!phoneConnected}
                onPress={() => navigation.navigate('Home')}
                activeOpacity={0.85}
                style={[styles.button, styles.statusButtonSpacing, !phoneConnected && styles.buttonDisabled]}
              >
                <Feather name="arrow-right" size={16} color="#fff" />
                <Text style={styles.buttonText}>Continue</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* ---- FAILED ---- */}
          {status === STATUS.FAILED && (
            <View
              style={[
                styles.statusCard,
                { backgroundColor: statusColors.error.bg, borderColor: statusColors.error.border },
              ]}
            >
              <View style={[styles.statusIconWrap, { backgroundColor: `${statusColors.error.fg}1A` }]}>
                <Feather name="x" size={22} color={statusColors.error.fg} />
              </View>
              <Text style={[styles.statusTitle, { color: statusColors.error.fg }]}>
                Not Connected
              </Text>
              <Text style={[styles.statusBody, { color: isDark ? '#FCA5A5' : '#7F1D1D' }]}>
                {errorMsg}
              </Text>

              <TouchableOpacity
                onPress={handleRetry}
                activeOpacity={0.85}
                style={[styles.button, styles.buttonDestructive, styles.statusButtonSpacing]}
              >
                <Feather name="refresh-cw" size={16} color={statusColors.error.fg} />
                <Text style={[styles.buttonText, { color: statusColors.error.fg }]}>Try Again</Text>
              </TouchableOpacity>
            </View>
          )}
        </Animated.View>
      </View>
    </ScrollView>
  );
}

const createStyles = (colors) => StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 40,
  },

  backRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    marginTop: 12,
    marginBottom: 8,
    alignSelf: 'flex-start',
  },
  backText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.subText,
  },

  header: {
    paddingTop: 12,
    marginBottom: 28,
  },
  eyebrow: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.subText,
    letterSpacing: 1,
    marginBottom: 10,
    textTransform: 'uppercase',
  },
  heading: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.text,
    letterSpacing: -0.6,
  },
  subtitle: {
    fontSize: 14,
    color: colors.subText,
    marginTop: 8,
    lineHeight: 21,
    maxWidth: 320,
  },
  accentLine: {
    height: 3,
    borderRadius: 2,
    backgroundColor: colors.subText,
    marginTop: 18,
    opacity: 0.6,
  },

  // Target network summary row
  networkCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 20,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#0B0D12',
    shadowOpacity: 0.05,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 2,
  },
  networkIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
    backgroundColor: 'rgba(120,120,128,0.14)',
  },
  networkLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.subText,
    letterSpacing: 0.8,
    marginBottom: 3,
  },
  networkSsid: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    letterSpacing: -0.2,
  },

  // Password field
  fieldCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 12,
  },
  fieldIconWrap: {
    width: 30,
    alignItems: 'center',
  },
  passwordInput: {
    flex: 1,
    fontSize: 16,
    fontWeight: '500',
    color: colors.text,
    paddingVertical: 4,
  },

  // Buttons — monochromatic system matching DeviceConfig: rich-black
  // primary, bordered destructive/muted variants. No saturated fills.
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 16,
    width: '100%',
    backgroundColor: '#111111',
    shadowColor: '#0B0D12',
    shadowOpacity: 0.16,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3,
  },
  buttonBusy: {
    opacity: 0.9,
  },
  buttonDisabled: {
    opacity: 0.4,
    shadowOpacity: 0,
    elevation: 0,
  },
  buttonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.1,
  },
  buttonDestructive: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: 'rgba(185,28,28,0.28)',
    shadowOpacity: 0,
    elevation: 0,
  },

  // Status cards (success / failed)
  statusCard: {
    marginTop: 4,
    padding: 22,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: 'center',
  },
  statusIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  statusTitle: {
    fontSize: 19,
    fontWeight: '700',
    letterSpacing: -0.3,
    marginBottom: 8,
    textAlign: 'center',
  },
  statusBody: {
    fontSize: 14,
    color: colors.subText,
    textAlign: 'center',
    lineHeight: 20,
  },
  statusButtonSpacing: {
    marginTop: 18,
  },

  phonePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 14,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    maxWidth: '100%',
  },
  phonePillDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  phonePillText: {
    fontSize: 12.5,
    fontWeight: '600',
    color: colors.subText,
    flexShrink: 1,
  },
});