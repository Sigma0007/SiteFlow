import React from 'react'
import { motion } from 'framer-motion'
import { Users } from 'lucide-react'

const AttendanceCard = ({ title, count, iconType, bgColor, borderColor, textColor }) => {
  const getIcon = () => {
    switch (iconType) {
      case 'check':
        return (
          <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        )
      case 'x':
        return (
          <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        )
      case 'clock':
        return (
          <svg className="w-5 h-5 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        )
      default:
        return <Users className="w-5 h-5 text-blue-600" />
    }
  }

  return (
    <div className={`${bgColor} border ${borderColor} rounded-lg p-4`}>
      <div className="flex items-center justify-between">
        <div>
          <p className={`text-sm ${textColor} font-medium`}>{title}</p>
          <p className={`text-2xl font-bold ${textColor.replace('600', '700')}`}>{count}</p>
        </div>
        <div className="w-10 h-10 bg-white bg-opacity-50 rounded-full flex items-center justify-center">
          {getIcon()}
        </div>
      </div>
    </div>
  )
}

export default AttendanceCard