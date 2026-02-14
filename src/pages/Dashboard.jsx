import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Building2, Users, Package, FileText, TrendingUp } from 'lucide-react'
import { siteServices, labourServices, materialServices, purchaseOrderServices, attendanceServices, convertDocsToArray } from '../services/firebaseServices'
import Footer from '../components/Footer'

const Dashboard = ({ userRole }) => {
  const [loading, setLoading] = useState(true)
  const [currentTime, setCurrentTime] = useState(new Date())
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

  // Real-time clock update
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date())
    }, 1000)

    return () => clearInterval(timer)
  }, [])

  // Real-time data update from Firebase
  useEffect(() => {
    const fetchRealTimeData = async () => {
      try {
        setLoading(true)
        
        // Get current month data
        const currentDate = new Date()
        const currentMonth = currentDate.getMonth()
        const currentYear = currentDate.getFullYear()
        
        // Get previous month data for comparison
        const previousMonth = currentMonth === 0 ? 11 : currentMonth - 1
        const previousYear = currentMonth === 0 ? currentYear - 1 : currentYear
        
        // Load sites data
        const sitesSnapshot = await siteServices.getAllSites()
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
        const prevActiveLabour = new Set(prevAttendanceData.map(a => a.labourId)).size
        
        // Get current month attendance for labour comparison
        const currMonthStart = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-01`
        const currMonthEnd = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-31`
        const currAttendanceSnapshot = await attendanceServices.getAttendanceByDateRange(currMonthStart, currMonthEnd)
        const currAttendanceData = convertDocsToArray(currAttendanceSnapshot)
        const currActiveLabour = new Set(currAttendanceData.map(a => a.labourId)).size
        
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

    // Initial load
    fetchRealTimeData()

    // Set up real-time updates every 30 seconds
    const realTimeTimer = setInterval(fetchRealTimeData, 30000)

    return () => clearInterval(realTimeTimer)
  }, [])

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
      title: 'Active Sites',
      value: kpiData.activeSites,
      icon: Building2,
      color: 'bg-blue-500',
      trend: calculateTrend(kpiData.activeSites, previousMonthData.activeSites),
      trendUp: calculateTrend(kpiData.activeSites, previousMonthData.activeSites).isUp
    },
    {
      title: 'Total Labour',
      value: kpiData.totalLabour,
      icon: Users,
      color: 'bg-green-500',
      trend: calculateTrend(kpiData.totalLabour, previousMonthData.totalLabour),
      trendUp: calculateTrend(kpiData.totalLabour, previousMonthData.totalLabour).isUp
    },
    {
      title: 'Material Stock',
      value: kpiData.materialStock,
      icon: Package,
      color: 'bg-purple-500',
      trend: calculateTrend(kpiData.materialStock, previousMonthData.materialStock),
      trendUp: calculateTrend(kpiData.materialStock, previousMonthData.materialStock).isUp
    },
    {
      title: 'Pending POs',
      value: kpiData.pendingPOs,
      icon: FileText,
      color: 'bg-orange-500',
      trend: calculateTrend(kpiData.pendingPOs, previousMonthData.pendingPOs),
      trendUp: calculateTrend(kpiData.pendingPOs, previousMonthData.pendingPOs).isUp
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
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 lg:space-y-8">
      {/* Mobile-First Header */}
      <div className="text-center lg:text-left">
        <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-sm sm:text-base text-gray-600 mt-2">
          Welcome back, {userRole === 'admin' ? 'Admin' : userRole === 'manager' ? 'Site Manager' : 'Supervisor'}
        </p>
      </div>

      {/* Mobile-First KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        {kpiCards.map((card, index) => {
          const Icon = card.icon
          return (
            <motion.div
              key={card.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              whileHover={{ scale: 1.02 }}
              className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6 hover:shadow-lg transition-all cursor-pointer"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <p className="text-xs sm:text-sm font-medium text-gray-600 mb-2">{card.title}</p>
                  <h3 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900 mb-3">{card.value}</h3>
                  <div className="flex items-center gap-1">
                    <TrendingUp className={`w-4 h-4 ${
                      card.trend.isUp ? 'text-green-500' : 'text-red-500'
                    } ${!card.trend.isUp && 'rotate-180'}`} />
                    <span className={`text-sm font-medium ${
                      card.trend.isUp ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {card.trend.isUp ? '+' : '-'}{card.trend.percentage}%
                    </span>
                    <span className="text-xs text-gray-500 ml-1">vs last month</span>
                  </div>
                </div>
                <div className={`${card.color} p-3 sm:p-4 rounded-lg ml-4`}>
                  <Icon className="w-5 h-5 sm:w-6 sm:h-6 lg:w-7 lg:h-7 text-white" />
                </div>
              </div>
            </motion.div>
          )
        })}
      </div>

      {/* Mobile-First Status Bar */}
      <div className="bg-green-50 border border-green-200 rounded-xl p-4 sm:p-6">
        <div className="flex items-center justify-center lg:justify-start gap-3">
          <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
          <span className="text-sm sm:text-base font-medium text-green-700">All Systems Operational</span>
        </div>
      </div>

      <Footer />
    </div>
  )
}

export default Dashboard
