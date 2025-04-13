# AgoraNet

![Status](https://img.shields.io/badge/status-in_development-yellow) ![License](https://img.shields.io/badge/license-custom-lightgrey)

[Architecture Overview](./docs/ARCHITECTURE.md) • [License](./LICENSE.md) • [Contributing](./docs/CONTRIBUTING.md)

**Decentralized Plenum** is an innovative peer-to-peer platform designed for secure, anonymous, and censorship-resistant digital communication and decision-making. Plenum enables users to create decentralized voice rooms, hold anonymous or public votes, and securely share media.

## Features

### Current Features

- **Peer-to-peer audio rooms** powered by WebRTC (with Go-based signaling server).
- **Anonymous participation**: Users can join voice rooms via unique links without revealing their identity.
- **Real-time media sharing**: Supports image and PDF uploads, previews, and secure distribution.
- **Instant voting system**: Hosts can initiate anonymous yes/no votes, with live synchronization across participants.
- **Persistent vote history** (for hosts only): Votes are securely stored client-side using IndexedDB.
- **Internationalization (i18n)**: Currently supports Serbian and English.

### Upcoming Features

- **Advanced voting options**: Multiple-choice, ranked-choice, and time-bound voting.
- **Collaborative proposal writing tools**: Community-driven document drafting.
- **Role-based access control**: Moderators, speakers, and listeners assigned by the community.
- **Self-sovereign identity (SSI)**: Optional pseudonymous verification.
- **End-to-end encryption** for chat, audio streams, and metadata.
- **Decentralized hosting**: Full decentralization via IPFS or mesh overlay networks.

## Technical Stack

- **Frontend:** Next.js (App Router), React.js, Tailwind CSS, Zustand, TypeScript
- **Backend:** Go (Gorilla WebSocket), SQLite, WebRTC Signaling
- **Storage:** IndexedDB (Dexie.js)
- **Deployment:** Heroku (Frontend), Heroku (Backend)

## Architecture Overview

Decentralized Plenum leverages a modular architecture to ensure clear separation of concerns:

- **Frontend** manages UI, real-time interactions (WebRTC), and persistent client-side state.
- **Backend** handles WebRTC signaling, real-time message broadcasting, room state persistence, and synchronization.
- **Client-side storage** ensures data privacy and security via IndexedDB.

## Licensing and Contribution

This repository is publicly available for demonstration, evaluation, and educational purposes. Redistribution, modification, or reuse in any form is prohibited without explicit written permission from the author.

The author intends to open-source the project under a permissive license (MIT or AGPLv3) after achieving foundational development milestones. At that time, contributors will be invited to participate under clearly defined terms.

For inquiries regarding permissions or collaboration, please contact the author directly.

## Contact

For inquiries, collaborations, or research partnerships, feel free to reach out: [https://nenadbursac.com/contact](https://nenadbursac.com/contact)

---

© 2025 Nenad Bursać. All rights reserved.
