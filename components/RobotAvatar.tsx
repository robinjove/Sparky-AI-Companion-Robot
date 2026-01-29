import React, { useMemo, useState, useEffect, useRef } from 'react';
import { Hand, ThumbsUp, Smile, Sparkles } from 'lucide-react';
import { RobotState, RobotMood, FaceBox } from '../types';

interface RobotAvatarProps {
  state: RobotState;
  mood: RobotMood;
  isSpeaking: boolean;
  volume: number; // 0 to 1
  isCameraActive: boolean;
  lastGesture: string | null;
  videoRef?: React.RefObject<HTMLVideoElement | null>;
  onFaceDetected?: (boxes: FaceBox[]) => void;
  onGestureDetected?: (gesture: string) => void;
}

const RobotAvatar: React.FC<RobotAvatarProps> = ({ 
  state, 
  mood, 
  isSpeaking, 
  volume, 
  isCameraActive, 
  lastGesture,
  videoRef,
  onFaceDetected,
  onGestureDetected
}) => {
  const [blink, setBlink] = useState(false);
  const [isWindows, setIsWindows] = useState(false);
  const [recognitionPulse, setRecognitionPulse] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const detectionIntervalRef = useRef<number | null>(null);
  const gestureTimeoutRef = useRef<number | null>(null);

  const isListening = state === RobotState.LISTENING;

  useEffect(() => {
    setIsWindows(navigator.userAgent.indexOf('Windows') !== -1);

    let timeoutId: number;
    const scheduleBlink = () => {
      const delay = Math.random() * 3000 + 2000;
      timeoutId = window.setTimeout(() => {
        setBlink(true);
        setTimeout(() => setBlink(false), 120);
        scheduleBlink();
      }, delay);
    };

    scheduleBlink();
    return () => clearTimeout(timeoutId);
  }, []);

  // Neural Sensing & Gesture Logic
  useEffect(() => {
    if (isCameraActive && videoRef?.current) {
      // Periodic "Face Sensing" Loop
      detectionIntervalRef.current = window.setInterval(async () => {
        if (!videoRef.current || videoRef.current.readyState < 2) return;

        // Face Detection (Experimental Web API)
        if ('FaceDetector' in window) {
          try {
            const faceDetector = new (window as any).FaceDetector({ maxDetectedFaces: 3 });
            const faces = await faceDetector.detect(videoRef.current);
            if (faces && faces.length > 0) {
              const boxes: FaceBox[] = faces.map((f: any, i: number) => ({
                ymin: f.boundingBox.top,
                xmin: f.boundingBox.left,
                ymax: f.boundingBox.bottom,
                xmax: f.boundingBox.right,
                id: `face-${i}`
              }));
              onFaceDetected?.(boxes);
              setRecognitionPulse(true);
              setTimeout(() => setRecognitionPulse(false), 500);
            }
          } catch (e) {
            console.warn("Face detection API error:", e);
          }
        }
      }, 2000);

      // Intelligent Gesture Recognition Simulation
      const scheduleGestureCheck = () => {
        if (!isCameraActive) return;

        const baseDelay = mood === 'curious' ? 3000 : 8000;
        const randomJitter = Math.random() * (mood === 'curious' ? 4000 : 7000);
        const nextCheck = baseDelay + randomJitter;

        gestureTimeoutRef.current = window.setTimeout(() => {
          if (Math.random() > 0.35) {
            setIsScanning(true);
            const scanDuration = 1000 + Math.random() * 1000;
            
            setTimeout(() => {
              setIsScanning(false);
              if (!lastGesture && Math.random() > 0.3) {
                const gestures = ['wave', 'thumbs_up', 'peace'];
                const randomGesture = gestures[Math.floor(Math.random() * gestures.length)];
                onGestureDetected?.(randomGesture);
                setRecognitionPulse(true);
                setTimeout(() => setRecognitionPulse(false), 800);
              }
              scheduleGestureCheck();
            }, scanDuration);
          } else {
            scheduleGestureCheck();
          }
        }, nextCheck);
      };

      scheduleGestureCheck();
    }

    return () => {
      if (detectionIntervalRef.current) clearInterval(detectionIntervalRef.current);
      if (gestureTimeoutRef.current) clearTimeout(gestureTimeoutRef.current);
    };
  }, [isCameraActive, videoRef, onFaceDetected, onGestureDetected, mood]);

  useEffect(() => {
    if (lastGesture) {
      setRecognitionPulse(true);
      const timer = setTimeout(() => setRecognitionPulse(false), 700);
      return () => clearTimeout(timer);
    }
  }, [lastGesture]);

  const glowColor = useMemo(() => {
    if (state === RobotState.ERROR) return 'rgba(239, 68, 68, 0.7)';
    if (state === RobotState.CONNECTING) return 'rgba(234, 179, 8, 0.6)';
    if (state === RobotState.THINKING) return 'rgba(59, 130, 246, 0.6)';

    switch (mood) {
      case 'happy': return 'rgba(34, 197, 94, 0.7)';
      case 'excited': return 'rgba(249, 115, 22, 0.8)';
      case 'concerned': return 'rgba(168, 85, 247, 0.7)';
      case 'sad': return 'rgba(59, 130, 246, 0.7)';
      case 'alert': return 'rgba(239, 68, 68, 0.6)';
      case 'nervous': return 'rgba(245, 158, 11, 0.6)';
      case 'curious': return 'rgba(6, 182, 212, 0.7)';
      case 'calm': return 'rgba(94, 234, 212, 0.5)';
      case 'waving': return 'rgba(236, 72, 153, 0.7)';
      case 'surprised': return 'rgba(253, 224, 71, 0.8)';
      case 'thumbs_up': return 'rgba(16, 185, 129, 0.9)';
      case 'facepalm': return 'rgba(244, 63, 94, 0.7)';
      case 'shrug': return 'rgba(45, 212, 191, 0.6)';
      default: return 'rgba(148, 163, 184, 0.5)';
    }
  }, [state, mood]);

  const primaryColor = useMemo(() => {
    if (state === RobotState.ERROR) return 'text-red-500';
    if (state === RobotState.CONNECTING) return 'text-yellow-400';
    if (state === RobotState.THINKING) return 'text-blue-400';

    switch (mood) {
      case 'happy': return 'text-green-400';
      case 'excited': return 'text-orange-400';
      case 'concerned': return 'text-purple-400';
      case 'alert': return 'text-red-400';
      case 'nervous': return 'text-amber-400';
      case 'curious': return 'text-cyan-400';
      case 'sad': return 'text-blue-400';
      case 'calm': return 'text-teal-300';
      case 'waving': return 'text-pink-400';
      case 'surprised': return 'text-yellow-300';
      case 'thumbs_up': return 'text-emerald-400';
      case 'facepalm': return 'text-rose-400';
      case 'shrug': return 'text-teal-400';
      default: return 'text-cyan-400';
    }
  }, [state, mood]);

  const headTransform = useMemo(() => {
    const speakScale = isSpeaking ? 1 + volume * 0.12 : 1;
    const listeningScale = (state === RobotState.LISTENING) ? 1 + volume * 0.05 : 1;
    const hoverY = Math.sin(Date.now() / 500) * 6;
    const jitterX = isSpeaking ? (Math.random() - 0.5) * volume * 4 : 0;
    const jitterY = isSpeaking ? (Math.random() - 0.5) * volume * 4 : 0;
    let base = `scale(${speakScale * listeningScale}) translate(${jitterX}px, ${hoverY + jitterY}px)`;
    
    switch (mood) {
      case 'happy': return `${base} rotate(4deg)`;
      case 'sad': return `${base} rotate(-4deg) scale(0.9)`;
      case 'excited': return `${base} translateY(-10px) rotate(${Math.sin(Date.now()/100)*2}deg)`;
      case 'alert': return `${base} scale(1.15)`;
      case 'nervous': return `${base} rotate(${Math.sin(Date.now()/50)*1.5}deg) scale(1.02)`;
      case 'curious': return `${base} rotate(${Math.sin(Date.now()/400)*5}deg)`;
      case 'calm': return `${base} scale(0.98)`;
      case 'waving': return `${base} rotate(${Math.sin(Date.now()/150)*8}deg)`;
      case 'surprised': return `${base} scale(1.2) translateY(-15px)`;
      case 'thumbs_up': return `${base} scale(1.1) rotate(-3deg)`;
      case 'facepalm': return `${base} rotate(-12deg) translateY(10px)`;
      case 'shrug': return `${base} scale(1.05) translateY(-5px)`;
      default: return base;
    }
  }, [mood, isSpeaking, state, volume]);

  const getEyebrowStyle = (index: number) => {
    let rotate = '0deg';
    let translateY = '0px';
    let scaleX = 1;
    let opacity = 0.8;
    switch (mood) {
      case 'happy': translateY = '-16px'; rotate = index === 0 ? '-20deg' : '20deg'; break;
      case 'sad': translateY = '-8px'; rotate = index === 0 ? '25deg' : '-25deg'; break;
      case 'concerned': translateY = '-6px'; rotate = index === 0 ? '18deg' : '-18deg'; scaleX = 0.85; break;
      case 'nervous': translateY = '-10px'; rotate = index === 0 ? '12deg' : '-12deg'; break;
      case 'excited': translateY = '-20px'; scaleX = 1.3; rotate = index === 0 ? '-10deg' : '10deg'; break;
      case 'alert': translateY = '0px'; rotate = index === 0 ? '35deg' : '-35deg'; break;
      case 'curious': if (index === 0) { translateY = '-24px'; rotate = '-15deg'; } else { translateY = '-7px'; rotate = '15deg'; } break;
      case 'calm': translateY = '-9px'; opacity = 0.3; break;
      case 'waving': translateY = '-18px'; rotate = index === 0 ? '-25deg' : '25deg'; break;
      case 'surprised': translateY = '-30px'; scaleX = 0.7; break;
      case 'thumbs_up': translateY = '-16px'; rotate = '0deg'; scaleX = 1.4; break;
      case 'facepalm': if (index === 0) { translateY = '3px'; rotate = '40deg'; } else { translateY = '-14px'; rotate = '-10deg'; } break;
      case 'shrug': translateY = '-24px'; rotate = index === 0 ? '-8deg' : '8deg'; scaleX = 1.15; break;
      default: translateY = '-12px'; opacity = 0.5;
    }
    return { transform: `translateY(${translateY}) rotate(${rotate}) scaleX(${scaleX})`, opacity };
  };

  const getEyeShape = (index: number) => {
    if (blink) return { transform: 'scaleY(0.05)', borderRadius: '10%' };
    let scaleY = isSpeaking ? 1 + volume * 0.4 : 1;
    let borderRadius = '50%';
    let rotate = '0deg';
    let translateY = '0px';
    let scaleX = 1;
    const twitch = (mood === 'nervous' || mood === 'alert') ? Math.sin(Date.now() / 40) * 0.05 : 0;
    scaleX += twitch;
    scaleY += twitch;
    switch (mood) {
      case 'happy': borderRadius = '50%'; scaleX *= 1.3; scaleY *= 1.3; translateY = '-9px'; break;
      case 'sad': borderRadius = '40% 40% 100% 100%'; scaleY *= 0.45; scaleX *= 1.15; rotate = index === 0 ? '25deg' : '-25deg'; translateY = '10px'; break;
      case 'concerned': borderRadius = '50%'; rotate = index === 0 ? '-15deg' : '15deg'; translateY = '3px'; scaleX = 0.9; break;
      case 'nervous': borderRadius = '50%'; scaleX *= 0.95; scaleY *= 0.95; translateY = '1.5px'; break;
      case 'excited': borderRadius = '45%'; scaleY *= 1.5; scaleX = 1.1; break;
      case 'alert': borderRadius = '10%'; scaleY = 0.25; scaleX = 1.2; break;
      case 'curious': if (index === 0) { scaleY *= 1.6; scaleX *= 1.2; borderRadius = '50%'; translateY = '-7px'; } else { scaleY *= 0.55; scaleX *= 0.85; borderRadius = '40% 40% 50% 50%'; rotate = '15deg'; translateY = '6px'; } break;
      case 'calm': scaleY = 0.6; translateY = '4.5px'; borderRadius = '50% 50% 40% 40%'; break;
      case 'waving': borderRadius = '50% 50% 15% 15%'; scaleY = 0.45 + Math.sin(Date.now()/200)*0.15; rotate = index === 0 ? '-10deg' : '10deg'; break;
      case 'surprised': borderRadius = '50%'; scaleX = 1.35; scaleY = 1.35; break;
      case 'thumbs_up': borderRadius = '15%'; rotate = index === 0 ? '-45deg' : '45deg'; scaleX = 0.75; scaleY = 0.75; break;
      case 'facepalm': scaleY = 0.15; translateY = '6px'; rotate = index === 0 ? '20deg' : '0deg'; break;
      case 'shrug': borderRadius = '50%'; scaleX = 1.1; scaleY = 1.1; translateY = '-3px'; break;
    }
    return { transform: `scale(${scaleX}, ${scaleY}) rotate(${rotate}) translateY(${translateY})`, borderRadius };
  };

  const spectrogramData = useMemo(() => {
    const barCount = 100;
    let multiplier = 240;
    if (mood === 'excited' || mood === 'surprised') multiplier = 350;
    if (mood === 'sad' || mood === 'facepalm') multiplier = 120;
    if (mood === 'calm' || mood === 'shrug') multiplier = 140;
    if (mood === 'waving') multiplier = 280;
    if (mood === 'nervous') multiplier = 180;
    return { barCount, multiplier };
  }, [mood]);

  const BASE_SIZE = 286; 
  const cameraScale = isCameraActive ? 0.75 : 1.0;
  const finalScale = cameraScale;

  const renderGestureBadge = () => {
    if (!lastGesture) return null;
    const iconSize = 20;
    let Icon = Sparkles;
    let colorClass = 'bg-blue-500';
    if (lastGesture === 'wave') { Icon = Hand; colorClass = 'bg-pink-500'; }
    else if (lastGesture === 'thumbs_up') { Icon = ThumbsUp; colorClass = 'bg-emerald-500'; }
    else if (lastGesture === 'peace') { Icon = Smile; colorClass = 'bg-yellow-500'; }

    return (
      <div 
        className={`absolute -top-16 left-1/2 -translate-x-1/2 z-[100] px-3.5 py-1.5 rounded-full ${colorClass} text-white shadow-[0_0_20px_rgba(255,255,255,0.3)] flex items-center gap-2 whitespace-nowrap`}
        style={{ animation: 'gesture-pop 2.2s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards' }}
      >
        <div className="relative">
          <Icon size={iconSize} className="animate-bounce" />
          <div className="absolute inset-0 bg-white/40 blur-md rounded-full animate-ping opacity-20" />
        </div>
        <span className="text-[10px] font-black uppercase tracking-widest">{lastGesture}</span>
      </div>
    );
  };

  return (
    <div 
      className="relative flex items-center justify-center perspective-1000 group transition-all duration-500"
      style={{ width: `${BASE_SIZE * finalScale}px`, height: `${BASE_SIZE * finalScale}px` }}
    >
      <style>{`
        @keyframes scan-line {
          0% { top: 10%; opacity: 0; }
          20% { opacity: 0.8; }
          80% { opacity: 0.8; }
          100% { top: 90%; opacity: 0; }
        }
        @keyframes eye-sweep {
          0% { transform: translateX(-150%) skewX(-25deg); opacity: 0; }
          20% { opacity: 0.6; }
          80% { opacity: 0.6; }
          100% { transform: translateX(250%) skewX(-25deg); opacity: 0; }
        }
        @keyframes recognition-ping {
          0% { transform: scale(0.8); opacity: 0; border-width: 6px; }
          40% { opacity: 0.8; }
          100% { transform: scale(1.8); opacity: 0; border-width: 1px; }
        }
        @keyframes robot-breathe {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-4px); }
        }
        @keyframes hover-bob {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-8px); }
        }
        @keyframes gesture-pop {
          0% { opacity: 0; transform: translate(-50%, 20px) scale(0.6); }
          10% { opacity: 1; transform: translate(-50%, 0px) scale(1.1); }
          20% { transform: translate(-50%, 0px) scale(1); }
          85% { opacity: 1; transform: translate(-50%, -5px) scale(1); }
          100% { opacity: 0; transform: translate(-50%, -25px) scale(0.85); }
        }
      `}</style>
      
      <div 
        className="relative flex items-center justify-center transition-all duration-700 ease-out group-hover:scale-105"
        style={{ 
          transform: `scale(${finalScale})`,
          width: `${BASE_SIZE}px`,
          height: `${BASE_SIZE}px`,
          animation: state === RobotState.IDLE ? 'robot-breathe 4s ease-in-out infinite' : 'none'
        }}
      >
        <div 
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[240px] h-[240px] rounded-full blur-[50px] transition-all duration-700 opacity-40 group-hover:opacity-80 group-hover:blur-[80px]"
          style={{ 
            backgroundColor: glowColor,
            transform: isSpeaking ? `translate(-50%, -50%) scale(${1.5 + volume})` : 'translate(-50%, -50%) scale(1)'
          }}
        />

        <div 
          className="relative z-30 flex flex-col items-center justify-center transition-all duration-500 ease-out group-hover:animate-[hover-bob_3s_infinite_ease-in-out]" 
          style={{ transform: headTransform }}
        >
          {renderGestureBadge()}
          {recognitionPulse && (
            <div className="absolute inset-0 z-50 pointer-events-none flex items-center justify-center">
              <div className="w-full h-full rounded-[4rem] border-4 border-white/80" style={{ animation: 'recognition-ping 0.7s ease-out forwards' }} />
            </div>
          )}
          <div className="w-[218px] h-[218px] bg-slate-900 border-2 border-slate-800 rounded-[4rem] flex items-center justify-center shadow-[0_0_40px_rgba(0,0,0,0.7)] relative overflow-hidden transition-all duration-500 group-hover:border-slate-500 group-hover:shadow-[0_0_60px_rgba(0,0,0,0.8)]">
            <div className="absolute inset-1.5 bg-slate-950/95 rounded-[3.8rem] flex flex-col items-center justify-center border border-white/5 transition-all duration-500 group-hover:bg-slate-900/95">
              {isScanning && (
                <div className="absolute inset-x-8 h-1 bg-blue-500/60 shadow-[0_0_15px_rgba(59,130,246,0.8)] z-[60] rounded-full" style={{ animation: 'scan-line 1.5s ease-in-out infinite' }} />
              )}
              <div className="flex gap-[44px] mb-3 items-center relative">
                {[0, 1].map((i) => (
                  <div key={i} className="relative flex flex-col items-center group/eye">
                    <div className={`absolute inset-[-8px] blur-2xl opacity-25 ${primaryColor.replace('text', 'bg')} transition-all duration-500 group-hover:opacity-60`} />
                    <div className={`absolute w-8 h-1 rounded-full transition-all duration-500 ${primaryColor.replace('text', 'bg')} group-hover:opacity-100 group-hover:scale-x-110`} style={getEyebrowStyle(i)} />
                    <div className={`w-8 h-8 ${primaryColor.replace('text', 'bg')} transition-all duration-200 shadow-[0_0_16px_rgba(255,255,255,0.35)] group-hover:shadow-[0_0_32px_rgba(255,255,255,0.6)] overflow-hidden relative group-hover:scale-110`} style={getEyeShape(i)}>
                      {isCameraActive && (
                        <div className="absolute inset-0 w-3 bg-white/40 blur-[2px] pointer-events-none" style={{ animation: 'eye-sweep 2s ease-in-out infinite' }} />
                      )}
                      <div className="absolute top-1 left-1 w-1.5 h-1.5 bg-white/60 rounded-full blur-[1px] transition-transform duration-200" style={{ transform: (isSpeaking || isListening) ? `translate(${volume * 4}px, ${volume * 2}px) scale(${1 + volume * 0.4})` : 'none' }} />
                    </div>
                  </div>
                ))}
              </div>
              <div className="relative h-12 flex items-center justify-center gap-[1px] px-4 w-full mt-0.5">
                {[...Array(spectrogramData.barCount)].map((_, i) => {
                  const total = spectrogramData.barCount;
                  const mid = total / 2;
                  const distFromMid = Math.abs(i - mid);
                  const normalizedDist = distFromMid / mid;
                  let moodShift = 0;
                  if (mood === 'happy' || mood === 'excited' || mood === 'waving' || mood === 'thumbs_up') moodShift = (mid - distFromMid) * 0.6;
                  else if (mood === 'sad' || mood === 'facepalm') moodShift = -(mid - distFromMid) * 0.6;
                  const time = Date.now() / 120;
                  const noise1 = Math.sin(time + i * 0.5) * 0.6;
                  const noise2 = Math.cos(time * 0.7 + i * 0.3) * 0.4;
                  const taper = Math.pow(1 - normalizedDist, 0.4);
                  const baseHeight = 4;
                  const activeHeight = taper * (volume * spectrogramData.multiplier * 0.6 * (0.4 + Math.abs(noise1 + noise2)));
                  const heightVal = (isSpeaking || isListening) ? Math.max(baseHeight, activeHeight) : baseHeight;
                  return (
                    <div key={i} className={`w-[1px] rounded-full transition-all duration-500 ${primaryColor.replace('text', 'bg')} group-hover:brightness-125`} style={{ height: `${heightVal}%`, transform: `translateY(${-moodShift}px)`, opacity: (isSpeaking || isListening) ? Math.max(0.4, taper) : (normalizedDist > 0.6 ? 0.1 : 0.25) }} />
                  );
                })}
              </div>
            </div>
          </div>
          <div className="absolute -top-[12px] left-1/2 -translate-x-1/2 w-1 h-[12px] bg-slate-800 rounded-full group-hover:bg-slate-600 transition-colors duration-500">
            <div className={`absolute -top-2 left-1/2 -translate-x-1/2 w-3 h-3 rounded-full transition-all duration-300 ${state === RobotState.SPEAKING ? 'bg-blue-400 shadow-[0_0_18px_#60a5fa] scale-125' : (state === RobotState.CONNECTING ? 'bg-amber-400 shadow-[0_0_10px_#fbbf24] animate-pulse' : 'bg-slate-700 scale-100 group-hover:bg-slate-500 group-hover:shadow-[0_0_10px_rgba(255,255,255,0.2)]')}`} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default RobotAvatar;