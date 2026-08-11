import React from 'react'
import { motion } from 'framer-motion'
import { TrendingUp } from 'lucide-react'

const KPICard = ({ title, value, icon: Icon, color, trend, trendUp, onClick, section }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ scale: 1.02 }}
      onClick={onClick}
      className={`card-hover cursor-pointer ${section ? 'cursor-pointer' : ''}`}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-gray-600 mb-1">{title}</p>
          <h3 className="text-3xl font-bold text-gray-900">{value}</h3>
          <div className="flex items-center gap-1 mt-2">
            <TrendingUp className={`w-4 h-4 ${
              trendUp ? 'text-green-500' : 'text-red-500'
            } ${!trendUp && 'rotate-180'}`} />
            <span className={`text-sm font-medium ${
              trendUp ? 'text-green-600' : 'text-red-600'
            }`}>
              {trend}
            </span>
            <span className="text-xs text-gray-500 ml-1">vs last month</span>
          </div>
        </div>
        <div className={`${color} p-3 rounded-lg`}>
          <Icon className="w-6 h-6 text-white" />
        </div>
      </div>
    </motion.div>
  )
}

export default KPICard
