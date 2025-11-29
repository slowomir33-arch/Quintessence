/**
 * CinematicIntro V2 - Complete Cinematic Preloader Component
 * 
 * Features:
 * - Stage 1: Logarithmic Grid Entry with mouse interaction
 * - Stage 2: Typography Reveal with "Stardust" shader effect
 * - Stage 3: Orbiting Spark with glowing trail
 * 
 * Color Palette: Tech-Noir / Digital Luxury
 * - Void Black: #050505
 * - Luxury Gold: #FFD700
 * - Deep Crimson: #8B0000
 */

import React, { useRef, useMemo, useState, useEffect, useCallback } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Text3D, Center, Trail, useFont } from '@react-three/drei';
import * as THREE from 'three';

// ============================================
// COLOR PALETTE
// ============================================
const COLORS = {
  voidBlack: '#050505',
  luxuryGold: '#FFD700',
  deepCrimson: '#8B0000',
  hotWhite: '#FFFAF0',
};

// ============================================
// STARDUST SHADER - "Liquid Star Dust" Effect
// ============================================
const stardustVertexShader = `
  varying vec2 vUv;
  varying vec3 vPosition;
  varying vec3 vNormal;
  
  void main() {
    vUv = uv;
    vPosition = position;
    vNormal = normalize(normalMatrix * normal);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const stardustFragmentShader = `
  uniform float uTime;
  uniform vec3 uGoldColor;
  uniform vec3 uCrimsonColor;
  uniform float uIntensity;
  
  varying vec2 vUv;
  varying vec3 vPosition;
  varying vec3 vNormal;
  
  // Simplex 3D Noise
  vec4 permute(vec4 x) { return mod(((x*34.0)+1.0)*x, 289.0); }
  vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }
  
  float snoise(vec3 v) {
    const vec2 C = vec2(1.0/6.0, 1.0/3.0);
    const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
    
    vec3 i = floor(v + dot(v, C.yyy));
    vec3 x0 = v - i + dot(i, C.xxx);
    
    vec3 g = step(x0.yzx, x0.xyz);
    vec3 l = 1.0 - g;
    vec3 i1 = min(g.xyz, l.zxy);
    vec3 i2 = max(g.xyz, l.zxy);
    
    vec3 x1 = x0 - i1 + C.xxx;
    vec3 x2 = x0 - i2 + C.yyy;
    vec3 x3 = x0 - D.yyy;
    
    i = mod(i, 289.0);
    vec4 p = permute(permute(permute(
      i.z + vec4(0.0, i1.z, i2.z, 1.0))
      + i.y + vec4(0.0, i1.y, i2.y, 1.0))
      + i.x + vec4(0.0, i1.x, i2.x, 1.0));
    
    float n_ = 1.0/7.0;
    vec3 ns = n_ * D.wyz - D.xzx;
    
    vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
    
    vec4 x_ = floor(j * ns.z);
    vec4 y_ = floor(j - 7.0 * x_);
    
    vec4 x = x_ *ns.x + ns.yyyy;
    vec4 y = y_ *ns.x + ns.yyyy;
    vec4 h = 1.0 - abs(x) - abs(y);
    
    vec4 b0 = vec4(x.xy, y.xy);
    vec4 b1 = vec4(x.zw, y.zw);
    
    vec4 s0 = floor(b0)*2.0 + 1.0;
    vec4 s1 = floor(b1)*2.0 + 1.0;
    vec4 sh = -step(h, vec4(0.0));
    
    vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy;
    vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww;
    
    vec3 p0 = vec3(a0.xy, h.x);
    vec3 p1 = vec3(a0.zw, h.y);
    vec3 p2 = vec3(a1.xy, h.z);
    vec3 p3 = vec3(a1.zw, h.w);
    
    vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
    p0 *= norm.x;
    p1 *= norm.y;
    p2 *= norm.z;
    p3 *= norm.w;
    
    vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
    m = m * m;
    return 42.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
  }
  
  // Fractal Brownian Motion for richer noise
  float fbm(vec3 p) {
    float value = 0.0;
    float amplitude = 0.5;
    float frequency = 1.0;
    for(int i = 0; i < 5; i++) {
      value += amplitude * snoise(p * frequency);
      amplitude *= 0.5;
      frequency *= 2.0;
    }
    return value;
  }
  
  void main() {
    // Create flowing cosmic fluid effect
    vec3 pos = vPosition * 0.5;
    
    // Multiple noise layers for depth
    float noise1 = fbm(pos + vec3(uTime * 0.15, uTime * 0.1, uTime * 0.05));
    float noise2 = fbm(pos * 2.0 - vec3(uTime * 0.1, uTime * 0.2, 0.0));
    float noise3 = snoise(pos * 3.0 + vec3(0.0, uTime * 0.3, uTime * 0.1));
    
    // Combine noises for flowing effect
    float flow = (noise1 + noise2 * 0.5 + noise3 * 0.25) * 0.5 + 0.5;
    
    // Create particle/dust effect
    float particles = pow(snoise(pos * 8.0 + vec3(uTime * 0.5)), 2.0) * 0.5 + 0.5;
    
    // Swirling vortex effect
    float angle = atan(pos.y, pos.x) + uTime * 0.2;
    float radius = length(pos.xy);
    float swirl = sin(angle * 3.0 + radius * 2.0 - uTime) * 0.5 + 0.5;
    
    // Mix gold and crimson based on flow
    float colorMix = flow * 0.7 + swirl * 0.3;
    vec3 baseColor = mix(uCrimsonColor, uGoldColor, colorMix);
    
    // Add bright particle highlights
    float highlight = pow(particles * flow, 3.0);
    vec3 highlightColor = vec3(1.0, 0.95, 0.8); // Hot white/gold
    
    // Final color with cosmic glow
    vec3 finalColor = baseColor + highlightColor * highlight * 0.8;
    
    // Add rim lighting effect
    float rim = 1.0 - max(dot(vNormal, vec3(0.0, 0.0, 1.0)), 0.0);
    rim = pow(rim, 2.0);
    finalColor += uGoldColor * rim * 0.3;
    
    // Intensity control for fade in
    finalColor *= uIntensity;
    
    // Subtle pulsing glow
    float pulse = sin(uTime * 2.0) * 0.1 + 0.9;
    finalColor *= pulse;
    
    gl_FragColor = vec4(finalColor, 1.0);
  }
