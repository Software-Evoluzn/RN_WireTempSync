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

const ESP_AP_PASSWORD = '12345678';

// const DEVICE_URL = 'http://abc.local';

export default function DeviceConfig({ navigation, route }) {

  const {product} = route.params;

  console.log("sejal want to see access point ",product.access_point)
  const ESP_SSID_PREFIX = product.access_point;

  const [networks, setNetworks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [connectingSSID, setConnectingSSID] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [resetting, setResetting] = useState(false);

  const [espOnline, setEspOnline] = useState(false);

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
  useEffect(() => { checkPermissionsAndScan(); }, []);

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
      setNetworks(list.filter(i => i.SSID && i.SSID.startsWith(ESP_SSID_PREFIX)));
      setLoading(false);
      setRefreshing(false);
    } catch (e) {
      Alert.alert('Error', 'Scan failed.');
      setLoading(false);
      setRefreshing(false);
    }
  };

  const waitForConnection = async (prefix, retries = 5, delay = 2000) => {
    for (let i = 0; i < retries; i++) {
      try {
        const ssid = await WifiManager.getCurrentWifiSSID();
        if (ssid && ssid.includes(prefix)) return true;
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

  // ── Reset device remotely (when not in AP mode) ──────
  // ── PURAANA HATAO ──────────────────────────────
  // const DEVICE_URL = 'http://abc.local';  ← YEH LINE HATAO

  // ── resetDeviceRemote REPLACE KARO ─────────────
  const resetDeviceRemote = async () => {
    Alert.alert('  Device', 'ESP32 ko remotely reset karein?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Reset', style: 'destructive', onPress: async () => {
          setResetting(true);
          try {
            const ip = await resolveEspIp();           // mDNS / cached
            console.log('ESP32 found at:', ip);
            // reset ke baad device turant restart karta hai -> fetch error aa sakta hai, normal hai
           const res =  await fetch(`http://${ip}/reset_wifi`).catch(() => { });

           if(res.ok){
            console.log("Esp32 connected with wifi")
                Alert.alert('Done', 'Device AP mode me restart ho raha hai. Ab "ESP..." network scan karein.', [
              { text: 'Scan Again', onPress: () => { setLoading(true); setTimeout(scanWifiNetworks, 6000); } },
            ]);
           }else{
            console.log("Esp32 not connect with wifi")
            Alert.alert('Fail' , "Device nahi mil raha" )
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
      <TouchableOpacity style={[styles.networkRow, isConn && { opacity: 0.6 }]}
        onPress={() => connectToESP(item)} disabled={connecting} activeOpacity={0.7}>
        <View style={[styles.signalDot, { backgroundColor: signal.color }]} />
        <View style={{ flex: 1 }}>
          <Text style={styles.ssidText}>{item.SSID}</Text>
          <Text style={styles.metaText}>ESP32 Device · {signal.label}</Text>
        </View>
        {isConn ? <ActivityIndicator size="small" color="#1D9E75" /> : <Text style={styles.chevron}>›</Text>}
      </TouchableOpacity>
    );
  };

  // ── Empty state with Reset option ────────────────────
  const renderEmpty = () => {
    if (loading) return null;
    return (
      <View style={{ alignItems: 'center', marginTop: 60, paddingHorizontal: 20 }}>
        <Text style={{ fontSize: 48, marginBottom: 16 }}>📡</Text>
        <Text style={{ fontSize: 16, fontWeight: '500', color: '#1a1a1a', marginBottom: 8 }}>
          No ESP32 devices found
        </Text>
        <Text style={{ fontSize: 14, color: '#999', textAlign: 'center', lineHeight: 20, marginBottom: 24 }}>
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



        <Text style={{ marginTop: 12, fontSize: 12, color: '#999', textAlign: 'center' }}>
          For reset the Device  your phone and esp32 is on same wifi
        </Text>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>ESP32 Setup</Text>
      <Text style={styles.subtitle}>Select your ESP32 device to begin setup.</Text>

      {!loading && networks.length > 0 && (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          <View style={{ backgroundColor: '#E1F5EE', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 }}>
            <Text style={{ fontSize: 11, fontWeight: '600', color: '#0F6E56' }}>
              {networks.length} device{networks.length !== 1 ? 's' : ''} found
            </Text>
          </View>
        </View>
      )}

      {loading ? (
        <View style={{ marginTop: 60, alignItems: 'center' }}>
          <ActivityIndicator size="large" color="#1D9E75" />
          <Text style={{ marginTop: 12, color: '#666', fontSize: 14 }}>Scanning for ESP32 devices...</Text>
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