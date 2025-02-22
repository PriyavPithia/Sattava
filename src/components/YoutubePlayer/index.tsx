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

  // Reset player state when video changes
  useEffect(() => {
    if (videoId !== lastVideoId.current) {
      console.log('DEBUG: Video ID changed from', lastVideoId.current, 'to', videoId);
      setIsReady(false);
      lastVideoId.current = videoId;
    }
  }, [videoId]);

  // Handle seeking and playing
  useEffect(() => {
    if (player && isReady && currentTime > 0) {
      console.log('DEBUG: Seeking to', currentTime);
      
      // Clear any pending seek timeout
      if (seekTimeout.current) {
        clearTimeout(seekTimeout.current);
      }

      // Add a small delay to ensure the player is ready
      seekTimeout.current = setTimeout(() => {
        try {
          player.seekTo(currentTime, true);
          player.playVideo();
        } catch (error) {
          console.error('Error seeking video:', error);
        }
      }, 500);
    }

    return () => {
      if (seekTimeout.current) {
        clearTimeout(seekTimeout.current);
      }
    };
  }, [currentTime, player, isReady]);

  const onReady = (event: YouTubeEvent) => {
    console.log('DEBUG: YouTube player ready');
    setPlayer(event.target);
    setIsReady(true);

    // If we have a currentTime waiting, seek to it
    if (currentTime > 0) {
      console.log('DEBUG: Initial seek to', currentTime);
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