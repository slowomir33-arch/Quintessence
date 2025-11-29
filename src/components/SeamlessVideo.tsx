import React, { useRef, useEffect, useState, useCallback } from 'react';

interface SeamlessVideoProps {
  src: string;
  className?: string;
  style?: React.CSSProperties;
  playbackRate?: number;
}

const SeamlessVideo: React.FC<SeamlessVideoProps> = ({ 
  src, 
  className = "", 
  style, 
  playbackRate = 1 
}) => {
  const videoRef1 = useRef<HTMLVideoElement>(null);
  const videoRef2 = useRef<HTMLVideoElement>(null);
  const [activeVideo, setActiveVideo] = useState<1 | 2>(1);
  const [duration, setDuration] = useState(0);
  
  // Czas przenikania w sekundach
  const FADE_DURATION = 1.5; 

  const setRate = useCallback((video: HTMLVideoElement | null) => {
    if (video) video.playbackRate = playbackRate;
  }, [playbackRate]);

  useEffect(() => {
    setRate(videoRef1.current);
    setRate(videoRef2.current);
  }, [setRate]);

  const handleTimeUpdate = (e: React.SyntheticEvent<HTMLVideoElement>) => {
    const currentVideo = e.currentTarget;
    if (!duration) return;

    const timeLeft = duration - currentVideo.currentTime;
    // Trigger switch slightly before end
    const threshold = FADE_DURATION * playbackRate;

    if (timeLeft <= threshold) {
      const nextId = activeVideo === 1 ? 2 : 1;
      const nextVideo = nextId === 1 ? videoRef1.current : videoRef2.current;
      
      if (nextVideo && nextVideo.paused) {
        nextVideo.currentTime = 0;
        setRate(nextVideo);
        nextVideo.play().catch(console.error);
        setActiveVideo(nextId);
      }
    }
  };

  const onLoadedMetadata = (e: React.SyntheticEvent<HTMLVideoElement>) => {
    setDuration(e.currentTarget.duration);
    setRate(e.currentTarget);
    if (activeVideo === 1 && e.currentTarget === videoRef1.current) {
      e.currentTarget.play().catch(console.error);
    }
  };

  // Common props for both videos
  const videoProps = {
    src,
    muted: true,
    playsInline: true,
    preload: "auto",
    className: "absolute inset-0 w-full h-full object-cover",
    style: { ...style, transition: `opacity ${FADE_DURATION}s ease-in-out` },
    onLoadedMetadata
  };

  return (
    <div className={`${className} relative overflow-hidden`}>
      <video
        ref={videoRef1}
        {...videoProps}
        style={{
          ...videoProps.style,
          opacity: activeVideo === 1 ? 1 : 0,
          zIndex: activeVideo === 1 ? 10 : 0
        }}
        onTimeUpdate={activeVideo === 1 ? handleTimeUpdate : undefined}
      />
      <video
        ref={videoRef2}
        {...videoProps}
        style={{
          ...videoProps.style,
          opacity: activeVideo === 2 ? 1 : 0,
          zIndex: activeVideo === 2 ? 10 : 0
        }}
        onTimeUpdate={activeVideo === 2 ? handleTimeUpdate : undefined}
      />
    </div>
  );
};

export default SeamlessVideo;
