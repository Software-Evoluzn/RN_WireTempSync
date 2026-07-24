/**
 * WtsDashboard.jsx
 * -----------------------------------------------------------------------
 * React Native port of the web "WTS Dashboard".
 * No Expo / NativeBase / UI Kitten / React Native Paper.
 * Only: React Native core, hooks, FlatList, ScrollView, StyleSheet,
 * react-native-svg, react-native-vector-icons.
 *
 * GRAPH NOTES (real-time + historical temperature graph)
 * -----------------------------------------------------------------------
 * - X axis is FIXED for the whole day: 00:00 -> 23:59 (1440 minutes).
 * - Default view = TODAY, with live socket data streaming in and
 *   plotted at its real time-of-day position on that fixed axis.
 * - Zoom is PINCH-ONLY (2-finger gesture) — no +/- buttons.
 *   Double-tap the chart to reset back to the full-day view.
 * - 1-finger drag pans left/right once zoomed in.
 * - Date is chosen via a calendar dropdown (tap the date field to open
 *   a month-grid picker). Selecting a day fetches that day's readings
 *   from the backend (`/api/telemetry-history`).
 * - When viewing TODAY, the fetched history (earlier in the day) is
 *   merged with whatever live points have already streamed in via
 *   socket, so nothing is duplicated or lost.
 * - The existing Panel dropdown ("All Panels" / "Panel 1" / ...) acts as
 *   the control-panel filter for which phase lines are drawn.
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
  PanResponder,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import Svg, { Line as SvgLine, Path, Text as SvgText, Circle } from 'react-native-svg';
import { useNavigation, useRoute } from '@react-navigation/native';
import io from 'socket.io-client';
import auth from '@react-native-firebase/auth';

// -------------------------------------------------------------------------
// BACKEND CONFIG
// -------------------------------------------------------------------------
const BACKEND_URL = 'http://192.168.1.42:5006';

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
  now: '#F43F5E',
  grid: '#EDF0F7',
  live: '#10B981',
  disabledDay: '#C7CCDA',
};

// Small breathing-room offset so the graph section's top border/divider
// isn't scrolled flush against the header — purely cosmetic, not a
// layout-affecting value.
const GRAPH_SCROLL_BUFFER = 8;

// Maps a phase letter (R / Y / B / N) to its display color
// (used by TemperatureCard — unrelated to the graph, left unchanged).
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

// Maps a full phase code (e.g. "R1", "R2", "Y3"...) to a distinct color
// for the graph. Same letter family stays visually related (red family,
// yellow family, etc.) while different panel numbers get a distinct
// shade so "All Panels" mode never has two indistinguishable lines.
const SERIES_COLOR_VARIANTS = {
  R: ['#DC2626', '#F87171', '#991B1B', '#FCA5A5', '#7F1D1D', '#FECACA'],
  Y: ['#D97706', '#FBBF24', '#92400E', '#FDE68A', '#78350F', '#FEF3C7'],
  B: ['#2563EB', '#60A5FA', '#1E3A8A', '#93C5FD', '#1E40AF', '#BFDBFE'],
  N: ['#6B7280', '#9CA3AF', '#374151', '#D1D5DB', '#111827', '#E5E7EB'],
};

const getSeriesColor = (phaseCode) => {
  const letter = (phaseCode || '').charAt(0).toUpperCase();
  const digits = (phaseCode || '').replace(/[^0-9]/g, '');
  const panelIndex = digits ? parseInt(digits, 10) : 1;
  const palette = SERIES_COLOR_VARIANTS[letter] || SERIES_COLOR_VARIANTS.N;
  return palette[(panelIndex - 1) % palette.length];
};

// -------------------------------------------------------------------------
// DUMMY DATA — Fallback if network request fails
// -------------------------------------------------------------------------
const DUMMY_DEVICES = [
  {
    device_name: 'EZN-WTS-10C',
    serial_no: 'WTSF0C02E',
    status: 'Online',
    panels: [
      {
        panel_no: 1,
        custom_name: 'Main Hall',
        temperatures: [
          { phase: 'R1', current: 31.1, min: 31.1, max: 31.1 },
          { phase: 'Y1', current: 31.75, min: 31.75, max: 31.75 },
          { phase: 'B1', current: 30.7, min: 30.7, max: 30.7 },
          { phase: 'N1', current: 31.96, min: 31.96, max: 31.96 },
        ],
      },
    ],
  },
];

// -------------------------------------------------------------------------
// DATE / TIME HELPERS
// -------------------------------------------------------------------------
const DAY_MINUTES = 24 * 60; // 1440 -> covers 00:00 to 23:59

const dateKeyOf = (d = new Date()) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const isSameDay = (a, b) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

const MONTH_LABELS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const MONTH_LABELS_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];
const WEEKDAY_LABELS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

const formatDateLabel = (d) =>
  `${String(d.getDate()).padStart(2, '0')} ${MONTH_LABELS_SHORT[d.getMonth()]} ${d.getFullYear()}`;

const minutesSinceMidnight = (d = new Date()) =>
  d.getHours() * 60 + d.getMinutes() + d.getSeconds() / 60;

// Parses a backend ISO timestamp string and returns minutes-since-midnight
// on the date it represents (local time).
const parseTimestampToMinutes = (isoString) => {
  const d = new Date(isoString);
  return d.getHours() * 60 + d.getMinutes() + d.getSeconds() / 60;
};

const formatMinutes = (mins) => {
  const m = Math.round(((mins % DAY_MINUTES) + DAY_MINUTES) % DAY_MINUTES);
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return `${String(h).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
};

// The 24 phase columns as stored in the temp_values table
const PHASE_COLUMNS = [
  'R1', 'Y1', 'B1', 'N1', 'R2', 'Y2', 'B2', 'N2',
  'R3', 'Y3', 'B3', 'N3', 'R4', 'Y4', 'B4', 'N4',
  'R5', 'Y5', 'B5', 'N5', 'R6', 'Y6', 'B6', 'N6',
];

/**
 * Converts raw DB rows (from /api/telemetry-history) into a series map,
 * then merges in any live points that already exist for this date
 * (i.e. today's socket-streamed points) without duplicating data:
 * only live points AFTER the last DB timestamp are kept.
 */
