import React, { useState, useEffect, useContext } from 'react';
import { View, StyleSheet, Text, ScrollView, ActivityIndicator, Dimensions } from 'react-native';
import { Card, Button, TextInput, HelperText, DataTable, Chip, Divider } from 'react-native-paper';
import { LineChart } from 'react-native-chart-kit';
import Icon from '@expo/vector-icons/MaterialCommunityIcons';
import { ChildContext } from '../context/ChildContext';
import apiClient, { formatApiError } from '../api/client';

export default function GrowthScreen() {
  const { activeChild, isLoading: childLoading } = useContext(ChildContext);
  
  const [records, setRecords] = useState([]);
  const [whoAssessment, setWhoAssessment] = useState(null);
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
      const [recordsRes, whoRes] = await Promise.all([
        apiClient.get(`/growth/${activeChild.child_id}`),
        apiClient.get(`/growth/${activeChild.child_id}/who-assessment`).catch(() => ({ data: null }))
      ]);
      setRecords(recordsRes.data || []);
      setWhoAssessment(whoRes.data || null);
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

  const latest = whoAssessment?.latest_assessment;
  const history = whoAssessment?.history_comparison || [];

  // Multi-line chart comparing Child BMI with WHO Median and WHO -2SD Threshold
  const chartLabels = records.map(r => r.record_date.slice(5));
  const childBmiData = records.map(r => parseFloat(r.bmi));
  const whoMedianData = history.length > 0 ? history.map(h => h.who_median_bmi) : childBmiData.map(() => 15.5);
  const whoLowerData = history.length > 0 ? history.map(h => h.who_lower_2sd_bmi) : childBmiData.map(() => 13.5);

  const chartData = {
    labels: chartLabels.length > 0 ? chartLabels : ["--"],
    datasets: [
      {
        data: childBmiData.length > 0 ? childBmiData : [0],
        color: (opacity = 1) => `rgba(46, 125, 50, ${opacity})`, // Green
        strokeWidth: 3
      },
      {
        data: whoMedianData.length > 0 ? whoMedianData : [15.5],
        color: (opacity = 1) => `rgba(21, 101, 192, ${opacity})`, // Blue
        strokeWidth: 2
      },
      {
        data: whoLowerData.length > 0 ? whoLowerData : [13.5],
        color: (opacity = 1) => `rgba(230, 81, 0, ${opacity})`, // Orange
        strokeWidth: 2
      }
    ],
    legend: ["Child BMI", "WHO Median (50th)", "WHO Lower Normal (-2SD)"]
  };

  return (
    <ScrollView style={styles.container}>
      {/* WHO STANDARDS OFFICIAL ASSESSMENT CARD */}
      {latest && (
        <Card style={styles.whoCard}>
          <Card.Title
            title="WHO Child Growth Standards"
            subtitle={`${whoAssessment.who_standard_reference} • Age: ${whoAssessment.current_age_years} yrs`}
            left={(props) => (
              <View style={styles.whoLogoBadge}>
                <Icon name="shield-check" size={24} color="#FFF" />
              </View>
            )}
          />
          <Card.Content>
            {/* Status & Percentile Banner */}
            <View style={styles.whoHeaderRow}>
              <View style={[styles.whoStatusPill, { backgroundColor: latest.badge_color || '#2E7D32' }]}>
                <Text style={styles.whoStatusText}>{latest.status}</Text>
              </View>
              <Text style={styles.whoPercentileText}>
                {latest.who_percentile}th Percentile (Z: {latest.who_zscore > 0 ? `+${latest.who_zscore}` : latest.who_zscore})
              </Text>
            </View>

            <Text style={styles.whoAdviceText}>
              💡 {latest.clinical_advice}
            </Text>

            <Divider style={{ marginVertical: 12 }} />

            {/* WHO Comparison Metrics Grid */}
            <View style={styles.metricsGrid}>
              <View style={styles.metricBox}>
                <Text style={styles.metricLabel}>Child BMI</Text>
                <Text style={styles.metricVal}>{latest.bmi}</Text>
                <Text style={styles.metricWhoSub}>WHO Med: {latest.who_median_bmi}</Text>
              </View>

              <View style={styles.metricBox}>
                <Text style={styles.metricLabel}>Weight</Text>
                <Text style={styles.metricVal}>{latest.weight_kg} kg</Text>
                <Text style={styles.metricWhoSub}>WHO Med: {latest.who_median_weight} kg</Text>
              </View>

              <View style={styles.metricBox}>
                <Text style={styles.metricLabel}>Height</Text>
                <Text style={styles.metricVal}>{latest.height_cm} cm</Text>
                <Text style={styles.metricWhoSub}>WHO Med: {latest.who_median_height} cm</Text>
              </View>
            </View>

            <View style={styles.whoRangeNotice}>
              <Icon name="information-outline" size={16} color="#1565C0" />
              <Text style={styles.whoRangeNoticeText}>
                Healthy WHO Normal Range for this age: BMI {latest.who_normal_min_bmi} – {latest.who_normal_max_bmi}
              </Text>
            </View>
          </Card.Content>
        </Card>
      )}

      {/* Log Measurement Card */}
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
            Save Record & Evaluate WHO Standards
          </Button>
        </Card.Content>
      </Card>

      {loading ? (
        <ActivityIndicator size="small" color="#2E7D32" style={{ margin: 20 }} />
      ) : records.length > 0 ? (
        <>
          {/* Chart with WHO Curve Overlay */}
          <Card style={styles.card}>
            <Card.Title title="Growth Chart (Child vs WHO Benchmarks)" />
            <Card.Content>
              <LineChart
                data={chartData}
                width={Dimensions.get("window").width - 60}
                height={230}
                chartConfig={{
                  backgroundColor: "#ffffff",
                  backgroundGradientFrom: "#ffffff",
                  backgroundGradientTo: "#ffffff",
                  decimalPlaces: 1,
                  color: (opacity = 1) => `rgba(46, 125, 50, ${opacity})`,
                  labelColor: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
                  style: { borderRadius: 16 },
                  propsForDots: { r: "4", strokeWidth: "2", stroke: "#2E7D32" }
                }}
                bezier
                style={{ marginVertical: 8, borderRadius: 16 }}
              />
            </Card.Content>
          </Card>

          {/* History Table */}
          <Card style={styles.card}>
            <Card.Title title="WHO Growth History" />
            <Card.Content>
              <DataTable>
                <DataTable.Header>
                  <DataTable.Title>Date</DataTable.Title>
                  <DataTable.Title numeric>Ht (cm)</DataTable.Title>
                  <DataTable.Title numeric>Wt (kg)</DataTable.Title>
                  <DataTable.Title numeric>BMI</DataTable.Title>
                  <DataTable.Title numeric>WHO %ile</DataTable.Title>
                </DataTable.Header>

                {history.length > 0
                  ? history.slice().reverse().map((h) => (
                      <DataTable.Row key={h.record_id}>
                        <DataTable.Cell>{h.date}</DataTable.Cell>
                        <DataTable.Cell numeric>{h.child_height}</DataTable.Cell>
                        <DataTable.Cell numeric>{h.child_weight}</DataTable.Cell>
                        <DataTable.Cell numeric>{h.child_bmi}</DataTable.Cell>
                        <DataTable.Cell numeric>{h.who_percentile}%</DataTable.Cell>
                      </DataTable.Row>
                    ))
                  : records.slice().reverse().map((record) => (
                      <DataTable.Row key={record.record_id}>
                        <DataTable.Cell>{record.record_date}</DataTable.Cell>
                        <DataTable.Cell numeric>{record.height}</DataTable.Cell>
                        <DataTable.Cell numeric>{record.weight}</DataTable.Cell>
                        <DataTable.Cell numeric>{record.bmi}</DataTable.Cell>
                        <DataTable.Cell numeric>--</DataTable.Cell>
                      </DataTable.Row>
                    ))}
              </DataTable>
            </Card.Content>
          </Card>
        </>
      ) : (
        <View style={styles.center}>
          <Text style={styles.emptyText}>No growth records found. Log your first measurement above!</Text>
        </View>
      )}
      
      <View style={{ height: 40 }} /> 
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F5' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  emptyText: { fontSize: 16, color: '#666', textAlign: 'center', marginVertical: 20 },
  whoCard: {
    margin: 15,
    marginBottom: 0,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#81C784',
    borderRadius: 12
  },
  whoLogoBadge: {
    backgroundColor: '#2E7D32',
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center'
  },
  whoHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8
  },
  whoStatusPill: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 14
  },
  whoStatusText: {
    color: '#FFF',
    fontWeight: 'bold',
    fontSize: 13
  },
  whoPercentileText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333'
  },
  whoAdviceText: {
    fontSize: 13,
    color: '#444',
    lineHeight: 19,
    marginTop: 4
  },
  metricsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 4
  },
  metricBox: {
    flex: 1,
    backgroundColor: '#F9FBE7',
    padding: 10,
    borderRadius: 8,
    marginHorizontal: 3,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#DCEDC8'
  },
  metricLabel: {
    fontSize: 11,
    color: '#666',
    fontWeight: '600',
    textTransform: 'uppercase'
  },
  metricVal: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2E7D32',
    marginVertical: 2
  },
  metricWhoSub: {
    fontSize: 10,
    color: '#777'
  },
  whoRangeNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E3F2FD',
    padding: 8,
    borderRadius: 8,
    marginTop: 12
  },
  whoRangeNoticeText: {
    fontSize: 12,
    color: '#1565C0',
    marginLeft: 6,
    flex: 1
  },
  card: { margin: 15, backgroundColor: '#FFF', borderRadius: 10 },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  input: { marginBottom: 15 },
  button: { marginTop: 5, backgroundColor: '#2E7D32' }
});
