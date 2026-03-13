import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Users,
  Calendar,
  CheckCircle,
  XCircle,
  Clock,
  Search,
  Filter,
  Check,
  X,
  TrendingUp,
  Edit2,
  Trash2,
  Plus,
  Save,
  UserPlus
} from 'lucide-react'
import { labourServices, attendanceServices, siteServices, buildingServices, convertDocsToArray, query, where, getDocs, onSnapshot, labourCollection, attendanceCollection, buildingsCollection } from '../services/firebaseServices'
import { useSupervisor } from '../contexts/SupervisorContext.jsx'
import Footer from '../components/Footer'

const AttendanceSimple = ({ userRole = 'admin' }) => {
  const { currentSupervisor, assignedSites } = useSupervisor()
  const [attendance, setAttendance] = useState([])
  const [employees, setEmployees] = useState([])
  const [sites, setSites] = useState([])
  const [buildings, setBuildings] = useState([])
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0])
  const [searchTerm, setSearchTerm] = useState('')
  const [filterStatus, setFilterStatus] = useState('all')
  const [selectedSiteFilter, setSelectedSiteFilter] = useState('all')
  const [loading, setLoading] = useState(true)
  const [submittedToday, setSubmittedToday] = useState(false)

  // Staff management states
  const [showAddStaffModal, setShowAddStaffModal] = useState(false)
  const [showEditStaffModal, setShowEditStaffModal] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [staffToDelete, setStaffToDelete] = useState(null)
  const [staffToEdit, setStaffToEdit] = useState(null)
  const [newStaff, setNewStaff] = useState({ name: '', role: '', dailyWage: '', phone: '', siteId: '', buildingId: '' })
  const [editStaff, setEditStaff] = useState({ name: '', role: '', dailyWage: '', phone: '', siteId: '', buildingId: '' })

  // Attendance editing states
  const [editingAttendance, setEditingAttendance] = useState(null)
  const [editAttendanceData, setEditAttendanceData] = useState({})

  // Custom Toast Notification
  const [toastMessage, setToastMessage] = useState({ text: '', type: 'success', visible: false })
  const showToast = (text, type = 'success') => {
    setToastMessage({ text, type, visible: true })
    setTimeout(() => setToastMessage({ text: '', type: 'success', visible: false }), 3000)
  }

  // Load real data from Firebase
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true)

        // Guard: Firestore rejects 'in []' queries; wait until sites resolve.
        if (userRole === 'supervisor' && assignedSites.length === 0) {
          console.log('⏳ Attendance: waiting for supervisor sites to resolve...')
          setLoading(false)
          return
        }

        console.log('📋 Attendance: loading for', userRole, '| sites:', assignedSites.map(s => s.name))

        const accessibleSites = userRole === 'supervisor' ? assignedSites : null
        const siteIds = accessibleSites?.map(s => s.id) || []

        // Load staff
        let staffQuery
        if (userRole === 'supervisor' && siteIds.length > 0) {
          staffQuery = query(labourCollection, where('siteId', 'in', siteIds))
        } else {
          staffQuery = labourCollection
        }
        const staffSnapshot = await getDocs(staffQuery)
        const staffData = convertDocsToArray(staffSnapshot)
        console.log('👷 Attendance: found', staffData.length, 'staff members')
        setEmployees(staffData)

        if (userRole === 'supervisor') {
          setSites(assignedSites)
        }
        // (admin sites come from the real-time listener below)

        // Load buildings (used for labour.buildingId selection)
        let buildingsQuery
        if (userRole === 'supervisor' && siteIds.length > 0) {
          buildingsQuery = query(buildingsCollection, where('siteId', 'in', siteIds))
        } else {
          buildingsQuery = buildingsCollection
        }
        const buildingsSnapshot = await getDocs(buildingsQuery)
        setBuildings(convertDocsToArray(buildingsSnapshot))

        // Load attendance
        let attendanceQuery
        if (userRole === 'supervisor' && siteIds.length > 0) {
          attendanceQuery = query(
            attendanceCollection,
            where('date', '==', selectedDate),
            where('siteId', 'in', siteIds)
          )
        } else {
          attendanceQuery = query(attendanceCollection, where('date', '==', selectedDate))
        }
        const attendanceSnapshot = await getDocs(attendanceQuery)
        const attendanceData = convertDocsToArray(attendanceSnapshot)
        setAttendance(attendanceData)

        // Check if supervisor has already submitted attendance today
        if (userRole === 'supervisor') {
          const supervisorId = currentSupervisor?.firebaseUid || currentSupervisor?.id || null
          setSubmittedToday(
            attendanceData.some(r => {
              if (r.date !== selectedDate) return false
              const submitted = !!r.submittedAt || !!r.isSubmitted
              if (!submitted) return false
              if (supervisorId && r.supervisorId === supervisorId) return true
              // Back-compat
              return r.markedBy === currentSupervisor?.email || r.markedBy === currentSupervisor?.name
            })
          )
        }

      } catch (error) {
        console.error('Error loading data:', error)
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [selectedDate, userRole, assignedSites])

  // Set up real-time listeners
  useEffect(() => {
    // Guard: don't set up listeners until sites are resolved
    if (userRole === 'supervisor' && assignedSites.length === 0) return

    const accessibleSites = userRole === 'supervisor' ? assignedSites : null
    const siteIds = accessibleSites?.map(s => s.id) || []
    const supervisorId = currentSupervisor?.firebaseUid || currentSupervisor?.id || null

    const labourQuery = userRole === 'supervisor' && siteIds.length > 0
      ? query(labourCollection, where('siteId', 'in', siteIds))
      : labourCollection

    const attendanceQuery = userRole === 'supervisor' && siteIds.length > 0
      ? query(attendanceCollection, where('date', '==', selectedDate), where('siteId', 'in', siteIds))
      : query(attendanceCollection, where('date', '==', selectedDate))

    const buildingsQuery = userRole === 'supervisor' && siteIds.length > 0
      ? query(buildingsCollection, where('siteId', 'in', siteIds))
      : buildingsCollection

    const unsubscribeLabour = onSnapshot(labourQuery, (snapshot) => {
      setEmployees(convertDocsToArray(snapshot))
    })

    const unsubscribeAttendance = onSnapshot(attendanceQuery, (snapshot) => {
      const attendanceData = convertDocsToArray(snapshot)
      setAttendance(attendanceData)

      if (userRole === 'supervisor') {
        setSubmittedToday(
          attendanceData.some(r => {
            const submitted = !!r.submittedAt || !!r.isSubmitted
            if (!submitted) return false
            if (supervisorId && r.supervisorId === supervisorId) return true
            return r.markedBy === currentSupervisor?.email || r.markedBy === currentSupervisor?.name
          })
        )
      }
    })

    const unsubscribeBuildings = onSnapshot(buildingsQuery, (snapshot) => {
      setBuildings(convertDocsToArray(snapshot))
    })

    // Admin-only: keep sites up to date via real-time listener
    // Supervisor sites come from SupervisorContext, not this listener
    const unsubscribeSites = userRole !== 'supervisor'
      ? siteServices.onSitesChange((snapshot) => { setSites(convertDocsToArray(snapshot)) })
      : null

    return () => {
      unsubscribeLabour()
      unsubscribeAttendance()
      unsubscribeBuildings()
      if (unsubscribeSites) unsubscribeSites()
    }
  }, [selectedDate, userRole, assignedSites, currentSupervisor])

  const handleAttendanceChange = async (employeeId, newStatus) => {
    const employee = employees.find(emp => emp.id === employeeId)
    if (!employee) return

    // Check if supervisor
    if (userRole === 'supervisor') {
      if (submittedToday) {
        showToast('Attendance already submitted for today. Changes are not allowed.', 'error')
        return
      }

      // Check if trying to modify existing attendance
      const existingRecord = attendance.find(record =>
        record.employeeId === employeeId &&
        record.date === selectedDate
      )

      if (existingRecord && existingRecord.status !== newStatus) {
        showToast('You cannot modify attendance after submission.', 'error')
        return
      }
    }

    try {
      const supervisorId = userRole === 'supervisor'
        ? (currentSupervisor?.firebaseUid || currentSupervisor?.id || null)
        : (currentSupervisor?.firebaseUid || null)

      const attendanceData = {
        employeeId,
        siteId: employee.siteId || null,
        buildingId: employee.buildingId || null,
        supervisorId: userRole === 'supervisor' ? supervisorId : null,
        date: selectedDate,
        status: newStatus,
        checkIn: newStatus === 'present' ? new Date().toTimeString().slice(0, 5) : null,
        checkOut: newStatus === 'present' ? '17:30' : null,
        updatedAt: new Date().toISOString()
      };

      // Check if attendance record already exists
      const existingRecord = attendance.find(record =>
        record.employeeId === employeeId && record.date === selectedDate
      );

      if (existingRecord) {
        // Update existing record
        await attendanceServices.updateAttendance(existingRecord.id, attendanceData);
      } else {
        // Create new record using addAttendance
        await attendanceServices.addAttendance({
          ...attendanceData,
          createdAt: new Date().toISOString()
        });
      }
    } catch (error) {
      console.error('Error updating attendance:', error);
      showToast('Error updating attendance. Please try again.', 'error');
    }
  }

  const submitAttendance = async () => {
    if (userRole === 'supervisor') {
      try {
        const supervisorId = currentSupervisor?.firebaseUid || currentSupervisor?.id || null
        // Mark all attendance records as submitted by supervisor
        const todayAttendance = attendance.filter(record => record.date === selectedDate)

        for (const record of todayAttendance) {
          await attendanceServices.updateAttendance(record.id, {
            ...record,
            supervisorId: record.supervisorId || supervisorId,
            submittedAt: new Date().toISOString(),
            submittedBy: supervisorId,
            updatedAt: new Date().toISOString()
          })
        }

        setSubmittedToday(true)
        showToast('Attendance submitted successfully!')
      } catch (error) {
        console.error('Error submitting attendance:', error)
        showToast('Error submitting attendance. Please try again.', 'error')
      }
    }
  }

  const markAllPresent = () => {
    if (userRole === 'supervisor' && submittedToday) {
      showToast('Attendance already submitted for today. Changes are not allowed.', 'error')
      return
    }
    employees.forEach(employee => {
      // If supervisor, only mark for their assigned sites
      if (userRole === 'supervisor' && (!employee.siteId || !currentSupervisor?.assignedSites?.some(site => site.id === employee.siteId))) return
      handleAttendanceChange(employee.id, 'present')
    })
  }

  const markAllAbsent = () => {
    if (userRole === 'supervisor' && submittedToday) {
      showToast('Attendance already submitted for today. Changes are not allowed.', 'error')
      return
    }
    employees.forEach(employee => {
      if (userRole === 'supervisor' && (!employee.siteId || !currentSupervisor?.assignedSites?.some(site => site.id === employee.siteId))) return
      handleAttendanceChange(employee.id, 'absent')
    })
  }

  const getAttendanceStats = () => {
    let todayRecords = attendance.filter(record => record.date === selectedDate)

    // Admin filtering by site
    if (userRole === 'admin' && selectedSiteFilter !== 'all') {
      todayRecords = todayRecords.filter(record => record.siteId === selectedSiteFilter)
    }

    const present = todayRecords.filter(record => record.status === 'present').length
    const absent = todayRecords.filter(record => record.status === 'absent').length
    const total = employees.filter(emp => {
      let matchesSite = true;
      if (userRole === 'supervisor') {
        matchesSite = emp.siteId && assignedSites.some(site => site.id === emp.siteId);
      } else if (userRole === 'admin' && selectedSiteFilter !== 'all') {
        matchesSite = emp.siteId === selectedSiteFilter;
      }
      return matchesSite;
    }).length; // Total employees to calculate correct percentage based on staff count, not marked records. However, earlier it was total = todayRecords.length. Let's stick with todayRecords.length for consistency.

    const finalTotal = todayRecords.length;
    return { present, absent, total: finalTotal, percentage: finalTotal > 0 ? (present / finalTotal * 100).toFixed(1) : 0 }
  }

  // Staff Management Functions
  const handleAddStaff = async () => {
    try {
      // Generate unique number ID for the staff member
      const uniqueNumber = Date.now() + Math.floor(Math.random() * 1000)

      const staffData = {
        ...newStaff,
        employeeCode: uniqueNumber.toString(),
        joinDate: new Date().toISOString().split('T')[0],
        dailyWage: newStaff.dailyWage ? parseFloat(newStaff.dailyWage) : 0,
        createdAt: new Date().toISOString(),
        createdBy: userRole,
        status: 'active'
      }

      await labourServices.addLabour(staffData)
      setNewStaff({ name: '', role: '', dailyWage: '', phone: '', siteId: '', buildingId: '' })
      setShowAddStaffModal(false)
      showToast('Staff added successfully!')
    } catch (error) {
      console.error('Error adding staff:', error)
      showToast('Error adding staff. Please try again.', 'error')
    }
  }

  const handleEditStaff = async () => {
    try {
      const staffData = {
        ...editStaff,
        dailyWage: editStaff.dailyWage ? parseFloat(editStaff.dailyWage) : 0,
        updatedAt: new Date().toISOString(),
        updatedBy: userRole
      }

      await labourServices.updateLabour(staffToEdit.id, staffData)
      setShowEditStaffModal(false)
      setStaffToEdit(null)
      setEditStaff({ name: '', role: '', dailyWage: '', phone: '', siteId: '', buildingId: '' })
      showToast('Staff updated successfully!')
    } catch (error) {
      console.error('Error updating staff:', error)
      showToast('Error updating staff. Please try again.', 'error')
    }
  }

  const handleDeleteStaff = async () => {
    try {
      await labourServices.deleteLabour(staffToDelete.id)
      setShowDeleteConfirm(false)
      setStaffToDelete(null)
      showToast('Staff deleted successfully!')
    } catch (error) {
      console.error('Error deleting staff:', error)
      showToast('Error deleting staff. Please try again.', 'error')
    }
  }

  const openEditStaffModal = (staff) => {
    setStaffToEdit(staff)
    setEditStaff({
      name: staff.name,
      role: staff.role,
      dailyWage: staff.dailyWage.toString(),
      phone: staff.phone || '',
      siteId: staff.siteId || '',
      buildingId: staff.buildingId || ''
    })
    setShowEditStaffModal(true)
  }

  // Attendance Editing Functions
  const handleEditAttendance = (attendanceRecord) => {
    setEditingAttendance(attendanceRecord)
    setEditAttendanceData({
      status: attendanceRecord.status,
      checkIn: attendanceRecord.checkIn,
      checkOut: attendanceRecord.checkOut
    })
  }

  const handleSaveAttendanceEdit = async () => {
    try {
      await attendanceServices.updateAttendance(editingAttendance.id, {
        ...editingAttendance,
        ...editAttendanceData,
        updatedAt: new Date().toISOString()
      })

      setEditingAttendance(null)
      setEditAttendanceData({})
      showToast('Attendance updated successfully!')
    } catch (error) {
      console.error('Error updating attendance:', error)
      showToast('Error updating attendance. Please try again.', 'error')
    }
  }

  const handleDeleteAttendance = async (attendanceId) => {
    try {
      await attendanceServices.deleteAttendance(attendanceId)
      showToast('Attendance deleted successfully!')
    } catch (error) {
      console.error('Error deleting attendance:', error)
      showToast('Error deleting attendance. Please try again.', 'error')
    }
  }

  const filteredEmployees = employees.filter(employee => {
    const attendanceRecord = attendance.find(record =>
      record.employeeId === employee.id && record.date === selectedDate
    )
    const status = attendanceRecord?.status || 'not-marked'

    // Get site name from sites data
    const siteName = sites.find(site => site.id === employee.siteId)?.name || 'Unassigned'

    const matchesSearch = employee.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      siteName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      employee.role.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesFilter = filterStatus === 'all' || status === filterStatus

    // Filter by assigned sites for supervisors, or selected site for admin
    let matchesSite = true;
    if (userRole === 'supervisor') {
      matchesSite = employee.siteId && assignedSites.some(site => site.id === employee.siteId);
    } else if (userRole === 'admin' && selectedSiteFilter !== 'all') {
      matchesSite = employee.siteId === selectedSiteFilter;
    }

    return matchesSearch && matchesFilter && matchesSite
  }).map(employee => ({
    ...employee,
    site: sites.find(site => site.id === employee.siteId)?.name || 'Unassigned'
  }))

  const stats = getAttendanceStats()

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-3 text-gray-600">Loading attendance...</span>
      </div>
    )
  }

  // Supervisor has no sites assigned at all
  if (userRole === 'supervisor' && assignedSites.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center p-6">
        <div className="text-5xl mb-4">🏗️</div>
        <h2 className="text-xl font-bold text-gray-800 mb-2">No Sites Assigned</h2>
        <p className="text-gray-500 max-w-md">
          You don't have any sites assigned yet. Please ask your admin to assign a site to you from <strong>Site Management</strong>.
        </p>
      </div>
    )
  }

  // Supervisor has sites but no staff assigned to those sites
  if (userRole === 'supervisor' && assignedSites.length > 0 && employees.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center p-6">
        <div className="text-5xl mb-4">👷</div>
        <h2 className="text-xl font-bold text-gray-800 mb-2">No Workers Assigned to Your Sites</h2>
        <p className="text-gray-500 max-w-md">
          Your site (<strong>{assignedSites.map(s => s.name).join(', ')}</strong>) has no workers assigned yet.
          Ask your admin to go to <strong>Site Management → Edit Site → Assign Staff</strong> and add workers.
        </p>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6 relative">
      <AnimatePresence>
        {toastMessage.visible && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className={`fixed bottom-8 right-8 z-[100] px-5 py-3 rounded-xl shadow-xl flex items-center gap-3 text-white ${toastMessage.type === 'error' ? 'bg-red-600' : 'bg-gray-800'
              }`}
          >
            {toastMessage.type === 'error' ? <XCircle className="w-5 h-5" /> : <CheckCircle className="w-5 h-5 text-green-400" />}
            <span className="font-medium tracking-wide text-sm">{toastMessage.text}</span>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Attendance Management</h1>
          <p className="text-gray-600">Track daily attendance - Present or Absent</p>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1 }}
          className="bg-white rounded-xl shadow-sm p-4 border border-gray-200"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Employees</p>
              <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
            </div>
            <Users className="w-8 h-8 text-blue-500" />
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2 }}
          className="bg-white rounded-xl shadow-sm p-4 border border-gray-200"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Present</p>
              <p className="text-2xl font-bold text-green-600">{stats.present}</p>
            </div>
            <CheckCircle className="w-8 h-8 text-green-500" />
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.3 }}
          className="bg-white rounded-xl shadow-sm p-4 border border-gray-200"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Absent</p>
              <p className="text-2xl font-bold text-red-600">{stats.absent}</p>
            </div>
            <XCircle className="w-8 h-8 text-red-500" />
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.4 }}
          className="bg-white rounded-xl shadow-sm p-4 border border-gray-200"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Attendance Rate</p>
              <p className="text-2xl font-bold text-blue-600">{stats.percentage}%</p>
            </div>
            <TrendingUp className="w-8 h-8 text-blue-500" />
          </div>
        </motion.div>
      </div>

      {/* Quick Actions */}
      {(userRole === 'admin' || userRole === 'supervisor') && (
        <div className="flex flex-wrap gap-3 mb-6">
          {userRole === 'admin' && (
            <>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setShowAddStaffModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-medium"
              >
                <UserPlus className="w-4 h-4" />
                Add Staff
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={markAllPresent}
                className="flex items-center gap-2 px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg font-medium"
              >
                <Check className="w-4 h-4" />
                Mark All Present
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={markAllAbsent}
                className="flex items-center gap-2 px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg font-medium"
              >
                <X className="w-4 h-4" />
                Mark All Absent
              </motion.button>
            </>
          )}
          {userRole === 'supervisor' && !submittedToday && (
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={submitAttendance}
              className="flex items-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-medium"
            >
              <Check className="w-4 h-4" />
              Submit Attendance
            </motion.button>
          )}
          {userRole === 'supervisor' && submittedToday && (
            <div className="flex items-center gap-2 px-4 py-2 bg-gray-300 text-gray-600 rounded-lg font-medium">
              <Check className="w-4 h-4" />
              Attendance Submitted
            </div>
          )}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-4 mb-6">
        <div className="flex-1">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search by name or site..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>
        {userRole === 'admin' && (
          <div className="md:w-64">
            <select
              value={selectedSiteFilter}
              onChange={(e) => setSelectedSiteFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Sites</option>
              {sites.map(site => (
                <option key={site.id} value={site.id}>{site.name}</option>
              ))}
            </select>
          </div>
        )}
        <div className="flex gap-2">
          <button
            onClick={() => setFilterStatus('all')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${filterStatus === 'all'
              ? 'bg-blue-500 text-white'
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
          >
            All
          </button>
          <button
            onClick={() => setFilterStatus('present')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${filterStatus === 'present'
              ? 'bg-green-500 text-white'
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
          >
            Present
          </button>
          <button
            onClick={() => setFilterStatus('absent')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${filterStatus === 'absent'
              ? 'bg-red-500 text-white'
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
          >
            Absent
          </button>
        </div>
      </div>

      {/* Attendance List */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left py-3 px-4 font-semibold text-gray-700">Employee</th>
                <th className="text-left py-3 px-4 font-semibold text-gray-700 hidden sm:table-cell">Site</th>
                <th className="text-left py-3 px-4 font-semibold text-gray-700 hidden sm:table-cell">Role</th>
                <th className="text-left py-3 px-4 font-semibold text-gray-700">Status</th>
                <th className="text-left py-3 px-4 font-semibold text-gray-700">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredEmployees.map((employee, index) => {
                const attendanceRecord = attendance.find(record =>
                  record.employeeId === employee.id && record.date === selectedDate
                )
                const status = attendanceRecord?.status || 'not-marked'

                return (
                  <motion.tr
                    key={employee.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className="border-t border-gray-200 hover:bg-gray-50"
                  >
                    <td className="py-3 px-4">
                      <div>
                        <p className="font-medium text-gray-900">{employee.name}</p>
                        <p className="text-xs text-gray-500">ID: {employee.id}</p>
                        <p className="text-sm text-gray-600 sm:hidden">{employee.site}</p>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-gray-600 hidden sm:table-cell">{employee.site}</td>
                    <td className="py-3 px-4 text-gray-600 hidden sm:table-cell">{employee.role}</td>
                    <td className="py-3 px-4">
                      {status === 'present' && (
                        <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 rounded-full text-sm font-medium">
                          <CheckCircle className="w-4 h-4" />
                          Present
                        </span>
                      )}
                      {status === 'absent' && (
                        <span className="inline-flex items-center gap-1 px-2 py-1 bg-red-100 text-red-700 rounded-full text-sm font-medium">
                          <XCircle className="w-4 h-4" />
                          Absent
                        </span>
                      )}
                      {status === 'not-marked' && (
                        <span className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 text-gray-700 rounded-full text-sm font-medium">
                          <Clock className="w-4 h-4" />
                          Not Marked
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex gap-2">
                        {/* Attendance Actions */}
                        <motion.button
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={() => handleAttendanceChange(employee.id, 'present')}
                          className={`px-3 py-2 rounded-lg transition-colors text-sm font-medium ${status === 'present'
                            ? 'bg-green-500 text-white'
                            : 'bg-gray-200 text-gray-700 hover:bg-green-100'
                            } ${userRole === 'supervisor' && submittedToday ? 'opacity-50 cursor-not-allowed' : ''}`}
                          title="Mark Present"
                          disabled={userRole === 'supervisor' && submittedToday}
                        >
                          P
                        </motion.button>
                        <motion.button
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={() => handleAttendanceChange(employee.id, 'absent')}
                          className={`px-3 py-2 rounded-lg transition-colors text-sm font-medium ${status === 'absent'
                            ? 'bg-red-500 text-white'
                            : 'bg-gray-200 text-gray-700 hover:bg-red-100'
                            } ${userRole === 'supervisor' && submittedToday ? 'opacity-50 cursor-not-allowed' : ''}`}
                          title="Mark Absent"
                          disabled={userRole === 'supervisor' && submittedToday}
                        >
                          A
                        </motion.button>

                        {/* Staff Management (Admin Only) */}
                        {userRole === 'admin' && (
                          <div className="flex gap-1 border-l pl-2 ml-2">
                            <motion.button
                              whileHover={{ scale: 1.05 }}
                              whileTap={{ scale: 0.95 }}
                              onClick={() => openEditStaffModal(employee)}
                              className="p-2 rounded-lg bg-blue-500 text-white hover:bg-blue-600 transition-colors"
                              title="Edit Staff"
                            >
                              <Edit2 className="w-4 h-4" />
                            </motion.button>
                            <motion.button
                              whileHover={{ scale: 1.05 }}
                              whileTap={{ scale: 0.95 }}
                              onClick={() => {
                                setStaffToDelete(employee)
                                setShowDeleteConfirm(true)
                              }}
                              className="p-2 rounded-lg bg-red-500 text-white hover:bg-red-600 transition-colors"
                              title="Delete Staff"
                            >
                              <Trash2 className="w-4 h-4" />
                            </motion.button>
                          </div>
                        )}
                      </div>
                    </td>
                  </motion.tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Staff Modal */}
      {showAddStaffModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-semibold mb-4">Add New Staff</h3>
            <div className="space-y-4">
              <input
                type="text"
                placeholder="Name"
                value={newStaff.name}
                onChange={(e) => setNewStaff({ ...newStaff, name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <input
                type="text"
                placeholder="Role"
                value={newStaff.role}
                onChange={(e) => setNewStaff({ ...newStaff, role: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <input
                type="number"
                placeholder="Salary"
                value={newStaff.dailyWage}
                onChange={(e) => setNewStaff({ ...newStaff, dailyWage: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <input
                type="text"
                placeholder="Phone"
                value={newStaff.phone}
                onChange={(e) => setNewStaff({ ...newStaff, phone: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Select Site</label>
              <select
                value={newStaff.siteId}
                onChange={(e) => setNewStaff({ ...newStaff, siteId: e.target.value, buildingId: '' })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select Site</option>
                {sites.map(site => (
                  <option key={site.id} value={site.id}>{site.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Select Building</label>
              <select
                value={newStaff.buildingId}
                onChange={(e) => setNewStaff({ ...newStaff, buildingId: e.target.value })}
                disabled={!newStaff.siteId}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
              >
                <option value="">Select Building</option>
                {buildings
                  .filter(b => b.siteId === newStaff.siteId)
                  .map(b => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
              </select>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={handleAddStaff}
                className="flex-1 bg-blue-500 text-white py-2 rounded-lg hover:bg-blue-600 transition-colors"
              >
                Add Staff
              </button>
              <button
                onClick={() => setShowAddStaffModal(false)}
                className="flex-1 bg-gray-200 text-gray-700 py-2 rounded-lg hover:bg-gray-300 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Staff Modal */}
      {showEditStaffModal && staffToEdit && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-semibold mb-4">Edit Staff</h3>
            <div className="space-y-4">
              <input
                type="text"
                placeholder="Name"
                value={editStaff.name}
                onChange={(e) => setEditStaff({ ...editStaff, name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <input
                type="text"
                placeholder="Role"
                value={editStaff.role}
                onChange={(e) => setEditStaff({ ...editStaff, role: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <input
                type="number"
                placeholder="Salary"
                value={editStaff.dailyWage}
                onChange={(e) => setEditStaff({ ...editStaff, dailyWage: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <input
                type="text"
                placeholder="Phone"
                value={editStaff.phone}
                onChange={(e) => setEditStaff({ ...editStaff, phone: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <select
                value={editStaff.siteId}
                onChange={(e) => setEditStaff({ ...editStaff, siteId: e.target.value, buildingId: '' })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select Site</option>
                {sites.map(site => (
                  <option key={site.id} value={site.id}>{site.name}</option>
                ))}
              </select>
              <select
                value={editStaff.buildingId}
                onChange={(e) => setEditStaff({ ...editStaff, buildingId: e.target.value })}
                disabled={!editStaff.siteId}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
              >
                <option value="">Select Building</option>
                {buildings
                  .filter(b => b.siteId === editStaff.siteId)
                  .map(b => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
              </select>

            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={handleEditStaff}
                className="flex-1 bg-blue-500 text-white py-2 rounded-lg hover:bg-blue-600 transition-colors"
              >
                Update Staff
              </button>
              <button
                onClick={() => setShowEditStaffModal(false)}
                className="flex-1 bg-gray-200 text-gray-700 py-2 rounded-lg hover:bg-gray-300 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && staffToDelete && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-sm mx-4">
            <h3 className="text-lg font-semibold mb-4">Delete Staff</h3>
            <p className="text-gray-600 mb-6">
              Are you sure you want to delete {staffToDelete.name}? This action cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={handleDeleteStaff}
                className="flex-1 bg-red-500 text-white py-2 rounded-lg hover:bg-red-600 transition-colors"
              >
                Delete
              </button>
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 bg-gray-200 text-gray-700 py-2 rounded-lg hover:bg-gray-300 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Attendance Modal */}
      {editingAttendance && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-semibold mb-4">Edit Attendance</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                <select
                  value={editAttendanceData.status}
                  onChange={(e) => setEditAttendanceData({ ...editAttendanceData, status: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="present">Present</option>
                  <option value="absent">Absent</option>
                  <option value="leave">Leave</option>
                </select>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={handleSaveAttendanceEdit}
                className="flex-1 bg-blue-500 text-white py-2 rounded-lg hover:bg-blue-600 transition-colors"
              >
                Save Changes
              </button>
              <button
                onClick={() => setEditingAttendance(null)}
                className="flex-1 bg-gray-200 text-gray-700 py-2 rounded-lg hover:bg-gray-300 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <Footer />
    </div>
  )
}

export default AttendanceSimple
