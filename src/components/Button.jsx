import React from 'react'
import { motion } from 'framer-motion'
import { Plus } from 'lucide-react'

const Button = ({ 
  children, 
  onClick, 
  variant = 'primary', 
  size = 'md',
  disabled = false,
  icon,
  className = '',
  ...props 
}) => {
  const baseClasses = 'font-medium rounded-lg transition-all flex items-center gap-2'
  
  const variantClasses = {
    primary: 'bg-primary text-white hover:bg-primary-dark',
    secondary: 'bg-gray-200 text-gray-700 hover:bg-gray-300',
    danger: 'bg-red-500 text-white hover:bg-red-600',
    success: 'bg-green-500 text-white hover:bg-green-600'
  }
  
  const sizeClasses = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2 text-sm',
    lg: 'px-6 py-3 text-base'
  }

  const disabledClasses = disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'

  return (
    <motion.button
      whileHover={{ scale: disabled ? 1 : 1.02 }}
      whileTap={{ scale: disabled ? 1 : 0.98 }}
      onClick={onClick}
      disabled={disabled}
      className={`${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${disabledClasses} ${className}`}
      {...props}
    >
      {icon && icon}
      {children}
    </motion.button>
  )
}

export const AddButton = ({ onClick, children = 'Add', ...props }) => (
  <Button onClick={onClick} icon={<Plus className="w-4 h-4" />} {...props}>
    {children}
  </Button>
)

export default Button
