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

     </Stack.Navigator>
  )
}

export default AppNavigator

const styles = StyleSheet.create({})