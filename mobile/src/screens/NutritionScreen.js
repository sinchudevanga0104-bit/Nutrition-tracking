import React, { useState, useEffect, useContext, useCallback } from 'react';
import { View, StyleSheet, Text, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl, Alert } from 'react-native';
import { Card, Button, ProgressBar } from 'react-native-paper';
import { ChildContext } from '../context/ChildContext';
import apiClient from '../api/client';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';

// Helper to format date reliably in local timezone (YYYY-MM-DD)
const getLocalDateString = (d = new Date()) => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export default function NutritionScreen({ navigation }) {
  const { activeChild, isLoading: childLoading } = useContext(ChildContext);
  
  const [selectedDate, setSelectedDate] = useState(getLocalDateString());
  const [meals, setMeals] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [deletingItemId, setDeletingItemId] = useState(null);
  const [whoTargets, setWhoTargets] = useState({
    calories: 1350,
    protein: 19.0,
    age_group: 'Child',
    who_source: 'WHO/FAO Recommended Nutrient Intakes'
  });

  const fetchMeals = useCallback(async (showSpinner = true) => {
    if (!activeChild?.child_id) return;
    if (showSpinner) setLoading(true);
    try {
      const response = await apiClient.get('/meals/', {
        params: {
          child_id: activeChild.child_id,
          meal_date: selectedDate
        }
      });
      setMeals(Array.isArray(response.data) ? response.data : []);
    } catch (e) {
      console.log('Failed to fetch meals', e);
    } finally {
      if (showSpinner) setLoading(false);
    }
  }, [activeChild?.child_id, selectedDate]);

  // Fetch WHO recommended dietary guidelines for this specific child
  useEffect(() => {
    if (activeChild?.child_id) {
      apiClient.get(`/meals/who-targets/${activeChild.child_id}`)
        .then(res => {
          if (res.data) setWhoTargets(res.data);
        })
        .catch(e => console.log('Error fetching WHO targets', e));
    }
  }, [activeChild?.child_id]);

  // Re-fetch meals when screen comes into focus (e.g., returning from AddMealScreen or switching tabs)
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      fetchMeals(false);
    });

    fetchMeals(true);

    return unsubscribe;
  }, [navigation, fetchMeals]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchMeals(false);
    setRefreshing(false);
  };

  const handleDeleteItem = async (itemId) => {
    setDeletingItemId(itemId);
    try {
      await apiClient.delete(`/meals/items/${itemId}`);
      await fetchMeals(false);
    } catch (e) {
      console.log('Failed to delete item', e);
      Alert.alert('Error', 'Failed to remove food item. Please try again.');
    } finally {
      setDeletingItemId(null);
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

  const mealTypes = ['Breakfast', 'Lunch', 'Snacks', 'Dinner'];

  const renderMealSection = (type) => {
    // Find all meals matching this meal type case-insensitively
    const matchingMeals = meals.filter(
      m => m.meal_type && m.meal_type.toLowerCase() === type.toLowerCase()
    );

    const allItems = matchingMeals.flatMap(m => m.items || []);
    const sectionCalories = Math.round(
      matchingMeals.reduce((sum, m) => sum + parseFloat(m.total_calories || 0), 0)
    );
    const sectionProtein = (
      matchingMeals.reduce((sum, m) => sum + parseFloat(m.total_protein || 0), 0)
    ).toFixed(1);

    const hasItems = allItems.length > 0;

    return (
      <Card style={styles.mealCard} key={type}>
        <Card.Title 
          title={type} 
          titleStyle={styles.mealTitle}
          subtitle={hasItems ? `${sectionCalories} kcal • ${sectionProtein}g Protein` : "No items logged"}
          subtitleStyle={hasItems ? styles.mealSubtitleActive : styles.mealSubtitleEmpty}
          right={(props) => (
            <View style={{ flexDirection: 'row', alignItems: 'center', marginRight: 8 }}>
              <Button
                compact
                icon="plus-circle-outline"
                textColor="#2E7D32"
                onPress={() => navigation.navigate('AddMeal', { mealType: type, mealDate: selectedDate })}
              >
                + Add
              </Button>
            </View>
          )}
        />
        {hasItems && (
          <Card.Content style={styles.itemsContent}>
            {allItems.map((item, index) => {
              const itemCalories = item.food ? Math.round(parseFloat(item.food.calories) * parseFloat(item.quantity)) : 0;
              const isDeleting = deletingItemId === item.item_id;

              return (
                <View key={item.item_id || index} style={styles.foodRow}>
                  <View style={{ flex: 1, paddingRight: 8 }}>
                    <Text style={styles.foodName}>{item.food?.food_name || 'Food item'}</Text>
                    <Text style={styles.foodDetails}>
                      {item.quantity} x {item.food?.serving_size || 'serving'} ({item.food ? itemCalories : 0} kcal)
                    </Text>
                  </View>
                  {isDeleting ? (
                    <ActivityIndicator size="small" color="#D32F2F" />
                  ) : (
                    <TouchableOpacity
                      onPress={() => handleDeleteItem(item.item_id)}
                      style={styles.deleteButton}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Icon name="trash-can-outline" size={20} color="#D32F2F" />
                    </TouchableOpacity>
                  )}
                </View>
              );
            })}
          </Card.Content>
        )}
      </Card>
    );
  };

  const totalCalories = Math.round(meals.reduce((sum, meal) => sum + parseFloat(meal.total_calories || 0), 0));
  const totalProtein = (meals.reduce((sum, meal) => sum + parseFloat(meal.total_protein || 0), 0)).toFixed(1);

  // Official WHO Daily Nutritional Targets for this child
  const goalCalories = whoTargets?.calories || 1350;
  const goalProtein = whoTargets?.protein || 19.0;

  const changeDate = (days) => {
    const parts = selectedDate.split('-');
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const day = parseInt(parts[2], 10);
    const d = new Date(year, month, day + days);
    setSelectedDate(getLocalDateString(d));
  };

  const isToday = selectedDate === getLocalDateString();

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#2E7D32']} />}
    >
      <View style={styles.headerRow}>
        <TouchableOpacity onPress={() => changeDate(-1)} style={styles.arrowButton}>
          <Icon name="chevron-left" size={28} color="#2E7D32" />
        </TouchableOpacity>
        
        <View style={styles.dateContainer}>
          <Text style={styles.dateText}>{selectedDate}</Text>
          {!isToday && (
            <TouchableOpacity onPress={() => setSelectedDate(getLocalDateString())} style={styles.todayBadge}>
              <Text style={styles.todayBadgeText}>Jump to Today</Text>
            </TouchableOpacity>
          )}
        </View>
        
        <TouchableOpacity onPress={() => changeDate(1)} style={styles.arrowButton}>
          <Icon name="chevron-right" size={28} color="#2E7D32" />
        </TouchableOpacity>
      </View>

      <Card style={styles.summaryCard}>
        <Card.Content>
          <Text style={styles.summaryTitle}>Daily Summary for {activeChild.name}</Text>
          <Text style={styles.whoSubtitle}>
            🎯 WHO Daily Benchmark: {goalCalories} kcal • {goalProtein}g Protein ({whoTargets?.age_group})
          </Text>
          
          <Text style={styles.progressLabel}>Calories: {totalCalories} / {goalCalories} kcal</Text>
          <ProgressBar progress={Math.min(totalCalories / goalCalories, 1)} color="#E65100" style={styles.progressBar} />
          
          <Text style={styles.progressLabel}>Protein: {totalProtein} / {goalProtein} g</Text>
          <ProgressBar progress={Math.min(parseFloat(totalProtein) / goalProtein, 1)} color="#1565C0" style={styles.progressBar} />
        </Card.Content>
      </Card>

      {loading ? (
        <ActivityIndicator size="small" color="#2E7D32" style={{ marginTop: 20 }} />
      ) : (
        mealTypes.map(type => renderMealSection(type))
      )}
      
      <View style={{ height: 40 }} /> 
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F5' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  emptyText: { fontSize: 16, color: '#666', textAlign: 'center' },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 15, paddingVertical: 12, backgroundColor: '#FFF' },
  arrowButton: { padding: 4 },
  dateContainer: { alignItems: 'center' },
  dateText: { fontSize: 18, fontWeight: 'bold', color: '#2E7D32' },
  todayBadge: { marginTop: 3, backgroundColor: '#E8F5E9', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  todayBadgeText: { fontSize: 11, color: '#2E7D32', fontWeight: '600' },
  summaryCard: { margin: 15, backgroundColor: '#FFF', borderRadius: 10, elevation: 2 },
  summaryTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 4, color: '#333' },
  whoSubtitle: { fontSize: 12, color: '#2E7D32', fontWeight: '600', marginBottom: 14 },
  progressLabel: { fontSize: 14, marginBottom: 5, color: '#555' },
  progressBar: { height: 8, borderRadius: 4, marginBottom: 15 },
  mealCard: { marginHorizontal: 15, marginBottom: 15, backgroundColor: '#FFF', borderRadius: 10, elevation: 1 },
  mealTitle: { fontSize: 16, fontWeight: 'bold', color: '#333' },
  mealSubtitleActive: { color: '#2E7D32', fontWeight: '600', fontSize: 13 },
  mealSubtitleEmpty: { color: '#888', fontSize: 13 },
  itemsContent: { paddingTop: 0, paddingBottom: 10 },
  foodRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8, borderTopWidth: 1, borderTopColor: '#F0F0F0' },
  foodName: { fontSize: 14, fontWeight: '600', color: '#333' },
  foodDetails: { fontSize: 12, color: '#666', marginTop: 2 },
  deleteButton: { padding: 6 },
});
