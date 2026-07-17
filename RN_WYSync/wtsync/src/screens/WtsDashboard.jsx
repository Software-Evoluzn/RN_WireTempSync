/**
 * WtsDashboard.jsx
 * -----------------------------------------------------------------------
 * React Native port of the web "WTS Dashboard".
 * No Expo / NativeBase / UI Kitten / React Native Paper.
 * Only: React Native core, hooks, FlatList, ScrollView, StyleSheet,
 * react-native-svg, react-native-chart-kit, react-native-vector-icons.
 * -----------------------------------------------------------------------
 */

import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
  memo,
} from 'react';
import {
  View,
  Text,
  FlatList,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  TouchableOpacity,
  Modal,
  Dimensions,
  Animated,
  Platform,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { LineChart } from 'react-native-chart-kit';
import { useNavigation } from '@react-navigation/native';

// -------------------------------------------------------------------------
// COLOR CONSTANTS  (matches web dashboard color rules)
// -------------------------------------------------------------------------
const COLORS = {
  background: '#F5F7FB',
  card: '#FFFFFF',
  border: '#E7EAF3',
  online: '#10B981',
  offline: '#EF4444',
  tempValue: '#1B2A4A', // dark blue for temperature values
  headerText: '#1B2A4A',
  subText: '#8A93A6',
  R: '#DC2626', // Red
  Y: '#D97706', // Yellow / amber
  B: '#2563EB', // Blue
  N: '#6B7280', // Gray
  shadow: '#000000',
};

// Small breathing-room offset so the graph section's top border/divider
// isn't scrolled flush against the header — purely cosmetic, not a
// layout-affecting value.
const GRAPH_SCROLL_BUFFER = 8;

// Maps a phase letter (R / Y / B / N) to its display color
const getPhaseColor = (phaseCode) => {
  const letter = (phaseCode || '').charAt(0).toUpperCase();
  switch (letter) {
    case 'R':
      return COLORS.R;
    case 'Y':
      return COLORS.Y;
    case 'B':
      return COLORS.B;
    case 'N':
      return COLORS.N;
    default:
      return COLORS.tempValue;
  }
};

// -------------------------------------------------------------------------
// DUMMY DATA — replace via API call inside useEffect below.
// Shape matches the API contract described in the spec.
// -------------------------------------------------------------------------
const DUMMY_DEVICES = [
  {
    device_name: 'TRIAL',
    serial_no: 'WTSF0C017',
    status: 'Online',
    panels: [
      {
        panel_no: 1,
        temperatures: [
          { phase: 'R1', current: 31.1, min: 31.1, max: 31.1 },
          { phase: 'Y1', current: 31.75, min: 31.75, max: 31.75 },
          { phase: 'B1', current: 30.7, min: 30.7, max: 30.7 },
          { phase: 'N1', current: 31.96, min: 31.96, max: 31.96 },
        ],
      },
      {
        panel_no: 2,
        temperatures: [
          { phase: 'R2', current: 31.87, min: 31.87, max: 31.87 },
          { phase: 'Y2', current: 31.75, min: 31.75, max: 31.75 },
          { phase: 'B2', current: 31.36, min: 31.35, max: 31.36 },
          { phase: 'N2', current: 31.29, min: null, max: null },
        ],
      },
      {
        panel_no: 3,
        temperatures: [
          { phase: 'R3', current: 31.45, min: 31.45, max: 31.45 },
          { phase: 'Y3', current: 31.19, min: 31.19, max: 31.19 },
        ],
      },
    ],
    graph: [
      { time: '11:00', R: 31.0, Y: 34.0, B: 30.5, N: 37.0 },
      { time: '12:00', R: 33.5, Y: 36.0, B: 32.0, N: 39.5 },
      { time: '14:00', R: 34.0, Y: 37.5, B: 33.0, N: 41.0 },
      { time: '16:00', R: 32.5, Y: 35.5, B: 31.5, N: 38.5 },
      { time: '17:00', R: 31.5, Y: 34.5, B: 30.7, N: 37.5 },
    ],
  },
  {
    device_name: 'HYD',
    serial_no: 'WTSF0C01D',
    status: 'Online',
    panels: [
      {
        panel_no: 1,
        temperatures: [
          { phase: 'R1', current: 35.94, min: 35.89, max: 35.94 },
          { phase: 'Y1', current: 35.76, min: 35.76, max: 35.95 },
          { phase: 'B1', current: 36.69, min: 36.69, max: 36.69 },
          { phase: 'N1', current: 35.69, min: 35.69, max: 35.7 },
        ],
      },
      {
        panel_no: 2,
        temperatures: [
          { phase: 'R2', current: 35.84, min: 35.84, max: 36.03 },
          { phase: 'Y2', current: 36.1, min: 36.1, max: 36.13 },
          { phase: 'B2', current: 36.19, min: 36.19, max: 36.33 },
          { phase: 'N2', current: 35.63, min: null, max: null },
        ],
      },
    ],
    graph: [
      { time: '10:00', R: 35.5, Y: 35.8, B: 36.2, N: 35.4 },
      { time: '12:00', R: 35.9, Y: 36.0, B: 36.5, N: 35.6 },
      { time: '14:00', R: 35.7, Y: 35.9, B: 36.3, N: 35.5 },
    ],
  },
  {
    device_name: 'BLR',
    serial_no: 'WTSF0C02E',
    status: 'Online',
    panels: [
      {
        panel_no: 1,
        temperatures: [
          { phase: 'R1', current: 30.62, min: 30.6, max: 30.62 },
          { phase: 'Y1', current: 30.69, min: 30.66, max: 30.7 },
          { phase: 'B1', current: 30.75, min: 30.69, max: 30.75 },
          { phase: 'N1', current: 30.45, min: 30.44, max: 30.46 },
        ],
      },
      {
        panel_no: 2,
        temperatures: [
          { phase: 'R2', current: 30.5, min: 30.5, max: 30.51 },
          { phase: 'Y2', current: 30.48, min: 30.44, max: 30.5 },
          { phase: 'B2', current: 30.75, min: 30.75, max: 30.76 },
          { phase: 'N2', current: 30.75, min: null, max: null },
        ],
      },
      {
        panel_no: 3,
        temperatures: [
          { phase: 'R3', current: 30.59, min: 30.56, max: 30.6 },
          { phase: 'Y3', current: 30.7, min: 30.69, max: 30.71 },
        ],
      },
    ],
    graph: [
      { time: '11:00', R: 30.4, Y: 30.5, B: 30.6, N: 30.3 },
      { time: '13:00', R: 30.6, Y: 30.7, B: 30.8, N: 30.5 },
      { time: '17:00', R: 30.5, Y: 30.6, B: 30.7, N: 30.4 },
    ],
  },
  {
    device_name: 'OFFICE',
    serial_no: 'WTSF0C044',
    status: 'Offline',
    panels: [],
    graph: [],
  },
];

// -------------------------------------------------------------------------
// StatusBadge — small colored dot + label ("Online" / "Offline")
// -------------------------------------------------------------------------
const StatusBadge = memo(({ status }) => {
  const isOnline = status === 'Online';
  return (
    <View style={styles.statusRow}>
      <View
        style={[
          styles.statusDot,
          { backgroundColor: isOnline ? COLORS.online : COLORS.offline },
        ]}
      />
      <Text
        style={[
          styles.statusText,
          { color: isOnline ? COLORS.online : COLORS.offline },
        ]}
      >
        {status}
      </Text>
    </View>
  );
});

// -------------------------------------------------------------------------
// TemperatureCard — single phase reading (R1 / 31.10°C / Min / Max)
// -------------------------------------------------------------------------
const TemperatureCard = memo(({ temperature }) => {
  const { phase, current, min, max } = temperature;
  const phaseColor = useMemo(() => getPhaseColor(phase), [phase]);

  return (
    <View style={styles.tempCard}>
      <Text style={[styles.tempPhase, { color: phaseColor }]}>{phase}</Text>
      <Text style={styles.tempValue}>
        {current != null ? `${current.toFixed(2)}°C` : '--'}
      </Text>
      <View style={styles.tempMinMaxRow}>
        <Text style={styles.tempMinMax}>
          Min {min != null ? min.toFixed(2) : '--'}
        </Text>
        <Text style={styles.tempMinMax}>
          Max {max != null ? max.toFixed(2) : '--'}
        </Text>
      </View>
    </View>
  );
});

// -------------------------------------------------------------------------
// PanelCard — "Control Panel N" header + wrapped grid of TemperatureCards
// -------------------------------------------------------------------------
const PanelCard = memo(({ panel, onEditPress }) => {
  const handleEdit = useCallback(() => {
    onEditPress && onEditPress(panel.panel_no);
  }, [onEditPress, panel.panel_no]);

  return (
    <View style={styles.panelCard}>
      <View style={styles.panelHeaderRow}>
        <Text style={styles.panelTitle}>Control Panel {panel.panel_no}</Text>
        <TouchableOpacity
          onPress={handleEdit}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Icon name="edit" size={16} color={COLORS.subText} />
        </TouchableOpacity>
      </View>

      <View style={styles.tempGrid}>
        {panel.temperatures.map((temp) => (
          <TemperatureCard key={temp.phase} temperature={temp} />
        ))}
      </View>
    </View>
  );
});

// -------------------------------------------------------------------------
// EmptyPanel — shown when a device is offline / has no panel data
// -------------------------------------------------------------------------
const EmptyPanel = memo(() => (
  <View style={styles.emptyPanelWrap}>
    <Icon name="power-off" size={34} color={COLORS.subText} />
    <Text style={styles.emptyPanelText}>No panel data available</Text>
  </View>
));

// -------------------------------------------------------------------------
// PanelSelector — simple custom dropdown ("All Panels" / "Panel 1" ...)
// Implemented with TouchableOpacity + Modal (no external picker lib).
// -------------------------------------------------------------------------
const PanelSelector = memo(({ options, selected, onSelect }) => {
  const [visible, setVisible] = useState(false);

  const openMenu = useCallback(() => setVisible(true), []);
  const closeMenu = useCallback(() => setVisible(false), []);

  const handleSelect = useCallback(
    (option) => {
      onSelect(option);
      closeMenu();
    },
    [onSelect, closeMenu]
  );

  return (
    <View>
      <TouchableOpacity style={styles.dropdownButton} onPress={openMenu}>
        <Text style={styles.dropdownButtonText}>{selected}</Text>
        <Icon name="arrow-drop-down" size={20} color={COLORS.headerText} />
      </TouchableOpacity>

      <Modal
        transparent
        visible={visible}
        animationType="fade"
        onRequestClose={closeMenu}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={closeMenu}
        >
          <View style={styles.dropdownMenu}>
            {options.map((option) => (
              <TouchableOpacity
                key={option}
                style={styles.dropdownItem}
                onPress={() => handleSelect(option)}
              >
                <Text
                  style={[
                    styles.dropdownItemText,
                    option === selected && styles.dropdownItemTextActive,
                  ]}
                >
                  {option}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
});

// -------------------------------------------------------------------------
// TemperatureGraph — line chart for R / Y / B / N over time
// -------------------------------------------------------------------------
const screenWidth = Dimensions.get('window').width;

const TemperatureGraph = memo(({ graphData, deviceName, panelOptions, onLayout }) => {
  const [selectedPanel, setSelectedPanel] = useState('All Panels');

  // In a real integration, selectedPanel would filter which panel's
  // series are shown. Dummy data currently exposes only merged series.
  const chartData = useMemo(() => {
    if (!graphData || graphData.length === 0) {
      return null;
    }
    return {
      labels: graphData.map((point) => point.time),
      datasets: [
        {
          data: graphData.map((point) => point.R),
          color: () => COLORS.R,
          strokeWidth: 2,
        },
        {
          data: graphData.map((point) => point.Y),
          color: () => COLORS.Y,
          strokeWidth: 2,
        },
        {
          data: graphData.map((point) => point.B),
          color: () => COLORS.B,
          strokeWidth: 2,
        },
        {
          data: graphData.map((point) => point.N),
          color: () => COLORS.N,
          strokeWidth: 2,
        },
      ],
      legend: ['R', 'Y', 'B', 'N'],
    };
  }, [graphData]);

  if (!chartData) {
    return null;
  }

  return (
    <View style={styles.graphWrap} onLayout={onLayout}>
      <View style={styles.graphHeaderRow}>
        <Text style={styles.graphTitle}>Temperature Graph (R, Y, B, N)</Text>
        <PanelSelector
          options={panelOptions}
          selected={selectedPanel}
          onSelect={setSelectedPanel}
        />
      </View>

      <ScrollableChart chartData={chartData} />
    </View>
  );
});

// Wrapping the chart in a horizontal ScrollView so it scrolls on narrow
// phone widths while still filling tablet / landscape widths.
const ScrollableChart = memo(({ chartData }) => {
  const chartWidth = Math.max(screenWidth - 64, chartData.labels.length * 60);

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      <LineChart
        data={chartData}
        width={chartWidth}
        height={220}
        withInnerLines
        withOuterLines
        withShadow={false}
        bezier
        chartConfig={{
          backgroundGradientFrom: COLORS.card,
          backgroundGradientTo: COLORS.card,
          decimalPlaces: 1,
          color: () => COLORS.subText,
          labelColor: () => COLORS.subText,
          propsForDots: {
            r: '2',
          },
          propsForBackgroundLines: {
            stroke: COLORS.border,
          },
        }}
        style={styles.chartStyle}
      />
    </ScrollView>
  );
});

// -------------------------------------------------------------------------
// DeviceCard — top-level card per device: header, panels, graph/empty state
// -------------------------------------------------------------------------
const DeviceCard = memo(
  ({ device, onEditPanel, onChartPress, onCardLayout, onGraphLayout }) => {
    const isOnline = device.status === 'Online';
    const fadeAnim = useState(new Animated.Value(0))[0];

    const handleChartPress = useCallback(() => {
      onChartPress && onChartPress(device.serial_no);
    }, [onChartPress, device.serial_no]);

    const handleCardLayout = useCallback(
      (event) => {
        onCardLayout &&
          onCardLayout(device.serial_no, event.nativeEvent.layout.height);
      },
      [onCardLayout, device.serial_no]
    );

    const handleGraphLayout = useCallback(
      (event) => {
        onGraphLayout &&
          onGraphLayout(device.serial_no, event.nativeEvent.layout.y);
      },
      [onGraphLayout, device.serial_no]
    );

    useEffect(() => {
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 350,
        useNativeDriver: true,
      }).start();
    }, [fadeAnim]);

    const panelOptions = useMemo(
      () => [
        'All Panels',
        ...device.panels.map((panel) => `Panel ${panel.panel_no}`),
      ],
      [device.panels]
    );

    return (
      <Animated.View
        style={[styles.deviceCard, { opacity: fadeAnim }]}
        onLayout={handleCardLayout}
      >
        {/* Device header */}
        <View style={styles.deviceHeaderRow}>
          <View style={styles.deviceHeaderLeft}>
            <Text style={styles.deviceName}>
              {device.device_name} ({device.serial_no})
            </Text>
            <StatusBadge status={device.status} />
          </View>

          <View style={styles.deviceHeaderIcons}>
            <TouchableOpacity
              style={styles.iconCircle}
              onPress={handleChartPress}
            >
              <Icon name="show-chart" size={16} color={COLORS.subText} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Panels or empty state */}
        {isOnline && device.panels.length > 0 ? (
          <View style={styles.panelsWrap}>
            {device.panels.map((panel) => (
              <PanelCard
                key={panel.panel_no}
                panel={panel}
                onEditPress={(panelNo) =>
                  onEditPanel(device.serial_no, panelNo)
                }
              />
            ))}
          </View>
        ) : (
          <EmptyPanel />
        )}

        {/* Graph — only for online devices with data */}
        {isOnline && device.graph && device.graph.length > 0 && (
          <TemperatureGraph
            graphData={device.graph}
            deviceName={device.device_name}
            panelOptions={panelOptions}
            onLayout={handleGraphLayout}
          />
        )}
      </Animated.View>
    );
  }
);

// -------------------------------------------------------------------------
// HeaderMenu — three-dot icon that opens a popup menu positioned directly
// below it. Uses measureInWindow() so the menu always anchors to the
// icon's real on-screen position, regardless of device size.
// -------------------------------------------------------------------------
const HEADER_MENU_OPTIONS = [
  'Reset WiFi',
  'Change WiFi',
  'SMS Enable',
  'Email Enable',
];

const HeaderMenu = memo(({ onSelect }) => {
  const anchorRef = useRef(null);
  const [visible, setVisible] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ top: 0, right: 0 });

  const openMenu = useCallback(() => {
    if (!anchorRef.current) {
      return;
    }
    anchorRef.current.measureInWindow((x, y, width, height) => {
      setMenuPosition({
        top: y + height + 6,
        right: Math.max(screenWidth - (x + width), 12),
      });
      setVisible(true);
    });
  }, []);

  const closeMenu = useCallback(() => setVisible(false), []);

  const handleSelect = useCallback(
    (option) => {
      closeMenu();
      onSelect && onSelect(option);
    },
    [onSelect, closeMenu]
  );

  return (
    <View>
      <TouchableOpacity
        ref={anchorRef}
        style={styles.headerIconButton}
        onPress={openMenu}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Icon name="more-vert" size={22} color={COLORS.headerText} />
      </TouchableOpacity>

      <Modal
        transparent
        visible={visible}
        animationType="fade"
        onRequestClose={closeMenu}
      >
        <TouchableOpacity
          style={styles.headerMenuOverlay}
          activeOpacity={1}
          onPress={closeMenu}
        >
          <View
            style={[
              styles.headerMenuList,
              { top: menuPosition.top, right: menuPosition.right },
            ]}
          >
            {HEADER_MENU_OPTIONS.map((option) => (
              <TouchableOpacity
                key={option}
                style={styles.dropdownItem}
                onPress={() => handleSelect(option)}
              >
                <Text style={styles.dropdownItemText}>{option}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
});

// -------------------------------------------------------------------------
// MAIN SCREEN — WtsDashboard
// -------------------------------------------------------------------------
const WtsDashboard = () => {
  const navigation = useNavigation();
  const flatListRef = useRef(null);
  const deviceHeightsRef = useRef({});
  const deviceGraphOffsetsRef = useRef({});
  const [devices, setDevices] = useState(DUMMY_DEVICES);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // ---------------------------------------------------------------------
  // API integration point.
  // Replace the dummy-data assignment with your real ProductApi call,
  // e.g. `const data = await ProductApi.getDashboard();`
  // ---------------------------------------------------------------------
  const fetchDashboardData = useCallback(async () => {
    try {
      setLoading(true);
      // const data = await ProductApi.getDashboard();
      // setDevices(data);
      setDevices(DUMMY_DEVICES); // dummy data for now
    } catch (error) {
      console.warn('WtsDashboard: failed to load dashboard data', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchDashboardData();
    setRefreshing(false);
  }, [fetchDashboardData]);

  const handleEditPanel = useCallback((serialNo, panelNo) => {
    // Hook up navigation / modal for editing a panel here.
    console.log(`Edit requested: device=${serialNo} panel=${panelNo}`);
  }, []);

  const handleMenuSelect = useCallback((option) => {
    // Hook up the corresponding device action here (API call, modal, etc.)
    console.log(`Header menu option selected: ${option}`);
  }, []);

  // Records each device card's measured height once it's laid out, so
  // exact scroll offsets can be computed for any device in the list.
  const handleCardLayout = useCallback((serialNo, height) => {
    deviceHeightsRef.current[serialNo] = height;
  }, []);

  // Records the exact Y position of a device's Temperature Graph section
  // relative to the top of its own device card.
  const handleGraphLayout = useCallback((serialNo, y) => {
    deviceGraphOffsetsRef.current[serialNo] = y;
  }, []);

  // Chart icon handler — scrolls the FlatList so the tapped device's
  // Temperature Graph title lands exactly at the top of the visible area,
  // directly below the (fixed, non-scrolling) header. The offset is
  // computed from real measured layouts, not hardcoded guesses:
  //   listPadding + sum(previous card heights + card spacing) + graphY
  const handleChartPress = useCallback(
    (serialNo) => {
      const index = devices.findIndex((d) => d.serial_no === serialNo);
      if (index === -1 || !flatListRef.current) {
        return;
      }

      const listPaddingTop = styles.listContent.padding;
      const cardSpacing = styles.deviceCard.marginBottom;

      let cumulativeHeight = listPaddingTop;
      for (let i = 0; i < index; i += 1) {
        const previousSerial = devices[i].serial_no;
        const measuredHeight = deviceHeightsRef.current[previousSerial];

        if (measuredHeight == null) {
          // A previous card hasn't been measured yet (e.g. very first
          // render) — fall back to the approximate scroll rather than
          // risk landing at a wrong offset.
          flatListRef.current.scrollToIndex({
            index,
            animated: true,
            viewPosition: 0,
          });
          return;
        }

        cumulativeHeight += measuredHeight + cardSpacing;
      }

      const graphOffsetWithinCard = deviceGraphOffsetsRef.current[serialNo] || 0;
      const targetOffset = Math.max(
        cumulativeHeight + graphOffsetWithinCard - GRAPH_SCROLL_BUFFER,
        0
      );

      flatListRef.current.scrollToOffset({
        offset: targetOffset,
        animated: true,
      });
    },
    [devices]
  );

  // Fallback in case scrollToIndex is called before all item layouts are
  // measured (a known FlatList quirk with variable-height items).
  const handleScrollToIndexFailed = useCallback((info) => {
    setTimeout(() => {
      flatListRef.current?.scrollToOffset({
        offset: info.averageItemLength * info.index,
        animated: true,
      });
    }, 50);
  }, []);

  const renderDevice = useCallback(
    ({ item }) => (
      <DeviceCard
        device={item}
        onEditPanel={handleEditPanel}
        onChartPress={handleChartPress}
        onCardLayout={handleCardLayout}
        onGraphLayout={handleGraphLayout}
      />
    ),
    [handleEditPanel, handleChartPress, handleCardLayout, handleGraphLayout]
  );

  const keyExtractor = useCallback((item) => item.serial_no, []);

  if (loading && devices.length === 0) {
    return (
      <View style={styles.loaderWrap}>
        <ActivityIndicator size="large" color={COLORS.B} />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      {/* Top header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.headerIconButton}
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Icon name="arrow-back" size={22} color={COLORS.headerText} />
        </TouchableOpacity>

        <View style={styles.headerTitleWrap}>
          <Text style={styles.headerTitle}>WTS Dashboard</Text>
        </View>

        <HeaderMenu onSelect={handleMenuSelect} />
      </View>

      <FlatList
        ref={flatListRef}
        data={devices}
        renderItem={renderDevice}
        keyExtractor={keyExtractor}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        onScrollToIndexFailed={handleScrollToIndexFailed}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={[COLORS.B]}
            tintColor={COLORS.B}
          />
        }
      />
    </View>
  );
};

// -------------------------------------------------------------------------
// STYLES
// -------------------------------------------------------------------------
const cardShadow = Platform.select({
  ios: {
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
  },
  android: {
    elevation: 3,
  },
});

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  loaderWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
  },

  // Header
  header: {
    backgroundColor: COLORS.card,
    paddingVertical: 16,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  headerIconButton: {
    width: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitleWrap: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.headerText,
  },

  // List
  listContent: {
    padding: 16,
    paddingBottom: 32,
  },

  // Device card
  deviceCard: {
    backgroundColor: COLORS.card,
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...cardShadow,
  },
  deviceHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  deviceHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 1,
  },
  deviceName: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.headerText,
    marginRight: 10,
  },
  deviceHeaderIcons: {
    flexDirection: 'row',
  },
  iconCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: COLORS.border,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },

  // Status badge
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 5,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },

  // Panels
  panelsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -6,
  },
  panelCard: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    padding: 12,
    margin: 6,
    minWidth: 260,
    flexGrow: 1,
    flexBasis: '45%',
  },
  panelHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  panelTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.headerText,
  },

  // Temperature grid + cards
  tempGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -4,
  },
  tempCard: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 10,
    margin: 4,
    minWidth: 110,
    flexGrow: 1,
  },
  tempPhase: {
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 4,
  },
  tempValue: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.tempValue,
    marginBottom: 6,
  },
  tempMinMaxRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  tempMinMax: {
    fontSize: 10,
    color: COLORS.subText,
  },

  // Empty panel state
  emptyPanelWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  emptyPanelText: {
    marginTop: 10,
    fontSize: 13,
    color: COLORS.subText,
  },

  // Graph
  graphWrap: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  graphHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  graphTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.headerText,
  },
  chartStyle: {
    borderRadius: 10,
  },

  // Dropdown
  dropdownButton: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: COLORS.card,
  },
  dropdownButtonText: {
    fontSize: 12,
    color: COLORS.headerText,
    marginRight: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dropdownMenu: {
    backgroundColor: COLORS.card,
    borderRadius: 10,
    paddingVertical: 6,
    minWidth: 160,
    ...cardShadow,
  },
  dropdownItem: {
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  dropdownItemText: {
    fontSize: 13,
    color: COLORS.headerText,
  },
  dropdownItemTextActive: {
    color: COLORS.B,
    fontWeight: '700',
  },

  // Header three-dot popup menu
  headerMenuOverlay: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  headerMenuList: {
    position: 'absolute',
    backgroundColor: COLORS.card,
    borderRadius: 10,
    paddingVertical: 6,
    minWidth: 170,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...cardShadow,
  },
});

export default WtsDashboard;