import React, { useEffect, useState, useRef, useCallback } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  View, Text, FlatList, TouchableOpacity,
  Alert, ActivityIndicator, StyleSheet, Animated,
} from 'react-native';
import WifiManager from 'react-native-wifi-reborn';
import Feather from 'react-native-vector-icons/Feather';
import { useAppTheme } from '../services/theme';



export default function HomeWifiListScreen({ navigation }) {
  // ── Theme (new) ───────────────────────────────────────
  // Follows Android system Light/Dark mode automatically via
  // useColorScheme() inside useAppTheme(). No manual toggle.
  const { colors, isDark } = useAppTheme();
  const styles = createStyles(colors);

  const [networks, setNetworks] = useState([]);
  const [loading, setLoading] = useState(true);

  const [refreshing, setRefreshing] = useState(false);

  // ── Auto-refresh-on-scroll-end guards (new) ───────────
  // isScanningRef is a ref (not state) so checking/setting it never
  // triggers a re-render — this is purely a lock, not UI state.
  // It protects ALL scan entry points (initial load, pull-to-refresh,
  // Scan Again button, bottom-reached auto-refresh) from overlapping.
  const isScanningRef = useRef(false);
  // Tracks whether the component is still mounted, to avoid setting
  // state after unmount (memory-leak guard) for in-flight scans.
  const isMountedRef = useRef(true);
  // Simple time-based throttle so rapid repeated onEndReached firings
  // (which FlatList can call more than once near the edge) don't queue
  // up multiple silent refreshes back-to-back.
  const lastAutoRefreshAtRef = useRef(0);
  const AUTO_REFRESH_THROTTLE_MS = 4000;

  useEffect(() => {
    isMountedRef.current = true;
    return () => { isMountedRef.current = false; };
  }, []);

  // ── Visual-only animation values (new) ────────────────
  // Mirrors the header entrance treatment used on the other setup
  // screens. Purely presentational — no effect on data flow,
  // scanning, or navigation.
  const headerFade = useRef(new Animated.Value(0)).current;
  const headerSlide = useRef(new Animated.Value(10)).current;
  const eyebrowFade = useRef(new Animated.Value(0)).current;
  const accentLineWidth = useRef(new Animated.Value(0)).current;
  const accentOpacity = useRef(new Animated.Value(0.4)).current;
  const listFade = useRef(new Animated.Value(0)).current;
  const listSlide = useRef(new Animated.Value(14)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(headerFade, { toValue: 1, duration: 550, useNativeDriver: true }),
      Animated.timing(headerSlide, { toValue: 0, duration: 550, useNativeDriver: true }),
      Animated.timing(eyebrowFade, { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.timing(accentLineWidth, { toValue: 56, duration: 700, delay: 200, useNativeDriver: false }),
      Animated.timing(listFade, { toValue: 1, duration: 600, delay: 150, useNativeDriver: true }),
      Animated.timing(listSlide, { toValue: 0, duration: 600, delay: 150, useNativeDriver: true }),
    ]).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(accentOpacity, { toValue: 1, duration: 2400, useNativeDriver: true }),
        Animated.timing(accentOpacity, { toValue: 0.4, duration: 2400, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchWifiList();
    setRefreshing(false);
  };

  useEffect(() => { fetchWifiList(); }, []);

  // ── Core scan + filter logic (unchanged behavior) ─────
  // silent = true means: no full-screen loader, no pull-to-refresh
  // spinner — just swap the list data in place once the new scan
  // resolves. Used by the bottom-reached auto-refresh path.
  const fetchWifiList = async ({ silent = false } = {}) => {
    // Guard: never allow two scans to run concurrently, regardless
    // of which trigger (initial load, pull-to-refresh, Scan Again
    // button, or auto-refresh) initiated them.
    if (isScanningRef.current) {
      return;
    }
    isScanningRef.current = true;

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

      if (isMountedRef.current) {
        // Always REPLACE the list (never append), so new networks
        // appear and stale/out-of-range ones disappear automatically.
        setNetworks(filteredList);
        if (!silent) {
          setLoading(false);
        }
      }
    } catch (error) {
      console.log(error);
      // Only surface a blocking alert for non-silent scans. A silent
      // background refresh failing shouldn't interrupt the user —
      // the existing list simply stays as-is and they can still pull
      // to refresh or tap Scan Again.
      if (!silent) {
        Alert.alert('Error', 'Unable to scan WiFi');
        if (isMountedRef.current) setLoading(false);
      }
    } finally {
      isScanningRef.current = false;
    }
  };

  // ── Bottom-reached silent auto-refresh (new) ──────────
  const handleEndReached = useCallback(() => {
    const now = Date.now();

    // Skip if a scan (of any kind) is already in flight, if the very
    // first load hasn't finished yet, or if we refreshed too recently.
    if (
      isScanningRef.current ||
      loading ||
      now - lastAutoRefreshAtRef.current < AUTO_REFRESH_THROTTLE_MS
    ) {
      return;
    }

    lastAutoRefreshAtRef.current = now;
    // Fire-and-forget: silent refresh keeps the current list on
    // screen, doesn't touch the loading/refreshing UI state, and
    // simply swaps in the fresh results when the scan resolves.
    fetchWifiList({ silent: true });
  }, [loading]);

  const renderItem = ({ item }) => (
    <TouchableOpacity
      style={styles.networkRow}
      activeOpacity={0.85}
      onPress={() => navigation.navigate('Password', { network: item })}
    >
      <View style={styles.deviceIconWrap}>
        <Feather name="wifi" size={20} color={colors.text} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.ssidText} numberOfLines={1}>{item.SSID}</Text>
        <Text style={styles.metaText}>2.4 GHz</Text>
      </View>
      <Feather name="chevron-right" size={20} color={colors.subText} />
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <View style={styles.container}>
        <Animated.View
          style={[
            styles.header,
            { opacity: headerFade, transform: [{ translateY: headerSlide }] },
          ]}
        >
          <Animated.Text style={[styles.eyebrow, { opacity: eyebrowFade }]}>
            NETWORK SETUP
          </Animated.Text>
          <Text style={styles.heading}>Select WiFi</Text>
          <Text style={styles.subtitle}>Choose Home WiFi (2.4 GHz only)</Text>
          <Animated.View
            style={[styles.accentLine, { width: accentLineWidth, opacity: accentOpacity }]}
          />
        </Animated.View>

        {loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="large" color={colors.text} />
            <Text style={styles.loadingText}>Scanning 2.4GHz WiFi...</Text>
          </View>
        ) : (
          <Animated.View
            style={{ flex: 1, opacity: listFade, transform: [{ translateY: listSlide }] }}
          >
            <FlatList
              data={networks}
              keyExtractor={(item, index) => index.toString()}
              renderItem={renderItem}
              refreshing={refreshing}
              onRefresh={onRefresh}
              onEndReached={handleEndReached}
              onEndReachedThreshold={0.5}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={networks.length === 0 ? { flex: 1 } : { paddingBottom: 40 }}
              ListEmptyComponent={
                <View style={styles.emptyWrap}>
                  <View style={styles.iconWrap}>
                    <Feather name="wifi-off" size={30} color={colors.text} />
                  </View>
                  <Text style={styles.emptyTitle}>No 2.4GHz networks found</Text>
                  <Text style={styles.emptyDescription}>
                    Make sure your home WiFi is broadcasting on the 2.4GHz band, then try again.
                  </Text>
                  <TouchableOpacity
                    style={styles.button}
                    activeOpacity={0.85}
                    onPress={() => { setLoading(true); fetchWifiList(); }}
                  >
                    <Feather name="refresh-cw" size={16} color="#fff" />
                    <Text style={styles.buttonText}>Scan Again</Text>
                  </TouchableOpacity>
                </View>
              }
            />
          </Animated.View>
        )}
      </View>
    </SafeAreaView>
  );
}

