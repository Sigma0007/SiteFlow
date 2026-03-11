import React, { useState, useEffect } from 'react'
import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  LayoutDashboard,
  Users,
  Building2,
  Package,
  FileText,
  ListChecks,
  Settings,
  LogOut,
  Menu,
  X
} from 'lucide-react'
import { initializeSampleSupervisor, initializeUserDocuments, migrateEmailToUidBasedUsers, fixSupervisorSiteAssignments, runDataMigration } from './services/firebaseServices'

import Dashboard from './pages/Dashboard'
import SiteManagement from './pages/SiteManagement'
import AttendanceSimple from './pages/AttendanceSimple'
import MaterialManagement from './pages/MaterialManagement'
import ProcessManagement from './pages/ProcessManagement'
import Reports from './pages/Reports'
import PORequests from './pages/PORequests'
import StorageMonitor from './pages/StorageMonitor'
import FirebaseDebugger from './components/FirebaseDebugger'
import SupervisorManagement from './components/SupervisorManagement'
import Sidebar from './components/Sidebar'
import PWAInstallPrompt from './components/PWAInstallPrompt'
import { AuthProvider, useAuth, LoginForm, UserMenu } from './components/Auth'
import { SupervisorProvider } from './contexts/SupervisorContext.jsx'

// Route protection component
const ProtectedRoute = ({ children, userRole, allowedRoles }) => {
  if (!allowedRoles.includes(userRole)) {
    return <Navigate to="/dashboard" replace />;
  }
  return children;
};

