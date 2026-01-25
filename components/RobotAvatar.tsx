import React, { useMemo, useState, useEffect } from 'react';
import { RobotState, RobotMood } from '../types';

interface RobotAvatarProps {
  state: RobotState;
  mood: RobotMood;
  isSpeaking: boolean;
  volume: number; // 0 to 1
  isCameraActive: boolean;
  lastGesture: string | null;
}

const RobotAvatar: React.FC<RobotAvatarProps> = ({ state, mood, isSpeaking, volume, isCameraActive, lastGesture }) => {
  const [blink, setBlink] = useState(false);
  const [isWindows, setIsWindows] = useState(false);
  const [recognitionPulse, setRecognitionPulse] = useState(false);

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
    
    // Add jitter when speaking
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
      case 'happy':
        translateY = '-22px';
        rotate = index === 0 ? '-20deg' : '20deg';
        break;
      case 'sad':
        translateY = '-12px';
        rotate = index === 0 ? '25deg' : '-25deg';
        break;
      case 'concerned':
        translateY = '-8px';
        rotate = index === 0 ? '18deg' : '-18deg';
        scaleX = 0.85;
        break;
      case 'nervous':
        translateY = '-14px';
        rotate = index === 0 ? '12deg' : '-12deg';
        break;
      case 'excited':
        translateY = '-28px';
        scaleX = 1.3;
        rotate = index === 0 ? '-10deg' : '10deg';
        break;
      case 'alert':
        translateY = '0px';
        rotate = index === 0 ? '35deg' : '-35deg';
        break;
      case 'curious':
        if (index === 0) {
          translateY = '-32px';
          rotate = '-15deg';
        } else {
          translateY = '-10px';
          rotate = '15deg';
        }
        break;
      case 'calm':
        translateY = '-12px';
        opacity = 0.3;
        break;
      case 'waving':
        translateY = '-24px';
        rotate = index === 0 ? '-25deg' : '25deg';
        break;
      case 'surprised':
        translateY = '-40px';
        scaleX = 0.7;
        break;
      case 'thumbs_up':
        translateY = '-22px';
        rotate = '0deg';
        scaleX = 1.4;
        break;
      case 'facepalm':
        if (index === 0) {
          translateY = '4px';
          rotate = '40deg';
        } else {
          translateY = '-18px';
          rotate = '-10deg';
        }
        break;
      case 'shrug':
        translateY = '-32px';
        rotate = index === 0 ? '-8deg' : '8deg';
        scaleX = 1.15;
        break;
      default:
        translateY = '-16px';
        opacity = 0.5;
    }

    return {
      transform: `translateY(${translateY}) rotate(${rotate}) scaleX(${scaleX})`,
      opacity
    };
  };

  const getEyeShape = (index: number) => {
    if (blink) return { transform: 'scaleY(0.05)', borderRadius: '10%' };
    
    let scaleY = isSpeaking ? 1 + volume * 0.4 : 1;
    let borderRadius = '50%';
    let rotate = '0deg';
    let translateY = '0px';
    let scaleX = 1;

    // Subtle twitch for nervousness/alert
    const twitch = (mood === 'nervous' || mood === 'alert') ? Math.sin(Date.now() / 40) * 0.05 : 0;
    scaleX += twitch;
    scaleY += twitch;

    switch (mood) {
      case 'happy':
        borderRadius = '50%';
        scaleX *= 1.3;
        scaleY *= 1.3;
        translateY = '-12px';
        break;
      case 'sad':
        borderRadius = '40% 40% 100% 100%';
        scaleY *= 0.45;
        scaleX *= 1.15;
        rotate = index === 0 ? '25deg' : '-25deg';
        translateY = '14px';
        break;
      case 'concerned':
        borderRadius = '50%';
        rotate = index === 0 ? '-15deg' : '15deg';
        translateY = '4px';
        scaleX = 0.9;
        break;
      case 'nervous':
        borderRadius = '50%';
        scaleX *= 0.95;
        scaleY *= 0.95;
        translateY = '2px';
        break;
      case 'excited':
        borderRadius = '45%';
        scaleY *= 1.5;
        scaleX = 1.1;
        break;
      case 'alert':
        borderRadius = '10%';
        scaleY = 0.25;
        scaleX = 1.2;
        break;
      case 'curious':
        if (index === 0) {
          // Left eye wide and tall
          scaleY *= 1.6;
          scaleX *= 1.2;
          borderRadius = '50%';
          translateY = '-10px';
        } else {
          // Right eye narrowed squint
          scaleY *= 0.55;
          scaleX *= 0.85;
          borderRadius = '40% 40% 50% 50%';
          rotate = '15deg';
          translateY = '8px';
        }
        break;
      case 'calm':
        scaleY = 0.6;
        translateY = '6px';
        borderRadius = '50% 50% 40% 40%';
        break;
      case 'waving':
        borderRadius = '50% 50% 15% 15%';
        scaleY = 0.45 + Math.sin(Date.now()/200)*0.15;
        rotate = index === 0 ? '-10deg' : '10deg';
        break;
      case 'surprised':
        borderRadius = '50%';
        scaleX = 1.35;
        scaleY = 1.35;
        break;
      case 'thumbs_up':
        borderRadius = '15%';
        rotate = index === 0 ? '-45deg' : '45deg';
        scaleX = 0.75;
        scaleY = 0.75;
        break;
      case 'facepalm':
        scaleY = 0.15;
        translateY = '8px';
        rotate = index === 0 ? '20deg' : '0deg';
        break;
      case 'shrug':
        borderRadius = '50%';
        scaleX = 1.1;
        scaleY = 1.1;
        translateY = '-4px';
        break;
    }

    return { 
      transform: `scale(${scaleX}, ${scaleY}) rotate(${rotate}) translateY(${translateY})`, 
      borderRadius 
    };
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

  const baseScale = isWindows ? 0.3 : 1.0;
  const cameraScale = isCameraActive ? 0.6 : 1.0;
  const finalScale = baseScale * cameraScale;

  const BASE_SIZE = 504;
  const currentWidth = BASE_SIZE * finalScale;
  const currentHeight = BASE_SIZE * finalScale;

  const containerSizeStyle = { 
    transform: `scale(${finalScale})`,
    transformOrigin: 'center center',
    width: `${BASE_SIZE}px`,
    height: `${BASE_SIZE}px`
  };

  const isCharging = state === RobotState.IDLE || state === RobotState.CONNECTING;
  const isListening = state === RobotState.LISTENING;

  return (
    <div 
      className="relative flex items-center justify-center perspective-1000 transition-all duration-500"
      style={{ width: `${currentWidth}px`, height: `${currentHeight}px` }}
    >
      <style>{`
        @keyframes pulse-energy {
          0% { transform: translate(-50%, -50%) scale(0.9); opacity: 0.2; }
          50% { transform: translate(-50%, -50%) scale(1.1); opacity: 0.5; }
          100% { transform: translate(-50%, -50%) scale(0.9); opacity: 0.2; }
        }
        @keyframes recognition-ping {
          0% { transform: scale(0.8); opacity: 0; border-width: 6px; }
          40% { opacity: 0.8; }
          100% { transform: scale(1.8); opacity: 0; border-width: 1px; }
        }
        @keyframes listening-wave {
          0% { transform: scale(1); opacity: 0.5; }
          100% { transform: scale(1.4); opacity: 0; }
        }
        @keyframes speaking-glint {
          0%, 100% { opacity: 0.2; transform: scale(1); }
          50% { opacity: 0.6; transform: scale(1.2); }
        }
      `}</style>
      <div 
        className="relative flex items-center justify-center transition-all duration-500"
        style={containerSizeStyle}
      >
        {/* Main Background Glow */}
        <div 
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[268px] h-[268px] sm:w-[448px] sm:h-[448px] rounded-full blur-[80px] transition-all duration-700 opacity-40"
          style={{ 
            backgroundColor: glowColor,
            transform: isSpeaking ? `translate(-50%, -50%) scale(${1.6 + volume})` : 'translate(-50%, -50%) scale(1)'
          }}
        />

        {/* Subtle Charging Pulse */}
        {isCharging && (
          <div 
            className="absolute top-1/2 left-1/2 w-[300px] h-[300px] rounded-full blur-[40px] pointer-events-none"
            style={{ 
              backgroundColor: state === RobotState.CONNECTING ? 'rgba(234, 179, 8, 0.4)' : 'rgba(148, 163, 184, 0.3)',
              animation: 'pulse-energy 3s ease-in-out infinite'
            }}
          />
        )}

        <div 
          className="relative z-30 flex flex-col items-center justify-center transition-all duration-300 ease-out" 
          style={{ transform: headTransform }}
        >
          {/* Recognition Highlight Ring */}
          {recognitionPulse && (
            <div className="absolute inset-0 z-50 pointer-events-none flex items-center justify-center">
              <div className="w-full h-full rounded-[4.2rem] sm:rounded-[6.3rem] border-4 border-white/80" style={{ animation: 'recognition-ping 0.7s ease-out forwards' }} />
            </div>
          )}

          <div className="w-[268px] h-[268px] sm:w-[392px] sm:h-[392px] bg-slate-900 border-2 border-slate-800 rounded-[4.2rem] sm:rounded-[6.3rem] flex items-center justify-center shadow-[0_0_80px_rgba(0,0,0,0.7)] relative overflow-hidden">
            <div className="absolute inset-2 bg-slate-950/95 rounded-[4rem] sm:rounded-[6rem] flex flex-col items-center justify-center border border-white/5">
              
              <div className="flex gap-11 sm:gap-[78px] mb-6 items-center relative">
                {[0, 1].map((i) => (
                  <div key={i} className="relative flex flex-col items-center">
                    {/* Listening Animation Ring */}
                    {isListening && (
                      <div 
                        className="absolute inset-0 rounded-full border border-cyan-400/30"
                        style={{ 
                          animation: 'listening-wave 1.5s infinite linear',
                          transform: `scale(${1 + volume * 0.5})`,
                          opacity: volume * 0.5 + 0.2
                        }}
                      />
                    )}

                    {/* Speaking Glint Aura */}
                    {isSpeaking && (
                      <div 
                        className={`absolute inset-0 rounded-full blur-xl transition-opacity duration-150 ${primaryColor.replace('text', 'bg')}`}
                        style={{ 
                          animation: 'speaking-glint 0.2s infinite ease-in-out',
                          opacity: volume * 0.4 + 0.1,
                          transform: `scale(${1.2 + volume * 0.8})`
                        }}
                      />
                    )}
                    
                    <div 
                      className={`absolute w-14 h-1.5 rounded-full transition-all duration-300 ${primaryColor.replace('text', 'bg')}`}
                      style={getEyebrowStyle(i)}
                    />
                    <div className={`absolute inset-[-14px] blur-2xl opacity-25 ${primaryColor.replace('text', 'bg')} transition-all duration-500`} />
                    <div 
                      className={`w-14 h-14 sm:w-[61px] sm:h-[61px] ${primaryColor.replace('text', 'bg')} transition-all duration-200 shadow-[0_0_28px_rgba(255,255,255,0.35)]`}
                      style={getEyeShape(i)}
                    />
                    <div 
                      className="absolute top-1.5 left-1.5 w-3 h-3 bg-white/60 rounded-full blur-[1px] transition-transform duration-200"
                      style={{ 
                        transform: (isSpeaking || isListening) ? `translate(${volume * 8}px, ${volume * 4}px) scale(${1 + volume * 0.5})` : 'none' 
                      }}
                    />
                  </div>
                ))}
              </div>

              <div className="relative h-20 flex items-center justify-center gap-[1.5px] px-8 w-full mt-1 group">
                {(isSpeaking || isListening) && (
                  <div 
                    className={`absolute inset-0 blur-3xl opacity-20 transition-opacity duration-300 ${primaryColor.replace('text', 'bg')}`}
                    style={{ transform: `scale(${1 + volume})` }}
                  />
                )}

                {[...Array(spectrogramData.barCount)].map((_, i) => {
                  const total = spectrogramData.barCount;
                  const mid = total / 2;
                  const distFromMid = Math.abs(i - mid);
                  const normalizedDist = distFromMid / mid;
                  
                  let moodShift = 0;
                  if (mood === 'happy' || mood === 'excited' || mood === 'waving' || mood === 'thumbs_up') {
                    moodShift = (mid - distFromMid) * 1.0;
                  } else if (mood === 'sad' || mood === 'facepalm') {
                    moodShift = -(mid - distFromMid) * 1.0;
                  }

                  const time = Date.now() / 120;
                  const noise1 = Math.sin(time + i * 0.5) * 0.6;
                  const noise2 = Math.cos(time * 0.7 + i * 0.3) * 0.4;
                  const totalNoise = noise1 + noise2;
                  
                  const taper = Math.pow(1 - normalizedDist, 0.4);
                  const baseHeight = 4;
                  const activeHeight = taper * (volume * spectrogramData.multiplier * (0.4 + Math.abs(totalNoise)));
                  const heightVal = (isSpeaking || isListening) ? Math.max(baseHeight, activeHeight) : baseHeight;

                  const spectralShift = (isSpeaking || isListening) ? `brightness(${1.5 - normalizedDist * 0.5}) contrast(${1.2 + volume})` : 'none';

                  return (
                    <div 
                      key={i} 
                      className={`w-[1px] sm:w-[2.5px] rounded-full transition-all duration-75 ${primaryColor.replace('text', 'bg')}`}
                      style={{ 
                        height: `${heightVal}%`,
                        transform: `translateY(${-moodShift}px)`,
                        boxShadow: (isSpeaking || isListening) && heightVal > 15 ? `0 0 16px ${glowColor}` : 'none',
                        opacity: (isSpeaking || isListening) ? Math.max(0.4, taper) : 0.25,
                        filter: spectralShift,
                      }}
                    />
                  );
                })}
                
                {(isSpeaking || isListening) && (
                  <div 
                    className={`absolute w-44 h-1.5 blur-xl transition-all duration-300 ${primaryColor.replace('text', 'bg')}`}
                    style={{ opacity: volume * 0.9, transform: `scaleX(${volume * 2})` }}
                  />
                )}
              </div>
            </div>
          </div>

          <div className="absolute -top-[20px] left-1/2 -translate-x-1/2 w-2 h-[20px] bg-slate-800 rounded-full">
            <div 
              className={`absolute -top-4 left-1/2 -translate-x-1/2 w-5 h-5 rounded-full transition-all duration-300 ${
                state === RobotState.SPEAKING 
                  ? 'bg-blue-400 shadow-[0_0_32px_#60a5fa] scale-125' 
                  : (state === RobotState.CONNECTING ? 'bg-amber-400 shadow-[0_0_15px_#fbbf24] animate-pulse' : 'bg-slate-700 scale-100')
              }`} 
            />
          </div>
        </div>
        
        <div 
          className="absolute -bottom-10 w-[268px] h-7 bg-black/60 rounded-[100%] blur-3xl -z-10 transition-transform duration-300"
          style={{ transform: `scale(${1 + volume * 0.6})` }}
        />
      </div>
    </div>
  );
};

export default RobotAvatar;