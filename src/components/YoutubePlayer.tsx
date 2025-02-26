import React, { useEffect, useRef, useState } from 'react';
import YouTube, { YouTubeEvent, YouTubePlayer as YTPlayer } from 'react-youtube';

interface YoutubePlayerProps {
  videoId: string;
  currentTime?: number;
  onSeek?: (time: number) => void;
  onReady?: () => void;
}

const YoutubePlayer: React.FC<YoutubePlayerProps> = ({
  videoId,
  currentTime = 0,
  onSeek,
  onReady
}) => {
  const playerRef = useRef<YTPlayer | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const lastTimeUpdateRef = useRef<number>(0);
  const timeUpdateIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // YouTube player options
  const opts = {
    height: '360',
    width: '640',
    playerVars: {
      autoplay: 0,
      modestbranding: 1,
      rel: 0,
      origin: window.location.origin,
      enablejsapi: 1,
      playsinline: 1,
    },
  };

  // Clear interval on unmount
  useEffect(() => {
    return () => {
      if (timeUpdateIntervalRef.current) {
        clearInterval(timeUpdateIntervalRef.current);
      }
    };
  }, []);

  // Handle player ready event
  const handleReady = (event: YouTubeEvent) => {
    playerRef.current = event.target;
    setIsReady(true);
    if (onReady) onReady();

    // Set up time update interval
    if (timeUpdateIntervalRef.current) {
      clearInterval(timeUpdateIntervalRef.current);
    }

    timeUpdateIntervalRef.current = setInterval(() => {
      if (playerRef.current && !isPaused) {
        const currentTime = playerRef.current.getCurrentTime();
        if (Math.abs(currentTime - lastTimeUpdateRef.current) > 0.5) {
          lastTimeUpdateRef.current = currentTime;
          if (onSeek) onSeek(currentTime);
        }
      }
    }, 1000);
  };

  // Handle state changes
  const handleStateChange = (event: YouTubeEvent) => {
    const playerState = event.data;
    
    // Update pause state based on player state
    setIsPaused(playerState === YouTube.PlayerState.PAUSED);

    // Handle different player states
    switch (playerState) {
      case YouTube.PlayerState.PLAYING:
        setIsPaused(false);
        break;
      case YouTube.PlayerState.PAUSED:
        setIsPaused(true);
        break;
      case YouTube.PlayerState.ENDED:
        setIsPaused(true);
        if (timeUpdateIntervalRef.current) {
          clearInterval(timeUpdateIntervalRef.current);
        }
        break;
    }
  };

  // Handle seeking
  useEffect(() => {
    if (isReady && playerRef.current && currentTime !== undefined) {
      const playerTime = playerRef.current.getCurrentTime();
      if (Math.abs(playerTime - currentTime) > 1) {
        playerRef.current.seekTo(currentTime, true);
      }
    }
  }, [currentTime, isReady]);

  return (
    <div className="relative aspect-video">
      <YouTube
        videoId={videoId}
        opts={opts}
        onReady={handleReady}
        onStateChange={handleStateChange}
        className="absolute top-0 left-0 w-full h-full"
        iframeClassName="w-full h-full"
      />
    </div>
  );
};

export default YoutubePlayer;