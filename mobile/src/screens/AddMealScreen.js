import React, { useState, useEffect, useContext } from 'react';
import { View, StyleSheet, Text, FlatList, ActivityIndicator } from 'react-native';
import { Searchbar, List, Button, Dialog, Portal, TextInput } from 'react-native-paper';
import { ChildContext } from '../context/ChildContext';
import apiClient from '../api/client';

export default function AddMealScreen({ route, navigation }) {
  const { mealType, mealDate } = route.params;
  const { activeChild } = useContext(ChildContext);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [foods, setFoods] = useState([]);
  const [loading, setLoading] = useState(false);
  
  // Dialog state
  const [selectedFood, setSelectedFood] = useState(null);
  const [quantity, setQuantity] = useState('1');
  const [dialogVisible, setDialogVisible] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    // Fetch initial list of foods
    fetchFoods('');
  }, []);

  const fetchFoods = async (query) => {
    setLoading(true);
    try {
      const response = await apiClient.get('/meals/foods', {
        params: query ? { query } : {}
      });
      setFoods(response.data);
    } catch (e) {
      console.log('Error fetching foods', e);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (query) => {
    setSearchQuery(query);
    // Debounce this in a real app
    if (query.length > 2 || query.length === 0) {
      fetchFoods(query);
    }
  };

  const openDialog = (food) => {
    setSelectedFood(food);
    setQuantity('1');
    setDialogVisible(true);
  };

  const handleAddToMeal = async () => {
    if (!selectedFood || !quantity) return;
    
    setSaving(true);
    try {
      // 1. Create the meal if it doesn't exist (backend handles "get or create")
      const mealRes = await apiClient.post('/meals/', {
        child_id: activeChild.child_id,
        meal_type: mealType,
        meal_date: mealDate
      });
      
      const mealId = mealRes.data.meal_id;
      
      // 2. Add the item to the meal
      await apiClient.post(`/meals/${mealId}/items`, {
        food_id: selectedFood.food_id,
        quantity: parseFloat(quantity)
      });
      
      setDialogVisible(false);
      navigation.goBack(); // Go back to nutrition screen
    } catch (e) {
      console.log('Error saving meal item', e);
    } finally {
      setSaving(false);
    }
  };

  const renderFood = ({ item }) => (
    <List.Item
      title={item.food_name}
      description={`${item.serving_size} • ${item.calories} kcal • ${item.protein}g protein`}
      right={props => <Button onPress={() => openDialog(item)}>Add</Button>}
      style={styles.listItem}
    />
  );

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.header}>Add to {mealType}</Text>
        <Button
          mode="contained-tonal"
          icon="camera-outline"
          buttonColor="#E8F5E9"
          textColor="#2E7D32"
          style={styles.scanBtn}
          onPress={() =>
            navigation.navigate('ScannerScreen', {
              mealType,
              onSelectFood: (food) => openDialog(food),
            })
          }
        >
          Scan Food
        </Button>
      </View>
      
      <Searchbar
        placeholder="Search for food..."
        onChangeText={handleSearch}
        value={searchQuery}
        style={styles.searchbar}
      />

      
      {loading ? (
        <ActivityIndicator size="large" color="#2E7D32" style={{marginTop: 50}} />
      ) : (
        <FlatList
          data={foods}
          keyExtractor={(item) => item.food_id.toString()}
          renderItem={renderFood}
        />
      )}

      <Portal>
        <Dialog visible={dialogVisible} onDismiss={() => setDialogVisible(false)}>
          <Dialog.Title>Add {selectedFood?.food_name}</Dialog.Title>
          <Dialog.Content>
            <Text style={{marginBottom: 10}}>Enter quantity (in servings):</Text>
            <TextInput
              label="Quantity"
              value={quantity}
              onChangeText={setQuantity}
              keyboardType="numeric"
              mode="outlined"
            />
            <Text style={{marginTop: 10, color: '#666'}}>
              1 serving = {selectedFood?.serving_size}
            </Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setDialogVisible(false)}>Cancel</Button>
            <Button onPress={handleAddToMeal} loading={saving} disabled={saving}>
              Add to Meal
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginHorizontal: 15, marginTop: 15, marginBottom: 5 },
  header: { fontSize: 20, fontWeight: 'bold', color: '#2E7D32' },
  scanBtn: { borderRadius: 20 },
  searchbar: { marginHorizontal: 15, marginBottom: 15, backgroundColor: '#F5F5F5' },
  listItem: { borderBottomWidth: 1, borderBottomColor: '#F0F0F0' }
});

