import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import Icon from '@expo/vector-icons/MaterialCommunityIcons';

import DashboardScreen from '../screens/DashboardScreen';
import NutritionScreen from '../screens/NutritionScreen';
import AddMealScreen from '../screens/AddMealScreen';
import GrowthScreen from '../screens/GrowthScreen';
import RecommendationsScreen from '../screens/RecommendationsScreen';
import ProfileScreen from '../screens/ProfileScreen';
import AddChildScreen from '../screens/AddChildScreen';
import ScannerScreen from '../screens/ScannerScreen';
import VoiceAssistantScreen from '../screens/VoiceAssistantScreen';

import WaterTrackerScreen from '../screens/WaterTrackerScreen';

const Tab = createBottomTabNavigator();
const ProfileStack = createStackNavigator();
const NutritionStack = createStackNavigator();

function ProfileStackNavigator() {
  return (
    <ProfileStack.Navigator screenOptions={{ headerShown: false }}>
      <ProfileStack.Screen name="ProfileMain" component={ProfileScreen} />
      <ProfileStack.Screen name="AddChild" component={AddChildScreen} options={{ headerShown: true, title: 'Add Child', headerBackTitle: 'Back' }} />
    </ProfileStack.Navigator>
  );
}

function NutritionStackNavigator() {
  return (
    <NutritionStack.Navigator screenOptions={{ headerShown: false }}>
      <NutritionStack.Screen name="NutritionMain" component={NutritionScreen} />
      <NutritionStack.Screen name="AddMeal" component={AddMealScreen} options={{ headerShown: true, title: 'Add Food', headerBackTitle: 'Back' }} />
      <NutritionStack.Screen name="ScannerScreen" component={ScannerScreen} options={{ headerShown: true, title: 'Scan Barcode', headerBackTitle: 'Back' }} />
    </NutritionStack.Navigator>
  );
}

export default function MainNavigator() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ color, size }) => {
          let iconName;

          if (route.name === 'Home') iconName = 'home';
          else if (route.name === 'Voice AI') iconName = 'microphone-message';
          else if (route.name === 'Water Tracker') iconName = 'water-percent';
          else if (route.name === 'Nutrition') iconName = 'food-apple';
          else if (route.name === 'Growth') iconName = 'chart-line';
          else if (route.name === 'Recommendations') iconName = 'lightbulb-on';
          else if (route.name === 'Profile') iconName = 'account';

          return <Icon name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: '#2E7D32',
        tabBarInactiveTintColor: 'gray',
        headerShown: true,
        headerTintColor: '#fff',
        headerStyle: { backgroundColor: '#2E7D32' },
      })}
    >
      <Tab.Screen name="Home" component={DashboardScreen} />
      <Tab.Screen name="Voice AI" component={VoiceAssistantScreen} options={{ title: 'NutriVoice AI' }} />
      <Tab.Screen name="Water Tracker" component={WaterTrackerScreen} options={{ title: 'Water & Reminders' }} />
      <Tab.Screen name="Nutrition" component={NutritionStackNavigator} />
      <Tab.Screen name="Growth" component={GrowthScreen} />
      <Tab.Screen name="Recommendations" component={RecommendationsScreen} />
      <Tab.Screen name="Profile" component={ProfileStackNavigator} />
    </Tab.Navigator>
  );
}