const createStyles = (colors) => StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 8,
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
    maxWidth: 300,
  },
  accentLine: {
    height: 3,
    borderRadius: 2,
    backgroundColor: colors.subText,
    marginTop: 18,
  },

  loadingWrap: {
    marginTop: 80,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 14,
    color: colors.subText,
    fontWeight: '500',
  },

  // Network list rows
  networkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 22,
    padding: 18,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#0B0D12',
    shadowOpacity: 0.05,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 2,
  },
  deviceIconWrap: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: 'rgba(120,120,128,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  ssidText: {
    fontSize: 17,
    fontWeight: '600',
    color: colors.text,
    letterSpacing: -0.2,
  },
  metaText: {
    fontSize: 13,
    color: colors.subText,
    fontWeight: '500',
    marginTop: 4,
  },

  // Empty state
  emptyWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  iconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(120,120,128,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 22,
  },
  emptyTitle: {
    fontSize: 19,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 10,
    textAlign: 'center',
    letterSpacing: -0.3,
  },
  emptyDescription: {
    fontSize: 14,
    color: colors.subText,
    textAlign: 'center',
    lineHeight: 21,
    marginBottom: 28,
    maxWidth: 260,
  },

  // Monochromatic primary button
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 16,
    backgroundColor: '#111111',
    shadowColor: '#0B0D12',
    shadowOpacity: 0.16,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3,
  },
  buttonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.1,
  },
});