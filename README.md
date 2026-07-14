#  Full-Stack App

A complete ind Airways flight booking and management application with a React/Vite frontend, Node.js/Express backend, Amadeus API integration, and an intelligent voice assistant.

---

## Quick Start

You need two terminals — one for the backend, one for the frontend.

### Terminal 1 — Backend (Express + Amadeus)

```bash
cd ind-airways-app/backend
npm install
# Add your Amadeus keys to .env (see Configuration below)
node src/server.js
# Server runs on http://localhost:4000
```

### Terminal 2 — Frontend (React + Vite)

```bash
cd ind-airways-app
npm install
npm start
# App opens at http://localhost:3000
```

---

## Configuration

### Backend — `backend/.env`

```env
PORT=4000
NODE_ENV=development

# Get free keys at https://developers.amadeus.com/self-service
AMADEUS_CLIENT_ID=YOUR_CLIENT_ID
AMADEUS_CLIENT_SECRET=YOUR_CLIENT_SECRET
AMADEUS_HOSTNAME=test          # 'test' for sandbox, 'production' for live

JWT_SECRET=your-secret-key-here
JWT_EXPIRES_IN=7d

ALLOWED_ORIGINS=http://localhost:3000
```

### Frontend — `.env.local`

```env
REACT_APP_API_URL=http://localhost:4000/api
```

> Without Amadeus keys, the app works fully using intelligent fallback data for flights and status.

---

## Project Structure

```
ind-airways-app/
├── backend/                          Express/Node.js API server
│   └── src/
│       ├── config/                   amadeus.js · cache.js · logger.js
│       ├── controllers/              One per resource
│       ├── middleware/               auth.js · validate.js · errorHandler.js
│       ├── models/                   inMemoryStore.js (Users + Bookings)
│       ├── routes/                   One per resource
│       ├── services/                 Business logic + Amadeus calls
│       │   ├── flightService.js      flightOffersSearch + price confirm
│       │   ├── flightStatusService.js schedule/flights + fallback
│       │   ├── bookingService.js     flightOrders + in-memory store
│       │   ├── checkinService.js     24h window + boarding pass
│       │   ├── authService.js        JWT + bcrypt
│       │   ├── aviosService.js       distance table + Amadeus lookup
│       │   ├── airportService.js     referenceData/locations + fallback
│       │   └── destinationService.js static curated data
│       └── server.js                 Express app entry point
│
├── src/                              React frontend (Vite)
│   ├── components/
│   │   ├── Header/                   Nav with dropdowns + user menu
│   │   ├── Footer/                   Links + newsletter + app download
│   │   ├── VoiceAgent/               Intelligent voice assistant
│   │   └── common/                   NotificationToast
│   ├── context/
│   │   └── AppContext.jsx            Global state + JWT persistence
│   ├── hooks/
│   │   └── useVoiceRecognition.jsx   Web Speech API wrapper
│   ├── pages/
│   │   ├── Home/                     Hero + search widget + promotions
│   │   ├── BookFlight/               5-step booking flow
│   │   ├── ManageBooking/            Retrieve + seats + bags + upgrade
│   │   ├── CheckIn/                  Online check-in + boarding pass
│   │   ├── FlightStatus/             Live status with progress bar
│   │   ├── Destinations/             Explore + offers
│   │   ├── ExecutiveClub/            Avios + tiers + calculator
│   │   └── Login/                    Auth (sign in + register)
│   ├── services/
│   │   └── api.jsx                   Axios service layer (all HTTP calls)
│   └── utils/
│       └── voiceNLP.jsx              NLP engine — 15 intents + TTS
│
├── index.html                        Vite entry point
├── vite.config.js                    Vite + React plugin config
└── .env.local                        Frontend env vars
```

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Server health check |
| GET | `/api/flights/search` | Search flights via Amadeus |
| POST | `/api/flights/confirm-price` | Confirm price before booking |
| GET | `/api/flights/status` | Real-time flight status |
| GET | `/api/airports` | Airport autocomplete |
| GET | `/api/airports/all` | Full airport list |
| POST | `/api/bookings` | Create booking |
| GET | `/api/bookings/:ref?surname=` | Retrieve booking |
| GET | `/api/bookings/mine` | All bookings (auth required) |
| PATCH | `/api/bookings/:ref/seat` | Select seat |
| PATCH | `/api/bookings/:ref/bags` | Update baggage |
| DELETE | `/api/bookings/:ref` | Cancel booking |
| POST | `/api/checkin` | Online check-in |
| POST | `/api/auth/login` | Sign in |
| POST | `/api/auth/register` | Register |
| GET | `/api/auth/me` | Get profile (auth required) |
| GET | `/api/avios/calculate` | Calculate Avios for a route |
| GET | `/api/avios/balance` | Avios balance (auth required) |
| GET | `/api/destinations` | Destination list |
| GET | `/api/offers` | Current offers |

---

## Demo Credentials

**Login:** `demo@ba.com` / `demo1234` (Gold member, 12,450 Avios)

**Manage / Check-in:**

| Reference | Surname | Details |
|-----------|---------|---------|
| `XYMBA1` | Wilson | Business Class LHR → JFK |
| `PLCNR7` | Johnson | Economy LHR → CDG |

---

## Voice Agent

Click **Ask BA** in the header. Speak or type naturally:

- "Find flights from London to Tokyo next week"
- "Check in for booking XYMBA1"
- "What is the status of BA117?"
- "How many Avios do I earn flying business to New York?"
- "Add baggage to my booking"
- "I want to upgrade to Business Class"
- "Show me destinations in Asia"

The agent understands **15 intent categories**, extracts entities (airports, dates, cabin class, flight numbers), maintains multi-turn conversation context, navigates the app automatically, and speaks responses using the Web Speech API (ind English voice).

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, Vite 5, React Router v6 |
| Styling | Pure CSS with CSS variables (BA brand) |
| Animation | Framer Motion |
| Icons | React Icons |
| HTTP client | Axios |
| Voice | Web Speech API (SpeechRecognition + SpeechSynthesis) |
| Backend | Node.js 18+, Express 4 |
| Flight data | Amadeus Self-Service APIs |
| Auth | JWT + bcrypt |
| Caching | node-cache (5-min TTL for flight searches) |
| Validation | express-validator |
| Security | helmet, cors, express-rate-limit |
| Logging | Winston + Morgan |

---

## Build for Production

```bash
# Build frontend
cd ind-airways-app
npm run build
# Output in build/ — serve with any static host

# Run backend in production
cd backend
NODE_ENV=production node src/server.js
```
