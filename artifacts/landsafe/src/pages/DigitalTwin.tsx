import React, { useRef, useState, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Sky, Stars, Environment, Text } from '@react-three/drei';
import * as THREE from 'three';

function Terrain({ riskLevel }: { riskLevel: number }) {
  // Generate a sloped hill mesh
  const geometry = useMemo(() => {
    const geo = new THREE.PlaneGeometry(50, 50, 64, 64);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const y = pos.getY(i);
      // Slope + noise
      const z = (y * 0.4) + Math.sin(x * 0.2) * 2 + Math.cos(y * 0.3) * 1.5;
      pos.setZ(i, z);
    }
    geo.computeVertexNormals();
    return geo;
  }, []);

  // Color shifting based on risk level (0 to 1)
  const color = new THREE.Color().lerpColors(
    new THREE.Color('#22C55E'), // green
    new THREE.Color('#EF4444'), // red
    riskLevel
  ).multiplyScalar(0.5); // darken it

  return (
    <mesh geometry={geometry} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
      <meshStandardMaterial 
        color={color} 
        wireframe={true} 
        wireframeLinewidth={2}
        transparent
        opacity={0.8}
      />
      <meshStandardMaterial color={color} />
    </mesh>
  );
}

function SensorPole({ active }: { active: boolean }) {
  return (
    <group position={[0, 5, 0]}>
      {/* Pole */}
      <mesh castShadow receiveShadow position={[0, -2.5, 0]}>
        <cylinderGeometry args={[0.2, 0.2, 5, 16]} />
        <meshStandardMaterial color="#64748B" metalness={0.8} roughness={0.2} />
      </mesh>
      
      {/* Solar Panel */}
      <mesh castShadow position={[0, 0, 0]} rotation={[0.5, 0, 0]}>
        <boxGeometry args={[2, 0.1, 1.5]} />
        <meshStandardMaterial color="#0284C7" metalness={0.9} roughness={0.1} />
      </mesh>
      
      {/* Enclosure */}
      <mesh castShadow position={[0.4, -1, 0]}>
        <boxGeometry args={[0.8, 1.2, 0.6]} />
        <meshStandardMaterial color="#E2E8F0" />
      </mesh>

      {/* Rain Gauge */}
      <mesh castShadow position={[-0.5, -0.5, 0]}>
        <cylinderGeometry args={[0.3, 0.3, 0.8, 16]} />
        <meshStandardMaterial color="#CBD5E1" />
      </mesh>

      {/* Status Light */}
      <mesh position={[0, 0.5, 0]}>
        <sphereGeometry args={[0.15, 16, 16]} />
        <meshStandardMaterial 
          color={active ? "#22C55E" : "#EF4444"} 
          emissive={active ? "#22C55E" : "#EF4444"} 
          emissiveIntensity={2} 
        />
      </mesh>

      <Text
        position={[0, 1.5, 0]}
        fontSize={0.5}
        color="#ffffff"
        anchorX="center"
        anchorY="middle"
        outlineWidth={0.02}
        outlineColor="#000000"
      >
        LS-SEN-01
      </Text>
    </group>
  );
}

function Rain({ intensity }: { intensity: number }) {
  const count = Math.floor(1000 * intensity);
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  const particles = useMemo(() => {
    return Array.from({ length: count }, () => ({
      x: (Math.random() - 0.5) * 40,
      y: Math.random() * 20 + 5,
      z: (Math.random() - 0.5) * 40,
      speed: Math.random() * 0.2 + 0.3
    }));
  }, [count]);

  useFrame(() => {
    if (!meshRef.current) return;
    particles.forEach((particle, i) => {
      particle.y -= particle.speed;
      // slope interaction
      const slopeHeight = (particle.z * 0.4) + Math.sin(particle.x * 0.2) * 2 + Math.cos(particle.z * 0.3) * 1.5;
      if (particle.y < slopeHeight) {
        particle.y = 25;
      }
      dummy.position.set(particle.x, particle.y, particle.z);
      dummy.scale.set(0.05, 0.5, 0.05);
      dummy.updateMatrix();
      meshRef.current!.setMatrixAt(i, dummy.matrix);
    });
    meshRef.current.instanceMatrix.needsUpdate = true;
  });

  if (intensity === 0) return null;

  return (
    <instancedMesh ref={meshRef} args={[null as any, null as any, count]}>
      <cylinderGeometry args={[0.5, 0.5, 1, 8]} />
      <meshBasicMaterial color="#38BDF8" transparent opacity={0.4} />
    </instancedMesh>
  );
}

