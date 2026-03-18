import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass';

const WS_URL = 'ws://localhost:3001';

const COLORS = {
  earth: '#0a1628',
  ocean: '#0d1f3c',
  land: '#1a3a5c',
  arc: 0x00ff88,
  arcHigh: 0xffff00,
  point: 0x00ff88,
  bg: '#000011'
};

function App() {
  const containerRef = useRef(null);
  const globeRef = useRef(null);
  const arcsRef = useRef(null);
  const pointsRef = useRef(null);
  const [transactions, setTransactions] = useState([]);
  const [stats, setStats] = useState({ total: 0, volume: 0 });
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    initScene();
    connectWebSocket();
    animate();
  }, []);

  const initScene = () => {
    const container = containerRef.current;
    const width = container.clientWidth;
    const height = container.clientHeight;

    // Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(COLORS.bg);

    // Camera
    const camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 2000);
    camera.position.z = 250;
    camera.position.y = 30;

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    container.appendChild(renderer.domElement);

    // Post-processing (Bloom)
    const composer = new EffectComposer(renderer);
    const renderPass = new RenderPass(scene, camera);
    composer.addPass(renderPass);

    const bloomPass = new UnrealBloomPass(
      new THREE.Vector2(width, height),
      1.2,   // strength
      0.4,   // radius
      0.2    // threshold
    );
    composer.addPass(bloomPass);

    // Controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.rotateSpeed = 0.5;
    controls.minDistance = 150;
    controls.maxDistance = 500;

    // Lighting
    const ambientLight = new THREE.AmbientLight(0x404060, 0.6);
    scene.add(ambientLight);

    const sunLight = new THREE.DirectionalLight(0xffffff, 1.2);
    sunLight.position.set(100, 50, 80);
    scene.add(sunLight);

    const rimLight = new THREE.DirectionalLight(0x00ff88, 0.3);
    rimLight.position.set(-100, -50, -80);
    scene.add(rimLight);

    // Create Globe with dark earth texture
    createGlobe(scene);
    
    // Create arcs layer
    createArcsLayer(scene);
    
    // Create points layer
    createPointsLayer(scene);

    // Create Stars
    createStars(scene);

    containerRef.current = { renderer, camera, composer, controls, scene };

    window.addEventListener('resize', () => onResize(width, height));
  };

  const createGlobe = (scene) => {
    // Dark earth sphere
    const geometry = new THREE.SphereGeometry(100, 128, 128);
    
    // Create dark earth material with procedural look
    const material = new THREE.MeshPhongMaterial({
      color: COLORS.earth,
      emissive: 0x000510,
      emissiveIntensity: 0.15,
      specular: 0x222233,
      shininess: 30,
      transparent: true,
      opacity: 0.92
    });
    
    const globe = new THREE.Mesh(geometry, material);
    scene.add(globe);
    globeRef.current = globe;

    // Grid lines (latitude/longitude)
    const gridMat = new THREE.LineBasicMaterial({ 
      color: 0x00ff88, 
      transparent: true, 
      opacity: 0.1 
    });

    // Longitude lines
    for (let i = 0; i < 360; i += 15) {
      const points = [];
      for (let j = -90; j <= 90; j += 2) {
        points.push(latLngToVector3(j, i, 100.2));
      }
      const geo = new THREE.BufferGeometry().setFromPoints(points);
      scene.add(new THREE.Line(geo, gridMat));
    }

    // Latitude lines
    for (let i = -75; i <= 75; i += 15) {
      const points = [];
      for (let j = 0; j <= 360; j += 2) {
        points.push(latLngToVector3(i, j, 100.2));
      }
      const geo = new THREE.BufferGeometry().setFromPoints(points);
      scene.add(new THREE.Line(geo, gridMat));
    }
  };

  const createArcsLayer = (scene) => {
    const arcsGroup = new THREE.Group();
    arcsGroup.name = 'arcs';
    scene.add(arcsGroup);
    arcsRef.current = arcsGroup;
  };

  const createPointsLayer = (scene) => {
    const pointsGroup = new THREE.Group();
    pointsGroup.name = 'points';
    scene.add(pointsGroup);
    pointsRef.current = pointsGroup;
  };

  const createStars = (scene) => {
    const geometry = new THREE.BufferGeometry();
    const count = 6000;
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const sizes = new Float32Array(count);

    for (let i = 0; i < count; i++) {
      const r = 500 + Math.random() * 500;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      
      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      positions[i * 3 + 2] = r * Math.cos(phi);
      
      const c = new THREE.Color();
      c.setHSL(0.55 + Math.random() * 0.15, 0.7, 0.5 + Math.random() * 0.4);
      colors[i * 3] = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;
      
      sizes[i] = Math.random() * 1.5 + 0.5;
    }
    
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

    const material = new THREE.PointsMaterial({
      size: 0.8,
      vertexColors: true,
      transparent: true,
      opacity: 0.85,
      sizeAttenuation: true
    });
    
    scene.add(new THREE.Points(geometry, material));
  };

  const latLngToVector3 = (lat, lng, radius) => {
    const phi = (90 - lat) * (Math.PI / 180);
    const theta = (lng + 180) * (Math.PI / 180);
    return new THREE.Vector3(
      -(radius * Math.sin(phi) * Math.cos(theta)),
      radius * Math.cos(phi),
      radius * Math.sin(phi) * Math.sin(theta)
    );
  };

  const connectWebSocket = () => {
    const ws = new WebSocket(WS_URL);
    
    ws.onopen = () => {
      console.log('✅ Connected to server');
      setConnected(true);
    };
    
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      
      if (data.type === 'INIT') {
        const txs = data.data || [];
        setTransactions(txs);
        updateVisualization(txs);
      } else {
        const newTxs = [data, ...transactions.slice(0, 499)];
        setTransactions(newTxs);
        updateVisualization(newTxs);
      }
    };
    
    ws.onclose = () => {
      console.log('❌ Disconnected');
      setConnected(false);
      setTimeout(connectWebSocket, 3000);
    };
    
    ws.onerror = (err) => {
      console.error('WebSocket error:', err);
    };
  };

  const updateVisualization = (txs) => {
    if (!arcsRef.current || !pointsRef.current) return;

    // Clear old arcs and points
    while (arcsRef.current.children.length > 0) {
      arcsRef.current.remove(arcsRef.current.children[0]);
    }
    while (pointsRef.current.children.length > 0) {
      pointsRef.current.remove(pointsRef.current.children[0]);
    }

    // Add new arcs and points
    txs.forEach((tx, index) => {
      if (tx.fromLat && tx.toLat) {
        createArc(tx, index);
        createPoint(tx.fromLat, tx.fromLng, tx.value);
        createPoint(tx.toLat, tx.toLng, tx.value);
      }
    });

    // Update stats
    const volume = txs.reduce((sum, tx) => sum + (tx.value || 0), 0);
    setStats({ total: txs.length, volume: volume.toFixed(2) });
  };

  const createArc = (tx, index) => {
    const start = latLngToVector3(tx.fromLat, tx.fromLng, 100);
    const end = latLngToVector3(tx.toLat, tx.toLng, 100);
    
    // Calculate arc height based on distance
    const distance = start.distanceTo(end);
    const mid = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5);
    mid.normalize().multiplyScalar(100 + distance * 0.3);

    const curve = new THREE.QuadraticBezierCurve3(start, mid, end);
    
    // Color based on value
    const color = tx.value > 5 ? COLORS.arcHigh : COLORS.arc;
    
    // Create arc with dash animation
    const points = curve.getPoints(64);
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    
    const material = new THREE.LineDashedMaterial({
      color: color,
      transparent: true,
      opacity: 0.7,
      dashSize: 2,
      gapSize: 1,
      linewidth: 1
    });
    
    const arc = new THREE.Line(geometry, material);
    arc.computeLineDistances();
    arc.userData = { 
      dashOffset: -(index * 0.5),
      curve: curve,
      baseOpacity: 0.7
    };
    
    arcsRef.current.add(arc);

    // Animated particle along arc
    const particleGeo = new THREE.SphereGeometry(1.2, 12, 12);
    const particleMat = new THREE.MeshBasicMaterial({
      color: color,
      transparent: true,
      opacity: 0.95
    });
    const particle = new THREE.Mesh(particleGeo, particleMat);
    particle.userData = { 
      curve: curve, 
      t: (index * 0.15) % 1,
      speed: 0.008 + Math.random() * 0.004
    };
    
    arcsRef.current.add(particle);
  };

  const createPoint = (lat, lng, value) => {
    const pos = latLngToVector3(lat, lng, 100);
    
    // Size based on value
    const size = Math.min(2 + value * 0.3, 4);
    
    const geometry = new THREE.SphereGeometry(size, 16, 16);
    const material = new THREE.MeshBasicMaterial({
      color: COLORS.point,
      transparent: true,
      opacity: 0.8
    });
    
    const point = new THREE.Mesh(geometry, material);
    point.position.copy(pos);
    
    // Add glow effect (larger transparent sphere)
    const glowGeo = new THREE.SphereGeometry(size * 2, 16, 16);
    const glowMat = new THREE.MeshBasicMaterial({
      color: COLORS.point,
      transparent: true,
      opacity: 0.2
    });
    const glow = new THREE.Mesh(glowGeo, glowMat);
    point.add(glow);
    
    pointsRef.current.add(point);
  };

  const animate = () => {
    requestAnimationFrame(animate);
    
    const refs = containerRef.current;
    if (!refs) return;

    const { composer, camera, controls } = refs;

    // Auto rotate globe
    if (globeRef.current) {
      globeRef.current.rotation.y += 0.0008;
    }

    // Animate arcs (dash offset + particles)
    if (arcsRef.current) {
      arcsRef.current.children.forEach(child => {
        // Animate dashed line
        if (child.userData.dashOffset !== undefined) {
          child.userData.dashOffset -= 0.02;
          child.material.dashOffset = child.userData.dashOffset;
        }
        
        // Animate particles along curve
        if (child.userData.curve && child.userData.t !== undefined) {
          child.userData.t += child.userData.speed;
          if (child.userData.t > 1) child.userData.t = 0;
          const pos = child.userData.curve.getPoint(child.userData.t);
          child.position.copy(pos);
        }
      });
    }

    // Animate points (pulse effect)
    if (pointsRef.current) {
      const time = Date.now() * 0.003;
      pointsRef.current.children.forEach((child, i) => {
        if (child.material) {
          const pulse = 0.6 + Math.sin(time + i * 0.5) * 0.3;
          child.material.opacity = pulse;
        }
      });
    }

    controls.update();
    composer.render();
  };

  const onResize = (width, height) => {
    const refs = containerRef.current;
    if (!refs) return;
    
    const { camera, renderer, composer } = refs;
    
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
    composer.setSize(width, height);
  };

  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative', background: '#000' }}>
      {/* 3D Container */}
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
      
      {/* Header UI */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        padding: '20px 30px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        background: 'linear-gradient(180deg, rgba(0,0,0,0.85) 0%, transparent 100%)',
        zIndex: 10
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '28px' }}>🌐</span>
          <span style={{ 
            fontSize: '20px', 
            fontWeight: '700',
            background: 'linear-gradient(90deg, #00ff88, #00ddff, #ff00ff)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            letterSpacing: '1px'
          }}>
            WEB3 FLOW GLOBE
          </span>
        </div>
        
        <div style={{ display: 'flex', gap: '35px', alignItems: 'center' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ color: '#00ff88', fontSize: '18px', fontWeight: '700' }}>
              ${stats.volume}
            </div>
            <div style={{ color: '#666', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '1px' }}>
              Volume
            </div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ color: '#fff', fontSize: '18px', fontWeight: '700' }}>
              {stats.total.toLocaleString()}
            </div>
            <div style={{ color: '#666', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '1px' }}>
              Transactions
            </div>
          </div>
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '8px',
            padding: '8px 16px',
            background: connected ? 'rgba(0,255,136,0.15)' : 'rgba(255,0,0,0.15)',
            borderRadius: '25px',
            border: `1px solid ${connected ? 'rgba(0,255,136,0.4)' : 'rgba(255,0,0,0.4)'}`
          }}>
            <span style={{ 
              width: '8px', 
              height: '8px', 
              borderRadius: '50%', 
              background: connected ? '#00ff88' : '#ff0000',
              boxShadow: connected ? '0 0 10px #00ff88' : 'none'
            }} />
            <span style={{ color: connected ? '#00ff88' : '#ff0000', fontSize: '12px', fontWeight: '600', letterSpacing: '1px' }}>
              {connected ? 'LIVE' : 'OFFLINE'}
            </span>
          </div>
        </div>
      </div>

      {/* Chain Legend */}
      <div style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        padding: '20px 30px',
        display: 'flex',
        justifyContent: 'center',
        gap: '40px',
        background: 'linear-gradient(0deg, rgba(0,0,0,0.85) 0%, transparent 100%)',
        zIndex: 10
      }}>
        {[
          { name: 'Ethereum', color: '#627EEA' },
          { name: 'BNB Chain', color: '#00ff88' },
          { name: 'Solana', color: '#00D4FF' },
          { name: 'Polygon', color: '#F0B90B' },
          { name: 'Arbitrum', color: '#28A0F0' },
          { name: 'Avalanche', color: '#E84142' }
        ].map(chain => (
          <div key={chain.name} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ 
              width: '8px', 
              height: '8px', 
              borderRadius: '50%',
              background: chain.color,
              boxShadow: `0 0 8px ${chain.color}`
            }} />
            <span style={{ color: '#888', fontSize: '12px', letterSpacing: '0.5px' }}>
              {chain.name}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default App;
