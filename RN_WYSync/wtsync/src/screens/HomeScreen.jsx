import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  FlatList,
  Animated
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import Feather from 'react-native-vector-icons/Feather';

import { getUserDetails } from '../services/AuthService';

import { getProducts } from '../services/ProductApi';

const HomeScreen = ({ navigation }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const [products, setProducts] = useState([])
  const intervalRef = useRef(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // --- Header animation values (header only) ---
  const headerFade = useRef(new Animated.Value(0)).current;
  const headerSlide = useRef(new Animated.Value(10)).current;
  const accentLineWidth = useRef(new Animated.Value(0)).current;
  const accentOpacity = useRef(new Animated.Value(0.4)).current;
  const brandScale = useRef(new Animated.Value(0.98)).current;
  const greetingFade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.4,
          duration: 700,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 700,
          useNativeDriver: true
        }),
      ])
    ).start();
  }, []);

  // --- Header entrance animation (runs once on mount) ---
  useEffect(() => {
    Animated.parallel([
      Animated.timing(headerFade, {
        toValue: 1,
        duration: 550,
        useNativeDriver: true,
      }),
      Animated.timing(headerSlide, {
        toValue: 0,
        duration: 550,
        useNativeDriver: true,
      }),
      Animated.timing(greetingFade, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }),
      Animated.timing(brandScale, {
        toValue: 1,
        duration: 500,
        delay: 90,
        useNativeDriver: true,
      }),
      Animated.timing(accentLineWidth, {
        toValue: 80,
        duration: 700,
        delay: 200,
        useNativeDriver: false, // width cannot use native driver
      }),
    ]).start();

    // Very soft, slow, infinite opacity pulse on the underline only
    Animated.loop(
      Animated.sequence([
        Animated.timing(accentOpacity, {
          toValue: 1,
          duration: 2400,
          useNativeDriver: true,
        }),
        Animated.timing(accentOpacity, {
          toValue: 0.4,
          duration: 2400,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);


  useFocusEffect(
    useCallback(() => {
      loadHomeData();

      intervalRef.current = setInterval(() => {
        loadHomeData();
      }, 5000);//every 5 sec

      return () => {
        clearInterval(intervalRef.current);
      }

    }, [])
  );





  const loadHomeData = async () => {
    try {

      setLoading(true);
      const userResult = await getUserDetails();

      //User Details
      if (userResult.success) {
        setUser(userResult.user);
      }

      //products
      const productResult = await getProducts();
      if (productResult.success) {
        setProducts(productResult.products);
      }

    } catch (e) {
      console.log("Home Screen Error", e);
    } finally {
      setLoading(false);
    }

  }

  const firstName = user?.name ? user.name.split(' ')[0] : '';
  const initial = firstName ? firstName.charAt(0).toUpperCase() : '?';

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <StatusBar barStyle="dark-content" backgroundColor="#FAFAFB" />

      <View style={styles.container}>
        {/* Header */}
        <Animated.View
          style={[
            styles.header,
            {
              opacity: headerFade,
              transform: [{ translateY: headerSlide }],
            },
          ]}
        >
          <Animated.Text style={[styles.greeting, { opacity: greetingFade }]}>
            {loading ? 'WELCOME' : `HELLO, ${firstName.toUpperCase()}`}
          </Animated.Text>

          <Animated.Text
            style={[styles.brand, { transform: [{ scale: brandScale }] }]}
          >
            WireTempSync
          </Animated.Text>

          <Animated.View
            style={[
              styles.accentLine,
              { width: accentLineWidth, opacity: accentOpacity },
            ]}
          />
        </Animated.View>

        {products.length === 0 ? (
          <>

            <View style={styles.card}>
              <View style={styles.iconWrap}>
                <Feather name="package" size={30} color="#4F46E5" />
              </View>

              <Text style={styles.title}>No Product Registered</Text>

              <Text style={styles.subtitle}>
                Register your first device to activate its warranty and start
                syncing temperature data.
              </Text>

              <View style={styles.statusPill}>
                <View style={[styles.statusDot, { backgroundColor: '#EF4444' }]} />
                <Text style={styles.statusText}>Warranty inactive</Text>
              </View>

              <TouchableOpacity
                style={styles.button}
                activeOpacity={0.85}
                onPress={() => navigation.navigate('Register')}>
                <Feather name="plus" size={16} color="#fff" />
                <Text style={styles.buttonText}>Register Product</Text>
              </TouchableOpacity>
            </View>



          </>
        ) : (
          <>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>My Products</Text>
              <View style={styles.countBadge}>
                <Text style={styles.countBadgeText}>{products.length}</Text>
              </View>
            </View>

            <FlatList

              data={products}
              keyExtractor={(item) => item.id.toString()}
              showVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 120 }}
              renderItem={({ item }) => (
                <TouchableOpacity style={styles.productCard}
                  activeOpacity={0.9}
                  onPress={() => {
                    if (item.online) {
                      navigation.navigate("WtsDashboard", {
                        product: item,
                      });
                    } else {
                      navigation.navigate("DeviceConfig", {
                        product: item,
                        firebase_uid:user.firebase_uid
                      });
                    }
                  }}
                >

                  <View style={styles.productHeader}>
                    <Text style={styles.productName} numberOfLines={1}>
                      {item.device_name}
                    </Text>

                    <View



                      style={[
                        styles.statusBadge,
                        {
                          backgroundColor: item.online
                            ? "#EDFBF3"
                            : "#FDF0F0"
                        }
                      ]}>


                      <Animated.View
                        style={[
                          styles.statusDot,
                          {
                            backgroundColor: item.online
                              ? "#22C55E"
                              : "#EF4444",
                            transform: [{ scale: pulseAnim }],
                            opacity: pulseAnim,
                          }
                        ]}
                      />


                      <Text
                        style={[
                          styles.statusBadgeText,
                          {
                            color: item.online
                              ? "#15803D"
                              : "#B91C1C"
                          }
                        ]}
                      >

                        {item.online ? "ONLINE" : "OFFLINE"}

                      </Text>



                    </View>

                  </View>

                  <Text style={styles.model}>
                    {item.model_no}
                  </Text>

                  <View style={styles.divider} />

                  <View style={styles.metaRow}>
                    <View>
                      <Text style={styles.metaLabel}>Serial Number</Text>
                      <Text style={styles.metaValue}>{item.serial_no}</Text>
                    </View>
                    <View style={styles.metaRight}>
                      <Text style={styles.metaLabel}>Warranty</Text>
                      <Text style={styles.metaValue}>{item.warranty_expiry}</Text>
                    </View>
                  </View>


                </TouchableOpacity>
              )}
            />


            <TouchableOpacity
              style={styles.button}
              onPress={() => navigation.navigate("Register")}>
              <Feather name="plus" size={16} color="#fff" />
              <Text style={styles.buttonText}>
                Register Another Product
              </Text>

            </TouchableOpacity>

          </>

        )

        }

        {/* Small footer hint */}
        <Text style={styles.footerHint}>
          Have a QR code? Head to the Register tab to scan it.
        </Text>
      </View>
    </SafeAreaView>
  );
};

export default HomeScreen;

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#FAFAFB',
  },
  container: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 8,
    justifyContent: 'center',
  },

  header: {
    paddingTop: 12,
    marginBottom: 36,
  },

  greeting: {
    fontSize: 12,
    fontWeight: '600',
    color: '#9CA3AF',
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  brand: {
    fontSize: 29,
    fontWeight: '700',
    color: '#0B0D12',
    letterSpacing: -0.4,
  },
  accentLine: {
    height: 2,
    borderRadius: 1,
    backgroundColor: '#4F46E5',
    marginTop: 14,
  },

  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
    paddingHorizontal: 2,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#0B0D12',
    letterSpacing: -0.2,
  },
  countBadge: {
    backgroundColor: '#F0F1F4',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  countBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#5B5F6B',
  },

  // Empty state card
  card: {
    backgroundColor: '#fff',
    paddingVertical: 36,
    paddingHorizontal: 24,
    borderRadius: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#F0F1F4',
    shadowColor: '#0B0D12',
    shadowOpacity: 0.05,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 2,
  },
  iconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#F4F4FE',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 22,
  },
  title: {
    fontSize: 19,
    fontWeight: '700',
    color: '#0B0D12',
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
    marginTop: 10,
    color: '#8A8F98',
    maxWidth: 260,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FDF0F0',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    marginTop: 20,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#B91C1C',
  },

  // Product cards
  productCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 20,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#F0F1F4',
    shadowColor: '#0B0D12',
    shadowOpacity: 0.04,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 1,
  },
  productHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  productName: {
    fontSize: 17,
    fontWeight: '600',
    color: '#0B0D12',
    flex: 1,
    marginRight: 10,
  },
  model: {
    marginTop: 6,
    color: '#8A8F98',
    fontSize: 13,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#EEEFF2',
    marginVertical: 14,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  metaRight: {
    alignItems: 'flex-end',
  },
  metaLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#9CA3AF',
    letterSpacing: 0.3,
    marginBottom: 3,
    textTransform: 'uppercase',
  },
  metaValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2A2D34',
  },

  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },

  button: {
    backgroundColor: '#0B0D12',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 16,
    marginTop: 8,
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: '#0B0D12',
    shadowOpacity: 0.16,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3,
  },
  buttonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 15,
  },

  footerHint: {
    textAlign: 'center',
    color: '#C7C9D1',
    fontSize: 12,
    fontWeight: '500',
    marginTop: 20,
  },
});