import React, { useState, useEffect } from 'react'
import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import Dashboard from './pages/Dashboard'
import SiteManagement from './pages/SiteManagement'
import AttendanceModule from './pages/AttendanceModule'
import MaterialManagement from './pages/MaterialManagement'
import ProcessManagement from './pages/ProcessManagement'
import Reports from './pages/Reports'
import FirebaseDebugger from './components/FirebaseDebugger'
import Sidebar from './components/Sidebar'
import { AuthProvider, useAuth, LoginForm, UserMenu } from './components/Auth'

const AppContent = () => {
  const { user, login, logout, loading } = useAuth()
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const location = useLocation()

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
    <div className="flex h-screen bg-gray-50">
      <Sidebar 
        isOpen={sidebarOpen} 
        onToggle={() => setSidebarOpen(!sidebarOpen)}
        onLogout={logout}
        userRole="admin"
      />
      
      <div className={`flex-1 overflow-auto transition-all duration-300 ${sidebarOpen ? 'ml-64' : 'ml-0'}`}>
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
              <Route path="/dashboard" element={<Dashboard userRole="admin" />} />
              <Route path="/sites" element={<SiteManagement userRole="admin" />} />
              <Route path="/attendance" element={<AttendanceModule userRole="admin" />} />
              <Route path="/materials" element={<MaterialManagement userRole="admin" />} />
              <Route path="/processes" element={<ProcessManagement userRole="admin" />} />
              <Route path="/reports" element={<Reports userRole="admin" />} />
              <Route path="/debug" element={<FirebaseDebugger />} />
              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Routes>
          </motion.div>
        </AnimatePresence>
      </div>
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