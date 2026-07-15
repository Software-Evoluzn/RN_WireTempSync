import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
} from 'react-native';

const WtsDashboard = ({ navigation }) => {
  const handleReset = () => {
    navigation.navigate('DeviceConfig', {
      action: 'reset',
    });
  };

  const handleChange = () => {
    navigation.navigate('DeviceConfig', {
      action: 'change',
    });
  };

  return (
    <SafeAreaView style={styles.container}>

      <Text style={styles.heading}>
        WiFi Dashboard
      </Text>

      <View style={styles.row}>

        {/* RESET WIFI */}

        <TouchableOpacity
          activeOpacity={0.8}
          style={styles.item}
          onPress={handleReset}
        >
          <View style={styles.circle}>
            <Text style={styles.icon}>🔄</Text>
          </View>

          <Text style={styles.title}>
            Reset WiFi
          </Text>

          <Text style={styles.subtitle}>
            Reset ESP32
          </Text>
        </TouchableOpacity>

        {/* CHANGE WIFI */}

        <TouchableOpacity
          activeOpacity={0.8}
          style={styles.item}
          onPress={handleChange}
        >
          <View style={styles.circle}>
            <Text style={styles.icon}>📶</Text>
          </View>

          <Text style={styles.title}>
            Change WiFi
          </Text>

          <Text style={styles.subtitle}>
            Configure WiFi
          </Text>
        </TouchableOpacity>

      </View>

    </SafeAreaView>
  );
};

export default WtsDashboard;

const styles = StyleSheet.create({

  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 20,
    paddingTop: 25,
  },

  heading: {
    fontSize: 28,
    fontWeight: '700',
    color: '#222',
    marginBottom: 30,
  },

  row: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },

  item: {
    alignItems: 'center',
    width: '42%',
  },

  circle: {
    width: 110,
    height: 110,
    borderRadius: 55,

    backgroundColor: '#6D28D9',

    justifyContent: 'center',
    alignItems: 'center',

    elevation: 6,

    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: {
      width: 0,
      height: 4,
    },
  },

  icon: {
    fontSize: 42,
  },

  title: {
    marginTop: 18,
    fontSize: 20,
    fontWeight: '700',
    color: '#222',
    textAlign: 'center',
  },

  subtitle: {
    marginTop: 6,
    fontSize: 14,
    color: '#777',
    textAlign: 'center',
    lineHeight: 20,
  },

});