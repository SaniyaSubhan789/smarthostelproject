import React, { useRef, useState, useEffect, useCallback } from 'react';
import * as faceapi from 'face-api.js';

interface HostelGateScannerProps {
  users: any[];
  hostelLocation: { lat: number; lng: number };
  radius: number;
  onEntryLog: (log: EntryLogData) => void;
  existingLogs: EntryLogData[];
}

export interface EntryLogData {
  id: string;
  studentId: string;
  studentName: string;
  entryTime: string;
  exitTime?: string;
  date: string;
  status: 'IN' | 'OUT';
  latitude: number;
  longitude: number;
  verificationMethod: string;
  success: boolean;
  errorMessage?: string;
}

const HostelGateScanner: React.FC<HostelGateScannerProps> = ({
  users,
  hostelLocation,
  radius,
  onEntryLog,
  existingLogs
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isModelLoading, setIsModelLoading] = useState(true);
  const [modelError, setModelError] = useState<string | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationResult, setVerificationResult] = useState<{
    success: boolean;
    message: string;
    student?: any;
  } | null>(null);
  const [currentLocation, setCurrentLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [locationStatus, setLocationStatus] = useState<'checking' | 'valid' | 'invalid'>('checking');
  const [lastEntry, setLastEntry] = useState<EntryLogData | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);

  // Calculate distance between two coordinates (Haversine formula)
  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c; // Distance in meters
  };

  // Load face-api models
  useEffect(() => {
    const loadModels = async () => {
      try {
        setIsModelLoading(true);
        const MODEL_URL = 'https://justadudewhohacks.github.io/face-api.js/models';
        
        await Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
          faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
          faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
        ]);
        
        setIsModelLoading(false);
        setIsInitialized(true);
      } catch (error) {
        console.error('Error loading models:', error);
        setModelError('Failed to load face recognition models.');
        setIsModelLoading(false);
      }
    };

    loadModels();
  }, []);

  // Get current GPS location
  const getCurrentLocation = useCallback(() => {
    setLocationStatus('checking');
    setLocationError(null);

    if (!navigator.geolocation) {
      setLocationError('Geolocation is not supported by your browser');
      setLocationStatus('invalid');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        setCurrentLocation({ lat: latitude, lng: longitude });
        
        const distance = calculateDistance(
          latitude, longitude,
          hostelLocation.lat, hostelLocation.lng
        );
        
        if (distance <= radius) {
          setLocationStatus('valid');
        } else {
          setLocationError(`You are ${Math.round(distance)}m away from hostel. Allowed radius: ${radius}m`);
          setLocationStatus('invalid');
        }
      },
      (error) => {
        let errorMessage = 'Unable to get location';
        if (error.code === error.PERMISSION_DENIED) {
          errorMessage = 'Location permission denied. Please enable GPS.';
        } else if (error.code === error.POSITION_UNAVAILABLE) {
          errorMessage = 'Location information unavailable';
        }
        setLocationError(errorMessage);
        setLocationStatus('invalid');
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      }
    );
  }, [hostelLocation, radius]);

  // Start video stream
  const startVideo = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: 'user'
        } 
      });
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setIsStreaming(true);
        setVerificationResult(null);
        getCurrentLocation();
      }
    } catch (error) {
      console.error('Error accessing camera:', error);
      setVerificationResult({
        success: false,
        message: 'Unable to access camera. Please ensure camera permissions are granted.'
      });
    }
  };

  // Stop video stream
  const stopVideo = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
    setIsStreaming(false);
  };

  // Verify face and create entry log
  const verifyEntry = async () => {
    if (!videoRef.current || !currentLocation) {
      setVerificationResult({
        success: false,
        message: 'Location not available. Please enable GPS.'
      });
      return;
    }

    if (locationStatus !== 'valid') {
      setVerificationResult({
        success: false,
        message: locationError || 'You are not at the hostel entry point.'
      });
      return;
    }

    setIsProcessing(true);
    setVerificationResult(null);

    try {
      // Detect face
      const detections = await faceapi
        .detectSingleFace(videoRef.current, new faceapi.TinyFaceDetectorOptions())
        .withFaceLandmarks()
        .withFaceDescriptor();

      if (!detections) {
        const log: EntryLogData = {
          id: `log${Date.now()}`,
          studentId: 'unknown',
          studentName: 'Unknown',
          entryTime: new Date().toISOString(),
          date: new Date().toISOString().split('T')[0],
          status: 'IN',
          latitude: currentLocation.lat,
          longitude: currentLocation.lng,
          verificationMethod: 'FACE + GPS',
          success: false,
          errorMessage: 'No face detected'
        };
        
        setVerificationResult({
          success: false,
          message: 'No face detected. Please position your face in the camera view.'
        });
        
        onEntryLog(log);
        setIsProcessing(false);
        return;
      }

      // Get detected face descriptor
      const detectedDescriptor = detections.descriptor;

      // Find matching student by comparing face descriptors
      let matchedStudent: any = null;
      let bestMatchDistance = Infinity;

      const activeStudents = users.filter((u: any) => 
        u.role === 'student' && 
        u.status === 'active' && 
        u.faceData
      );

      for (const student of activeStudents) {
        try {
          const faceData = JSON.parse(atob(student.faceData));
          const storedDescriptor = new Float32Array(faceData.descriptor);
          
          // Calculate Euclidean distance
          let distance = 0;
          for (let i = 0; i < detectedDescriptor.length; i++) {
            distance += Math.pow(detectedDescriptor[i] - storedDescriptor[i], 2);
          }
          distance = Math.sqrt(distance);

          // Face-api uses 0.6 as threshold for match
          if (distance < 0.6 && distance < bestMatchDistance) {
            bestMatchDistance = distance;
            matchedStudent = student;
          }
        } catch (e) {
          console.error('Error parsing face data for student:', student.id, e);
        }
      }

      if (!matchedStudent) {
        const log: EntryLogData = {
          id: `log${Date.now()}`,
          studentId: 'unrecognized',
          studentName: 'Unrecognized',
          entryTime: new Date().toISOString(),
          date: new Date().toISOString().split('T')[0],
          status: 'IN',
          latitude: currentLocation.lat,
          longitude: currentLocation.lng,
          verificationMethod: 'FACE + GPS',
          success: false,
          errorMessage: 'Face not recognized. Please register your face first.'
        };
        
        setVerificationResult({
          success: false,
          message: 'Face not recognized. Please register your face from the Student Dashboard.'
        });
        
        onEntryLog(log);
        setIsProcessing(false);
        return;
      }

      // Check if student already has an entry today (toggle IN/OUT)
      const today = new Date().toISOString().split('T')[0];
      const todayLogs = existingLogs.filter((log: EntryLogData) => 
        log.studentId === matchedStudent.id && 
        log.date === today
      );
      
      const lastLog = todayLogs[todayLogs.length - 1];
      const isEntry = !lastLog || lastLog.status === 'OUT';

      // Create entry log
      const log: EntryLogData = {
        id: `log${Date.now()}`,
        studentId: matchedStudent.id,
        studentName: matchedStudent.name,
        entryTime: isEntry ? new Date().toISOString() : lastLog?.entryTime || new Date().toISOString(),
        exitTime: !isEntry ? new Date().toISOString() : undefined,
        date: today,
        status: isEntry ? 'IN' : 'OUT',
        latitude: currentLocation.lat,
        longitude: currentLocation.lng,
        verificationMethod: 'FACE + GPS',
        success: true
      };

      setLastEntry(log);
      setVerificationResult({
        success: true,
        message: isEntry 
          ? `Welcome, ${matchedStudent.name}! Entry recorded.`
          : `Goodbye, ${matchedStudent.name}! Exit recorded.`,
        student: matchedStudent
      });

      onEntryLog(log);
    } catch (error) {
      console.error('Verification error:', error);
      setVerificationResult({
        success: false,
        message: 'Verification failed. Please try again.'
      });
    }

    setIsProcessing(false);
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopVideo();
    };
  }, []);

  // Auto-refresh location every 10 seconds when streaming
  useEffect(() => {
    if (isStreaming) {
      const interval = setInterval(getCurrentLocation, 10000);
      return () => clearInterval(interval);
    }
  }, [isStreaming, getCurrentLocation]);

  if (isModelLoading) {
    return (
      <div className="flex flex-col items-center justify-center p-8">
        <div className="w-16 h-16 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mb-4"></div>
        <p className="text-slate-400">Loading face recognition system...</p>
      </div>
    );
  }

  if (modelError) {
    return (
      <div className="bg-red-500/10 border border-red-500/30 p-6 rounded-xl text-center">
        <div className="text-red-400 text-4xl mb-4">⚠️</div>
        <p className="text-red-400">{modelError}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-600 to-purple-600 p-4 rounded-xl text-white">
        <h3 className="font-bold text-lg flex items-center gap-2">
          🏠 Smart Hostel Entry System
        </h3>
        <p className="text-indigo-200 text-sm">
          Face Recognition + GPS Verification
        </p>
      </div>

      {/* Verification Result */}
      {verificationResult && (
        <div className={`p-4 rounded-xl border ${
          verificationResult.success 
            ? 'bg-green-500/20 border-green-500/50' 
            : 'bg-red-500/20 border-red-500/50'
        }`}>
          <div className="flex items-center gap-3">
            <div className={`text-3xl ${verificationResult.success ? 'text-green-400' : 'text-red-400'}`}>
              {verificationResult.success ? '✓' : '✕'}
            </div>
            <div>
              <p className={`font-medium ${verificationResult.success ? 'text-green-400' : 'text-red-400'}`}>
                {verificationResult.message}
              </p>
              {verificationResult.student && (
                <p className="text-slate-400 text-sm mt-1">
                  Student ID: {verificationResult.student.details?.studentId || verificationResult.student.id}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Video Display */}
      <div className="relative bg-slate-900 rounded-xl overflow-hidden border border-slate-700">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className={`w-full ${!isStreaming ? 'hidden' : ''}`}
          style={{ transform: 'scaleX(-1)' }}
        />
        
        {!isStreaming && (
          <div className="flex flex-col items-center justify-center p-12">
            <div className="text-slate-500 text-6xl mb-4">📹</div>
            <p className="text-slate-400 mb-4">Hostel Gate Scanner</p>
            <button 
              onClick={startVideo}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 rounded-lg"
            >
              Start Scanner
            </button>
          </div>
        )}

        {/* Hidden canvas */}
        <canvas ref={canvasRef} className="hidden" />
      </div>

      {/* Location Status */}
      <div className="grid grid-cols-2 gap-4">
        <div className={`p-4 rounded-xl border ${
          locationStatus === 'valid' ? 'bg-green-500/20 border-green-500/50' :
          locationStatus === 'invalid' ? 'bg-red-500/20 border-red-500/50' :
          'bg-yellow-500/20 border-yellow-500/50'
        }`}>
          <div className="flex items-center gap-2 mb-1">
            <span className={`text-lg ${
              locationStatus === 'valid' ? 'text-green-400' :
              locationStatus === 'invalid' ? 'text-red-400' :
              'text-yellow-400'
            }`}>
              {locationStatus === 'valid' ? '📍' : locationStatus === 'invalid' ? '❌' : '⏳'}
            </span>
            <span className="text-slate-400 text-sm">GPS Location</span>
          </div>
          {currentLocation && (
            <p className="text-xs text-slate-500">
              {currentLocation.lat.toFixed(6)}, {currentLocation.lng.toFixed(6)}
            </p>
          )}
          {locationError && (
            <p className="text-red-400 text-xs mt-1">{locationError}</p>
          )}
        </div>

        <div className={`p-4 rounded-xl border ${
          isStreaming ? 'bg-blue-500/20 border-blue-500/50' : 'bg-slate-800/50 border-slate-700'
        }`}>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-lg">{isStreaming ? '📷' : '⏸️'}</span>
            <span className="text-slate-400 text-sm">Camera Status</span>
          </div>
          <p className={`text-xs ${isStreaming ? 'text-green-400' : 'text-slate-500'}`}>
            {isStreaming ? 'Active - Ready to scan' : 'Not active'}
          </p>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-3">
        {isStreaming ? (
          <>
            <button 
              onClick={verifyEntry}
              disabled={isProcessing || locationStatus !== 'valid'}
              className="flex-1 bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-white py-3 rounded-lg font-medium flex items-center justify-center gap-2"
            >
              {isProcessing ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Verifying...
                </>
              ) : (
                '🔓 Verify Entry'
              )}
            </button>
            <button 
              onClick={stopVideo}
              className="bg-slate-700 hover:bg-slate-600 text-white px-6 py-3 rounded-lg"
            >
              Stop
            </button>
          </>
        ) : (
          <button 
            onClick={startVideo}
            disabled={!isInitialized}
            className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white py-3 rounded-lg font-medium"
          >
            Start Entry Scanner
          </button>
        )}
      </div>

      {/* Instructions */}
      <div className="bg-slate-800/50 p-4 rounded-lg border border-slate-700">
        <h4 className="text-white font-medium mb-2">Entry Instructions:</h4>
        <ul className="text-slate-400 text-sm space-y-1">
          <li>• Stand at the hostel entrance gate</li>
          <li>• Enable location/GPS on your device</li>
          <li>• Look directly at the camera</li>
          <li>• The system will verify your face and location</li>
          <li>• If approved, your entry will be logged automatically</li>
        </ul>
      </div>
    </div>
  );
};

export default HostelGateScanner;

