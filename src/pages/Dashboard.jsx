import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Building2, Users, Package, FileText, TrendingUp, Plus, MapPin, UserPlus, UserIcon, Package as PackageIcon, DollarSign, Search, X, PlusSquare, LogOut, ArrowLeft } from 'lucide-react'
import { siteServices, buildingServices, labourServices, materialServices, purchaseOrderServices, attendanceServices, dprServices, processServices, convertDocsToArray, supervisorServices, syncSiteToSupervisors, syncSingleStaffToSite } from '../services/firebaseServices'
import { onSnapshot, collection, query, where, doc } from 'firebase/firestore'
import { storage, db } from '../firebase'
import { useSupervisor } from '../contexts/SupervisorContext.jsx'
import { useAuth } from '../components/Auth'
import storageService from '../services/storageService'
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'
import Footer from '../components/Footer'
import { useNavigate } from 'react-router-dom'
import StatusModal from '../components/StatusModal'
import DPRCreation from '../components/DPRCreation'

const Dashboard = ({ userRole }) => {
  const navigate = useNavigate()
  const { currentSupervisor, assignedSites } = useSupervisor()
  const { user, logout } = useAuth()
  const [loading, setLoading] = useState(true)
  const [currentTime, setCurrentTime] = useState(new Date())
  const [showDPRFlow, setShowDPRFlow] = useState(false)
  const [sites, setSites] = useState([])
  const [buildings, setBuildings] = useState([])
  const [staff, setStaff] = useState([])
  const [attendance, setAttendance] = useState([])
  const [materials, setMaterials] = useState([])
  const [dprRecords, setDprRecords] = useState([])
  const [supervisorsList, setSupervisorsList] = useState([]) // for admin supervisor picker
  const [quickExpenseSite, setQuickExpenseSite] = useState(null)
  const [quickExpenseAmount, setQuickExpenseAmount] = useState(0)
  const [quickExpenseDescription, setQuickExpenseDescription] = useState('')
  const [quickExpenseFor, setQuickExpenseFor] = useState('')
  const [quickStaffSite, setQuickStaffSite] = useState(null)
  const [staffSearchTerm, setStaffSearchTerm] = useState('')
  const [kpiData, setKpiData] = useState({
    activeSites: 0,
    totalLabour: 0,
    materialStock: 0,
    pendingPOs: 0
  })
  const [previousMonthData, setPreviousMonthData] = useState({
    activeSites: 0,
    totalLabour: 0,
    materialStock: 0,
    pendingPOs: 0
  })

  // Status Modal State
  const [statusModal, setStatusModal] = useState({
    visible: false,
    type: 'success',
    title: '',
    message: '',
    onConfirm: null,
    onCancel: null
  })

  const showAlert = (title, message, type = 'success') => {
    setStatusModal({ 
      visible: true, 
      type, 
      title, 
      message, 
      onConfirm: () => setStatusModal(prev => ({ ...prev, visible: false })) 
    })
  }

  const showConfirm = (title, message, onConfirm) => {
    setStatusModal({ 
      visible: true, 
      type: 'confirm', 
      title, 
      message, 
      onConfirm: () => {
        onConfirm();
        setStatusModal(prev => ({ ...prev, visible: false }));
      },
      onCancel: () => setStatusModal(prev => ({ ...prev, visible: false }))
    })
  }

  // Real-time clock update
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date())
    }, 1000)

    return () => clearInterval(timer)
  }, [])

  // Load real data from Firebase in Real-Time
  useEffect(() => {
    let unsubscribers = []

    setLoading(true)

    if (userRole === 'supervisor') {
      if (!currentSupervisor) {
        setLoading(false)
        return
      }

      setSites(assignedSites)

      if (assignedSites.length === 0) {
        setBuildings([]); setStaff([]); setAttendance([]); setMaterials([]); setDprRecords([])
        setLoading(false)
        return
      }

      const assignedSiteIds = assignedSites.map(site => site.id)
      const today = new Date().toISOString().split('T')[0]

      // Setup state containers for mapping multiple snapshot merges
      const buildingsMap = {}
      const staffMap = {}
      const dprMap = {}
      const attendanceMap = {}

      assignedSiteIds.forEach(id => {
        unsubscribers.push(
          onSnapshot(query(collection(db, 'buildings'), where('siteId', '==', id)), (snap) => {
            buildingsMap[id] = convertDocsToArray(snap)
            setBuildings(Object.values(buildingsMap).flat())
          })
        )
        unsubscribers.push(
          onSnapshot(query(collection(db, 'labour'), where('siteId', '==', id)), (snap) => {
            staffMap[id] = convertDocsToArray(snap)
            setStaff(Object.values(staffMap).flat())
          })
        )
        unsubscribers.push(
          onSnapshot(query(collection(db, 'dpr'), where('siteId', '==', id)), (snap) => {
            dprMap[id] = convertDocsToArray(snap)
            setDprRecords(Object.values(dprMap).flat())
          })
        )
        unsubscribers.push(
          onSnapshot(query(collection(db, 'attendance'), where('siteId', '==', id), where('date', '==', today)), (snap) => {
            attendanceMap[id] = convertDocsToArray(snap)
            setAttendance(Object.values(attendanceMap).flat())
          })
        )
      })

      // Materials are global
      unsubscribers.push(
        onSnapshot(collection(db, 'materials'), (snap) => {
          setMaterials(convertDocsToArray(snap))
        })
      )
      
      setLoading(false)
    } else {
      // Admin sees all data
      const today = new Date().toISOString().split('T')[0]

      unsubscribers.push(
        onSnapshot(collection(db, 'sites'), (snap) => setSites(convertDocsToArray(snap))),
        onSnapshot(collection(db, 'buildings'), (snap) => setBuildings(convertDocsToArray(snap))),
        onSnapshot(collection(db, 'labour'), (snap) => setStaff(convertDocsToArray(snap))),
        onSnapshot(collection(db, 'materials'), (snap) => setMaterials(convertDocsToArray(snap))),
        onSnapshot(collection(db, 'dpr'), (snap) => setDprRecords(convertDocsToArray(snap))),
        onSnapshot(query(collection(db, 'attendance'), where('date', '==', today)), (snap) => setAttendance(convertDocsToArray(snap))),
        onSnapshot(query(collection(db, 'supervisors'), where('status', '==', 'active')), (snap) => setSupervisorsList(convertDocsToArray(snap)))
      )

      setLoading(false)
    }

    return () => {
      unsubscribers.forEach(unsub => unsub())
    }
  }, [userRole, currentSupervisor, assignedSites])

  const handleOpenExpenseModal = (siteId) => {
    setQuickExpenseSite(siteId);
    setQuickExpenseAmount('');
    setQuickExpenseDescription('');
    setQuickExpenseFor('');
  };

  const handleSaveQuickExpense = async () => {
    if (!quickExpenseAmount) return;
    const expenseAmount = parseInt(quickExpenseAmount);
    if (isNaN(expenseAmount) || expenseAmount <= 0) {
      alert("Invalid amount entered.");
      return;
    }
    try {
      const site = sites.find(s => s.id === quickExpenseSite);
      const newExpense = {
        amount: expenseAmount,
        expenseFor: quickExpenseFor,
        description: quickExpenseDescription,
        date: new Date().toISOString(),
        siteId: quickExpenseSite,
        siteName: site.name
      };

      // Get current expenses array or create new one
      const currentExpenses = site.expenses || [];
      const updatedExpenses = [...currentExpenses, newExpense];

      await siteServices.updateSite(quickExpenseSite, {
        expenses: updatedExpenses,
        totalExpenses: updatedExpenses.reduce((sum, exp) => sum + exp.amount, 0)
      });

      setSites(sites.map(s => s.id === quickExpenseSite ? {
        ...s,
        expenses: updatedExpenses,
        totalExpenses: updatedExpenses.reduce((sum, exp) => sum + exp.amount, 0)
      } : s));

      setQuickExpenseSite(null);
      alert("Expense added successfully!");
    } catch (err) {
      alert("Failed to add expense: " + err.message);
    }
  };

  const handleToggleQuickStaff = async (siteId, staffId, isAdding) => {
    try {
      await syncSingleStaffToSite(staffId, isAdding ? siteId : null);

      // Update sites state — add/remove staffId from assignedStaff
      setSites(prev => prev.map(s => {
        const cleanedOld = (s.assignedStaff || []).filter(id => id !== staffId);
        if (isAdding && s.id === siteId) {
          return { ...s, assignedStaff: [...cleanedOld, staffId] };
        }
        return { ...s, assignedStaff: cleanedOld };
      }));

      // Also update the staff list's siteId so that modal badge refreshes instantly
      setStaff(prev => prev.map(s => {
        if (s.id !== staffId) return s;
        return { ...s, siteId: isAdding ? siteId : null };
      }));
    } catch (err) {
      alert("Operation failed: " + err.message);
    }
  };

  // Real-time clock update
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date())
    }, 1000)

    return () => clearInterval(timer)
  }, [])

  // Real-time data update from Firebase (admin only)
  useEffect(() => {
    // Supervisors get their KPI data from the main loadData useEffect above.
    // This uses full collection scans that only work for admins.
    if (userRole === 'supervisor') return

    const fetchRealTimeData = async () => {
      try {
        // Get current month data
        const currentDate = new Date()
        const currentMonth = currentDate.getMonth()
        const currentYear = currentDate.getFullYear()

        // Get previous month data for comparison
        const previousMonth = currentMonth === 0 ? 11 : currentMonth - 1
        const previousYear = currentMonth === 0 ? currentYear - 1 : currentYear

        // Load sites data
        const sitesSnapshot = userRole === 'supervisor' ? await siteServices.getSitesForSupervisor(user?.uid) : await siteServices.getAllSites()
        const sitesData = convertDocsToArray(sitesSnapshot)
        const activeSites = sitesData.filter(s => s.status === 'Active').length

        // Load labour data
        const labourSnapshot = await labourServices.getAllLabour()
        const labourData = convertDocsToArray(labourSnapshot)

        // Load material data
        const materialsSnapshot = await materialServices.getAllMaterials()
        const materialsData = convertDocsToArray(materialsSnapshot)
        const materialStock = materialsData.reduce((sum, m) => sum + (m.currentStock || 0), 0)

        // Load purchase orders data
        const poSnapshot = await purchaseOrderServices.getAllPurchaseOrders()
        const poData = convertDocsToArray(poSnapshot)
        const pendingPOs = poData.filter(po => po.status === 'Pending' || po.status === 'Approved').length

        // Get previous month attendance for labour comparison
        const prevMonthStart = `${previousYear}-${String(previousMonth + 1).padStart(2, '0')}-01`
        const prevMonthEnd = `${previousYear}-${String(previousMonth + 1).padStart(2, '0')}-31`
        const prevAttendanceSnapshot = await attendanceServices.getAttendanceByDateRange(prevMonthStart, prevMonthEnd)
        const prevAttendanceData = convertDocsToArray(prevAttendanceSnapshot)
        const prevActiveLabour = new Set(prevAttendanceData.map(a => a.employeeId).filter(Boolean)).size

        // Get current month attendance for labour comparison
        const currMonthStart = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-01`
        const currMonthEnd = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-31`
        const currAttendanceSnapshot = await attendanceServices.getAttendanceByDateRange(currMonthStart, currMonthEnd)
        const currAttendanceData = convertDocsToArray(currAttendanceSnapshot)
        const currActiveLabour = new Set(currAttendanceData.map(a => a.employeeId).filter(Boolean)).size

        setKpiData({
          activeSites,
          totalLabour: labourData.length,
          materialStock,
          pendingPOs
        })

        setPreviousMonthData({
          activeSites: Math.max(1, activeSites - 1), // Simulated previous month
          totalLabour: Math.max(1, prevActiveLabour),
          materialStock: Math.max(1, materialStock + 100), // Simulated previous month
          pendingPOs: Math.max(1, pendingPOs - 1) // Simulated previous month
        })

        setLoading(false)
      } catch (error) {
        console.error('Error loading real-time data:', error)
        setLoading(false)
      }
    }

    fetchRealTimeData()
    const realTimeTimer = setInterval(fetchRealTimeData, 30000)
    return () => clearInterval(realTimeTimer)
  }, [userRole])

  // Calculate trends
  const calculateTrend = (current, previous) => {
    if (previous === 0) return { percentage: 0, isUp: true }
    const change = current - previous
    const percentage = Math.abs((change / previous) * 100)
    return {
      percentage: Math.round(percentage),
      isUp: change >= 0,
      absoluteChange: change
    }
  }

  const kpiCards = [
    {
      title: 'Total Sites',
      value: sites.length,
      icon: Building2,
      color: 'bg-blue-500',
      trend: calculateTrend(sites.length, Math.max(1, sites.length - 1)),
      trendUp: calculateTrend(sites.length, Math.max(1, sites.length - 1)).isUp
    },
    {
      title: 'Active Sites',
      value: kpiData.activeSites,
      icon: Building2,
      color: 'bg-green-500',
      trend: calculateTrend(kpiData.activeSites, previousMonthData.activeSites),
      trendUp: calculateTrend(kpiData.activeSites, previousMonthData.activeSites).isUp
    },
    {
      title: 'Total Labour',
      value: kpiData.totalLabour,
      icon: Users,
      color: 'bg-purple-500',
      trend: calculateTrend(kpiData.totalLabour, previousMonthData.totalLabour),
      trendUp: calculateTrend(kpiData.totalLabour, previousMonthData.totalLabour).isUp
    },
    {
      title: 'Material Stock',
      value: kpiData.materialStock,
      icon: Package,
      color: 'bg-orange-500',
      trend: calculateTrend(kpiData.materialStock, previousMonthData.materialStock),
      trendUp: calculateTrend(kpiData.materialStock, previousMonthData.materialStock).isUp
    }
  ]

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
          className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full"
        />
      </div>
    )
  }

  return (
    <div className="p-3 sm:p-4 lg:p-6 space-y-4 lg:space-y-6">
      {/* Mobile-First Header & Profile Section */}
      <div className="flex flex-col md:flex-row justify-between items-center gap-4 mb-4 bg-white p-4 rounded-3xl shadow-sm border border-gray-100">
        <div className="text-center md:text-left">
          <h1 className="text-2xl sm:text-3xl font-black text-gray-900 tracking-tight">Dashboard</h1>
          <p className="text-gray-500 font-medium mt-1">
            Welcome back, <span className="text-blue-600 font-bold">{user?.email?.split('@')[0] || 'User'}</span>
          </p>
        </div>

        {/* User Profile Card (Moved from Sidebar) */}
        <div className="flex items-center gap-4 bg-blue-50/50 p-4 rounded-3xl border border-blue-100/50 backdrop-blur-sm">
          <div className="w-12 h-12 bg-gradient-to-tr from-blue-600 to-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-blue-200">
            <UserIcon className="w-6 h-6" />
          </div>
          <div className="hidden sm:block">
            <p className="text-[10px] font-black text-blue-400 uppercase tracking-[0.2em] mb-0.5">Logged in as</p>
            <p className="text-sm font-black text-gray-900 leading-none mb-1">{user?.email?.split('@')[0]}</p>
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
              <p className="text-[11px] font-bold text-gray-500 capitalize">{userRole} • Active Account</p>
            </div>
          </div>
        </div>
      </div>

      {/* Comprehensive Action Hub Grid */}
      <div className=" flex flex-col justify-center max-w-4xl mx-auto w-full py-2 space-y-4">

        {/* Main Hero Group */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <motion.div
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => navigate('/dpr')}
            className="bg-gradient-to-br from-indigo-600 via-indigo-700 to-blue-700 p-5 rounded-[1.5rem] shadow-2xl flex items-center justify-between cursor-pointer text-white relative overflow-hidden group"
          >
            <div className="absolute top-0 right-0 -mr-8 -mt-8 w-32 h-32 bg-white/10 rounded-full blur-3xl group-hover:bg-white/20 transition-colors" />
            <div className="flex items-center gap-3 relative z-10">
              <div className="bg-white/20 p-3 rounded-2xl backdrop-blur-xl border border-white/30 shadow-inner">
                <FileText className="w-7 h-7 text-white" />
              </div>
              <div>
                <h2 className="text-lg font-black tracking-tight">DPR Report</h2>
                <p className="text-indigo-100 text-xs font-medium opacity-90">Daily Updates</p>
              </div>
            </div>
            <div className="bg-white/20 p-2 rounded-full backdrop-blur-md">
              <Plus className="w-5 h-5" />
            </div>
          </motion.div>

          {/* New Site Tile for Admins */}
          {userRole === 'admin' && (
            <motion.div
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setShowDPRFlow(true)}
              className="bg-gradient-to-br from-emerald-500 to-teal-600 p-5 rounded-[1.5rem] shadow-2xl flex items-center justify-between cursor-pointer text-white relative overflow-hidden group"
            >
              <div className="absolute top-0 right-0 -mr-8 -mt-8 w-32 h-32 bg-white/10 rounded-full blur-3xl group-hover:bg-white/20 transition-colors" />
              <div className="flex items-center gap-3 relative z-10">
                <div className="bg-white/20 p-3 rounded-2xl backdrop-blur-xl border border-white/30 shadow-inner">
                  <Building2 className="w-7 h-7 text-white" />
                </div>
                <div>
                  <h2 className="text-lg font-black tracking-tight uppercase">New Site</h2>
                  <p className="text-emerald-100 text-xs font-medium opacity-90">Create Site/Area</p>
                </div>
              </div>
              <Plus className="w-6 h-6 opacity-50" />
            </motion.div>
          )}
        </div>

        {/* Action Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            ...(userRole === 'admin' ? [
              { icon: Users, label: 'Attendance', path: '/attendance', color: 'bg-emerald-500', desc: 'STAKEHOLDERS' }
            ] : []),
            ...(userRole === 'admin' ? [
              { icon: Building2, label: 'Management', path: '/sites', color: 'bg-blue-500', desc: 'SITES' }
            ] : []),
            ...(userRole === 'admin' ? [
              { icon: Package, label: 'Inventory', path: '/materials', color: 'bg-orange-500', desc: 'MATERIALS' }
            ] : []),
            { icon: DollarSign, label: 'PO Requests', path: '/po-requests', color: 'bg-amber-500', desc: 'PURCHASES' },
            { icon: TrendingUp, label: 'Monthly Report', path: '/reports', color: 'bg-purple-500', desc: 'ANALYSIS' },
            {
              icon: LogOut,
              label: 'Logout',
              action: () => {
                showConfirm(
                  'Confirm Logout',
                  'Are you sure you want to logout from your account?',
                  async () => {
                    await logout();
                    navigate('/login');
                  }
                );
              },
              color: 'bg-slate-400',
              desc: 'EXIT'
            }
          ].map((item) => (
            <motion.div
              key={item.label}
              whileHover={{ y: -5, scale: 1.02 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => item.path ? navigate(item.path) : item.action()}
              className="bg-white p-4 rounded-2xl border border-gray-100 shadow-xl flex flex-col items-center justify-center gap-3 cursor-pointer group active:bg-gray-50"
            >
              <div className={`${item.color} p-3 rounded-xl text-white shadow-lg group-hover:rotate-6 transition-transform`}>
                <item.icon className="w-5 h-5" />
              </div>
              <div className="text-center">
                <p className="font-extrabold text-gray-900 text-sm leading-tight uppercase">{item.label}</p>
                <p className="text-[9px] text-gray-400 font-black tracking-widest mt-1 opacity-60">{item.desc}</p>
              </div>
            </motion.div>
          ))}

        </div>

      </div>

      <DPRCreation
        showDPRFlow={showDPRFlow}
        setShowDPRFlow={setShowDPRFlow}
        userRole={userRole}
        user={user}
        sites={sites}
        buildings={buildings}
        staff={staff}
        materials={materials}
        attendance={attendance}
        supervisorsList={supervisorsList}
        onDPRCreated={() => {
          // Refresh data after DPR creation
          window.location.reload()
        }}
      />

      <AnimatePresence>
        {quickExpenseSite && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-[60]"
            onClick={() => setQuickExpenseSite(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden"
            >
              <div className="p-5 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
                <h3 className="font-bold text-gray-800 text-lg flex items-center gap-2"><DollarSign className="w-5 h-5 text-red-500" /> Add Expense</h3>
                <button onClick={() => setQuickExpenseSite(null)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
              </div>
              <div className="p-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Amount (₹)</label>
                  <input
                    type="number" autoFocus min="1"
                    value={quickExpenseAmount}
                    onChange={(e) => setQuickExpenseAmount(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleSaveQuickExpense() }}
                    className="w-full text-lg px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none transition-shadow"
                    placeholder="e.g. 150"
                  />
                </div>

                <div className="mt-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Expense For</label>
                  <input
                    type="text"
                    value={quickExpenseFor}
                    onChange={(e) => setQuickExpenseFor(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                    placeholder="e.g., Cement, Steel, Labor"
                  />
                </div>

                <div className="mt-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Description (Optional)</label>
                  <input
                    type="text"
                    value={quickExpenseDescription}
                    onChange={(e) => setQuickExpenseDescription(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                    placeholder="e.g., For foundation work"
                  />
                </div>
              </div>
              <div className="p-4 bg-gray-50 border-t border-gray-100 flex gap-3">
                <button onClick={() => setQuickExpenseSite(null)} className="flex-1 py-2.5 bg-white border border-gray-300 rounded-lg font-medium text-gray-700 hover:bg-gray-50">Cancel</button>
                <button onClick={handleSaveQuickExpense} className="flex-1 py-2.5 bg-red-600 text-white rounded-lg font-bold hover:bg-red-700 shadow-sm focus:ring-4 focus:ring-red-500/30 transition-all">Add Expense</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {quickStaffSite && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-[60]"
            onClick={() => { setQuickStaffSite(null); setStaffSearchTerm(''); }}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[85vh] overflow-hidden"
            >
              <div className="p-5 border-b border-gray-100 bg-white flex items-center justify-between shrink-0">
                <h3 className="font-bold text-gray-900 text-xl flex items-center gap-2">
                  <Users className="w-5 h-5 text-blue-600" /> Site Staff Registry
                </h3>
                <button onClick={() => { setQuickStaffSite(null); setStaffSearchTerm(''); }} className="p-1.5 rounded-full hover:bg-gray-100 text-gray-500 transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-4 border-b border-gray-100 bg-gray-50 shrink-0">
                <div className="relative">
                  <Search className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text" autoFocus
                    value={staffSearchTerm}
                    onChange={(e) => setStaffSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 shadow-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                    placeholder="Search by worker name, phone..."
                  />
                </div>
              </div>

              {/* Staff Count Summary */}
              <div className="px-4 py-3 bg-blue-50 border-b border-blue-100">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium text-blue-900">Staff Summary</span>
                  <div className="flex items-center gap-4">
                    <span className="text-gray-600">Total: <span className="font-semibold text-gray-900">{staff.length}</span></span>
                    <span className="text-green-600">Present: <span className="font-semibold text-green-700">{attendance.filter(a => a.status === 'present').length}</span></span>
                    <span className="text-red-600">Absent: <span className="font-semibold text-red-700">{attendance.filter(a => a.status === 'absent').length}</span></span>
                  </div>
                </div>
              </div>

              <div className="p-2 overflow-y-auto flex-1 bg-gray-50">
                <div className="space-y-1.5 px-2 pb-4">
                  {staff
                    .filter(s => (s.name + s.phone).toLowerCase().includes(staffSearchTerm.toLowerCase()))
                    .sort((a, b) => (a.name || '').localeCompare(b.name || ''))
                    .map(st => {
                      const theSite = sites.find(s => s.id === quickStaffSite);
                      const isAssignedToThis = (theSite?.assignedStaff || []).includes(st.id);
                      const currentSiteInfo = st.siteId && st.siteId !== quickStaffSite ? sites.find(s => s.id === st.siteId) : null;

                      return (
                        <div
                          key={st.id}
                          className={`group flex items-center justify-between p-3.5 rounded-xl border-2 transition-all cursor-pointer ${isAssignedToThis ? 'bg-blue-50/50 border-blue-500 shadow-sm' : 'bg-white border-transparent hover:border-blue-200 shadow-sm'}`}
                          onClick={() => handleToggleQuickStaff(quickStaffSite, st.id, !isAssignedToThis)}
                        >
                          <div className="flex items-center gap-4">
                            <div className={`shrink-0 w-6 h-6 rounded border flex items-center justify-center transition-colors ${isAssignedToThis ? 'bg-blue-600 border-blue-600 text-white' : 'border-gray-300 bg-white group-hover:border-blue-400'}`}>
                              {isAssignedToThis && <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                            </div>
                            <div>
                              <h4 className={`text-base font-bold ${isAssignedToThis ? 'text-blue-900' : 'text-gray-900'}`}>{st.name}</h4>
                              <p className="text-sm text-gray-500 font-medium">{st.phone || ''}</p>
                            </div>
                          </div>
                          {currentSiteInfo && !isAssignedToThis ? (
                            <span className="text-xs font-semibold px-2.5 py-1 bg-amber-100 text-amber-800 rounded-lg">Moves from: {currentSiteInfo.name}</span>
                          ) : isAssignedToThis ? (
                            <span className="text-xs font-bold px-2.5 py-1 bg-blue-100 text-blue-700 rounded-lg">Assigned</span>
                          ) : null}
                        </div>
                      );
                    })}
                  {staff.filter(s => (s.name + s.phone).toLowerCase().includes(staffSearchTerm.toLowerCase())).length === 0 && (
                    <div className="text-center py-10 px-4 text-gray-500">
                      <Users className="w-10 h-10 mx-auto text-gray-300 mb-2" />
                      <p className="text-lg font-medium text-gray-600">No workers found</p>
                      <p className="text-sm">Try adjusting your search criteria</p>
                    </div>
                  )}
                </div>
              </div>
              <div className="p-4 border-t border-gray-200 bg-white shrink-0 flex justify-end">
                <button onClick={() => { setQuickStaffSite(null); setStaffSearchTerm(''); }} className="px-6 py-2.5 bg-blue-600 text-white rounded-xl font-bold shadow-md hover:bg-blue-700 hover:shadow-lg transition-all">Done Editing</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <StatusModal 
        {...statusModal} 
        onCancel={() => setStatusModal(prev => ({ ...prev, visible: false }))}
      />
      <Footer />
    </div >
  )
}

export default Dashboard
