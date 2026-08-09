import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Database, Trash2, Download, AlertCircle } from 'lucide-react';
import { initializeFirestoreData, clearFirestoreData } from '../utils/firestoreSetup';

const DataInitializer = () => {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState(''); // 'success' or 'error'

  const showMessage = (text, type) => {
    setMessage(text);
    setMessageType(type);
    setTimeout(() => {
      setMessage('');
      setMessageType('');
    }, 5000);
  };

  const handleInitializeData = async () => {
    if (!window.confirm('This will add sample sites, labour, and attendance data to your Firestore database. Continue?')) {
      return;
    }

    setLoading(true);
    try {
      const success = await initializeFirestoreData();
      if (success) {
        showMessage('Sample data successfully added to Firestore!', 'success');
      } else {
        showMessage('Failed to initialize data. Check console for errors.', 'error');
      }
    } catch (error) {
      showMessage('Error: ' + error.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleClearData = async () => {
    if (!window.confirm('⚠️ WARNING: This will delete ALL data from your Firestore database (sites, labour, attendance). This action cannot be undone. Continue?')) {
      return;
    }

    setLoading(true);
    try {
      const success = await clearFirestoreData();
      if (success) {
        showMessage('All data cleared from Firestore!', 'success');
      } else {
        showMessage('Failed to clear data. Check console for errors.', 'error');
      }
    } catch (error) {
      showMessage('Error: ' + error.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-2xl"
      >
        <div className="text-center mb-8">
          <div className="mx-auto w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center mb-4">
            <Database className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Firestore Data Manager</h1>
          <p className="text-gray-600 mt-2">Initialize or clear your Site Manager database</p>
        </div>

        {message && (
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className={`mb-6 p-4 rounded-lg border ${
              messageType === 'success' 
                ? 'bg-green-50 border-green-200 text-green-700' 
                : 'bg-red-50 border-red-200 text-red-700'
            }`}
          >
            <div className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5" />
              {message}
            </div>
          </motion.div>
        )}

        <div className="space-y-6">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="font-semibold text-blue-900 mb-2">Sample Data Includes:</h3>
            <ul className="text-sm text-blue-700 space-y-1">
              <li>• 3 Construction Sites (Downtown Complex, Highland Tower, Riverside Plaza)</li>
              <li>• 6 Staff Members with different roles</li>
              <li>• Today's Attendance Records for all staff</li>
              <li>• Real-time data synchronization</li>
            </ul>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleInitializeData}
              disabled={loading}
              className="flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Download className="w-5 h-5" />
              {loading ? 'Processing...' : 'Initialize Sample Data'}
            </motion.button>

            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleClearData}
              disabled={loading}
              className="flex items-center justify-center gap-2 px-6 py-3 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Trash2 className="w-5 h-5" />
              {loading ? 'Processing...' : 'Clear All Data'}
            </motion.button>
          </div>
        </div>

        <div className="mt-8 p-4 bg-gray-50 rounded-lg">
          <h3 className="font-semibold text-gray-900 mb-2">Instructions:</h3>
          <ol className="text-sm text-gray-700 space-y-1 list-decimal list-inside">
            <li>Click "Initialize Sample Data" to populate your database</li>
            <li>Once data is added, go to your main application</li>
            <li>Use "Clear All Data" only if you want to reset everything</li>
            <li>Your live app will update automatically with the data</li>
          </ol>
        </div>

        <div className="mt-6 text-center">
          <a 
            href="https://siteflow-c93e8.web.app" 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-blue-600 hover:text-blue-700 font-medium text-sm"
          >
            → Go to Live Application
          </a>
        </div>
      </motion.div>
    </div>
  );
};

export default DataInitializer;
