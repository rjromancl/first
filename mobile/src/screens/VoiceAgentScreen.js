/**
 * VoiceAgentScreen — Full-screen AI voice assistant for the BA mobile app.
 *
 * Uses:
 *  - expo-av (Audio) for microphone recording
 *  - expo-speech for TTS
 *  - aiService.js (Groq llama-3.3-70b) for NLP
 *  - React Navigation for programmatic screen transitions
 *
 * Features:
 *  - Single-shot full booking from one sentence
 *  - Step-by-step passenger collection
 *  - Two-option choice buttons (one-way / return, cabin, etc.)
 *  - Live animated waveform while listening
 *  - Auto-listen after every AI response
 *  - Hands-free: AI speaks, then mic reopens automatically
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  Animated, Dimensions, Platform, Alert,
} from 'react-native';
import { Audio } from 'expo-av';
import * as Speech from 'expo-speech';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useApp } from '../context/AppContext';
import { processVoiceInput } from '../services/aiService';
import Colors from '../theme/colors';
import { Spacing, BorderRadius } from '../theme/spacing';

const { width, height } = Dimensions.get('window');

// ── Waveform bars ────────────────────────────────────────────────
function Waveform({ active }) {
  const bars = useRef(Array.from({ length: 9 }, () => new Animated.Value(0.3))).current;

  useEffect(() => {
    if (!active) {
      bars.forEach(b => Animated.timing(b, { toValue: 0.3, duration: 200, useNativeDriver: true }).start());
      return;
    }
    const animations = bars.map((b, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.timing(b, { toValue: 0.3 + Math.random() * 0.7, duration: 180 + i * 30, useNativeDriver: true }),
          Animated.timing(b, { toValue: 0.2,                        duration: 180 + i * 30, useNativeDriver: true }),
        ])
      )
    );
    animations.forEach(a => a.start());
    return () => animations.forEach(a => a.stop());
  }, [active]);

  return (
    <View style={wfStyles.container}>
      {bars.map((b, i) => (
        <Animated.View key={i} style={[wfStyles.bar, { transform: [{ scaleY: b }] }]} />
      ))}
    </View>
  );
}

const wfStyles = StyleSheet.create({
  container: { flexDirection: 'row', alignItems: 'center', height: 56, gap: 4 },
  bar: { width: 5, height: 40, backgroundColor: Colors.baSkyBlue, borderRadius: 3 },
});

// ── Quick reply chip ─────────────────────────────────────────────
function QuickChip({ label, onPress }) {
  return (
    <TouchableOpacity style={chipStyles.chip} onPress={onPress} activeOpacity={0.8}>
      <Text style={chipStyles.text}>{label}</Text>
    </TouchableOpacity>
  );
}

const chipStyles = StyleSheet.create({
  chip: {
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)',
    borderRadius: 99, paddingHorizontal: 14, paddingVertical: 8,
  },
  text: { color: Colors.white, fontSize: 13, fontWeight: '600' },
});

// ── Booking summary ──────────────────────────────────────────────
function BookingSummary({ entities, pax }) {
  const hasAny = entities.from || entities.to || entities.departureDate || pax.firstName;
  if (!hasAny) return null;
  return (
    <View style={bsStyles.card}>
      <Text style={bsStyles.header}>✈ Booking in progress</Text>
      <View style={bsStyles.row}>
        {entities.from && <Text style={bsStyles.item}>📍 {entities.from} → {entities.to || '?'}</Text>}
        {entities.departureDate && <Text style={bsStyles.item}>📅 {entities.departureDate}</Text>}
        {entities.cabin && <Text style={bsStyles.item}>💺 {entities.cabin}</Text>}
        {entities.adults && <Text style={bsStyles.item}>👥 {entities.adults} adult(s)</Text>}
      </View>
      {pax.firstName && (
        <View style={bsStyles.row}>
          <Text style={bsStyles.item}>👤 {pax.firstName} {pax.lastName || ''}</Text>
          {pax.phone && <Text style={bsStyles.item}>📞 {pax.phone}</Text>}
        </View>
      )}
    </View>
  );
}

const bsStyles = StyleSheet.create({
  card: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: BorderRadius.md, padding: 12, marginBottom: 12,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)',
  },
  header: { color: Colors.baGold, fontSize: 12, fontWeight: '700', marginBottom: 6 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 4 },
  item: { color: 'rgba(255,255,255,0.85)', fontSize: 12 },
});

// ── PAX fields for step-by-step collection ───────────────────────
const PAX_FIELDS = [
  { key: 'firstName',   q: 'What is your first name?' },
  { key: 'lastName',    q: 'And your last name?' },
  { key: 'phone',       q: 'Your phone number?' },
  { key: 'nationality', q: 'Your nationality?' },
];

const WELCOME_MSG   = "Hi! I'm your British Airways AI assistant. Where would you like to fly?";
const WELCOME_SHORT = "Hi! Where would you like to fly?";

const SUGGESTIONS = [
  'London to New York for Christmas',
  'Dubai for Diwali economy',
  'Barcelona next weekend',
  'Check in XYMBA1',
];

let _id = 1;
const mkId = () => `m${Date.now()}${_id++}`;

// ── Main VoiceAgentScreen ────────────────────────────────────────
export default function VoiceAgentScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { setSearchParams, addBooking, addNotification, setSelectedFlight } = useApp();

  // ── State ──────────────────────────────────────────────────────
  const [messages,    setMessages]    = useState([{ id: 'w', role: 'agent', text: WELCOME_SHORT }]);
  const [transcript,  setTranscript]  = useState('');
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking,  setIsSpeaking]  = useState(false);
  const [isThinking,  setIsThinking]  = useState(false);
  const [choices,     setChoices]     = useState(null);
  const [entities,    setEntities]    = useState({});
  const [pax,         setPax]         = useState({});
  const [paxStep,     setPaxStep]     = useState(-1);   // -1 = not collecting
  const [muted,       setMuted]       = useState(false);
  const [permGranted, setPermGranted] = useState(false);

  // ── Refs ───────────────────────────────────────────────────────
  const recordingRef    = useRef(null);
  const scrollRef       = useRef(null);
  const historyRef      = useRef([]);   // conversation history for AI
  const autoListenTimer = useRef(null);
  const isMounted       = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    requestPermissions();
    // Welcome speech
    setTimeout(() => speakText(WELCOME_MSG), 400);
    return () => {
      isMounted.current = false;
      stopListening();
      Speech.stop();
      clearTimeout(autoListenTimer.current);
    };
  }, []);

  // ── Permissions ────────────────────────────────────────────────
  const requestPermissions = async () => {
    try {
      const { granted } = await Audio.requestPermissionsAsync();
      if (!isMounted.current) return;
      setPermGranted(granted);
      if (!granted) {
        addMessage('agent', 'Please enable microphone access to use voice commands. You can type instead.');
      }
    } catch (e) {
      setPermGranted(false);
    }
  };

  // ── TTS ────────────────────────────────────────────────────────
  const speakText = useCallback((text) => {
    if (muted || !text) return;
    setIsSpeaking(true);
    Speech.speak(text, {
      language: 'en-GB',
      pitch: 1.0,
      rate: Platform.OS === 'ios' ? 0.52 : 0.48,
      onDone: () => {
        if (!isMounted.current) return;
        setIsSpeaking(false);
        // Auto-listen after AI speaks
        autoListenTimer.current = setTimeout(() => {
          if (isMounted.current && !isListening) startListening();
        }, 600);
      },
      onStopped: () => { if (isMounted.current) setIsSpeaking(false); },
      onError: () => { if (isMounted.current) setIsSpeaking(false); },
    });
  }, [muted, isListening]);

  const stopSpeaking = () => {
    Speech.stop();
    setIsSpeaking(false);
  };

  // ── Add message ─────────────────────────────────────────────────
  const addMessage = (role, text, extras = {}) => {
    const msg = { id: mkId(), role, text, timestamp: new Date(), ...extras };
    setMessages(prev => [...prev, msg]);
    if (role === 'user') {
      historyRef.current.push({ role: 'user', content: text });
    } else if (role === 'agent') {
      historyRef.current.push({ role: 'assistant', content: text });
    }
    // Cap history
    if (historyRef.current.length > 40) historyRef.current = historyRef.current.slice(-40);
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
  };

  // ── Recording (expo-av) ────────────────────────────────────────
  const startListening = async () => {
    if (isListening || isThinking || !permGranted) return;
    try {
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      recordingRef.current = recording;
      setIsListening(true);
      setTranscript('');
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

      // Auto-stop after 8s silence window
      setTimeout(() => { if (isMounted.current && isListening) stopListening(); }, 8000);
    } catch (e) {
      setIsListening(false);
      addMessage('agent', 'Could not access microphone. Please check your permissions.');
    }
  };

  const stopListening = async () => {
    if (!recordingRef.current) {
      setIsListening(false);
      return;
    }
    try {
      setIsListening(false);
      await recordingRef.current.stopAndUnloadAsync();
      const uri = recordingRef.current.getURI();
      recordingRef.current = null;
      await Audio.setAudioModeAsync({ allowsRecordingIOS: false });

      if (uri) {
        // In production: send audio to Whisper/Google STT API
        // For demo: prompt user to type or use a recognizable phrase
        setTranscript('[Voice recorded — processing...]');
        // Since we can't transcribe without a STT service in this demo,
        // show the text input bar so user can also type
        addMessage('agent', 'I heard you! You can also type your request below if needed.');
        setIsThinking(false);
      }
    } catch (e) {
      setIsListening(false);
      recordingRef.current = null;
    }
  };

  // ── Process text input (from typed text or tapped chip) ─────────
  const processInput = async (text) => {
    if (!text?.trim() || isThinking) return;
    const userText = text.trim();

    stopSpeaking();
    clearTimeout(autoListenTimer.current);
    addMessage('user', userText);
    setIsThinking(true);
    setChoices(null);

    try {
      // Passenger collection mode — capture field values
      if (paxStep >= 0 && paxStep < PAX_FIELDS.length) {
        const field = PAX_FIELDS[paxStep];
        const newPax = { ...pax, [field.key]: userText };
        setPax(newPax);

        const nextStep = paxStep + 1;
        if (nextStep < PAX_FIELDS.length) {
          setPaxStep(nextStep);
          const q = PAX_FIELDS[nextStep].q;
          setIsThinking(false);
          addMessage('agent', q);
          speakText(q);
        } else {
          // All passenger fields collected
          setPaxStep(-1);
          const summary = `Got it! ${newPax.firstName} ${newPax.lastName}, ${newPax.phone}, ${newPax.nationality}.`;
          const confirm = summary + ' Shall I confirm your booking?';
          setIsThinking(false);
          addMessage('agent', confirm);
          speakText(confirm);
          setChoices(['Yes, confirm booking', 'No, start over']);
        }
        return;
      }

      const result = await processVoiceInput(userText, historyRef.current);
      if (!isMounted.current) return;

      if (!result) {
        setIsThinking(false);
        return;
      }

      // Merge entities
      const newEntities = { ...entities };
      Object.entries(result.entities || {}).forEach(([k, v]) => {
        if (v !== null && v !== undefined) newEntities[k] = v;
      });
      setEntities(newEntities);

      const reply = result.response || 'How can I help you?';
      addMessage('agent', reply);
      setIsThinking(false);

      // Show choice buttons if AI provides them
      if (result.action?.choices?.length >= 2) {
        setChoices(result.action.choices);
      }

      // Handle actions
      await handleAction(result, newEntities);

      // Speak the reply
      speakText(reply);

    } catch (err) {
      setIsThinking(false);
      addMessage('agent', 'Sorry, I had trouble processing that. Please try again.');
      speakText('Sorry, please try again.');
    }
  };

  // ── Handle AI actions ───────────────────────────────────────────
  const handleAction = async (result, mergedEntities) => {
    const { intent, action } = result;

    if (intent === 'collect_passenger_field' || action?.type === 'collect_field') {
      setPaxStep(0);
      return;
    }

    if (intent === 'confirm_booking') {
      // User said yes to confirming
      const lower = (result.response || '').toLowerCase();
      if (lower.includes('confirm') || lower.includes('yes')) {
        navigateToBooking(mergedEntities);
      }
      return;
    }

    if (intent === 'check_in' || action?.screen === 'CheckIn') {
      setTimeout(() => {
        navigation.navigate('Manage', { screen: 'CheckIn' });
      }, 1200);
      return;
    }

    if (intent === 'flight_status' || action?.screen === 'FlightStatus') {
      setTimeout(() => {
        navigation.navigate('More', { screen: 'FlightStatus' });
      }, 1200);
      return;
    }

    if (intent === 'avios_query' || action?.screen === 'ExecutiveClub') {
      setTimeout(() => {
        navigation.navigate('More', { screen: 'ExecutiveClub' });
      }, 1200);
      return;
    }

    if (intent === 'book_flight' || action?.type === 'prefill_booking') {
      // If we have enough to navigate — do it
      if (mergedEntities.to) {
        // Check if we still need passenger details
        if (!pax.firstName) {
          const collectMsg = 'Great! Now let me collect your passenger details. What is your first name?';
          addMessage('agent', collectMsg);
          speakText(collectMsg);
          setPaxStep(0);
        } else {
          navigateToBooking(mergedEntities);
        }
      }
      return;
    }
  };

  const navigateToBooking = (mergedEntities) => {
    // Push search params to context
    setSearchParams({
      from:        mergedEntities.from        || 'LHR',
      to:          mergedEntities.to          || '',
      departDate:  mergedEntities.departureDate || '',
      returnDate:  mergedEntities.returnDate   || '',
      cabin:       mergedEntities.cabin        || 'economy',
      adults:      mergedEntities.adults       || 1,
      tripType:    mergedEntities.tripType === 'one_way' ? 'one_way' : 'return',
    });

    const voicePrefill = {
      from:          mergedEntities.from          || 'LHR',
      to:            mergedEntities.to            || '',
      departureDate: mergedEntities.departureDate || '',
      returnDate:    mergedEntities.returnDate    || '',
      cabin:         mergedEntities.cabin         || 'economy',
      adults:        mergedEntities.adults        || 1,
      tripType:      mergedEntities.tripType,
    };

    setTimeout(() => {
      navigation.navigate('Book', {
        screen: 'FlightSearch',
        params: { voicePrefill },
      });
    }, 1000);
  };

  // ── UI ────────────────────────────────────────────────────────
  const [textInput, setTextInput] = useState('');

  const handleMicPress = () => {
    if (isSpeaking) { stopSpeaking(); return; }
    if (isListening) { stopListening(); return; }
    startListening();
  };

  const handleSend = () => {
    if (textInput.trim()) {
      processInput(textInput.trim());
      setTextInput('');
    }
  };

  const getMicIcon = () => {
    if (isSpeaking)  return 'volume-high';
    if (isListening) return 'mic';
    return 'mic-outline';
  };

  const getMicColor = () => {
    if (isSpeaking)  return Colors.baGold;
    if (isListening) return Colors.baRed;
    return Colors.white;
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.headerDot} />
          <Text style={styles.headerTitle}>BA AI Assistant</Text>
        </View>
        <TouchableOpacity onPress={() => { stopSpeaking(); navigation.goBack(); }} style={styles.closeBtn}>
          <Ionicons name="close" size={22} color={Colors.white} />
        </TouchableOpacity>
      </View>

      {/* Messages */}
      <ScrollView
        ref={scrollRef}
        style={styles.messages}
        contentContainerStyle={styles.messagesContent}
        showsVerticalScrollIndicator={false}
      >
        <BookingSummary entities={entities} pax={pax} />

        {messages.map(msg => (
          <View key={msg.id} style={[styles.bubble, msg.role === 'user' ? styles.bubbleUser : styles.bubbleAgent]}>
            <Text style={[styles.bubbleText, msg.role === 'user' ? styles.bubbleTextUser : styles.bubbleTextAgent]}>
              {msg.text}
            </Text>
          </View>
        ))}

        {isThinking && (
          <View style={styles.bubbleAgent}>
            <Text style={styles.thinking}>● ● ●</Text>
          </View>
        )}

        {/* Choice buttons */}
        {choices && !isThinking && (
          <View style={styles.choicesRow}>
            {choices.map((c, i) => (
              <TouchableOpacity
                key={i}
                style={styles.choiceBtn}
                onPress={() => { setChoices(null); processInput(c); }}
                activeOpacity={0.8}
              >
                <Text style={styles.choiceBtnText}>{c}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Suggestions (only if first message shown) */}
        {messages.length <= 1 && !isThinking && (
          <View style={styles.suggestions}>
            {SUGGESTIONS.map(s => (
              <QuickChip key={s} label={s} onPress={() => processInput(s)} />
            ))}
          </View>
        )}
      </ScrollView>

      {/* Live transcript */}
      {isListening && (
        <View style={styles.transcriptBar}>
          <Waveform active={isListening} />
          <Text style={styles.transcriptText} numberOfLines={1}>
            {transcript || 'Listening...'}
          </Text>
        </View>
      )}

      {/* Controls */}
      <View style={styles.controls}>
        {/* Text input */}
        <View style={styles.textBar}>
          <TextInput
            style={styles.textInput}
            value={textInput}
            onChangeText={setTextInput}
            placeholder="Type or tap mic to speak..."
            placeholderTextColor="rgba(255,255,255,0.4)"
            onSubmitEditing={handleSend}
            returnKeyType="send"
          />
          {textInput.length > 0 && (
            <TouchableOpacity onPress={handleSend} style={styles.sendBtn}>
              <Ionicons name="send" size={18} color={Colors.white} />
            </TouchableOpacity>
          )}
        </View>

        {/* Mic FAB */}
        <TouchableOpacity
          onPress={handleMicPress}
          style={[styles.micBtn, isListening && styles.micBtnActive]}
          activeOpacity={0.85}
        >
          <LinearGradient
            colors={isListening ? [Colors.baRed, '#c0392b'] : [Colors.baSkyBlue, Colors.blue]}
            style={styles.micBtnInner}
          >
            <Ionicons name={getMicIcon()} size={28} color={getMicColor()} />
          </LinearGradient>
        </TouchableOpacity>

        {/* Mute */}
        <TouchableOpacity onPress={() => setMuted(!muted)} style={styles.muteBtn}>
          <Ionicons name={muted ? 'volume-mute' : 'volume-high'} size={20} color={muted ? Colors.midGrey : 'rgba(255,255,255,0.7)'} />
        </TouchableOpacity>
      </View>

      {/* Status bar */}
      <View style={styles.statusBar}>
        <Text style={styles.statusText}>
          {isListening ? '🎤 Listening...' : isSpeaking ? '🔊 Speaking...' : isThinking ? '🧠 Thinking...' : '💬 Tap mic or type'}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.voiceBg },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.screen, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.success },
  headerTitle: { color: Colors.white, fontSize: 16, fontWeight: '700' },
  closeBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center', justifyContent: 'center',
  },

  messages: { flex: 1 },
  messagesContent: { padding: Spacing.screen, gap: 10, paddingBottom: 20 },

  bubble: {
    maxWidth: '85%',
    paddingHorizontal: 14, paddingVertical: 10,
    borderRadius: 18,
  },
  bubbleAgent: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignSelf: 'flex-start',
    borderBottomLeftRadius: 4,
  },
  bubbleUser: {
    backgroundColor: Colors.baSkyBlue,
    alignSelf: 'flex-end',
    borderBottomRightRadius: 4,
  },
  bubbleText: { fontSize: 15, lineHeight: 22 },
  bubbleTextAgent: { color: Colors.white },
  bubbleTextUser:  { color: Colors.white },

  thinking: { color: 'rgba(255,255,255,0.5)', fontSize: 18, letterSpacing: 4 },

  choicesRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 4 },
  choiceBtn: {
    flex: 1, minWidth: '45%',
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1.5, borderColor: Colors.baSkyBlue,
    borderRadius: BorderRadius.md, paddingVertical: 14,
    alignItems: 'center',
  },
  choiceBtnText: { color: Colors.white, fontSize: 14, fontWeight: '700' },

  suggestions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },

  transcriptBar: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 16, paddingVertical: 8,
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.08)',
  },
  transcriptText: { flex: 1, color: 'rgba(255,255,255,0.75)', fontSize: 14, fontStyle: 'italic' },

  controls: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 12, paddingVertical: 10,
    gap: 8,
  },
  textBar: {
    flex: 1, flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: BorderRadius.full,
    paddingHorizontal: 14, height: 44,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)',
  },
  textInput: { flex: 1, color: Colors.white, fontSize: 14 },
  sendBtn: { paddingLeft: 8 },

  micBtn: {
    width: 56, height: 56, borderRadius: 28,
    overflow: 'hidden',
    shadowColor: Colors.baSkyBlue,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 6,
  },
  micBtnActive: {
    shadowColor: Colors.baRed,
    shadowOpacity: 0.7,
  },
  micBtnInner: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  muteBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.07)',
    alignItems: 'center', justifyContent: 'center',
  },

  statusBar: {
    alignItems: 'center', paddingBottom: 6,
  },
  statusText: { color: 'rgba(255,255,255,0.45)', fontSize: 12 },
});
