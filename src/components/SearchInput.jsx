import React from 'react'
import { Search } from 'lucide-react'

const SearchInput = ({ 
  value, 
  onChange, 
  placeholder = 'Search...', 
  onClear,
  className = '',
  showClearButton = true 
}) => {
  return (
    <div className={`relative ${className}`}>
      <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
      <input
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        className="pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all w-full"
      />
      {showClearButton && value && (
        <button
          onClick={onClear}
          className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}
    </div>
  )
}

export default SearchInput
