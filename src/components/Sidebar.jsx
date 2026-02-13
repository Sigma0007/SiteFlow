import React from 'react'
import { NavLink } from 'react-router-dom'
import { motion } from 'framer-motion'
import { 
  LayoutDashboard, 
  Building2, 
  Users, 
  Package, 
  ListChecks, 
  FileText, 
  LogOut,
  Menu,
  X
} from 'lucide-react'

const Sidebar = ({ isOpen, onToggle, onLogout, userRole }) => {
  const menuItems = [
    { path: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
     { path: '/attendance', icon: Users, label: 'Attendance' },
    { path: '/sites', icon: Building2, label: 'Site Management' },
    { path: '/materials', icon: Package, label: 'Materials' },
    { path: '/processes', icon: ListChecks, label: 'Processes' },
    { path: '/reports', icon: FileText, label: 'Reports' }
  ]

  return (
    <>
      <motion.button
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        onClick={onToggle}
        className="fixed top-4 left-4 z-50 lg:hidden p-2 bg-primary text-white rounded-lg shadow-lg"
      >
        {isOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
      </motion.button>

      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onToggle}
          className="fixed inset-0 bg-black bg-opacity-50 z-30 lg:hidden"
        />
      )}

      <motion.aside
        initial={false}
        animate={{ x: isOpen ? 0 : -280 }}
        transition={{ duration: 0.3, ease: 'easeInOut' }}
        className="fixed left-0 top-0 h-screen w-64 bg-primary text-white shadow-2xl z-40 flex flex-col"
      >
        <div className="p-6 border-b border-white/10">
          <div className="flex items-center gap-3">
            <Building2 className="w-8 h-8" />
            <div>
              <h1 className="text-xl font-bold">SiteFlow</h1>
              <p className="text-xs text-blue-200">Construction Management</p>
            </div>
          </div>
        </div>

        <div className="p-4 border-b border-white/10">
          <div className="bg-white/10 rounded-lg p-3">
            <p className="text-xs text-blue-200 mb-1">Logged in as</p>
            <p className="font-semibold capitalize">
              {userRole === 'admin' ? 'Administrator' : userRole === 'manager' ? 'Site Manager' : 'Supervisor'}
            </p>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {menuItems.map((item, index) => {
            const Icon = item.icon
            return (
              <motion.div
                key={item.path}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
              >
                <NavLink
                  to={item.path}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 ${
                      isActive
                        ? 'bg-white text-primary shadow-lg'
                        : 'text-white hover:bg-white/10'
                    }`
                  }
                >
                  <Icon className="w-5 h-5" />
                  <span className="font-medium">{item.label}</span>
                </NavLink>
              </motion.div>
            )
          })}
        </nav>

        <div className="p-4 border-t border-white/10">
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={onLogout}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-lg bg-red-500 hover:bg-red-600 transition-colors text-white font-medium"
          >
            <LogOut className="w-5 h-5" />
            <span>Logout</span>
          </motion.button>
        </div>
      </motion.aside>
    </>
  )
}

export default Sidebar