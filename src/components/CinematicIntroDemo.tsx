import { useState } from 'react';
import CinematicIntro from './CinematicIntro';

/**
 * Demo wrapper to test CinematicIntro component
 * Import this in App.tsx to see the intro in action
 */
export default function CinematicIntroDemo() {
  const [showIntro, setShowIntro] = useState(true);
  const [_introComplete, setIntroComplete] = useState(false);

  const handleComplete = () => {
    setIntroComplete(true);
    // Fade out after completion
    setTimeout(() => {
      setShowIntro(false);
    }, 1000);
  };

  return (
    <>
      {showIntro && <CinematicIntro onComplete={handleComplete} />}
      
      {/* Main content (shows after intro) */}
      {!showIntro && (
        <div
          style={{
            width: '100vw',
            height: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: '#050505',
            color: '#D4AF37',
            fontFamily: 'system-ui, sans-serif',
          }}
        >
          <div style={{ textAlign: 'center' }}>
            <h1 style={{ fontSize: '3rem', marginBottom: '1rem' }}>
              Welcome to the Gallery
            </h1>
            <p style={{ opacity: 0.6 }}>Intro Complete!</p>
            <button
              onClick={() => {
                setShowIntro(true);
                setIntroComplete(false);
              }}
              style={{
                marginTop: '2rem',
                padding: '1rem 2rem',
                background: 'transparent',
                border: '1px solid #D4AF37',
                color: '#D4AF37',
                cursor: 'pointer',
                fontSize: '1rem',
                letterSpacing: '2px',
              }}
            >
              REPLAY INTRO
            </button>
          </div>
        </div>
      )}
    </>
  );
}