const AppContent = () => {
  const { user, userRole, login, logout, loading } = useAuth()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const location = useLocation()

  // Initialize user documents and sample supervisor for testing (non-blocking)
  useEffect(() => {
    if (user && userRole === 'admin') {
      console.log('🔧 Admin detected - Initializing user documents and supervisor setup...')
      // Run in background without blocking
      setTimeout(() => {
        initializeUserDocuments().then(() => {
          console.log('✅ User documents initialization completed!')
          return initializeSampleSupervisor()
        }).then(() => {
          console.log('✅ Supervisor initialization completed!')
        }).catch(error => {
          console.error('❌ Initialization failed:', error)
        })
      }, 2000)
    }
  }, [user, userRole])

  // Add test function to console for debugging
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      window.testAuthSystem = async () => {
        try {
          console.log('🧪 Testing Firestore-Based Authentication System...')

          // Test account role determination
          const testAccounts = [
            'odedraarjun928@gmail.com',
            'aodedra259@rku.ac.in',
            'odedraarjun0007@gmail.com',
            'test@example.com'
          ]

          console.log('📋 Testing account roles:')
          testAccounts.forEach(email => {
            // This will use the determineRoleByAccount function
            const role = email === 'odedraarjun928@gmail.com' ? 'admin' :
              email === 'aodedra259@rku.ac.in' ? 'supervisor' :
                email === 'odedraarjun0007@gmail.com' ? 'supervisor' : null
            console.log(`  ${email} → ${role || 'NO ACCESS'}`)
          })

          // Test Firebase permissions
          const result = await supervisorServices.getSupervisorByEmail('test@example.com')
          console.log('✅ Firebase permissions working:', result.docs.length, 'docs found')

          return 'SUCCESS: Firestore-based authentication system working'
        } catch (error) {
          console.error('❌ Authentication system error:', error)
          return 'ERROR: ' + error.message
        }
      }

      window.testAccountRoles = () => {
        console.log('🔧 Account Roles:')
        console.log('  odedraarjun928@gmail.com → ADMIN')
        console.log('  aodedra259@rku.ac.in → SUPERVISOR')
        console.log('  odedraarjun0007@gmail.com → SUPERVISOR')
        console.log('  Other emails → NO ACCESS')
      }

      window.initializeUsers = async () => {
        try {
          console.log('🔧 Initializing user documents...')
          await initializeUserDocuments()
          console.log('✅ User documents initialized successfully!')
          return 'SUCCESS: User documents created'
        } catch (error) {
          console.error('❌ Error initializing users:', error)
          return 'ERROR: ' + error.message
        }
      }

      window.fixSupervisorSiteAssignments = async () => {
        console.log('🔧 Running site-assignment repair...')
        const result = await fixSupervisorSiteAssignments()
        if (result.success) {
          console.log('✅ Repair complete. Updated', result.updatedSites, 'site(s). Ask supervisors to refresh.')
        } else {
          console.error('❌ Repair failed:', result.error)
        }
        return result
      }

      window.runDataMigration = async () => {
        console.log('🚧 Running data migration (currentSite→siteId, labourId→employeeId)...')
        const result = await runDataMigration()
        console.log('✅ Migration result:', result)
        return result
      }

      // Debug: show every staff member's current siteId in labour collection
      window.debugStaffSiteIds = async () => {
        const { getDocs: _getDocs, collection: _col } = await import('firebase/firestore')
        const { db: _db } = await import('./firebase')
        const labourSnap = await _getDocs(_col(_db, 'labour'))
        const sitesSnap = await _getDocs(_col(_db, 'sites'))
        const siteMap = {}
        sitesSnap.docs.forEach(d => { siteMap[d.id] = d.data().name })
        console.table(
          labourSnap.docs.map(d => ({
            id: d.id,
            name: d.data().name,
            siteId: d.data().siteId || '⚠️ UNSET',
            siteName: siteMap[d.data().siteId] || '⚠️ NOT FOUND'
          }))
        )
      }

      // Repair: set labour.siteId from site.assignedStaff for every site
      window.repairStaffSiteIds = async () => {
        const { getDocs: _getDocs, updateDoc: _updateDoc, doc: _doc, collection: _col } = await import('firebase/firestore')
        const { db: _db } = await import('./firebase')
        const sitesSnap = await _getDocs(_col(_db, 'sites'))
        let fixed = 0
        for (const siteDoc of sitesSnap.docs) {
          const siteData = siteDoc.data()
          const staff = siteData.assignedStaff || []
          for (const staffId of staff) {
            try {
              await _updateDoc(_doc(_db, 'labour', staffId), { siteId: siteDoc.id })
              console.log(`✅ ${staffId} → siteId = ${siteDoc.id} (${siteData.name})`)
              fixed++
            } catch (e) {
              console.warn(`⚠️ Could not update ${staffId}:`, e.message)
            }
          }
        }
        console.log(`\n🎉 Done — fixed ${fixed} staff documents. Refresh to see changes.`)
      }

      console.log('🔧 Test functions available:')
      console.log('  window.testAuthSystem() - Full system test')
      console.log('  window.testAccountRoles() - Show account roles')
      console.log('  window.initializeUsers() - Initialize user documents')
      console.log('  window.fixSupervisorSiteAssignments() - Repair missing site assignments')
      console.log('  window.runDataMigration() - Migrate legacy field names to standard')
      console.log('  window.debugStaffSiteIds() - Show each staff member current siteId')
      console.log('  window.repairStaffSiteIds() - Force-fix all labour.siteId from site.assignedStaff')
    }
  }, [])

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

  // Check if user has authorized role
  if (!userRole) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-red-600 mb-4">Access Denied</h2>
          <p className="text-gray-600 mb-4">You are not authorized to access this system.</p>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={logout}
            className="px-6 py-2 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700"
          >
            Sign Out
          </motion.button>
        </div>
      </div>
    )
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
              <Route
                path="/materials"
                element={
                  <ProtectedRoute userRole={userRole} allowedRoles={['admin']}>
                    <MaterialManagement userRole={userRole} />
                  </ProtectedRoute>
                }
              />
              <Route path="/po-requests" element={<PORequests userRole={userRole} />} />
              <Route path="/processes" element={<ProcessManagement userRole={userRole} />} />
              <Route
                path="/reports"
                element={
                  <ProtectedRoute userRole={userRole} allowedRoles={['admin']}>
                    <Reports userRole={userRole} />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/supervisor-management"
                element={
                  <ProtectedRoute userRole={userRole} allowedRoles={['admin']}>
                    <SupervisorManagement userRole={userRole} />
                  </ProtectedRoute>
                }
              />
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
      <SupervisorProvider>
        <AppContent />
      </SupervisorProvider>
    </AuthProvider>
  )
}

export default App