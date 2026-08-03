/**
 * AppNavigator.js — React Navigation structure for the BA mobile app.
 *
 * Structure:
 *  - Root Stack  : Auth screens (Login, Register) + Main (when authenticated or guest)
 *  - Main Bottom Tabs: Home | Book | Manage | More
 *  - Book Stack  : FlightSearch → FlightResults → BookingFlow → Confirmation
 *  - More Stack  : FlightStatus | Destinations | ExecutiveClub | Settings
 *  - Voice Agent : Modal overlay on top of everything
 */
import React from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
// NavigationContainer lives here — App.js does NOT wrap one
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';

import { useApp } from '../context/AppContext';
import Colors from '../theme/colors';

// ── Screens ──────────────────────────────────────────────────────
import HomeScreen          from '../screens/HomeScreen';
import LoginScreen         from '../screens/LoginScreen';
import RegisterScreen      from '../screens/RegisterScreen';
import FlightSearchScreen  from '../screens/FlightSearchScreen';
import FlightResultsScreen from '../screens/FlightResultsScreen';
import BookingFlowScreen   from '../screens/BookingFlowScreen';
import BookingConfirmScreen from '../screens/BookingConfirmScreen';
import ManageBookingScreen from '../screens/ManageBookingScreen';
import CheckInScreen       from '../screens/CheckInScreen';
import FlightStatusScreen  from '../screens/FlightStatusScreen';
import DestinationsScreen  from '../screens/DestinationsScreen';
import ExecutiveClubScreen from '../screens/ExecutiveClubScreen';
import MoreScreen          from '../screens/MoreScreen';
import VoiceAgentScreen    from '../screens/VoiceAgentScreen';

const RootStack = createNativeStackNavigator();
const Tab       = createBottomTabNavigator();
const BookStack = createNativeStackNavigator();
const MoreStack = createNativeStackNavigator();
const ManageStack = createNativeStackNavigator();

// ── Book tab stack ───────────────────────────────────────────────
function BookNavigator() {
  return (
    <BookStack.Navigator screenOptions={{ headerShown: false }}>
      <BookStack.Screen name="FlightSearch"  component={FlightSearchScreen} />
      <BookStack.Screen name="FlightResults" component={FlightResultsScreen} />
      <BookStack.Screen name="BookingFlow"   component={BookingFlowScreen} />
      <BookStack.Screen name="BookingConfirm" component={BookingConfirmScreen} />
    </BookStack.Navigator>
  );
}

// ── Manage tab stack ─────────────────────────────────────────────
function ManageNavigator() {
  return (
    <ManageStack.Navigator screenOptions={{ headerShown: false }}>
      <ManageStack.Screen name="ManageBooking" component={ManageBookingScreen} />
      <ManageStack.Screen name="CheckIn"       component={CheckInScreen} />
    </ManageStack.Navigator>
  );
}

// ── More tab stack ───────────────────────────────────────────────
function MoreNavigator() {
  return (
    <MoreStack.Navigator screenOptions={{ headerShown: false }}>
      <MoreStack.Screen name="More"           component={MoreScreen} />
      <MoreStack.Screen name="FlightStatus"   component={FlightStatusScreen} />
      <MoreStack.Screen name="Destinations"   component={DestinationsScreen} />
      <MoreStack.Screen name="ExecutiveClub"  component={ExecutiveClubScreen} />
    </MoreStack.Navigator>
  );
}

// ── Bottom Tab Navigator ─────────────────────────────────────────
function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: styles.tabBar,
        tabBarActiveTintColor:   Colors.darkBlue,
        tabBarInactiveTintColor: Colors.midGrey,
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600', marginBottom: 2 },
        tabBarIcon: ({ focused, color, size }) => {
          const icons = {
            Home:   focused ? 'home'        : 'home-outline',
            Book:   focused ? 'airplane'    : 'airplane-outline',
            Manage: focused ? 'document-text' : 'document-text-outline',
            More:   focused ? 'grid'        : 'grid-outline',
          };
          return <Ionicons name={icons[route.name] || 'ellipse'} size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen name="Home"   component={HomeScreen}      />
      <Tab.Screen name="Book"   component={BookNavigator}   />
      <Tab.Screen name="Manage" component={ManageNavigator} />
      <Tab.Screen name="More"   component={MoreNavigator}   />
    </Tab.Navigator>
  );
}

// ── Root Navigator ───────────────────────────────────────────────
export default function AppNavigator() {
  const { loading } = useApp();

  if (loading) {
    return (
      <View style={styles.splash}>
        <ActivityIndicator size="large" color={Colors.white} />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <RootStack.Navigator screenOptions={{ headerShown: false }}>
        {/* Voice Agent — always-available modal */}
        <RootStack.Group screenOptions={{ presentation: 'fullScreenModal', animation: 'slide_from_bottom' }}>
          <RootStack.Screen name="VoiceAgent" component={VoiceAgentScreen} />
        </RootStack.Group>

        {/* Auth screens */}
        <RootStack.Screen name="Login"    component={LoginScreen} />
        <RootStack.Screen name="Register" component={RegisterScreen} />

        {/* Main app */}
        <RootStack.Screen name="Main" component={MainTabs} />
      </RootStack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  splash: {
    flex: 1,
    backgroundColor: Colors.darkBlue,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabBar: {
    backgroundColor: Colors.tabBarBg,
    borderTopColor: Colors.lightGrey,
    borderTopWidth: 1,
    height: 60,
    paddingBottom: 6,
    paddingTop: 4,
  },
});
