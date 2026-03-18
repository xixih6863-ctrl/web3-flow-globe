# 🌐 Web3 Flow Globe

Real-time 3D visualization of blockchain fund flows on an interactive globe.

## ✨ Features

- 🌍 Interactive 3D Globe with Three.js
- ⚡ Real-time blockchain transaction streaming
- 🌊 Animated fund flow arcs with bloom effects
- 🔄 Auto-rotation with orbit controls
- 📊 Live statistics dashboard

## 🚀 Quick Start

```bash
# Install dependencies
npm run install:all

# Start both client and server
npm run dev
```

Or separately:
```bash
npm run server  # Backend on port 3001
npm run client # Frontend on port 5173
```

## 🔧 Configuration

For real blockchain data, set your RPC URL:

```bash
export RPC_URL=wss://eth-mainnet.g.alchemy.com/v2/YOUR_KEY
```

## 📁 Structure

```
web3-flow-globe/
├── client/     # React + Three.js frontend
├── server/     # Node.js WebSocket server
└── README.md
```

## 🎨 Tech Stack

- Frontend: React, Three.js, Vite
- Backend: Node.js, Express, ethers.js, WebSocket
- Effects: UnrealBloomPass

## 📝 License

MIT
