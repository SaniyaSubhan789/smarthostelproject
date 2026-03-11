import React, { useState, useEffect, useRef } from "react";
import { createRoot } from "react-dom/client";
import { GoogleGenAI, Type, Schema } from "@google/genai";
import WelcomeAvatar from "./src/components/WelcomeAvatar";
import SmartEntry from "./src/components/SmartEntry";
import HostelGateScanner from "./src/components/HostelGateScanner";
import EntryLogs from "./src/components/EntryLogs";
import { EntryLogData } from "./src/components/EntryLogs";

// --- Configuration ---
const API_KEY = process.env.API_KEY;
const MODEL_NAME = "gemini-2.5-flash";
const ai = new GoogleGenAI({ apiKey: API_KEY });

// --- Types ---
type Role = "student" | "warden" | "admin";
type UserStatus = "pending" | "active" | "rejected";
type RequestStatus = "Pending" | "In Progress" | "Resolved";
type Priority = "Low" | "Medium" | "High" | "Critical";

interface User {
  id: string;
  name: string;
  username?: string;
  email: string;
  password?: string;
  role: Role;
  status: UserStatus;
  createdAt?: string;
  details?: {
    studentId?: string;
    department?: string;
    year?: string;
    phone?: string;
  };
  roomId?: string;
  faceData?: string; // Face recognition data
}

interface Room {
  number: string;
  capacity: number;
  type: "AC" | "Non-AC";
  occupants: string[];
  block?: string;
}

interface Complaint {
  id: string;
  studentId: string;
  studentName: string;
  description: string;
  category: string;
  priority: Priority;
  summary: string;
  roomNumber: string;
  status: RequestStatus;
  timestamp: Date;
}

interface Notice {
  id: string;
  title: string;
  content: string;
  date: string;
  author: string;
}

interface Payment {
  id: string;
  studentId: string;
  amount: number;
  status: "Paid" | "Pending" | "Overdue";
  description: string;
  date: string;
}

interface ChatMessage {
  role: "user" | "model";
  text: string;
}

