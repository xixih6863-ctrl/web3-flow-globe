# 🌐 Web3 Flow Globe

Real-time 3D visualization of blockchain fund flows on an interactive globe.

![Version](https://img.shields.io/badge/version-1.0.0-blue)
![License](https://img.shields.io/badge/license-MIT-green)

## ✨ Features

- 🌍 Interactive 3D Globe with Three.js
- ⚡ Real-time blockchain transaction streaming via WebSocket
- 🌊 Animated fund flow arcs with gradient colors (blue → purple)
- ✨ Bloom post-processing effects
- 📊 Live statistics dashboard
- 🔄 Auto-rotation with orbit controls
- 💫 Particle background effects

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- npm or yarn

### Installation

```bash
# Clone the repository
git clone https://github.com/xixih6863-ctrl/web3-flow-globe.git
cd web3-flow-globe

# Install all dependencies
npm run install:all

# Or install manually
npm install
cd client && npm install
cd ../server && npm install
```

### Running

```bash
# Start both client and server
npm run dev

# Or run separately:
npm run server  # Backend on port 3001 (WebSocket) + 3002 (REST API)
npm run client  # Frontend on http://localhost:5173
```

### Access

Open http://localhost:127.0.0.1:5173 in your browser.

---

## 🔧 Configuration

### Setting Up Alchemy API Key (Optional)

For real blockchain data, set your Alchemy or Infura RPC URL:

**Option 1: Environment Variable**

```bash
export RPC_URL=wss://eth-mainnet.g.alchemy.com/v2/YOUR_API_KEY
export MIN_VALUE=1
npm run server
```

**Option 2: Edit server/index.js**

```javascript
const CONFIG = {
  RPC_URL: 'wss://eth-mainnet.g.alchemy.com/v2/YOUR_API_KEY',
  MIN_VALUE_ETH: 1,  // Minimum transaction value in ETH
  MAX_TRANSACTIONS: 500
};
```

### Getting an Alchemy API Key

1. Go to [Alchemy](https://www.alchemy.com/)
2. Sign up for a free account
3. Create a new app (Ethereum Mainnet)
4. Copy the WebSocket URL
5. Replace `YOUR_API_KEY` in the config

### Demo Mode

If no RPC URL is provided, the server runs in demo mode with simulated transactions.

---

## 📁 Project Structure

```
web3-flow-globe/
├── client/                 # React + Three.js frontend
│   ├── src/
│   │   ├── App.jsx        # Main application
│   │   └── main.jsx       # Entry point
│   ├── index.html
│   ├── package.json
│   └── vite.config.js
├── server/                 # Node.js WebSocket server
│   ├── index.js           # Server implementation
│   └── package.json
├── package.json           # Root package.json
├── README.md
└── .gitignore
```

---

## 🎨 Visualization Guide

### Arc Colors (Based on Transaction Value)

| Value | Color | Description |
|-------|-------|-------------|
| < 5 ETH | 🔵 Blue (#00ddff) | Small transactions |
| 5-10 ETH | 🟣 Purple (#8844ff) | Medium transactions |
| > 10 ETH | 🟪 Magenta (#ff00ff) | Large transactions |

### Features

- **Globe**: Dark earth theme with grid lines
- **Arcs**: Animated flow lines with thickness based on value
- **Points**: Glowing markers at wallet locations
- **Particles**: Floating background particles
- **Bloom**: Post-processing glow effect

---

## 🔌 API Endpoints

### WebSocket (Port 3001)

```javascript
// Connect
const ws = new WebSocket('ws://localhost:3001');

// Receive transaction
ws.onmessage = (event) => {
  const tx = JSON.parse(event.data);
  console.log(tx);
};

// Transaction format
{
  from: "0x...",
  to: "0x...",
  value: 5.2,
  fromLat: 40.7128,
  fromLng: -74.0060,
  toLat: 51.5074,
  toLng: -0.1278,
  fromCity: "New York",
  toCity: "London",
  hash: "0x...",
  timestamp: 1234567890
}
```

### REST API (Port 3002)

```
GET /api/transactions  - Get all transactions
GET /api/stats        - Get statistics
GET /api/config       - Get current configuration
POST /api/config      - Update configuration
```

---

## 🛠️ Tech Stack

- **Frontend**: React 18, Three.js r161, Vite
- **Backend**: Node.js, Express, ethers.js, WebSocket
- **Effects**: UnrealBloomPass, Three.js Points

---

## 📝 License

MIT

---

## 🤝 Contributing

Pull requests are welcome!

---

## 🔗 Links

- [GitHub Repository](https://github.com/xixih6863-ctrl/web3-flow-globe)
- [Three.js Documentation](https://threejs.org/docs/)
- [ethers.js Documentation](https://docs.ethers.org/)
- [Alchemy](https://www.alchemy.com/)
