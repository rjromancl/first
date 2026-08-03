/**
 * App.js — Root entry point for the British Airways mobile app (Expo).
 *
 * AppNavigator already wraps NavigationContainer internally,
 * so we just provide GestureHandlerRootView + SafeAreaProvider + AppProvider here.
 */
import 'react-native-gesture-handler';
import React from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { AppProvider } from './src/context/AppContext';
import AppNavigator from './src/navigation/AppNavigator';
import NotificationToast from './src/components/NotificationToast';

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AppProvider>
          <StatusBar style="light" />
          <AppNavigator />
          <NotificationToast />
        </AppProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
