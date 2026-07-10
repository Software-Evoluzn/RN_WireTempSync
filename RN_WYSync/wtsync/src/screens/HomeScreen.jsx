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

import { getUserDetails } from '../services/AuthService';

import { getProducts } from '../services/ProductApi';

const HomeScreen = ({ navigation }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const [products, setProducts] = useState([])
  const intervalRef = useRef(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;

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
      <StatusBar barStyle="dark-content" backgroundColor="#F5F7FB" />

      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>
              {loading ? 'Welcome 👋' : `Hello, ${firstName} 👋`}
            </Text>
            <Text style={styles.brand}>WireTempSync</Text>
          </View>

          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{loading ? '' : initial}</Text>
          </View>
        </View>

        {/* Empty state card
        <View style={styles.card}>
          <View style={styles.iconWrap}>
            <Text style={styles.icon}>📦</Text>
          </View>

          <Text style={styles.title}>No Product Registered</Text>

          <Text style={styles.subtitle}>
            Register your first device to activate its warranty and start
            syncing temperature data.
          </Text>

          <View style={styles.statusPill}>
            <View style={styles.statusDot} />
            <Text style={styles.statusText}>Warranty inactive</Text>
          </View>

          <TouchableOpacity
            style={styles.button}
            activeOpacity={0.85}
            onPress={() => navigation.navigate('Register')}>
            <Text style={styles.buttonText}>+  Register Product</Text>
          </TouchableOpacity>
        </View> */}


        {products.length === 0 ? (
          <>

            <View style={styles.card}>
              <View style={styles.iconWrap}>
                <Text style={styles.icon}>📦</Text>
              </View>

              <Text style={styles.title}>No Product Registered</Text>

              <Text style={styles.subtitle}>
                Register your first device to activate its warranty and start
                syncing temperature data.
              </Text>

              <View style={styles.statusPill}>
                <View style={styles.statusDot} />
                <Text style={styles.statusText}>Warranty inactive</Text>
              </View>

              <TouchableOpacity
                style={styles.button}
                activeOpacity={0.85}
                onPress={() => navigation.navigate('Register')}>
                <Text style={styles.buttonText}>+  Register Product</Text>
              </TouchableOpacity>
            </View>



          </>
        ) : (
          <>
            <Text style={styles.sectionTitle}>
              My Products ({products.length})
            </Text>

            <FlatList

              data={products}
              keyExtractor={(item) => item.id.toString()}
              showVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 120 }}
              renderItem={({ item }) => (
                <TouchableOpacity style={styles.productCard} activeOpacity={0.9}>

                  <View style={styles.productHeader}>
                    <Text style={styles.productName}>
                      {item.device_name}
                    </Text>

                    <View
                   


                      style={[
                        styles.statusBadge,
                        {
                          backgroundColor: item.online
                            ? "#DCFCE7"
                            : "#FEE2E2"
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

                        {item.online ? "Online" : "Offline"}

                      </Text>



                    </View>

                  </View>

                  <Text style={styles.model}>
                    {item.model_no}
                  </Text>

                  <Text style={styles.serial}>
                    Serial No : {item.serial_no}
                  </Text>

                  <Text style={styles.expiry}>
                    Warranty Till : {item.warranty_expiry}
                  </Text>


                </TouchableOpacity>
              )}
            />


            <TouchableOpacity
              style={styles.button}
              onPress={() => navigation.navigate("Register")}>

              <Text style={styles.buttonText}>
                + Register Another Product
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
    backgroundColor: '#F5F7FB',
  },
  container: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 8,
    justifyContent: 'center',
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 32,
  },

  sectionTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 18,
  },

  productCard: {
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 18,
    marginBottom: 16,
    elevation: 5,

    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: {
      width: 0,
      height: 3,
    },
  },
  greeting: {
    fontSize: 15,
    fontWeight: '500',
    color: '#6B7280',
  },
  brand: {
    fontSize: 26,
    fontWeight: '800',
    color: '#111827',
    marginTop: 2,
    letterSpacing: -0.5,
  },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#4F46E5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },

  card: {
    backgroundColor: '#fff',
    paddingVertical: 36,
    paddingHorizontal: 26,
    borderRadius: 24,
    alignItems: 'center',
    // Android
    elevation: 6,
    // iOS
    shadowColor: '#4F46E5',
    shadowOpacity: 0.12,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
  },

  productHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  productName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    flex: 1,
  },


  model: {
    marginTop: 8,
    color: '#6B7280',
    fontSize: 14,
  },

  serial: {
    marginTop: 10,
    fontSize: 14,
    color: '#374151',
  },

  expiry: {
    marginTop: 10,
    fontSize: 13,
    color: '#4B5563',
  },

  activeBadge: {
    backgroundColor: '#E8F8EF',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },

  activeText: {
    color: '#16A34A',
    fontWeight: '700',
    fontSize: 12,
  },

  iconWrap: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#EEF0FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  icon: {
    fontSize: 48,
  },
  title: {
    fontSize: 21,
    fontWeight: '700',
    color: '#111827',
  },
  subtitle: {
    fontSize: 14.5,
    lineHeight: 21,
    textAlign: 'center',
    marginTop: 10,
    color: '#6B7280',
  },

  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3F2',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    marginTop: 20,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 8,
  },
  statusText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#B42318',
  },

  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },

  statusBadgeText: {
    fontSize: 12,
    fontWeight: "700",
  },

  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },

  button: {
    backgroundColor: '#4F46E5',
    paddingHorizontal: 32,
    paddingVertical: 15,
    borderRadius: 14,
    marginTop: 26,
    width: '100%',
    alignItems: 'center',
    shadowColor: '#4F46E5',
    shadowOpacity: 0.3,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  buttonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },

  footerHint: {
    textAlign: 'center',
    color: '#9CA3AF',
    fontSize: 13,
    marginTop: 24,
  },
});