`;

// ============================================
// GRID SQUARE INSTANCE DATA
// ============================================
interface GridSquareData {
  position: THREE.Vector3;
  targetScale: number;
  currentScale: number;
  rotationX: number;
  rotationY: number;
  spawnTime: number;
  spawned: boolean;
}

// ============================================
// KINETIC GRID COMPONENT
// ============================================
interface KineticGridProps {
  progress: number;
  onGridReady: () => void;
}

const KineticGrid: React.FC<KineticGridProps> = ({ progress, onGridReady }) => {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const { viewport, pointer } = useThree();
  
  const gridSize = 12;
  const spacing = 0.8;
  const squareSize = 0.35;
  const totalSquares = gridSize * gridSize;
  
  // Initialize grid data
  const gridData = useMemo(() => {
    const data: GridSquareData[] = [];
    const halfGrid = (gridSize - 1) / 2;
    
    for (let x = 0; x < gridSize; x++) {
      for (let y = 0; y < gridSize; y++) {
        // Random spawn order based on distance from center with some randomness
        const dx = x - halfGrid;
        const dy = y - halfGrid;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const randomOffset = Math.random() * 0.3;
        
        data.push({
          position: new THREE.Vector3(
            (x - halfGrid) * spacing,
            (y - halfGrid) * spacing,
            0
          ),
          targetScale: 0,
          currentScale: 0,
          rotationX: 0,
          rotationY: 0,
          spawnTime: (dist / (gridSize / 2)) * 0.7 + randomOffset,
          spawned: false,
        });
      }
    }
    
    // Sort by spawn time for logarithmic appearance
    data.sort((a, b) => a.spawnTime - b.spawnTime);
    return data;
  }, []);
  
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const gridReadyRef = useRef(false);
  
  useFrame((_state, _delta) => {
    if (!meshRef.current) return;
    
    // time = state.clock.elapsedTime (not used directly)
    
    // Logarithmic spawn curve: slow start, rapid finish
    // f(x) = log(1 + x * k) / log(1 + k) where k controls the curve steepness
    const k = 9; // Higher = more dramatic logarithmic curve
    const logarithmicProgress = Math.log(1 + progress * k) / Math.log(1 + k);
    
    const spawnedCount = Math.floor(logarithmicProgress * totalSquares);
    let allSpawned = true;
    
    gridData.forEach((square, i) => {
      // Determine if this square should be visible
      if (i < spawnedCount && !square.spawned) {
        square.spawned = true;
        square.targetScale = 1;
      }
      
      if (!square.spawned) {
        allSpawned = false;
      }
      
      // Elastic ease for scale animation (backOut effect)
      const scaleDiff = square.targetScale - square.currentScale;
      if (Math.abs(scaleDiff) > 0.001) {
        // Custom elastic/backOut easing
        const elasticity = 0.08;
        const overshoot = 1.2;
        square.currentScale += scaleDiff * elasticity;
        
        // Add slight overshoot
        if (square.currentScale > 0.9 && square.currentScale < 1.1) {
          square.currentScale = Math.min(square.currentScale, overshoot);
        }
      }
      
      // Mouse interaction - tilt towards cursor
      if (square.spawned) {
        const mouseX = pointer.x * viewport.width * 0.5;
        const mouseY = pointer.y * viewport.height * 0.5;
        
        const dx = mouseX - square.position.x;
        const dy = mouseY - square.position.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        const maxDist = 3;
        const influence = Math.max(0, 1 - dist / maxDist);
        
        const targetRotX = -dy * 0.15 * influence;
        const targetRotY = dx * 0.15 * influence;
        
        square.rotationX += (targetRotX - square.rotationX) * 0.1;
        square.rotationY += (targetRotY - square.rotationY) * 0.1;
      }
      
      // Apply transformations
      dummy.position.copy(square.position);
      dummy.rotation.set(square.rotationX, square.rotationY, 0);
      dummy.scale.setScalar(square.currentScale * squareSize);
      dummy.updateMatrix();
      
      meshRef.current!.setMatrixAt(i, dummy.matrix);
    });
    
    meshRef.current.instanceMatrix.needsUpdate = true;
    
    // Check if grid is ready
    if (allSpawned && progress >= 1 && !gridReadyRef.current) {
      gridReadyRef.current = true;
      setTimeout(onGridReady, 500);
    }
  });
  
  return (
    <instancedMesh
      ref={meshRef}
      args={[undefined, undefined, totalSquares]}
      position={[0, 0, -2]}
    >
      <planeGeometry args={[1, 1]} />
      <meshStandardMaterial
        color={COLORS.luxuryGold}
        metalness={0.8}
        roughness={0.2}
        transparent
        opacity={0.15}
        side={THREE.DoubleSide}
      />
    </instancedMesh>
  );
};

// ============================================
// STARDUST TEXT COMPONENT
// ============================================
interface StardustTextProps {
  text: string;
  visible: boolean;
  onTextReady: () => void;
}

// FONT URL - Change this to your custom font if needed
// Default: Three.js Helvetiker Bold
const FONT_URL = 'https://threejs.org/examples/fonts/helvetiker_bold.typeface.json';

const StardustText: React.FC<StardustTextProps> = ({ text, visible, onTextReady }) => {
  const materialRef = useRef<THREE.ShaderMaterial>(null);
  const groupRef = useRef<THREE.Group>(null);
  const [intensity, setIntensity] = useState(0);
  const textReadyRef = useRef(false);
  
  // Preload font
  const font = useFont(FONT_URL);
  
  useEffect(() => {
    if (font && visible && !textReadyRef.current) {
      textReadyRef.current = true;
      setTimeout(onTextReady, 1000);
    }
  }, [font, visible, onTextReady]);
  
  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uGoldColor: { value: new THREE.Color(COLORS.luxuryGold) },
      uCrimsonColor: { value: new THREE.Color(COLORS.deepCrimson) },
      uIntensity: { value: 0 },
    }),
    []
  );
  
  useFrame((state, delta) => {
    if (materialRef.current) {
      materialRef.current.uniforms.uTime.value = state.clock.elapsedTime;
      
      // Fade in intensity
      if (visible && intensity < 1) {
        const newIntensity = Math.min(intensity + delta * 0.5, 1);
        setIntensity(newIntensity);
        materialRef.current.uniforms.uIntensity.value = newIntensity;
      }
    }
    
    // Subtle floating animation
    if (groupRef.current && visible) {
      groupRef.current.position.y = Math.sin(state.clock.elapsedTime * 0.5) * 0.05;
    }
  });
  
  if (!visible) return null;
  
  return (
    <group ref={groupRef}>
      <Center>
        <Text3D
          font={FONT_URL}
          size={1.2}
          height={0.3}
          bevelEnabled
          bevelSize={0.02}
          bevelThickness={0.01}
          bevelSegments={5}
        >
          {text}
          <shaderMaterial
            ref={materialRef}
            vertexShader={stardustVertexShader}
            fragmentShader={stardustFragmentShader}
            uniforms={uniforms}
          />
        </Text3D>
      </Center>
    </group>
  );
};

// ============================================
// ORBITING SPARK COMPONENT
// ============================================
interface OrbitingSparkProps {
  visible: boolean;
  textBounds: { width: number; height: number };
}

const OrbitingSpark: React.FC<OrbitingSparkProps> = ({ visible, textBounds }) => {
  const sparkRef = useRef<THREE.Mesh>(null);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [_trailPositions, setTrailPositions] = useState<THREE.Vector3[]>([]);
  
  // Rectangular orbit parameters
  const padding = 0.8;
  const width = textBounds.width + padding * 2;
  const height = textBounds.height + padding * 2;
  const halfW = width / 2;
  const halfH = height / 2;
  const perimeter = 2 * width + 2 * height;
  
  useFrame((state) => {
    if (!sparkRef.current || !visible) return;
    
    const time = state.clock.elapsedTime;
    const speed = 0.3;
    const t = (time * speed) % 1;
    const distance = t * perimeter;
    
    let x = 0, y = 0;
    
    // Calculate position on rectangular path
    if (distance < width) {
      // Bottom edge: left to right
      x = -halfW + distance;
      y = -halfH;
    } else if (distance < width + height) {
      // Right edge: bottom to top
      x = halfW;
      y = -halfH + (distance - width);
    } else if (distance < 2 * width + height) {
      // Top edge: right to left
      x = halfW - (distance - width - height);
      y = halfH;
    } else {
      // Left edge: top to bottom
      x = -halfW;
      y = halfH - (distance - 2 * width - height);
    }
    
    sparkRef.current.position.set(x, y, 0.5);
    
    // Update trail
    const newPos = new THREE.Vector3(x, y, 0.5);
    setTrailPositions(prev => {
      const updated = [...prev, newPos];
      // Keep last 60 positions for trail
      if (updated.length > 60) {
        return updated.slice(-60);
      }
      return updated;
    });
  });
  
  if (!visible) return null;
  
  return (
    <group>
      {/* Trail */}
      <Trail
        width={0.8}
        length={8}
        color={new THREE.Color(COLORS.luxuryGold)}
        attenuation={(t) => t * t}
      >
        {/* Spark Core */}
        <mesh ref={sparkRef}>
          <sphereGeometry args={[0.08, 16, 16]} />
          <meshBasicMaterial color={COLORS.hotWhite} />
        </mesh>
      </Trail>
      
      {/* Spark Glow */}
      {sparkRef.current && (
        <sprite position={sparkRef.current.position}>
          <spriteMaterial
            color={COLORS.luxuryGold}
            transparent
            opacity={0.6}
            blending={THREE.AdditiveBlending}
          />
        </sprite>
      )}
    </group>
  );
};

// ============================================
// AMBIENT PARTICLES
// ============================================
const AmbientParticles: React.FC = () => {
  const particlesRef = useRef<THREE.Points>(null);
  const count = 200;
  
  const [positions, speeds] = useMemo(() => {
    const pos = new Float32Array(count * 3);
    const spd = new Float32Array(count);
    
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 20;
      pos[i * 3 + 1] = (Math.random() - 0.5) * 20;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 10 - 5;
      spd[i] = Math.random() * 0.5 + 0.1;
    }
    
    return [pos, spd];
  }, []);
  
  useFrame((_state) => {
    if (!particlesRef.current) return;
    
    const positions = particlesRef.current.geometry.attributes.position.array as Float32Array;
    
    for (let i = 0; i < count; i++) {
      positions[i * 3 + 1] += speeds[i] * 0.01;
      
      // Reset when reaching top
      if (positions[i * 3 + 1] > 10) {
        positions[i * 3 + 1] = -10;
      }
    }
    
    particlesRef.current.geometry.attributes.position.needsUpdate = true;
  });
  
  return (
    <points ref={particlesRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={count}
          array={positions}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial
        size={0.03}
        color={COLORS.luxuryGold}
        transparent
        opacity={0.4}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
};

// ============================================
// SCENE COMPONENT
// ============================================
interface SceneProps {
  text: string;
  onComplete: () => void;
}

const Scene: React.FC<SceneProps> = ({ text, onComplete }) => {
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [_stage, setStage] = useState<'grid' | 'text' | 'spark'>('grid');
  const [gridReady, setGridReady] = useState(false);
  const [textReady, setTextReady] = useState(false);
  
  // Simulate loading progress (replace with actual loading logic)
  useFrame((_state, delta) => {
    if (loadingProgress < 1) {
      // Simulate loading over ~4 seconds
      setLoadingProgress(prev => Math.min(prev + delta * 0.25, 1));
    }
  });
  
  const handleGridReady = useCallback(() => {
    setGridReady(true);
    setStage('text');
  }, []);
  
  const handleTextReady = useCallback(() => {
    setTextReady(true);
    setStage('spark');
    // Notify parent after spark animation starts
    setTimeout(onComplete, 3000);
  }, [onComplete]);
  
  // Estimate text bounds (approximate for GALLERY)
  const textBounds = useMemo(() => ({
    width: text.length * 0.8,
    height: 1.4,
  }), [text]);
  
  return (
    <>
      {/* Lighting */}
      <ambientLight intensity={0.3} />
      <pointLight position={[10, 10, 10]} intensity={1} color={COLORS.luxuryGold} />
      <pointLight position={[-10, -10, 5]} intensity={0.5} color={COLORS.deepCrimson} />
      
      {/* Ambient Particles */}
      <AmbientParticles />
      
      {/* Stage 1: Kinetic Grid */}
      <KineticGrid progress={loadingProgress} onGridReady={handleGridReady} />
      
      {/* Stage 2: Stardust Text */}
      <StardustText
        text={text}
        visible={gridReady}
        onTextReady={handleTextReady}
      />
      
      {/* Stage 3: Orbiting Spark */}
      <OrbitingSpark visible={textReady} textBounds={textBounds} />
    </>
  );
};

// ============================================
// MAIN COMPONENT
// ============================================
export interface CinematicIntroV2Props {
  text?: string;
  onComplete?: () => void;
}

const CinematicIntroV2: React.FC<CinematicIntroV2Props> = ({
  text = 'GALLERY',
  onComplete = () => {},
}) => {
  const [showIntro, setShowIntro] = useState(true);
  
  const handleComplete = useCallback(() => {
    setTimeout(() => {
      setShowIntro(false);
      onComplete();
    }, 1000);
  }, [onComplete]);
  
  if (!showIntro) return null;
  
  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        backgroundColor: COLORS.voidBlack,
        zIndex: 9999,
      }}
    >
      <Canvas
        camera={{ position: [0, 0, 8], fov: 50 }}
        gl={{
          antialias: true,
          alpha: false,
          powerPreference: 'high-performance',
        }}
      >
        <color attach="background" args={[COLORS.voidBlack]} />
        <Scene text={text} onComplete={handleComplete} />
      </Canvas>
      
      {/* Loading indicator */}
      <div
        style={{
          position: 'absolute',
          bottom: '2rem',
          left: '50%',
          transform: 'translateX(-50%)',
          color: COLORS.luxuryGold,
          fontFamily: 'monospace',
          fontSize: '0.8rem',
          opacity: 0.6,
          letterSpacing: '0.2em',
        }}
      >
        INITIALIZING
      </div>
    </div>
  );
};

export default CinematicIntroV2;

// ============================================
// DEMO WRAPPER COMPONENT
// ============================================
export const CinematicIntroV2Demo: React.FC = () => {
  const [showIntro, setShowIntro] = useState(true);
  const [key, setKey] = useState(0);
  
  const handleComplete = () => {
    console.log('Intro complete!');
  };
  
  const handleReplay = () => {
    setShowIntro(false);
    setTimeout(() => {
      setKey(prev => prev + 1);
      setShowIntro(true);
    }, 100);
  };
  
  return (
    <div style={{ width: '100vw', height: '100vh', background: '#000' }}>
      {showIntro && (
        <CinematicIntroV2
          key={key}
          text="GALLERY"
          onComplete={handleComplete}
        />
      )}
      
      {!showIntro && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
          }}
        >
          <button
            onClick={handleReplay}
            style={{
              padding: '1rem 2rem',
              fontSize: '1rem',
              background: 'linear-gradient(135deg, #FFD700, #8B0000)',
              border: 'none',
              borderRadius: '4px',
              color: 'white',
              cursor: 'pointer',
              fontWeight: 'bold',
              letterSpacing: '0.1em',
            }}
          >
            REPLAY INTRO
          </button>
        </div>
      )}
    </div>
  );
};
