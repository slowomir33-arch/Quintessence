import { useRef, useMemo, useState, useEffect, useCallback } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Trail, Text, Float } from '@react-three/drei';
import * as THREE from 'three';
import gsap from 'gsap';

// ============================================
// COLOR PALETTE
// ============================================
const COLORS = {
  voidBlack: '#050505',
  luxuryGold: '#D4AF37',
  deepCrimson: '#8B0000',
  brightGold: '#FFD700',
  warmGold: '#F4C430',
};

// ============================================
// STARDUST SHADER - Liquid particle effect for text
// ============================================
const stardustVertexShader = `
  varying vec2 vUv;
  varying vec3 vPosition;
  
  void main() {
    vUv = uv;
    vPosition = position;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const stardustFragmentShader = `
  uniform float uTime;
  uniform vec3 uColorGold;
  uniform vec3 uColorCrimson;
  uniform vec2 uResolution;
  
  varying vec2 vUv;
  varying vec3 vPosition;
  
  // Simplex noise functions
  vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec2 mod289(vec2 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec3 permute(vec3 x) { return mod289(((x*34.0)+1.0)*x); }
  
  float snoise(vec2 v) {
    const vec4 C = vec4(0.211324865405187, 0.366025403784439,
                        -0.577350269189626, 0.024390243902439);
    vec2 i  = floor(v + dot(v, C.yy));
    vec2 x0 = v - i + dot(i, C.xx);
    vec2 i1;
    i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
    vec4 x12 = x0.xyxy + C.xxzz;
    x12.xy -= i1;
    i = mod289(i);
    vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
    vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0);
    m = m*m;
    m = m*m;
    vec3 x = 2.0 * fract(p * C.www) - 1.0;
    vec3 h = abs(x) - 0.5;
    vec3 ox = floor(x + 0.5);
    vec3 a0 = x - ox;
    m *= 1.79284291400159 - 0.85373472095314 * (a0*a0 + h*h);
    vec3 g;
    g.x = a0.x * x0.x + h.x * x0.y;
    g.yz = a0.yz * x12.xz + h.yz * x12.yw;
    return 130.0 * dot(m, g);
  }
  
  // FBM for richer noise
  float fbm(vec2 p) {
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
    vec2 uv = vUv;
    
    // Flowing liquid effect
    float time = uTime * 0.3;
    
    // Multiple layers of flowing noise
    float noise1 = fbm(uv * 3.0 + vec2(time * 0.5, time * 0.3));
    float noise2 = fbm(uv * 5.0 - vec2(time * 0.4, time * 0.6));
    float noise3 = snoise(uv * 8.0 + vec2(sin(time), cos(time * 0.7)));
    
    // Combine noises for liquid stardust effect
    float combinedNoise = noise1 * 0.5 + noise2 * 0.3 + noise3 * 0.2;
    
    // Create sparkle points
    float sparkle = pow(max(0.0, snoise(uv * 20.0 + time * 2.0)), 8.0);
    
    // Wave distortion
    float wave = sin(uv.x * 10.0 + time * 2.0) * 0.1 + cos(uv.y * 8.0 + time * 1.5) * 0.1;
    
    // Color mixing based on noise
    float colorMix = (combinedNoise + wave + 1.0) * 0.5;
    colorMix = smoothstep(0.3, 0.7, colorMix);
    
    vec3 color = mix(uColorCrimson, uColorGold, colorMix);
    
    // Add sparkles
    color += vec3(sparkle) * uColorGold * 2.0;
    
    // Brightness variation
    float brightness = 0.7 + combinedNoise * 0.3 + sparkle * 0.5;
    color *= brightness;
    
    // Subtle glow at edges
    float edgeGlow = 1.0 - smoothstep(0.0, 0.15, min(min(uv.x, 1.0 - uv.x), min(uv.y, 1.0 - uv.y)));
    color += uColorGold * edgeGlow * 0.3;
    
    gl_FragColor = vec4(color, 1.0);
  }
