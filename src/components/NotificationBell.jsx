import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Bell, Package, CheckCircle, Clock } from 'lucide-react'
import { notificationServices, convertDocsToArray } from '../services/firebaseServices'
import { useAuth } from './Auth'
import { onForegroundMessage } from '../firebase'
import { useNavigate } from 'react-router-dom'

const NotificationBell = () => {
  const { user, userRole } = useAuth()
  const navigate = useNavigate()
  const [notifications, setNotifications] = useState([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [isOpen, setIsOpen] = useState(false)

  useEffect(() => {
    if (!user?.email) return

    // ------------------------------------------------------------------
    // Dual-listener architecture
    // ------------------------------------------------------------------
    // Listener 1 — Personal:   recipientEmail == user.email
    // Listener 2 — Role-based: recipientRole  == userRole (e.g. 'admin')
    //
    // Supervisors cannot read the 'users' collection (Firestore rules),
    // so they cannot resolve admin emails at notification-send time.
    // Instead they save notifications with recipientRole:'admin'.
    // This role listener picks those up on the admin side with zero
    // hardcoded emails and zero permission errors.
    //
    // Both pools are merged, deduplicated by doc ID, and sorted newest-
    // first in memory — no Firestore composite index required.
    // ------------------------------------------------------------------

    let personalNotifs = []
    let roleNotifs = []

    const sortAndSet = () => {
      const seen = new Set()
      const merged = [...personalNotifs, ...roleNotifs].filter(n => {
        if (seen.has(n.id)) return false
        seen.add(n.id)
        return true
      })
      merged.sort((a, b) => {
        const tA = a.createdAt ? new Date(a.createdAt).getTime() : 0
        const tB = b.createdAt ? new Date(b.createdAt).getTime() : 0
        return tB - tA
      })
      setNotifications(merged)
      setUnreadCount(merged.filter(n => !n.read).length)
    }

    // Listener 1: personal notifications
    const unsubPersonal = notificationServices.onNotificationsChange(
      user.email,
      (snapshot) => {
        personalNotifs = convertDocsToArray(snapshot)
        sortAndSet()
      },
      (error) => {
        console.error('NotificationBell personal listener error:', error.message)
      }
    )

    // Listener 2: role-based notifications
    let unsubRole = () => {}
    if (userRole) {
      unsubRole = notificationServices.onRoleNotificationsChange(
        userRole,
        (snapshot) => {
          roleNotifs = convertDocsToArray(snapshot)
          sortAndSet()
        },
        (error) => {
          console.error('NotificationBell role listener error:', error.message)
        }
      )
    }

    // Show native banner for foreground FCM messages
    const unsubscribeForeground = onForegroundMessage((payload) => {
      console.log('Foreground FCM message received:', payload)
      if (Notification.permission === 'granted') {
        const notification = new Notification(payload.notification?.title || 'Site Manager', {
          body: payload.notification?.body || payload.data?.message,
          icon: '/icon-192x192.png',
          badge: '/favicon-96x96.png',
          data: payload.data
        })
        notification.onclick = () => {
          window.focus()
          notification.close()
        }
      }
    })

    return () => {
      unsubPersonal()
      unsubRole()
      if (unsubscribeForeground) unsubscribeForeground()
    }
  }, [user?.email, userRole])

  const handleMarkAsRead = async (notificationId) => {
    try {
      await notificationServices.markAsRead(notificationId)
    } catch (error) {
      console.error('Error marking notification as read:', error)
    }
  }

  const handleMarkAllAsRead = async () => {
    try {
      // Mark both personal and role-based notifications as read
      await Promise.all([
        notificationServices.markAllAsRead(user?.email),
        userRole ? notificationServices.markAllRoleNotificationsAsRead(userRole) : Promise.resolve()
      ])
    } catch (error) {
      console.error('Error marking all as read:', error)
    }
  }

  const getNotificationIcon = (type) => {
    switch (type) {
      case 'po_generated': return Clock
      case 'po_approved': return CheckCircle
      case 'po_arrived': return Package
      default: return Bell
    }
  }

  const getNotificationColor = (type) => {
    switch (type) {
      case 'po_generated': return 'bg-yellow-100 text-yellow-600 border-yellow-200'
      case 'po_approved': return 'bg-green-100 text-green-600 border-green-200'
      case 'po_arrived': return 'bg-blue-100 text-blue-600 border-blue-200'
      default: return 'bg-gray-100 text-gray-600 border-gray-200'
    }
  }

  const formatTime = (timestamp) => {
    const date = new Date(timestamp)
    const now = new Date()
    const diffMs = now - date
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays < 7) return `${diffDays}d ago`
    return date.toLocaleDateString()
  }

  return (
    <div className="relative">
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 bg-white rounded-lg shadow-sm border border-gray-200 text-gray-600 hover:text-blue-600 transition-colors"
      >
        <Bell className="w-6 h-6" />
        {unreadCount > 0 && (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center"
          >
            {unreadCount > 9 ? '9+' : unreadCount}
          </motion.div>
        )}
      </motion.button>

      <AnimatePresence>
        {isOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
              className="fixed inset-0 bg-black bg-opacity-20 z-40"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: -10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -10 }}
              className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-xl shadow-2xl border border-gray-200 z-50 max-h-[80vh] overflow-hidden"
            >
              <div className="p-4 border-b border-gray-200 flex items-center justify-between">
                <h3 className="font-bold text-gray-900">Notifications</h3>
                {unreadCount > 0 && (
                  <button
                    onClick={handleMarkAllAsRead}
                    className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                  >
                    Mark all read
                  </button>
                )}
              </div>

              <div className="overflow-y-auto max-h-96">
                {notifications.length === 0 ? (
                  <div className="p-8 text-center text-gray-500">
                    <Bell className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                    <p>No notifications yet</p>
                  </div>
                ) : (
                  notifications.map((notification) => {
                    const Icon = getNotificationIcon(notification.type)
                    return (
                      <motion.div
                        key={notification.id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        className={`p-4 border-b border-gray-100 hover:bg-gray-50 transition-colors cursor-pointer ${
                          !notification.read ? 'bg-blue-50' : ''
                        }`}
                        onClick={() => {
                          if (!notification.read) {
                            handleMarkAsRead(notification.id)
                          }
                          // Navigate to PO if notification has poId
                          if (notification.poId) {
                            navigate('/po-requests')
                            setIsOpen(false)
                          }
                        }}
                      >
                        <div className="flex items-start gap-3">
                          <div className={`p-2 rounded-lg ${getNotificationColor(notification.type)}`}>
                            <Icon className="w-4 h-4" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-gray-900 font-medium">{notification.message}</p>
                            <p className="text-xs text-gray-500 mt-1">{formatTime(notification.createdAt)}</p>
                          </div>
                          {!notification.read && (
                            <div className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0 mt-2" />
                          )}
                        </div>
                      </motion.div>
                    )
                  })
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}

export default NotificationBell
