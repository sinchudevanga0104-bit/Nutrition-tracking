import React, { useState, useContext } from 'react';
import { View, StyleSheet, Text, ScrollView, TouchableOpacity } from 'react-native';
import { TextInput, Button, RadioButton, HelperText, Chip, Card } from 'react-native-paper';
import { ChildContext } from '../context/ChildContext';
import apiClient, { formatApiError } from '../api/client';

const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
const FOOD_PREFERENCES = ['Vegetarian', 'Non-Veg', 'Eggetarian', 'Vegan'];
const COMMON_ALLERGIES = ['Nuts', 'Lactose', 'Gluten', 'Soy', 'Eggs', 'Seafood'];

export default function AddChildScreen({ navigation }) {
  const { fetchChildren } = useContext(ChildContext);
  
  const [name, setName] = useState('');
  const [dob, setDob] = useState('');
  const [gender, setGender] = useState('Male');
  const [height, setHeight] = useState('');
  const [weight, setWeight] = useState('');
  const [bloodGroup, setBloodGroup] = useState('');
  const [foodPreference, setFoodPreference] = useState('');
  const [selectedAllergies, setSelectedAllergies] = useState([]);
  const [customAllergy, setCustomAllergy] = useState('');
  const [activityLevel, setActivityLevel] = useState('Moderate');
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const toggleAllergy = (allergy) => {
    if (selectedAllergies.includes(allergy)) {
      setSelectedAllergies(selectedAllergies.filter(a => a !== allergy));
    } else {
      setSelectedAllergies([...selectedAllergies, allergy]);
    }
  };

  const handleAddChild = async () => {
    if (!name || !dob) {
      setError('Name and Date of Birth are required.');
      return;
    }
    
    // Validate DOB format (YYYY-MM-DD)
    const dobRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dobRegex.test(dob)) {
      setError('Date of Birth must be in YYYY-MM-DD format.');
      return;
    }

    setLoading(true);
    setError('');

    // Combine allergy chips and custom input
    const allAllergiesList = [...selectedAllergies];
    if (customAllergy.trim()) {
      allAllergiesList.push(customAllergy.trim());
    }
    const finalAllergies = allAllergiesList.length > 0 ? allAllergiesList.join(', ') : null;

    try {
      await apiClient.post('/children/', {
        name,
        dob,
        gender,
        height: height ? parseFloat(height) : null,
        weight: weight ? parseFloat(weight) : null,
        blood_group: bloodGroup || null,
        food_preferences: foodPreference || null,
        food_allergies: finalAllergies,
        activity_level: activityLevel
      });
      
      await fetchChildren(); // Refresh child list
      navigation.goBack(); // Return to profile
    } catch (err) {
      setError(formatApiError(err, 'Failed to add child. Please check connection and backend server.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 50 }}>
      <Text style={styles.header}>Add a Child</Text>
      
      {/* Basic Info */}
      <Card style={styles.card}>
        <Card.Title title="Basic Information" />
        <Card.Content>
          <TextInput
            label="Name *"
            value={name}
            onChangeText={setName}
            mode="outlined"
            style={styles.input}
          />
          
          <TextInput
            label="Date of Birth (YYYY-MM-DD) *"
            value={dob}
            placeholder="e.g. 2018-05-15"
            onChangeText={setDob}
            mode="outlined"
            style={styles.input}
          />
          
          <Text style={styles.label}>Gender</Text>
          <RadioButton.Group onValueChange={newValue => setGender(newValue)} value={gender}>
            <View style={styles.radioRow}>
              <RadioButton.Item label="Male" value="Male" />
              <RadioButton.Item label="Female" value="Female" />
              <RadioButton.Item label="Other" value="Other" />
            </View>
          </RadioButton.Group>
        </Card.Content>
      </Card>

      {/* Height & Weight */}
      <Card style={styles.card}>
        <Card.Title title="Growth Metrics (Optional)" />
        <Card.Content>
          <View style={styles.row}>
            <TextInput
              label="Height (cm)"
              value={height}
              onChangeText={setHeight}
              keyboardType="numeric"
              mode="outlined"
              style={[styles.input, { flex: 1, marginRight: 5 }]}
            />
            <TextInput
              label="Weight (kg)"
              value={weight}
              onChangeText={setWeight}
              keyboardType="numeric"
              mode="outlined"
              style={[styles.input, { flex: 1, marginLeft: 5 }]}
            />
          </View>
        </Card.Content>
      </Card>

      {/* Blood Group */}
      <Card style={styles.card}>
        <Card.Title title="Blood Group" />
        <Card.Content>
          <View style={styles.chipContainer}>
            {BLOOD_GROUPS.map(bg => (
              <Chip
                key={bg}
                selected={bloodGroup === bg}
                onPress={() => setBloodGroup(bloodGroup === bg ? '' : bg)}
                style={[styles.chip, bloodGroup === bg && styles.selectedChip]}
                textStyle={bloodGroup === bg ? styles.selectedChipText : null}
              >
                {bg}
              </Chip>
            ))}
          </View>
        </Card.Content>
      </Card>

      {/* Food Preferences & Allergies */}
      <Card style={styles.card}>
        <Card.Title title="Dietary Preferences & Allergies" />
        <Card.Content>
          <Text style={styles.label}>Food Preference</Text>
          <View style={styles.chipContainer}>
            {FOOD_PREFERENCES.map(pref => (
              <Chip
                key={pref}
                selected={foodPreference === pref}
                onPress={() => setFoodPreference(foodPreference === pref ? '' : pref)}
                style={[styles.chip, foodPreference === pref && styles.selectedChip]}
                textStyle={foodPreference === pref ? styles.selectedChipText : null}
              >
                {pref}
              </Chip>
            ))}
          </View>

          <Text style={[styles.label, { marginTop: 15 }]}>Known Food Allergies</Text>
          <View style={styles.chipContainer}>
            {COMMON_ALLERGIES.map(allergy => (
              <Chip
                key={allergy}
                selected={selectedAllergies.includes(allergy)}
                onPress={() => toggleAllergy(allergy)}
                style={[styles.chip, selectedAllergies.includes(allergy) && styles.selectedChip]}
                textStyle={selectedAllergies.includes(allergy) ? styles.selectedChipText : null}
              >
                {allergy}
              </Chip>
            ))}
          </View>
          
          <TextInput
            label="Other Allergies (Optional)"
            value={customAllergy}
            onChangeText={setCustomAllergy}
            mode="outlined"
            style={[styles.input, { marginTop: 10 }]}
          />
        </Card.Content>
      </Card>

      {/* Activity Level */}
      <Card style={styles.card}>
        <Card.Title title="Activity Level" />
        <Card.Content>
          <RadioButton.Group onValueChange={newValue => setActivityLevel(newValue)} value={activityLevel}>
            <View style={styles.radioRow}>
              <RadioButton.Item label="Low" value="Low" />
              <RadioButton.Item label="Moderate" value="Moderate" />
              <RadioButton.Item label="High" value="High" />
            </View>
          </RadioButton.Group>
        </Card.Content>
      </Card>

      {error ? <HelperText type="error" visible={true} style={{ marginHorizontal: 15 }}>{error}</HelperText> : null}

      <Button 
        mode="contained" 
        onPress={handleAddChild} 
        loading={loading}
        disabled={loading}
        style={styles.button}
      >
        Save Child Profile
      </Button>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F5' },
  header: { fontSize: 24, fontWeight: 'bold', color: '#2E7D32', margin: 15 },
  card: { marginHorizontal: 15, marginBottom: 15, backgroundColor: '#FFFFFF' },
  input: { marginBottom: 10 },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  label: { fontSize: 14, fontWeight: '600', color: '#444', marginBottom: 8 },
  radioRow: { flexDirection: 'row', justifyContent: 'flex-start', flexWrap: 'wrap' },
  chipContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10 },
  chip: { backgroundColor: '#F0F0F0', marginBottom: 4 },
  selectedChip: { backgroundColor: '#2E7D32' },
  selectedChipText: { color: '#FFFFFF', fontWeight: 'bold' },
  button: { margin: 15, paddingVertical: 5, backgroundColor: '#2E7D32' }
});
