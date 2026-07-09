import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import Ionicons from 'react-native-vector-icons/Ionicons';
import HomeScreen from '../screens/HomeScreen'
import ProductRegistrationScreen from '../screens/ProductRegistrationScreen';
import SettingsScreen from '../screens/SettingsScreen';
const Tab = createBottomTabNavigator();

export default function BottomNavigator() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: '#4F46E5',
        tabBarInactiveTintColor: '#9CA3AF',
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '600',
          marginBottom: 6,
        },
        tabBarStyle: {
          height: 68,
          paddingTop: 8,
          borderTopWidth: 1,
          borderTopColor: '#EEF0F4',
          backgroundColor: '#fff',
        },
        tabBarIcon: ({ color, size, focused }) => {
          let icon = 'ellipse-outline';
          if (route.name === 'Home') icon = focused ? 'home' : 'home-outline';
          if (route.name === 'Register') icon = focused ? 'qr-code' : 'qr-code-outline';
          if (route.name === 'Settings') icon = focused ? 'settings' : 'settings-outline';
          return <Ionicons name={icon} size={size} color={color} />;
        },
      })}>
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Register" component={ProductRegistrationScreen} />
      <Tab.Screen name="Settings" component={SettingsScreen} />
    </Tab.Navigator>
  );
}