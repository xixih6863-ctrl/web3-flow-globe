import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass';

const WS_URL = 'ws://localhost:3001';

const COLORS = {
  earth: '#0a1628',
  ocean: '#0d1f3c',
  arcLow: 0x00ddff,      // 蓝色 - 小额交易
  arcMid: 0x8844ff,      // 紫色 - 中额交易
  arcHigh: 0xff00ff,     // 紫红色 - 大额交易
  point: 0x00ff88,
  bg: '#000011'
};

function App() {
  const containerRef = useRef(null);
  const globeRef = useRef(null);
  const arcsRef = useRef(null);
  const pointsRef = useRef(null);
  const particlesRef = useRef(null);
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

    // Post-processing with Bloom
    const composer = new EffectComposer(renderer);
    const renderPass = new RenderPass(scene, camera);
    composer.addPass(renderPass);

    // Bloom Effect
    const bloomPass = new UnrealBloomPass(
      new THREE.Vector2(width, height),
      1.5,   // strength - 增强发光
      0.5,   // radius
      0.1    // threshold - 降低阈值让更多发光
    );
    composer.addPass(bloomPass);
    
    // Output pass for color correction
    const outputPass = new OutputPass();
    composer.addPass(outputPass);

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

    // Create Globe
    createGlobe(scene);
    
    // Create arcs layer
    createArcsLayer(scene);
    
    // Create points layer
    createPointsLayer(scene);
    
    // Create particle background
    createParticleBackground(scene);

    // Create Stars
    createStars(scene);

    containerRef.current = { renderer, camera, composer, controls, scene };

    window.addEventListener('resize', () => onResize(width, height));
  };

  const createGlobe = (scene) => {
    const geometry = new THREE.SphereGeometry(100, 128, 128);
    
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

    // Grid lines
    const gridMat = new THREE.LineBasicMaterial({ 
      color: 0x00ff88, 
      transparent: true, 
      opacity: 0.1 
    });

    for (let i = 0; i < 360; i += 15) {
      const points = [];
      for (let j = -90; j <= 90; j += 2) {
        points.push(latLngToVector3(j, i, 100.2));
      }
      const geo = new THREE.BufferGeometry().setFromPoints(points);
      scene.add(new THREE.Line(geo, gridMat));
    }

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

  // Particle background - subtle floating particles
  const createParticleBackground = (scene) => {
    const geometry = new THREE.BufferGeometry();
    const count = 2000;
    const positions = new Float32Array(count * 3);
    const velocities = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const sizes = new Float32Array(count);

    for (let i = 0; i < count; i++) {
      // Spread particles in a sphere around the scene
      const r = 200 + Math.random() * 300;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      
      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      positions[i * 3 + 2] = r * Math.cos(phi);
      
      // Slow random velocities
      velocities[i * 3] = (Math.random() - 0.5) * 0.02;
      velocities[i * 3 + 1] = (Math.random() - 0.5) * 0.02;
      velocities[i * 3 + 2] = (Math.random() - 0.5) * 0.02;
      
      // Subtle colors - blue to purple gradient
      const colorMix = Math.random();
      const color = new THREE.Color();
      color.setHSL(0.55 + colorMix * 0.25, 0.6, 0.3 + colorMix * 0.2);
      colors[i * 3] = color.r;
      colors[i * 3 + 1] = color.g;
      colors[i * 3 + 2] = color.b;
      
      sizes[i] = Math.random() * 1.5 + 0.5;
    }
    
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('velocity', new THREE.BufferAttribute(velocities, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

    const material = new THREE.PointsMaterial({
      size: 0.6,
      vertexColors: true,
      transparent: true,
      opacity: 0.4,
      sizeAttenuation: true,
      blending: THREE.AdditiveBlending
    });
    
    const particles = new THREE.Points(geometry, material);
    particles.name = 'particleBg';
    scene.add(particles);
    particlesRef.current = particles;
  };

  const createStars = (scene) => {
    const geometry = new THREE.BufferGeometry();
    const count = 5000;
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);

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
    }
    
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

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

  // Get color based on value - blue to purple gradient
  const getArcColor = (value) => {
    if (value > 10) return COLORS.arcHigh;      // >10 ETH - 紫红色
    if (value > 5) return COLORS.arcMid;         // 5-10 ETH - 紫色
    return COLORS.arcLow;                       // <5 ETH - 蓝色
  };

  // Get line width based on value
  const getArcWidth = (value) => {
    if (value > 10) return 3;   // 大额 - 粗线
    if (value > 5) return 2;    // 中额 - 中等
    return 1;                   // 小额 - 细线
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
    
    const distance = start.distanceTo(end);
    const mid = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5);
    mid.normalize().multiplyScalar(100 + distance * 0.3);

    const curve = new THREE.QuadraticBezierCurve3(start, mid, end);
    
    // Color gradient based on value (blue → purple)
    const color = getArcColor(tx.value);
    // Line width based on value
    const lineWidth = getArcWidth(tx.value);
    
    // Create arc with tubes for variable thickness
    const tubeRadius = 0.3 + tx.value * 0.05; // Thickness based on value
    const tubeGeometry = new THREE.TubeGeometry(curve, 32, Math.min(tubeRadius, 1.5), 8, false);
    
    const material = new THREE.MeshBasicMaterial({
      color: color,
      transparent: true,
      opacity: 0.6
    });
    
    const arc = new THREE.Mesh(tubeGeometry, material);
    arc.userData = { baseOpacity: 0.6 };
    arcsRef.current.add(arc);

    // Add glow line around the arc
    const glowTubeRadius = tubeRadius * 2;
    const glowGeometry = new THREE.TubeGeometry(curve, 32, glowTubeRadius, 8, false);
    const glowMaterial = new THREE.MeshBasicMaterial({
      color: color,
      transparent: true,
      opacity: 0.15
    });
    const glow = new THREE.Mesh(glowGeometry, glowMaterial);
    arcsRef.current.add(glow);

    // Animated particle along arc
    const particleGeo = new THREE.SphereGeometry(1.5 + tx.value * 0.1, 12, 12);
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
    const size = Math.min(2 + value * 0.3, 5);
    
    // Color based on value
    const color = getArcColor(value);
    
    const geometry = new THREE.SphereGeometry(size, 16, 16);
    const material = new THREE.MeshBasicMaterial({
      color: color,
      transparent: true,
      opacity: 0.85
    });
    
    const point = new THREE.Mesh(geometry, material);
    point.position.copy(pos);
    
    // Add glow effect
    const glowGeo = new THREE.SphereGeometry(size * 2.5, 16, 16);
    const glowMat = new THREE.MeshBasicMaterial({
      color: color,
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

    // Animate arcs
    if (arcsRef.current) {
      arcsRef.current.children.forEach(child => {
        // Animate particles along curve
        if (child.userData.curve && child.userData.t !== undefined) {
          child.userData.t += child.userData.speed || 0.008;
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

    // Animate particle background
    if (particlesRef.current) {
      const positions = particlesRef.current.geometry.attributes.position.array;
      const velocities = particlesRef.current.geometry.attributes.velocity.array;
      
      for (let i = 0; i < positions.length; i += 3) {
        positions[i] += velocities[i];
        positions[i + 1] += velocities[i + 1];
        positions[i + 2] += velocities[i + 2];
        
        // Wrap around if too far
        const dist = Math.sqrt(
          positions[i] ** 2 + 
          positions[i + 1] ** 2 + 
          positions[i + 2] ** 2
        );
        
        if (dist > 600) {
          const scale = 200 / dist;
          positions[i] *= scale;
          positions[i + 1] *= scale;
          positions[i + 2] *= scale;
        }
      }
      
      particlesRef.current.geometry.attributes.position.needsUpdate = true;
      particlesRef.current.rotation.y += 0.0002;
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
            background: 'linear-gradient(90deg, #00ddff, #8844ff, #ff00ff)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            letterSpacing: '1px'
          }}>
            WEB3 FLOW GLOBE
          </span>
        </div>
        
        <div style={{ display: 'flex', gap: '35px', alignItems: 'center' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ color: '#00ddff', fontSize: '18px', fontWeight: '700' }}>
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
            background: connected ? 'rgba(0,221,255,0.15)' : 'rgba(255,0,0,0.15)',
            borderRadius: '25px',
            border: `1px solid ${connected ? 'rgba(0,221,255,0.4)' : 'rgba(255,0,0,0.4)'}`
          }}>
            <span style={{ 
              width: '8px', 
              height: '8px', 
              borderRadius: '50%', 
              background: connected ? '#00ddff' : '#ff0000',
              boxShadow: connected ? '0 0 10px #00ddff' : 'none'
            }} />
            <span style={{ color: connected ? '#00ddff' : '#ff0000', fontSize: '12px', fontWeight: '600', letterSpacing: '1px' }}>
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
          { name: '< 5 ETH', color: '#00ddff' },
          { name: '5-10 ETH', color: '#8844ff' },
          { name: '> 10 ETH', color: '#ff00ff' }
        ].map(item => (
          <div key={item.name} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ 
              width: '12px', 
              height: '4px', 
              borderRadius: '2px',
              background: item.color,
              boxShadow: `0 0 8px ${item.color}`
            }} />
            <span style={{ color: '#888', fontSize: '12px', letterSpacing: '0.5px' }}>
              {item.name}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default App;
