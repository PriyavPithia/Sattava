import React, { useEffect, useState } from 'react';
import YouTube from 'react-youtube';

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
  const [player, setPlayer] = useState<any>(null);
  const [isReady, setIsReady] = useState(false);
  const [lastSeekTime, setLastSeekTime] = useState<number | null>(null);

  useEffect(() => {
    const handleSeek = async () => {
      if (player && isReady && currentTime > 0 && currentTime !== lastSeekTime) {
        try {
          await player.seekTo(currentTime, true);
          await player.playVideo();
          setLastSeekTime(currentTime);
        } catch (error) {
          // Handle error silently
        }
      }
    };

    handleSeek();
  }, [currentTime, player, isReady]);

  const onReady = (event: any) => {
    setPlayer(event.target);
    setIsReady(true);
  };

  const opts = {
    width: '100%',
    height: '100%',
    playerVars: {
      autoplay: 0,
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