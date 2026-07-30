import React, { useEffect, useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  View, Text, FlatList, TouchableOpacity,
  Alert, ActivityIndicator,
} from 'react-native';
import WifiManager from 'react-native-wifi-reborn';
import styles from '../styles/WiFiListStyles';
import { useAppTheme } from '../services/theme';



export default function HomeWifiListScreen({ navigation }) {
  // ── Theme (new) ───────────────────────────────────────
  // Follows Android system Light/Dark mode automatically via
  // useColorScheme() inside useAppTheme(). No manual toggle.
  const { colors, isDark } = useAppTheme();

  const [networks, setNetworks] = useState([]);
  const [loading, setLoading] = useState(true);

  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = async () => {
  setRefreshing(true);

  await fetchWifiList();

  setRefreshing(false);
};

  useEffect(() => { fetchWifiList(); }, []);

  const fetchWifiList = async () => {
    try {
      const wifiList = await WifiManager.reScanAndLoadWifiList();
      console.log('HOME WIFI', wifiList);

      // ── SIRF 2.4GHz FILTER ─────────────────────────
      // frequency 2400-2500 = 2.4GHz
      // frequency 5000-5900 = 5GHz
      const filteredList = wifiList.filter(item =>
        item.SSID &&
        item.SSID.length > 0 &&
        !item.SSID.startsWith('WTS') &&   // ESP AP hide
        item.frequency >= 2400 &&
        item.frequency <= 2500
      );

      console.log('2.4GHz networks:', filteredList.length);
      setNetworks(filteredList);
      setLoading(false);
    } catch (error) {
      console.log(error);
      Alert.alert('Error', 'Unable to scan WiFi');
      setLoading(false);
    }
  };

  const renderItem = ({ item }) => (
    <TouchableOpacity
      style={[styles.networkRow, { backgroundColor: colors.card, borderColor: colors.border }]}
      onPress={() => navigation.navigate('Password', { network: item })}
    >
      <View style={[styles.signalDot, { backgroundColor: '#1D9E75' }]} />
      <View style={{ flex: 1 }}>
        <Text style={[styles.ssidText, { color: colors.text }]}>{item.SSID}</Text>
        <Text style={[styles.metaText, { color: colors.subText }]}>2.4 GHz</Text>
      </View>
      <Text style={[styles.chevron, { color: colors.subText }]}>›</Text>
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Text style={[styles.heading, { color: colors.text }]}>Select WiFi</Text>
      <Text style={[styles.subtitle, { color: colors.subText }]}>Choose Home WiFi (2.4 GHz only)</Text>

      {loading ? (
        <View style={{ marginTop: 50 }}>
          <ActivityIndicator size="large" color="#1D9E75" />
          <Text style={{ marginTop: 10, textAlign: 'center', color: colors.subText }}>Scanning 2.4GHz WiFi...</Text>
        </View>
      ) : (
        <FlatList
          data={networks}
          keyExtractor={(item, index) => index.toString()}
          renderItem={renderItem}
            refreshing={refreshing}
            onRefresh={onRefresh}
          ListEmptyComponent={
            <View style={{ alignItems: 'center', marginTop: 50 }}>
              <Text style={{ fontSize: 16, color: colors.subText }}>No 2.4GHz networks found</Text>
              <TouchableOpacity
                style={{ marginTop: 16, backgroundColor: '#1D9E75', paddingVertical: 10, paddingHorizontal: 24, borderRadius: 8 }}
                onPress={() => { setLoading(true); fetchWifiList(); }}
              >
                <Text style={{ color: '#fff', fontWeight: '600' }}>Scan Again</Text>
              </TouchableOpacity>
            </View>
          }
        />
      )}
    </View>
  );
}