interface EntryLog {
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

// Hostel GPS Configuration (Default - can be customized)
const HOSTEL_LOCATION = {
  lat: 28.6139,  // Example: Delhi coordinates
  lng: 77.2090,
  radius: 50     // 50 meters radius
};

// --- Initial Mock Data ---
const INITIAL_USERS: User[] = [
  { id: "admin1", name: "System Admin", email: "admin", password: "admin", role: "admin", status: "active" },
  { id: "warden1", name: "Chief Warden", email: "warden", password: "warden", role: "warden", status: "active" },
  { id: "student1", name: "John Doe", email: "student", password: "student", role: "student", status: "active", roomId: "101", details: { studentId: "S001", department: "CS", year: "3rd", phone: "123-456-7890" } },
  { id: "student2", name: "Alice Smith", email: "alice", password: "alice", role: "student", status: "active", roomId: "102", details: { studentId: "S002", department: "EE", year: "2nd", phone: "987-654-3210" } },
];

const INITIAL_ROOMS: Room[] = [
  { number: "101", capacity: 2, type: "AC", occupants: ["student1"], block: "Block A" },
  { number: "102", capacity: 2, type: "AC", occupants: ["student2"], block: "Block A" },
  { number: "103", capacity: 3, type: "Non-AC", occupants: [], block: "Block B" },
  { number: "104", capacity: 3, type: "Non-AC", occupants: [], block: "Block B" },
  { number: "201", capacity: 2, type: "AC", occupants: [], block: "Block A" },
];

const INITIAL_NOTICES: Notice[] = [
  { id: "n1", title: "Welcome New Students", content: "Please collect your ID cards from the office.", date: "2023-10-01", author: "Chief Warden" },
];

const INITIAL_COMPLAINTS: Complaint[] = [
  {
    id: "c1",
    studentId: "student1",
    studentName: "John Doe",
    description: "The tap in the bathroom is dripping constantly.",
    category: "Plumbing",
    priority: "Low",
    summary: "Leaky Tap",
    roomNumber: "101",
    status: "Pending",
    timestamp: new Date(Date.now() - 86400000),
  }
];

const INITIAL_PAYMENTS: Payment[] = [
  { id: "p1", studentId: "student1", amount: 12000, status: "Paid", description: "Hostel Fee - Sem 1", date: "2023-08-01" },
  { id: "p2", studentId: "student1", amount: 3500, status: "Pending", description: "Mess Fee - Oct", date: "2023-10-05" },
  { id: "p3", studentId: "student2", amount: 12000, status: "Paid", description: "Hostel Fee - Sem 1", date: "2023-08-02" },
];

// --- AI Logic ---
async function analyzeComplaint(description: string, room: string) {
  const responseSchema: Schema = {
    type: Type.OBJECT,
    properties: {
      category: { type: Type.STRING, description: "Category (Plumbing, Electrical, Furniture, Cleaning, Discipline, Leave Request, Room Change, Other)" },
      priority: { type: Type.STRING, description: "Priority (Low, Medium, High, Critical)" },
      summary: { type: Type.STRING, description: "Short 3-5 word summary" },
    },
    required: ["category", "priority", "summary"],
  };

  try {
    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: `Analyze this hostel request/complaint for Room ${room}: "${description}". If it's a leave request or room change, categorize accordingly.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: responseSchema,
      },
    });
    return JSON.parse(response.text || "{}");
  } catch (e) {
    console.error("AI Error", e);
    return { category: "General", priority: "Medium", summary: "Request" };
  }
}

// --- Password Validation ---
interface PasswordValidation {
  isValid: boolean;
  errors: string[];
}

function validatePassword(password: string): PasswordValidation {
  const errors: string[] = [];
  
  if (password.length < 8) {
    errors.push("Password must be at least 8 characters long");
  }
  if (!/[A-Z]/.test(password)) {
    errors.push("Password must contain at least one uppercase letter");
  }
  if (!/[a-z]/.test(password)) {
    errors.push("Password must contain at least one lowercase letter");
  }
  if (!/[0-9]/.test(password)) {
    errors.push("Password must contain at least one number");
  }
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    errors.push("Password must contain at least one special character");
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

// --- Simulated Password Hashing (bcrypt simulation) ---
// In production, use actual bcrypt library on backend
function hashPassword(password: string): string {
  // Simple reversible hash for demo - in production use bcrypt
  const salt = "hostel_salt_2024";
  let hash = 0;
  const combined = password + salt;
  for (let i = 0; i < combined.length; i++) {
    const char = combined.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return `hashed_${Math.abs(hash).toString(16)}_${password.length}`;
}

function verifyPassword(password: string, hashedPassword: string): boolean {
  if (!hashedPassword.startsWith('hashed_')) return password === hashedPassword;
  return hashPassword(password) === hashedPassword;
}

// --- Email Service (Nodemailer simulation) ---
// In production, use actual Nodemailer on backend
interface EmailOptions {
  to: string;
  subject: string;
  html: string;
}

function sendEmail(options: EmailOptions): void {
  // Log email to console for demo purposes
  // In production, this would call a Node.js backend API that uses Nodemailer
  console.log("=".repeat(50));
  console.log("📧 EMAIL NOTIFICATION SENT");
  console.log("=".repeat(50));
  console.log(`To: ${options.to}`);
  console.log(`Subject: ${options.subject}`);
  console.log(`Message: ${options.html}`);
  console.log("=".repeat(50));
  
  // Also show a browser notification
  if (typeof window !== 'undefined') {
    alert(`📧 Email sent to: ${options.to}\nSubject: ${options.subject}`);
  }
}

function sendApprovalEmail(userEmail: string, userName: string): void {
  sendEmail({
    to: userEmail,
    subject: "Hostel Account Approved",
    html: `
      <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 600px;">
        <h2 style="color: #4f46e5;">Hello ${userName},</h2>
        <p>Your Smart Hostel account has been <strong>approved</strong> by the administration.</p>
        <p>You can now log in to the system using your credentials.</p>
        <p style="margin-top: 20px;">Thank you.</p>
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;">
        <p style="color: #6b7280; font-size: 12px;">Smart Hostel Management System</p>
      </div>
    `
  });
}

// --- Components ---

// Extended AuthScreen with enhanced Student Registration
function AuthScreen({ onLogin, existingUsers = [] }: { onLogin: (user: User) => void; existingUsers?: User[] }) {
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [isRegistering, setIsRegistering] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [details, setDetails] = useState({ studentId: "", department: "", year: "", phone: "" });
  const [error, setError] = useState("");
  const [passwordErrors, setPasswordErrors] = useState<string[]>([]);
  const [isValidating, setIsValidating] = useState(false);

  // Check for duplicate username/email
  const checkDuplicate = (usernameValue: string, emailValue: string): string | null => {
    const existingUser = existingUsers.find(
      (u: User) => u.username?.toLowerCase() === usernameValue.toLowerCase() || 
                   u.email.toLowerCase() === emailValue.toLowerCase()
    );
    if (existingUser) {
      return "Username or email already exists. Please choose another.";
    }
    return null;
  };

  const handleLogin = () => {
    if (!selectedRole) return;
    
    // For student registration mode
    if (isRegistering && selectedRole === 'student') {
      // Validate password
      const validation = validatePassword(password);
      if (!validation.isValid) {
        setPasswordErrors(validation.errors);
        return;
      }
      
      // Check passwords match
      if (password !== confirmPassword) {
        setError("Passwords do not match");
        return;
      }
      
      // Check for duplicates
      const duplicateError = checkDuplicate(username, email);
      if (duplicateError) {
        setError(duplicateError);
        return;
      }
      
      setIsValidating(true);
      // Hash the password before storing
      const hashedPassword = hashPassword(password);
      
      setTimeout(() => {
        onLogin({ 
          username, 
          email, 
          password: hashedPassword, 
          name, 
          details, 
          isRegistering: true, 
          role: selectedRole 
        } as any);
        setIsValidating(false);
      }, 500);
      return;
    }
    
    // For login (non-student or student without registration)
    onLogin({ email, password, name, details, isRegistering: false, role: selectedRole } as any);
  };

  const resetForm = () => {
      setEmail("");
      setPassword("");
      setName("");
      setUsername("");
      setConfirmPassword("");
      setDetails({ studentId: "", department: "", year: "", phone: "" });
      setError("");
      setPasswordErrors([]);
      setIsRegistering(false);
  };

  // Real-time password validation
  const handlePasswordChange = (pwd: string) => {
    setPassword(pwd);
    if (pwd.length > 0) {
      const validation = validatePassword(pwd);
      setPasswordErrors(validation.errors);
    } else {
      setPasswordErrors([]);
    }
  };

  // Admin and Warden login - keep the original simple form
  if (selectedRole === 'warden' || selectedRole === 'admin') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 p-4">
        <div className="bg-slate-900 p-8 rounded-2xl shadow-2xl border border-slate-800 w-full max-w-md relative">
          <button onClick={() => { setSelectedRole(null); resetForm(); }} className="absolute top-4 left-4 text-slate-500 hover:text-white text-sm flex items-center gap-1">← Back</button>
          <div className="text-center mb-8 mt-4">
            <div className="w-16 h-16 mx-auto bg-gradient-to-br from-indigo-500/20 to-purple-500/20 rounded-full flex items-center justify-center text-4xl mb-4">
              {selectedRole === 'warden' ? '🛡️' : '⚙️'}
            </div>
            <h2 className="text-2xl font-bold text-white capitalize">{selectedRole} Login</h2>
            <p className="text-slate-500 text-sm mt-1">Please enter your credentials</p>
          </div>
          <div className="space-y-4">
            <div className="space-y-3">
              <input value={email} onChange={e => setEmail(e.target.value)} placeholder="Email / Username" className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-3 text-white focus:border-indigo-500 outline-none transition-colors" />
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Password" className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-3 text-white focus:border-indigo-500 outline-none transition-colors" />
            </div>
            {error && <p className="text-red-400 text-sm text-center">{error}</p>}
            <button 
              onClick={handleLogin}
              className={`w-full py-3 rounded-lg font-bold text-white transition-all transform hover:scale-[1.02] ${
                selectedRole === 'warden' ? 'bg-purple-600 hover:bg-purple-700' : 'bg-cyan-600 hover:bg-cyan-700'
              }`}
            >
              Login
            </button>
          </div>
           <div className="mt-6 p-4 bg-slate-950/50 rounded-lg border border-slate-800 text-xs text-slate-500">
             <div className="font-bold mb-2 text-slate-400">Demo Credentials:</div>
             {selectedRole === 'warden' && <div>Username: warden, Password: warden</div>}
             {selectedRole === 'admin' && <div>Username: admin, Password: admin</div>}
           </div>
        </div>
      </div>
    );
  }

  // Student login/registration form
  if (!selectedRole) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 p-6 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2"></div>
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl translate-x-1/2 translate-y-1/2"></div>
        <div className="relative z-10 w-full max-w-4xl">
           <div className="text-center mb-12">
             <h1 className="text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-cyan-400 mb-4">HostelGenie</h1>
             <p className="text-slate-400 text-lg">Smart Hostel Management System</p>
           </div>
           <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
             <button onClick={() => setSelectedRole("student")} className="group relative bg-slate-900 border border-slate-800 hover:border-indigo-500/50 p-8 rounded-2xl transition-all duration-300 hover:shadow-2xl hover:shadow-indigo-500/20 hover:-translate-y-1 text-left">
               <div className="w-14 h-14 bg-indigo-500/20 rounded-xl flex items-center justify-center text-3xl mb-6 group-hover:scale-110 transition-transform">🎓</div>
               <h3 className="text-xl font-bold text-white mb-2">Student</h3>
               <p className="text-slate-400 text-sm leading-relaxed">Login or create new account to view your room details, pay fees, and submit requests.</p>
               <div className="absolute bottom-6 right-6 opacity-0 group-hover:opacity-100 transition-opacity text-indigo-400">➔</div>
             </button>
             <button onClick={() => setSelectedRole("warden")} className="group relative bg-slate-900 border border-slate-800 hover:border-purple-500/50 p-8 rounded-2xl transition-all duration-300 hover:shadow-2xl hover:shadow-purple-500/20 hover:-translate-y-1 text-left">
               <div className="w-14 h-14 bg-purple-500/20 rounded-xl flex items-center justify-center text-3xl mb-6 group-hover:scale-110 transition-transform">🛡️</div>
               <h3 className="text-xl font-bold text-white mb-2">Warden</h3>
               <p className="text-slate-400 text-sm leading-relaxed">Manage room allocations, approve students, and resolve complaints.</p>
               <div className="absolute bottom-6 right-6 opacity-0 group-hover:opacity-100 transition-opacity text-purple-400">➔</div>
             </button>
             <button onClick={() => setSelectedRole("admin")} className="group relative bg-slate-900 border border-slate-800 hover:border-cyan-500/50 p-8 rounded-2xl transition-all duration-300 hover:shadow-2xl hover:shadow-cyan-500/20 hover:-translate-y-1 text-left">
               <div className="w-14 h-14 bg-cyan-500/20 rounded-xl flex items-center justify-center text-3xl mb-6 group-hover:scale-110 transition-transform">⚙️</div>
               <h3 className="text-xl font-bold text-white mb-2">Admin</h3>
               <p className="text-slate-400 text-sm leading-relaxed">System-wide control, analytics, and staff management.</p>
               <div className="absolute bottom-6 right-6 opacity-0 group-hover:opacity-100 transition-opacity text-cyan-400">➔</div>
             </button>
           </div>
        </div>
      </div>
    );
  }

  // Student form (login or registration)
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 p-4">
      <div className="bg-slate-900 p-8 rounded-2xl shadow-2xl border border-slate-800 w-full max-w-md relative">
        <button onClick={() => { setSelectedRole(null); resetForm(); }} className="absolute top-4 left-4 text-slate-500 hover:text-white text-sm flex items-center gap-1">← Back</button>
        <div className="text-center mb-8 mt-4">
          <div className="w-16 h-16 mx-auto bg-gradient-to-br from-indigo-500/20 to-purple-500/20 rounded-full flex items-center justify-center text-4xl mb-4">🎓</div>
          <h2 className="text-2xl font-bold text-white capitalize">{isRegistering ? "Create Account" : "Student Login"}</h2>
          <p className="text-slate-500 text-sm mt-1">{isRegistering ? "Fill in your details to register" : "Please enter your credentials"}</p>
        </div>
        
        <div className="space-y-4">
          {/* Registration Form - Only for students */}
          {isRegistering && (
            <div className="space-y-3 animate-in fade-in slide-in-from-bottom-4 duration-300">
              <input 
                value={username} 
                onChange={e => setUsername(e.target.value)} 
                placeholder="Username *" 
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-3 text-white focus:border-indigo-500 outline-none transition-colors" 
              />
              <input 
                value={name} 
                onChange={e => setName(e.target.value)} 
                placeholder="Full Name *" 
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-3 text-white focus:border-indigo-500 outline-none transition-colors" 
              />
              <input 
                value={email} 
                onChange={e => setEmail(e.target.value)} 
                placeholder="Email Address *" 
                type="email"
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-3 text-white focus:border-indigo-500 outline-none transition-colors" 
              />
              <div className="grid grid-cols-2 gap-3">
                <input 
                  value={details.studentId} 
                  onChange={e => setDetails({...details, studentId: e.target.value})} 
                  placeholder="Student ID" 
                  className="bg-slate-950 border border-slate-800 rounded-lg px-4 py-3 text-white focus:border-indigo-500 outline-none transition-colors" 
                />
                <input 
                  value={details.year} 
                  onChange={e => setDetails({...details, year: e.target.value})} 
                  placeholder="Year" 
                  className="bg-slate-950 border border-slate-800 rounded-lg px-4 py-3 text-white focus:border-indigo-500 outline-none transition-colors" 
                />
              </div>
              <input 
                value={details.department} 
                onChange={e => setDetails({...details, department: e.target.value})} 
                placeholder="Department" 
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-3 text-white focus:border-indigo-500 outline-none transition-colors" 
              />
              <input 
                value={details.phone} 
                onChange={e => setDetails({...details, phone: e.target.value})} 
                placeholder="Phone Number" 
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-3 text-white focus:border-indigo-500 outline-none transition-colors" 
              />
            </div>
          )}
          
          {/* Login Form */}
          {!isRegistering && (
            <div className="space-y-3">
              <input 
                value={email} 
                onChange={e => setEmail(e.target.value)} 
                placeholder="Email / Username" 
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-3 text-white focus:border-indigo-500 outline-none transition-colors" 
              />
              <input 
                type="password" 
                value={password} 
                onChange={e => setPassword(e.target.value)} 
                placeholder="Password" 
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-3 text-white focus:border-indigo-500 outline-none transition-colors" 
              />
            </div>
          )}
          
          {/* Password field - Show during registration */}
          {isRegistering && (
            <>
              <input 
                type="password" 
                value={password} 
                onChange={e => handlePasswordChange(e.target.value)} 
                placeholder="Password *" 
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-3 text-white focus:border-indigo-500 outline-none transition-colors" 
              />
              <input 
                type="password" 
                value={confirmPassword} 
                onChange={e => setConfirmPassword(e.target.value)} 
                placeholder="Confirm Password *" 
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-3 text-white focus:border-indigo-500 outline-none transition-colors" 
              />
              
              {/* Password Requirements Display */}
              <div className="bg-slate-950/50 p-3 rounded-lg border border-slate-800 text-xs">
                <p className="text-slate-400 mb-2 font-medium">Password must have:</p>
                <div className="space-y-1">
                  <div className={`flex items-center gap-2 ${password.length >= 8 ? 'text-green-400' : 'text-slate-500'}`}>
                    <span>{password.length >= 8 ? '✓' : '○'}</span> At least 8 characters
                  </div>
                  <div className={`flex items-center gap-2 ${/[A-Z]/.test(password) ? 'text-green-400' : 'text-slate-500'}`}>
                    <span>{/[A-Z]/.test(password) ? '✓' : '○'}</span> One uppercase letter
                  </div>
                  <div className={`flex items-center gap-2 ${/[a-z]/.test(password) ? 'text-green-400' : 'text-slate-500'}`}>
                    <span>{/[a-z]/.test(password) ? '✓' : '○'}</span> One lowercase letter
                  </div>
                  <div className={`flex items-center gap-2 ${/[0-9]/.test(password) ? 'text-green-400' : 'text-slate-500'}`}>
                    <span>{/[0-9]/.test(password) ? '✓' : '○'}</span> One number
                  </div>
                  <div className={`flex items-center gap-2 ${/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password) ? 'text-green-400' : 'text-slate-500'}`}>
                    <span>{/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password) ? '✓' : '○'}</span> One special character
                  </div>
                </div>
              </div>
              
              {/* Password Validation Errors */}
              {passwordErrors.length > 0 && (
                <div className="bg-red-500/10 border border-red-500/30 p-3 rounded-lg">
                  <p className="text-red-400 text-xs mb-1">Please fix the following:</p>
                  <ul className="text-red-400 text-xs list-disc list-inside">
                    {passwordErrors.slice(0, 3).map((err, i) => (
                      <li key={i}>{err}</li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}
          
          {error && <p className="text-red-400 text-sm text-center">{error}</p>}
          
          <button 
            onClick={handleLogin}
            disabled={isValidating}
            className="w-full py-3 rounded-lg font-bold text-white transition-all transform hover:scale-[1.02] bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isValidating ? "Creating Account..." : (isRegistering ? "Create Account" : "Login")}
          </button>
        </div>
        
        {/* Toggle between login and register for students */}
        {selectedRole === 'student' && (
          <div className="mt-6 text-center text-sm">
            <span className="text-slate-500">{isRegistering ? "Already have an account?" : "New to HostelGenie?"} </span>
            <button onClick={() => { setIsRegistering(!isRegistering); setError(""); setPasswordErrors([]); }} className="text-indigo-400 hover:underline font-medium">
              {isRegistering ? "Login here" : "Register here"}
            </button>
          </div>
        )}
        
        {!isRegistering && (
           <div className="mt-6 p-4 bg-slate-950/50 rounded-lg border border-slate-800 text-xs text-slate-500">
             <div className="font-bold mb-2 text-slate-400">Demo Credentials:</div>
             <div>Username: student, Password: student</div>
           </div>
        )}
      </div>
    </div>
  );
}

function StudentDashboard({ user, rooms, complaints, onAddComplaint, notices, payments, onPayDues }: any) {
  const [desc, setDesc] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [tab, setTab] = useState("dashboard"); // dashboard, services, payments
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);
  const [isPaying, setIsPaying] = useState(false);
  const [cardDetails, setCardDetails] = useState({ number: "", expiry: "", cvv: "" });

  const assignedRoom = rooms.find((r: Room) => r.number === user.roomId);
  const myComplaints = complaints.filter((c: Complaint) => c.studentId === user.id);
  const myPayments = payments.filter((p: Payment) => p.studentId === user.id);
  const pendingPayments = myPayments.filter((p: Payment) => p.status !== "Paid");
  const paidPayments = myPayments.filter((p: Payment) => p.status === "Paid");

  const handleComplaintSubmit = async () => {
    if (!desc) return;
    setIsProcessing(true);
    const roomNum = user.roomId || "Unassigned";
    const analysis = await analyzeComplaint(desc, roomNum);
    onAddComplaint({
      description: desc,
      category: analysis.category,
      priority: analysis.priority,
      summary: analysis.summary,
      roomNumber: roomNum,
    });
    setDesc("");
    setIsProcessing(false);
  };

  const openPaymentModal = (payment: Payment) => {
      setSelectedPayment(payment);
      setPaymentModalOpen(true);
      setCardDetails({ number: "", expiry: "", cvv: "" });
  };

  const processPayment = async () => {
      if(!selectedPayment) return;
      if(!cardDetails.number || !cardDetails.expiry || !cardDetails.cvv) {
          alert("Please fill in all card details.");
          return;
      }
      setIsPaying(true);
      await new Promise(resolve => setTimeout(resolve, 2000));
      onPayDues(selectedPayment.id);
      setIsPaying(false);
      setPaymentModalOpen(false);
      setSelectedPayment(null);
  };

  if (user.status === "pending") {
    return (
      <div className="h-full flex flex-col items-center justify-center text-center p-8">
        <div className="w-20 h-20 bg-yellow-500/20 rounded-full flex items-center justify-center text-4xl mb-4">⏳</div>
        <h2 className="text-2xl font-bold text-white mb-2">Approval Pending</h2>
        <p className="text-slate-400 max-w-md">Your registration has been submitted. Please wait for the Warden to approve your account. You will receive a notification once active.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 relative">
      {paymentModalOpen && selectedPayment && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
              <div className="bg-slate-900 w-full max-w-md p-6 rounded-2xl border border-slate-800 shadow-2xl relative">
                  <button onClick={() => setPaymentModalOpen(false)} className="absolute top-4 right-4 text-slate-500 hover:text-white">✕</button>
                  <h3 className="text-xl font-bold text-white mb-2">Secure Payment</h3>
                  <div className="text-slate-400 text-sm mb-6">Completing payment for: <span className="text-white font-medium">{selectedPayment.description}</span></div>
                  <div className="bg-indigo-900/20 p-4 rounded-lg mb-6 flex justify-between items-center border border-indigo-500/30">
                      <span className="text-indigo-300 font-medium">Amount Due</span>
                      <span className="text-2xl font-bold text-white">${selectedPayment.amount}</span>
                  </div>
                  <div className="space-y-4">
                      <div>
                          <label className="block text-xs text-slate-500 mb-1">Card Number</label>
                          <input value={cardDetails.number} onChange={e => setCardDetails({...cardDetails, number: e.target.value})} placeholder="0000 0000 0000 0000" className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-white focus:border-indigo-500 outline-none" />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                          <div>
                              <label className="block text-xs text-slate-500 mb-1">Expiry Date</label>
                              <input value={cardDetails.expiry} onChange={e => setCardDetails({...cardDetails, expiry: e.target.value})} placeholder="MM/YY" className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-white focus:border-indigo-500 outline-none" />
                          </div>
                          <div>
                              <label className="block text-xs text-slate-500 mb-1">CVV</label>
                              <input type="password" value={cardDetails.cvv} onChange={e => setCardDetails({...cardDetails, cvv: e.target.value})} placeholder="123" className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-white focus:border-indigo-500 outline-none" />
                          </div>
                      </div>
                  </div>
                  <button onClick={processPayment} disabled={isPaying} className="mt-6 w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-wait text-white py-3 rounded-lg font-bold transition-all flex items-center justify-center gap-2">
                    {isPaying ? "Processing..." : `Pay $${selectedPayment.amount}`}
                  </button>
              </div>
          </div>
      )}

      <div className="flex space-x-2 bg-slate-800 p-1 rounded-lg w-fit">
        {["dashboard", "services", "payments"].map(t => (
          <button key={t} onClick={() => setTab(t)} className={`px-4 py-2 rounded-md text-sm font-medium capitalize transition-all ${tab === t ? "bg-indigo-600 text-white" : "text-slate-400 hover:text-white"}`}>
            {t === "services" ? "Requests & Issues" : t}
          </button>
        ))}
      </div>

      {tab === "dashboard" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="space-y-6">
            <div className="bg-slate-800 p-6 rounded-xl border border-slate-700">
               <h3 className="text-slate-400 text-xs font-bold uppercase mb-4">Student Profile</h3>
               <div className="flex items-center gap-4 mb-6">
                 <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 flex items-center justify-center text-2xl font-bold text-white">{user.name.charAt(0)}</div>
                 <div>
                   <div className="text-white font-bold text-lg">{user.name}</div>
                   <div className="text-slate-400 text-sm">{user.email}</div>
                 </div>
               </div>
               <div className="space-y-3">
                 <div className="flex justify-between border-b border-slate-700 pb-2"><span className="text-slate-500 text-sm">Student ID</span><span className="text-slate-200 text-sm">{user.details?.studentId || "N/A"}</span></div>
                 <div className="flex justify-between border-b border-slate-700 pb-2"><span className="text-slate-500 text-sm">Department</span><span className="text-slate-200 text-sm">{user.details?.department || "N/A"}</span></div>
               </div>
            </div>
            <div className="bg-slate-800 p-6 rounded-xl border border-slate-700">
              <h3 className="text-slate-400 text-xs font-bold uppercase mb-4">Room Allocation</h3>
              {assignedRoom ? (
                <div>
                  <div className="flex justify-between items-start mb-4">
                    <div><div className="text-4xl font-bold text-white mb-1">{assignedRoom.number}</div><div className="text-indigo-400 text-sm">{assignedRoom.type}</div></div>
                    <div className="bg-slate-700 px-3 py-1 rounded text-xs text-slate-300">{assignedRoom.block || "Block A"}</div>
                  </div>
                  <div className="w-full bg-slate-700 h-2 rounded-full overflow-hidden mb-2"><div className="bg-green-500 h-full" style={{ width: `${(assignedRoom.occupants.length / assignedRoom.capacity) * 100}%` }}></div></div>
                  <div className="text-slate-500 text-xs flex justify-between"><span>Occupancy</span><span>{assignedRoom.occupants.length} / {assignedRoom.capacity} Students</span></div>
                </div>
              ) : (
                <div className="text-center py-6"><div className="text-slate-600 text-4xl mb-2">🛏️</div><div className="text-slate-400 text-sm">No room assigned yet.</div></div>
              )}
            </div>
          </div>
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-slate-800 p-6 rounded-xl border border-slate-700">
              <h3 className="text-slate-400 text-xs font-bold uppercase mb-4">Notice Board</h3>
              <div className="space-y-4">
                {notices.map((n: Notice) => (
                  <div key={n.id} className="bg-slate-900/50 p-4 rounded border-l-4 border-indigo-500 hover:bg-slate-900 transition-colors">
                    <div className="flex justify-between items-start"><h4 className="font-bold text-slate-200 text-sm">{n.title}</h4><span className="text-[10px] text-slate-500">{n.date}</span></div>
                    <p className="text-slate-400 text-sm mt-2">{n.content}</p>
                    <div className="mt-2 text-[10px] text-indigo-400 font-medium">By {n.author}</div>
                  </div>
                ))}
                {notices.length === 0 && <div className="text-slate-500 text-sm">No recent notices.</div>}
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === "payments" && (
        <div className="space-y-8">
            <div>
               <h3 className="text-white font-bold mb-4 flex items-center gap-2 text-lg"><span>💳</span> Outstanding Dues</h3>
               {pendingPayments.length > 0 ? (
                   <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                       {pendingPayments.map((p: Payment) => (
                           <div key={p.id} className="bg-slate-800 p-6 rounded-xl border border-l-4 border-slate-700 border-l-red-500 relative overflow-hidden group hover:border-l-red-400 transition-all">
                               <div className="relative z-10">
                                   <div className="text-slate-400 text-xs font-bold uppercase mb-2">Due Since {p.date}</div>
                                   <h4 className="text-xl font-bold text-white mb-1">{p.description}</h4>
                                   <div className="text-3xl font-bold text-white mb-6">${p.amount}</div>
                                   <button onClick={() => openPaymentModal(p)} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-2 rounded-lg font-medium shadow-lg shadow-indigo-500/20 transition-all flex items-center justify-center gap-2">Pay Now</button>
                               </div>
                           </div>
                       ))}
                   </div>
               ) : (
                   <div className="bg-slate-800/50 border border-slate-800 rounded-xl p-10 text-center">
                       <h4 className="text-white font-bold text-lg">All caught up!</h4>
                       <p className="text-slate-400 text-sm mt-1">You have no pending dues at the moment.</p>
                   </div>
               )}
            </div>
            <div className="bg-slate-800 p-6 rounded-xl border border-slate-700">
                <h3 className="text-slate-400 text-xs font-bold uppercase mb-4">Transaction History</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead className="bg-slate-900/50 text-slate-500 text-xs uppercase"><tr><th className="px-4 py-3">Description</th><th className="px-4 py-3">Date</th><th className="px-4 py-3">Amount</th><th className="px-4 py-3">Status</th></tr></thead>
                    <tbody className="divide-y divide-slate-700">
                      {paidPayments.map(p => (
                        <tr key={p.id} className="hover:bg-slate-700/20"><td className="px-4 py-3 text-white text-sm">{p.description}</td><td className="px-4 py-3 text-slate-400 text-sm">{p.date}</td><td className="px-4 py-3 text-slate-200 text-sm font-mono">${p.amount}</td><td className="px-4 py-3"><span className="text-[10px] uppercase font-bold px-2 py-1 rounded bg-green-500/20 text-green-400">Paid</span></td></tr>
                      ))}
                    </tbody>
                  </table>
                </div>
            </div>
        </div>
      )}

      {tab === "services" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-slate-800 p-6 rounded-xl border border-slate-700">
            <h3 className="text-white font-bold mb-4 flex items-center gap-2"><span>📝</span> Submit Request</h3>
            <div className="flex gap-2 mb-3">
               <button onClick={() => setDesc("I would like to apply for leave from [Start Date] to [End Date] because...")} className="text-xs bg-slate-700 hover:bg-slate-600 text-slate-300 px-3 py-1.5 rounded-full transition-colors">Leave Application</button>
               <button onClick={() => setDesc("I request a room change because...")} className="text-xs bg-slate-700 hover:bg-slate-600 text-slate-300 px-3 py-1.5 rounded-full transition-colors">Room Change</button>
               <button onClick={() => setDesc("The ceiling light is flickering...")} className="text-xs bg-slate-700 hover:bg-slate-600 text-slate-300 px-3 py-1.5 rounded-full transition-colors">Maintenance</button>
            </div>
            <textarea value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Describe your issue or request..." className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-white h-32 focus:border-indigo-500 outline-none resize-none" />
            <button onClick={handleComplaintSubmit} disabled={isProcessing || !user.roomId} className="mt-4 w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white py-2 rounded-lg font-medium transition-all flex items-center justify-center gap-2">{isProcessing ? "AI Analyzing..." : "Submit Request"}</button>
          </div>
          <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 flex flex-col">
            <h3 className="text-white font-bold mb-4">Request History</h3>
            <div className="flex-1 overflow-y-auto space-y-3 pr-2 max-h-96">
              {myComplaints.map((c: Complaint) => (
                <div key={c.id} className="p-4 bg-slate-900 rounded border border-slate-700">
                  <div className="flex justify-between items-start mb-2"><span className={`text-[10px] font-bold px-2 py-1 rounded uppercase ${c.category.includes('Leave') || c.category.includes('Room') ? 'bg-purple-500/20 text-purple-400' : c.priority === 'High' || c.priority === 'Critical' ? 'bg-red-500/20 text-red-400' : 'bg-green-500/20 text-green-400'}`}>{c.category}</span><span className={`text-[10px] font-medium ${c.status === "Resolved" ? "text-green-500" : "text-yellow-500"}`}>{c.status}</span></div>
                  <div className="font-medium text-slate-200 text-sm">{c.summary}</div>
                  <div className="text-xs text-slate-400 mt-1">{c.description}</div>
                  <div className="text-[10px] text-slate-600 mt-2 text-right">{c.timestamp.toLocaleDateString()}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function WardenDashboard({ users, rooms, setUsers, setRooms, complaints, setComplaints, notices, setNotices }: any) {
  const [activeTab, setActiveTab] = useState("approvals");
  const [newNotice, setNewNotice] = useState({ title: "", content: "" });
  const pendingStudents = users.filter((u: User) => u.role === "student" && u.status === "pending");

  const handleApprove = (id: string, approved: boolean) => {
    const user = users.find((u: User) => u.id === id);
    setUsers(users.map((u: User) => {
      if (u.id === id) {
        if (approved) {
          // Send approval email when student is approved
          sendApprovalEmail(u.email, u.name);
          return { ...u, status: "active" };
        }
        return { ...u, status: "rejected" };
      }
      return u;
    }));
  };

  const handleAllocate = (userId: string, roomNum: string) => {
    const updatedRooms = rooms.map((r: Room) => ({
      ...r,
      occupants: r.occupants.filter(oid => oid !== userId)
    }));
    const targetRoomIndex = updatedRooms.findIndex((r: Room) => r.number === roomNum);
    if (targetRoomIndex >= 0 && updatedRooms[targetRoomIndex].occupants.length < updatedRooms[targetRoomIndex].capacity) {
      updatedRooms[targetRoomIndex].occupants.push(userId);
      setRooms(updatedRooms);
      setUsers(users.map((u: User) => u.id === userId ? { ...u, roomId: roomNum } : u));
    }
  };

  const handleUpdateComplaintStatus = (id: string, newStatus: string) => {
    setComplaints(complaints.map((c: Complaint) => c.id === id ? { ...c, status: newStatus } : c));
  };

  const handlePostNotice = () => {
    if (!newNotice.title || !newNotice.content) return;
    const notice: Notice = {
      id: `n${Date.now()}`,
      title: newNotice.title,
      content: newNotice.content,
      date: new Date().toLocaleDateString(),
      author: "Warden" 
    };
    setNotices([notice, ...notices]);
    setNewNotice({ title: "", content: "" });
  };

  const handleDeleteNotice = (id: string) => {
      setNotices(notices.filter((n: Notice) => n.id !== id));
  };

  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  
  const sendChatMessage = async () => {
    if(!chatInput) return;
    const msg = chatInput;
    setChatHistory(prev => [...prev, {role: "user", text: msg}]);
    setChatInput("");
    setChatLoading(true);

    const activeStudents = users.filter((u: User) => u.role === "student" && u.status === "active");
    const pendingReqs = users.filter((u: User) => u.role === "student" && u.status === "pending");
    const pendingComplaints = complaints.filter((c: Complaint) => c.status !== "Resolved");
    const highPriorityComplaints = pendingComplaints.filter((c: Complaint) => c.priority === "High" || c.priority === "Critical");
    const totalCapacity = rooms.reduce((acc: number, r: Room) => acc + r.capacity, 0);
    const totalOccupants = rooms.reduce((acc: number, r: Room) => acc + r.occupants.length, 0);

    const contextData = {
      hostelStats: {
        totalStudents: activeStudents.length,
        occupancy: `${totalOccupants}/${totalCapacity}`,
        pendingRegistrations: pendingReqs.length,
        openComplaints: pendingComplaints.length
      },
      urgentIssues: highPriorityComplaints.map((c: Complaint) => `${c.category} issue in Room ${c.roomNumber}: ${c.summary}`).join("; "),
      pendingApprovals: pendingReqs.map((u: User) => `${u.name} (${u.details?.department})`).join(", "),
    };

    const systemInstruction = `
      You are an intelligent Hostel Warden Assistant named 'HostelGenie AI'.
      REAL-TIME HOSTEL DATA:
      ${JSON.stringify(contextData, null, 2)}
      YOUR RESPONSIBILITIES:
      1. Assist the warden in managing the hostel operations.
      2. Answer questions about occupancy, students, and complaints based strictly on the provided data.
      3. Draft professional notices when asked.
      4. Offer advice on handling specific types of complaints.
    `;

    try {
      const chat = ai.chats.create({
        model: MODEL_NAME,
        history: chatHistory.map(h => ({ role: h.role, parts: [{ text: h.text }] })),
        config: { systemInstruction: systemInstruction }
      });
      const res = await chat.sendMessage({ message: msg });
      setChatHistory(prev => [...prev, {role: "model", text: res.text || ""}]);
    } catch(e) {
      console.error(e);
      setChatHistory(prev => [...prev, {role: "model", text: "I'm having trouble connecting to the AI service. Please check your API key configuration."}]);
    }
    setChatLoading(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex space-x-2 bg-slate-800 p-1 rounded-lg w-fit">
        {["approvals", "rooms", "complaints", "notices", "assistant"].map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)} className={`px-4 py-2 rounded-md text-sm font-medium capitalize transition-all ${activeTab === tab ? "bg-indigo-600 text-white" : "text-slate-400 hover:text-white"}`}>
            {tab} {tab === "approvals" && pendingStudents.length > 0 && <span className="ml-1 bg-red-500 text-white text-[10px] px-1.5 rounded-full">{pendingStudents.length}</span>}
          </button>
        ))}
      </div>

      {activeTab === "approvals" && (
        <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
          <div className="p-4 border-b border-slate-700 font-bold text-white">Pending Registrations</div>
          {pendingStudents.length === 0 ? (
            <div className="p-8 text-center text-slate-500">No pending requests.</div>
          ) : (
            <div className="divide-y divide-slate-700">
              {pendingStudents.map((u: User) => (
                <div key={u.id} className="p-4 flex items-center justify-between">
                  <div>
                    <div className="text-white font-medium">{u.name}</div>
                    <div className="text-slate-400 text-sm">{u.details?.studentId} • {u.details?.department}</div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => handleApprove(u.id, true)} className="px-3 py-1 bg-green-600 hover:bg-green-700 text-white text-sm rounded">Approve</button>
                    <button onClick={() => handleApprove(u.id, false)} className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-sm rounded">Reject</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === "rooms" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-slate-800 rounded-xl border border-slate-700 p-4">
            <h3 className="text-white font-bold mb-4">Room Allocation</h3>
            <div className="space-y-2 max-h-96 overflow-y-auto">
               {users.filter((u: User) => u.role === "student" && u.status === "active").map((u: User) => (
                 <div key={u.id} className="flex items-center justify-between bg-slate-900 p-2 rounded">
                   <span className="text-slate-300 text-sm">{u.name} ({u.roomId || "Unassigned"})</span>
                   <select className="bg-slate-800 text-white text-xs p-1 rounded border border-slate-700" value={u.roomId || ""} onChange={(e) => handleAllocate(u.id, e.target.value)}>
                     <option value="">Select Room</option>
                     {rooms.map((r: Room) => (
                       <option key={r.number} value={r.number} disabled={r.occupants.length >= r.capacity && !r.occupants.includes(u.id)}>{r.number} ({r.occupants.length}/{r.capacity})</option>
                     ))}
                   </select>
                 </div>
               ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 content-start">
            {rooms.map((r: Room) => (
              <div key={r.number} className="bg-slate-800 p-3 rounded-lg border border-slate-700 relative overflow-hidden">
                <div className="flex justify-between items-center mb-2"><span className="font-bold text-white text-lg">{r.number}</span><span className="text-[10px] uppercase text-slate-500 bg-slate-900 px-1 rounded">{r.type}</span></div>
                <div className="w-full bg-slate-700 h-1.5 rounded-full overflow-hidden"><div className="bg-indigo-500 h-full transition-all" style={{width: `${(r.occupants.length / r.capacity) * 100}%`}} /></div>
                <div className="text-xs text-slate-400 mt-1 text-right">{r.occupants.length} / {r.capacity} Beds</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === "complaints" && (
        <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
          <table className="w-full text-left">
            <thead className="bg-slate-900 text-slate-400 text-xs uppercase"><tr><th className="px-4 py-3">Issue</th><th className="px-4 py-3">Room</th><th className="px-4 py-3">Priority</th><th className="px-4 py-3">Status</th></tr></thead>
            <tbody className="divide-y divide-slate-700">
              {complaints.map((c: Complaint) => (
                <tr key={c.id} className="hover:bg-slate-700/50">
                  <td className="px-4 py-3"><div className="text-white text-sm font-medium">{c.summary}</div><div className="text-slate-500 text-xs">{c.category} • {c.studentName}</div></td>
                  <td className="px-4 py-3 text-slate-300 text-sm">{c.roomNumber}</td>
                  <td className="px-4 py-3"><span className={`text-[10px] px-2 py-1 rounded font-bold ${c.priority === 'High' ? 'bg-red-500/20 text-red-400' : 'bg-green-500/20 text-green-400'}`}>{c.priority}</span></td>
                  <td className="px-4 py-3">
                    <select value={c.status} onChange={(e) => handleUpdateComplaintStatus(c.id, e.target.value)} className={`text-xs px-2 py-1 rounded bg-slate-900 border border-slate-700 text-white focus:outline-none focus:border-indigo-500 ${c.status === "Resolved" ? "text-green-400" : c.status === "In Progress" ? "text-yellow-400" : "text-red-400"}`}>
                      <option value="Pending">Pending</option><option value="In Progress">In Progress</option><option value="Resolved">Resolved</option>
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === "notices" && (
        <div className="space-y-6">
          <div className="bg-slate-800 p-6 rounded-xl border border-slate-700">
            <h3 className="text-white font-bold mb-4 flex items-center gap-2"><span>📢</span> Post New Announcement</h3>
            <div className="space-y-4">
              <div><input value={newNotice.title} onChange={e => setNewNotice({...newNotice, title: e.target.value})} className="w-full bg-slate-900 border border-slate-700 rounded p-3 text-white focus:border-indigo-500 outline-none placeholder-slate-500" placeholder="Title (e.g. Hostel Maintenance Schedule)"/></div>
              <div><textarea value={newNotice.content} onChange={e => setNewNotice({...newNotice, content: e.target.value})} className="w-full bg-slate-900 border border-slate-700 rounded p-3 text-white h-32 resize-none focus:border-indigo-500 outline-none placeholder-slate-500" placeholder="Enter announcement details..."/></div>
              <button onClick={handlePostNotice} className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 rounded-lg font-medium transition-colors">Publish Notice</button>
            </div>
          </div>
          <div className="space-y-4">
            <h3 className="text-slate-400 text-xs font-bold uppercase">Recent Announcements</h3>
            {notices.length === 0 ? <div className="text-center text-slate-500 py-8 bg-slate-800/50 rounded-xl border border-slate-800">No announcements posted yet.</div> : (
                notices.map((n: Notice) => (
                  <div key={n.id} className="bg-slate-800 p-6 rounded-xl border border-slate-700 relative group hover:border-indigo-500/50 transition-colors">
                      <div className="flex justify-between items-start mb-2"><h4 className="text-lg font-bold text-white">{n.title}</h4><span className="text-xs text-slate-500 bg-slate-900 px-2 py-1 rounded">{n.date}</span></div>
                      <p className="text-slate-300 text-sm whitespace-pre-wrap leading-relaxed">{n.content}</p>
                      <div className="mt-4 flex justify-between items-center border-t border-slate-700 pt-3">
                          <div className="flex items-center gap-2"><div className="w-6 h-6 rounded-full bg-indigo-500 flex items-center justify-center text-[10px] text-white">W</div><span className="text-xs text-indigo-400 font-medium">By {n.author}</span></div>
                          <button onClick={() => handleDeleteNotice(n.id)} className="text-red-400 hover:text-red-300 text-xs px-3 py-1 hover:bg-red-500/10 rounded transition-all">Delete</button>
                      </div>
                  </div>
                ))
            )}
          </div>
        </div>
      )}

      {activeTab === "assistant" && (
        <div className="flex flex-col h-[500px] bg-slate-800 rounded-xl border border-slate-700">
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
             {chatHistory.map((m, i) => (
               <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}><div className={`max-w-[80%] p-3 rounded-lg text-sm ${m.role === 'user' ? 'bg-indigo-600 text-white' : 'bg-slate-700 text-slate-200'}`}>{m.text}</div></div>
             ))}
             {chatLoading && <div className="text-slate-500 text-xs ml-4">Assistant is typing...</div>}
          </div>
          <div className="p-4 bg-slate-900 border-t border-slate-700 flex gap-2">
            <input value={chatInput} onChange={e => setChatInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && sendChatMessage()} className="flex-1 bg-slate-800 border border-slate-700 rounded p-2 text-white text-sm" placeholder="Ask about occupancy, complaints, or draft a notice..." />
            <button onClick={sendChatMessage} className="bg-indigo-600 text-white px-4 py-2 rounded text-sm">Send</button>
          </div>
        </div>
      )}
    </div>
  );
}

function AdminDashboard({ users, setUsers, rooms, setRooms, payments, setPayments, complaints }: any) {
  const [activeTab, setActiveTab] = useState("wardens");
  const [newWardenEmail, setNewWardenEmail] = useState("");
  const [newWardenName, setNewWardenName] = useState("");
  const [selectedStudent, setSelectedStudent] = useState<User | null>(null);
  const [roomForm, setRoomForm] = useState({ number: "", capacity: 2, type: "AC", block: "" });
  const [isEditingRoom, setIsEditingRoom] = useState(false);
  const [paymentFilterStatus, setPaymentFilterStatus] = useState("All");
  const [paymentSearch, setPaymentSearch] = useState("");
  const [newPayment, setNewPayment] = useState({ studentId: "", amount: "", description: "", status: "Pending", date: new Date().toISOString().split('T')[0] });

  const addWarden = () => {
    if(!newWardenEmail || !newWardenName) return;
    const newWarden: User = { id: `warden${Date.now()}`, name: newWardenName, email: newWardenEmail, password: "password", role: "warden", status: "active" };
    setUsers([...users, newWarden]);
    setNewWardenName("");
    setNewWardenEmail("");
  };

  const handleAddRoom = () => {
    if (!roomForm.number || !roomForm.block) { alert("Please fill in Room Number and Block"); return; }
    if (rooms.some((r: Room) => r.number === roomForm.number)) { alert("Room number already exists!"); return; }
    const newRoom: Room = { number: roomForm.number, capacity: Number(roomForm.capacity), type: roomForm.type as "AC" | "Non-AC", block: roomForm.block, occupants: [] };
    setRooms([...rooms, newRoom]);
    resetRoomForm();
  };

  const handleEditRoom = (room: Room) => {
    setRoomForm({ number: room.number, capacity: room.capacity, type: room.type, block: room.block || "" });
    setIsEditingRoom(true);
  };

  const handleUpdateRoom = () => {
    setRooms(rooms.map((r: Room) => r.number === roomForm.number ? { ...r, capacity: Number(roomForm.capacity), type: roomForm.type as "AC" | "Non-AC", block: roomForm.block } : r));
    resetRoomForm();
  };

  const handleDeleteRoom = (roomNum: string) => {
    if (window.confirm(`Delete Room ${roomNum}?`)) {
        setRooms(rooms.filter((r: Room) => r.number !== roomNum));
        setUsers(users.map((u: User) => u.roomId === roomNum ? { ...u, roomId: undefined } : u));
    }
  };

  const resetRoomForm = () => { setRoomForm({ number: "", capacity: 2, type: "AC", block: "" }); setIsEditingRoom(false); };

  const handleAddPayment = () => {
    if (!newPayment.studentId || !newPayment.amount || !newPayment.description) return;
    const payment: Payment = { id: `p${Date.now()}`, studentId: newPayment.studentId, amount: Number(newPayment.amount), description: newPayment.description, status: newPayment.status as "Paid" | "Pending" | "Overdue", date: newPayment.date };
    setPayments([payment, ...payments]);
    setNewPayment({ ...newPayment, amount: "", description: "" });
  };

  const togglePaymentStatus = (id: string) => {
      setPayments(payments.map((p: Payment) => p.id === id ? { ...p, status: p.status === 'Paid' ? 'Pending' : 'Paid' } : p));
  };

  const studentUsers = users.filter((u: User) => u.role === "student");
  const filteredPayments = payments.filter((p: Payment) => {
    const matchesStatus = paymentFilterStatus === "All" || p.status === paymentFilterStatus;
    const student = users.find((u: User) => u.id === p.studentId);
    const matchesSearch = (student?.name.toLowerCase() || "").includes(paymentSearch.toLowerCase()) || p.description.toLowerCase().includes(paymentSearch.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  return (
    <div className="space-y-6 relative">
      {selectedStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-slate-900 w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-2xl border border-slate-800 shadow-2xl relative">
            <button onClick={() => setSelectedStudent(null)} className="absolute top-4 right-4 text-slate-500 hover:text-white">✕</button>
            <div className="p-8">
              <div className="flex items-center gap-6 mb-8">
                 <div className="w-20 h-20 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-3xl font-bold text-white">{selectedStudent.name.charAt(0)}</div>
                 <div><h2 className="text-3xl font-bold text-white">{selectedStudent.name}</h2><div className="flex gap-4 text-slate-400 mt-1"><span>{selectedStudent.email}</span><span>•</span><span>{selectedStudent.details?.studentId || "No ID"}</span></div></div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-6">
                   <div className="bg-slate-800 p-5 rounded-xl border border-slate-700">
                      <h3 className="text-slate-400 text-xs font-bold uppercase mb-4">Personal Details</h3>
                      <div className="space-y-3">
                         <div className="flex justify-between border-b border-slate-700 pb-2"><span className="text-slate-500 text-sm">Department</span><span className="text-white text-sm">{selectedStudent.details?.department || "N/A"}</span></div>
                         <div className="flex justify-between border-b border-slate-700 pb-2"><span className="text-slate-500 text-sm">Year</span><span className="text-white text-sm">{selectedStudent.details?.year || "N/A"}</span></div>
                         <div className="flex justify-between border-b border-slate-700 pb-2"><span className="text-slate-500 text-sm">Phone</span><span className="text-white text-sm">{selectedStudent.details?.phone || "N/A"}</span></div>
                      </div>
                   </div>
                </div>
                <div className="space-y-6">
                   <div className="bg-slate-800 p-5 rounded-xl border border-slate-700 max-h-60 overflow-y-auto">
                      <h3 className="text-slate-400 text-xs font-bold uppercase mb-4 sticky top-0 bg-slate-800 pb-2">Recent Requests</h3>
                      <div className="space-y-3">
                        {complaints.filter((c: Complaint) => c.studentId === selectedStudent.id).map((c: Complaint) => (
                           <div key={c.id} className="bg-slate-900 p-3 rounded border border-slate-700"><div className="flex justify-between mb-1"><span className="text-white text-xs font-bold">{c.category}</span><span className={`text-[10px] ${c.status === "Resolved" ? "text-green-400" : "text-yellow-400"}`}>{c.status}</span></div><div className="text-slate-400 text-xs">{c.summary}</div></div>
                        ))}
                      </div>
                   </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-3 gap-6">
        <div className="bg-slate-800 p-6 rounded-xl border border-slate-700"><div className="text-slate-400 text-xs font-bold uppercase">Total Users</div><div className="text-3xl font-bold text-white mt-1">{users.length}</div></div>
        <div className="bg-slate-800 p-6 rounded-xl border border-slate-700"><div className="text-slate-400 text-xs font-bold uppercase">Total Rooms</div><div className="text-3xl font-bold text-white mt-1">{rooms.length}</div></div>
        <div className="bg-slate-800 p-6 rounded-xl border border-slate-700"><div className="text-slate-400 text-xs font-bold uppercase">Students</div><div className="text-3xl font-bold text-white mt-1">{users.filter((u: User) => u.role === "student").length}</div></div>
      </div>

      <div className="flex space-x-2 bg-slate-800 p-1 rounded-lg w-fit">
        {["wardens", "students", "rooms", "payments"].map(tab => (
        <button key={tab} onClick={() => setActiveTab(tab)} className={`px-4 py-2 rounded-md text-sm font-medium capitalize transition-all ${activeTab === tab ? "bg-indigo-600 text-white" : "text-slate-400 hover:text-white"}`}>
            {tab === 'wardens' ? 'Manage Wardens' : tab === 'students' ? 'Students' : tab === 'rooms' ? 'Manage Rooms' : 'Manage Payments'}
        </button>
        ))}
      </div>

      {activeTab === 'wardens' && (
        <div className="bg-slate-800 rounded-xl border border-slate-700 p-6">
          <h3 className="text-white font-bold mb-4">Manage Wardens</h3>
          <div className="flex gap-4 mb-6">
            <input value={newWardenName} onChange={e => setNewWardenName(e.target.value)} placeholder="Warden Name" className="flex-1 bg-slate-900 border border-slate-700 rounded px-3 py-2 text-white" />
            <input value={newWardenEmail} onChange={e => setNewWardenEmail(e.target.value)} placeholder="Email" className="flex-1 bg-slate-900 border border-slate-700 rounded px-3 py-2 text-white" />
            <button onClick={addWarden} className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded font-medium">Add Warden</button>
          </div>
          <div className="space-y-2">
            {users.filter((u: User) => u.role === "warden").map((u: User) => (
              <div key={u.id} className="flex justify-between items-center bg-slate-900 p-3 rounded border border-slate-800"><div><div className="text-white font-medium">{u.name}</div><div className="text-slate-500 text-xs">{u.email}</div></div><button onClick={() => setUsers(users.filter((x: User) => x.id !== u.id))} className="text-red-500 hover:text-red-400 text-sm">Remove</button></div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'students' && (
        <div className="bg-slate-800 rounded-xl border border-slate-700 p-6">
           <h3 className="text-white font-bold mb-4">All Students</h3>
           <div className="space-y-2 max-h-[500px] overflow-y-auto">
             <table className="w-full text-left border-collapse">
                <thead className="bg-slate-900 text-slate-400 text-xs uppercase sticky top-0"><tr><th className="px-4 py-3 rounded-tl">Name</th><th className="px-4 py-3">Student ID</th><th className="px-4 py-3">Room</th><th className="px-4 py-3">Status</th><th className="px-4 py-3 rounded-tr text-right">Actions</th></tr></thead>
                <tbody className="divide-y divide-slate-800">
                   {studentUsers.map((u: User) => (
                     <tr key={u.id} className="hover:bg-slate-700/30">
                        <td className="px-4 py-3 text-white text-sm font-medium">{u.name}<div className="text-slate-500 text-xs font-normal">{u.email}</div></td>
                        <td className="px-4 py-3 text-slate-300 text-sm">{u.details?.studentId || "N/A"}</td>
                        <td className="px-4 py-3 text-indigo-400 text-sm">{u.roomId || "Unassigned"}</td>
                        <td className="px-4 py-3"><span className={`text-[10px] uppercase font-bold px-2 py-1 rounded ${u.status === "active" ? "bg-green-500/20 text-green-400" : "bg-yellow-500/20 text-yellow-400"}`}>{u.status}</span></td>
                        <td className="px-4 py-3 text-right"><button onClick={() => setSelectedStudent(u)} className="text-xs bg-slate-700 hover:bg-slate-600 text-white px-3 py-1.5 rounded transition-colors">View Details</button></td>
                     </tr>
                   ))}
                </tbody>
             </table>
           </div>
        </div>
      )}

      {activeTab === 'rooms' && (
        <div className="bg-slate-800 rounded-xl border border-slate-700 p-6">
            <h3 className="text-white font-bold mb-4">{isEditingRoom ? "Edit Room" : "Add New Room"}</h3>
            <div className="flex gap-4 mb-6 items-end flex-wrap">
                 <div className="flex-1 min-w-[120px]"><label className="text-xs text-slate-400 mb-1 block">Room No</label><input value={roomForm.number} onChange={e => setRoomForm({...roomForm, number: e.target.value})} placeholder="e.g. 101" disabled={isEditingRoom} className={`w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-white ${isEditingRoom ? 'opacity-50 cursor-not-allowed' : ''}`} /></div>
                 <div className="flex-1 min-w-[120px]"><label className="text-xs text-slate-400 mb-1 block">Block</label><input value={roomForm.block} onChange={e => setRoomForm({...roomForm, block: e.target.value})} placeholder="e.g. Block A" className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-white" /></div>
                 <div className="flex-1 min-w-[100px]"><label className="text-xs text-slate-400 mb-1 block">Capacity</label><input type="number" value={roomForm.capacity} onChange={e => setRoomForm({...roomForm, capacity: Number(e.target.value)})} className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-white" /></div>
                 <div className="flex-1 min-w-[120px]"><label className="text-xs text-slate-400 mb-1 block">Type</label><select value={roomForm.type} onChange={e => setRoomForm({...roomForm, type: e.target.value})} className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-white"><option value="AC">AC</option><option value="Non-AC">Non-AC</option></select></div>
                 <div className="flex gap-2"><button onClick={isEditingRoom ? handleUpdateRoom : handleAddRoom} className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 rounded font-medium h-[42px]">{isEditingRoom ? "Update" : "Add"}</button>{isEditingRoom && (<button onClick={resetRoomForm} className="bg-slate-600 hover:bg-slate-700 text-white px-4 py-2 rounded font-medium h-[42px]">Cancel</button>)}</div>
            </div>
            <div className="space-y-2 max-h-[400px] overflow-y-auto">
               <table className="w-full text-left border-collapse">
                    <thead className="bg-slate-900 text-slate-400 text-xs uppercase sticky top-0"><tr><th className="px-4 py-3 rounded-tl">Room</th><th className="px-4 py-3">Block</th><th className="px-4 py-3">Type</th><th className="px-4 py-3">Capacity</th><th className="px-4 py-3">Occupancy</th><th className="px-4 py-3 rounded-tr text-right">Actions</th></tr></thead>
                    <tbody className="divide-y divide-slate-800">
                        {rooms.map((r: Room) => (
                            <tr key={r.number} className="hover:bg-slate-700/30">
                                <td className="px-4 py-3 font-bold text-white">{r.number}</td>
                                <td className="px-4 py-3 text-slate-300">{r.block}</td>
                                <td className="px-4 py-3 text-slate-300"><span className={`text-[10px] px-2 py-0.5 rounded ${r.type === 'AC' ? 'bg-cyan-500/20 text-cyan-400' : 'bg-slate-600/30 text-slate-400'}`}>{r.type}</span></td>
                                <td className="px-4 py-3 text-slate-300">{r.capacity}</td>
                                <td className="px-4 py-3 text-slate-300"><div className="flex items-center gap-2"><div className="w-16 bg-slate-700 h-1.5 rounded-full overflow-hidden"><div className="bg-green-500 h-full" style={{ width: `${(r.occupants.length / r.capacity) * 100}%` }}></div></div><span className="text-xs">{r.occupants.length}</span></div></td>
                                <td className="px-4 py-3 text-right space-x-2"><button onClick={() => handleEditRoom(r)} className="text-indigo-400 hover:text-indigo-300 text-sm">Edit</button><button onClick={() => handleDeleteRoom(r.number)} className="text-red-400 hover:text-red-300 text-sm">Delete</button></td>
                            </tr>
                        ))}
                    </tbody>
               </table>
            </div>
        </div>
      )}

      {activeTab === 'payments' && (
        <div className="bg-slate-800 rounded-xl border border-slate-700 p-6">
            <h3 className="text-white font-bold mb-4">Manage Payments</h3>
            <div className="bg-slate-900/50 p-4 rounded-lg mb-6 border border-slate-800">
                <h4 className="text-slate-400 text-xs font-bold uppercase mb-3">Record New Payment</h4>
                <div className="flex gap-4 items-end flex-wrap">
                    <div className="flex-1 min-w-[200px]"><label className="text-xs text-slate-500 mb-1 block">Student</label><select value={newPayment.studentId} onChange={e => setNewPayment({...newPayment, studentId: e.target.value})} className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-white text-sm"><option value="">Select Student</option>{studentUsers.map((u: User) => (<option key={u.id} value={u.id}>{u.name} ({u.details?.studentId})</option>))}</select></div>
                    <div className="flex-1 min-w-[120px]"><label className="text-xs text-slate-500 mb-1 block">Amount</label><input type="number" value={newPayment.amount} onChange={e => setNewPayment({...newPayment, amount: e.target.value})} className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-white text-sm" placeholder="0.00" /></div>
                    <div className="flex-1 min-w-[200px]"><label className="text-xs text-slate-500 mb-1 block">Description</label><input value={newPayment.description} onChange={e => setNewPayment({...newPayment, description: e.target.value})} className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-white text-sm" placeholder="e.g. Hostel Fee 2024" /></div>
                    <div className="flex-1 min-w-[140px]"><label className="text-xs text-slate-500 mb-1 block">Date</label><input type="date" value={newPayment.date} onChange={e => setNewPayment({...newPayment, date: e.target.value})} className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-white text-sm" /></div>
                    <button onClick={handleAddPayment} className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded font-medium text-sm h-[38px]">Add Record</button>
                </div>
            </div>
            <div className="flex gap-4 mb-4">
                 <input placeholder="Search by student name or description..." value={paymentSearch} onChange={e => setPaymentSearch(e.target.value)} className="flex-1 bg-slate-900 border border-slate-700 rounded px-3 py-2 text-white text-sm"/>
                 <select value={paymentFilterStatus} onChange={e => setPaymentFilterStatus(e.target.value)} className="bg-slate-900 border border-slate-700 rounded px-3 py-2 text-white text-sm min-w-[150px]"><option value="All">All Status</option><option value="Paid">Paid</option><option value="Pending">Pending</option><option value="Overdue">Overdue</option></select>
            </div>
            <div className="space-y-2 max-h-[400px] overflow-y-auto">
               <table className="w-full text-left border-collapse">
                    <thead className="bg-slate-900 text-slate-400 text-xs uppercase sticky top-0"><tr><th className="px-4 py-3 rounded-tl">Student</th><th className="px-4 py-3">Description</th><th className="px-4 py-3">Date</th><th className="px-4 py-3">Amount</th><th className="px-4 py-3">Status</th><th className="px-4 py-3 rounded-tr text-right">Actions</th></tr></thead>
                    <tbody className="divide-y divide-slate-800">
                        {filteredPayments.map((p: Payment) => {
                             const student = users.find((u: User) => u.id === p.studentId);
                             return (
                                <tr key={p.id} className="hover:bg-slate-700/30">
                                    <td className="px-4 py-3"><div className="text-white font-medium text-sm">{student?.name || "Unknown"}</div><div className="text-slate-500 text-xs">{student?.details?.studentId}</div></td>
                                    <td className="px-4 py-3 text-slate-300 text-sm">{p.description}</td>
                                    <td className="px-4 py-3 text-slate-400 text-xs">{p.date}</td>
                                    <td className="px-4 py-3 text-slate-200 font-mono text-sm">${p.amount}</td>
                                    <td className="px-4 py-3"><span className={`text-[10px] uppercase font-bold px-2 py-1 rounded ${p.status === "Paid" ? "bg-green-500/20 text-green-400" : p.status === "Pending" ? "bg-yellow-500/20 text-yellow-400" : "bg-red-500/20 text-red-400"}`}>{p.status}</span></td>
                                    <td className="px-4 py-3 text-right">{p.status !== 'Paid' && (<button onClick={() => togglePaymentStatus(p.id)} className="text-xs bg-green-600/20 hover:bg-green-600/40 text-green-400 px-2 py-1 rounded transition-colors">Mark Paid</button>)}</td>
                                </tr>
                             );
                        })}
                    </tbody>
               </table>
            </div>
        </div>
      )}
    </div>
  );
}

function App() {
  const [showWelcome, setShowWelcome] = useState<boolean>(() => {
    // Check if welcome screen was already shown in this session
    const welcomeShown = localStorage.getItem("welcomeShown");
    return !welcomeShown;
  });
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [users, setUsers] = useState<User[]>(INITIAL_USERS);
  const [rooms, setRooms] = useState<Room[]>(INITIAL_ROOMS);
  const [complaints, setComplaints] = useState<Complaint[]>(INITIAL_COMPLAINTS);
  const [notices, setNotices] = useState<Notice[]>(INITIAL_NOTICES);
const [payments, setPayments] = useState<Payment[]>(INITIAL_PAYMENTS);
const [entryLogs, setEntryLogs] = useState<EntryLog[]>([]);
const [activeDashboardTab, setActiveDashboardTab] = useState<'dashboard' | 'smartentry' | 'gatescanner' | 'entrylogs'>('dashboard');

  const handleLogin = (creds: any) => {
    if (creds.isRegistering) {
      // Create new student with pending status, username, and hashed password
      const newUser: User = { 
        id: `student${Date.now()}`, 
        username: creds.username,
        name: creds.name, 
        email: creds.email, 
        password: creds.password, 
        role: "student", 
        status: "pending", 
        createdAt: new Date().toISOString(),
        details: creds.details 
      };
      setUsers([...users, newUser]);
      // Show pending message - don't log them in yet
      alert("Registration successful. Please wait for approval from the hostel administration.");
    } else {
      const user = users.find(u => 
        (u.email === creds.email || u.username === creds.email) && 
        verifyPassword(creds.password, u.password || "")
      );
      if (user) {
        if (user.role === creds.role) {
          // Check if pending student is trying to login
          if (user.status === "pending") {
            alert("Your account is still pending approval. Please wait for the Warden to approve your account.");
            return;
          }
          setCurrentUser(user);
        }
        else alert(`Access Denied: This account is not a ${creds.role} account.`);
      } else alert("Invalid credentials! (Try demo accounts: admin/admin, warden/warden, student/student)");
    }
  };

  const handleLogout = () => setCurrentUser(null);
  const handleAddComplaint = (data: any) => { if (!currentUser) return; const newComplaint: Complaint = { id: `c${Date.now()}`, studentId: currentUser.id, studentName: currentUser.name, description: data.description, category: data.category || "General", priority: data.priority || "Medium", summary: data.summary || "Complaint", roomNumber: data.roomNumber, status: "Pending", timestamp: new Date() }; setComplaints([newComplaint, ...complaints]); };
const handlePayDues = (id: string) => { setPayments(payments.map(p => p.id === id ? { ...p, status: "Paid", date: new Date().toISOString().split('T')[0] } : p)); };
  
  // Handle face registration
  const handleFaceRegister = (userId: string, faceData: string) => {
    setUsers(users.map(u => u.id === userId ? { ...u, faceData } : u));
  };
  
  // Handle entry log
  const handleEntryLog = (log: EntryLog) => {
    setEntryLogs([log, ...entryLogs]);
  };

  const handleWelcomeComplete = () => {
    localStorage.setItem("welcomeShown", "true");
    setShowWelcome(false);
  };

  if (showWelcome) {
    return <WelcomeAvatar onComplete={handleWelcomeComplete} />;
  }

  if (!currentUser) return <AuthScreen onLogin={handleLogin} existingUsers={users} />;

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col md:flex-row">
      <div className="w-full md:w-64 bg-slate-900 border-r border-slate-800 p-4 flex flex-col">
        <div className="mb-8 p-2"><h1 className="text-2xl font-bold text-white">HostelGenie</h1><p className="text-xs text-slate-500 uppercase tracking-widest mt-1">{currentUser.role} Portal</p></div>
        <div className="flex-1 space-y-2"><div className="bg-slate-800/50 p-3 rounded-lg flex items-center gap-3 mb-4"><div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-white font-bold text-lg">{currentUser.name.charAt(0)}</div><div className="overflow-hidden"><div className="text-white font-medium truncate">{currentUser.name}</div><div className="text-slate-500 text-xs truncate">{currentUser.email}</div></div></div></div>
        <button onClick={handleLogout} className="mt-auto w-full bg-slate-800 hover:bg-red-900/20 hover:text-red-400 text-slate-400 py-2 rounded-lg transition-colors flex items-center justify-center gap-2"><span>Logout</span></button>
      </div>
      <div className="flex-1 p-8 overflow-y-auto">
        <header className="mb-8 flex justify-between items-center"><div><h2 className="text-2xl font-bold text-white">Dashboard</h2><p className="text-slate-400 text-sm">Overview & Management</p></div></header>
{currentUser.role === 'student' && (
          <div className="space-y-6">
            {/* Smart Entry Tab Navigation */}
            <div className="flex space-x-2 bg-slate-800 p-1 rounded-lg w-fit">
              <button 
                onClick={() => setActiveDashboardTab('dashboard')} 
                className={`px-4 py-2 rounded-md text-sm font-medium capitalize transition-all ${activeDashboardTab === 'dashboard' ? "bg-indigo-600 text-white" : "text-slate-400 hover:text-white"}`}
              >
                Dashboard
              </button>
              <button 
                onClick={() => setActiveDashboardTab('smartentry')} 
                className={`px-4 py-2 rounded-md text-sm font-medium capitalize transition-all ${activeDashboardTab === 'smartentry' ? "bg-indigo-600 text-white" : "text-slate-400 hover:text-white"}`}
              >
                🚪 Smart Entry
              </button>
              <button 
                onClick={() => setActiveDashboardTab('gatescanner')} 
                className={`px-4 py-2 rounded-md text-sm font-medium capitalize transition-all ${activeDashboardTab === 'gatescanner' ? "bg-indigo-600 text-white" : "text-slate-400 hover:text-white"}`}
              >
                🏠 Gate Scanner
              </button>
            </div>
            
            {activeDashboardTab === 'dashboard' && <StudentDashboard user={currentUser} rooms={rooms} complaints={complaints} onAddComplaint={handleAddComplaint} notices={notices} payments={payments} onPayDues={handlePayDues} />}
            {activeDashboardTab === 'smartentry' && <SmartEntry user={currentUser} entryLogs={entryLogs} onFaceRegister={(faceData) => handleFaceRegister(currentUser.id, faceData)} />}
            {activeDashboardTab === 'gatescanner' && <HostelGateScanner users={users} hostelLocation={HOSTEL_LOCATION} radius={HOSTEL_LOCATION.radius} onEntryLog={handleEntryLog} existingLogs={entryLogs} />}
          </div>
        )}
{currentUser.role === 'warden' && (
          <div className="space-y-6">
            {/* Entry Logs Tab Navigation */}
            <div className="flex space-x-2 bg-slate-800 p-1 rounded-lg w-fit">
              <button 
                onClick={() => setActiveDashboardTab('dashboard')} 
                className={`px-4 py-2 rounded-md text-sm font-medium capitalize transition-all ${activeDashboardTab === 'dashboard' ? "bg-purple-600 text-white" : "text-slate-400 hover:text-white"}`}
              >
                Dashboard
              </button>
              <button 
                onClick={() => setActiveDashboardTab('entrylogs')} 
                className={`px-4 py-2 rounded-md text-sm font-medium capitalize transition-all ${activeDashboardTab === 'entrylogs' ? "bg-purple-600 text-white" : "text-slate-400 hover:text-white"}`}
              >
                📋 Entry Logs
              </button>
            </div>
            
            {activeDashboardTab === 'dashboard' && <WardenDashboard users={users} rooms={rooms} complaints={complaints} setUsers={setUsers} setRooms={setRooms} setComplaints={setComplaints} notices={notices} setNotices={setNotices} />}
            {activeDashboardTab === 'entrylogs' && <EntryLogs logs={entryLogs} users={users} userRole="warden" />}
          </div>
        )}
{currentUser.role === 'admin' && (
          <div className="space-y-6">
            {/* Entry Logs Tab Navigation */}
            <div className="flex space-x-2 bg-slate-800 p-1 rounded-lg w-fit">
              <button 
                onClick={() => setActiveDashboardTab('dashboard')} 
                className={`px-4 py-2 rounded-md text-sm font-medium capitalize transition-all ${activeDashboardTab === 'dashboard' ? "bg-cyan-600 text-white" : "text-slate-400 hover:text-white"}`}
              >
                Dashboard
              </button>
              <button 
                onClick={() => setActiveDashboardTab('entrylogs')} 
                className={`px-4 py-2 rounded-md text-sm font-medium capitalize transition-all ${activeDashboardTab === 'entrylogs' ? "bg-cyan-600 text-white" : "text-slate-400 hover:text-white"}`}
              >
                📋 Entry Logs
              </button>
            </div>
            
            {activeDashboardTab === 'dashboard' && <AdminDashboard users={users} setUsers={setUsers} rooms={rooms} setRooms={setRooms} payments={payments} setPayments={setPayments} complaints={complaints} />}
            {activeDashboardTab === 'entrylogs' && <EntryLogs logs={entryLogs} users={users} userRole="admin" />}
          </div>
        )}
      </div>
    </div>
  );
}

const root = createRoot(document.getElementById("root")!);
root.render(<App />);