import React, { useState, useEffect, useRef } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality, Type, FunctionDeclaration } from '@google/genai';
import { Power, PowerOff, Heart, Eye, Activity, ShieldAlert, X, Camera, Sparkles, RefreshCw, AlertTriangle, Scan, CameraOff, Mic, MicOff, Volume2, VolumeX, Cpu, Wifi, Zap } from 'lucide-react';
import RobotAvatar from './components/RobotAvatar';
import TranscriptionView from './components/TranscriptionView';
import { RobotState, TranscriptionEntry, RobotMood, FaceBox } from './types';
import { decode, encode, decodeAudioData, blobToBase64 } from './utils/audioUtils';

const updateMoodFunction: FunctionDeclaration = {
  name: 'update_spark_mood',
  parameters: {
    type: Type.OBJECT,
    description: 'Updates Sparky\'s internal emotional state based on visual observations.',
    properties: {
      mood: {
        type: Type.STRING,
        enum: ['neutral', 'happy', 'concerned', 'curious', 'excited', 'calm', 'sad', 'alert', 'waving', 'surprised', 'thumbs_up', 'facepalm', 'shrug', 'nervous'],
        description: 'The mood that best matches the current visual context.'
      },
      reason: {
        type: Type.STRING,
        description: 'Detailed description of what was seen.'
      }
    },
    required: ['mood', 'reason']
  }
};

const GREETING_TEXT = "Hi, I am an AI companion, you can talk to me in any language and I will do my best to reply back in the same language. You can interact with me as you are speaking to a friend. Also you can open the camera by pressing the eye icon below, for more interactive features. However do remember that you agree to the terms and conditions in the link below before using the app";

