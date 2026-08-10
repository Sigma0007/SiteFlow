import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, XCircle, AlertCircle, HelpCircle, X } from 'lucide-react';

const StatusModal = ({ visible, type = 'success', title, message, onConfirm, onCancel, confirmLabel = 'Confirm', cancelLabel = 'Cancel' }) => {
  if (!visible) return null;

  const icons = {
    success: <CheckCircle className="w-12 h-12 text-green-500" />,
    error: <XCircle className="w-12 h-12 text-red-500" />,
    warning: <AlertCircle className="w-12 h-12 text-amber-500" />,
    confirm: <HelpCircle className="w-12 h-12 text-blue-500" />
  };

  const colors = {
    success: 'bg-green-500',
    error: 'bg-red-500',
    warning: 'bg-amber-500',
    confirm: 'bg-blue-500'
  };

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-[100]"
          onClick={onCancel || onConfirm}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 20 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden"
          >
            <div className="p-8 text-center">
              <div className="flex justify-center mb-6">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', damping: 12, stiffness: 200 }}
                >
                  {icons[type]}
                </motion.div>
              </div>
              <h3 className="text-xl font-black text-gray-900 mb-2 uppercase tracking-tight">{title}</h3>
              <p className="text-gray-500 font-medium leading-relaxed">{message}</p>
            </div>

            <div className="p-6 bg-gray-50 border-t border-gray-100 flex gap-3">
              {type === 'confirm' ? (
                <>
                  <button
                    onClick={onCancel}
                    className="flex-1 py-3 bg-white border border-gray-200 rounded-2xl font-bold text-gray-600 hover:bg-gray-100 transition-all text-sm uppercase tracking-wider"
                  >
                    {cancelLabel}
                  </button>
                  <button
                    onClick={onConfirm}
                    className={`flex-1 py-3 ${colors[type]} text-white rounded-2xl font-bold hover:opacity-90 shadow-lg transition-all text-sm uppercase tracking-wider`}
                  >
                    {confirmLabel}
                  </button>
                </>
              ) : (
                <button
                  onClick={onConfirm}
                  className={`w-full py-3 ${colors[type]} text-white rounded-2xl font-bold hover:opacity-90 shadow-lg transition-all text-sm uppercase tracking-wider`}
                >
                  OK
                </button>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default StatusModal;
