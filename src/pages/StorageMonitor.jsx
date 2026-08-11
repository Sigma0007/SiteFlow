import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Database, HardDrive, Upload, Download, AlertTriangle, TrendingUp, TrendingDown, FileText, Image } from 'lucide-react'
import Footer from '../components/Footer'

const StorageMonitor = () => {
  const [storageStats, setStorageStats] = useState({
    firestore: {
      used: 0,
      limit: 1024, // 1 GB in MB
      documents: 0,
      reads: 0,
      writes: 0,
      deletes: 0
    },
    storage: {
      used: 0,
      limit: 5120, // 5 GB in MB
      files: 0,
      downloads: 0
    },
    collections: {
      sites: 0,
      labour: 0,
      attendance: 0,
      buildings: 0,
      materials: 0,
      purchaseOrders: 0,
      processes: 0
    }
  })
  const [loading, setLoading] = useState(true)
  const [timeRange, setTimeRange] = useState('month') // 'day', 'week', 'month', 'year'

  // Simulate fetching storage statistics
  useEffect(() => {
    const fetchStorageStats = async () => {
      try {
        setLoading(true)
        
        // In a real implementation, you would fetch these from:
        // 1. Firebase Usage APIs
        // 2. Cloud Monitoring APIs  
        // 3. Your own analytics collection
        
        // For now, simulate realistic data based on your app usage
        const mockStats = {
          firestore: {
            used: Math.floor(Math.random() * 500) + 100, // 100-600 MB used
            limit: 1024, // 1 GB free tier
            documents: Math.floor(Math.random() * 50000) + 10000,
            reads: Math.floor(Math.random() * 30000) + 5000,
            writes: Math.floor(Math.random() * 15000) + 2000,
            deletes: Math.floor(Math.random() * 10000) + 1000
          },
          storage: {
            used: Math.floor(Math.random() * 2000) + 500, // 500-2500 MB used
            limit: 5120, // 5 GB free tier
            files: Math.floor(Math.random() * 1000) + 200,
            downloads: Math.floor(Math.random() * 5000) + 1000
          },
          collections: {
            sites: Math.floor(Math.random() * 50) + 10,
            labour: Math.floor(Math.random() * 500) + 100,
            attendance: Math.floor(Math.random() * 10000) + 5000,
            buildings: Math.floor(Math.random() * 200) + 50,
            materials: Math.floor(Math.random() * 1000) + 200,
            purchaseOrders: Math.floor(Math.random() * 500) + 100,
            processes: Math.floor(Math.random() * 2000) + 500
          }
        }
        
        setStorageStats(mockStats)
      } catch (error) {
        console.error('Error fetching storage stats:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchStorageStats()
    
    // Set up real-time updates every 30 seconds
    const interval = setInterval(fetchStorageStats, 30000)
    return () => clearInterval(interval)
  }, [timeRange])

  const calculatePercentage = (used, limit) => {
    return Math.round((used / limit) * 100)
  }

  const getUsageColor = (percentage) => {
    if (percentage < 50) return 'text-green-600 bg-green-100'
    if (percentage < 80) return 'text-yellow-600 bg-yellow-100'
    return 'text-red-600 bg-red-100'
  }

  const formatBytes = (bytes) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const formatNumber = (num) => {
    return new Intl.NumberFormat().format(num)
  }

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-3 text-gray-600">Loading storage statistics...</span>
      </div>
    )
  }

  const firestorePercentage = calculatePercentage(storageStats.firestore.used, storageStats.firestore.limit)
  const storagePercentage = calculatePercentage(storageStats.storage.used, storageStats.storage.limit)

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Storage Monitor</h1>
          <p className="text-gray-600 mt-1">Track your Firebase usage and storage limits</p>
        </div>
        <select
          value={timeRange}
          onChange={(e) => setTimeRange(e.target.value)}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-primary"
        >
          <option value="day">Last 24 Hours</option>
          <option value="week">Last Week</option>
          <option value="month">Last Month</option>
          <option value="year">Last Year</option>
        </select>
      </div>

      {/* Storage Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Firestore Storage */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-xl shadow-sm border border-gray-200 p-6"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-blue-100 rounded-lg">
                <Database className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Firestore Database</h3>
                <p className="text-sm text-gray-600">Document storage & operations</p>
              </div>
            </div>
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${getUsageColor(firestorePercentage)}`}>
              {firestorePercentage}%
            </span>
          </div>

          <div className="space-y-3">
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-gray-600">Storage Used</span>
                <span className="font-medium">{formatBytes(storageStats.firestore.used * 1024 * 1024)} / {formatBytes(storageStats.firestore.limit * 1024 * 1024)}</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className={`h-2 rounded-full transition-all duration-500 ${
                    firestorePercentage < 50 ? 'bg-green-500' : 
                    firestorePercentage < 80 ? 'bg-yellow-500' : 'bg-red-500'
                  }`}
                  style={{ width: `${Math.min(firestorePercentage, 100)}%` }}
                ></div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 pt-2">
              <div className="text-center p-3 bg-gray-50 rounded-lg">
                <p className="text-2xl font-bold text-gray-900">{formatNumber(storageStats.firestore.documents)}</p>
                <p className="text-xs text-gray-600">Documents</p>
              </div>
              <div className="text-center p-3 bg-gray-50 rounded-lg">
                <p className="text-2xl font-bold text-gray-900">{formatNumber(storageStats.firestore.reads)}</p>
                <p className="text-xs text-gray-600">Reads Today</p>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Firebase Storage */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white rounded-xl shadow-sm border border-gray-200 p-6"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-green-100 rounded-lg">
                <HardDrive className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Firebase Storage</h3>
                <p className="text-sm text-gray-600">Files & images</p>
              </div>
            </div>
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${getUsageColor(storagePercentage)}`}>
              {storagePercentage}%
            </span>
          </div>

          <div className="space-y-3">
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-gray-600">Storage Used</span>
                <span className="font-medium">{formatBytes(storageStats.storage.used * 1024 * 1024)} / {formatBytes(storageStats.storage.limit * 1024 * 1024)}</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className={`h-2 rounded-full transition-all duration-500 ${
                    storagePercentage < 50 ? 'bg-green-500' : 
                    storagePercentage < 80 ? 'bg-yellow-500' : 'bg-red-500'
                  }`}
                  style={{ width: `${Math.min(storagePercentage, 100)}%` }}
                ></div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 pt-2">
              <div className="text-center p-3 bg-gray-50 rounded-lg">
                <p className="text-2xl font-bold text-gray-900">{formatNumber(storageStats.storage.files)}</p>
                <p className="text-xs text-gray-600">Files</p>
              </div>
              <div className="text-center p-3 bg-gray-50 rounded-lg">
                <p className="text-2xl font-bold text-gray-900">{formatNumber(storageStats.storage.downloads)}</p>
                <p className="text-xs text-gray-600">Downloads</p>
              </div>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Collection Breakdown */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="bg-white rounded-xl shadow-sm border border-gray-200 p-6"
      >
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Collection Breakdown</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
          {Object.entries(storageStats.collections).map(([collection, count]) => (
            <div key={collection} className="text-center p-4 bg-gray-50 rounded-lg">
              <FileText className="w-8 h-8 text-gray-400 mx-auto mb-2" />
              <p className="text-xl font-bold text-gray-900">{formatNumber(count)}</p>
              <p className="text-xs text-gray-600 capitalize">{collection}</p>
            </div>
          ))}
        </div>
      </motion.div>

      {/* Recommendations */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="bg-white rounded-xl shadow-sm border border-gray-200 p-6"
      >
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Storage Recommendations</h3>
        <div className="space-y-3">
          {firestorePercentage > 80 && (
            <div className="flex items-start gap-3 p-3 bg-red-50 border border-red-200 rounded-lg">
              <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-red-900">Firestore Storage Critical</p>
                <p className="text-xs text-red-700">Consider archiving old attendance records or upgrading to Blaze plan.</p>
              </div>
            </div>
          )}
          {storagePercentage > 80 && (
            <div className="flex items-start gap-3 p-3 bg-red-50 border border-red-200 rounded-lg">
              <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-red-900">Storage Space Critical</p>
                <p className="text-xs text-red-700">Clean up unused images or optimize file sizes.</p>
              </div>
            </div>
          )}
          {firestorePercentage < 50 && storagePercentage < 50 && (
            <div className="flex items-start gap-3 p-3 bg-green-50 border border-green-200 rounded-lg">
              <TrendingDown className="w-5 h-5 text-green-600 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-green-900">Healthy Usage</p>
                <p className="text-xs text-green-700">Your storage usage is well within limits.</p>
              </div>
            </div>
          )}
          <div className="flex items-start gap-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <TrendingUp className="w-5 h-5 text-blue-600 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-blue-900">Optimization Tip</p>
              <p className="text-xs text-blue-700">Use Firebase Storage for images instead of base64 encoding to save 33% space.</p>
            </div>
          </div>
        </div>
      </motion.div>

      <Footer />
    </div>
  )
}

export default StorageMonitor
