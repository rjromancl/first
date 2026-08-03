# British Airways AI Flight Assistant — Mobile App

React Native (Expo) mobile app converted from the web SPA.  
Full feature parity: all screens, AI voice agent, booking flow, mock flights.

---

## Stack

| Layer | Technology |
|---|---|
| Framework | React Native + Expo SDK 51 |
| Navigation | React Navigation 6 (Stack + Bottom Tabs) |
| State | useReducer + Context API |
| Storage | AsyncStorage (data) + SecureStore (JWT token) |
| HTTP | Axios → same backend at `first-eight-cyan.vercel.app` |
| AI | Groq llama-3.3-70b via `fetch()` |
| TTS | expo-speech |
| Mic | expo-av (Audio.Recording) |
| UI | Custom components + @expo/vector-icons |

---

## Setup

### 1. Install dependencies

```bash
cd mobile
npm install
```

### 2. Environment variables

Copy `.env` and fill in your keys:

```
EXPO_PUBLIC_API_URL=https://first-eight-cyan.vercel.app/api
EXPO_PUBLIC_GROQ_API_KEY=gsk_your_groq_key_here
```

### 3. Add assets

Place images in `assets/`:
- `icon.png` (1024×1024)
- `splash.png` (1242×2436, background `#1e2b6b`)
- `adaptive-icon.png` (Android)
- `favicon.png`

### 4. Run

```bash
# Start Expo development server
npm start

# Open on Android emulator
npm run android

# Open on iOS simulator (Mac only)
npm run ios

# Open in browser (limited features — no audio)
npm run web
```

> Use the **Expo Go** app on your phone to scan the QR code for instant preview.

---

## Project Structure

```
mobile/
├── App.js                          # Root entry point
├── app.json                        # Expo config
├── babel.config.js
├── package.json
├── .env                            # Environment variables
├── assets/                         # App icons & splash
└── src/
    ├── context/
    │   └── AppContext.js           # Global state (auth, bookings, etc.)
    ├── navigation/
    │   └── AppNavigator.js         # Stack + Tab navigation
    ├── screens/
    │   ├── HomeScreen.js           # Landing + destinations carousel
    │   ├── LoginScreen.js
    │   ├── RegisterScreen.js
    │   ├── FlightSearchScreen.js   # Search form (accepts voice prefill)
    │   ├── FlightResultsScreen.js  # Mock flight results
    │   ├── BookingFlowScreen.js    # 3-step wizard (Pax → Payment → Review)
    │   ├── BookingConfirmScreen.js # E-ticket / boarding pass
    │   ├── ManageBookingScreen.js
    │   ├── CheckInScreen.js        # Online check-in + boarding pass
    │   ├── FlightStatusScreen.js   # Live tracking + mock data
    │   ├── DestinationsScreen.js   # 6 destinations
    │   ├── ExecutiveClubScreen.js  # Avios balance + calculator
    │   ├── MoreScreen.js           # Settings, auth, links
    │   └── VoiceAgentScreen.js     # Full-screen AI voice assistant
    ├── components/
    │   ├── BAHeader.js
    │   ├── BAButton.js
    │   ├── BACard.js
    │   └── NotificationToast.js
    ├── services/
    │   ├── api.js                  # Axios layer → Vercel backend
    │   └── aiService.js            # Groq AI with retry/fallback
    ├── utils/
    │   ├── mockData.js             # 6 destinations + mock flights
    │   └── translations.js         # 8 languages
    └── theme/
        ├── colors.js
        ├── typography.js
        └── spacing.js
```

---

## Voice Agent

The AI voice assistant at `VoiceAgentScreen.js` supports:

| Feature | How it works |
|---|---|
| Single-shot booking | "Book economy to Dubai for Diwali" → extracts all fields at once |
| Festival resolution | Groq resolves "Christmas", "Diwali" to exact `YYYY-MM-DD` dates |
| Two-option choices | AI presents 2 large buttons when it needs a choice (one-way vs return) |
| Passenger collection | Step-by-step: first name → last name → phone → nationality |
| TTS | expo-speech (British English voice) |
| Microphone | expo-av Audio.Recording |
| AI model | Groq llama-3.3-70b-versatile |
| Fallback | Local NLP if no API key or network failure |

> **Note:** Full speech-to-text transcription requires a STT service (Whisper/Google STT).  
> The current implementation records audio and also provides a text input bar as fallback.  
> To add real STT: send the recorded URI to `https://api.groq.com/openai/v1/audio/transcriptions`.

---

## Build for Production

```bash
# Install EAS CLI
npm install -g eas-cli

# Configure EAS
eas build:configure

# Build Android APK
eas build --platform android --profile preview

# Build iOS IPA (requires Apple Developer account)
eas build --platform ios
```

---

## Backend

The mobile app connects to the same Vercel backend as the web app:
`https://first-eight-cyan.vercel.app/api`

All API endpoints are identical — `src/services/api.js` mirrors the web `api.jsx`.
JWT token is stored securely in expo-secure-store (not AsyncStorage).
