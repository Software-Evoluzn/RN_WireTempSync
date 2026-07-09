import './src/config/googleSignIn'
import auth from '@react-native-firebase/auth';
import {  StyleSheet, Text, View } from 'react-native'
import React from 'react'
import { NavigationContainer } from '@react-navigation/native';
import AppNavigator from './src/navigation/AppNavigator'


const App = () => {
  return (
      <NavigationContainer>
      <AppNavigator />
    </NavigationContainer>
  )
}

export default App

const styles = StyleSheet.create({})