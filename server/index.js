#!/usr/bin/env node

/**
 * Web3 Flow Globe Server
 * Real-time blockchain transaction streaming via WebSocket
 */

import express from 'express';
import cors from 'cors';
import { ethers } from 'ethers';
import { WebSocketServer } from 'ws';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

const wss = new WebSocketServer({ port: PORT });

console.log(`🌐 WebSocket server running on ws://localhost:${PORT}`);

const CONFIG = {
  RPC_URL: process.env.RPC_URL || 'wss://eth-mainnet.g.alchemy.com/v2/demo',
  MIN_VALUE_ETH: parseFloat(process.env.MIN_VALUE || '1'),
  MAX_TRANSACTIONS: 500
};

let transactions = [];

// City coordinates (simplified)
const cityCoords = {
  'New York': { lat: 40.7128, lng: -74.0060 },
  'Los Angeles': { lat: 34.0522, lng: -118.2437 },
  'London': { lat: 51.5074, lng: -0.1278 },
  'Paris': { lat: 48.8566, lng: 2.3522 },
  'Berlin': { lat: 52.5200, lng: 13.4050 },
  'Tokyo': { lat: 35.6762, lng: 139.6503 },
  'Shanghai': { lat: 31.2304, lng: 121.4737 },
  'Singapore': { lat: 1.3521, lng: 103.8198 },
  'Dubai': { lat: 25.2048, lng: 55.2708 },
  'Sydney': { lat: -33.8688, lng: 151.2093 },
  'Toronto': { lat: 43.6532, lng: -79.3832 },
  'Mumbai': { lat: 19.0760, lng: 72.8777 },
  'São Paulo': { lat: -23.5505, lng: -46.6333 },
  'Hong Kong': { lat: 22.3193, lng: 114.1694 },
  'Seoul': { lat: 37.5665, lng: 126.9780 },
};

const cities = Object.keys(cityCoords);

function getRandomCity() {
  return cities[Math.floor(Math.random() * cities.length)];
}

function getCityCoords(city) {
  return cityCoords[city] || { lat: 0, lng: 0 };
}

function addTransaction(txData) {
  const fromCity = getRandomCity();
  const toCity = getRandomCity();
  const fromCoords = getCityCoords(fromCity);
  const toCoords = getCityCoords(toCity);
  
  const transaction = {
    ...txData,
    fromCity,
    toCity,
    fromLat: fromCoords.lat + (Math.random() - 0.5) * 10,
    fromLng: fromCoords.lng + (Math.random() - 0.5) * 10,
    toLat: toCoords.lat + (Math.random() - 0.5) * 10,
    toLng: toCoords.lng + (Math.random() - 0.5) * 10,
  };
  
  transactions.unshift(transaction);
  
  if (transactions.length > CONFIG.MAX_TRANSACTIONS) {
    transactions = transactions.slice(0, CONFIG.MAX_TRANSACTIONS);
  }
  
  broadcast(transaction);
}

function broadcast(data) {
  wss.clients.forEach(client => {
    if (client.readyState === 1) {
      client.send(JSON.stringify(data));
    }
  });
}

// Demo mode
function startDemoMode() {
  console.log('🎮 Starting demo mode...');
  
  setInterval(() => {
    const value = (Math.random() * 10 + 0.5).toFixed(2);
    const fromCity = getRandomCity();
    let toCity = getRandomCity();
    while (toCity === fromCity) toCity = getRandomCity();
    
    addTransaction({
      from: '0x' + Array(40).fill(0).map(() => Math.floor(Math.random() * 16).toString(16)).join(''),
      to: '0x' + Array(40).fill(0).map(() => Math.floor(Math.random() * 16).toString(16)).join(''),
      value: parseFloat(value),
      hash: '0x' + Array(64).fill(0).map(() => Math.floor(Math.random() * 16).toString(16)).join(''),
      timestamp: Date.now()
    });
  }, 2000);
}

// Try connecting to Ethereum, fallback to demo
let provider;
async function initProvider() {
  try {
    provider = new ethers.WebSocketProvider(CONFIG.RPC_URL);
    const network = await provider.getNetwork();
    console.log(`✅ Connected to: ${network.name}`);
    
    provider.on("block", async (blockNumber) => {
      console.log(`📦 Block: ${blockNumber}`);
      try {
        const block = await provider.getBlockWithTransactions(blockNumber);
        if (block?.transactions) {
          for (const tx of block.transactions) {
            if (tx.value) {
              const valueEth = parseFloat(ethers.formatEther(tx.value));
              if (valueEth >= CONFIG.MIN_VALUE_ETH) {
                addTransaction({
                  from: tx.from,
                  to: tx.to || '0x0000000000000000000000000000000000000000',
                  value: valueEth,
                  hash: tx.hash,
                  timestamp: Date.now()
                });
              }
            }
          }
        }
      } catch (e) {
        // Ignore block errors
      }
    });
  } catch (error) {
    console.log('❌ Using demo mode (no RPC connection)');
    startDemoMode();
  }
}

wss.on('connection', (ws) => {
  console.log('✅ Client connected');
  ws.send(JSON.stringify({ type: 'INIT', data: transactions }));
  
  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      if (data.type === 'SET_MIN_VALUE') {
        CONFIG.MIN_VALUE_ETH = parseFloat(data.value);
      }
    } catch (e) {}
  });
});

app.get('/api/transactions', (req, res) => res.json(transactions));

app.get('/api/stats', (req, res) => {
  const totalValue = transactions.reduce((sum, tx) => sum + tx.value, 0);
  res.json({
    totalTransactions: transactions.length,
    totalValue: totalValue.toFixed(2),
    avgValue: transactions.length > 0 ? (totalValue / transactions.length).toFixed(2) : 0
  });
});

app.listen(PORT + 1, () => {
  console.log(`📡 REST API: http://localhost:${PORT + 1}`);
});

initProvider();