export default function DigitalTwin() {
  const [riskLevel, setRiskLevel] = useState(0.2); // 0 to 1
  const [rainIntensity, setRainIntensity] = useState(0.5); // 0 to 1
  const [sensorActive, setSensorActive] = useState(true);

  return (
    <div className="h-[calc(100vh-8rem)] rounded-xl border border-border overflow-hidden relative bg-card flex flex-col lg:flex-row">
      
      {/* 3D Viewport */}
      <div className="flex-1 relative bg-[#122b1d]">
        <Canvas camera={{ position: [15, 10, 15], fov: 45 }} shadows>
          <color attach="background" args={['#050B14']} />
          <ambientLight intensity={0.2} />
          <directionalLight 
            position={[10, 20, 10]} 
            intensity={1.5} 
            castShadow 
            shadow-mapSize-width={2048} 
            shadow-mapSize-height={2048} 
          />
          <Environment preset="night" />
          <Stars radius={100} depth={50} count={5000} factor={4} saturation={0} fade speed={1} />
          
          <Terrain riskLevel={riskLevel} />
          <SensorPole active={sensorActive} />
          <Rain intensity={rainIntensity} />
          
          <OrbitControls 
            enablePan={false} 
            maxPolarAngle={Math.PI / 2 - 0.1} 
            minDistance={10} 
            maxDistance={40} 
          />
        </Canvas>

        <div className="absolute top-4 left-4 px-3 py-1.5 bg-card/80 backdrop-blur border border-border rounded font-mono text-xs text-muted-foreground uppercase">
          Sector 7G Topology Simulation
        </div>
      </div>

      {/* Control Panel */}
      <div className="w-full lg:w-80 bg-card border-l border-border p-6 flex flex-col gap-6 shrink-0 overflow-y-auto">
        <div>
          <h2 className="text-lg font-bold tracking-tight mb-1">Environment Controls</h2>
          <p className="text-xs text-muted-foreground font-mono">Real-time simulation parameters</p>
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <div className="flex justify-between text-xs font-mono text-muted-foreground">
              <span>Ground Saturation / Risk</span>
              <span className={riskLevel > 0.7 ? 'text-destructive' : 'text-success'}>{(riskLevel * 100).toFixed(0)}%</span>
            </div>
            <input 
              type="range" 
              min="0" max="1" step="0.01"
              value={riskLevel}
              onChange={(e) => setRiskLevel(parseFloat(e.target.value))}
              className="w-full h-2 bg-secondary rounded-lg appearance-none cursor-pointer accent-primary"
            />
          </div>

          <div className="space-y-2">
            <div className="flex justify-between text-xs font-mono text-muted-foreground">
              <span>Precipitation Volume</span>
              <span className="text-info">{(rainIntensity * 100).toFixed(0)}mm/hr</span>
            </div>
            <input 
              type="range" 
              min="0" max="1" step="0.01"
              value={rainIntensity}
              onChange={(e) => setRainIntensity(parseFloat(e.target.value))}
              className="w-full h-2 bg-secondary rounded-lg appearance-none cursor-pointer accent-info"
            />
          </div>

          <div className="pt-4 border-t border-border">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Sensor Array Status</span>
              <button 
                onClick={() => setSensorActive(!sensorActive)}
                className={`px-3 py-1 text-xs font-mono rounded border ${
                  sensorActive ? 'bg-success/20 text-success border-success/30' : 'bg-destructive/20 text-destructive border-destructive/30'
                }`}
              >
                {sensorActive ? 'ONLINE' : 'OFFLINE'}
              </button>
            </div>
          </div>
        </div>

        <div className="mt-auto pt-6 border-t border-border">
          <div className="bg-background rounded border border-border p-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">AI Assessment</h3>
            <p className="text-sm">
              {riskLevel > 0.7 && rainIntensity > 0.6 
                ? <span className="text-destructive">Critical instability detected. High probability of mass wasting event within 4 hours. Evacuation recommended.</span>
                : riskLevel > 0.4 
                  ? <span className="text-warning">Moderate saturation. Monitor inclinometer variance.</span>
                  : <span className="text-success">Slopes stable. Normal parameters.</span>
              }
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
