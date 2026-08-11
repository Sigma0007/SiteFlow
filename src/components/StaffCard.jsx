import React from 'react'
import { motion } from 'framer-motion'
import { MoreVertical } from 'lucide-react'

const StaffCard = ({ staff, onUpdateStatus, onDelete, showActions = true }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="border border-gray-200 rounded-lg p-4 hover:border-primary hover:shadow-md transition-all cursor-pointer"
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-primary rounded-full flex items-center justify-center shadow-sm">
            <span className="text-white font-semibold">{staff.name.split(' ').map(n => n[0]).join('')}</span>
          </div>
          <div className="flex-1">
            <h4 className="font-semibold text-gray-900">{staff.name}</h4>
            <p className="text-sm text-gray-600">{staff.role}</p>
            <p className="text-xs text-gray-500 mt-1">{staff.email}</p>
            <p className="text-xs text-gray-500">{staff.phone}</p>
            {staff.joinDate && (
              <p className="text-xs text-gray-400 mt-1">Joined: {staff.joinDate}</p>
            )}
          </div>
        </div>
        {showActions && (
          <div className="flex flex-col items-end gap-2">
            <select
              value={staff.status}
              onChange={(e) => onUpdateStatus(staff.id, e.target.value)}
              className={`text-xs px-2 py-1 rounded border-0 cursor-pointer transition-colors ${
                staff.status === 'Active' ? 'bg-green-100 text-green-700 hover:bg-green-200' : 
                staff.status === 'On Leave' ? 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200' : 
                'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <option value="Active">Active</option>
              <option value="On Leave">On Leave</option>
              <option value="Inactive">Inactive</option>
            </select>
            <button
              onClick={() => onDelete(staff.id)}
              className="text-red-500 hover:text-red-700 hover:bg-red-50 text-xs px-2 py-1 rounded transition-all"
            >
              Remove
            </button>
          </div>
        )}
      </div>
    </motion.div>
  )
}

export default StaffCard
