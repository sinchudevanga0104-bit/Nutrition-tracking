import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Animated,
  Easing,
  ScrollView,
  Alert
} from 'react-native';
import { Card, Button, Portal, Dialog, Chip } from 'react-native-paper';
import Icon from '@expo/vector-icons/MaterialCommunityIcons';
import apiClient from '../api/client';

const DEMO_BARCODES = [
  { label: '🥛 Cow Milk', code: '8901234567890' },
  { label: '🥣 Oats', code: '8901058000010' },
  { label: '🫓 Chapati', code: '8901030000011' },
  { label: '🍲 Yellow Dal', code: '8901000000001' },
  { label: '🍎 Apple', code: '8901000000002' },
  { label: '🍌 Banana', code: '8901000000003' },
];

export default function ScannerScreen({ navigation, route }) {
  const mealType = route?.params?.mealType || 'Meal';
  const onSelectFood = route?.params?.onSelectFood;

  const [scannedCode, setScannedCode] = useState('');
  const [inputCode, setInputCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [scannedItem, setScannedItem] = useState(null);
  const [dialogVisible, setDialogVisible] = useState(false);

  // Animated green scanning line
  const scanLineAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(scanLineAnim, {
          toValue: 200,
          duration: 2000,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
        Animated.timing(scanLineAnim, {
          toValue: 0,
          duration: 2000,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, [scanLineAnim]);

  const handleLookupBarcode = async (codeToLookup) => {
    const code = codeToLookup || inputCode || scannedCode;
    if (!code) {
      Alert.alert('Barcode Required', 'Please select or enter a barcode to scan.');
      return;
    }

    setLoading(true);
    setScannedCode(code);
    try {
      const response = await apiClient.get(`/meals/foods/barcode/${code}`);
      setScannedItem(response.data);
      setDialogVisible(true);
    } catch (error) {
      Alert.alert(
        'Product Not Found',
        `No food item registered for barcode: ${code}. Try selecting a demo item below.`,
        [{ text: 'OK' }]
      );
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmAdd = () => {
    setDialogVisible(false);
    if (scannedItem) {
      if (onSelectFood) {
        onSelectFood(scannedItem);
      }
      navigation.goBack();
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Top Header Card */}
      <View style={styles.headerBox}>
        <Icon name="qrcode-scan" size={32} color="#2E7D32" />
        <Text style={styles.title}>AI Food Barcode Scanner</Text>
        <Text style={styles.subtitle}>
          Scan packaged food barcodes or tap demo tags to auto-detect nutrition details.
        </Text>
      </View>

      {/* Camera Viewfinder Mockup */}
      <View style={styles.scannerViewport}>
        <View style={styles.cornerTopLeft} />
        <View style={styles.cornerTopRight} />
        <View style={styles.cornerBottomLeft} />
        <View style={styles.cornerBottomRight} />

        {/* Animated Scanning Line */}
        <Animated.View
          style={[
            styles.scanLine,
            {
              transform: [{ translateY: scanLineAnim }],
            },
          ]}
        />

        <View style={styles.viewfinderCenter}>
          <Icon name="camera-outline" size={48} color="rgba(255,255,255,0.7)" />
          <Text style={styles.scanInstruction}>
            {loading ? 'Scanning Barcode...' : 'Align Barcode inside frame'}
          </Text>
          {loading && <ActivityIndicator size="small" color="#4CAF50" style={{ marginTop: 8 }} />}
        </View>
      </View>

      {/* Manual Input / Barcode Trigger */}
      <Card style={styles.inputCard}>
        <Card.Content>
          <Text style={styles.sectionTitle}>Manual Barcode Lookup</Text>
          <View style={styles.inputRow}>
            <TextInput
              style={styles.textInput}
              placeholder="Enter Barcode (e.g. 8901234567890)"
              value={inputCode}
              onChangeText={setInputCode}
              keyboardType="number-pad"
            />
            <Button
              mode="contained"
              buttonColor="#2E7D32"
              onPress={() => handleLookupBarcode(inputCode)}
              loading={loading}
              disabled={loading}
            >
              Scan
            </Button>
          </View>
        </Card.Content>
      </Card>

      {/* Quick Demo Barcodes */}
      <View style={styles.demoSection}>
        <Text style={styles.sectionTitle}>⚡ College Demo Quick-Scan Items</Text>
        <Text style={styles.demoHint}>Tap any item below to simulate real-time barcode scanning:</Text>
        <View style={styles.chipContainer}>
          {DEMO_BARCODES.map((item) => (
            <Chip
              key={item.code}
              icon="barcode-scan"
              style={styles.chip}
              onPress={() => {
                setInputCode(item.code);
                handleLookupBarcode(item.code);
              }}
            >
              {item.label}
            </Chip>
          ))}
        </View>
      </View>

      {/* Scan Result Modal */}
      <Portal>
        <Dialog visible={dialogVisible} onDismiss={() => setDialogVisible(false)}>
          <Dialog.Title style={{ color: '#2E7D32', fontWeight: 'bold' }}>
            🎉 Food Detected!
          </Dialog.Title>
          <Dialog.Content>
            {scannedItem && (
              <View style={styles.resultBox}>
                <Text style={styles.foodName}>{scannedItem.food_name}</Text>
                <Text style={styles.foodCategory}>{scannedItem.category} • {scannedItem.serving_size}</Text>
                
                <View style={styles.statsGrid}>
                  <View style={styles.statBadge}>
                    <Text style={styles.statValue}>{scannedItem.calories}</Text>
                    <Text style={styles.statLabel}>Calories (kcal)</Text>
                  </View>
                  <View style={styles.statBadge}>
                    <Text style={styles.statValue}>{scannedItem.protein}g</Text>
                    <Text style={styles.statLabel}>Protein</Text>
                  </View>
                  <View style={styles.statBadge}>
                    <Text style={styles.statValue}>{scannedItem.carbohydrates}g</Text>
                    <Text style={styles.statLabel}>Carbs</Text>
                  </View>
                  <View style={styles.statBadge}>
                    <Text style={styles.statValue}>{scannedItem.fat}g</Text>
                    <Text style={styles.statLabel}>Fat</Text>
                  </View>
                </View>

                {scannedItem.barcode && (
                  <Text style={styles.barcodeText}>Barcode: {scannedItem.barcode}</Text>
                )}
              </View>
            )}
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setDialogVisible(false)}>Cancel</Button>
            <Button mode="contained" buttonColor="#2E7D32" onPress={handleConfirmAdd}>
              Select for {mealType}
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FA' },
  content: { padding: 16 },
  headerBox: {
    alignItems: 'center',
    marginBottom: 16,
    padding: 12,
    backgroundColor: '#E8F5E9',
    borderRadius: 12,
  },
  title: { fontSize: 20, fontWeight: 'bold', color: '#2E7D32', marginTop: 6 },
  subtitle: { fontSize: 13, color: '#455A64', textAlign: 'center', marginTop: 4 },
  scannerViewport: {
    height: 220,
    backgroundColor: '#1E1E1E',
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    overflow: 'hidden',
    marginBottom: 16,
  },
  scanLine: {
    position: 'absolute',
    left: 10,
    right: 10,
    top: 10,
    height: 3,
    backgroundColor: '#00E676',
    borderRadius: 2,
    shadowColor: '#00E676',
    shadowOpacity: 0.8,
    shadowRadius: 6,
  },
  viewfinderCenter: { alignItems: 'center' },
  scanInstruction: { color: '#FFFFFF', fontSize: 14, marginTop: 8, fontWeight: '500' },
  cornerTopLeft: { position: 'absolute', top: 12, left: 12, width: 24, height: 24, borderLeftWidth: 4, borderTopWidth: 4, borderColor: '#4CAF50' },
  cornerTopRight: { position: 'absolute', top: 12, right: 12, width: 24, height: 24, borderRightWidth: 4, borderTopWidth: 4, borderColor: '#4CAF50' },
  cornerBottomLeft: { position: 'absolute', bottom: 12, left: 12, width: 24, height: 24, borderLeftWidth: 4, borderBottomWidth: 4, borderColor: '#4CAF50' },
  cornerBottomRight: { position: 'absolute', bottom: 12, right: 12, width: 24, height: 24, borderRightWidth: 4, borderBottomWidth: 4, borderColor: '#4CAF50' },
  inputCard: { marginBottom: 16, borderRadius: 12, elevation: 2 },
  sectionTitle: { fontSize: 15, fontWeight: 'bold', color: '#1B5E20', marginBottom: 8 },
  inputRow: { flexDirection: 'row', alignItems: 'center' },
  textInput: {
    flex: 1,
    height: 44,
    borderWidth: 1,
    borderColor: '#CCC',
    borderRadius: 8,
    paddingHorizontal: 12,
    marginRight: 8,
    backgroundColor: '#FFF',
  },
  demoSection: { marginTop: 4 },
  demoHint: { fontSize: 12, color: '#666', marginBottom: 10 },
  chipContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { backgroundColor: '#E8F5E9', marginBottom: 6 },
  resultBox: { paddingVertical: 4 },
  foodName: { fontSize: 18, fontWeight: 'bold', color: '#2E7D32' },
  foodCategory: { fontSize: 13, color: '#666', marginBottom: 12 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 8 },
  statBadge: {
    width: '47%',
    backgroundColor: '#F1F8E9',
    padding: 10,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 6,
  },
  statValue: { fontSize: 16, fontWeight: 'bold', color: '#2E7D32' },
  statLabel: { fontSize: 11, color: '#555', marginTop: 2 },
  barcodeText: { fontSize: 11, color: '#999', marginTop: 8, textAlign: 'center' },
});
