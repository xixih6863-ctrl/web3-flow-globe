import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass';

const WS_URL = 'ws://localhost:3001';

const COLORS = {
  earth: '#0a1628',
  arc: [0x00ff88, 0x00ddff, 0xff00ff],
  bg: '#000011'
};

function App() {
  const containerRef = useRef(null);
  const sceneRef = useRef(null);
  const globeRef = useRef(null);
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

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(COLORS.bg);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 2000);
    camera.position.z = 250;
    camera.position.y = 30;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);

    const composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    composer.addPass(new UnrealBloomPass(new THREE.Vector2(width, height), 0.8, 0.4, 0.2));

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.minDistance = 150;
    controls.maxDistance = 500;

    scene.add(new THREE.AmbientLight(0x333344, 0.5));
    const sunLight = new THREE.DirectionalLight(0xffffff, 1);
    sunLight.position.set(100, 50, 80);
    scene.add(sunLight);

    createGlobe(scene);
    createStars(scene);

    containerRef.current = { renderer, camera, composer, controls };

    window.addEventListener('resize', () => onResize(width, height));
  };

  const createGlobe = (scene) => {
    const geo = new THREE.SphereGeometry(100, 128, 128);
    const mat = new THREE.MeshPhongMaterial({
      color: COLORS.earth,
      emissive: 0x000510,
      specular: 0x111122,
      shininess: 25,
      transparent: true,
      opacity: 0.95
    });
    const globe = new THREE.Mesh(geo, mat);
    scene.add(globe);
    globeRef.current = globe;

    const gridMat = new THREE.LineBasicMaterial({ color: 0x00ff88, transparent: true, opacity: 0.08 });

    for (let i = 0; i < 360; i += 15) {
      const points = [];
      for (let j = -90; j <= 90; j += 2) points.push(latLngToVector3(j, i, 100.3));
      scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), gridMat));
    }
    for (let i = -75; i <= 75; i += 15) {
      const points = [];
      for (let j = 0; j <= 360; j += 2) points.push(latLngToVector3(i, j, 100.3));
      scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), gridMat));
    }
  };

  const createStars = (scene) => {
    const geo = new THREE.BufferGeometry();
    const count = 5000;
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);

    for (let i = 0; i < count; i++) {
      const r = 600 + Math.random() * 400;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      positions[i * 3 + 2] = r * Math.cos(phi);
      const c = new THREE.Color();
      c.setHSL(0.55 + Math.random() * 0.1, 0.8, 0.6 + Math.random() * 0.3);
      colors[i * 3] = c.r; colors[i * 3 + 1] = c.g; colors[i * 3 + 2] = c.b;
    }
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    scene.add(new THREE.Points(geo, new THREE.PointsMaterial({ size: 0.5, vertexColors: true, transparent: true, opacity: 0.8 })));
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
    ws.onopen = () => { console.log('✅ Connected'); setConnected(true); };
    ws.onmessage = (e) => {
      const data = JSON.parse(e.data);
      if (data.type === 'INIT') {
        setTransactions(data.data || []);
        updateArcs(data.data || []);
      } else {
        const newTxs = [data, ...transactions.slice(0, 499)];
        setTransactions(newTxs);
        updateArcs(newTxs);
      }
    };
    ws.onclose = () => { setConnected(false); setTimeout(connectWebSocket, 3000); };
  };

  const updateArcs = (txs) => {
    if (!globeRef.current) return;
    
    // Remove old arcs
    const toRemove = [];
    globeRef.current.children.forEach(c => { if (c.userData.isArc) toRemove.push(c); });
    toRemove.forEach(c => globeRef.current.remove(c));

    // Add new arcs
    txs.forEach((tx, i) => {
      if (tx.fromLat && tx.toLat) createArc(tx, i);
    });

    const volume = txs.reduce((s, t) => s + (t.value || 0), 0);
    setStats({ total: txs.length, volume: volume.toFixed(2) });
  };

  const createArc = (tx, index) => {
    if (!globeRef.current) return;
    const start = latLngToVector3(tx.fromLat, tx.fromLng, 100);
    const end = latLngToVector3(tx.toLat, tx.toLng, 100);
    const mid = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5).normalize().multiplyScalar(100 + start.distanceTo(end) * 0.25);

    const curve = new THREE.QuadraticBezierCurve3(start, mid, end);
    const color = tx.value > 5 ? 0xffff00 : (tx.value > 1 ? 0x00ff88 : 0x00ddff);

    const arc = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(curve.getPoints(40)),
      new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.6 })
    );
    arc.userData = { isArc: true };
    globeRef.current.add(arc);

    const particle = new THREE.Mesh(
      new THREE.SphereGeometry(1.5, 8, 8),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9 })
    );
    particle.userData = { curve, t: (index * 0.1) % 1 };
    globeRef.current.add(particle);
  };

  const animate = () => {
    requestAnimationFrame(animate);
    const refs = containerRef.current;
    if (!refs) return;

    if (globeRef.current) {
      globeRef.current.rotation.y += 0.001;
      globeRef.current.children.forEach(c => {
        if (c.userData.curve) {
          c.userData.t += 0.005;
          if (c.userData.t > 1) c.userData.t = 0;
          c.position.copy(c.userData.curve.getPoint(c.userData.t));
        }
      });
    }

    refs.controls.update();
    refs.composer.render();
  };

  const onResize = (width, height) => {
    const refs = containerRef.current;
    if (!refs) return;
    refs.camera.aspect = width / height;
    refs.camera.updateProjectionMatrix();
    refs.renderer.setSize(width, height);
    refs.composer.setSize(width, height);
  };

  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative' }}>
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
      
      {/* Header */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, padding: '20px 30px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'linear-gradient(180deg, rgba(0,0,0,0.8) 0%, transparent 100%)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '24px' }}>🌐</span>
          <span style={{ fontSize: '18px', fontWeight: '700', background: 'linear-gradient(90deg, #00ff88, #00ddff)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>WEB3 FLOW GLOBE</span>
        </div>
        <div style={{ display: 'flex', gap: '30px' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ color: '#00ff88', fontSize: '16px', fontWeight: '600' }}>${stats.volume}B</div>
            <div style={{ color: '#666', fontSize: '10px', textTransform: 'uppercase' }}>Volume</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ color: '#fff', fontSize: '16px', fontWeight: '600' }}>{stats.total}</div>
            <div style={{ color: '#666', fontSize: '10px', textTransform: 'uppercase' }}>Transactions</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 12px', background: connected ? 'rgba(0,255,136,0.1)' : 'rgba(255,0,0,0.1)', borderRadius: '20px', border: `1px solid ${connected ? 'rgba(0,255,136,0.3)' : 'rgba(255,0,0,0.3)'}` }}>
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: connected ? '#00ff88' : '#f00' }} />
            <span style={{ color: connected ? '#00ff88' : '#f00', fontSize: '11px' }}>{connected ? 'LIVE' : 'OFFLINE'}</span>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '15px 30px', display: 'flex', gap: '25px', background: 'linear-gradient(0deg, rgba(0,0,0,0.8) 0%, transparent 100%)' }}>
        {['Ethereum', 'BNB Chain', 'Solana', 'Polygon'].map(c => (
          <div key={c} style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#666', fontSize: '12px' }}>
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: c === 'Ethereum' ? '#627EEA' : c === 'BNB Chain' ? '#00ff88' : c === 'Solana' ? '#00D4FF' : '#F0B90B' }} />
            {c}
          </div>
        ))}
      </div>
    </div>
  );
}

export default App;
