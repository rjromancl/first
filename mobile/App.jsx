/**
 * British Airways Mobile — root entry point.
 *
 * Wires together:
 *  - AppProvider  (global state: auth, bookings, notifications)
 *  - NavigationContainer (React Navigation)
 *  - AppNavigator (bottom tabs + stack)
 *  - NotificationToast (global animated toasts)
 *  - StatusBar
 */

import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AppProvider } from './src/context/AppContext';
import AppNavigator from './src/navigation/AppNavigator';
import NotificationToast from './src/components/NotificationToast';
import { colors } from './src/theme';

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AppProvider>
          <NavigationContainer>
            <StatusBar style="light" backgroundColor={colors.darkBlue} />
            <AppNavigator />
            <NotificationToast />
          </NavigationContainer>
        </AppProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
