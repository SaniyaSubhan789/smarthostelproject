import React, { useState } from 'react';
import FaceRegistration from './FaceRegistration';
import { EntryLogData } from './EntryLogs';

interface SmartEntryProps {
  user: any;
  entryLogs: EntryLogData[];
  onFaceRegister: (faceData: string) => void;
}

const SmartEntry: React.FC<SmartEntryProps> = ({ user, entryLogs, onFaceRegister }) => {
  const [activeTab, setActiveTab] = useState<'register' | 'history'>('register');

  // Get user's entry logs
  const userLogs = entryLogs
    .filter(log => log.studentId === user.id)
    .sort((a, b) => new Date(b.entryTime).getTime() - new Date(a.entryTime).getTime());

  // Get last entry
  const lastEntry = userLogs[0];

  // Get today's entries
  const today = new Date().toISOString().split('T')[0];
  const todayEntries = userLogs.filter(log => log.date === today);

  return (
    <div className="space-y-6">
      {/* Header Card */}
      <div className="bg-gradient-to-r from-indigo-600 to-purple-600 p-6 rounded-xl text-white">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center text-3xl">
            🚪
          </div>
          <div>
            <h2 className="text-xl font-bold">Smart Entry System</h2>
            <p className="text-indigo-200 text-sm">
              Face Recognition + GPS Location Verification
            </p>
          </div>
        </div>
        
        {/* Status Indicators */}
        <div className="grid grid-cols-3 gap-4 mt-6">
          <div className="bg-white/10 rounded-lg p-3 text-center">
            <div className={`text-2xl font-bold ${user.faceData ? 'text-green-400' : 'text-red-400'}`}>
              {user.faceData ? '✓' : '✕'}
            </div>
            <div className="text-xs text-indigo-200">Face Registered</div>
          </div>
          <div className="bg-white/10 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-white">{todayEntries.length}</div>
            <div className="text-xs text-indigo-200">Today's Entries</div>
          </div>
          <div className="bg-white/10 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-white">{userLogs.length}</div>
            <div className="text-xs text-indigo-200">Total Entries</div>
          </div>
        </div>
      </div>

      {/* Last Entry Info */}
      {lastEntry && (
        <div className="bg-slate-800 p-4 rounded-xl border border-slate-700">
          <div className="text-slate-400 text-xs font-bold uppercase mb-2">Last Entry</div>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-white font-medium">
                {lastEntry.status === 'IN' ? 'Entered' : 'Exited'} at {new Date(lastEntry.entryTime).toLocaleTimeString()}
              </div>
              <div className="text-slate-500 text-sm">{lastEntry.date}</div>
            </div>
            <span className={`text-[10px] uppercase font-bold px-3 py-1 rounded ${
              lastEntry.status === 'IN' 
                ? 'bg-green-500/20 text-green-400' 
                : 'bg-orange-500/20 text-orange-400'
            }`}>
              {lastEntry.status}
            </span>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex space-x-2 bg-slate-800 p-1 rounded-lg w-fit">
        <button 
          onClick={() => setActiveTab('register')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
            activeTab === 'register' 
              ? 'bg-indigo-600 text-white' 
              : 'text-slate-400 hover:text-white'
          }`}
        >
          📷 Face Registration
        </button>
        <button 
          onClick={() => setActiveTab('history')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
            activeTab === 'history' 
              ? 'bg-indigo-600 text-white' 
              : 'text-slate-400 hover:text-white'
          }`}
        >
          📋 Entry History
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === 'register' && (
        <div className="bg-slate-800 p-6 rounded-xl border border-slate-700">
          <h3 className="text-white font-bold mb-4">Register Your Face</h3>
          
          {!user.faceData ? (
            <>
              <div className="bg-blue-500/10 border border-blue-500/30 p-4 rounded-lg mb-4">
                <p className="text-blue-400 text-sm">
                  ℹ️ Register your face to use the Smart Entry System at the hostel gate.
                </p>
              </div>
          <FaceRegistration 
                userId={user.id}
                onRegister={(faceData) => onFaceRegister(faceData)}
                existingFaceData={user.faceData}
              />
            </>
          ) : (
            <FaceRegistration 
              userId={user.id}
              onRegister={(faceData) => onFaceRegister(faceData)}
              existingFaceData={user.faceData}
            />
          )}
        </div>
      )}

      {activeTab === 'history' && (
        <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
          {userLogs.length === 0 ? (
            <div className="p-8 text-center text-slate-500">
              <div className="text-4xl mb-2">📋</div>
              <p>No entry history yet</p>
              <p className="text-sm mt-1">Your entry logs will appear here after using Smart Entry</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-slate-900/50 text-slate-400 text-xs uppercase">
                  <tr>
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Time</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Verification</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700">
                  {userLogs.slice(0, 20).map((log) => (
                    <tr key={log.id} className="hover:bg-slate-700/30">
                      <td className="px-4 py-3 text-slate-300 text-sm">{log.date}</td>
                      <td className="px-4 py-3 text-slate-300 text-sm">
                        {new Date(log.entryTime).toLocaleTimeString()}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-[10px] uppercase font-bold px-2 py-1 rounded ${
                          log.status === 'IN' 
                            ? 'bg-green-500/20 text-green-400' 
                            : 'bg-orange-500/20 text-orange-400'
                        }`}>
                          {log.status}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-[10px] px-2 py-1 rounded ${
                          log.success 
                            ? 'bg-green-500/20 text-green-400' 
                            : 'bg-red-500/20 text-red-400'
                        }`}>
                          {log.success ? '✓ Verified' : '✕ Failed'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default SmartEntry;