const mergeDbRowsWithExisting = (existingEntry, rows, dateKey) => {
  const dbSeries = {};
  rows.forEach((row) => {
    const t = parseTimestampToMinutes(row.timestamp);
    PHASE_COLUMNS.forEach((col) => {
      const v = row[col];
      if (v === null || v === undefined) return;
      if (!dbSeries[col]) dbSeries[col] = [];
      dbSeries[col].push({ t, v });
    });
  });

  const merged = { dateKey, series: {} };
  const existingSeries = existingEntry?.series || {};
  const allPhases = new Set([
    ...Object.keys(dbSeries),
    ...Object.keys(existingSeries),
  ]);

  allPhases.forEach((phase) => {
    const dbPts = dbSeries[phase] || [];
    const maxDbT = dbPts.length ? dbPts[dbPts.length - 1].t : -1;
    const livePts = (existingSeries[phase] || []).filter((p) => p.t > maxDbT);
    merged.series[phase] = [...dbPts, ...livePts];
  });

  return merged;
};

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
// PanelCard — Custom Panel Name header + wrapped grid of TemperatureCards
// -------------------------------------------------------------------------
const PanelCard = memo(({ panel, onEditPress }) => {
  const handleEdit = useCallback(() => {
    onEditPress && onEditPress(panel.panel_no);
  }, [onEditPress, panel.panel_no]);

  // Only show phase blocks (R/Y/B/N) that actually have a current
  // reading. Phases with no live value (null/undefined) are hidden
  // instead of showing an empty "--" card.
  const visibleTemperatures = useMemo(
    () => panel.temperatures.filter((temp) => temp.current != null),
    [panel.temperatures]
  );

  if (visibleTemperatures.length === 0) {
    return null;
  }

  return (
    <View style={styles.panelCard}>
      <View style={styles.panelHeaderRow}>
        <Text style={styles.panelTitle}>
          {panel.custom_name || `Control Panel ${panel.panel_no}`}
        </Text>
        <TouchableOpacity
          onPress={handleEdit}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Icon name="edit" size={16} color={COLORS.subText} />
        </TouchableOpacity>
      </View>

      <View style={styles.tempGrid}>
        {visibleTemperatures.map((temp) => (
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
// This is the "Control Panel filter" for the graph.
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
// CalendarModal — month-grid date picker (the "calendar dropdown")
// -------------------------------------------------------------------------
const CalendarModal = memo(({ visible, selectedDate, onSelect, onClose }) => {
  const [viewMonth, setViewMonth] = useState(
    () => new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1)
  );

  useEffect(() => {
    if (visible) {
      setViewMonth(new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1));
    }
  }, [visible, selectedDate]);

  const today = new Date();
  const isViewingCurrentMonth =
    viewMonth.getFullYear() === today.getFullYear() &&
    viewMonth.getMonth() === today.getMonth();

  const goPrevMonth = useCallback(() => {
    setViewMonth((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1));
  }, []);

  const goNextMonth = useCallback(() => {
    if (isViewingCurrentMonth) return;
    setViewMonth((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1));
  }, [isViewingCurrentMonth]);

  const cells = useMemo(() => {
    const year = viewMonth.getFullYear();
    const month = viewMonth.getMonth();
    const firstWeekday = new Date(year, month, 1).getDay();
    const totalDays = new Date(year, month + 1, 0).getDate();

    const list = [];
    for (let i = 0; i < firstWeekday; i += 1) {
      list.push(null);
    }
    for (let day = 1; day <= totalDays; day += 1) {
      list.push(new Date(year, month, day));
    }
    return list;
  }, [viewMonth]);

  const handleJumpToday = useCallback(() => {
    onSelect(new Date());
  }, [onSelect]);

  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity activeOpacity={1} style={styles.calendarCard}>
          <View style={styles.calendarHeaderRow}>
            <TouchableOpacity
              style={styles.calendarNavBtn}
              onPress={goPrevMonth}
              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
            >
              <Icon name="chevron-left" size={20} color={COLORS.headerText} />
            </TouchableOpacity>

            <Text style={styles.calendarMonthText}>
              {MONTH_LABELS[viewMonth.getMonth()]} {viewMonth.getFullYear()}
            </Text>

            <TouchableOpacity
              style={[
                styles.calendarNavBtn,
                isViewingCurrentMonth && styles.calendarNavBtnDisabled,
              ]}
              onPress={goNextMonth}
              disabled={isViewingCurrentMonth}
              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
            >
              <Icon
                name="chevron-right"
                size={20}
                color={isViewingCurrentMonth ? COLORS.disabledDay : COLORS.headerText}
              />
            </TouchableOpacity>
          </View>

          <View style={styles.calendarWeekdayRow}>
            {WEEKDAY_LABELS.map((wd) => (
              <View key={wd} style={styles.calendarWeekdayCell}>
                <Text style={styles.calendarWeekdayText}>{wd}</Text>
              </View>
            ))}
          </View>

          <View style={styles.calendarGrid}>
            {cells.map((cellDate, idx) => {
              if (!cellDate) {
                return <View key={`empty-${idx}`} style={styles.calendarDayCell} />;
              }

              const isFuture = cellDate > today && !isSameDay(cellDate, today);
              const isSelected = isSameDay(cellDate, selectedDate);
              const isToday = isSameDay(cellDate, today);

              return (
                <TouchableOpacity
                  key={cellDate.toISOString()}
                  style={styles.calendarDayCell}
                  disabled={isFuture}
                  onPress={() => onSelect(cellDate)}
                >
                  <View
                    style={[
                      styles.calendarDayInner,
                      isSelected && styles.calendarDaySelected,
                      isToday && !isSelected && styles.calendarDayToday,
                    ]}
                  >
                    <Text
                      style={[
                        styles.calendarDayText,
                        isFuture && styles.calendarDayTextDisabled,
                        isSelected && styles.calendarDayTextSelected,
                      ]}
                    >
                      {cellDate.getDate()}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>

          <TouchableOpacity style={styles.calendarTodayLink} onPress={handleJumpToday}>
            <Text style={styles.calendarTodayLinkText}>Jump to Today</Text>
          </TouchableOpacity>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
});

// -------------------------------------------------------------------------
// DateField — tappable field showing the selected date; opens the
// CalendarModal ("calendar dropdown") on press.
// -------------------------------------------------------------------------
const DateField = memo(({ selectedDate, isToday, onChangeDate }) => {
  const [calendarVisible, setCalendarVisible] = useState(false);

  const openCalendar = useCallback(() => setCalendarVisible(true), []);
  const closeCalendar = useCallback(() => setCalendarVisible(false), []);

  const handleSelect = useCallback(
    (date) => {
      onChangeDate(date);
      setCalendarVisible(false);
    },
    [onChangeDate]
  );

  return (
    <View style={styles.dateFieldRow}>
      <TouchableOpacity style={styles.dateFieldBtn} onPress={openCalendar}>
        <Icon name="calendar-today" size={14} color={COLORS.headerText} />
        <Text style={styles.dateFieldText}>{formatDateLabel(selectedDate)}</Text>
        <Icon name="arrow-drop-down" size={18} color={COLORS.headerText} />
      </TouchableOpacity>

      {isToday && (
        <View style={styles.liveBadge}>
          <View style={styles.liveDot} />
          <Text style={styles.liveBadgeText}>LIVE</Text>
        </View>
      )}

      <CalendarModal
        visible={calendarVisible}
        selectedDate={selectedDate}
        onSelect={handleSelect}
        onClose={closeCalendar}
      />
    </View>
  );
});

// -------------------------------------------------------------------------
// REAL-TIME / HISTORICAL GRAPH — custom SVG chart, fixed 00:00-23:59 axis
// Pinch (2-finger) to zoom, 1-finger drag to pan, double-tap to reset.
// -------------------------------------------------------------------------
const screenWidth = Dimensions.get('window').width;
const CHART_WIDTH = screenWidth - 64;
const CHART_HEIGHT = 240;
const CHART_PAD = { top: 14, right: 14, bottom: 26, left: 42 };
const PLOT_WIDTH = CHART_WIDTH - CHART_PAD.left - CHART_PAD.right;
const PLOT_HEIGHT = CHART_HEIGHT - CHART_PAD.top - CHART_PAD.bottom;

const MIN_VIEW_SPAN = 20; // minutes — how far the user can pinch-zoom in
const DOUBLE_TAP_MS = 300;
const TAP_MOVE_TOLERANCE = 6; // px

const getTickStepMinutes = (spanMinutes) => {
  if (spanMinutes <= 40) return 5;
  if (spanMinutes <= 90) return 15;
  if (spanMinutes <= 180) return 30;
  if (spanMinutes <= 480) return 60;
  if (spanMinutes <= 900) return 120;
  return 180;
};

const clampView = (start, end) => {
  let s = start;
  let e = end;
  if (s < 0) {
    e -= s;
    s = 0;
  }
  if (e > DAY_MINUTES) {
    s -= e - DAY_MINUTES;
    e = DAY_MINUTES;
  }
  s = Math.max(0, s);
  e = Math.min(DAY_MINUTES, e);
  return { start: s, end: e };
};

/**
 * RealtimeChart — draws one line per phase on a fixed 00:00-23:59 axis.
 * seriesMap: { [phaseCode]: [{ t: minutesSinceMidnight, v: number }, ...] }
 */
const RealtimeChart = memo(({ seriesMap, nowMinutes, loading }) => {
  const [view, setView] = useState({ start: 0, end: DAY_MINUTES });
  const viewRef = useRef(view);
  const gestureRef = useRef(null);
  const lastTapRef = useRef(0);

  useEffect(() => {
    viewRef.current = view;
  }, [view]);

  // Reset zoom/pan whenever the underlying series identity changes
  // (i.e. the user switched dates) so old zoom state doesn't carry over.
  useEffect(() => {
    setView({ start: 0, end: DAY_MINUTES });
  }, [seriesMap]);

  const resetView = useCallback(() => {
    setView({ start: 0, end: DAY_MINUTES });
  }, []);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (evt, gestureState) =>
        Math.abs(gestureState.dx) > 2 ||
        Math.abs(gestureState.dy) > 2 ||
        evt.nativeEvent.touches.length === 2,
      onPanResponderGrant: (evt) => {
        const touches = evt.nativeEvent.touches;
        gestureRef.current = {
          startView: { ...viewRef.current },
          touchXs: touches.map((t) => t.pageX),
        };
      },
      onPanResponderMove: (evt, gestureState) => {
        const start = gestureRef.current;
        if (!start) return;
        const touches = evt.nativeEvent.touches;

        if (touches.length === 2 && start.touchXs.length === 2) {
          // Pinch to zoom, anchored on the view's current center
          const currentDist = Math.abs(touches[1].pageX - touches[0].pageX);
          const initialDist = Math.abs(start.touchXs[1] - start.touchXs[0]);
          if (initialDist < 1) return;

          const initialSpan = start.startView.end - start.startView.start;
          const scaleRatio = currentDist / initialDist;
          const newSpan = Math.min(
            DAY_MINUTES,
            Math.max(MIN_VIEW_SPAN, initialSpan / scaleRatio)
          );
          const center = (start.startView.start + start.startView.end) / 2;
          setView(clampView(center - newSpan / 2, center + newSpan / 2));
        } else if (touches.length === 1) {
          // 1-finger pan
          const span = start.startView.end - start.startView.start;
          const deltaMinutes = -(gestureState.dx / PLOT_WIDTH) * span;
          setView(
            clampView(
              start.startView.start + deltaMinutes,
              start.startView.end + deltaMinutes
            )
          );
        }
      },
      onPanResponderRelease: (evt, gestureState) => {
        const wasTap =
          Math.abs(gestureState.dx) < TAP_MOVE_TOLERANCE &&
          Math.abs(gestureState.dy) < TAP_MOVE_TOLERANCE;

        if (wasTap) {
          const now = Date.now();
          if (now - lastTapRef.current < DOUBLE_TAP_MS) {
            resetView();
            lastTapRef.current = 0;
          } else {
            lastTapRef.current = now;
          }
        }
        gestureRef.current = null;
      },
      onPanResponderTerminate: () => {
        gestureRef.current = null;
      },
    })
  ).current;

  const span = view.end - view.start;

  const xScale = useCallback(
    (t) => CHART_PAD.left + ((t - view.start) / span) * PLOT_WIDTH,
    [view.start, span]
  );

  const phases = Object.keys(seriesMap).sort();

  const { yMin, yMax } = useMemo(() => {
    let min = Infinity;
    let max = -Infinity;
    phases.forEach((phase) => {
      const pts = seriesMap[phase];
      for (let i = 0; i < pts.length; i += 1) {
        const { t, v } = pts[i];
        if (t < view.start - span * 0.05 || t > view.end + span * 0.05) continue;
        if (v < min) min = v;
        if (v > max) max = v;
      }
    });
    if (!isFinite(min) || !isFinite(max)) {
      return { yMin: 20, yMax: 40 };
    }
    if (max - min < 2) {
      const mid = (max + min) / 2;
      min = mid - 1;
      max = mid + 1;
    }
    const padAmt = (max - min) * 0.15;
    return { yMin: min - padAmt, yMax: max + padAmt };
  }, [seriesMap, phases, view.start, view.end, span]);

  const yScale = useCallback(
    (v) =>
      CHART_PAD.top +
      (1 - (v - yMin) / (yMax - yMin || 1)) * PLOT_HEIGHT,
    [yMin, yMax]
  );

  const xTicks = useMemo(() => {
    const step = getTickStepMinutes(span);
    const first = Math.ceil(view.start / step) * step;
    const ticks = [];
    for (let t = first; t <= view.end; t += step) {
      ticks.push(t);
    }
    return ticks;
  }, [view.start, view.end, span]);

  const yTicks = useMemo(() => {
    const count = 4;
    const ticks = [];
    for (let i = 0; i <= count; i += 1) {
      ticks.push(yMin + ((yMax - yMin) * i) / count);
    }
    return ticks;
  }, [yMin, yMax]);

  const hasAnyData = phases.some((p) => seriesMap[p] && seriesMap[p].length > 0);
  const nowVisible =
    nowMinutes != null && nowMinutes >= view.start && nowMinutes <= view.end;
  const isZoomed = span < DAY_MINUTES - 1;

  return (
    <View>
      <View {...panResponder.panHandlers} style={styles.chartTouchArea}>
        <Svg width={CHART_WIDTH} height={CHART_HEIGHT}>
          {/* Horizontal gridlines + Y axis labels */}
          {yTicks.map((val, i) => (
            <React.Fragment key={`y-${i}`}>
              <SvgLine
                x1={CHART_PAD.left}
                y1={yScale(val)}
                x2={CHART_WIDTH - CHART_PAD.right}
                y2={yScale(val)}
                stroke={COLORS.grid}
                strokeWidth={1}
              />
              <SvgText
                x={CHART_PAD.left - 6}
                y={yScale(val) + 3}
                fontSize={9}
                fill={COLORS.subText}
                textAnchor="end"
              >
                {val.toFixed(0)}
              </SvgText>
            </React.Fragment>
          ))}

          {/* Vertical gridlines + X axis time labels */}
          {xTicks.map((t, i) => (
            <React.Fragment key={`x-${i}`}>
              <SvgLine
                x1={xScale(t)}
                y1={CHART_PAD.top}
                x2={xScale(t)}
                y2={CHART_HEIGHT - CHART_PAD.bottom}
                stroke={COLORS.grid}
                strokeWidth={1}
              />
              <SvgText
                x={xScale(t)}
                y={CHART_HEIGHT - CHART_PAD.bottom + 14}
                fontSize={9}
                fill={COLORS.subText}
                textAnchor="middle"
              >
                {formatMinutes(t)}
              </SvgText>
            </React.Fragment>
          ))}

          {/* Phase lines */}
          {phases.map((phase) => {
            const pts = seriesMap[phase];
            if (!pts || pts.length === 0) return null;

            let d = '';
            let started = false;
            for (let i = 0; i < pts.length; i += 1) {
              const { t, v } = pts[i];
              if (t < view.start - span * 0.05 || t > view.end + span * 0.05) {
                continue;
              }
              const x = xScale(t);
              const y = yScale(v);
              d += started ? ` L ${x} ${y}` : `M ${x} ${y}`;
              started = true;
            }
            if (!started) return null;

            const lastPt = pts[pts.length - 1];
            const lastVisible =
              lastPt.t >= view.start && lastPt.t <= view.end;

            return (
              <React.Fragment key={phase}>
                <Path
                  d={d}
                  stroke={getSeriesColor(phase)}
                  strokeWidth={2}
                  fill="none"
                />
                {lastVisible && (
                  <Circle
                    cx={xScale(lastPt.t)}
                    cy={yScale(lastPt.v)}
                    r={3}
                    fill={getSeriesColor(phase)}
                  />
                )}
              </React.Fragment>
            );
          })}

          {/* "Now" marker — only relevant when viewing today */}
          {nowVisible && (
            <SvgLine
              x1={xScale(nowMinutes)}
              y1={CHART_PAD.top}
              x2={xScale(nowMinutes)}
              y2={CHART_HEIGHT - CHART_PAD.bottom}
              stroke={COLORS.now}
              strokeWidth={1}
              strokeDasharray="4,4"
            />
          )}

          {/* Current visible time-range, small label top-right (info only) */}
          <SvgText
            x={CHART_WIDTH - CHART_PAD.right}
            y={CHART_PAD.top - 2}
            fontSize={9}
            fill={COLORS.subText}
            textAnchor="end"
          >
            {`${formatMinutes(view.start)} - ${formatMinutes(view.end)}`}
          </SvgText>
        </Svg>

        {!hasAnyData && (
          <View style={styles.chartEmptyOverlay}>
            {loading ? (
              <ActivityIndicator size="small" color={COLORS.B} />
            ) : (
              <Text style={styles.emptyPanelText}>No data for this day</Text>
            )}
          </View>
        )}
      </View>

      <View style={styles.chartHintRow}>
        <Text style={styles.chartHintText}>
          Pinch to zoom · drag to pan{isZoomed ? ' · double-tap to reset' : ''}
        </Text>
      </View>

      {/* Legend */}
      <View style={styles.legendRow}>
        {phases.map((phase) => (
          <View key={phase} style={styles.legendItem}>
            <View
              style={[
                styles.legendDot,
                { backgroundColor: getSeriesColor(phase) },
              ]}
            />
            <Text style={styles.legendText}>{phase}</Text>
          </View>
        ))}
      </View>
    </View>
  );
});

// -------------------------------------------------------------------------
// TemperatureGraph — wraps RealtimeChart with panel filter + calendar
// -------------------------------------------------------------------------
const TemperatureGraph = memo(
  ({
    device,
    historyRef,
    historyVersion,
    onRequestHistory,
    panelOptions,
    onLayout,
  }) => {
    const [selectedPanel, setSelectedPanel] = useState('All Panels');
    const [selectedDate, setSelectedDate] = useState(() => new Date());
    const [historyLoading, setHistoryLoading] = useState(false);
    const [nowMinutes, setNowMinutes] = useState(() => minutesSinceMidnight());

    const dateKey = useMemo(() => dateKeyOf(selectedDate), [selectedDate]);
    const isToday = dateKey === dateKeyOf(new Date());

    // Tick the "now" marker forward every 30s without needing new data
    useEffect(() => {
      const id = setInterval(() => setNowMinutes(minutesSinceMidnight()), 30000);
      return () => clearInterval(id);
    }, []);

    // Fetch history whenever the selected date changes (or on first mount)
    useEffect(() => {
      let cancelled = false;
      setHistoryLoading(true);
      Promise.resolve(onRequestHistory(device.serial_no, dateKey)).finally(() => {
        if (!cancelled) setHistoryLoading(false);
      });
      return () => {
        cancelled = true;
      };
    }, [device.serial_no, dateKey, onRequestHistory]);

    const historyEntry = historyRef.current[device.serial_no]?.[dateKey];

    const seriesMap = useMemo(() => {
      if (!historyEntry || !historyEntry.series) {
        return {};
      }

      const panelsToInclude =
        selectedPanel === 'All Panels'
          ? device.panels
          : device.panels.filter(
              (panel) =>
                (panel.custom_name || `Panel ${panel.panel_no}`) ===
                selectedPanel
            );

      const includedPhases = new Set();
      panelsToInclude.forEach((panel) => {
        panel.temperatures.forEach((t) => includedPhases.add(t.phase));
      });

      const result = {};
      includedPhases.forEach((phase) => {
        if (historyEntry.series[phase]) {
          result[phase] = historyEntry.series[phase];
        }
      });
      return result;
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [device.panels, selectedPanel, historyEntry, historyVersion, dateKey]);

    return (
      <View style={styles.graphWrap} onLayout={onLayout}>
        <View style={styles.graphHeaderRow}>
          <Text style={styles.graphTitle}>Temperature Graph</Text>
          <PanelSelector
            options={panelOptions}
            selected={selectedPanel}
            onSelect={setSelectedPanel}
          />
        </View>

        <DateField
          selectedDate={selectedDate}
          isToday={isToday}
          onChangeDate={setSelectedDate}
        />

        <RealtimeChart
          seriesMap={seriesMap}
          nowMinutes={isToday ? nowMinutes : null}
          loading={historyLoading}
        />
      </View>
    );
  }
);

// -------------------------------------------------------------------------
// DeviceCard — top-level card per device: header, panels, graph/empty state
// -------------------------------------------------------------------------
const DeviceCard = memo(
  ({
    device,
    onEditPanel,
    onChartPress,
    onCardLayout,
    onGraphLayout,
    historyRef,
    historyVersion,
    onRequestHistory,
  }) => {
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
        ...device.panels.map(
          (panel) => panel.custom_name || `Panel ${panel.panel_no}`
        ),
      ],
      [device.panels]
    );

    return (
      <Animated.View
        style={[styles.deviceCard, { opacity: fadeAnim }]}
        onLayout={handleCardLayout}
      >
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

        {device.panels && device.panels.length > 0 && (
          <TemperatureGraph
            device={device}
            historyRef={historyRef}
            historyVersion={historyVersion}
            onRequestHistory={onRequestHistory}
            panelOptions={panelOptions}
            onLayout={handleGraphLayout}
          />
        )}
      </Animated.View>
    );
  }
);

// -------------------------------------------------------------------------
// HeaderMenu — three-dot popup menu
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
  const route = useRoute();
  const selectedProduct = route.params?.product;
  const firebaseUid = route?.params?.firebaseUid || auth().currentUser?.uid;

  const flatListRef = useRef(null);
  const deviceHeightsRef = useRef({});
  const deviceGraphOffsetsRef = useRef({});
  const [devices, setDevices] = useState(DUMMY_DEVICES);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const filteredDevices = useMemo(() => {
    if (!selectedProduct?.serial_no) {
      return devices;
    }
    return devices.filter(
      (device) => device.serial_no === selectedProduct.serial_no
    );
  }, [devices, selectedProduct]);

  // ---------------------------------------------------------------------
  // Graph history storage
  // Structure: deviceHistoryRef.current = {
  //   [serial_no]: {
  //     [dateKey]: { dateKey, series: { [phase]: [{t, v}, ...] } }
  //   }
  // }
  // `t` is minutes-since-midnight (real time-of-day), so points map
  // directly onto the fixed 00:00-23:59 axis.
  // ---------------------------------------------------------------------
  const deviceHistoryRef = useRef({});
  const historyLoadedRef = useRef({}); // `${serial}|${dateKey}` -> true once fetched
  const [historyVersion, setHistoryVersion] = useState(0);

  // Live socket data -> append to TODAY's entry for each online device
  useEffect(() => {
    const nowDate = new Date();
    const dateKey = dateKeyOf(nowDate);
    const t = minutesSinceMidnight(nowDate);

    filteredDevices.forEach((device) => {
      if (device.status !== 'Online') {
        return;
      }

      const serial = device.serial_no;
      if (!deviceHistoryRef.current[serial]) {
        deviceHistoryRef.current[serial] = {};
      }
      if (!deviceHistoryRef.current[serial][dateKey]) {
        deviceHistoryRef.current[serial][dateKey] = { dateKey, series: {} };
      }
      const entry = deviceHistoryRef.current[serial][dateKey];

      device.panels.forEach((panel) => {
        panel.temperatures.forEach((temp) => {
          const phaseCode = temp.phase;
          if (temp.current == null) return;

          if (!entry.series[phaseCode]) {
            entry.series[phaseCode] = [];
          }
          const series = entry.series[phaseCode];
          const lastPoint = series[series.length - 1];

          // Avoid piling up identical back-to-back points if this
          // effect re-runs without genuinely new telemetry
          if (!lastPoint || lastPoint.v !== temp.current || t - lastPoint.t > 0.05) {
            series.push({ t, v: temp.current });
          }
        });
      });
    });

    setHistoryVersion((v) => v + 1);
  }, [filteredDevices]);

  // Fetch historical rows for a given device + date from the backend,
  // merge with anything already in memory (e.g. today's live points),
  // and cache so we don't re-fetch the same day twice in one session.
  const fetchHistoryForDate = useCallback(async (serial, dateKey) => {
    try {
      const res = await fetch(
        `${BACKEND_URL}/api/telemetry-history?serial_no=${encodeURIComponent(
          serial
        )}&date=${dateKey}`
      );
      const rows = await res.json();

      if (!res.ok || !Array.isArray(rows)) {
        console.warn('Telemetry history fetch failed:', rows);
        return;
      }

      if (!deviceHistoryRef.current[serial]) {
        deviceHistoryRef.current[serial] = {};
      }
      const existing = deviceHistoryRef.current[serial][dateKey];
      const merged = mergeDbRowsWithExisting(existing, rows, dateKey);
      deviceHistoryRef.current[serial][dateKey] = merged;

      historyLoadedRef.current[`${serial}|${dateKey}`] = true;
      setHistoryVersion((v) => v + 1);
    } catch (error) {
      console.warn('Telemetry history fetch error:', error);
    }
  }, []);

  // Called by each graph when its selected date changes. Only fetches
  // once per (device, date) per session — today keeps growing live
  // via the socket effect above, so it never needs re-fetching.
  const requestHistory = useCallback(
    (serial, dateKey) => {
      const cacheKey = `${serial}|${dateKey}`;
      if (historyLoadedRef.current[cacheKey]) {
        return Promise.resolve();
      }
      return fetchHistoryForDate(serial, dateKey);
    },
    [fetchHistoryForDate]
  );

  // Real API Fetch Logic
  const fetchDashboardData = useCallback(async () => {
    try {
      setLoading(true);
      if (!firebaseUid) {
        setLoading(false);
        return;
      }

      const response = await fetch(`${BACKEND_URL}/api/dashboard`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ firebase_uid: firebaseUid }),
      });

      const data = await response.json();
      if (response.ok && Array.isArray(data) && data.length > 0) {
        setDevices(data);
      } else {
        console.warn('API returned empty or error:', data);
      }
    } catch (error) {
      console.warn('Network error:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [firebaseUid]);

  // Real-time WebSocket & Initial Fetch Setup with Deep Debugging
  useEffect(() => {
    fetchDashboardData();

    // Explicitly configure socket with polling fallback
    const socket = io(BACKEND_URL, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    socket.on('connect', () => {
      console.log('🟢 Socket Connected Successfully, ID:', socket.id);
    });

    socket.on('connect_error', (error) => {
      console.log('🔴 Socket Connection Error:', error);
    });

    // 🔍 COMPREHENSIVE SOCKET LISTENER WITH DEBUGGING
    socket.on('live_telemetry', (liveData) => {
      console.log('🔥 [FRONTEND] Live Telemetry Received:', JSON.stringify(liveData));

      setDevices((prevDevices) => {
        console.log('📱 [FRONTEND] Current Devices in State:', prevDevices.map(d => d.serial_no));

        const updatedDevices = prevDevices.map((device) => {
          // Normalize both strings to prevent subtle casing or space mismatches
          const matchSerial = device.serial_no?.trim().toUpperCase();
          const incomingSerial = liveData.serial_no?.trim().toUpperCase();

          if (matchSerial === incomingSerial) {
            console.log(`✅ [MATCH FOUND] Updating device: ${device.serial_no}`);

            const updatedPanels = device.panels.map((existingPanel) => {
              const livePanel = liveData.panels.find(
                (p) => Number(p.panel_no) === Number(existingPanel.panel_no)
              );

              if (livePanel) {
                return {
                  ...existingPanel,
                  temperatures: livePanel.temperatures,
                  custom_name: livePanel.custom_name || existingPanel.custom_name,
                };
              }
              return existingPanel;
            });

            return {
              ...device,
              status: liveData.status,
              panels: updatedPanels,
            };
          }
          return device;
        });

        return updatedDevices;
      });
    });

    return () => {
      console.log('🔌 Disconnecting socket...');
      socket.disconnect();
    };
  }, [fetchDashboardData]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchDashboardData();
    setRefreshing(false);
  }, [fetchDashboardData]);

  const handleEditPanel = useCallback((serialNo, panelNo) => {
    console.log(`Edit requested: device=${serialNo} panel=${panelNo}`);
  }, []);

  const handleMenuSelect = useCallback((option) => {
    console.log(`Header menu option selected: ${option}`);
  }, []);

  const handleBackPress = useCallback(() => {
    if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      navigation.navigate('Main');
    }
  }, [navigation]);

  const handleCardLayout = useCallback((serialNo, height) => {
    deviceHeightsRef.current[serialNo] = height;
  }, []);

  const handleGraphLayout = useCallback((serialNo, y) => {
    deviceGraphOffsetsRef.current[serialNo] = y;
  }, []);

  const handleChartPress = useCallback(
    (serialNo) => {
      const index = filteredDevices.findIndex((d) => d.serial_no === serialNo);
      if (index === -1 || !flatListRef.current) {
        return;
      }

      const listPaddingTop = styles.listContent.padding;
      const cardSpacing = styles.deviceCard.marginBottom;

      let cumulativeHeight = listPaddingTop;
      for (let i = 0; i < index; i += 1) {
        const previousSerial = filteredDevices[i].serial_no;
        const measuredHeight = deviceHeightsRef.current[previousSerial];

        if (measuredHeight == null) {
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
    [filteredDevices]
  );

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
        historyRef={deviceHistoryRef}
        historyVersion={historyVersion}
        onRequestHistory={requestHistory}
      />
    ),
    [
      handleEditPanel,
      handleChartPress,
      handleCardLayout,
      handleGraphLayout,
      historyVersion,
      requestHistory,
    ]
  );

  const keyExtractor = useCallback((item) => item.serial_no, []);

  if (loading && devices.length === 0) {
    return (
      <View style={styles.loaderWrap}>
        <ActivityIndicator size="large" color={COLORS.B} />
      </View>
    );
  }

  const deviceNotFound =
    !loading && !!selectedProduct?.serial_no && filteredDevices.length === 0;

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.headerIconButton}
          onPress={handleBackPress}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Icon name="arrow-back" size={22} color={COLORS.headerText} />
        </TouchableOpacity>

        <View style={styles.headerTitleWrap}>
          <Text style={styles.headerTitle}>WTS Dashboard</Text>
        </View>

        <HeaderMenu onSelect={handleMenuSelect} />
      </View>

      {deviceNotFound ? (
        <View style={styles.loaderWrap}>
          <Icon name="error-outline" size={34} color={COLORS.subText} />
          <Text style={styles.emptyPanelText}>Device Not Found</Text>
        </View>
      ) : (
        <FlatList
          ref={flatListRef}
          data={filteredDevices}
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
      )}
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

const CALENDAR_CELL_SIZE = 36;

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
  listContent: {
    padding: 16,
    paddingBottom: 32,
  },
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
    marginBottom: 10,
  },
  graphTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.headerText,
  },

  // Date field (opens calendar modal)
  dateFieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  dateFieldBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: COLORS.card,
  },
  dateFieldText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.headerText,
    marginHorizontal: 6,
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 8,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 8,
    backgroundColor: '#ECFDF5',
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.live,
    marginRight: 4,
  },
  liveBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.live,
  },

  // Calendar modal
  calendarCard: {
    backgroundColor: COLORS.card,
    borderRadius: 14,
    padding: 16,
    width: CALENDAR_CELL_SIZE * 7 + 32,
    ...cardShadow,
  },
  calendarHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  calendarNavBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  calendarNavBtnDisabled: {
    opacity: 0.4,
  },
  calendarMonthText: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.headerText,
  },
  calendarWeekdayRow: {
    flexDirection: 'row',
  },
  calendarWeekdayCell: {
    width: CALENDAR_CELL_SIZE,
    alignItems: 'center',
    paddingBottom: 6,
  },
  calendarWeekdayText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.subText,
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  calendarDayCell: {
    width: CALENDAR_CELL_SIZE,
    height: CALENDAR_CELL_SIZE,
    justifyContent: 'center',
    alignItems: 'center',
  },
  calendarDayInner: {
    width: CALENDAR_CELL_SIZE - 6,
    height: CALENDAR_CELL_SIZE - 6,
    borderRadius: (CALENDAR_CELL_SIZE - 6) / 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  calendarDaySelected: {
    backgroundColor: COLORS.B,
  },
  calendarDayToday: {
    borderWidth: 1,
    borderColor: COLORS.B,
  },
  calendarDayText: {
    fontSize: 13,
    color: COLORS.headerText,
  },
  calendarDayTextDisabled: {
    color: COLORS.disabledDay,
  },
  calendarDayTextSelected: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  calendarTodayLink: {
    marginTop: 10,
    alignItems: 'center',
    paddingVertical: 6,
  },
  calendarTodayLinkText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.B,
  },

  chartTouchArea: {
    width: CHART_WIDTH,
    height: CHART_HEIGHT,
  },
  chartEmptyOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  chartHintRow: {
    marginTop: 4,
  },
  chartHintText: {
    fontSize: 10,
    color: COLORS.subText,
    fontStyle: 'italic',
  },
  legendRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 8,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 12,
    marginBottom: 4,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 4,
  },
  legendText: {
    fontSize: 11,
    color: COLORS.headerText,
    fontWeight: '600',
  },
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