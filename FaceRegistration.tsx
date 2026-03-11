import React, { useRef, useState, useEffect } from 'react';
import * as faceapi from 'face-api.js';

interface FaceRegistrationProps {
  userId: string;
  onRegister: (faceData: string) => void;
  existingFaceData?: string;
}

const FaceRegistration: React.FC<FaceRegistrationProps> = ({ userId, onRegister, existingFaceData }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isModelLoading, setIsModelLoading] = useState(true);
  const [modelError, setModelError] = useState<string | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [isRegistering, setIsRegistering] = useState(false);
  const [registrationStatus, setRegistrationStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [statusMessage, setStatusMessage] = useState('');
  const [faceDetected, setFaceDetected] = useState(false);

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
      } catch (error) {
        console.error('Error loading models:', error);
        setModelError('Failed to load face recognition models. Please refresh the page.');
        setIsModelLoading(false);
      }
    };

    loadModels();
  }, []);

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
        setCapturedImage(null);
        setRegistrationStatus('idle');
      }
    } catch (error) {
      console.error('Error accessing camera:', error);
      setStatusMessage('Unable to access camera. Please ensure camera permissions are granted.');
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

  // Capture and detect face
  const captureFace = async () => {
    if (!videoRef.current || !canvasRef.current) return;

    setIsRegistering(true);
    setStatusMessage('Detecting face...');

    const video = videoRef.current;
    const canvas = canvasRef.current;

    // Set canvas dimensions to match video
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    // Draw video frame to canvas
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(video, 0, 0);
    }

    // Detect face with landmarks
    const detections = await faceapi
      .detectSingleFace(video, new faceapi.TinyFaceDetectorOptions())
      .withFaceLandmarks()
      .withFaceDescriptor();

    if (!detections) {
      setStatusMessage('No face detected. Please position your face in the camera view.');
      setFaceDetected(false);
      setIsRegistering(false);
      return;
    }

    setFaceDetected(true);
    setStatusMessage('Face detected! Processing...');

    // Get face descriptor (128-dimensional vector)
    const faceDescriptor = Array.from(detections.descriptor);
    
    // Create a simple base64 encoding of the descriptor
    const faceData = JSON.stringify({
      userId,
      descriptor: faceDescriptor,
      timestamp: new Date().toISOString()
    });

    // Convert to base64
    const base64FaceData = btoa(faceData);
    
    setCapturedImage(canvas.toDataURL('image/png'));
    setStatusMessage('Face captured successfully! Click Register to save.');
    setIsRegistering(false);
  };

  // Register the face
  const handleRegister = () => {
    if (!capturedImage) return;
    
    // Recreate the face data
    const processRegistration = async () => {
      if (!videoRef.current) return;

      const detections = await faceapi
        .detectSingleFace(videoRef.current, new faceapi.TinyFaceDetectorOptions())
        .withFaceLandmarks()
        .withFaceDescriptor();

      if (!detections) {
        setRegistrationStatus('error');
        setStatusMessage('Face detection failed. Please try again.');
        return;
      }

      const faceDescriptor = Array.from(detections.descriptor);
      const faceData = JSON.stringify({
        userId,
        descriptor: faceDescriptor,
        timestamp: new Date().toISOString()
      });

      const base64FaceData = btoa(faceData);
      onRegister(base64FaceData);
      setRegistrationStatus('success');
      setStatusMessage('Face registered successfully!');
      stopVideo();
    };

    processRegistration();
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopVideo();
    };
  }, []);

  if (isModelLoading) {
    return (
      <div className="flex flex-col items-center justify-center p-8">
        <div className="w-16 h-16 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mb-4"></div>
        <p className="text-slate-400">Loading face recognition models...</p>
      </div>
    );
  }

  if (modelError) {
    return (
      <div className="bg-red-500/10 border border-red-500/30 p-6 rounded-xl text-center">
        <div className="text-red-400 text-4xl mb-4">⚠️</div>
        <p className="text-red-400">{modelError}</p>
        <button 
          onClick={() => window.location.reload()}
          className="mt-4 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg"
        >
          Refresh Page
        </button>
      </div>
    );
  }

  if (existingFaceData && !capturedImage) {
    return (
      <div className="bg-green-500/10 border border-green-500/30 p-6 rounded-xl">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-green-500/20 rounded-full flex items-center justify-center text-2xl">✓</div>
          <div>
            <h3 className="text-white font-bold">Face Already Registered</h3>
            <p className="text-slate-400 text-sm">Your face has been registered for smart entry verification.</p>
          </div>
        </div>
        <button 
          onClick={() => {
            // Reset to allow re-registration
            onRegister(''); // Clear existing
          }}
          className="mt-4 w-full bg-slate-700 hover:bg-slate-600 text-white py-2 rounded-lg"
        >
          Re-register Face
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Status Message */}
      {statusMessage && (
        <div className={`p-3 rounded-lg text-sm ${
          registrationStatus === 'success' ? 'bg-green-500/20 text-green-400' :
          registrationStatus === 'error' ? 'bg-red-500/20 text-red-400' :
          'bg-blue-500/20 text-blue-400'
        }`}>
          {statusMessage}
        </div>
      )}

      {/* Video/Image Display */}
      <div className="relative bg-slate-900 rounded-xl overflow-hidden border border-slate-700">
        {!capturedImage ? (
          <>
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
                <div className="text-slate-500 text-6xl mb-4">📷</div>
                <p className="text-slate-400 mb-4">Camera is not active</p>
                <button 
                  onClick={startVideo}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 rounded-lg"
                >
                  Start Camera
                </button>
              </div>
            )}
          </>
        ) : (
          <img 
            src={capturedImage} 
            alt="Captured face" 
            className="w-full"
          />
        )}
        
        {/* Face detection overlay */}
        {isStreaming && faceDetected && (
          <div className="absolute top-4 right-4 bg-green-500/20 border border-green-500/50 px-3 py-1 rounded-full">
            <span className="text-green-400 text-sm">✓ Face detected</span>
          </div>
        )}

        {/* Hidden canvas for processing */}
        <canvas ref={canvasRef} className="hidden" />
      </div>

      {/* Instructions */}
      <div className="bg-slate-800/50 p-4 rounded-lg border border-slate-700">
        <h4 className="text-white font-medium mb-2">Registration Instructions:</h4>
        <ul className="text-slate-400 text-sm space-y-1">
          <li>• Ensure good lighting on your face</li>
          <li>• Position your face in the center of the frame</li>
          <li>• Remove glasses or hats if possible</li>
          <li>• Look directly at the camera</li>
        </ul>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-3">
        {!capturedImage ? (
          <>
            <button 
              onClick={captureFace}
              disabled={!isStreaming || isRegistering}
              className="flex-1 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white py-3 rounded-lg font-medium"
            >
              {isRegistering ? 'Processing...' : 'Capture Face'}
            </button>
            {isStreaming && (
              <button 
                onClick={stopVideo}
                className="bg-slate-700 hover:bg-slate-600 text-white px-6 py-3 rounded-lg"
              >
                Stop
              </button>
            )}
          </>
        ) : (
          <>
            <button 
              onClick={handleRegister}
              className="flex-1 bg-green-600 hover:bg-green-700 text-white py-3 rounded-lg font-medium"
            >
              Register Face
            </button>
            <button 
              onClick={() => {
                setCapturedImage(null);
                setFaceDetected(false);
                setStatusMessage('');
                startVideo();
              }}
              className="bg-slate-700 hover:bg-slate-600 text-white px-6 py-3 rounded-lg"
            >
              Retake
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default FaceRegistration;