const App: React.FC = () => {
  const [robotState, setRobotState] = useState<RobotState>(RobotState.IDLE);
  const [mood, setMood] = useState<RobotMood>('neutral');
  const [isActive, setIsActive] = useState(false);
  const [isCameraOn, setIsCameraOn] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isDeafened, setIsDeafened] = useState(false);
  const [history, setHistory] = useState<TranscriptionEntry[]>([]);
  const [volume, setVolume] = useState(0);
  const [isInitialized, setIsInitialized] = useState(false);
  const [errorDetail, setErrorDetail] = useState<{ message: string; type: 'critical' | 'warning' } | null>(null);
  const [neuralSync, setNeuralSync] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentGesture, setCurrentGesture] = useState<string | null>(null);

  const [liveInput, setLiveInput] = useState('');
  const [liveOutput, setLiveOutput] = useState('');

  const sessionPromiseRef = useRef<Promise<any> | null>(null);
  const sessionRef = useRef<any>(null);
  const robotStateRef = useRef<RobotState>(RobotState.IDLE);
  const isActiveRef = useRef<boolean>(false);
  const isMutedRef = useRef<boolean>(false);
  const isDeafenedRef = useRef<boolean>(false);
  
  const uiAudioCtxRef = useRef<AudioContext | null>(null);
  const inputAudioCtxRef = useRef<AudioContext | null>(null);
  const outputAudioCtxRef = useRef<AudioContext | null>(null);
  const inputAnalyserRef = useRef<AnalyserNode | null>(null);
  const outputAnalyserRef = useRef<AnalyserNode | null>(null);
  const nextStartTimeRef = useRef(0);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const streamRef = useRef<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const signalCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const avatarVisualizerCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const frameIntervalRef = useRef<number | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  useEffect(() => {
    robotStateRef.current = robotState;
    if (robotState === RobotState.SPEAKING || robotState === RobotState.THINKING) {
      setIsProcessing(true);
    } else {
      setIsProcessing(false);
    }
  }, [robotState]);

  useEffect(() => {
    isActiveRef.current = isActive;
    if (isActive) {
      const syncInterval = setInterval(() => {
        setNeuralSync(94 + Math.floor(Math.random() * 6));
      }, 3000);
      return () => clearInterval(syncInterval);
    } else {
      setNeuralSync(0);
    }
  }, [isActive]);

  useEffect(() => {
    isMutedRef.current = isMuted;
  }, [isMuted]);

  useEffect(() => {
    isDeafenedRef.current = isDeafened;
    if (isDeafened) {
      for (const source of sourcesRef.current) {
        try { source.stop(); } catch (e) {}
      }
      sourcesRef.current.clear();
      setRobotState(RobotState.LISTENING);
      setVolume(0);
    }
  }, [isDeafened]);

  useEffect(() => {
    return () => {
      stopSession();
    };
  }, []);

  const addLog = (type: 'user' | 'robot' | 'system', text: string) => {
    if (!text) return;
    setHistory(prev => [...prev, { type, text, timestamp: Date.now() }]);
  };

  const handleError = (error: any, context: string) => {
    console.error(`[Sparky Error - ${context}]:`, error);
    let userMessage = "An unexpected error occurred.";
    let type: 'critical' | 'warning' = 'warning';

    const errMsg = error?.message || "";
    if (errMsg.includes('Operation is not implemented') || errMsg.includes('not supported')) {
      userMessage = "Certain neural features are limited. Restricted vision tools detected.";
      type = 'warning';
    } else if (error?.name === 'NotAllowedError') {
      userMessage = "Hardware access denied.";
      type = 'critical';
    } else if (errMsg.includes('API_KEY')) {
      userMessage = "Configuration error: Invalid Key.";
      type = 'critical';
    }

    setErrorDetail({ message: userMessage, type });
    addLog('system', `ERROR: ${userMessage}`);
    playUISound('error');
    if (type === 'critical') {
      stopSession();
      setRobotState(RobotState.ERROR);
    }
  };

  const playUISound = (type: 'connect' | 'speech' | 'error' | 'success' | 'toggle' | 'alert') => {
    try {
      if (!uiAudioCtxRef.current || uiAudioCtxRef.current.state === 'closed') {
        uiAudioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      const ctx = uiAudioCtxRef.current;
      if (ctx.state === 'suspended') ctx.resume().catch(() => {});
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      const now = ctx.currentTime;
      
      switch (type) {
        case 'connect':
          osc.frequency.setValueAtTime(440, now);
          osc.frequency.exponentialRampToValueAtTime(880, now + 0.3);
          gain.gain.setValueAtTime(0, now);
          gain.gain.linearRampToValueAtTime(0.1, now + 0.05);
          gain.gain.linearRampToValueAtTime(0, now + 0.4);
          osc.start(now);
          osc.stop(now + 0.4);
          break;
        case 'alert':
          osc.type = 'square';
          osc.frequency.setValueAtTime(880, now);
          osc.frequency.setValueAtTime(440, now + 0.1);
          gain.gain.setValueAtTime(0, now);
          gain.gain.linearRampToValueAtTime(0.05, now + 0.05);
          gain.gain.linearRampToValueAtTime(0, now + 0.2);
          osc.start(now);
          osc.stop(now + 0.2);
          break;
        case 'speech':
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(880, now);
          gain.gain.setValueAtTime(0, now);
          gain.gain.linearRampToValueAtTime(0.05, now + 0.02);
          gain.gain.linearRampToValueAtTime(0, now + 0.15);
          osc.start(now);
          osc.stop(now + 0.15);
          break;
        case 'error':
          osc.type = 'sawtooth';
          osc.frequency.setValueAtTime(150, now);
          gain.gain.setValueAtTime(0, now);
          gain.gain.linearRampToValueAtTime(0.1, now + 0.05);
          gain.gain.linearRampToValueAtTime(0, now + 0.5);
          osc.start(now);
          osc.stop(now + 0.5);
          break;
        case 'success':
          osc.frequency.setValueAtTime(523.25, now);
          osc.frequency.setValueAtTime(659.25, now + 0.1);
          gain.gain.setValueAtTime(0, now);
          gain.gain.linearRampToValueAtTime(0.1, now + 0.05);
          gain.gain.linearRampToValueAtTime(0, now + 0.3);
          osc.start(now);
          osc.stop(now + 0.3);
          break;
        case 'toggle':
          osc.type = 'sine';
          osc.frequency.setValueAtTime(660, now);
          osc.frequency.exponentialRampToValueAtTime(330, now + 0.1);
          gain.gain.setValueAtTime(0, now);
          gain.gain.linearRampToValueAtTime(0.05, now + 0.02);
          gain.gain.linearRampToValueAtTime(0, now + 0.1);
          osc.start(now);
          osc.stop(now + 0.1);
          break;
      }
    } catch (e) {}
  };

  const speakText = async (text: string) => {
    if (!process.env.API_KEY || !text || isDeafenedRef.current) return;
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-preview-tts",
        contents: [{ parts: [{ text: `Say clearly: ${text}` }] }],
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } } },
        },
      });
      const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (base64Audio && outputAudioCtxRef.current) {
        const audioBuffer = await decodeAudioData(decode(base64Audio), outputAudioCtxRef.current, 24000, 1);
        const source = outputAudioCtxRef.current.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(outputAnalyserRef.current!);
        outputAnalyserRef.current!.connect(outputAudioCtxRef.current.destination);
        source.onended = () => {
          sourcesRef.current.delete(source);
          if (sourcesRef.current.size === 0) { setRobotState(RobotState.LISTENING); setVolume(0); }
        };
        setRobotState(RobotState.SPEAKING);
        const startTime = Math.max(nextStartTimeRef.current, outputAudioCtxRef.current.currentTime);
        source.start(startTime);
        nextStartTimeRef.current = startTime + audioBuffer.duration;
        sourcesRef.current.add(source);
        addLog('robot', text);
      }
    } catch (err) { console.error("TTS Error:", err); }
  };

  const drawSignal = () => {
    if (signalCanvasRef.current) {
      const canvas = signalCanvasRef.current;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        const isSpeaking = robotState === RobotState.SPEAKING;
        const analyser = isSpeaking ? outputAnalyserRef.current : inputAnalyserRef.current;
        if (!analyser || !isActive || (!isSpeaking && isMutedRef.current)) {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
        } else {
          const bufferLength = analyser.frequencyBinCount;
          const dataArray = new Uint8Array(bufferLength);
          analyser.getByteTimeDomainData(dataArray);
          ctx.fillStyle = 'rgba(15, 23, 42, 0.4)';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.lineWidth = 1.5;
          ctx.strokeStyle = isSpeaking ? '#3b82f6' : '#22c55e';
          ctx.beginPath();
          const sliceWidth = canvas.width * 1.0 / bufferLength;
          let x = 0;
          for (let i = 0; i < bufferLength; i++) {
            const v = dataArray[i] / 128.0;
            const y = v * canvas.height / 2;
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
            x += sliceWidth;
          }
          ctx.lineTo(canvas.width, canvas.height / 2);
          ctx.stroke();
        }
      }
    }

    if (avatarVisualizerCanvasRef.current) {
      const canvas = avatarVisualizerCanvasRef.current;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        const isSpeaking = robotState === RobotState.SPEAKING;
        const analyser = isSpeaking ? outputAnalyserRef.current : (robotState === RobotState.LISTENING ? inputAnalyserRef.current : null);
        
        if (analyser && isActive && (isSpeaking || !isMutedRef.current)) {
          const bufferLength = analyser.frequencyBinCount;
          const dataArray = new Uint8Array(bufferLength);
          analyser.getByteFrequencyData(dataArray);
          
          const centerX = canvas.width / 2;
          const centerY = canvas.height / 2;
          const radius = 130; 
          const color = isSpeaking ? '59, 130, 246' : '34, 197, 94';
          
          ctx.beginPath();
          ctx.lineWidth = 3;
          ctx.lineCap = 'round';
          
          const bars = 64;
          for (let i = 0; i < bars; i++) {
            const index = Math.floor((i / bars) * (bufferLength / 2));
            const value = dataArray[index];
            const percent = value / 255;
            const barHeight = percent * 60; 
            const angle = (i / bars) * Math.PI * 2;
            
            const x1 = centerX + Math.cos(angle) * radius;
            const y1 = centerY + Math.sin(angle) * radius;
            const x2 = centerX + Math.cos(angle) * (radius + barHeight);
            const y2 = centerY + Math.sin(angle) * (radius + barHeight);
            
            ctx.strokeStyle = `rgba(${color}, ${0.1 + percent * 0.4})`;
            ctx.moveTo(x1, y1);
            ctx.lineTo(x2, y2);
          }
          ctx.stroke();
        }
      }
    }

    animationFrameRef.current = requestAnimationFrame(drawSignal);
  };

  useEffect(() => {
    animationFrameRef.current = requestAnimationFrame(drawSignal);
    return () => { if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current); };
  }, [isActive, robotState]);

  const stopSession = () => {
    try {
      if (sessionRef.current) sessionRef.current.close();
      for (const source of sourcesRef.current) { try { source.stop(); } catch (e) {} }
      sourcesRef.current.clear();
      if (inputAudioCtxRef.current && inputAudioCtxRef.current.state !== 'closed') inputAudioCtxRef.current.close();
      if (outputAudioCtxRef.current && outputAudioCtxRef.current.state !== 'closed') outputAudioCtxRef.current.close();
      if (streamRef.current) streamRef.current.getTracks().forEach(track => track.stop());
      if (frameIntervalRef.current) clearInterval(frameIntervalRef.current);
      
      sessionRef.current = null;
      sessionPromiseRef.current = null;
      inputAudioCtxRef.current = null;
      outputAudioCtxRef.current = null;
      streamRef.current = null;
      nextStartTimeRef.current = 0;
      setIsActive(false);
      setIsCameraOn(false);
      setRobotState(RobotState.IDLE);
      setMood('neutral');
      setVolume(0);
      setLiveInput('');
      setLiveOutput('');
      addLog('system', 'NEURAL LINK DEACTIVATED.');
    } catch (e) { console.warn("Cleanup error:", e); }
  };

  const handleInitialization = async () => {
    setRobotState(RobotState.CONNECTING);
    playUISound('connect');
    setErrorDetail(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
      stream.getTracks().forEach(track => track.stop());
      setIsInitialized(true);
      playUISound('success');
      return true;
    } catch (err: any) { handleError(err, 'Initialization'); return false; }
  };

  const startSession = async (retryCount = 0) => {
    if (!process.env.API_KEY || process.env.API_KEY === 'undefined') { handleError(new Error('API_KEY is missing.'), 'Config'); return; }
    if (!isInitialized) { const success = await handleInitialization(); if (!success) return; }

    try {
      if (!inputAudioCtxRef.current || inputAudioCtxRef.current.state === 'closed') inputAudioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      if (!outputAudioCtxRef.current || outputAudioCtxRef.current.state === 'closed') outputAudioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
    } catch (e) { handleError(e, 'Audio Context Initialization'); return; }

    setRobotState(RobotState.CONNECTING);
    setErrorDetail(null);
    setIsActive(true);
    nextStartTimeRef.current = 0;
    if (retryCount === 0) playUISound('connect');

    try {
      inputAnalyserRef.current = inputAudioCtxRef.current.createAnalyser();
      inputAnalyserRef.current.fftSize = 256;
      outputAnalyserRef.current = outputAudioCtxRef.current.createAnalyser();
      outputAnalyserRef.current.fftSize = 256;
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-12-2025',
        config: {
          responseModalities: [Modality.AUDIO],
          systemInstruction: `You are Sparky, a loyal and reactive AI robot companion. Be mechanical, polite, and helpful. Respond to voice and vision inputs. If you see gestures, acknowledge them.`,
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } } },
          tools: [{ functionDeclarations: [updateMoodFunction] }],
          outputAudioTranscription: {},
          inputAudioTranscription: {},
        },
        callbacks: {
          onopen: () => {
            setRobotState(RobotState.LISTENING);
            addLog('system', 'NEURAL LINK ESTABLISHED.');
            speakText(GREETING_TEXT);
            sessionPromise.then(session => {
              session.sendRealtimeInput({ media: { data: encode(new Uint8Array(new Int16Array(16000).fill(0).buffer)), mimeType: 'audio/pcm;rate=16000' } });
            });
            const source = inputAudioCtxRef.current!.createMediaStreamSource(stream);
            source.connect(inputAnalyserRef.current!);
            const scriptProcessor = inputAudioCtxRef.current!.createScriptProcessor(4096, 1, 1);
            scriptProcessor.onaudioprocess = (e) => {
              if (robotStateRef.current === RobotState.IDLE) return;
              const inputData = e.inputBuffer.getChannelData(0);
              
              if (!isMutedRef.current) {
                let sum = 0;
                for(let i=0; i<inputData.length; i++) sum += inputData[i]*inputData[i];
                if (robotStateRef.current === RobotState.LISTENING) setVolume(Math.sqrt(sum/inputData.length) * 2.5); 
                sessionPromise.then((session) => {
                  session.sendRealtimeInput({ media: { data: encode(new Uint8Array(new Int16Array(inputData.map(v => v * 32768)).buffer)), mimeType: 'audio/pcm;rate=16000' } });
                }).catch(() => {});
              } else {
                setVolume(0);
              }
            };
            source.connect(scriptProcessor);
            scriptProcessor.connect(inputAudioCtxRef.current!.destination);
          },
          onmessage: async (message: LiveServerMessage) => {
            if (isDeafenedRef.current) return;

            if (message.serverContent?.outputTranscription) setLiveOutput(prev => prev + message.serverContent.outputTranscription.text);
            else if (message.serverContent?.inputTranscription) setLiveInput(prev => prev + message.serverContent.inputTranscription.text);
            if (message.serverContent?.turnComplete) {
              setLiveInput(input => { if (input) addLog('user', input); return ''; });
              setLiveOutput(output => { if (output) addLog('robot', output); return ''; });
            }
            if (message.toolCall) {
              for (const fc of message.toolCall.functionCalls) {
                if (fc.name === 'update_spark_mood') {
                  setMood((fc.args as any).mood as RobotMood);
                  sessionPromise.then(session => session.sendToolResponse({ functionResponses: { id: fc.id, name: fc.name, response: { result: "Mood synced." } } }));
                }
              }
            }
            if (message.serverContent?.modelTurn) {
              for (const part of message.serverContent.modelTurn.parts) {
                if (part.inlineData) {
                  const audioBuffer = await decodeAudioData(decode(part.inlineData.data), outputAudioCtxRef.current!, 24000, 1);
                  const source = outputAudioCtxRef.current!.createBufferSource();
                  source.buffer = audioBuffer;
                  source.connect(outputAnalyserRef.current!);
                  outputAnalyserRef.current!.connect(outputAudioCtxRef.current!.destination);
                  source.onended = () => {
                    sourcesRef.current.delete(source);
                    if (sourcesRef.current.size === 0) { setRobotState(RobotState.LISTENING); setVolume(0); }
                  };
                  setRobotState(RobotState.SPEAKING);
                  const startTime = Math.max(nextStartTimeRef.current, outputAudioCtxRef.current!.currentTime);
                  source.start(startTime);
                  nextStartTimeRef.current = startTime + audioBuffer.duration;
                  sourcesRef.current.add(source);
                }
              }
            }
            if (message.serverContent?.interrupted) {
              for (const source of sourcesRef.current) { try { source.stop(); } catch (e) {} }
              sourcesRef.current.clear();
              nextStartTimeRef.current = 0;
              setRobotState(RobotState.LISTENING);
              setVolume(0);
              setLiveOutput('');
            }
          },
          onerror: (err) => handleError(err, 'Live Stream Event'),
          onclose: (e) => {
            if (e.code !== 1000 && isActiveRef.current) handleError(new Error(`Link severed: ${e.code}`), 'Session Close');
            else { setRobotState(RobotState.IDLE); setIsActive(false); }
          }
        }
      });
      sessionPromiseRef.current = sessionPromise;
      sessionRef.current = await sessionPromise;
    } catch (err: any) { if (retryCount < 2) setTimeout(() => startSession(retryCount + 1), 2000); else handleError(err, 'Session Start'); }
  };

  const toggleCamera = async () => {
    if (!isCameraOn) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        addLog('system', 'OPTICAL SENSORS: ONLINE.');
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          setIsCameraOn(true);
          frameIntervalRef.current = window.setInterval(() => {
            if (canvasRef.current && videoRef.current && sessionPromiseRef.current) {
              const ctx = canvasRef.current.getContext('2d');
              if (ctx) {
                canvasRef.current.width = videoRef.current.videoWidth;
                canvasRef.current.height = videoRef.current.videoHeight;
                ctx.drawImage(videoRef.current, 0, 0);
                canvasRef.current.toBlob(async (blob) => {
                  if (blob && sessionPromiseRef.current) {
                    const base64Data = await blobToBase64(blob);
                    sessionPromiseRef.current.then(session => {
                      session.sendRealtimeInput({ media: { data: base64Data, mimeType: 'image/jpeg' } });
                    }).catch(() => {});
                  }
                }, 'image/jpeg', 0.7);
              }
            }
          }, 450);
        }
      } catch (err: any) { handleError(err, 'Camera Error'); }
    } else {
      addLog('system', 'OPTICAL SENSORS: OFFLINE.');
      if (videoRef.current?.srcObject) (videoRef.current.srcObject as MediaStream).getTracks().forEach(t => t.stop());
      if (frameIntervalRef.current) clearInterval(frameIntervalRef.current);
      setIsCameraOn(false);
    }
  };

  const handleFaceDetected = (boxes: FaceBox[]) => {
    if (boxes.length > 0 && mood !== 'curious' && isActive) {
       setMood('curious');
       sessionPromiseRef.current?.then(session => {
         session.sendRealtimeInput({
           media: { data: encode(new TextEncoder().encode(`[PERCEPTION: Human detected]`)), mimeType: 'text/plain' }
         });
       });
    }
  };

  const handleGestureDetected = (gesture: string) => {
    addLog('system', `GESTURE RECOGNIZED: ${gesture.toUpperCase()}`);
    playUISound('alert');
    setCurrentGesture(gesture);
    setTimeout(() => setCurrentGesture(null), 2000);

    let newMood: RobotMood = 'neutral';
    if (gesture === 'wave') newMood = 'waving';
    else if (gesture === 'thumbs_up') newMood = 'thumbs_up';
    else if (gesture === 'peace') newMood = 'excited';
    
    setMood(newMood);
    
    // Notify Gemini session of the perceived gesture
    if (sessionRef.current && isActive) {
      sessionRef.current.sendRealtimeInput({
        media: { 
          data: encode(new TextEncoder().encode(`[VISUAL CONTEXT: User performed a ${gesture} gesture]`)), 
          mimeType: 'text/plain' 
        }
      });
    }
  };

  return (
    <div className="h-screen bg-slate-950 text-slate-200 font-sans flex flex-col items-center overflow-hidden">
      <div className="w-full h-full flex flex-col overflow-hidden">
        <header className="h-16 px-6 flex items-center justify-between border-b border-white/5 bg-slate-900/40 backdrop-blur-xl z-50">
          <div className="flex items-center gap-3">
            <Activity className={`${robotState === RobotState.ERROR ? 'text-red-500' : 'text-blue-500'} w-6 h-6 animate-pulse`} />
            <div className="flex flex-col">
              <h1 className="font-bold text-white tracking-tighter uppercase leading-none">SPARKY <span className="text-blue-400 font-mono text-[10px]">v2.9.11</span></h1>
              {isActive && (
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-[7px] font-mono text-slate-500 flex items-center gap-1 uppercase tracking-widest">
                    <Zap className="w-2 h-2 text-amber-500 fill-amber-500/20" /> Sync {neuralSync}%
                  </span>
                  <div className="w-8 h-[2px] bg-slate-800 rounded-full overflow-hidden">
                    <div className="h-full bg-blue-500 animate-[loading_2s_ease-in-out_infinite]" style={{ width: `${neuralSync}%` }} />
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden lg:flex items-center gap-3 px-3 py-1 bg-white/5 border border-white/5 rounded-lg">
              <div className="flex items-center gap-1.5 opacity-60">
                <Wifi className={`w-3 h-3 ${isActive ? 'text-green-500' : 'text-slate-600'}`} />
                <span className="text-[9px] font-mono uppercase tracking-tighter">API Link</span>
              </div>
              <div className="h-3 w-[1px] bg-white/10" />
              <div className="flex items-center gap-1.5 opacity-60">
                <Cpu className={`w-3 h-3 ${isProcessing ? 'text-blue-400 animate-pulse' : 'text-slate-600'}`} />
                <span className="text-[9px] font-mono uppercase tracking-tighter">GenAI Proc</span>
              </div>
            </div>

            <canvas ref={signalCanvasRef} width={80} height={20} className="rounded bg-slate-900/50 border border-white/5 opacity-50 hidden sm:block" />
            <button onClick={() => (isActive ? stopSession() : startSession())} className={`px-4 py-1.5 rounded-xl font-bold text-[10px] uppercase transition-all flex items-center gap-2 ${isActive ? 'bg-red-500/10 text-red-400 border border-red-500/20' : 'bg-blue-600 text-white shadow-lg shadow-blue-600/20'}`}>
              {isActive ? <PowerOff className="w-3 h-3" /> : <Power className="w-3 h-3" />}
              {isActive ? 'Shutdown' : 'Wake Up'}
            </button>
          </div>
        </header>

        <main className="flex-1 flex flex-col lg:flex-row p-5 gap-6 w-full max-w-[1600px] mx-auto overflow-hidden">
          {/* Main Avatar Section - pt-12 added for gesture badge provision on mobile */}
          <div className="flex-1 flex flex-col items-center justify-between relative bg-slate-900/10 rounded-3xl border border-white/5 p-6 pt-12 sm:pt-6 min-h-0 lg:h-full overflow-visible">
            {errorDetail && (
              <div className={`absolute top-4 left-4 right-4 z-50 p-3 rounded-xl border flex items-center justify-between bg-red-500/10 border-red-500/30 text-red-400 backdrop-blur-xl`}>
                <div className="flex items-center gap-2"><AlertTriangle className="w-4 h-4" /> <span className="text-[10px] font-bold uppercase">{errorDetail.message}</span></div>
                <button onClick={() => setErrorDetail(null)} className="p-1 hover:bg-white/5 rounded-lg"><X className="w-4 h-4" /></button>
              </div>
            )}
            
            {/* Reduced translation shift for mobile to prevent top collisions */}
            <div className={`flex-1 flex items-center justify-center min-h-0 w-full relative transition-transform duration-700 ease-in-out ${isCameraOn ? '-translate-y-[24px] sm:-translate-y-[72px]' : 'translate-y-0'}`}>
              <canvas ref={avatarVisualizerCanvasRef} width={600} height={600} className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none z-10 opacity-60" />
              <RobotAvatar 
                state={robotState} 
                mood={mood} 
                isSpeaking={robotState === RobotState.SPEAKING} 
                volume={volume} 
                isCameraActive={isCameraOn} 
                lastGesture={currentGesture} 
                videoRef={videoRef} 
                onFaceDetected={handleFaceDetected} 
                onGestureDetected={handleGestureDetected}
              />
            </div>

            <div className="relative flex items-center gap-3 sm:gap-4 bg-slate-950/40 p-2 sm:p-3 rounded-2xl border border-white/5 backdrop-blur-md shrink-0 translate-y-4 transition-transform duration-700 ease-in-out">
              <div className={`transition-all duration-700 ease-in-out absolute bottom-full left-1/2 -translate-x-1/2 mb-1 z-40 origin-bottom ${isCameraOn ? 'scale-100 opacity-100' : 'scale-0 opacity-0 pointer-events-none'}`}>
                  <div className="relative w-40 sm:w-64 aspect-video rounded-xl overflow-hidden border border-blue-500/40 shadow-[0_0_50px_rgba(59,130,246,0.3)] bg-slate-950">
                    <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
                    <div className="absolute top-1.5 left-1.5 flex items-center gap-1.5 bg-blue-600/60 backdrop-blur-md px-2 py-0.5 rounded text-[7px] font-black text-white uppercase tracking-widest z-10">
                      <Camera className="w-2.5 h-2.5 animate-pulse" /> Live Sensory Feed
                    </div>
                  </div>
                  <canvas ref={canvasRef} className="hidden" />
              </div>

              <button 
                onClick={() => { setIsMuted(!isMuted); playUISound('toggle'); }} 
                disabled={!isActive} 
                className={`p-2.5 sm:p-3 rounded-xl transition-all ${isMuted ? 'bg-red-600 text-white shadow-lg shadow-red-600/40' : 'bg-slate-900 text-slate-500 hover:text-slate-300'} disabled:opacity-20`}
                title={isMuted ? "Unmute Mic" : "Mute Mic"}
              >
                {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
              </button>

              <button 
                onClick={() => { setIsDeafened(!isDeafened); playUISound('toggle'); }} 
                disabled={!isActive} 
                className={`p-2.5 sm:p-3 rounded-xl transition-all ${isDeafened ? 'bg-amber-600 text-white shadow-lg shadow-amber-600/40' : 'bg-slate-900 text-slate-500 hover:text-slate-300'} disabled:opacity-20`}
                title={isDeafened ? "Restore Voice" : "Silence Robot"}
              >
                {isDeafened ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
              </button>

              <div className="h-5 w-[1px] bg-white/10" />

              <button 
                onClick={toggleCamera} 
                disabled={!isActive} 
                className={`p-2.5 sm:p-3 rounded-xl transition-all ${isCameraOn ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/40' : 'bg-slate-900 text-slate-500 hover:text-slate-300'} disabled:opacity-20`}
                title={isCameraOn ? "Close Optical Link" : "Open Optical Link"}
              >
                <Eye className="w-5 h-5" />
              </button>

              <div className="h-5 w-[1px] bg-white/10 hidden sm:block" />

              <div className="hidden sm:flex items-center gap-3 px-4 py-2 rounded-xl bg-slate-900/80 min-w-[120px] justify-center border border-white/5">
                <Heart className={`w-3.5 h-3.5 transition-colors ${mood === 'neutral' ? 'text-slate-600' : 'text-pink-500 fill-pink-500/20'}`} />
                <span className="text-[10px] font-mono font-black text-slate-400 uppercase tracking-widest">{mood}</span>
              </div>
            </div>
          </div>
          
          <div className="lg:w-[350px] lg:flex-none lg:h-full h-[105px] overflow-hidden">
            <TranscriptionView history={history} currentInput={liveInput} currentOutput={liveOutput} isActive={isActive} />
          </div>
        </main>

        <footer className="h-12 border-t border-white/5 bg-slate-950/80 flex items-center justify-center gap-4 text-[9px] font-mono text-slate-600 uppercase tracking-[0.3em] shrink-0">
           <span className="hidden sm:inline">Neural Integrity: NOMINAL // Sparky v2.9.11 //</span>
           <a href="https://drive.google.com/file/d/17Xm-kPd7zSHlvHDGC573eHJlJJX3I7Vy/view?usp=sharing" target="_blank" rel="noopener noreferrer" className="hover:text-blue-400 transition-colors flex items-center gap-1">
             <ShieldAlert className="w-3 h-3" /> Terms & Conditions
           </a> // By Robin Jove
        </footer>
      </div>
      <style>{`
        @keyframes loading {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
      `}</style>
    </div>
  );
};

export default App;