`;

// ============================================
// KINETIC GRID COMPONENT
// ============================================
interface GridSquareData {
  position: THREE.Vector3;
  scale: number;
  targetScale: number;
  rotation: THREE.Euler;
  spawnTime: number;
  isSpawned: boolean;
  index: number;
}

function KineticGrid({ 
  progress, 
  mousePosition,
  onComplete 
}: { 
  progress: number;
  mousePosition: React.MutableRefObject<{ x: number; y: number }>;
  onComplete: () => void;
}) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const { viewport } = useThree();
  
  const gridConfig = useMemo(() => ({
    cols: 20,
    rows: 12,
    squareSize: 0.35,
    gap: 0.08,
  }), []);
  
  const totalSquares = gridConfig.cols * gridConfig.rows;
  
  // Initialize grid data
  const gridData = useMemo(() => {
    const data: GridSquareData[] = [];
    const totalWidth = gridConfig.cols * (gridConfig.squareSize + gridConfig.gap);
    const totalHeight = gridConfig.rows * (gridConfig.squareSize + gridConfig.gap);
    
    // Create shuffled spawn order
    const indices = Array.from({ length: totalSquares }, (_, i) => i);
    for (let i = indices.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [indices[i], indices[j]] = [indices[j], indices[i]];
    }
    
    for (let i = 0; i < gridConfig.rows; i++) {
      for (let j = 0; j < gridConfig.cols; j++) {
        const index = i * gridConfig.cols + j;
        const spawnOrder = indices.indexOf(index);
        
        data.push({
          position: new THREE.Vector3(
            j * (gridConfig.squareSize + gridConfig.gap) - totalWidth / 2 + gridConfig.squareSize / 2,
            i * (gridConfig.squareSize + gridConfig.gap) - totalHeight / 2 + gridConfig.squareSize / 2,
            0
          ),
          scale: 0,
          targetScale: 1,
          rotation: new THREE.Euler(0, 0, 0),
          spawnTime: spawnOrder / totalSquares, // Normalized spawn time
          isSpawned: false,
          index,
        });
      }
    }
    
    return data;
  }, [gridConfig, totalSquares]);
  
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const completedRef = useRef(false);
  
  useFrame((state) => {
    if (!meshRef.current) return;
    
    const time = state.clock.getElapsedTime();
    let allSpawned = true;
    
    gridData.forEach((square, i) => {
      // Logarithmic spawn based on progress
      // progress^0.5 makes it start slow and accelerate
      const logProgress = Math.pow(progress, 0.4);
      const shouldSpawn = square.spawnTime <= logProgress;
      
      if (shouldSpawn && !square.isSpawned) {
        square.isSpawned = true;
      }
      
      if (!square.isSpawned) {
        allSpawned = false;
        square.scale = 0;
      } else {
        // Elastic bounce animation
        const spawnProgress = Math.min(1, (logProgress - square.spawnTime) * 5);
        const elastic = 1 + Math.sin(spawnProgress * Math.PI * 3) * Math.exp(-spawnProgress * 4) * 0.3;
        square.scale = THREE.MathUtils.lerp(square.scale, elastic, 0.15);
      }
      
      // Mouse interaction - tilt effect
      const dx = mousePosition.current.x * viewport.width / 2 - square.position.x;
      const dy = mousePosition.current.y * viewport.height / 2 - square.position.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      const maxDistance = 3;
      const influence = Math.max(0, 1 - distance / maxDistance);
      
      const targetRotX = -dy * influence * 0.5;
      const targetRotY = dx * influence * 0.5;
      
      square.rotation.x = THREE.MathUtils.lerp(square.rotation.x, targetRotX, 0.1);
      square.rotation.y = THREE.MathUtils.lerp(square.rotation.y, targetRotY, 0.1);
      
      // Subtle floating animation
      const floatOffset = Math.sin(time * 2 + square.index * 0.1) * 0.02;
      
      dummy.position.copy(square.position);
      dummy.position.z = floatOffset + influence * 0.2;
      dummy.rotation.copy(square.rotation);
      dummy.scale.setScalar(square.scale * gridConfig.squareSize * 0.9);
      dummy.updateMatrix();
      
      meshRef.current!.setMatrixAt(i, dummy.matrix);
    });
    
    meshRef.current.instanceMatrix.needsUpdate = true;
    
    // Check completion
    if (allSpawned && !completedRef.current && progress >= 1) {
      completedRef.current = true;
      onComplete();
    }
  });
  
  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, totalSquares]}>
      <planeGeometry args={[1, 1]} />
      <meshStandardMaterial 
        color={COLORS.luxuryGold}
        metalness={0.8}
        roughness={0.2}
        emissive={COLORS.deepCrimson}
        emissiveIntensity={0.1}
        side={THREE.DoubleSide}
      />
    </instancedMesh>
  );
}

// ============================================
// STARDUST TEXT COMPONENT
// ============================================
function StardustText({ 
  visible, 
  text = "GALLERY" 
}: { 
  visible: boolean;
  text?: string;
}) {
  const materialRef = useRef<THREE.ShaderMaterial>(null);
  const groupRef = useRef<THREE.Group>(null);
  const [opacity, setOpacity] = useState(0);
  
  useEffect(() => {
    if (visible && groupRef.current) {
      gsap.to(groupRef.current.scale, {
        x: 1,
        y: 1,
        z: 1,
        duration: 1.5,
        ease: 'elastic.out(1, 0.5)',
      });
      gsap.to({ value: 0 }, {
        value: 1,
        duration: 1,
        onUpdate: function() {
          setOpacity(this.targets()[0].value);
        }
      });
    }
  }, [visible]);
  
  const uniforms = useMemo(() => ({
    uTime: { value: 0 },
    uColorGold: { value: new THREE.Color(COLORS.luxuryGold) },
    uColorCrimson: { value: new THREE.Color(COLORS.deepCrimson) },
    uResolution: { value: new THREE.Vector2(1, 1) },
  }), []);
  
  useFrame((state) => {
    if (materialRef.current) {
      materialRef.current.uniforms.uTime.value = state.clock.getElapsedTime();
    }
  });
  
  if (!visible) return null;
  
  return (
    <group ref={groupRef} scale={[0.01, 0.01, 0.01]}>
      <Float speed={1} rotationIntensity={0.02} floatIntensity={0.1}>
        <Text
          fontSize={1.2}
          font="/fonts/inter-bold.woff"
          anchorX="center"
          anchorY="middle"
          position={[0, 0, 0.5]}
        >
          {text}
          <shaderMaterial
            ref={materialRef}
            vertexShader={stardustVertexShader}
            fragmentShader={stardustFragmentShader}
            uniforms={uniforms}
            transparent
            opacity={opacity}
          />
        </Text>
      </Float>
    </group>
  );
}

// ============================================
// ORBITING SPARK COMPONENT
// ============================================
function OrbitingSpark({ 
  active,
  textBounds = { width: 6, height: 1.5 }
}: { 
  active: boolean;
  textBounds?: { width: number; height: number };
}) {
  const sparkRef = useRef<THREE.Mesh>(null);
  const [trailActive, setTrailActive] = useState(false);
  
  // Rectangular orbit path
  const getOrbitPosition = useCallback((t: number) => {
    const padding = 0.5;
    const w = textBounds.width / 2 + padding;
    const h = textBounds.height / 2 + padding;
    const perimeter = 2 * (2 * w + 2 * h);
    
    // Normalize t to [0, 1]
    const normalizedT = ((t % 1) + 1) % 1;
    const distance = normalizedT * perimeter;
    
    // Calculate position on rectangle
    const topLength = 2 * w;
    const rightLength = 2 * h;
    const bottomLength = 2 * w;
    // leftLength = 2 * h (not used, perimeter calculated differently)
    
    let x = 0, y = 0;
    
    if (distance < topLength) {
      // Top edge (left to right)
      x = -w + distance;
      y = h;
    } else if (distance < topLength + rightLength) {
      // Right edge (top to bottom)
      x = w;
      y = h - (distance - topLength);
    } else if (distance < topLength + rightLength + bottomLength) {
      // Bottom edge (right to left)
      x = w - (distance - topLength - rightLength);
      y = -h;
    } else {
      // Left edge (bottom to top)
      x = -w;
      y = -h + (distance - topLength - rightLength - bottomLength);
    }
    
    return new THREE.Vector3(x, y, 0.6);
  }, [textBounds]);
  
  useEffect(() => {
    if (active) {
      setTimeout(() => setTrailActive(true), 100);
    }
  }, [active]);
  
  useFrame((state) => {
    if (!sparkRef.current || !active) return;
    
    const time = state.clock.getElapsedTime();
    const speed = 0.15;
    const position = getOrbitPosition(time * speed);
    
    sparkRef.current.position.copy(position);
    
    // Pulsing glow
    const pulse = 1 + Math.sin(time * 10) * 0.2;
    sparkRef.current.scale.setScalar(0.08 * pulse);
  });
  
  if (!active) return null;
  
  return (
    <group>
      {trailActive && (
        <Trail
          width={0.8}
          length={40}
          color={new THREE.Color(COLORS.brightGold)}
          attenuation={(t) => t * t}
        >
          <mesh ref={sparkRef}>
            <sphereGeometry args={[1, 16, 16]} />
            <meshBasicMaterial 
              color={COLORS.brightGold} 
              transparent 
              opacity={1}
            />
          </mesh>
        </Trail>
      )}
      {/* Glow effect */}
      <pointLight
        position={sparkRef.current?.position || [0, 0, 0]}
        color={COLORS.warmGold}
        intensity={2}
        distance={3}
      />
    </group>
  );
}

// ============================================
// AMBIENT PARTICLES
// ============================================
function AmbientParticles({ count = 100 }: { count?: number }) {
  const pointsRef = useRef<THREE.Points>(null);
  
  const particles = useMemo(() => {
    const positions = new Float32Array(count * 3);
    const scales = new Float32Array(count);
    
    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 15;
      positions[i * 3 + 1] = (Math.random() - 0.5) * 10;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 5 - 2;
      scales[i] = Math.random();
    }
    
    return { positions, scales };
  }, [count]);
  
  useFrame((state) => {
    if (!pointsRef.current) return;
    
    const time = state.clock.getElapsedTime();
    const positions = pointsRef.current.geometry.attributes.position.array as Float32Array;
    
    for (let i = 0; i < count; i++) {
      positions[i * 3 + 1] += Math.sin(time + particles.scales[i] * 10) * 0.001;
    }
    
    pointsRef.current.geometry.attributes.position.needsUpdate = true;
  });
  
  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={count}
          array={particles.positions}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial
        size={0.03}
        color={COLORS.luxuryGold}
        transparent
        opacity={0.4}
        sizeAttenuation
      />
    </points>
  );
}

// ============================================
// MAIN SCENE COMPONENT
// ============================================
function IntroScene({ onComplete }: { onComplete?: () => void }) {
  const [stage, setStage] = useState<1 | 2 | 3>(1);
  const [progress, setProgress] = useState(0);
  const mousePosition = useRef({ x: 0, y: 0 });
  
  // Logarithmic progress simulation
  useEffect(() => {
    const duration = 5000; // 5 seconds
    const startTime = Date.now();
    
    const animate = () => {
      const elapsed = Date.now() - startTime;
      const linear = Math.min(1, elapsed / duration);
      
      // Logarithmic curve: starts slow, accelerates
      const logProgress = Math.pow(linear, 0.6);
      setProgress(logProgress);
      
      if (linear < 1) {
        requestAnimationFrame(animate);
      }
    };
    
    animate();
  }, []);
  
  const handleGridComplete = useCallback(() => {
    setStage(2);
    // After text appears, start the spark
    setTimeout(() => {
      setStage(3);
    }, 2000);
    
    // Call onComplete after full intro
    setTimeout(() => {
      onComplete?.();
    }, 8000);
  }, [onComplete]);
  
  // Mouse tracking
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      mousePosition.current = {
        x: (e.clientX / window.innerWidth) * 2 - 1,
        y: -(e.clientY / window.innerHeight) * 2 + 1,
      };
    };
    
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);
  
  return (
    <>
      {/* Lighting */}
      <ambientLight intensity={0.3} />
      <pointLight position={[10, 10, 10]} intensity={0.5} color={COLORS.warmGold} />
      <pointLight position={[-10, -10, 5]} intensity={0.3} color={COLORS.deepCrimson} />
      
      {/* Ambient particles */}
      <AmbientParticles count={150} />
      
      {/* Stage 1: Kinetic Grid */}
      <KineticGrid 
        progress={progress}
        mousePosition={mousePosition}
        onComplete={handleGridComplete}
      />
      
      {/* Stage 2: Stardust Typography */}
      <StardustText visible={stage >= 2} text="GALLERY" />
      
      {/* Stage 3: Orbiting Spark */}
      <OrbitingSpark 
        active={stage >= 3}
        textBounds={{ width: 6, height: 1.5 }}
      />
    </>
  );
}

// ============================================
// MAIN EXPORT COMPONENT
// ============================================
export default function CinematicIntro({ 
  onComplete 
}: { 
  onComplete?: () => void;
}) {
  return (
    <div 
      style={{ 
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        background: COLORS.voidBlack,
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
        dpr={[1, 2]}
      >
        <color attach="background" args={[COLORS.voidBlack]} />
        <IntroScene onComplete={onComplete} />
      </Canvas>
      
      {/* Loading indicator */}
      <div
        style={{
          position: 'absolute',
          bottom: '40px',
          left: '50%',
          transform: 'translateX(-50%)',
          color: COLORS.luxuryGold,
          fontFamily: 'system-ui, sans-serif',
          fontSize: '12px',
          letterSpacing: '3px',
          textTransform: 'uppercase',
          opacity: 0.6,
        }}
      >
        Loading Experience
      </div>
    </div>
  );
}
