import React from 'react';
import { StyleSheet } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import Feather from 'react-native-vector-icons/Feather';
import HomeScreen from '../screens/HomeScreen'
import ProductRegistrationScreen from '../screens/ProductRegistrationScreen';
import SettingsScreen from '../screens/SettingsScreen';
const Tab = createBottomTabNavigator();

export default function BottomNavigator() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: '#0B0D12',
        tabBarInactiveTintColor: '#B4B7C0',
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
          letterSpacing: 0.2,
          marginTop: 2,
          marginBottom: 10,
        },
        tabBarItemStyle: {
          paddingTop: 6,
        },
        tabBarStyle: {
          height: 72,
          paddingTop: 10,
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: '#F0F1F4',
          backgroundColor: '#fff',
          shadowColor: '#0B0D12',
          shadowOffset: { width: 0, height: -4 },
          shadowOpacity: 0.03,
          shadowRadius: 12,
          elevation: 8,
        },
        tabBarIcon: ({ color, focused }) => {
          let icon = 'circle';
          if (route.name === 'Home') icon = 'home';
          if (route.name === 'Register') icon = 'camera';
          if (route.name === 'Settings') icon = 'settings';
          return (
            <Feather
              name={icon}
              size={focused ? 22 : 20}
              color={color}
              strokeWidth={focused ? 2.4 : 2}
            />
          );
        },
      })}>
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Register" component={ProductRegistrationScreen} />
      <Tab.Screen name="Settings" component={SettingsScreen} />
    </Tab.Navigator>
  );
}