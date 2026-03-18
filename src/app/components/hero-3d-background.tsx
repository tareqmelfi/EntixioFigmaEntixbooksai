import { useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Float } from '@react-three/drei';
import * as THREE from 'three';

// ─── Custom Halftone Shader Material ───
function HalftoneTorusKnot() {
  const meshRef = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    if (meshRef.current) {
      meshRef.current.rotation.x = state.clock.getElapsedTime() * 0.1;
      meshRef.current.rotation.y = state.clock.getElapsedTime() * 0.15;
    }
  });

  return (
    <Float speed={1.5} rotationIntensity={0.3} floatIntensity={0.5}>
      <mesh ref={meshRef}>
        <torusKnotGeometry args={[2.5, 0.8, 128, 32, 3, 4]} />
        <meshStandardMaterial
          color="#0B1A47"
          metalness={0.3}
          roughness={0.4}
          wireframe={false}
          transparent
          opacity={0.15}
        />
      </mesh>
    </Float>
  );
}

// ─── Main 3D Background Component ───
export function Hero3DBackground() {
  return (
    <div className="absolute inset-0 overflow-hidden">
      {/* Canvas with 3D Scene */}
      <Canvas
        camera={{ position: [0, 0, 8], fov: 50 }}
        className="absolute inset-0"
        style={{ background: 'transparent' }}
      >
        <ambientLight intensity={0.5} />
        <directionalLight position={[5, 5, 5]} intensity={0.8} />
        <pointLight position={[-5, -5, -5]} intensity={0.5} color="#1276E3" />
        
        <HalftoneTorusKnot />
        
        {/* Subtle fog */}
        <fog attach="fog" args={['#0B1A47', 5, 20]} />
      </Canvas>

      {/* Gradient Overlay (reduces visual noise) */}
      <div 
        className="absolute inset-0 pointer-events-none"
        style={{
          background: `
            linear-gradient(
              135deg,
              rgba(11, 26, 71, 0.85) 0%,
              rgba(18, 118, 227, 0.65) 50%,
              rgba(52, 159, 196, 0.75) 100%
            )
          `
        }}
      />

      {/* Subtle grain texture for depth */}
      <div 
        className="absolute inset-0 pointer-events-none opacity-[0.02]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 400 400' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='2' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
          backgroundSize: '200px 200px'
        }}
      />
    </div>
  );
}
