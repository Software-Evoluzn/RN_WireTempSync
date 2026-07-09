import React, { useEffect } from 'react';
import { View, Image, Text, ActivityIndicator, StyleSheet } from 'react-native';
import auth from '@react-native-firebase/auth';

const SplashScreen = ({ navigation }) => {
  useEffect(() => {
    console.log("Splash screen Mounted");
    let user = null;
    let authResolved = false;
    let timerDone = false;

    // Jab dono cheezein ready ho tab hi navigate karo
    const tryNavigate = () => {


      console.log("Ckecking Navigation.......");
      console.log("authResolved:", authResolved);
      console.log("timerDone:", timerDone);
      console.log("user:", user);


      if (authResolved && timerDone) {
        if (user) {
          console.log("✅ User Found -> Navigate to Home");
          navigation.replace('Main');
        } else {

          console.log("❌ No User -> Navigate to Login");
          navigation.replace('Login');
        }
      } else {
        console.log("⏳ Waiting for Auth or Timer...");
      }
    };

    // Minimum 2 second ka timer
    const timer = setTimeout(() => {
      console.log("⏰ 2 Seconds Completed");
      timerDone = true;
      tryNavigate();
    }, 2000);

    const unsubscribe = auth().onAuthStateChanged(currentUser => {

      console.log("🔥 Firebase Auth Response");
      console.log("Current User:", currentUser);

      user = currentUser;
      authResolved = true;
      tryNavigate();
    });

    return () => {

      console.log("🧹 SplashScreen Unmounted");

      clearTimeout(timer);
      unsubscribe();
    };
  }, [navigation]);

  return (
    <View style={styles.container}>
      <View style={styles.logoCircle}>
        <Image
          source={require('../assests/images/logo.png')}
          style={styles.logo}
          resizeMode="contain"
        />
      </View>

      <Text style={styles.appName}>Evoluzn</Text>
      <Text style={styles.tagline}>Welcome back</Text>

      <ActivityIndicator
        size="large"
        color="#6366F1"
        style={styles.loader}
      />
    </View>
  );
};

export default SplashScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0F172A',
  },
  logoCircle: {
    width: 96,
    height: 96,
    borderRadius: 28,
    backgroundColor: '#0f0f0f',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
    shadowColor: '#490735',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 12,
  },
  logoText: {
    fontSize: 44,
    fontWeight: '800',
    color: '#fff',
  },
  appName: {
    fontSize: 28,
    fontWeight: '700',
    color: '#F8FAFC',
    letterSpacing: 0.5,
  },
  tagline: {
    fontSize: 15,
    color: '#94A3B8',
    marginTop: 6,
  },
  loader: {
    marginTop: 48,
  },
});