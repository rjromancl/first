/**
 * Navigation structure:
 *
 *  RootStack
 *  └── MainTabs (bottom tab bar)
 *       ├── Home        → HomeScreen
 *       ├── Book        → BookFlightScreen
 *       ├── My Trips    → ManageBookingScreen
 *       ├── More        → MoreScreen (drawer into sub-screens)
 *       └── Account     → LoginScreen / ExecutiveClubScreen
 *
 *  Modal / full-screen stacks pushed on top of tabs:
 *   - CheckIn
 *   - FlightStatus
 *   - Destinations
 */

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';

import { colors } from '../theme';
import { useApp } from '../context/AppContext';

import HomeScreen          from '../screens/HomeScreen';
import BookFlightScreen    from '../screens/BookFlightScreen';
import CheckInScreen       from '../screens/CheckInScreen';
import FlightStatusScreen  from '../screens/FlightStatusScreen';
import ManageBookingScreen from '../screens/ManageBookingScreen';
import DestinationsScreen  from '../screens/DestinationsScreen';
import ExecutiveClubScreen from '../screens/ExecutiveClubScreen';
import LoginScreen         from '../screens/LoginScreen';
import MoreScreen          from '../screens/MoreScreen';

const Tab   = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

// ── Header logo component ─────────────────────────────────────────
function BAHeaderTitle() {
  return (
    <View style={styles.headerTitle}>
      <Ionicons name="airplane" size={18} color={colors.white} />
      <Text style={styles.headerTitleText}>British Airways</Text>
    </View>
  );
}

// ── Shared header options ─────────────────────────────────────────
const sharedHeaderOpts = {
  headerStyle: { backgroundColor: colors.darkBlue },
  headerTintColor: colors.white,
  headerTitleStyle: { fontWeight: '700', fontSize: 17 },
  headerBackTitleVisible: false,
};

// ── Bottom tab navigator ──────────────────────────────────────────
function MainTabs() {
  const { isAuthenticated } = useApp();

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          const icons = {
            Home:      focused ? 'home'            : 'home-outline',
            Book:      focused ? 'airplane'        : 'airplane-outline',
            'My Trips':focused ? 'briefcase'       : 'briefcase-outline',
            More:      focused ? 'grid'            : 'grid-outline',
            Account:   focused ? 'person-circle'   : 'person-circle-outline',
          };
          return <Ionicons name={icons[route.name] || 'ellipse-outline'} size={size} color={color} />;
        },
        tabBarActiveTintColor:   colors.blue,
        tabBarInactiveTintColor: colors.textLight,
        tabBarStyle: {
          backgroundColor: colors.white,
          borderTopColor: colors.border,
          paddingBottom: 4,
          height: 60,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
        headerShown: false,
      })}
    >
      <Tab.Screen name="Home"     component={HomeScreen} />
      <Tab.Screen name="Book"     component={BookFlightScreen} />
      <Tab.Screen name="My Trips" component={ManageBookingScreen} />
      <Tab.Screen name="More"     component={MoreScreen} />
      <Tab.Screen
        name="Account"
        component={isAuthenticated ? ExecutiveClubScreen : LoginScreen}
      />
    </Tab.Navigator>
  );
}

// ── Root stack (tabs + modal screens) ────────────────────────────
export default function AppNavigator() {
  return (
    <Stack.Navigator screenOptions={sharedHeaderOpts}>
      <Stack.Screen
        name="MainTabs"
        component={MainTabs}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="CheckIn"
        component={CheckInScreen}
        options={{ title: 'Online Check-in' }}
      />
      <Stack.Screen
        name="FlightStatus"
        component={FlightStatusScreen}
        options={{ title: 'Flight Status' }}
      />
      <Stack.Screen
        name="Destinations"
        component={DestinationsScreen}
        options={{ title: 'Explore Destinations' }}
      />
      <Stack.Screen
        name="Login"
        component={LoginScreen}
        options={{ title: 'Sign In' }}
      />
      <Stack.Screen
        name="ExecutiveClub"
        component={ExecutiveClubScreen}
        options={{ title: 'Executive Club' }}
      />
    </Stack.Navigator>
  );
}

const styles = StyleSheet.create({
  headerTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitleText: {
    color: colors.white,
    fontSize: 17,
    fontWeight: '700',
  },
});
