import { useState } from 'react';
import CinematicIntroDemo from '../components/CinematicIntroDemo';
import { CinematicIntroV2Demo } from '../components/CinematicIntroV2';

/**
 * Test page for CinematicIntro components
 * Access at: /intro
 * Toggle between V1 and V2 using buttons in top-right corner
 */
export default function IntroTest() {
  const [version, setVersion] = useState<'v1' | 'v2'>('v2');

  return (
    <div style={{ width: '100vw', height: '100vh', background: '#050505' }}>
      {/* Version Toggle */}
      <div
        style={{
          position: 'fixed',
          top: '1rem',
          right: '1rem',
          zIndex: 10000,
          display: 'flex',
          gap: '0.5rem',
        }}
      >
        <button
          onClick={() => setVersion('v1')}
          style={{
            padding: '0.5rem 1rem',
            background: version === 'v1' ? '#FFD700' : '#333',
            color: version === 'v1' ? '#000' : '#fff',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontWeight: 'bold',
          }}
        >
          V1
        </button>
        <button
          onClick={() => setVersion('v2')}
          style={{
            padding: '0.5rem 1rem',
            background: version === 'v2' ? '#FFD700' : '#333',
            color: version === 'v2' ? '#000' : '#fff',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontWeight: 'bold',
          }}
        >
          V2
        </button>
      </div>

      {/* Render selected version */}
      {version === 'v1' ? <CinematicIntroDemo /> : <CinematicIntroV2Demo />}
    </div>
  );
}
