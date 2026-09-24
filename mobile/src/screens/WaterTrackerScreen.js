import React, { useState, useEffect, useContext, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Animated,
  Platform,
  Alert,
} from 'react-native';
import { Card, Button, ProgressBar, Switch, TextInput, Dialog, Portal, Chip, Avatar } from 'react-native-paper';
import Icon from '@expo/vector-icons/MaterialCommunityIcons';
import { ChildContext } from '../context/ChildContext';
import apiClient, { formatApiError } from '../api/client';

export default function WaterTrackerScreen({ navigation }) {
  const { activeChild, isLoading: childLoading } = useContext(ChildContext);

  const [waterData, setWaterData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [logging, setLogging] = useState(false);
  const [customAmount, setCustomAmount] = useState('200');
  const [showCustomModal, setShowCustomModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);

  // Reminder settings form
  const [reminderEnabled, setReminderEnabled] = useState(true);
  const [reminderInterval, setReminderInterval] = useState('2');
  const [targetGoal, setTargetGoal] = useState('1500');

  // Animation for water bottle height
  const fillAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (activeChild) {
      fetchWaterStatus();
    }
  }, [activeChild]);

  useEffect(() => {
    if (waterData) {
      const targetPct = Math.min(waterData.percentage / 100, 1);
      Animated.timing(fillAnim, {
        toValue: targetPct,
        duration: 800,
        useNativeDriver: false,
      }).start();

      setReminderEnabled(waterData.reminder_enabled ?? true);
      setReminderInterval(String(waterData.reminder_interval_hours || 2));
      setTargetGoal(String(waterData.daily_target_ml || 1500));
    }
  }, [waterData]);

  const fetchWaterStatus = async () => {
    setLoading(true);
    try {
      const response = await apiClient.get(`/water/${activeChild.child_id}`);
      setWaterData(response.data);
    } catch (e) {
      console.log('Error fetching water status', e);
    } finally {
      setLoading(false);
    }
  };

  const triggerWebNotification = (title, body) => {
    if (Platform.OS === 'web' && typeof window !== 'undefined' && 'Notification' in window) {
      if (Notification.permission === 'granted') {
        new Notification(title, { body, icon: 'https://img.icons8.com/color/96/glass-of-water.png' });
      } else if (Notification.permission !== 'denied') {
        Notification.requestPermission().then((permission) => {
          if (permission === 'granted') {
            new Notification(title, { body });
          }
        });
      }
    }
  };

  const handleLogWater = async (amount) => {
    if (!activeChild || !amount) return;
    setLogging(true);

    try {
      await apiClient.post('/water/log', {
        child_id: activeChild.child_id,
        amount_ml: parseInt(amount, 10),
      });

      const updatedResp = await apiClient.get(`/water/${activeChild.child_id}`);
      const newData = updatedResp.data;
      setWaterData(newData);

      // Check if goal met with this sip
      if (newData.goal_achieved && !waterData?.goal_achieved) {
        triggerWebNotification(
          `🎉 Hydration Goal Achieved!`,
          `Awesome! ${activeChild.name} completed today's target of ${newData.daily_target_ml} ml!`
        );
        Alert.alert('🎉 Goal Achieved!', `Great job! ${activeChild.name} completed today's hydration target!`);
      } else {
        triggerWebNotification(
          `💧 Water Logged`,
          `Added ${amount} ml of water for ${activeChild.name}. Total: ${newData.total_intake_ml} / ${newData.daily_target_ml} ml`
        );
      }
    } catch (err) {
      Alert.alert('Error', formatApiError(err));
    } finally {
      setLogging(false);
      setShowCustomModal(false);
    }
  };

  const handleSaveSettings = async () => {
    if (!activeChild) return;
    try {
      await apiClient.post('/water/goal', {
        child_id: activeChild.child_id,
        daily_target_ml: parseInt(targetGoal, 10) || 1500,
        reminder_enabled: reminderEnabled,
        reminder_interval_hours: parseInt(reminderInterval, 10) || 2,
        start_time: '08:00',
        end_time: '20:00',
      });

      setShowSettingsModal(false);
      await fetchWaterStatus();

      if (reminderEnabled) {
        triggerWebNotification(
          `🔔 Water Reminders Enabled`,
          `Reminders scheduled every ${reminderInterval} hour(s) for ${activeChild.name}.`
        );
      }
    } catch (err) {
      Alert.alert('Settings Error', formatApiError(err));
    }
  };

  const handleDeleteLog = async (logId) => {
    try {
      await apiClient.delete(`/water/log/${logId}`);
      await fetchWaterStatus();
    } catch (e) {
      console.log('Error deleting log', e);
    }
  };

  if (childLoading || (loading && !waterData)) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#0288D1" />
      </View>
    );
  }

  if (!activeChild) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyText}>Please select a child profile to track water intake.</Text>
      </View>
    );
  }

  const currentMl = waterData?.total_intake_ml || 0;
  const targetMl = waterData?.daily_target_ml || 1500;
  const pct = waterData?.percentage || 0;
  const streak = waterData?.streak_days || 0;

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
      {/* Visual Water Bottle Card */}
      <Card style={styles.bottleCard}>
        <Card.Content style={styles.bottleCardContent}>
          <View style={styles.bottleHeaderRow}>
            <View style={styles.streakBadge}>
              <Icon name="fire" size={20} color="#FF9800" />
              <Text style={styles.streakText}>{streak} Day Streak!</Text>
            </View>
            <TouchableOpacity onPress={() => setShowSettingsModal(true)} style={styles.settingsButton}>
              <Icon name="cog-outline" size={24} color="#0288D1" />
            </TouchableOpacity>
          </View>

          {/* Visual Tank Gauge */}
          <View style={styles.gaugeContainer}>
            <View style={styles.outerBottle}>
              <Animated.View
                style={[
                  styles.innerWaterFill,
                  {
                    height: fillAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: ['0%', '100%'],
                    }),
                  },
                ]}
              />
              <View style={styles.gaugeOverlayTextContainer}>
                <Icon name="water" size={42} color={pct > 50 ? '#FFF' : '#0288D1'} />
                <Text style={[styles.pctText, { color: pct > 50 ? '#FFF' : '#0288D1' }]}>{pct}%</Text>
              </View>
            </View>

            <View style={styles.gaugeDetails}>
              <Text style={styles.childNameTitle}>{activeChild.name}'s Water Goal</Text>
              <Text style={styles.intakeNumbers}>
                <Text style={styles.currentMlText}>{currentMl}</Text> / {targetMl} ml
              </Text>
              <ProgressBar progress={Math.min(pct / 100, 1)} color="#0288D1" style={styles.progressBar} />
              <Text style={styles.subHint}>
                {waterData?.goal_achieved
                  ? '🎉 Daily goal met! Keep it up!'
                  : `${targetMl - currentMl} ml remaining today`}
              </Text>
            </View>
          </View>
        </Card.Content>
      </Card>

      {/* Quick Hydrate Buttons */}
      <Text style={styles.sectionTitle}>Quick Hydrate</Text>
      <View style={styles.quickAddRow}>
        <TouchableOpacity
          style={styles.quickAddCard}
          onPress={() => handleLogWater(150)}
          disabled={logging}
        >
          <Icon name="cup-water" size={32} color="#0288D1" />
          <Text style={styles.quickAddLabel}>+150 ml</Text>
          <Text style={styles.quickAddSub}>Small Glass</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.quickAddCard}
          onPress={() => handleLogWater(250)}
          disabled={logging}
        >
          <Icon name="glass-mug-variant" size={32} color="#0288D1" />
          <Text style={styles.quickAddLabel}>+250 ml</Text>
          <Text style={styles.quickAddSub}>Cup / Glass</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.quickAddCard}
          onPress={() => handleLogWater(500)}
          disabled={logging}
        >
          <Icon name="bottle-wine-outline" size={32} color="#0288D1" />
          <Text style={styles.quickAddLabel}>+500 ml</Text>
          <Text style={styles.quickAddSub}>Water Bottle</Text>
        </TouchableOpacity>
      </View>

      <Button
        mode="outlined"
        icon="plus-circle-outline"
        textColor="#0288D1"
        style={styles.customAddBtn}
        onPress={() => setShowCustomModal(true)}
      >
        Custom Water Amount
      </Button>

      {/* Reminder Notification Banner */}
      <Card style={styles.reminderBanner}>
        <Card.Content style={styles.reminderContent}>
          <Icon name="bell-ring-outline" size={28} color="#0288D1" style={{ marginRight: 12 }} />
          <View style={{ flex: 1 }}>
            <Text style={styles.reminderTitle}>Hydration Reminders</Text>
            <Text style={styles.reminderSub}>
              {reminderEnabled
                ? `Active every ${reminderInterval} hour(s) (8 AM - 8 PM)`
                : 'Reminders are currently paused'}
            </Text>
          </View>
          <Switch
            value={reminderEnabled}
            onValueChange={(val) => {
              setReminderEnabled(val);
              handleSaveSettings();
            }}
            color="#0288D1"
          />
        </Card.Content>
      </Card>

      {/* Today's Water Logs */}
      <Text style={[styles.sectionTitle, { marginTop: 20 }]}>Today's Water Log</Text>
      {waterData?.logs && waterData.logs.length > 0 ? (
        waterData.logs.map((log) => (
          <Card key={log.log_id} style={styles.logCard}>
            <Card.Content style={styles.logContent}>
              <Icon name="water-check" size={24} color="#0288D1" />
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={styles.logAmount}>+{log.amount_ml} ml</Text>
                <Text style={styles.logTime}>
                  {log.created_at ? new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Today'}
                </Text>
              </View>
              <TouchableOpacity onPress={() => handleDeleteLog(log.log_id)}>
                <Icon name="trash-can-outline" size={20} color="#D32F2F" />
              </TouchableOpacity>
            </Card.Content>
          </Card>
        ))
      ) : (
        <Card style={styles.emptyCard}>
          <Card.Content>
            <Text style={styles.emptyText}>No water logged yet today. Tap a quick add button above!</Text>
          </Card.Content>
        </Card>
      )}

      {/* Custom Amount Modal */}
      <Portal>
        <Dialog visible={showCustomModal} onDismiss={() => setShowCustomModal(false)}>
          <Dialog.Title>Log Custom Water Intake</Dialog.Title>
          <Dialog.Content>
            <TextInput
              label="Water Amount (ml)"
              value={customAmount}
              onChangeText={setCustomAmount}
              keyboardType="numeric"
              mode="outlined"
            />
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setShowCustomModal(false)}>Cancel</Button>
            <Button onPress={() => handleLogWater(customAmount)} loading={logging}>
              Add Water
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      {/* Settings & Reminder Modal */}
      <Portal>
        <Dialog visible={showSettingsModal} onDismiss={() => setShowSettingsModal(false)}>
          <Dialog.Title>Water & Reminder Settings</Dialog.Title>
          <Dialog.Content>
            <TextInput
              label="Daily Target (ml)"
              value={targetGoal}
              onChangeText={setTargetGoal}
              keyboardType="numeric"
              mode="outlined"
              style={{ marginBottom: 12 }}
            />
            <TextInput
              label="Reminder Interval (Hours)"
              value={reminderInterval}
              onChangeText={setReminderInterval}
              keyboardType="numeric"
              mode="outlined"
              style={{ marginBottom: 12 }}
            />
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text style={{ fontSize: 15, color: '#333' }}>Enable Reminders</Text>
              <Switch
                value={reminderEnabled}
                onValueChange={setReminderEnabled}
                color="#0288D1"
              />
            </View>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setShowSettingsModal(false)}>Cancel</Button>
            <Button onPress={handleSaveSettings}>Save Settings</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F4F7F9', padding: 15 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  emptyText: { color: '#666', fontStyle: 'italic', textAlign: 'center' },
  bottleCard: { backgroundColor: '#FFFFFF', borderRadius: 16, marginBottom: 20, elevation: 2 },
  bottleCardContent: { padding: 16 },
  bottleHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
  streakBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF3E0',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#FFE0B2',
  },
  streakText: { color: '#E65100', fontWeight: 'bold', fontSize: 13, marginLeft: 4 },
  settingsButton: { padding: 4 },
  gaugeContainer: { flexDirection: 'row', alignItems: 'center' },
  outerBottle: {
    width: 90,
    height: 140,
    borderRadius: 45,
    borderWidth: 3,
    borderColor: '#0288D1',
    backgroundColor: '#E1F5FE',
    overflow: 'hidden',
    justifyContent: 'flex-end',
    alignItems: 'center',
    position: 'relative',
  },
  innerWaterFill: {
    width: '100%',
    backgroundColor: '#0288D1',
    position: 'absolute',
    bottom: 0,
  },
  gaugeOverlayTextContainer: {
    position: 'absolute',
    top: 35,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pctText: { fontSize: 16, fontWeight: 'bold', marginTop: 2 },
  gaugeDetails: { flex: 1, marginLeft: 20 },
  childNameTitle: { fontSize: 16, fontWeight: 'bold', color: '#333' },
  intakeNumbers: { fontSize: 22, fontWeight: 'bold', color: '#666', marginVertical: 6 },
  currentMlText: { fontSize: 28, color: '#0288D1' },
  progressBar: { height: 10, borderRadius: 5, marginVertical: 6 },
  subHint: { fontSize: 12, color: '#0288D1', fontWeight: '500' },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', color: '#333', marginBottom: 10 },
  quickAddRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  quickAddCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    marginHorizontal: 4,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    elevation: 1,
  },
  quickAddLabel: { fontSize: 15, fontWeight: 'bold', color: '#0288D1', marginTop: 6 },
  quickAddSub: { fontSize: 11, color: '#888', marginTop: 2 },
  customAddBtn: { borderRadius: 10, marginBottom: 20 },
  reminderBanner: { backgroundColor: '#E1F5FE', borderRadius: 12, borderColor: '#B3E5FC', borderWidth: 1 },
  reminderContent: { flexDirection: 'row', alignItems: 'center', padding: 12 },
  reminderTitle: { fontSize: 15, fontWeight: 'bold', color: '#01579B' },
  reminderSub: { fontSize: 12, color: '#0288D1', marginTop: 2 },
  logCard: { backgroundColor: '#FFFFFF', marginBottom: 8, borderRadius: 10 },
  logContent: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10 },
  logAmount: { fontSize: 16, fontWeight: 'bold', color: '#333' },
  logTime: { fontSize: 12, color: '#888' },
  emptyCard: { backgroundColor: '#FFFFFF', borderRadius: 10, padding: 10 },
});
