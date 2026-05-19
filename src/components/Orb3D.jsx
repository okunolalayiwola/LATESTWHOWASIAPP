import { useRef, useMemo } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Float, MeshTransmissionMaterial } from '@react-three/drei'
import * as THREE from 'three'

function OrbMesh({ scrollProgress = 0, isSpeaking = false }) {
  const meshRef = useRef()
  const groupRef = useRef()

  const uniforms = useMemo(() => ({
    uTime: { value: 0 },
    uScroll: { value: 0 },
    uSpeaking: { value: 0 },
  }), [])

  useFrame((state) => {
    uniforms.uTime.value = state.clock.elapsedTime
    uniforms.uScroll.value = scrollProgress
    uniforms.uSpeaking.value = isSpeaking ? 1 : 0

    if (meshRef.current) {
      const morph = Math.sin(state.clock.elapsedTime * 0.3) * 0.08 +
                    Math.sin(state.clock.elapsedTime * 0.7) * 0.04 +
                    scrollProgress * 0.1 +
                    (isSpeaking ? Math.sin(state.clock.elapsedTime * 2) * 0.05 : 0)
      meshRef.current.scale.setScalar(1 + morph)
      meshRef.current.rotation.x = Math.sin(state.clock.elapsedTime * 0.15) * 0.1
      meshRef.current.rotation.y = state.clock.elapsedTime * 0.1 + scrollProgress * 0.5
    }
    if (groupRef.current) {
      groupRef.current.rotation.z = Math.sin(state.clock.elapsedTime * 0.1) * 0.05
    }
  })

  return (
    <group ref={groupRef}>
      {/* Main orb */}
      <mesh ref={meshRef}>
        <icosahedronGeometry args={[1.8, 3]} />
        <MeshTransmissionMaterial
          backside
          samples={8}
          thickness={0.5}
          chromaticAberration={0.1}
          anisotropy={0.3}
          distortion={0.2}
          distortionScale={0.3}
          temporalDistortion={0.1}
          clearcoat={0.3}
          clearcoatRoughness={0.2}
          envMapIntensity={1.5}
          color="#FFD700"
          metalness={0.1}
          roughness={0.2}
          ior={1.5}
        />
      </mesh>

      {/* Inner glow core */}
      <mesh>
        <sphereGeometry args={[0.6, 16, 16]} />
        <meshBasicMaterial color="#38BDF8" transparent opacity={0.3} />
      </mesh>

      {/* Orbital ring */}
      <mesh rotation={[0.3, 0, 0]}>
        <ringGeometry args={[2.1, 2.15, 64]} />
        <meshBasicMaterial color="#FFD700" transparent opacity={0.2} side={THREE.DoubleSide} />
      </mesh>

      {/* Particle ring */}
      {Array.from({ length: 30 }).map((_, i) => (
        <mesh
          key={i}
          position={[
            Math.cos((i / 30) * Math.PI * 2) * 2.4,
            Math.sin((i / 30) * Math.PI * 2) * 2.4,
            0,
          ]}
        >
          <sphereGeometry args={[0.03, 8, 8]} />
          <meshBasicMaterial color={i % 2 === 0 ? '#FFD700' : '#FB7185'} />
        </mesh>
      ))}
    </group>
  )
}

function Particles({ count = 80 }) {
  const ref = useRef()
  const positions = useMemo(() => {
    const pos = new Float32Array(count * 3)
    for (let i = 0; i < count; i++) {
      const r = 3 + Math.random() * 4
      const theta = Math.random() * Math.PI * 2
      const phi = Math.acos(2 * Math.random() - 1)
      pos[i * 3] = r * Math.sin(phi) * Math.cos(theta)
      pos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta)
      pos[i * 3 + 2] = r * Math.cos(phi)
    }
    return pos
  }, [count])

  useFrame((state) => {
    if (ref.current) {
      ref.current.rotation.y = state.clock.elapsedTime * 0.02
      ref.current.rotation.x = Math.sin(state.clock.elapsedTime * 0.01) * 0.1
    }
  })

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={count}
          array={positions}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial
        size={0.04}
        color="#FFD700"
        transparent
        opacity={0.4}
        sizeAttenuation
      />
    </points>
  )
}

export default function Orb3D({ scrollProgress = 0, isSpeaking = false, className = '' }) {
  return (
    <div className={`w-full h-full ${className}`}>
      <Canvas camera={{ position: [0, 0, 5.5], fov: 45 }} dpr={[1, 2]}>
        <ambientLight intensity={0.5} />
        <pointLight position={[5, 5, 5]} intensity={1} color="#FFD700" />
        <pointLight position={[-3, -2, 2]} intensity={0.5} color="#38BDF8" />
        <Float speed={1} rotationIntensity={0.1} floatIntensity={0.3}>
          <OrbMesh scrollProgress={scrollProgress} isSpeaking={isSpeaking} />
        </Float>
        <Particles />
      </Canvas>
    </div>
  )
}
