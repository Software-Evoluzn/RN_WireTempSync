import React, { useEffect, useState, useCallback } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  View, Text, FlatList, TouchableOpacity, PermissionsAndroid,
  Platform, Alert, Linking, ActivityIndicator, RefreshControl,
} from 'react-native';
import WifiManager from 'react-native-wifi-reborn';
import styles from '../styles/WiFiListStyles';
import Zeroconf from 'react-native-zeroconf';

import { resolveEspIp } from '../utils/EspDiscovery';
import { useAppTheme } from '../services/theme';

const ESP_AP_PASSWORD = '12345678';
const ESP_SSID_PREFIX = 'WTS';
// const DEVICE_URL = 'http://abc.local';

// ---------------------------------------------------------------------
// AUTO-CONNECT HELPERS (new)
// ---------------------------------------------------------------------
// Serial number pattern:  WTSXXXXXXXX
// Access Point pattern:   WTSAPXXXXXXXX
// i.e. insert "AP" right after the "WTS" prefix.
//   WTSF0C045  ->  WTSAPF0C045
export const generateApSsid = (serialNo) => {
  if (!serialNo) return null;
  const clean = String(serialNo).trim().toUpperCase();

  // Guard: if this is already an AP-style name (e.g. someone passed
  // "WTSAPF0C045" in by mistake, or this function ever gets called
  // twice on the same value), do NOT insert "AP" a second time.
  if (clean.startsWith('WTSAP')) {
    return clean;
  }

  if (!clean.startsWith(ESP_SSID_PREFIX)) {
    // Fallback: unexpected serial format, don't crash — just log and
    // return null so callers can show the "not found" state.
    console.log('generateApSsid: serial does not start with WTS ->', clean);
    return null;
  }

  // Insert "AP" exactly once, right after the "WTS" prefix.
  // WTSF0C045  ->  WTS + AP + F0C045  ->  WTSAPF0C045
  const rest = clean.slice(ESP_SSID_PREFIX.length);
  return `${ESP_SSID_PREFIX}AP${rest}`;
};

