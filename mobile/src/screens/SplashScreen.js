import React, { useEffect } from 'react';
import { View, StyleSheet, Image, Text } from 'react-native';

export default function SplashScreen({ navigation }) {
  useEffect(() => {
    // Navigate to Onboarding after 2.5 seconds
    const timer = setTimeout(() => {
      navigation.replace('Onboarding');
    }, 2500);
    return () => clearTimeout(timer);
  }, [navigation]);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>NutriTrack AI</Text>
      <Text style={styles.subtitle}>Child Nutrition Monitoring</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#2E7D32',
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 40,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 18,
    color: '#E8F5E9',
  }
});
