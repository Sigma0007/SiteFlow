import React from 'react'

const Footer = () => {
  return (
    <div className="border-t border-gray-200 pt-6 mt-8">
      <div className="text-center space-y-2">
        <p className="text-sm text-gray-600">
          © 2026 All rights reserved.
        </p>
        <p className="text-sm text-gray-600">
          Handcrafted by{' '}
          <a 
            href="https://shivvilonsolutions.com/" 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-blue-600 hover:text-blue-800 font-medium transition-colors hover:underline"
          >
            Shivvilon Solutions
          </a>
        </p>
      </div>
    </div>
  )
}

export default Footer
