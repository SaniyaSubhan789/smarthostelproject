import React, { useState } from 'react';

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

interface EntryLogsProps {
  logs: EntryLogData[];
  users: any[];
  userRole: 'warden' | 'admin';
}

const EntryLogs: React.FC<EntryLogsProps> = ({ logs, users, userRole }) => {
  const [filterStatus, setFilterStatus] = useState<'all' | 'IN' | 'OUT'>('all');
  const [filterDate, setFilterDate] = useState<string>('');
  const [searchStudent, setSearchStudent] = useState('');
  const [selectedLog, setSelectedLog] = useState<EntryLogData | null>(null);

  // Filter logs
  const filteredLogs = logs.filter(log => {
    const matchesStatus = filterStatus === 'all' || log.status === filterStatus;
    const matchesDate = !filterDate || log.date === filterDate;
    const matchesSearch = !searchStudent || 
      log.studentName.toLowerCase().includes(searchStudent.toLowerCase()) ||
      log.studentId.toLowerCase().includes(searchStudent.toLowerCase());
    return matchesStatus && matchesDate && matchesSearch;
  }).sort((a, b) => new Date(b.entryTime).getTime() - new Date(a.entryTime).getTime());

  // Get today's stats
  const today = new Date().toISOString().split('T')[0];
  const todayLogs = logs.filter(log => log.date === today);
  const todayEntries = todayLogs.filter(log => log.status === 'IN').length;
  const todayExits = todayLogs.filter(log => log.status === 'OUT').length;

  // Get unique dates from logs
  const uniqueDates = [...new Set(logs.map(log => log.date))].sort().reverse();

  return (
    <div className="space-y-6">
      {/* Header Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-indigo-600/20 border border-indigo-500/30 p-4 rounded-xl">
          <div className="text-2xl font-bold text-indigo-400">{todayEntries}</div>
          <div className="text-slate-400 text-sm">Today's Entries</div>
        </div>
        <div className="bg-purple-600/20 border border-purple-500/30 p-4 rounded-xl">
          <div className="text-2xl font-bold text-purple-400">{todayExits}</div>
          <div className="text-slate-400 text-sm">Today's Exits</div>
        </div>
        <div className="bg-slate-700/50 border border-slate-600 p-4 rounded-xl">
          <div className="text-2xl font-bold text-white">{logs.length}</div>
          <div className="text-slate-400 text-sm">Total Records</div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4">
        <div className="flex-1 min-w-[200px]">
          <input
            type="text"
            placeholder="Search by student name..."
            value={searchStudent}
            onChange={(e) => setSearchStudent(e.target.value)}
            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white text-sm focus:border-indigo-500 outline-none"
          />
        </div>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value as any)}
          className="bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white text-sm focus:border-indigo-500 outline-none"
        >
          <option value="all">All Status</option>
          <option value="IN">Entry (IN)</option>
          <option value="OUT">Exit (OUT)</option>
        </select>
        <select
          value={filterDate}
          onChange={(e) => setFilterDate(e.target.value)}
          className="bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white text-sm focus:border-indigo-500 outline-none"
        >
          <option value="">All Dates</option>
          {uniqueDates.map(date => (
            <option key={date} value={date}>{date}</option>
          ))}
        </select>
      </div>

      {/* Logs Table */}
      <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
        {filteredLogs.length === 0 ? (
          <div className="p-8 text-center text-slate-500">
            <div className="text-4xl mb-2">📋</div>
            <p>No entry logs found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-slate-900/50 text-slate-400 text-xs uppercase">
                <tr>
                  <th className="px-4 py-3">Student</th>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Entry Time</th>
                  <th className="px-4 py-3">Exit Time</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Location</th>
                  <th className="px-4 py-3">Verification</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700">
                {filteredLogs.map((log) => (
                  <tr 
                    key={log.id} 
                    className="hover:bg-slate-700/30 cursor-pointer"
                    onClick={() => setSelectedLog(log)}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                          log.success 
                            ? 'bg-indigo-500/20 text-indigo-400' 
                            : 'bg-red-500/20 text-red-400'
                        }`}>
                          {log.studentName.charAt(0)}
                        </div>
                        <div>
                          <div className="text-white font-medium">{log.studentName}</div>
                          <div className="text-slate-500 text-xs">{log.studentId}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-300 text-sm">{log.date}</td>
                    <td className="px-4 py-3 text-slate-300 text-sm">
                      {log.entryTime ? new Date(log.entryTime).toLocaleTimeString() : '-'}
                    </td>
                    <td className="px-4 py-3 text-slate-300 text-sm">
                      {log.exitTime ? new Date(log.exitTime).toLocaleTimeString() : '-'}
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
                      <div className="text-slate-400 text-xs">
                        {log.latitude.toFixed(4)}, {log.longitude.toFixed(4)}
                      </div>
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

      {/* Log Detail Modal */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-slate-900 w-full max-w-md rounded-2xl border border-slate-800 shadow-2xl p-6">
            <div className="flex justify-between items-start mb-6">
              <h3 className="text-xl font-bold text-white">Entry Log Details</h3>
              <button 
                onClick={() => setSelectedLog(null)}
                className="text-slate-500 hover:text-white"
              >
                ✕
              </button>
            </div>
            
            <div className="space-y-4">
              <div className="flex items-center gap-4 pb-4 border-b border-slate-700">
                <div className={`w-12 h-12 rounded-full flex items-center justify-center text-xl font-bold ${
                  selectedLog.success 
                    ? 'bg-indigo-500/20 text-indigo-400' 
                    : 'bg-red-500/20 text-red-400'
                }`}>
                  {selectedLog.studentName.charAt(0)}
                </div>
                <div>
                  <div className="text-white font-bold">{selectedLog.studentName}</div>
                  <div className="text-slate-400 text-sm">{selectedLog.studentId}</div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-slate-500 text-xs mb-1">Date</div>
                  <div className="text-white">{selectedLog.date}</div>
                </div>
                <div>
                  <div className="text-slate-500 text-xs mb-1">Status</div>
                  <span className={`text-[10px] uppercase font-bold px-2 py-1 rounded ${
                    selectedLog.status === 'IN' 
                      ? 'bg-green-500/20 text-green-400' 
                      : 'bg-orange-500/20 text-orange-400'
                  }`}>
                    {selectedLog.status}
                  </span>
                </div>
                <div>
                  <div className="text-slate-500 text-xs mb-1">Entry Time</div>
                  <div className="text-white">
                    {selectedLog.entryTime ? new Date(selectedLog.entryTime).toLocaleTimeString() : '-'}
                  </div>
                </div>
                <div>
                  <div className="text-slate-500 text-xs mb-1">Exit Time</div>
                  <div className="text-white">
                    {selectedLog.exitTime ? new Date(selectedLog.exitTime).toLocaleTimeString() : '-'}
                  </div>
                </div>
              </div>

              <div>
                <div className="text-slate-500 text-xs mb-1">GPS Coordinates</div>
                <div className="text-slate-300 text-sm font-mono">
                  {selectedLog.latitude.toFixed(6)}, {selectedLog.longitude.toFixed(6)}
                </div>
              </div>

              <div>
                <div className="text-slate-500 text-xs mb-1">Verification Method</div>
                <div className="text-slate-300 text-sm">{selectedLog.verificationMethod}</div>
              </div>

              {selectedLog.errorMessage && (
                <div className="bg-red-500/10 border border-red-500/30 p-3 rounded-lg">
                  <div className="text-red-400 text-xs font-medium">Error</div>
                  <div className="text-red-300 text-sm">{selectedLog.errorMessage}</div>
                </div>
              )}

              <div className={`p-3 rounded-lg ${
                selectedLog.success 
                  ? 'bg-green-500/10 border border-green-500/30' 
                  : 'bg-red-500/10 border border-red-500/30'
              }`}>
                <div className={`font-medium ${
                  selectedLog.success ? 'text-green-400' : 'text-red-400'
                }`}>
                  {selectedLog.success ? '✓ Verification Successful' : '✕ Verification Failed'}
                </div>
              </div>
            </div>

            <button 
              onClick={() => setSelectedLog(null)}
              className="mt-6 w-full bg-slate-700 hover:bg-slate-600 text-white py-2 rounded-lg"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default EntryLogs;

