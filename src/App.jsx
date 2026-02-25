import React, { useState, useEffect } from 'react'
import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Menu, X } from 'lucide-react'
import Dashboard from './pages/Dashboard'
import SiteManagement from './pages/SiteManagement'
import AttendanceSimple from './pages/AttendanceSimple'
import MaterialManagement from './pages/MaterialManagement'
import ProcessManagement from './pages/ProcessManagement'
import Reports from './pages/Reports'
import PORequests from './pages/PORequests'
import StorageMonitor from './pages/StorageMonitor'
import FirebaseDebugger from './components/FirebaseDebugger'
import Sidebar from './components/Sidebar'
import PWAInstallPrompt from './components/PWAInstallPrompt'
import { AuthProvider, useAuth, LoginForm, UserMenu } from './components/Auth'

const AppContent = () => {
  const { user, userRole, login, logout, loading } = useAuth()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const location = useLocation()

  // Close sidebar on route change on mobile
  useEffect(() => {
    if (window.innerWidth < 1024) {
      setSidebarOpen(false)
    }
  }, [location.pathname])

  // Handle sidebar state based on screen size
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 1024) {
        setSidebarOpen(true)
      } else {
        setSidebarOpen(false)
      }
    }

    handleResize()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (!user) {
    return <LoginForm onLogin={login} />
  }

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      {/* Mobile Menu Button */}
      <motion.button
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        onClick={() => setSidebarOpen(!sidebarOpen)}
        className="lg:hidden fixed top-4 left-4 z-50 p-3 bg-primary text-white rounded-lg shadow-lg"
      >
        {sidebarOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
      </motion.button>

      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => setSidebarOpen(false)}
          className="lg:hidden fixed inset-0 bg-black bg-opacity-50 z-40"
        />
      )}

      {/* Sidebar - Mobile Hidden, Desktop Visible */}
      <Sidebar 
        isOpen={sidebarOpen} 
        onToggle={() => setSidebarOpen(!sidebarOpen)}
        onLogout={logout}
        userRole={userRole}
      />
      
      {/* Main Content Area */}
      <div className="flex-1 overflow-auto">
        <AnimatePresence mode="wait">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
            className="h-full"
          >
            <Routes location={location}>
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route path="/dashboard" element={<Dashboard userRole={userRole} />} />
              <Route path="/sites" element={<SiteManagement userRole={userRole} />} />
              <Route path="/attendance" element={<AttendanceSimple userRole={userRole} />} />
              <Route path="/materials" element={<MaterialManagement userRole={userRole} />} />
              <Route path="/po-requests" element={<PORequests userRole={userRole} />} />
              <Route path="/processes" element={<ProcessManagement userRole={userRole} />} />
              <Route path="/reports" element={<Reports userRole={userRole} />} />
              <Route path="/storage-monitor" element={<StorageMonitor />} />
              <Route path="/debug" element={<FirebaseDebugger />} />
              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Routes>
          </motion.div>
        </AnimatePresence>
      </div>
      
      <PWAInstallPrompt />
    </div>
  )
}

const App = () => {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  )
}

export default App