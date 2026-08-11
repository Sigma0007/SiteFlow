import React from 'react'
import { motion } from 'framer-motion'
import { Users, Search, Plus } from 'lucide-react'

const EmptyState = ({ 
  icon = 'users', 
  title, 
  description, 
  actionText, 
  onAction,
  className = ''
}) => {
  const getIcon = () => {
    switch (icon) {
      case 'search':
        return <Search className="w-8 h-8 text-gray-400" />
      case 'plus':
        return <Plus className="w-8 h-8 text-gray-400" />
      default:
        return <Users className="w-8 h-8 text-gray-400" />
    }
  }

  return (
    <div className={`text-center py-12 ${className}`}>
      <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
        {getIcon()}
      </div>
      <h3 className="text-lg font-semibold text-gray-900 mb-2">{title}</h3>
      <p className="text-gray-600 mb-4">{description}</p>
      {actionText && onAction && (
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={onAction}
          className="bg-primary text-white px-4 py-2 rounded-lg hover:bg-primary-dark transition-colors"
        >
          {actionText}
        </motion.button>
      )}
    </div>
  )
}

export default EmptyState
