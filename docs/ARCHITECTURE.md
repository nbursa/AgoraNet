# Decentralized Plenum Architecture

This document provides an overview of the architectural design of **Decentralized Plenum**, a peer-to-peer platform facilitating secure, anonymous, and decentralized communication and voting.

## System Components

### Frontend

- **Framework:** Next.js (App Router)
- **Language & Tools:** React.js, TypeScript
- **Styling:** Tailwind CSS
- **State Management:** Zustand
- **Storage:** IndexedDB via Dexie.js

**Responsibilities:**

- User interface and user experience (UI/UX)
- Real-time audio streaming via WebRTC
- Real-time synchronization (votes, shared media)
- Persistent client-side state storage
- Internationalization (i18n)

### Backend

- **Language:** Go
- **Libraries:** Gorilla WebSocket
- **Database:** SQLite

**Responsibilities:**

- WebRTC signaling (offer/answer, ICE candidates)
- Real-time event broadcasting (voting, media sharing)
- Room and participant management
- Persistent room state (current votes, active users, shared media)

### WebRTC Signaling

Signaling server implemented using Gorilla WebSocket to facilitate WebRTC connections:

- Clients send signaling messages (`join`, `offer`, `answer`, `ice-candidate`, `vote`, `share-media`)
- Backend broadcasts messages to participants within a room, ensuring synchronized room state

### Data Storage

#### Client-side (IndexedDB)

- Stores sensitive data securely, including voting history (host only), user preferences, and anonymous session identifiers.

#### Backend (SQLite)

- Stores persistent room states, vote summaries, and metadata for secure synchronization and persistence across sessions.

## Data Flow

1. **User enters a room**: Connects via WebSocket, exchanges WebRTC offers and answers to establish peer-to-peer audio streams.
2. **Voting or media sharing initiated by host**: Frontend emits event to backend signaling server.
3. **Server broadcasts events**: Real-time distribution of events (votes, media, room updates) to all connected clients.
4. **Clients update state**: Frontend updates UI and client-side storage accordingly.

## Deployment

- **Frontend:** Planned deployment on Vercel
- **Backend:** Deployed on Heroku (Go-based signaling server)

---

© 2025 Nenad Bursać. All rights reserved.
