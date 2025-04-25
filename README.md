# Multi Pong

A multi-player pong game built with HTML, CSS, and JavaScript without a game server\*.

This is a proof of concept and is not intended for production use.

## No Game Server

There is no game server\*. Clients connect to each other and exchange messages using WebRTC with manual signaling.

The manual signaling data exchange is done through (1) a QR code or (2) copy and paste.

### How to Connect Clients

One client acts as a Host and the other client act as Guest.

Both Host and Guest load the page in their browser. The Host will click Host and the Guest will click Guest.

The Host screen will show a QR Code and a textbox showing th offer data. The Guest will click Guest and either scan the QR Code (with the built in QR Code scanner) or paste the offer data from the Host's screen.

After the Guest app accepts the offer data, it will generate an answer data to send to the Host. This method is the same, but in reverse. The Guest screen will show a QR Code and a textbox showing the answer data.

The Host must now scan the QR Code on the Guest's screen or paste the answer data from the Guest's screen.

At this point, both Host and Guest should be connected and a ping/pong message exchange should begin.

Both Host and Guest will now see a Connection Success message and have a button to start the game.

### Message Exchange

After a volley, the angle and velocity of the ball will be sent to the other client. This way both Host and Guest can render the ball in their respective screens.

The client receiving the ball will be the source of truth for the returning balls velocity and angle. This way no latency or packet loss will affect the game.

## Project Setup

### Dependencies

This project relies on the following key dependencies:

- **html5-qrcode**: For QR code scanning functionality
- **qrcode**: For generating QR codes
- **three.js**: For advanced visual effects

### Commands

The following npm commands are available:

```bash
# Start the development server
npm run start

# Build the project for production (outputs to 'docs' directory for GitHub Pages)
npm run build

# Preview the production build
npm run preview

# Run tests
npm run test

# Lint the codebase
npm run lint

# Fix linting issues
npm run lint:fix

# Format code with Prettier
npm run format

# Type checking
npm run typecheck
```

## Technical Overview

The project is organized into several key directories:

- **src/network/**: Contains WebRTC peer connection implementation for client-to-client communication
- **src/game/**: Game engine and renderer implementation
- **src/effects/**: Visual and sound effects including particle systems and screen shake
- **src/lib/**: Utility functions for DOM manipulation, QR code handling, etc.
- **src/types/**: Type definitions using JSDoc
- **src/styles/**: CSS styling

The application flow:

1. Users connect via WebRTC using manual signaling (QR codes or copy/paste)
2. Upon successful connection, the game starts with synchronized countdown
3. The Host initially controls the ball, and after each volley, control passes to the receiving player
4. Game state is synchronized between players with minimal data transfer

## Gameplay

The gameplay is classic pong.

The ball velocity will increase with each volley. This is configurable in the settings.json.

### Score

The score is displayed in the top left of the screen. The first player to score 3 points wins the game. This is configurable in the settings.json.

### Visuals

The game should be built with a dark neon theme reminiscent of Tron with glowing elements. When the ball is returned there are particle effects and screen shakes and sound effects to make the experience more immersive.

---

_\*no game server_ means this game can be hosted as a static HTML page without requiring a dedicated server for netplay. While no game server is needed, WebRTC connections between different networks rely on public and open servers to establish a connection.

- **ICE (Interactive Connectivity Establishment)**: A framework that finds the best path for connecting peers across different networks.
- **STUN (Session Traversal Utilities for NAT)**: Servers that help peers discover their public IP address when behind a NAT.
- **TURN (Traversal Using Relays around NAT)**: Relay servers that act as intermediaries when direct connections aren't possible due to restrictive firewalls or NAT configurations.

These services are used only for establishing the initial connection. Once connected, all game data flows directly between players without passing through any server.
