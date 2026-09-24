import React, { useState, useEffect, useContext } from 'react';
import { View, StyleSheet, Text, ScrollView, ActivityIndicator, TouchableOpacity } from 'react-native';
import { Card, Button, Avatar } from 'react-native-paper';
import { AuthContext } from '../context/AuthContext';
import { ChildContext } from '../context/ChildContext';
import apiClient from '../api/client';

export default function DashboardScreen({ navigation }) {
  const { authState } = useContext(AuthContext);
  const { activeChild, isLoading: childLoading } = useContext(ChildContext);
  
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(false);

  // Fetch dashboard summary when screen comes into focus
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      if (activeChild) fetchDashboardSummary();
    });
    
    if (activeChild) fetchDashboardSummary();
    
    return unsubscribe;
  }, [navigation, activeChild]);

  const fetchDashboardSummary = async () => {
    setLoading(true);
    try {
      const response = await apiClient.get(`/dashboard/${activeChild.child_id}`);
      setSummary(response.data);
    } catch (e) {
      console.log('Error fetching dashboard summary', e);
    } finally {
      setLoading(false);
    }
  };

  if (childLoading || (loading && !summary)) {
    return <View style={styles.center}><ActivityIndicator size="large" color="#2E7D32" /></View>;
  }

  if (!activeChild) {
    return (
      <View style={styles.center}>
        <Text style={styles.header}>Welcome to NutriTrack AI</Text>
        <Text style={styles.emptyText}>Please select or add a child from the Profile tab to begin tracking.</Text>
        <Button mode="contained" onPress={() => navigation.navigate('Profile')} style={{marginTop: 20}}>
          Go to Profile
        </Button>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.headerContainer}>
        <Avatar.Icon size={64} icon="face-man-profile" style={{backgroundColor: '#E8F5E9'}} color="#2E7D32" />
        <View style={styles.headerTextContainer}>
          <Text style={styles.greeting}>Hello, {activeChild.name}!</Text>
          <Text style={styles.subGreeting}>Here is your health snapshot for today.</Text>
        </View>
      </View>

      <View style={styles.cardsContainer}>
        {/* NutriVoice AI Showcase Banner */}
        <Card style={[styles.card, { width: '100%', backgroundColor: '#E8F5E9', borderColor: '#C8E6C9', borderWidth: 1 }]}>
          <Card.Title 
            title="NutriVoice AI Assistant 🎙️" 
            subtitle="Hands-free Voice Meal Logging & Health Advice"
            left={(props) => <Avatar.Icon {...props} icon="microphone-message" style={{backgroundColor: '#2E7D32'}} color="#FFF" />} 
          />
          <Card.Content>
            <Text style={styles.voiceBannerText}>
              Say <Text style={{fontWeight: 'bold'}}>“I fed {activeChild.name} 2 idlis for breakfast”</Text> to log meals instantly with voice!
            </Text>
          </Card.Content>
          <Card.Actions>
            <Button mode="contained" buttonColor="#2E7D32" icon="microphone" onPress={() => navigation.navigate('Voice AI')}>
              Talk to NutriVoice
            </Button>
          </Card.Actions>
        </Card>

        {/* Nutrition Card */}
        <Card style={styles.card}>
          <Card.Title 
            title="Today's Nutrition" 
            left={(props) => <Avatar.Icon {...props} icon="food-apple" style={{backgroundColor: '#FFE0B2'}} color="#E65100" />} 
          />
          <Card.Content>
            <Text style={styles.statText}>{summary?.today_calories || 0} kcal</Text>
            <Text style={styles.statSubText}>{summary?.today_protein || 0}g protein</Text>
          </Card.Content>
          <Card.Actions>
            <Button onPress={() => navigation.navigate('Nutrition')}>View Diet</Button>
          </Card.Actions>
        </Card>

        {/* Water Intake Card */}
        <Card style={styles.card}>
          <Card.Title 
            title="Water Tracker" 
            left={(props) => <Avatar.Icon {...props} icon="water" style={{backgroundColor: '#E1F5FE'}} color="#0288D1" />} 
          />
          <Card.Content>
            <Text style={styles.statText}>{summary?.today_water_ml || 0} ml</Text>
            <Text style={styles.statSubText}>Goal: {summary?.target_water_ml || 1500} ml</Text>
          </Card.Content>
          <Card.Actions>
            <Button onPress={() => navigation.navigate('Water Tracker')}>Tracker</Button>
          </Card.Actions>
        </Card>

        {/* Growth Card */}
        <Card style={styles.card}>
          <Card.Title 
            title="Latest BMI" 
            left={(props) => <Avatar.Icon {...props} icon="chart-line" style={{backgroundColor: '#E3F2FD'}} color="#1565C0" />} 
          />
          <Card.Content>
            <Text style={styles.statText}>{summary?.latest_bmi || '--'}</Text>
            <Text style={styles.statSubText}>{summary?.latest_bmi ? 'View growth chart' : 'No measurements logged'}</Text>
          </Card.Content>
          <Card.Actions>
            <Button onPress={() => navigation.navigate('Growth')}>Update</Button>
          </Card.Actions>
        </Card>

        {/* Insight Card */}
        <Card style={[styles.card, { width: '100%' }]}>
          <Card.Title 
            title="Latest AI Insight" 
            left={(props) => <Avatar.Icon {...props} icon="auto-fix" style={{backgroundColor: '#F3E5F5'}} color="#8E24AA" />} 
          />
          <Card.Content>
            {summary?.latest_recommendation ? (
              <Text style={styles.insightText}>{summary.latest_recommendation.content}</Text>
            ) : (
              <Text style={styles.insightText}>Generate insights to receive personalized advice!</Text>
            )}
          </Card.Content>
          <Card.Actions>
            <Button onPress={() => navigation.navigate('Recommendations')}>Go to Insights</Button>
          </Card.Actions>
        </Card>
      </View>
      
      <View style={{height: 40}} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F5' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  headerContainer: { flexDirection: 'row', padding: 20, backgroundColor: '#FFF', alignItems: 'center', marginBottom: 10 },
  headerTextContainer: { marginLeft: 15 },
  greeting: { fontSize: 22, fontWeight: 'bold', color: '#2E7D32' },
  subGreeting: { fontSize: 14, color: '#666', marginTop: 4 },
  header: { fontSize: 24, fontWeight: 'bold', color: '#2E7D32', marginBottom: 10 },
  emptyText: { fontSize: 16, color: '#666', textAlign: 'center' },
  cardsContainer: { paddingHorizontal: 15, flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  card: { width: '48%', marginBottom: 15, backgroundColor: '#FFF' },
  statText: { fontSize: 24, fontWeight: 'bold', color: '#333' },
  statSubText: { fontSize: 12, color: '#888', marginTop: 5 },
  insightText: { fontSize: 14, color: '#444', lineHeight: 20, fontStyle: 'italic' },
  voiceBannerText: { fontSize: 14, color: '#2E7D32', lineHeight: 20 }
});
