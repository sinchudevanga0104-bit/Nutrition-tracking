import React, { useState, useEffect, useRef, useContext } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Animated,
  Easing,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { Card, Button, Avatar, Chip, IconButton } from 'react-native-paper';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import * as Speech from 'expo-speech';
import { ChildContext } from '../context/ChildContext';
import apiClient, { formatApiError } from '../api/client';

// Safely require expo-audio so runtime never crashes if native module is absent
let ExpoAudio = null;
try {
  ExpoAudio = require('expo-audio');
} catch (e) {
  console.log('[VoiceAssistant] expo-audio not loaded:', e.message);
}

export default function VoiceAssistantScreen({ navigation }) {
  const { activeChild } = useContext(ChildContext);
  const [queryText, setQueryText] = useState('');
  const [messages, setMessages] = useState([]);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [loading, setLoading] = useState(false);
  const [speechEnabled, setSpeechEnabled] = useState(true);
  const [loggingSuccessId, setLoggingSuccessId] = useState(null);

  const inputRef = useRef(null);
  const scrollViewRef = useRef();
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const barAnim1 = useRef(new Animated.Value(0.4)).current;
  const barAnim2 = useRef(new Animated.Value(0.8)).current;
  const barAnim3 = useRef(new Animated.Value(0.5)).current;
  const barAnim4 = useRef(new Animated.Value(0.9)).current;
  const recognitionRef = useRef(null);
  const recordingRef = useRef(null);
  const autoStopTimerRef = useRef(null);

  // Initial welcome message
  useEffect(() => {
    const childName = activeChild ? activeChild.name : 'your child';
    setMessages([
      {
        id: '1',
        sender: 'ai',
        text: `Hi! I'm **NutriVoice AI**. Ask me to log ${childName}'s meals, check daily nutrition, or suggest healthy toddler recipes! 🎙️`,
        speechText: `Hi! I'm NutriVoice AI. Ask me to log ${childName}'s meals or suggest healthy recipes!`,
        actionType: 'GENERAL_AI',
        suggestions: [
          `Log 2 idlis for ${childName} for breakfast`,
          `Suggest iron-rich dinner recipes`,
          `How is ${childName}'s nutrition today?`,
        ],
      },
    ]);
  }, [activeChild]);

  // Pulse & Soundwave animations
  useEffect(() => {
    let loop;
    if (isListening || isSpeaking || loading) {
      loop = Animated.loop(
        Animated.parallel([
          Animated.sequence([
            Animated.timing(pulseAnim, {
              toValue: 1.25,
              duration: 700,
              easing: Easing.inOut(Easing.ease),
              useNativeDriver: true,
            }),
            Animated.timing(pulseAnim, {
              toValue: 1,
              duration: 700,
              easing: Easing.inOut(Easing.ease),
              useNativeDriver: true,
            }),
          ]),
          Animated.sequence([
            Animated.timing(barAnim1, { toValue: 1, duration: 400, useNativeDriver: true }),
            Animated.timing(barAnim1, { toValue: 0.3, duration: 400, useNativeDriver: true }),
          ]),
          Animated.sequence([
            Animated.timing(barAnim2, { toValue: 0.3, duration: 500, useNativeDriver: true }),
            Animated.timing(barAnim2, { toValue: 1, duration: 500, useNativeDriver: true }),
          ]),
          Animated.sequence([
            Animated.timing(barAnim3, { toValue: 1, duration: 350, useNativeDriver: true }),
            Animated.timing(barAnim3, { toValue: 0.2, duration: 350, useNativeDriver: true }),
          ]),
        ])
      );
      loop.start();
    } else {
      pulseAnim.setValue(1);
    }
    return () => loop && loop.stop();
  }, [isListening, isSpeaking, loading]);

  // Cleanup recognition and audio recording on unmount
  useEffect(() => {
    return () => {
      if (autoStopTimerRef.current) {
        clearTimeout(autoStopTimerRef.current);
      }
      if (recordingRef.current) {
        try {
          if (typeof recordingRef.current.stop === 'function') {
            recordingRef.current.stop();
          }
        } catch (e) {}
      }
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch (e) {}
      }
      if (Platform.OS === 'web' && typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      } else {
        Speech.stop();
      }
    };
  }, []);

  const speakText = async (text) => {
    if (!speechEnabled || !text) return;
    const cleanText = text.replace(/[*#_`]/g, '');

    // Reset audio session category to playback so speech plays out loud from speaker on iOS
    if (ExpoAudio && typeof ExpoAudio.setAudioModeAsync === 'function') {
      try {
        await ExpoAudio.setAudioModeAsync({
          allowsRecording: false,
          playsInSilentMode: true,
        });
      } catch (e) {}
    }

    if (Platform.OS === 'web' && typeof window !== 'undefined' && window.speechSynthesis) {
      try {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(cleanText);
        utterance.rate = 1.0;
        utterance.pitch = 1.0;
        utterance.lang = 'en-US';

        const voices = window.speechSynthesis.getVoices();
        if (voices.length > 0) {
          const enVoice = voices.find((v) => v.lang.startsWith('en') && !v.name.includes('Bad'));
          if (enVoice) utterance.voice = enVoice;
        }

        utterance.onstart = () => setIsSpeaking(true);
        utterance.onend = () => setIsSpeaking(false);
        utterance.onerror = () => setIsSpeaking(false);

        if (window.speechSynthesis.paused) {
          window.speechSynthesis.resume();
        }
        window.speechSynthesis.speak(utterance);
      } catch (e) {
        console.warn('Speech synthesis error:', e);
        setIsSpeaking(false);
      }
    } else {
      // Mobile iOS/Android using expo-speech
      try {
        setIsSpeaking(true);
        Speech.stop();
        Speech.speak(cleanText, {
          language: 'en-US',
          rate: 1.0,
          onStart: () => setIsSpeaking(true),
          onDone: () => setIsSpeaking(false),
          onStopped: () => setIsSpeaking(false),
          onError: () => setIsSpeaking(false),
        });
      } catch (e) {
        console.warn('expo-speech error:', e);
        setIsSpeaking(false);
      }
    }
  };

  // -------------------------------------------------------------
  // Native Audio Recording via expo-audio (Expo SDK 55+)
  // -------------------------------------------------------------
  const startAudioRecording = async () => {
    try {
      const hasAudioRecorder = ExpoAudio && ExpoAudio.AudioModule && typeof ExpoAudio.AudioModule.AudioRecorder === 'function';

      if (hasAudioRecorder) {
        // Request mic permission
        if (typeof ExpoAudio.requestRecordingPermissionsAsync === 'function') {
          const perm = await ExpoAudio.requestRecordingPermissionsAsync();
          if (!perm.granted) {
            Alert.alert(
              'Microphone Permission Needed',
              'Please allow microphone permission so NutriVoice can hear your meal logs.'
            );
            return;
          }
        }

        if (typeof ExpoAudio.setAudioModeAsync === 'function') {
          await ExpoAudio.setAudioModeAsync({
            allowsRecording: true,
            playsInSilentMode: true,
          });
        }

        const options = ExpoAudio.RecordingPresets?.HIGH_QUALITY || {};
        const newRecording = new ExpoAudio.AudioModule.AudioRecorder(options);
        if (typeof newRecording.prepareToRecordAsync === 'function') {
          await newRecording.prepareToRecordAsync();
        }
        newRecording.record();
        recordingRef.current = newRecording;
        setIsListening(true);

        // Auto-stop recording after 10 seconds if user forgets to tap stop
        if (autoStopTimerRef.current) clearTimeout(autoStopTimerRef.current);
        autoStopTimerRef.current = setTimeout(() => {
          stopAudioRecording();
        }, 10000);
      } else {
        // Fallback for environments without native audio recorder
        Alert.alert(
          '🎙️ Dictate Meal by Voice',
          'Tap the microphone icon on your keyboard (next to the spacebar) to dictate your meal or question, then tap Send!'
        );
        inputRef.current?.focus();
      }
    } catch (err) {
      console.error('[VoiceAssistant] Start recording error:', err);
      Alert.alert(
        '🎙️ Dictate Meal by Voice',
        'Tap the microphone icon on your keyboard (next to the spacebar) to speak your meal, then tap Send!'
      );
      setIsListening(false);
      inputRef.current?.focus();
    }
  };

  const stopAudioRecording = async () => {
    if (autoStopTimerRef.current) {
      clearTimeout(autoStopTimerRef.current);
      autoStopTimerRef.current = null;
    }

    const rec = recordingRef.current;
    recordingRef.current = null;
    setIsListening(false);

    if (!rec) return;

    setLoading(true);

    try {
      if (typeof rec.stop === 'function') {
        await rec.stop();
      }
      const uri = rec.uri;
      console.log('[VoiceAssistant] Recorded voice file URI:', uri);

      // Re-enable playback audio mode so speaker output is loud and clear
      if (ExpoAudio && typeof ExpoAudio.setAudioModeAsync === 'function') {
        try {
          await ExpoAudio.setAudioModeAsync({
            allowsRecording: false,
            playsInSilentMode: true,
          });
        } catch (e) {}
      }

      if (!uri) {
        setLoading(false);
        return;
      }

      // Create multipart FormData for voice query
      const formData = new FormData();
      const filename = uri.split('/').pop() || 'voice.wav';
      const fileType = filename.endsWith('.m4a') ? 'audio/m4a' : 'audio/wav';

      formData.append('audio', {
        uri: Platform.OS === 'ios' ? uri.replace('file://', '') : uri,
        name: filename,
        type: fileType,
      });

      if (activeChild?.child_id) {
        formData.append('child_id', String(activeChild.child_id));
      }

      const response = await apiClient.post('/voice/audio-query', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        timeout: 30000,
      });

      const data = response.data;

      // Add user message to chat stream
      if (data.transcribed_text && !data.transcribed_text.includes('(No speech detected)')) {
        const userMsg = {
          id: Date.now().toString(),
          sender: 'user',
          text: data.transcribed_text,
        };
        setMessages((prev) => [...prev, userMsg]);
      }

      // Add AI response to chat stream
      const aiMsg = {
        id: (Date.now() + 1).toString(),
        sender: 'ai',
        text: data.response_text,
        speechText: data.speech_text,
        actionType: data.action_type,
        actionData: data.action_data,
        suggestions: data.suggestions || [],
      };
      setMessages((prev) => [...prev, aiMsg]);

      // Speak response back to user
      speakText(data.speech_text || data.response_text);
    } catch (err) {
      console.error('[VoiceAssistant] Voice query upload error:', err);
      const errorMsg = {
        id: (Date.now() + 1).toString(),
        sender: 'ai',
        text: `Sorry, I had trouble processing your voice message. (${formatApiError(err)})`,
        speechText: 'Sorry, I had trouble processing your voice message.',
        actionType: 'GENERAL_AI',
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setLoading(false);
      setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 100);
    }
  };

  // -------------------------------------------------------------
  // Web Speech Recognition Fallback (Chrome / Edge on Desktop)
  // -------------------------------------------------------------
  const stopWebListening = () => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch (e) {}
      recognitionRef.current = null;
    }
    setIsListening(false);
  };

  const startWebListening = async () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      Alert.alert(
        'Microphone Not Supported',
        'Your web browser does not support Speech Recognition. Please use Google Chrome or type your message below.'
      );
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = 'en-IN';

      let captured = '';

      recognition.onstart = () => setIsListening(true);
      recognition.onresult = (e) => {
        let interim = '';
        for (let i = e.resultIndex; i < e.results.length; ++i) {
          if (e.results[i].isFinal) captured += e.results[i][0].transcript;
          else interim += e.results[i][0].transcript;
        }
        if (captured || interim) setQueryText(captured || interim);
      };
      recognition.onerror = () => setIsListening(false);
      recognition.onend = () => {
        setIsListening(false);
        recognitionRef.current = null;
        if (captured.trim()) handleSendQuery(captured.trim());
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err) {
      console.error('Web speech start error:', err);
      setIsListening(false);
    }
  };

  const toggleListening = () => {
    // If text is already typed/dictated in input, tapping sends it immediately
    if (queryText.trim().length > 0) {
      handleSendQuery(queryText.trim());
      return;
    }

    if (Platform.OS === 'web') {
      if (isListening) stopWebListening();
      else startWebListening();
    } else {
      // Native iOS & Android
      if (isListening || recordingRef.current) {
        stopAudioRecording();
      } else {
        startAudioRecording();
      }
    }
  };

  const handleSendQuery = async (overrideText) => {
    const textToSend = overrideText || queryText;
    if (!textToSend.trim()) return;

    const userMsg = {
      id: Date.now().toString(),
      sender: 'user',
      text: textToSend,
    };

    setMessages((prev) => [...prev, userMsg]);
    setQueryText('');
    setLoading(true);

    try {
      const response = await apiClient.post('/voice/assistant', {
        query: textToSend,
        child_id: activeChild?.child_id,
      });

      const aiMsg = {
        id: (Date.now() + 1).toString(),
        sender: 'ai',
        text: response.data.response_text,
        speechText: response.data.speech_text,
        actionType: response.data.action_type,
        actionData: response.data.action_data,
        suggestions: response.data.suggestions || [],
      };

      setMessages((prev) => [...prev, aiMsg]);
      speakText(response.data.speech_text || response.data.response_text);
    } catch (err) {
      console.log('Voice API Error:', err);
      const errorMsg = {
        id: (Date.now() + 1).toString(),
        sender: 'ai',
        text: `Sorry, I had trouble processing that voice request. (${formatApiError(err)})`,
        speechText: "Sorry, I had trouble processing that request.",
        actionType: 'GENERAL_AI',
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setLoading(false);
      setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 100);
    }
  };

  const handleConfirmLogMeal = async (actionData, msgId) => {
    if (!actionData) return;
    try {
      const today = new Date();
      const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
      const childId = actionData.child_id || activeChild?.child_id;

      if (!childId) {
        Alert.alert('No Child Selected', 'Please select a child profile first.');
        return;
      }

      // Normalize meal type (e.g., Snack -> Snacks)
      let mealType = actionData.meal_type || 'Breakfast';
      if (mealType.toLowerCase() === 'snack') {
        mealType = 'Snacks';
      } else {
        mealType = mealType.charAt(0).toUpperCase() + mealType.slice(1).toLowerCase();
        if (mealType === 'Snack') mealType = 'Snacks';
      }

      // 1. Create or fetch meal for today & meal_type
      const mealResp = await apiClient.post('/meals/', {
        child_id: childId,
        meal_type: mealType,
        meal_date: todayStr,
      });

      const mealId = mealResp.data.meal_id;

      // 2. Add meal item
      await apiClient.post(`/meals/${mealId}/items`, {
        food_id: actionData.food_id || 1,
        quantity: parseFloat(actionData.quantity) || 1.0,
      });

      setLoggingSuccessId(msgId);
      speakText(`Successfully logged ${actionData.food_name} into ${mealType}!`);
      Alert.alert('Meal Logged! 🎉', `${actionData.food_name} has been added to today's ${mealType}.`);
    } catch (err) {
      console.log('Error logging meal via voice', err);
      Alert.alert('Logging Failed', formatApiError(err));
    }
  };

  return (
    <View style={styles.container}>
      {/* Visualizer Header */}
      <View style={styles.visualizerHeader}>
        <Animated.View style={[
          styles.micPulseCircle,
          { transform: [{ scale: pulseAnim }] },
          isListening && styles.micPulseCircleRecording,
        ]}>
          <TouchableOpacity
            onPress={toggleListening}
            style={[styles.micButtonCircle, isListening && styles.micButtonCircleRecording]}
          >
            <Icon
              name={isListening ? 'stop' : isSpeaking ? 'volume-high' : 'microphone'}
              size={36}
              color="#FFF"
            />
          </TouchableOpacity>
        </Animated.View>

        {/* Dynamic Soundwaves */}
        <View style={styles.soundwaveContainer}>
          <Animated.View style={[styles.soundwaveBar, { transform: [{ scaleY: barAnim1 }] }, isListening && styles.soundwaveBarRecording]} />
          <Animated.View style={[styles.soundwaveBar, { transform: [{ scaleY: barAnim2 }] }, isListening && styles.soundwaveBarRecording]} />
          <Animated.View style={[styles.soundwaveBar, { transform: [{ scaleY: barAnim3 }] }, isListening && styles.soundwaveBarRecording]} />
          <Animated.View style={[styles.soundwaveBar, { transform: [{ scaleY: barAnim4 }] }, isListening && styles.soundwaveBarRecording]} />
        </View>

        <Text style={[styles.statusText, isListening && { color: '#D32F2F', fontWeight: 'bold' }]}>
          {isListening
            ? '🔴 Recording voice... Tap Mic to Send!'
            : loading
            ? '🧠 Transcribing & Processing...'
            : isSpeaking
            ? '🔊 Speaking response...'
            : 'Tap Mic to Speak or Type below'}
        </Text>

        <TouchableOpacity style={styles.ttsToggle} onPress={() => setSpeechEnabled(!speechEnabled)}>
          <Icon name={speechEnabled ? 'volume-high' : 'volume-off'} size={20} color="#666" />
          <Text style={styles.ttsToggleText}>{speechEnabled ? 'Voice ON' : 'Muted'}</Text>
        </TouchableOpacity>
      </View>

      {/* Messages Stream */}
      <ScrollView
        ref={scrollViewRef}
        style={styles.chatStream}
        contentContainerStyle={{ paddingVertical: 15 }}
        onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: true })}
      >
        {messages.map((msg) => (
          <View key={msg.id} style={styles.messageRow}>
            {msg.sender === 'user' ? (
              <View style={styles.userBubble}>
                <Text style={styles.userText}>{msg.text}</Text>
              </View>
            ) : (
              <View style={styles.aiMessageWrapper}>
                <View style={styles.aiBubbleHeader}>
                  <Avatar.Icon size={28} icon="robot" style={{ backgroundColor: '#2E7D32' }} color="#FFF" />
                  <Text style={styles.aiSenderLabel}>NutriVoice AI</Text>
                  <TouchableOpacity onPress={() => speakText(msg.speechText || msg.text)} style={styles.replayButton}>
                    <Icon name="volume-high" size={18} color="#2E7D32" />
                  </TouchableOpacity>
                </View>

                <Card style={styles.aiCard}>
                  <Card.Content>
                    <Text style={styles.aiText}>{msg.text.replace(/\*\*/g, '')}</Text>

                    {/* ACTION CARD: LOG MEAL */}
                    {msg.actionType === 'LOG_MEAL' && msg.actionData && (
                      <View style={styles.actionCardContainer}>
                        <View style={styles.actionHeader}>
                          <Icon name="food-apple" size={24} color="#E65100" />
                          <Text style={styles.actionTitle}>Voice Meal Action Card</Text>
                        </View>
                        <View style={styles.actionDetails}>
                          <Text style={styles.foodItemName}>
                            {msg.actionData.quantity}x {msg.actionData.food_name}
                          </Text>
                          <Text style={styles.foodItemSub}>
                            Meal: <Text style={{ fontWeight: 'bold' }}>{msg.actionData.meal_type}</Text> | Calories: ~
                            {msg.actionData.calories?.toFixed(0)} kcal | Protein: {msg.actionData.protein?.toFixed(1)}g
                          </Text>
                        </View>

                        {msg.actionData.saved || loggingSuccessId === msg.id ? (
                          <View style={{ marginTop: 8 }}>
                            <View style={styles.loggedSuccessBadge}>
                              <Icon name="check-circle" size={20} color="#2E7D32" />
                              <Text style={styles.loggedSuccessText}>Saved to {msg.actionData.meal_type} Log!</Text>
                            </View>
                            <Button
                              mode="outlined"
                              icon="chart-bar"
                              textColor="#2E7D32"
                              style={{ marginTop: 8 }}
                              onPress={() => navigation.navigate('Nutrition')}
                            >
                              View in Nutrition Log
                            </Button>
                          </View>
                        ) : (
                          <Button
                            mode="contained"
                            buttonColor="#2E7D32"
                            icon="check-bold"
                            style={styles.confirmActionButton}
                            onPress={() => handleConfirmLogMeal(msg.actionData, msg.id)}
                          >
                            Confirm & Save Meal
                          </Button>
                        )}
                      </View>
                    )}

                    {/* ACTION CARD: WATER TRACK */}
                    {msg.actionType === 'WATER_TRACK' && msg.actionData && (
                      <View style={[styles.actionCardContainer, { backgroundColor: '#E1F5FE', borderColor: '#81D4FA' }]}>
                        <View style={styles.actionHeader}>
                          <Icon name="water" size={24} color="#0288D1" />
                          <Text style={[styles.actionTitle, { color: '#0277BD' }]}>Water Intake Logged</Text>
                        </View>
                        <View style={styles.actionDetails}>
                          <Text style={styles.foodItemName}>
                            +{msg.actionData.amount_ml} ml Water Logged
                          </Text>
                          <Text style={styles.foodItemSub}>
                            Today's Intake: <Text style={{ fontWeight: 'bold' }}>{msg.actionData.total_today} ml</Text>
                          </Text>
                        </View>
                        <Button
                          mode="outlined"
                          icon="cup-water"
                          textColor="#0277BD"
                          style={{ marginTop: 8 }}
                          onPress={() => navigation.navigate('Water Tracker')}
                        >
                          Open Water Tracker
                        </Button>
                      </View>
                    )}

                    {/* ACTION CARD: NAVIGATE */}
                    {msg.actionType === 'NAVIGATE' && msg.actionData?.screen && (
                      <View style={[styles.actionCardContainer, { backgroundColor: '#EDE7F6', borderColor: '#D1C4E9' }]}>
                        <View style={styles.actionHeader}>
                          <Icon name="compass" size={24} color="#673AB7" />
                          <Text style={[styles.actionTitle, { color: '#512DA8' }]}>Voice Navigation</Text>
                        </View>
                        <View style={styles.actionDetails}>
                          <Text style={styles.foodItemName}>
                            {msg.actionData.title || msg.actionData.screen}
                          </Text>
                        </View>
                        <Button
                          mode="contained"
                          buttonColor="#673AB7"
                          icon="arrow-right-bold"
                          style={{ marginTop: 8 }}
                          onPress={() => navigation.navigate(msg.actionData.screen)}
                        >
                          Open {msg.actionData.screen}
                        </Button>
                      </View>
                    )}

                    {/* ACTION CARD: GROWTH LOGGED */}
                    {msg.actionType === 'GROWTH_LOGGED' && msg.actionData && (
                      <View style={[styles.actionCardContainer, { backgroundColor: '#E8F5E9', borderColor: '#A5D6A7' }]}>
                        <View style={styles.actionHeader}>
                          <Icon name="chart-line" size={24} color="#2E7D32" />
                          <Text style={[styles.actionTitle, { color: '#2E7D32' }]}>Growth Metric Logged</Text>
                        </View>
                        <View style={styles.actionDetails}>
                          <Text style={styles.foodItemName}>
                            {msg.actionData.weight} kg • {msg.actionData.height} cm
                          </Text>
                          <Text style={styles.foodItemSub}>
                            BMI: <Text style={{ fontWeight: 'bold' }}>{msg.actionData.bmi}</Text> (Optimal)
                          </Text>
                        </View>
                        <Button
                          mode="outlined"
                          icon="chart-line"
                          textColor="#2E7D32"
                          style={{ marginTop: 8 }}
                          onPress={() => navigation.navigate('Growth')}
                        >
                          Open Growth Chart
                        </Button>
                      </View>
                    )}

                    {/* ACTION CARD: RECOMMENDATIONS */}
                    {msg.actionType === 'RECOMMENDATION' && (
                      <Button
                        mode="outlined"
                        icon="lightbulb-on"
                        textColor="#2E7D32"
                        style={{ marginTop: 10 }}
                        onPress={() => navigation.navigate('Recommendations')}
                      >
                        Explore Full AI Recipes
                      </Button>
                    )}
                  </Card.Content>
                </Card>

                {/* Suggestions Chips */}
                {msg.suggestions && msg.suggestions.length > 0 && (
                  <View style={styles.suggestionsContainer}>
                    {msg.suggestions.map((sug, idx) => (
                      <TouchableOpacity key={idx} onPress={() => handleSendQuery(sug)} style={styles.suggestionChip}>
                        <Text style={styles.suggestionChipText}>💡 {sug}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>
            )}
          </View>
        ))}

        {loading && (
          <View style={styles.loadingRow}>
            <ActivityIndicator size="small" color="#2E7D32" />
            <Text style={styles.thinkingText}>NutriVoice AI is analyzing your prompt...</Text>
          </View>
        )}
      </ScrollView>

      {/* Input Bar */}
      <View style={styles.inputContainer}>
        <TextInput
          ref={inputRef}
          style={styles.textInput}
          placeholder="Ask NutriVoice or dictate a meal..."
          value={queryText}
          onChangeText={setQueryText}
          onSubmitEditing={() => handleSendQuery()}
        />
        <TouchableOpacity
          onPress={toggleListening}
          style={[styles.micIconButton, isListening && { backgroundColor: '#D32F2F' }]}
        >
          <Icon name={isListening ? 'stop' : 'microphone'} size={24} color="#FFF" />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => handleSendQuery()} style={styles.sendButton}>
          <Icon name="send" size={20} color="#FFF" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F4F6F8' },
  visualizerHeader: {
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    paddingVertical: 18,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 2,
  },
  micPulseCircle: {
    borderRadius: 50,
    padding: 6,
    backgroundColor: 'rgba(46, 125, 50, 0.15)',
  },
  micPulseCircleRecording: {
    backgroundColor: 'rgba(211, 47, 47, 0.22)',
  },
  micButtonCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: '#2E7D32',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
  },
  micButtonCircleRecording: {
    backgroundColor: '#D32F2F',
  },
  soundwaveContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 24,
    marginTop: 10,
  },
  soundwaveBar: {
    width: 4,
    height: 20,
    backgroundColor: '#2E7D32',
    marginHorizontal: 3,
    borderRadius: 2,
  },
  soundwaveBarRecording: {
    backgroundColor: '#D32F2F',
  },
  statusText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginTop: 6,
  },
  ttsToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    position: 'absolute',
    top: 15,
    right: 15,
    backgroundColor: '#F0F0F0',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  ttsToggleText: { fontSize: 11, color: '#666', marginLeft: 4, fontWeight: 'bold' },
  chatStream: { flex: 1, paddingHorizontal: 15 },
  messageRow: { marginBottom: 15 },
  userBubble: {
    alignSelf: 'flex-end',
    backgroundColor: '#2E7D32',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 18,
    borderBottomRightRadius: 2,
    maxWidth: '82%',
  },
  userText: { color: '#FFFFFF', fontSize: 15 },
  aiMessageWrapper: { alignSelf: 'flex-start', maxWidth: '92%', width: '92%' },
  aiBubbleHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  aiSenderLabel: { fontSize: 13, fontWeight: 'bold', color: '#2E7D32', marginLeft: 8 },
  replayButton: { marginLeft: 'auto', padding: 4 },
  aiCard: { backgroundColor: '#FFFFFF', borderRadius: 12, elevation: 1 },
  aiText: { fontSize: 14, color: '#333', lineHeight: 22 },
  actionCardContainer: {
    marginTop: 12,
    padding: 12,
    backgroundColor: '#FFF8E1',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#FFE082',
  },
  actionHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  actionTitle: { fontSize: 14, fontWeight: 'bold', color: '#E65100', marginLeft: 6 },
  actionDetails: { marginVertical: 4 },
  foodItemName: { fontSize: 16, fontWeight: 'bold', color: '#333' },
  foodItemSub: { fontSize: 13, color: '#666', marginTop: 2 },
  confirmActionButton: { marginTop: 10, borderRadius: 8 },
  loggedSuccessBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F5E9',
    padding: 8,
    borderRadius: 8,
    marginTop: 8,
  },
  loggedSuccessText: { color: '#2E7D32', fontWeight: 'bold', marginLeft: 6, fontSize: 13 },
  suggestionsContainer: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 8 },
  suggestionChip: {
    backgroundColor: '#E8F5E9',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 15,
    marginRight: 6,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: '#C8E6C9',
  },
  suggestionChipText: { fontSize: 12, color: '#2E7D32', fontWeight: '500' },
  loadingRow: { flexDirection: 'row', alignItems: 'center', padding: 10 },
  thinkingText: { fontSize: 13, color: '#666', marginLeft: 8, fontStyle: 'italic' },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    backgroundColor: '#FFF',
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  textInput: {
    flex: 1,
    height: 44,
    backgroundColor: '#F5F5F5',
    borderRadius: 22,
    paddingHorizontal: 16,
    fontSize: 14,
    color: '#333',
  },
  micIconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#2E7D32',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#1565C0',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 6,
  },
});
