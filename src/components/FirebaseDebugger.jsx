import React, { useState, useEffect } from 'react';
import { auth } from '../firebase';
import { labourServices, attendanceServices, siteServices, convertDocsToArray } from '../services/firebaseServices';

const FirebaseDebugger = () => {
  const [user, setUser] = useState(null);
  const [logs, setLogs] = useState([]);
  const [testResults, setTestResults] = useState({});

  const addLog = (message, type = 'info') => {
    setLogs(prev => [...prev, { time: new Date().toLocaleTimeString(), message, type }]);
  };

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      setUser(user);
      if (user) {
        addLog(`User authenticated: ${user.email}`, 'success');
      } else {
        addLog('No user authenticated', 'error');
      }
    });

    return unsubscribe;
  }, []);

  const testConnection = async () => {
    addLog('Testing Firebase connection...', 'info');
    
    try {
      // Test 1: Check authentication
      if (!auth.currentUser) {
        addLog('❌ No authenticated user', 'error');
        return;
      }
      addLog(`✅ Authenticated as: ${auth.currentUser.email}`, 'success');

      // Test 2: Try to read sites
      try {
        const sitesSnapshot = await siteServices.getAllSites();
        const sites = convertDocsToArray(sitesSnapshot);
        addLog(`✅ Successfully read ${sites.length} sites`, 'success');
        setTestResults(prev => ({ ...prev, sites: sites.length }));
      } catch (error) {
        addLog(`❌ Failed to read sites: ${error.message}`, 'error');
      }

      // Test 3: Try to read labour
      try {
        const labourSnapshot = await labourServices.getAllLabour();
        const labour = convertDocsToArray(labourSnapshot);
        addLog(`✅ Successfully read ${labour.length} labour records`, 'success');
        setTestResults(prev => ({ ...prev, labour: labour.length }));
      } catch (error) {
        addLog(`❌ Failed to read labour: ${error.message}`, 'error');
      }

      // Test 4: Try to read attendance
      try {
        const attendanceSnapshot = await attendanceServices.getAllAttendance();
        const attendance = convertDocsToArray(attendanceSnapshot);
        addLog(`✅ Successfully read ${attendance.length} attendance records`, 'success');
        setTestResults(prev => ({ ...prev, attendance: attendance.length }));
      } catch (error) {
        addLog(`❌ Failed to read attendance: ${error.message}`, 'error');
      }

      // Test 5: Try to write a test record
      try {
        const testSite = {
          name: 'Test Site',
          location: 'Test Location',
          startDate: '2024-01-01',
          endDate: '2024-12-31',
          budget: 100000,
          progress: 50,
          status: 'Active',
          createdAt: new Date().toISOString(),
          testRecord: true
        };
        
        const docRef = await siteServices.addSite(testSite);
        addLog(`✅ Successfully created test site with ID: ${docRef.id}`, 'success');
        
        // Clean up test record
        await siteServices.deleteSite(docRef.id);
        addLog(`✅ Successfully cleaned up test record`, 'success');
        
        setTestResults(prev => ({ ...prev, writeTest: 'PASS' }));
      } catch (error) {
        addLog(`❌ Failed to write test record: ${error.message}`, 'error');
        setTestResults(prev => ({ ...prev, writeTest: 'FAIL' }));
      }

    } catch (error) {
      addLog(`❌ Connection test failed: ${error.message}`, 'error');
    }
  };

  const clearLogs = () => {
    setLogs([]);
    setTestResults({});
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="bg-white rounded-lg shadow-lg p-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">Firebase Debug Console</h1>
        
        <div className="mb-6">
          <div className="flex items-center gap-4 mb-4">
            <button
              onClick={testConnection}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Test Connection
            </button>
            <button
              onClick={clearLogs}
              className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
            >
              Clear Logs
            </button>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            <div className="bg-blue-50 p-3 rounded">
              <div className="text-sm text-blue-600">Sites</div>
              <div className="text-xl font-bold text-blue-900">{testResults.sites || '—'}</div>
            </div>
            <div className="bg-green-50 p-3 rounded">
              <div className="text-sm text-green-600">Labour</div>
              <div className="text-xl font-bold text-green-900">{testResults.labour || '—'}</div>
            </div>
            <div className="bg-yellow-50 p-3 rounded">
              <div className="text-sm text-yellow-600">Attendance</div>
              <div className="text-xl font-bold text-yellow-900">{testResults.attendance || '—'}</div>
            </div>
            <div className="bg-purple-50 p-3 rounded">
              <div className="text-sm text-purple-600">Write Test</div>
              <div className="text-xl font-bold text-purple-900">{testResults.writeTest || '—'}</div>
            </div>
          </div>
        </div>

        <div className="border-t pt-4">
          <h2 className="text-lg font-semibold text-gray-900 mb-3">Authentication Status</h2>
          <div className={`p-3 rounded ${user ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
            {user ? `✅ Logged in as: ${user.email}` : '❌ Not authenticated'}
          </div>
        </div>

        <div className="border-t pt-4 mt-4">
          <h2 className="text-lg font-semibold text-gray-900 mb-3">Debug Logs</h2>
          <div className="bg-gray-50 rounded p-3 h-64 overflow-y-auto font-mono text-sm">
            {logs.length === 0 ? (
              <div className="text-gray-500">No logs yet. Click "Test Connection" to start debugging.</div>
            ) : (
              logs.map((log, index) => (
                <div key={index} className={`mb-1 ${log.type === 'error' ? 'text-red-600' : log.type === 'success' ? 'text-green-600' : 'text-gray-700'}`}>
                  <span className="text-gray-500">[{log.time}]</span> {log.message}
                </div>
              ))
            )}
          </div>
        </div>

        <div className="border-t pt-4 mt-4">
          <h2 className="text-lg font-semibold text-gray-900 mb-3">Troubleshooting Steps</h2>
          <ol className="list-decimal list-inside text-sm text-gray-700 space-y-1">
            <li>Make sure you're logged in with the correct email: odedraarjun0007@gmail.com</li>
            <li>Check that Firestore rules are deployed correctly</li>
            <li>Verify Firebase project configuration is correct</li>
            <li>Check browser console for additional error messages</li>
            <li>Ensure your network connection is stable</li>
          </ol>
        </div>
      </div>
    </div>
  );
};

export default FirebaseDebugger;
