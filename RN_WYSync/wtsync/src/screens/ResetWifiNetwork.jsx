import React, { useState, useEffect } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  View, Text, TouchableOpacity, FlatList, TextInput,
  Alert, ActivityIndicator, Modal, PermissionsAndroid, Platform,
} from 'react-native';
import WifiManager from 'react-native-wifi-reborn';



import { resolveEspIp } from '../utils/EspDiscovery';
import { useAppTheme } from '../services/theme';

export default function ResetwifiNetwork({ navigation }) {
  // ── Theme (new) ───────────────────────────────────────
  // Follows Android system Light/Dark mode automatically via
  // useColorScheme() inside useAppTheme(). No manual toggle.
  const { colors, isDark } = useAppTheme();

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

    // Android: SSID padhne ke liye location permission chahiye
    if (Platform.OS === "android") {
      await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
      );
    }

    setBusy(true);
    setModal("loading");
    setStatusMsg("Finding device...");

    try {
      console.log("1. Starting resolveEspIp");
      const ip = await resolveEspIp();
      console.log("2. IP Found:", ip);

      setStatusMsg("Sending WiFi credentials...");
      console.log("3. Sending to:", `http://${ip}/set_wifi`);

      // Credentials bhejo. ESP switch hote hi connection drop karega,
      // isliye response nahi aayega — error ko ignore karo.
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);
      try {
        await fetch(`http://${ip}/set_wifi`, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: `ssid=${encodeURIComponent(selSSID)}&password=${encodeURIComponent(newPw)}`,
          signal: controller.signal,
        });
      } catch (sendErr) {
        console.log("Expected drop:", sendErr.name, sendErr.message);
      } finally {
        clearTimeout(timeoutId);
      }

      // Polling: second WiFi se connect hone tak wait karo
      setStatusMsg(`Connect to "${selSSID}" — waiting...`);
      console.log("4. Polling for:", selSSID);

      try {
        await pollForConnection(selSSID, { interval: 2000, timeout: 60000 });
        console.log("5. Connected to second WiFi");
        setBusy(false);
        setModal("");
        navigation.navigate("DeviceConfig");
      } catch (pollErr) {
        setBusy(false);
        setModal("");
        Alert.alert(
          "Not Connected",
          `"${selSSID}" se connect nahi hua. Manually connect karke dobara try karein.`
        );
      }
    } catch (e) {
      // Sirf resolveEspIp fail hone par (device na mila)
      setBusy(false);
      setModal("");
      console.log("ERROR NAME:", e.name);
      console.log("ERROR MESSAGE:", e.message);
      console.log("FULL ERROR:", e);
      Alert.alert("Error", e.message || "Unable to communicate with ESP32.");
    }
  };
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <TouchableOpacity onPress={() => navigation.goBack()}
        style={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8 }}>
        <Text style={{ fontSize: 16, color: '#1D9E75', fontWeight: '500' }}>‹ Back</Text>
      </TouchableOpacity>

      <View style={{ flex: 1, padding: 24, justifyContent: 'center' }}>
        <View style={{ backgroundColor: colors.card, borderRadius: 24, padding: 24, elevation: 4 }}>
          <Text style={{ fontSize: 28, fontWeight: '700', textAlign: 'center', color: colors.text }}>Change WiFi</Text>
          <Text style={{ marginTop: 12, textAlign: 'center', color: colors.subText }}>
            Select a new 2.4GHz network for your ESP32 device.
          </Text>

          {/* <View style={{
            marginTop: 20, padding: 12, borderRadius: 10,
            backgroundColor: espIP ? '#E1F5EE' : '#FEF2F2',
            flexDirection: 'row', alignItems: 'center', gap: 8,
          }}>
            <Text>{espIP ? '🟢' : '🔴'}</Text>
            <Text style={{ fontSize: 13, color: espIP ? '#0F6E56' : '#B91C1C' }}>
              {espIP ? `ESP32 found (${espIP})` : 'Searching for ESP32...'}
            </Text>
          </View> */}

          <TouchableOpacity onPress={scanWifi} disabled={busy}
            style={{
              marginTop: 20, paddingVertical: 16, borderRadius: 14, alignItems: 'center',
              backgroundColor: busy ? (isDark ? '#374151' : '#CBD5E1') : '#1D9E75',
            }}>
            <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700' }}>Select WiFi Network</Text>
          </TouchableOpacity>
        </View>
      </View>

      <Modal visible={modal === 'loading'} transparent>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' }}>
          <View style={{ backgroundColor: colors.card, borderRadius: 20, padding: 32, alignItems: 'center', marginHorizontal: 40 }}>
            <ActivityIndicator size="large" color="#1D9E75" />
            <Text style={{ marginTop: 16, fontSize: 16, fontWeight: '600', color: colors.text }}>{statusMsg}</Text>
          </View>
        </View>
      </Modal>

      <Modal visible={modal === 'wifi'} animationType="slide" transparent onRequestClose={() => setModal('')}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: colors.card, borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '80%' }}>
            <View style={{ width: 40, height: 4, backgroundColor: colors.border, borderRadius: 2, alignSelf: 'center', marginTop: 10, marginBottom: 16 }} />
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 16, marginBottom: 12 }}>
              <Text style={{ fontSize: 18, fontWeight: '600', color: colors.text }}>Select 2.4GHz WiFi</Text>
              <TouchableOpacity onPress={() => setModal('')}><Text style={{ fontSize: 16, color: colors.subText, padding: 8 }}>✕</Text></TouchableOpacity>
            </View>
            {busy ? (
              <View style={{ alignItems: 'center', paddingVertical: 50 }}>
                <ActivityIndicator size="large" color="#1D9E75" /><Text style={{ marginTop: 12, color: colors.subText }}>Scanning...</Text>
              </View>
            ) : (
              <FlatList data={wifiList} keyExtractor={(_, i) => i.toString()} style={{ maxHeight: 400 }}
                ListEmptyComponent={<View style={{ alignItems: 'center', paddingVertical: 50 }}>
                  <Text style={{ color: colors.subText }}>No 2.4GHz networks</Text>
                  <TouchableOpacity onPress={scanWifi} style={{ marginTop: 16, backgroundColor: '#1D9E75', paddingVertical: 10, paddingHorizontal: 24, borderRadius: 8 }}>
                    <Text style={{ color: '#fff', fontWeight: '600' }}>Scan Again</Text></TouchableOpacity></View>}
                renderItem={({ item }) => (
                  <TouchableOpacity onPress={() => pickWifi(item.SSID)}
                    style={{ flexDirection: 'row', alignItems: 'center', padding: 14, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: colors.border, gap: 10 }}>
                    <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: '#1D9E75' }} />
                    <View style={{ flex: 1 }}><Text style={{ fontSize: 15, fontWeight: '500', color: colors.text }}>{item.SSID}</Text>
                      <Text style={{ fontSize: 12, color: colors.subText }}>2.4 GHz</Text></View>
                    <Text style={{ color: colors.subText, fontSize: 20 }}>›</Text>
                  </TouchableOpacity>)} />
            )}
          </View>
        </View>
      </Modal>

      <Modal visible={modal === 'password'} animationType="slide" transparent onRequestClose={() => setModal('')}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: colors.card, borderTopLeftRadius: 20, borderTopRightRadius: 20 }}>
            <View style={{ width: 40, height: 4, backgroundColor: colors.border, borderRadius: 2, alignSelf: 'center', marginTop: 10, marginBottom: 16 }} />
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 16, marginBottom: 12 }}>
              <Text style={{ fontSize: 18, fontWeight: '600', color: colors.text }}>Enter Password</Text>
              <TouchableOpacity onPress={() => setModal('')}><Text style={{ fontSize: 16, color: colors.subText, padding: 8 }}>✕</Text></TouchableOpacity>
            </View>
            <View style={{ paddingHorizontal: 16, paddingBottom: 30 }}>
              <Text style={{ fontSize: 12, fontWeight: '600', color: colors.subText, marginBottom: 6 }}>SSID</Text>
              <TextInput style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 12, fontSize: 15, backgroundColor: isDark ? '#161616' : '#f5f5f5', color: colors.subText, marginBottom: 16 }}
                value={selSSID} editable={false} />
              <Text style={{ fontSize: 12, fontWeight: '600', color: colors.subText, marginBottom: 6 }}>PASSWORD</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 20 }}>
                <TextInput style={{ flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 12, fontSize: 15, color: colors.text }}
                  placeholder="Enter password" placeholderTextColor={colors.subText} secureTextEntry={!showPw} value={newPw} onChangeText={setNewPw} autoFocus />
                <TouchableOpacity style={{ padding: 10 }} onPress={() => setShowPw(!showPw)}>
                  <Text style={{ fontSize: 18 }}>{showPw ? '🙈' : '👁️'}</Text></TouchableOpacity>
              </View>
              <TouchableOpacity onPress={changeWifi} disabled={busy}
                style={{ backgroundColor: '#1D9E75', paddingVertical: 14, borderRadius: 10, alignItems: 'center' }}>
                <Text style={{ color: '#fff', fontSize: 16, fontWeight: '600' }}>Change WiFi</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setModal('')}
                style={{ paddingVertical: 14, borderRadius: 10, alignItems: 'center', borderWidth: 1, borderColor: colors.border, marginTop: 10 }}>
                <Text style={{ fontSize: 15, fontWeight: '500', color: colors.text }}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}