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
  const [activeReminderAlert, setActiveReminderAlert] = useState(null);

  // Animation for water bottle height
  const fillAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (activeChild) {
      fetchWaterStatus();
    }
  }, [activeChild]);

  // Periodic Reminder Timer when reminders are enabled
  useEffect(() => {
    let reminderTimer = null;
    if (reminderEnabled && activeChild) {
      const intervalMs = (parseFloat(reminderInterval) || 2) * 60 * 60 * 1000;
      reminderTimer = setInterval(() => {
        triggerHydrationReminder();
      }, intervalMs);
    }
    return () => {
      if (reminderTimer) clearInterval(reminderTimer);
    };
  }, [reminderEnabled, activeChild, reminderInterval]);

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

  // Play pleasant water notification chime on Web
  const playWaterChime = () => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (AudioContext) {
          const ctx = new AudioContext();
          const now = ctx.currentTime;
          
          const osc1 = ctx.createOscillator();
          const gain1 = ctx.createGain();
          osc1.type = 'sine';
          osc1.frequency.setValueAtTime(659.25, now);
          gain1.gain.setValueAtTime(0.2, now);
          gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
          osc1.connect(gain1);
          gain1.connect(ctx.destination);
          osc1.start(now);
          osc1.stop(now + 0.35);

          const osc2 = ctx.createOscillator();
          const gain2 = ctx.createGain();
          osc2.type = 'sine';
          osc2.frequency.setValueAtTime(987.77, now + 0.12);
          gain2.gain.setValueAtTime(0.25, now + 0.12);
          gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.55);
          osc2.connect(gain2);
          gain2.connect(ctx.destination);
          osc2.start(now + 0.12);
          osc2.stop(now + 0.55);
        }
      } catch (e) {
        console.log('Audio chime error', e);
      }
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

  const triggerHydrationReminder = (customMsg) => {
    const childName = activeChild?.name || 'your child';
    const title = `💧 Hydration Reminder: Time to Drink!`;
    const body =
      customMsg ||
      `Time for ${childName} to drink a glass of fresh water (150-250 ml). Keep up the hydration!`;

    // 1. Play audio chime
    playWaterChime();

    // 2. Display visible in-app reminder card in this section
    setActiveReminderAlert({
      title,
      body,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    });

    // 3. Trigger system / browser notification
    triggerWebNotification(title, body);

    // 4. Native device alert fallback
    if (Platform.OS !== 'web') {
      Alert.alert(title, body, [
        { text: 'Drink 1 Glass (+250 ml)', onPress: () => handleLogWater(250) },
        { text: 'Dismiss', style: 'cancel' },
      ]);
    }
  };

  const requestBrowserNotificationPermission = () => {
    if (Platform.OS === 'web' && typeof window !== 'undefined' && 'Notification' in window) {
      Notification.requestPermission().then((permission) => {
        if (permission === 'granted') {
          triggerHydrationReminder('🔔 Device notifications enabled! You will receive live water reminders here.');
        } else {
          Alert.alert('Permission Status', `Notification permission: ${permission}`);
        }
      });
    } else {
      triggerHydrationReminder();
    }
  };

  const handleToggleReminder = async (val) => {
    setReminderEnabled(val);
    if (!activeChild) return;
    try {
      await apiClient.post('/water/goal', {
        child_id: activeChild.child_id,
        daily_target_ml: parseInt(targetGoal, 10) || 1500,
        reminder_enabled: val,
        reminder_interval_hours: parseInt(reminderInterval, 10) || 2,
        start_time: '08:00',
        end_time: '20:00',
      });
      if (val) {
        triggerHydrationReminder(`Hydration reminders activated! We will notify you to give water to ${activeChild.name}.`);
      } else {
        setActiveReminderAlert(null);
      }
      await fetchWaterStatus();
    } catch (err) {
      console.log('Error updating reminder goal', err);
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
      <Card style={[styles.reminderBanner, activeReminderAlert && styles.activeReminderBorder]}>
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
            onValueChange={handleToggleReminder}
            color="#0288D1"
          />
        </Card.Content>

        {/* Action Controls for Reminders */}
        <View style={styles.reminderActionsRow}>
          <TouchableOpacity
            style={styles.testReminderBtn}
            onPress={() => triggerHydrationReminder()}
          >
            <Icon name="bell-ring" size={16} color="#0288D1" />
            <Text style={styles.testReminderBtnText}>🔔 Send Reminder Notification</Text>
          </TouchableOpacity>

          {Platform.OS === 'web' && (
            <TouchableOpacity
              style={styles.permissionBtn}
              onPress={requestBrowserNotificationPermission}
            >
              <Icon name="cellphone-sound" size={16} color="#2E7D32" />
              <Text style={styles.permissionBtnText}>Enable Device Alert</Text>
            </TouchableOpacity>
          )}
        </View>
      </Card>

      {/* ACTIVE NOTIFICATION POPUP CARD - Right in this part! */}
      {activeReminderAlert && (
        <Card style={styles.activeAlertCard}>
          <Card.Content style={styles.activeAlertContent}>
            <View style={styles.activeAlertHeader}>
              <View style={styles.alertBadge}>
                <Icon name="water-alert" size={18} color="#E65100" />
                <Text style={styles.alertBadgeText}>WATER REMINDER NOTIFICATION</Text>
              </View>
              <Text style={styles.alertTimeText}>{activeReminderAlert.timestamp}</Text>
            </View>

            <Text style={styles.alertTitleText}>{activeReminderAlert.title}</Text>
            <Text style={styles.alertBodyText}>{activeReminderAlert.body}</Text>

            <View style={styles.alertButtonRow}>
              <TouchableOpacity
                style={styles.drinkNowBtn}
                onPress={() => {
                  handleLogWater(250);
                  setActiveReminderAlert(null);
                }}
                disabled={logging}
              >
                <Icon name="cup-water" size={18} color="#FFF" style={{ marginRight: 6 }} />
                <Text style={styles.drinkNowBtnText}>Drink 1 Glass (+250 ml)</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.dismissAlertBtn}
                onPress={() => setActiveReminderAlert(null)}
              >
                <Text style={styles.dismissAlertBtnText}>Dismiss</Text>
              </TouchableOpacity>
            </View>
          </Card.Content>
        </Card>
      )}

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
  reminderActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingBottom: 12,
    gap: 8,
    flexWrap: 'wrap',
  },
  testReminderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#0288D1',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  testReminderBtnText: {
    fontSize: 12,
    color: '#0288D1',
    fontWeight: 'bold',
    marginLeft: 5,
  },
  permissionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F5E9',
    borderWidth: 1,
    borderColor: '#A5D6A7',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  permissionBtnText: {
    fontSize: 12,
    color: '#2E7D32',
    fontWeight: '600',
    marginLeft: 5,
  },
  activeReminderBorder: {
    borderColor: '#0288D1',
    borderWidth: 2,
  },
  activeAlertCard: {
    backgroundColor: '#FFF8E1',
    borderRadius: 14,
    borderColor: '#FFE082',
    borderWidth: 2,
    marginTop: 12,
    elevation: 4,
    shadowColor: '#FF6F00',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
  },
  activeAlertContent: {
    padding: 14,
  },
  activeAlertHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  alertBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFE0B2',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  alertBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#E65100',
    marginLeft: 4,
    letterSpacing: 0.5,
  },
  alertTimeText: {
    fontSize: 12,
    color: '#8D6E63',
    fontWeight: '600',
  },
  alertTitleText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#3E2723',
    marginBottom: 4,
  },
  alertBodyText: {
    fontSize: 13,
    color: '#5D4037',
    lineHeight: 18,
    marginBottom: 12,
  },
  alertButtonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  drinkNowBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0288D1',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    elevation: 2,
  },
  drinkNowBtnText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: 'bold',
  },
  dismissAlertBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#BCAAA4',
  },
  dismissAlertBtnText: {
    color: '#795548',
    fontSize: 13,
    fontWeight: '600',
  },
  logCard: { backgroundColor: '#FFFFFF', marginBottom: 8, borderRadius: 10 },
  logContent: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10 },
  logAmount: { fontSize: 16, fontWeight: 'bold', color: '#333' },
  logTime: { fontSize: 12, color: '#888' },
  emptyCard: { backgroundColor: '#FFFFFF', borderRadius: 10, padding: 10 },
});
