import {Alert, Linking} from 'react-native';
import WifiManager from 'react-native-wifi-reborn';

import IP_ADDRESS from '../services/ipconfig'

const BASE_URL = `http://${IP_ADDRESS}:5006`;


export const verifyDeviceWifi = async (deviceId) => {
   console.log(`${BASE_URL}/get-device-wifi/${deviceId}`);
  try {

    // Fetch WiFi from backend
    const response = await fetch(
      `${BASE_URL}/get-device-wifi/${deviceId}`
    );

    const result = await response.json();

    if (!response.ok || !result.success) {
      Alert.alert(
        'Error',
        result.message || 'Unable to fetch saved WiFi.'
      );
      return false;
    }

    // Current connected WiFi
    let currentSSID = await WifiManager.getCurrentWifiSSID();

    // Remove quotes if Android returns them
    currentSSID = currentSSID.replace(/"/g, '');

    console.log("Current WiFi :", currentSSID);
    console.log("Database WiFi :", result.ssid);

    if (currentSSID !== result.ssid) {

      Alert.alert(
        "Wrong WiFi",
        `Please connect to "${result.ssid}" before continuing.`,
        [
          {
            text: "Cancel",
            style: "cancel"
          },
          {
            text: "Open Settings",
            onPress: () => Linking.openSettings()
          }
        ]
      );

      return false;
    }

    return true;

  } catch (error) {

    console.log(error);

    Alert.alert(
      "Error",
      "Unable to verify WiFi connection."
    );

    return false;
  }
};