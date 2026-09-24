import React, { useState, useEffect, useContext } from 'react';
import { View, StyleSheet, Text, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Card, Button, ProgressBar } from 'react-native-paper';
import { ChildContext } from '../context/ChildContext';
import apiClient from '../api/client';
import Icon from '@expo/vector-icons/MaterialCommunityIcons';

export default function NutritionScreen({ navigation }) {
  const { activeChild, isLoading: childLoading } = useContext(ChildContext);
  
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]); // YYYY-MM-DD
  const [meals, setMeals] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (activeChild) {
      fetchMeals();
    }
  }, [activeChild, selectedDate]);

  const fetchMeals = async () => {
    setLoading(true);
    try {
      const response = await apiClient.get('/meals/', {
        params: {
          child_id: activeChild.child_id,
          meal_date: selectedDate
        }
      });
      setMeals(response.data);
    } catch (e) {
      console.log('Failed to fetch meals', e);
    } finally {
      setLoading(false);
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
    const meal = meals.find(m => m.meal_type === type);
    
    return (
      <Card style={styles.mealCard} key={type}>
        <Card.Title 
          title={type} 
          subtitle={meal ? `${meal.total_calories} kcal • ${meal.total_protein}g Protein` : "No items logged"}
          right={(props) => (
            <View style={{ flexDirection: 'row', alignItems: 'center', marginRight: 8 }}>
              <Button
                compact
                icon="barcode-scan"
                textColor="#2E7D32"
                onPress={() => navigation.navigate('AddMeal', { mealType: type, mealDate: selectedDate })}
              >
                + Add
              </Button>
            </View>
          )}
        />
        {meal && meal.items && meal.items.length > 0 && (
          <Card.Content>
            {meal.items.map((item, index) => (
              <View key={index} style={styles.foodRow}>
                <Text style={styles.foodName}>{item.food.food_name}</Text>
                <Text style={styles.foodDetails}>
                  {item.quantity} x {item.food.serving_size} ({item.food.calories * item.quantity} kcal)
                </Text>
              </View>
            ))}
          </Card.Content>
        )}
      </Card>
    );
  };

  const totalCalories = meals.reduce((sum, meal) => sum + parseFloat(meal.total_calories), 0);
  const totalProtein = meals.reduce((sum, meal) => sum + parseFloat(meal.total_protein), 0);

  // Hardcoded goals for demo
  const goalCalories = 1500;
  const goalProtein = 50;

  const changeDate = (days) => {
    const parts = selectedDate.split('-');
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const day = parseInt(parts[2], 10);
    const d = new Date(year, month, day + days);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    setSelectedDate(`${yyyy}-${mm}-${dd}`);
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.headerRow}>
        <TouchableOpacity onPress={() => changeDate(-1)}>
          <Icon name="chevron-left" size={30} color="#2E7D32" />
        </TouchableOpacity>
        
        <Text style={styles.dateText}>{selectedDate}</Text>
        
        <TouchableOpacity onPress={() => changeDate(1)}>
          <Icon name="chevron-right" size={30} color="#2E7D32" />
        </TouchableOpacity>
      </View>

      <Card style={styles.summaryCard}>
        <Card.Content>
          <Text style={styles.summaryTitle}>Daily Summary for {activeChild.name}</Text>
          
          <Text style={styles.progressLabel}>Calories: {totalCalories} / {goalCalories} kcal</Text>
          <ProgressBar progress={Math.min(totalCalories / goalCalories, 1)} color="#E65100" style={styles.progressBar} />
          
          <Text style={styles.progressLabel}>Protein: {totalProtein} / {goalProtein} g</Text>
          <ProgressBar progress={Math.min(totalProtein / goalProtein, 1)} color="#1565C0" style={styles.progressBar} />
        </Card.Content>
      </Card>

      {loading ? (
        <ActivityIndicator size="small" color="#2E7D32" style={{marginTop: 20}} />
      ) : (
        mealTypes.map(type => renderMealSection(type))
      )}
      
      <View style={{height: 40}} /> 
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F5' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  emptyText: { fontSize: 16, color: '#666', textAlign: 'center' },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 15, backgroundColor: '#FFF' },
  dateText: { fontSize: 18, fontWeight: 'bold', color: '#2E7D32' },
  summaryCard: { margin: 15, backgroundColor: '#FFF', borderRadius: 10 },
  summaryTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 15, color: '#333' },
  progressLabel: { fontSize: 14, marginBottom: 5, color: '#555' },
  progressBar: { height: 8, borderRadius: 4, marginBottom: 15 },
  mealCard: { marginHorizontal: 15, marginBottom: 15, backgroundColor: '#FFF' },
  foodRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 5, borderTopWidth: 1, borderTopColor: '#EEE' },
  foodName: { fontSize: 14, color: '#333', flex: 1 },
  foodDetails: { fontSize: 12, color: '#666' }
});
