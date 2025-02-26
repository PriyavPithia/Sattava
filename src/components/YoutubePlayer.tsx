import React, { useEffect, useState, useRef } from 'react';
import YouTube, { YouTubeEvent, YouTubePlayer as YTPlayer } from 'react-youtube';

interface YoutubePlayerProps {
  videoId: string;
  currentTime?: number;
  onSeek?: (timestamp: number) => void;
}

const YoutubePlayer: React.FC<YoutubePlayerProps> = ({ 
  videoId,
  currentTime = 0,
  onSeek
}) => {
  const [player, setPlayer] = useState<YTPlayer | null>(null);
  const [isReady, setIsReady] = useState(false);
  const lastVideoId = useRef(videoId);
  const seekTimeout = useRef<NodeJS.Timeout | undefined>();
  const lastSeekTime = useRef<number>(0);
  const timeUpdateInterval = useRef<NodeJS.Timeout | undefined>();

  // Reset player state when video changes
  useEffect(() => {
    if (videoId !== lastVideoId.current) {
      console.log('DEBUG: Video ID changed from', lastVideoId.current, 'to', videoId);
      setIsReady(false);
      setPlayer(null);
      lastVideoId.current = videoId;
    }
  }, [videoId]);

  // Handle seeking and playing
  useEffect(() => {
    const handleSeek = async () => {
      if (!player || !isReady || currentTime === lastSeekTime.current) return;

      console.log('DEBUG: Seeking to', currentTime);
      
      try {
        // Clear any pending seek timeout
        if (seekTimeout.current) {
          clearTimeout(seekTimeout.current);
        }

        // Update last seek time
        lastSeekTime.current = currentTime;

        // Perform the seek operation
        await player.seekTo(currentTime, true);
        await player.playVideo();
      } catch (error) {
        console.error('Error seeking video:', error);
      }
    };

    // Add a small delay to ensure the player is ready
    seekTimeout.current = setTimeout(handleSeek, 100);

    return () => {
      if (seekTimeout.current) {
        clearTimeout(seekTimeout.current);
      }
    };
  }, [currentTime, player, isReady]);

  // Set up time update interval when player is ready
  useEffect(() => {
    if (player && isReady && onSeek) {
      // Clear any existing interval
      if (timeUpdateInterval.current) {
        clearInterval(timeUpdateInterval.current);
      }

      // Set up new interval to track current time
      timeUpdateInterval.current = setInterval(() => {
        try {
          const currentTime = player.getCurrentTime();
          if (typeof currentTime === 'number' && currentTime !== lastSeekTime.current) {
            onSeek(currentTime);
          }
        } catch (error) {
          console.error('Error getting current time:', error);
        }
      }, 1000); // Update every second
    }

    return () => {
      if (timeUpdateInterval.current) {
        clearInterval(timeUpdateInterval.current);
      }
    };
  }, [player, isReady, onSeek]);

  const onReady = (event: YouTubeEvent) => {
    console.log('DEBUG: YouTube player ready');
    setPlayer(event.target);
    setIsReady(true);

    // If we have a currentTime waiting, seek to it
    if (currentTime > 0) {
      console.log('DEBUG: Initial seek to', currentTime);
      lastSeekTime.current = currentTime;
      event.target.seekTo(currentTime, true);
      event.target.playVideo();
    }
  };

  const opts = {
    width: '100%',
    height: '100%',
    playerVars: {
      autoplay: 1,
      modestbranding: 1,
      rel: 0,
      enablejsapi: 1,
    },
  };

  return (
    <div className="w-full h-full">
      <YouTube
        videoId={videoId}
        opts={opts}
        onReady={onReady}
        className="w-full h-full"
        iframeClassName="w-full h-full"
      />
    </div>
  );
};

export default YoutubePlayer;