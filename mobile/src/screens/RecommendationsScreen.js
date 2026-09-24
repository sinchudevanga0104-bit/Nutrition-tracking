import React, { useState, useEffect, useContext } from 'react';
import { View, StyleSheet, Text, ScrollView, ActivityIndicator } from 'react-native';
import { Card, Button, Avatar } from 'react-native-paper';
import { ChildContext } from '../context/ChildContext';
import apiClient from '../api/client';

export default function RecommendationsScreen() {
  const { activeChild, isLoading: childLoading } = useContext(ChildContext);
  
  const [recommendations, setRecommendations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    if (activeChild) {
      fetchRecommendations();
    }
  }, [activeChild]);

  const fetchRecommendations = async () => {
    setLoading(true);
    try {
      const response = await apiClient.get(`/recommendations/${activeChild.child_id}`);
      setRecommendations(response.data);
    } catch (e) {
      console.log('Error fetching recommendations', e);
    } finally {
      setLoading(false);
    }
  };

  const generateNewInsights = async () => {
    setGenerating(true);
    try {
      await apiClient.post(`/recommendations/${activeChild.child_id}/generate`);
      await fetchRecommendations(); // Refresh list after generation
    } catch (e) {
      console.log('Error generating recommendations', e);
    } finally {
      setGenerating(false);
    }
  };

  if (childLoading) {
    return <View style={styles.center}><ActivityIndicator size="large" color="#2E7D32" /></View>;
  }

  if (!activeChild) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyText}>Please select or add a child from the Profile tab first.</Text>
      </View>
    );
  }

  const getIconForType = (type) => {
    switch (type) {
      case 'Food': return 'food-apple';
      case 'Activity': return 'run';
      default: return 'lightbulb-on';
    }
  };

  const getColorForType = (type) => {
    switch (type) {
      case 'Food': return '#E65100'; // Orange
      case 'Activity': return '#1565C0'; // Blue
      default: return '#2E7D32'; // Green
    }
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.headerContainer}>
        <Text style={styles.header}>AI Insights for {activeChild.name}</Text>
        <Button 
          mode="contained" 
          onPress={generateNewInsights} 
          loading={generating} 
          disabled={generating}
          icon="auto-fix"
          style={styles.generateBtn}
        >
          Generate New
        </Button>
      </View>

      {loading ? (
        <ActivityIndicator size="small" color="#2E7D32" style={{margin: 20}} />
      ) : recommendations.length > 0 ? (
        recommendations.map((rec) => (
          <Card key={rec.recommendation_id} style={styles.card}>
            <Card.Title
              title={rec.type + " Recommendation"}
              subtitle={new Date(rec.created_at).toLocaleDateString()}
              left={(props) => (
                <Avatar.Icon 
                  {...props} 
                  icon={getIconForType(rec.type)} 
                  style={{ backgroundColor: getColorForType(rec.type) }} 
                />
              )}
            />
            <Card.Content>
              <Text style={styles.content}>{rec.content}</Text>
            </Card.Content>
          </Card>
        ))
      ) : (
        <View style={styles.center}>
          <Text style={styles.emptyText}>No insights available. Tap "Generate New" to run the AI engine!</Text>
        </View>
      )}
      
      <View style={{height: 40}} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F5' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  emptyText: { fontSize: 16, color: '#666', textAlign: 'center', marginVertical: 20 },
  headerContainer: { padding: 15, backgroundColor: '#FFF', marginBottom: 10, alignItems: 'center' },
  header: { fontSize: 20, fontWeight: 'bold', color: '#333', marginBottom: 10 },
  generateBtn: { borderRadius: 20, width: '80%' },
  card: { marginHorizontal: 15, marginVertical: 8, backgroundColor: '#FFF' },
  content: { fontSize: 16, color: '#444', lineHeight: 24, marginTop: 10 }
});