export default function DeviceConfig({ navigation, route }) {
  // ── Theme (new) ───────────────────────────────────────
  // Follows Android system Light/Dark mode automatically via
  // useColorScheme() inside useAppTheme(). No manual toggle.
  const { colors, isDark } = useAppTheme();

  const [networks, setNetworks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [connectingSSID, setConnectingSSID] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [resetting, setResetting] = useState(false);

  const [espOnline, setEspOnline] = useState(false);

  // -----------------------------------------------------------------
  // AUTO-CONNECT MODE (new)
  // -----------------------------------------------------------------
  // Triggered when the Home screen taps an OFFLINE device and passes:
  //   navigation.navigate('DeviceConfig', {
  //     product: device.serial_no,
  //     autoConnect: true,
  //   })
  // If `autoConnect` isn't passed, DeviceConfig behaves exactly as
  // before (manual scan + select list — used by Reset WiFi / Change WiFi).
  const productParam = route?.params?.product;
  const autoSerial =
    (typeof productParam === 'string' ? productParam : productParam?.serial_no) ||
    route?.params?.serialNo ||
    route?.params?.serial_no;

  // Preferred source: the Access Point name already stored in the
  // RegisterProduct table (product.access_point), returned by the
  // /get-products API. This is the SAME string the ESP32 firmware
  // actually broadcasts, so using it directly avoids ever having to
  // guess/re-derive it (and avoids any casing mismatch).
  // generateApSsid() is kept only as a fallback for older callers that
  // haven't been updated to pass access_point yet.
  const dbAccessPoint =
    route?.params?.accessPoint ||
    (productParam && typeof productParam === 'object' ? productParam.access_point : null);

  const isAutoConnect = route?.params?.autoConnect === true && !!(dbAccessPoint || autoSerial);

  const [autoStatus, setAutoStatus] = useState(isAutoConnect ? 'scanning' : null);
  // 'scanning' | 'connecting' | 'not_found' | 'failed'
  const [expectedSSID] = useState(() => {
    if (!isAutoConnect) return null;
    return dbAccessPoint || generateApSsid(autoSerial);
  });

  useEffect(() => {
    // Background mein check karo ESP32 already WiFi pe hai?
    const zeroconf = new Zeroconf();

    zeroconf.on('resolved', (service) => {
      if (service.name && service.name.toLowerCase().includes('abc')) {
        setEspOnline(true);
        zeroconf.stop();
      }
    });
    zeroconf.on('error', () => { });
    zeroconf.scan('http', 'tcp', 'local');

    const timeout = setTimeout(() => { zeroconf.stop(); }, 10000);

    return () => {
      clearTimeout(timeout);
      zeroconf.stop();
      zeroconf.removeAllListeners();
    };
  }, []);

  useEffect(() => {
    if (isAutoConnect) {
      runAutoConnect();
    } else {
      checkPermissionsAndScan();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const requestPermissions = async () => {
    if (Platform.OS !== 'android') return true;
    try {
      if (Platform.Version >= 33) {
        const results = await PermissionsAndroid.requestMultiple([
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
          PermissionsAndroid.PERMISSIONS.NEARBY_WIFI_DEVICES,
        ]);
        return results[PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION] === PermissionsAndroid.RESULTS.GRANTED &&
          results[PermissionsAndroid.PERMISSIONS.NEARBY_WIFI_DEVICES] === PermissionsAndroid.RESULTS.GRANTED;
      } else {
        const granted = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION);
        return granted === PermissionsAndroid.RESULTS.GRANTED;
      }
    } catch (e) { return false; }
  };

  const checkPermissionsAndScan = async () => {
    setLoading(true);
    const ok = await requestPermissions();
    if (!ok) {
      Alert.alert('Permission Required', 'Location permission chahiye.', [
        { text: 'Open Settings', onPress: () => Linking.openSettings() },
      ]);
      setLoading(false);
      return;
    }
    try {
      const isEnabled = await WifiManager.isEnabled();
      if (!isEnabled) { Alert.alert('WiFi Disabled', 'Please enable WiFi.'); setLoading(false); return; }
      await scanWifiNetworks();
    } catch (e) { setLoading(false); }
  };

  const scanWifiNetworks = async () => {
    try {
      const list = await WifiManager.reScanAndLoadWifiList();

      // If we know which device this screen is for (its access_point
      // from the DB, or a serial we can derive one from), only show/
      // target THAT device's AP — never every "WTS..." network nearby.
      // This keeps Reset WiFi / Change WiFi scoped to the correct
      // device instead of listing every registered user's ESP32.
      const targetSsid = dbAccessPoint || generateApSsid(autoSerial);

      const filtered = targetSsid
        ? list.filter(
            (i) => i.SSID && i.SSID.toUpperCase() === targetSsid.toUpperCase()
          )
        : list.filter((i) => i.SSID && i.SSID.startsWith(ESP_SSID_PREFIX));

      setNetworks(filtered);
      setLoading(false);
      setRefreshing(false);
    } catch (e) {
      Alert.alert('Error', 'Scan failed.');
      setLoading(false);
      setRefreshing(false);
    }
  };

  const waitForConnection = async (prefix, retries = 5, delay = 2000) => {
    const targetUpper = (prefix || '').toUpperCase();
    for (let i = 0; i < retries; i++) {
      try {
        const ssid = (await WifiManager.getCurrentWifiSSID()) || '';
        const clean = ssid.replace(/"/g, '');
        if (clean && clean.toUpperCase().includes(targetUpper)) return true;
      } catch (e) { }
      await new Promise(r => setTimeout(r, delay));
    }
    return false;
  };

  const connectToESP = async (network) => {
    try {
      setConnecting(true);
      setConnectingSSID(network.SSID);
      await WifiManager.connectToProtectedSSID(network.SSID, ESP_AP_PASSWORD, false, false);
      if (Platform.OS === 'android') {
        try { await WifiManager.forceWifiUsageWithOptions(true, { noResetOnDisconnect: false }); } catch (e) { }
      }
      const connected = await waitForConnection(ESP_SSID_PREFIX);
      if (connected) {
        navigation.navigate('HomeWifiListScreen');
      } else {
        Alert.alert('Failed', 'Could not connect to ESP32.', [
          { text: 'Try Again', onPress: () => connectToESP(network) },
          { text: 'Cancel', style: 'cancel' },
        ]);
      }
    } catch (e) {
      Alert.alert('Error', `Failed to connect to ${network.SSID}.`, [
        { text: 'Try Again', onPress: () => connectToESP(network) },
        { text: 'Cancel', style: 'cancel' },
      ]);
    } finally {
      setConnecting(false);
      setConnectingSSID('');
    }
  };

  // -----------------------------------------------------------------
  // AUTO-CONNECT FLOW (new)
  // -----------------------------------------------------------------
  // 1. Read the Access Point name straight from the database
  //    (product.access_point) — no client-side guessing needed.
  // 2. Scan WiFi silently (no list shown to the user).
  // 3. If the expected SSID is found -> connect immediately, reusing
  //    connectToProtectedSSID()/waitForConnection(), then navigate to
  //    HomeWifiListScreen exactly like the manual flow does.
  // 4. If not found -> show "Device not found" state (Scan Again / Cancel).
  // 5. If found but connection fails -> show "Unable to connect" state
  //    (Retry / Cancel). Retry repeats the whole scan process.
  // Scanning stops the instant a match is found — no continued/extra scans.
  const runAutoConnect = useCallback(async () => {
    const ssid = dbAccessPoint || generateApSsid(autoSerial);

    if (!ssid) {
      console.log('AP Not Found (no access_point on record and invalid serial format)');
      setAutoStatus('not_found');
      return;
    }

    console.log('Searching AP:', ssid);
    setAutoStatus('scanning');

    const ok = await requestPermissions();
    if (!ok) {
      Alert.alert('Permission Required', 'Location permission chahiye.', [
        { text: 'Open Settings', onPress: () => Linking.openSettings() },
      ]);
      setAutoStatus('failed');
      return;
    }

    try {
      const isEnabled = await WifiManager.isEnabled();
      if (!isEnabled) {
        Alert.alert('WiFi Disabled', 'Please enable WiFi.');
        setAutoStatus('failed');
        return;
      }

      const list = await WifiManager.reScanAndLoadWifiList();
      // Case-insensitive match kept as a safety net in case any device
      // firmware ever broadcasts slightly different casing than what's
      // stored in the DB — but since we're now matching against the
      // DB's own access_point value, this should match exactly.
      const match = list.find(
        (n) => n.SSID && n.SSID.toUpperCase() === ssid.toUpperCase()
      );

      if (!match) {
        console.log('AP Not Found');
        setAutoStatus('not_found');
        return;
      }

      console.log('Matching AP Found:', match.SSID);
      setAutoStatus('connecting');
      console.log('Connecting...');

      // Connect using match.SSID — the network's real, on-air SSID
      // string exactly as broadcast — never a re-cased guess.
      await WifiManager.connectToProtectedSSID(match.SSID, ESP_AP_PASSWORD, false, false);
      if (Platform.OS === 'android') {
        try { await WifiManager.forceWifiUsageWithOptions(true, { noResetOnDisconnect: false }); } catch (e) { }
      }

      const connected = await waitForConnection(match.SSID);
      if (connected) {
        console.log('Connected Successfully');
        console.log('Navigating to HomeWifiListScreen');
        navigation.navigate('HomeWifiListScreen');
      } else {
        console.log('Connection Failed');
        setAutoStatus('failed');
      }
    } catch (e) {
      console.log('Connection Failed', e);
      setAutoStatus('failed');
    }
  }, [navigation, dbAccessPoint, autoSerial]);

  const handleAutoScanAgain = useCallback(() => {
    runAutoConnect();
  }, [runAutoConnect]);

  const handleAutoCancel = useCallback(() => {
    if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      navigation.navigate('Main');
    }
  }, [navigation]);

  // ── Reset device remotely (when not in AP mode) ──────
  const resetDeviceRemote = async () => {
    Alert.alert('  Device', 'ESP32 ko remotely reset karein?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Reset', style: 'destructive', onPress: async () => {
          setResetting(true);
          try {
            const ip = await resolveEspIp();           // mDNS / cached
            console.log('ESP32 found at:', ip);
            const res = await fetch(`http://${ip}/reset_wifi`).catch(() => { });

            if (res.ok) {
              console.log("Esp32 connected with wifi")
              Alert.alert('Done', 'Device AP mode me restart ho raha hai. Ab "ESP..." network scan karein.', [
                { text: 'Scan Again', onPress: () => { setLoading(true); setTimeout(scanWifiNetworks, 6000); } },
              ]);
            } else {
              console.log("Esp32 not connect with wifi")
              Alert.alert('Fail', "Device nahi mil raha")
            }


          } catch (e) {
            Alert.alert('Error', 'ESP32 nahi mila. Phone aur ESP32 same WiFi pe hone chahiye.');
          } finally {
            setResetting(false);
          }
        },
      },
    ]);
  };
  const onRefresh = useCallback(async () => { setRefreshing(true); await scanWifiNetworks(); }, []);

  const getSignalInfo = (level) => {
    if (level >= -50) return { color: '#1D9E75', label: 'Excellent' };
    if (level >= -60) return { color: '#1D9E75', label: 'Good' };
    if (level >= -70) return { color: '#BA7517', label: 'Fair' };
    return { color: '#E24B4A', label: 'Weak' };
  };

  const renderItem = ({ item }) => {
    const signal = getSignalInfo(item.level || -60);
    const isConn = connecting && connectingSSID === item.SSID;
    return (
      <TouchableOpacity
        style={[
          styles.networkRow,
          { backgroundColor: colors.card, borderColor: colors.border },
          isConn && { opacity: 0.6 },
        ]}
        onPress={() => connectToESP(item)} disabled={connecting} activeOpacity={0.7}>
        <View style={[styles.signalDot, { backgroundColor: signal.color }]} />
        <View style={{ flex: 1 }}>
          <Text style={[styles.ssidText, { color: colors.text }]}>{item.SSID}</Text>
          <Text style={[styles.metaText, { color: colors.subText }]}>ESP32 Device · {signal.label}</Text>
        </View>
        {isConn ? <ActivityIndicator size="small" color="#1D9E75" /> : <Text style={[styles.chevron, { color: colors.subText }]}>›</Text>}
      </TouchableOpacity>
    );
  };

  // ── Empty state with Reset option ────────────────────
  const renderEmpty = () => {
    if (loading) return null;
    return (
      <View style={{ alignItems: 'center', marginTop: 60, paddingHorizontal: 20 }}>
        <Text style={{ fontSize: 48, marginBottom: 16 }}>📡</Text>
        <Text style={{ fontSize: 16, fontWeight: '500', color: colors.text, marginBottom: 8 }}>
          No ESP32 devices found
        </Text>
        <Text style={{ fontSize: 14, color: colors.subText, textAlign: 'center', lineHeight: 20, marginBottom: 24 }}>
          Device not in AP mode.first scan the device or reset the device remotely.
        </Text>

        <TouchableOpacity onPress={checkPermissionsAndScan}
          style={{ backgroundColor: '#1D9E75', paddingVertical: 12, paddingHorizontal: 32, borderRadius: 10, marginBottom: 12, width: '100%', alignItems: 'center' }}>
          <Text style={{ color: '#fff', fontSize: 15, fontWeight: '600' }}>Scan Again</Text>
        </TouchableOpacity>


        {/* ── Change WiFi button (device already on WiFi) ── */}
        <TouchableOpacity onPress={() => navigation.navigate('ResetwifiNetwork')}
          style={{ backgroundColor: '#2563EB', paddingVertical: 12, paddingHorizontal: 32, borderRadius: 10, marginBottom: 12, width: '100%', alignItems: 'center' }}>
          <Text style={{ color: '#fff', fontSize: 15, fontWeight: '600' }}>Change WiFi</Text>
        </TouchableOpacity>

        {/* ── Reset button when device not in AP mode ── */}
        <TouchableOpacity onPress={resetDeviceRemote} disabled={resetting}
          style={{ backgroundColor: '#DC2626', paddingVertical: 12, paddingHorizontal: 32, borderRadius: 10, width: '100%', alignItems: 'center' }}>
          {resetting ? <ActivityIndicator color="#fff" /> :
            <Text style={{ color: '#fff', fontSize: 15, fontWeight: '600' }}>Reset Device (abc.local)</Text>}
        </TouchableOpacity>



        <Text style={{ marginTop: 12, fontSize: 12, color: colors.subText, textAlign: 'center' }}>
          For reset the Device  your phone and esp32 is on same wifi
        </Text>
      </View>
    );
  };

  // -----------------------------------------------------------------
  // AUTO-CONNECT UI (new) — replaces the manual list entirely when
  // this screen was opened from an OFFLINE device tap. No WiFi list
  // is ever rendered in this mode.
  // -----------------------------------------------------------------
  if (isAutoConnect) {
    return (
      <View style={[styles.container, { justifyContent: 'center', backgroundColor: colors.background }]}>
        {(autoStatus === 'scanning' || autoStatus === 'connecting') && (
          <View style={{ alignItems: 'center', paddingHorizontal: 24 }}>
            <ActivityIndicator size="large" color="#1D9E75" />
            <Text style={{ marginTop: 16, fontSize: 16, fontWeight: '600', color: colors.text, textAlign: 'center' }}>
              {autoStatus === 'connecting' ? 'Connecting to device...' : 'Looking for your device...'}
            </Text>
            {!!expectedSSID && (
              <Text style={{ marginTop: 6, fontSize: 13, color: colors.subText, textAlign: 'center' }}>
                {expectedSSID}
              </Text>
            )}
          </View>
        )}

        {autoStatus === 'not_found' && (
          <View style={{ alignItems: 'center', paddingHorizontal: 24 }}>
            <Text style={{ fontSize: 48, marginBottom: 16 }}>📡</Text>
            <Text style={{ fontSize: 16, fontWeight: '600', color: colors.text, textAlign: 'center', marginBottom: 8 }}>
              Device not found.
            </Text>
            <Text style={{ fontSize: 14, color: colors.subText, textAlign: 'center', lineHeight: 20, marginBottom: 24 }}>
              Please power on the device or press Scan Again.
            </Text>

            <TouchableOpacity onPress={handleAutoScanAgain}
              style={{ backgroundColor: '#1D9E75', paddingVertical: 12, paddingHorizontal: 32, borderRadius: 10, marginBottom: 12, width: '100%', alignItems: 'center' }}>
              <Text style={{ color: '#fff', fontSize: 15, fontWeight: '600' }}>Scan Again</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={handleAutoCancel}
              style={{ backgroundColor: isDark ? '#2A2A2A' : '#EDEDED', paddingVertical: 12, paddingHorizontal: 32, borderRadius: 10, width: '100%', alignItems: 'center' }}>
              <Text style={{ color: colors.text, fontSize: 15, fontWeight: '600' }}>Cancel</Text>
            </TouchableOpacity>
          </View>
        )}

        {autoStatus === 'failed' && (
          <View style={{ alignItems: 'center', paddingHorizontal: 24 }}>
            <Text style={{ fontSize: 48, marginBottom: 16 }}>⚠️</Text>
            <Text style={{ fontSize: 16, fontWeight: '600', color: colors.text, textAlign: 'center', marginBottom: 24 }}>
              Unable to connect to device.
            </Text>

            <TouchableOpacity onPress={handleAutoScanAgain}
              style={{ backgroundColor: '#1D9E75', paddingVertical: 12, paddingHorizontal: 32, borderRadius: 10, marginBottom: 12, width: '100%', alignItems: 'center' }}>
              <Text style={{ color: '#fff', fontSize: 15, fontWeight: '600' }}>Retry</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={handleAutoCancel}
              style={{ backgroundColor: isDark ? '#2A2A2A' : '#EDEDED', paddingVertical: 12, paddingHorizontal: 32, borderRadius: 10, width: '100%', alignItems: 'center' }}>
              <Text style={{ color: colors.text, fontSize: 15, fontWeight: '600' }}>Cancel</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  }

  // -----------------------------------------------------------------
  // EXISTING MANUAL FLOW (unchanged) — used for Reset WiFi / Change WiFi
  // -----------------------------------------------------------------
  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Text style={[styles.heading, { color: colors.text }]}>ESP32 Setup</Text>
      <Text style={[styles.subtitle, { color: colors.subText }]}>Select your ESP32 device to begin setup.</Text>

      {!loading && networks.length > 0 && (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          <View style={{ backgroundColor: isDark ? '#123328' : '#E1F5EE', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 }}>
            <Text style={{ fontSize: 11, fontWeight: '600', color: '#0F6E56' }}>
              {networks.length} device{networks.length !== 1 ? 's' : ''} found
            </Text>
          </View>
        </View>
      )}

      {loading ? (
        <View style={{ marginTop: 60, alignItems: 'center' }}>
          <ActivityIndicator size="large" color="#1D9E75" />
          <Text style={{ marginTop: 12, color: colors.subText, fontSize: 14 }}>Scanning for ESP32 devices...</Text>
        </View>
      ) : (
        <FlatList data={networks} keyExtractor={(item, i) => `${item.SSID}-${i}`}
          renderItem={renderItem} ListEmptyComponent={renderEmpty}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#1D9E75" colors={['#1D9E75']} />}
          contentContainerStyle={networks.length === 0 ? { flex: 1 } : { paddingBottom: 40 }} />
      )}
    </View>
  );
}