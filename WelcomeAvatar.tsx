import React, { useEffect, useState } from "react";
import "./welcome-avatar.css";

interface WelcomeAvatarProps {
  onComplete: () => void;
}

const WELCOME_MESSAGE = "Welcome to the Smart Hostel Management System";

const WelcomeAvatar: React.FC<WelcomeAvatarProps> = ({ onComplete }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);

  useEffect(() => {
    // Trigger fade-in animation on mount
    setIsVisible(true);

    // Speak the welcome message using SpeechSynthesis API
    const speakMessage = () => {
      if ("speechSynthesis" in window) {
        // Cancel any ongoing speech
        window.speechSynthesis.cancel();

        const utterance = new SpeechSynthesisUtterance(WELCOME_MESSAGE);
        
        // Configure voice settings
        utterance.rate = 0.9;
        utterance.pitch = 1;
        utterance.volume = 1;

        // Try to find a good English voice
        const voices = window.speechSynthesis.getVoices();
        const englishVoice = voices.find(
          (voice) => voice.lang.startsWith("en") && voice.name.includes("Female")
        ) || voices.find((voice) => voice.lang.startsWith("en"));

        if (englishVoice) {
          utterance.voice = englishVoice;
        }

        utterance.onstart = () => {
          setIsSpeaking(true);
        };

        utterance.onend = () => {
          setIsSpeaking(false);
        };

        utterance.onerror = () => {
          setIsSpeaking(false);
        };

        // Small delay before speaking
        setTimeout(() => {
          window.speechSynthesis.speak(utterance);
        }, 500);
      }
    };

    // Wait for voices to be loaded
    if (window.speechSynthesis.getVoices().length > 0) {
      speakMessage();
    } else {
      window.speechSynthesis.onvoiceschanged = () => {
        speakMessage();
      };
    }

    // Auto-complete after 5 seconds
    const timer = setTimeout(() => {
      setIsVisible(false);
      setTimeout(onComplete, 500); // Wait for fade-out animation
    }, 5000);

    return () => {
      window.speechSynthesis.cancel();
      clearTimeout(timer);
    };
  }, [onComplete]);

  return (
    <div className={`welcome-avatar-overlay ${isVisible ? "visible" : ""}`}>
      <div className="welcome-avatar-content">
        {/* Animated AI Avatar */}
        <div className={`welcome-avatar-image ${isSpeaking ? "speaking" : ""}`}>
          <svg
            viewBox="0 0 120 120"
            xmlns="http://www.w3.org/2000/svg"
            className="avatar-svg"
          >
            {/* Outer glow ring */}
            <circle
              cx="60"
              cy="60"
              r="55"
              fill="none"
              stroke="url(#avatarGradient)"
              strokeWidth="2"
              opacity="0.5"
              className="glow-ring"
            />
            
            {/* Main circle background */}
            <defs>
              <linearGradient id="avatarGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#6366f1" />
                <stop offset="50%" stopColor="#8b5cf6" />
                <stop offset="100%" stopColor="#06b6d4" />
              </linearGradient>
              <linearGradient id="bgGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#1e1b4b" />
                <stop offset="100%" stopColor="#312e81" />
              </linearGradient>
            </defs>
            
            <circle cx="60" cy="60" r="45" fill="url(#bgGradient)" />
            
            {/* Face */}
            <ellipse cx="60" cy="55" rx="25" ry="22" fill="#a5b4fc" opacity="0.3" />
            
            {/* Eyes */}
            <circle cx="48" cy="50" r="6" fill="#6366f1" className="eye" />
            <circle cx="72" cy="50" r="6" fill="#6366f1" className="eye" />
            <circle cx="48" cy="50" r="2" fill="white" className="eye-shine" />
            <circle cx="72" cy="50" r="2" fill="white" className="eye-shine" />
            
            {/* Smile */}
            <path
              d="M 45 70 Q 60 82 75 70"
              fill="none"
              stroke="#6366f1"
              strokeWidth="3"
              strokeLinecap="round"
              className="smile"
            />
            
            {/* Antenna */}
            <line
              x1="60"
              y1="15"
              x2="60"
              y2="25"
              stroke="#6366f1"
              strokeWidth="2"
              className="antenna"
            />
            <circle cx="60" cy="12" r="4" fill="#06b6d4" className="antenna-tip" />
          </svg>
        </div>

        {/* Welcome Message */}
        <h1 className="welcome-avatar-title">{WELCOME_MESSAGE}</h1>
        
        {/* Status indicator */}
        <div className="welcome-avatar-status">
          {isSpeaking ? (
            <span className="speaking-indicator">
              <span className="sound-wave"></span>
              <span className="sound-wave"></span>
              <span className="sound-wave"></span>
              Speaking...
            </span>
          ) : (
            <span className="loading-text">Loading system...</span>
          )}
        </div>
      </div>
    </div>
  );
};

export default WelcomeAvatar;

