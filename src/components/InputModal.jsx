import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { PlusCircle, MinusCircle, X } from 'lucide-react';

const InputModal = ({ visible, title, message, defaultValue = '', placeholder = '', onConfirm, onCancel, confirmLabel = 'Submit', type = 'number', icon }) => {
  const [value, setValue] = useState(defaultValue);

  useEffect(() => {
    if (visible) setValue(defaultValue);
  }, [visible, defaultValue]);

  if (!visible) return null;

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-[100]"
          onClick={onCancel}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 20 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden"
          >
            <div className="p-8">
              <div className="flex justify-center mb-6 text-blue-600">
                {icon || <PlusCircle className="w-12 h-12" />}
              </div>
              <h3 className="text-xl font-black text-gray-900 mb-2 uppercase tracking-tight text-center">{title}</h3>
              <p className="text-gray-500 font-medium leading-relaxed text-center mb-6">{message}</p>
              
              <input
                type={type}
                autoFocus
                value={value}
                onChange={(e) => setValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') onConfirm(value);
                  if (e.key === 'Escape') onCancel();
                }}
                className="w-full px-5 py-4 bg-gray-50 border-2 border-gray-100 rounded-2xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all text-lg font-bold text-center"
                placeholder={placeholder}
              />
            </div>

            <div className="p-6 bg-gray-50 border-t border-gray-100 flex gap-3">
              <button
                onClick={onCancel}
                className="flex-1 py-3 bg-white border border-gray-200 rounded-2xl font-bold text-gray-600 hover:bg-gray-100 transition-all text-sm uppercase tracking-wider"
              >
                Cancel
              </button>
              <button
                onClick={() => onConfirm(value)}
                className="flex-1 py-3 bg-blue-600 text-white rounded-2xl font-bold hover:bg-blue-700 shadow-lg shadow-blue-200 transition-all text-sm uppercase tracking-wider"
              >
                {confirmLabel}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default InputModal;
