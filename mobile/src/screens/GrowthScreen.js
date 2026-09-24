import React, { useState, useEffect, useContext } from 'react';
import { View, StyleSheet, Text, ScrollView, ActivityIndicator, Dimensions } from 'react-native';
import { Card, Button, TextInput, HelperText, DataTable } from 'react-native-paper';
import { LineChart } from 'react-native-chart-kit';
import { ChildContext } from '../context/ChildContext';
import apiClient, { formatApiError } from '../api/client';

export default function GrowthScreen() {
  const { activeChild, isLoading: childLoading } = useContext(ChildContext);
  
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  
  // Form State
  const [recordDate, setRecordDate] = useState(new Date().toISOString().split('T')[0]);
  const [height, setHeight] = useState('');
  const [weight, setWeight] = useState('');

  useEffect(() => {
    if (activeChild) {
      fetchRecords();
    }
  }, [activeChild]);

  const fetchRecords = async () => {
    setLoading(true);
    try {
      const response = await apiClient.get(`/growth/${activeChild.child_id}`);
      setRecords(response.data);
    } catch (e) {
      console.log('Error fetching growth records', e);
    } finally {
      setLoading(false);
    }
  };

  const handleAddRecord = async () => {
    if (!height || !weight || !recordDate) {
      setError('Please fill in all fields');
      return;
    }
    
    setSaving(true);
    setError('');
    
    try {
      await apiClient.post('/growth/', {
        child_id: activeChild.child_id,
        record_date: recordDate,
        height: parseFloat(height),
        weight: parseFloat(weight)
      });
      
      // Reset form & refresh
      setHeight('');
      setWeight('');
      await fetchRecords();
    } catch (e) {
      setError(formatApiError(e, 'Failed to add record'));
    } finally {
      setSaving(false);
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

  // Prepare chart data
  const chartData = {
    labels: records.map(r => r.record_date.slice(5)), // Show MM-DD
    datasets: [
      {
        data: records.length > 0 ? records.map(r => parseFloat(r.bmi)) : [0],
        color: (opacity = 1) => `rgba(46, 125, 50, ${opacity})`,
        strokeWidth: 2
      }
    ],
    legend: ["BMI Trend"]
  };

  return (
    <ScrollView style={styles.container}>
      <Card style={styles.card}>
        <Card.Title title="Log New Measurement" />
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
          <TextInput
            label="Date (YYYY-MM-DD)"
            value={recordDate}
            onChangeText={setRecordDate}
            mode="outlined"
            style={styles.input}
          />
          {error ? <HelperText type="error" visible={true}>{error}</HelperText> : null}
          <Button mode="contained" onPress={handleAddRecord} loading={saving} disabled={saving} style={styles.button}>
            Save Record
          </Button>
        </Card.Content>
      </Card>

      {loading ? (
        <ActivityIndicator size="small" color="#2E7D32" style={{margin: 20}} />
      ) : records.length > 0 ? (
        <>
          <Card style={styles.card}>
            <Card.Title title="Growth Chart (BMI)" />
            <Card.Content>
              <LineChart
                data={chartData}
                width={Dimensions.get("window").width - 60} // card padding
                height={220}
                chartConfig={{
                  backgroundColor: "#ffffff",
                  backgroundGradientFrom: "#ffffff",
                  backgroundGradientTo: "#ffffff",
                  decimalPlaces: 1,
                  color: (opacity = 1) => `rgba(46, 125, 50, ${opacity})`,
                  labelColor: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
                  style: { borderRadius: 16 },
                  propsForDots: { r: "4", strokeWidth: "2", stroke: "#1565C0" }
                }}
                bezier
                style={{ marginVertical: 8, borderRadius: 16 }}
              />
            </Card.Content>
          </Card>

          <Card style={styles.card}>
            <Card.Title title="History" />
            <Card.Content>
              <DataTable>
                <DataTable.Header>
                  <DataTable.Title>Date</DataTable.Title>
                  <DataTable.Title numeric>Ht (cm)</DataTable.Title>
                  <DataTable.Title numeric>Wt (kg)</DataTable.Title>
                  <DataTable.Title numeric>BMI</DataTable.Title>
                </DataTable.Header>

                {records.slice().reverse().map((record) => (
                  <DataTable.Row key={record.record_id}>
                    <DataTable.Cell>{record.record_date}</DataTable.Cell>
                    <DataTable.Cell numeric>{record.height}</DataTable.Cell>
                    <DataTable.Cell numeric>{record.weight}</DataTable.Cell>
                    <DataTable.Cell numeric>{record.bmi}</DataTable.Cell>
                  </DataTable.Row>
                ))}
              </DataTable>
            </Card.Content>
          </Card>
        </>
      ) : (
        <View style={styles.center}>
          <Text style={styles.emptyText}>No growth records found. Add one above!</Text>
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
  card: { margin: 15, backgroundColor: '#FFF' },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  input: { marginBottom: 15 },
  button: { marginTop: 5 }
});
