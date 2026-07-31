import React, { useState, useEffect, useRef } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  View, Text, TouchableOpacity, FlatList, TextInput,
  Alert, ActivityIndicator, Modal, PermissionsAndroid, Platform,
  StyleSheet, Animated,
} from 'react-native';
import WifiManager from 'react-native-wifi-reborn';
import Feather from 'react-native-vector-icons/Feather';

import { resolveEspIp } from '../utils/EspDiscovery';
import { useAppTheme } from '../services/theme';
import { changeDeviceWifi } from '../services/WifiService';

export default function ResetwifiNetwork({ navigation, route }) {
  // ── Theme (unchanged) ─────────────────────────────────
  // Follows Android system Light/Dark mode automatically via
  // useColorScheme() inside useAppTheme(). No manual toggle.

  const { product, verifiedData } = route.params;

  console.log("Product:", product);
  console.log("Verified Data:", verifiedData);

  const { colors, isDark } = useAppTheme();
  const styles = createStyles(colors);

  const [modal, setModal] = useState('');
  const [wifiList, setWifiList] = useState([]);
  const [selSSID, setSelSSID] = useState('');
  const [newPw, setNewPw] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [busy, setBusy] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');
  // const [espIP, setEspIP] = useState(null);

  // // Screen open → Zeroconf se IP cache karo (ek baar)
  // useEffect(() => {
  //   const zc = new Zeroconf();
  //   let found = false;

  //   zc.on('resolved', (service) => {
  //     if (!found && service.name?.toLowerCase().includes('abc')) {
  //       found = true;
  //       const ip = service.addresses?.find(a => /^\d+\.\d+\.\d+\.\d+$/.test(a));
  //       if (ip) {
  //         console.log('ESP32 IP cached:', ip);
  //         setEspIP(ip);
  //       }
  //       zc.stop();
  //     }
  //   });
  //   zc.on('error', () => { });

  //   setTimeout(() => zc.scan('http', 'tcp', 'local.'), 300);
  //   const timeout = setTimeout(() => { if (!found) zc.stop(); }, 12000);

  //   return () => { clearTimeout(timeout); zc.stop(); zc.removeAllListeners(); };
  // }, []);

  // ── Visual-only entrance animation (new) ──────────────
  // Mirrors DeviceConfig's header/card entrance treatment. Purely
  // presentational — does not touch state, effects, or handlers.
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

  const scanWifi = async () => {
    setBusy(true); setModal('wifi'); setWifiList([]);
    try {
      const list = await WifiManager.reScanAndLoadWifiList();
      setWifiList(list.filter(i =>
        i.SSID && i.SSID.length > 0 &&
        i.frequency >= 2400 && i.frequency <= 2500 &&
        !i.SSID.startsWith('ESP')
      ));
    } catch (e) { Alert.alert('Error', 'WiFi scan failed.'); setModal(''); }
    finally { setBusy(false); }
  };

  const pickWifi = (ssid) => {
    setSelSSID(ssid); setNewPw(''); setShowPw(false); setModal('password');
  };

  // ---- helpers (component ke andar, changeWifi ke upar rakho) ----

  const getCurrentSSID = async () => {
    try {
      const ssid = await WifiManager.getCurrentWifiSSID();
      return (ssid || "").replace(/^"|"$/g, "");
    } catch (err) {
      console.log("getCurrentWifiSSID error:", err);
      return null;
    }
  };

  const pollForConnection = (targetSSID, { interval = 2000, timeout = 60000 } = {}) => {
    return new Promise((resolve, reject) => {
      const start = Date.now();
      const check = async () => {
        const current = await getCurrentSSID();
        console.log("Polling... current:", current, "target:", targetSSID);
        if (current && current === targetSSID) return resolve(true);
        if (Date.now() - start >= timeout) return reject(new Error("timeout"));
        setTimeout(check, interval);
      };
      check();
    });
  };

  const changeWifi = async () => {

    if (newPw.length < 8) {
      Alert.alert("Error", "Minimum 8 characters");
      return;
    }

    try {

      setBusy(true);

      const result = await changeDeviceWifi({
        deviceId: verifiedData.deviceId,
        firebaseUid: verifiedData.firebaseUid,
        ssid: selSSID,
        password: newPw,
      });

      setBusy(false);

      if (!result.success) {
        Alert.alert("Error", result.message);
        return;
      }

      Alert.alert(
        "Success",
        "New WiFi credentials sent successfully."
      );

      navigation.navigate("Home");

    } catch (e) {

      setBusy(false);

      Alert.alert("Error", e.message);
    }
  };


  // const changeWifi = async () => {
  //   if (newPw.length < 8) {
  //     Alert.alert("Error", "Minimum 8 characters");
  //     return;
  //   }

  //   // Android: SSID padhne ke liye location permission chahiye
  //   if (Platform.OS === "android") {
  //     await PermissionsAndroid.request(
  //       PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
  //     );
  //   }

  //   setBusy(true);
  //   setModal("loading");
  //   setStatusMsg("Finding device...");

  //   try {
  //     console.log("1. Starting resolveEspIp");
  //     const ip = await resolveEspIp();
  //     console.log("2. IP Found:", ip);

  //     setStatusMsg("Sending WiFi credentials...");
  //     console.log("3. Sending to:", `http://${ip}/set_wifi`);

  //     // Credentials bhejo. ESP switch hote hi connection drop karega,
  //     // isliye response nahi aayega — error ko ignore karo.
  //     const controller = new AbortController();
  //     const timeoutId = setTimeout(() => controller.abort(), 4000);
  //     try {
  //       await fetch(`http://${ip}/set_wifi`, {
  //         method: "POST",
  //         headers: { "Content-Type": "application/x-www-form-urlencoded" },
  //         body: `ssid=${encodeURIComponent(selSSID)}&password=${encodeURIComponent(newPw)}`,
  //         signal: controller.signal,
  //       });
  //     } catch (sendErr) {
  //       console.log("Expected drop:", sendErr.name, sendErr.message);
  //     } finally {
  //       clearTimeout(timeoutId);
  //     }

  //     // Polling: second WiFi se connect hone tak wait karo
  //     setStatusMsg(`Connect to "${selSSID}" — waiting...`);
  //     console.log("4. Polling for:", selSSID);

  //     try {
  //       await pollForConnection(selSSID, { interval: 2000, timeout: 60000 });
  //       console.log("5. Connected to second WiFi");
  //       setBusy(false);
  //       setModal("");
  //       navigation.navigate("DeviceConfig");
  //     } catch (pollErr) {
  //       setBusy(false);
  //       setModal("");
  //       Alert.alert(
  //         "Not Connected",
  //         `"${selSSID}" se connect nahi hua. Manually connect karke dobara try karein.`
  //       );
  //     }
  //   } catch (e) {
  //     // Sirf resolveEspIp fail hone par (device na mila)
  //     setBusy(false);
  //     setModal("");
  //     console.log("ERROR NAME:", e.name);
  //     console.log("ERROR MESSAGE:", e.message);
  //     console.log("FULL ERROR:", e);
  //     Alert.alert("Error", e.message || "Unable to communicate with ESP32.");
  //   }
  // };

  return (
    <SafeAreaView style={styles.safeArea}>
      <TouchableOpacity onPress={() => navigation.goBack()} activeOpacity={0.7} style={styles.backRow}>
        <Feather name="chevron-left" size={18} color={colors.subText} />
        <Text style={styles.backText}>Back</Text>
      </TouchableOpacity>

      <View style={styles.centerWrap}>
        <Animated.View
          style={[
            styles.header,
            { opacity: headerFade, transform: [{ translateY: headerSlide }] },
          ]}
        >
          <Animated.Text style={[styles.eyebrow, { opacity: eyebrowFade }]}>
            DEVICE SETUP
          </Animated.Text>
          <Text style={styles.heading}>Change WiFi</Text>
          <Text style={styles.subtitle}>
            Select a new 2.4GHz network for your ESP32 device.
          </Text>
          <Animated.View style={[styles.accentLine, { width: accentLineWidth }]} />
        </Animated.View>

        <Animated.View style={{ opacity: cardFade, transform: [{ translateY: cardSlide }], width: '100%' }}>
          <View style={styles.card}>
            <View style={styles.cardIconWrap}>
              <Feather name="wifi" size={22} color={colors.text} />
            </View>
            <Text style={styles.cardTitle}>Ready to switch networks</Text>
            <Text style={styles.cardBody}>
              We'll scan for nearby 2.4GHz networks your ESP32 can join.
            </Text>

            <TouchableOpacity
              onPress={scanWifi}
              disabled={busy}
              activeOpacity={0.85}
              style={[styles.button, busy && styles.buttonDisabled]}
            >
              <Feather name="search" size={16} color="#fff" />
              <Text style={styles.buttonText}>Select WiFi Network</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </View>

      {/* ---- Loading modal ---- */}
      <Modal visible={modal === 'loading'} transparent animationType="fade">
        <View style={styles.overlay}>
          <View style={styles.loadingCard}>
            <ActivityIndicator size="large" color={colors.text} />
            <Text style={styles.loadingText}>{statusMsg}</Text>
          </View>
        </View>
      </Modal>

      {/* ---- WiFi list modal ---- */}
      <Modal visible={modal === 'wifi'} animationType="slide" transparent onRequestClose={() => setModal('')}>
        <View style={styles.sheetOverlay}>
          <View style={styles.sheet}>
            <View style={styles.sheetHandle} />
            <View style={styles.sheetHeaderRow}>
              <Text style={styles.sheetTitle}>Select 2.4GHz WiFi</Text>
              <TouchableOpacity onPress={() => setModal('')} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Feather name="x" size={20} color={colors.subText} />
              </TouchableOpacity>
            </View>

            {busy ? (
              <View style={styles.sheetLoadingWrap}>
                <ActivityIndicator size="large" color={colors.text} />
                <Text style={styles.sheetLoadingText}>Scanning...</Text>
              </View>
            ) : (
              <FlatList
                data={wifiList}
                keyExtractor={(_, i) => i.toString()}
                style={{ maxHeight: 420 }}
                contentContainerStyle={{ paddingBottom: 12 }}
                ListEmptyComponent={
                  <View style={styles.sheetEmptyWrap}>
                    <Feather name="wifi-off" size={26} color={colors.subText} />
                    <Text style={styles.sheetEmptyText}>No 2.4GHz networks found</Text>
                    <TouchableOpacity onPress={scanWifi} activeOpacity={0.85} style={[styles.button, { marginTop: 16 }]}>
                      <Feather name="refresh-cw" size={16} color="#fff" />
                      <Text style={styles.buttonText}>Scan Again</Text>
                    </TouchableOpacity>
                  </View>
                }
                renderItem={({ item }) => (
                  <TouchableOpacity onPress={() => pickWifi(item.SSID)} activeOpacity={0.7} style={styles.wifiRow}>
                    <View style={styles.wifiIconWrap}>
                      <Feather name="wifi" size={18} color={colors.text} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.wifiSsid} numberOfLines={1}>{item.SSID}</Text>
                      <Text style={styles.wifiMeta}>2.4 GHz</Text>
                    </View>
                    <Feather name="chevron-right" size={18} color={colors.subText} />
                  </TouchableOpacity>
                )}
              />
            )}
          </View>
        </View>
      </Modal>

      {/* ---- Password modal ---- */}
      <Modal visible={modal === 'password'} animationType="slide" transparent onRequestClose={() => setModal('')}>
        <View style={styles.sheetOverlay}>
          <View style={styles.sheet}>
            <View style={styles.sheetHandle} />
            <View style={styles.sheetHeaderRow}>
              <Text style={styles.sheetTitle}>Enter Password</Text>
              <TouchableOpacity onPress={() => setModal('')} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Feather name="x" size={20} color={colors.subText} />
              </TouchableOpacity>
            </View>

            <View style={styles.sheetBody}>
              <Text style={styles.fieldLabel}>SSID</Text>
              <View style={styles.ssidDisplay}>
                <Feather name="wifi" size={15} color={colors.subText} />
                <Text style={styles.ssidDisplayText} numberOfLines={1}>{selSSID}</Text>
              </View>

              <Text style={[styles.fieldLabel, { marginTop: 18 }]}>PASSWORD</Text>
              <View style={styles.passwordField}>
                <Feather name="lock" size={16} color={colors.subText} style={{ marginRight: 10 }} />
                <TextInput
                  style={styles.passwordInput}
                  placeholder="Enter password"
                  placeholderTextColor={colors.subText}
                  secureTextEntry={!showPw}
                  value={newPw}
                  onChangeText={setNewPw}
                  autoFocus
                />
                <TouchableOpacity onPress={() => setShowPw(!showPw)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                  <Feather name={showPw ? 'eye-off' : 'eye'} size={18} color={colors.subText} />
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                onPress={changeWifi}
                disabled={busy}
                activeOpacity={0.85}
                style={[styles.button, styles.sheetButtonSpacing, busy && styles.buttonDisabled]}
              >
                <Feather name="check" size={16} color="#fff" />
                <Text style={styles.buttonText}>Change WiFi</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setModal('')}
                activeOpacity={0.85}
                style={[styles.button, styles.cancelButton, { marginTop: 10 }]}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const createStyles = (colors) => StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },

  backRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 4,
    alignSelf: 'flex-start',
  },
  backText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.subText,
  },

  centerWrap: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: 'center',
  },

  header: {
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

  card: {
    backgroundColor: colors.card,
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#0B0D12',
    shadowOpacity: 0.06,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 3,
  },
  cardIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(120,120,128,0.14)',
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    letterSpacing: -0.3,
    marginBottom: 6,
  },
  cardBody: {
    fontSize: 14,
    color: colors.subText,
    lineHeight: 20,
    marginBottom: 22,
  },

  // Buttons — monochromatic system matching DeviceConfig
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
  buttonDisabled: {
    opacity: 0.5,
    shadowOpacity: 0,
    elevation: 0,
  },
  buttonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.1,
  },
  cancelButton: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    shadowOpacity: 0,
    elevation: 0,
  },
  cancelButtonText: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
  },

  // Loading modal
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingCard: {
    backgroundColor: colors.card,
    borderRadius: 22,
    paddingVertical: 32,
    paddingHorizontal: 28,
    alignItems: 'center',
    marginHorizontal: 40,
    borderWidth: 1,
    borderColor: colors.border,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
    textAlign: 'center',
  },

  // Bottom sheets
  sheetOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    maxHeight: '85%',
    borderTopWidth: 1,
    borderColor: colors.border,
  },
  sheetHandle: {
    width: 40,
    height: 4,
    backgroundColor: colors.border,
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 16,
  },
  sheetHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 8,
  },
  sheetTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.text,
    letterSpacing: -0.3,
  },

  sheetLoadingWrap: {
    alignItems: 'center',
    paddingVertical: 56,
  },
  sheetLoadingText: {
    marginTop: 14,
    fontSize: 14,
    color: colors.subText,
    fontWeight: '500',
  },
  sheetEmptyWrap: {
    alignItems: 'center',
    paddingVertical: 48,
    paddingHorizontal: 24,
  },
  sheetEmptyText: {
    marginTop: 12,
    fontSize: 14,
    color: colors.subText,
    textAlign: 'center',
  },

  wifiRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 20,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  wifiIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(120,120,128,0.14)',
  },
  wifiSsid: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
    letterSpacing: -0.1,
  },
  wifiMeta: {
    fontSize: 12,
    color: colors.subText,
    marginTop: 2,
    fontWeight: '500',
  },

  sheetBody: {
    paddingHorizontal: 20,
    paddingBottom: 28,
    paddingTop: 4,
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.subText,
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  ssidDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  ssidDisplayText: {
    fontSize: 15,
    fontWeight: '500',
    color: colors.subText,
    flexShrink: 1,
  },
  passwordField: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 4,
    backgroundColor: colors.card,
  },
  passwordInput: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
    color: colors.text,
    paddingVertical: 12,
  },
  sheetButtonSpacing: {
    marginTop: 24,
  },
});