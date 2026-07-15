import { StyleSheet, Text, View } from 'react-native'
import React from 'react'
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import  SplashScreen from '../screens/SplashScreen';
import LoginScreen from '../screens/LoginScreen';
import RegisterScreen from '../screens/RegisterScreen';
import HomeScreen from '../screens/HomeScreen';
import BottomNavigator from '../services/BottomTabNavigator';
import ForgotPassword from '../screens/ForgotPasswordScreen';
import EditProfile from '../screens/EditProfile';
import DeviceConfig from '../screens/DeviceConfig'
import HomeWifiListScreen from '../screens/HomeWifiListScreen';
import PasswordScreen from '../screens/PasswordScreen';
import ResetWifiNetwork from '../screens/ResetWifiNetwork';
import WtsDashboard from '../screens/WtsDashboard';

const Stack = createNativeStackNavigator();

const AppNavigator = () => {
  return (
     <Stack.Navigator
     initialRouteName='Splash'
     screenOptions={
               {headerShown: false,
               }}>

                <Stack.Screen name="Splash" component={SplashScreen}/>
                <Stack.Screen name="Login" component={LoginScreen}/>

                <Stack.Screen name="Register" component={RegisterScreen}/>
                <Stack.Screen name="Main" component={BottomNavigator}/>
                <Stack.Screen name="Home" component={HomeScreen}/>
                <Stack.Screen name="Forgotpassword" component={ForgotPassword}/>
                <Stack.Screen name="EditProfile" component={EditProfile}/>
                <Stack.Screen name="DeviceConfig" component={DeviceConfig}/>
                <Stack.Screen name = "HomeWifiListScreen" component={HomeWifiListScreen}/>
                <Stack.Screen name="Password" component={PasswordScreen}/>
                <Stack.Screen name="ResetwifiNetwork" component={ResetWifiNetwork}/>
                <Stack.Screen name="WtsDashboard" component={WtsDashboard}/>

     </Stack.Navigator>
  )
}

export default AppNavigator

const styles = StyleSheet.create({})