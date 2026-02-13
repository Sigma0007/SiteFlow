import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Building2, Users, Package, FileText, TrendingUp } from 'lucide-react'
import { sites, labourData, materials, purchaseOrders } from '../data/mockData'

const Dashboard = ({ userRole }) => {
  const [loading, setLoading] = useState(true)
  const [kpiData, setKpiData] = useState({
    activeSites: 0,
    totalLabour: 0,
    materialStock: 0,
    pendingPOs: 0
  })

  useEffect(() => {
    setTimeout(() => {
      const activeSites = sites.filter(s => s.status === 'Active').length
      const totalLabour = labourData.length
      const materialStock = materials.reduce((sum, m) => sum + m.currentStock, 0)
      const pendingPOs = purchaseOrders.filter(po => po.status === 'Pending').length

      setKpiData({ activeSites, totalLabour, materialStock, pendingPOs })
      setLoading(false)
    }, 800)
  }, [])

  const kpiCards = [
    {
      title: 'Active Sites',
      value: kpiData.activeSites,
      icon: Building2,
      color: 'bg-blue-500',
      trend: '+12%',
      trendUp: true
    },
    {
      title: 'Total Labour',
      value: kpiData.totalLabour,
      icon: Users,
      color: 'bg-green-500',
      trend: '+8%',
      trendUp: true
    },
    {
      title: 'Material Stock',
      value: kpiData.materialStock,
      icon: Package,
      color: 'bg-purple-500',
      trend: '-5%',
      trendUp: false
    },
    {
      title: 'Pending POs',
      value: kpiData.pendingPOs,
      icon: FileText,
      color: 'bg-orange-500',
      trend: '+3',
      trendUp: false
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
                      card.trendUp ? 'text-green-500' : 'text-red-500'
                    } ${!card.trendUp && 'rotate-180'}`} />
                    <span className={`text-sm font-medium ${
                      card.trendUp ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {card.trend}
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
    </div>
  )
}

export default Dashboard
