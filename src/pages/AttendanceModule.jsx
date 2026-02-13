import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Calendar, Users, DollarSign, CheckCircle, XCircle, Clock, Download, Plus, UserPlus, MapPin, Edit2, Save, X } from 'lucide-react'
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay } from 'date-fns'
import { labourServices, attendanceServices, siteServices, buildingServices, convertDocsToArray } from '../services/firebaseServices'

const AttendanceModule = ({ userRole }) => {
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [attendance, setAttendance] = useState([])
  const [labourList, setLabourList] = useState([])
  const [sites, setSites] = useState([])
  const [buildings, setBuildings] = useState([])
  const [showSummary, setShowSummary] = useState(false)
  const [showAddStaffModal, setShowAddStaffModal] = useState(false)
  const [newStaff, setNewStaff] = useState({ name: '', role: '', dailyWage: '', phone: '' })
  const [searchTerm, setSearchTerm] = useState('')
  const [loading, setLoading] = useState(true)

  // Load data from Firebase on component mount
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true)
        
        // Load labour
        const labourSnapshot = await labourServices.getAllLabour()
        setLabourList(convertDocsToArray(labourSnapshot))
        
        // Load attendance for selected date
        const dateStr = format(selectedDate, 'yyyy-MM-dd')
        const attendanceSnapshot = await attendanceServices.getAttendanceByDate(dateStr)
        setAttendance(convertDocsToArray(attendanceSnapshot))
        
        // Load sites
        const sitesSnapshot = await siteServices.getAllSites()
        setSites(convertDocsToArray(sitesSnapshot))
        
        // Load buildings
        const buildingsSnapshot = await buildingServices.getAllBuildings()
        setBuildings(convertDocsToArray(buildingsSnapshot))
        
      } catch (error) {
        console.error('Error loading data:', error)
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [selectedDate])

  // Set up real-time listeners
  useEffect(() => {
    const unsubscribeLabour = labourServices.onLabourChange((snapshot) => {
      setLabourList(convertDocsToArray(snapshot))
    })

    const unsubscribeAttendance = attendanceServices.onAttendanceChange((snapshot) => {
      const dateStr = format(selectedDate, 'yyyy-MM-dd')
      const filteredAttendance = convertDocsToArray(snapshot).filter(a => a.date === dateStr)
      setAttendance(filteredAttendance)
    })

    const unsubscribeSites = siteServices.onSitesChange((snapshot) => {
      setSites(convertDocsToArray(snapshot))
    })

    const unsubscribeBuildings = buildingServices.onBuildingsChange((snapshot) => {
      setBuildings(convertDocsToArray(snapshot))
    })

    return () => {
      unsubscribeLabour()
      unsubscribeAttendance()
      unsubscribeSites()
      unsubscribeBuildings()
    }
  }, [selectedDate])

  const getFilteredLabourList = () => {
    const sorted = getSortedLabourList()
    if (!searchTerm) return sorted
    return sorted.filter(labour => 
      labour.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      labour.role.toLowerCase().includes(searchTerm.toLowerCase())
    )
  }

  const getSortedLabourList = () => {
    return [...labourList].sort((a, b) => a.name.localeCompare(b.name))
  }

  const getBuildingsForSite = (siteName) => {
    const site = sites.find(s => s.name === siteName)
    if (!site) return []
    return buildings.filter(b => b.siteId === site.id)
  }

  const handleMarkAttendance = async (labourId, status) => {
    try {
      const dateStr = format(selectedDate, 'yyyy-MM-dd')
      
      // First check if attendance already exists for this labour and date
      const existingSnapshot = await attendanceServices.getAttendanceByLabourAndDate(labourId, dateStr)
      const existingData = convertDocsToArray(existingSnapshot)
      
      const attendanceData = {
        labourId,
        date: dateStr,
        status,
        checkInTime: status === 'Present' ? '09:00' : null,
        checkOutTime: status === 'Present' ? '17:00' : null,
        notes: status === 'Leave' ? 'Leave' : '',
        createdAt: new Date().toISOString()
      }
      
      if (existingData.length > 0) {
        // Update existing record
        await attendanceServices.updateAttendance(existingData[0].id, attendanceData)
      } else {
        // Add new record
        await attendanceServices.addAttendance(attendanceData)
      }
    } catch (error) {
      console.error('Error marking attendance:', error)
    }
  }

  const getAttendanceStatus = (labourId) => {
    const dateStr = format(selectedDate, 'yyyy-MM-dd')
    const record = attendance.find(a => a.labourId === labourId && a.date === dateStr)
    return record?.status || 'unmarked'
  }

  const calculateMonthlySalary = (labourId) => {
    const labour = labourList.find(l => l.id === labourId)
    if (!labour) return 0

    const monthStart = startOfMonth(selectedDate)
    const monthEnd = endOfMonth(selectedDate)

    const presentDays = attendance.filter(a => {
      const recordDate = new Date(a.date)
      return a.labourId === labourId && 
             a.status === 'Present' &&
             recordDate >= monthStart && 
             recordDate <= monthEnd
    }).length

    return presentDays * labour.dailyWage
  }

  const handleAddStaff = async () => {
    if (newStaff.name && newStaff.role && newStaff.phone) {
      try {
        const staff = {
          name: newStaff.name,
          role: newStaff.role,
          phone: newStaff.phone,
          dailyWage: parseInt(newStaff.dailyWage) || 0,
          joinDate: format(new Date(), 'yyyy-MM-dd'),
          currentSite: 'Not Assigned',
          createdAt: new Date().toISOString()
        }
        await labourServices.addLabour(staff)
        setNewStaff({ name: '', role: '', dailyWage: '', phone: '' })
        setShowAddStaffModal(false)
      } catch (error) {
        console.error('Error adding staff:', error)
      }
    }
  }

  const handleSiteChange = async (labourId, newSite) => {
    try {
      const staff = labourList.find(s => s.id === labourId)
      if (staff) {
        await labourServices.updateLabour(labourId, {
          ...staff,
          currentSite: newSite,
          currentBuilding: '' // Reset building when site changes
        })
      }
    } catch (error) {
      console.error('Error updating site:', error)
    }
  }

  const handleBuildingChange = async (labourId, newBuilding) => {
    try {
      const staff = labourList.find(s => s.id === labourId)
      if (staff) {
        await labourServices.updateLabour(labourId, {
          ...staff,
          currentBuilding: newBuilding
        })
      }
    } catch (error) {
      console.error('Error updating building:', error)
    }
  }

  const getTodayStats = () => {
    const dateStr = format(selectedDate, 'yyyy-MM-dd')
    const todayRecords = attendance.filter(a => a.date === dateStr)
    const present = todayRecords.filter(a => a.status === 'Present').length
    const absent = todayRecords.filter(a => a.status === 'Absent').length
    const leave = todayRecords.filter(a => a.status === 'Leave').length
    const unmarked = labourList.length - todayRecords.length

    return { present, absent, leave, unmarked, total: labourList.length }
  }

  const stats = getTodayStats()

  const getStatusColor = (status) => {
    switch (status) {
      case 'Present': return 'bg-green-100 text-green-700 border-green-200'
      case 'Absent': return 'bg-red-100 text-red-700 border-red-200'
      case 'Leave': return 'bg-yellow-100 text-yellow-700 border-yellow-200'
      default: return 'bg-gray-100 text-gray-700 border-gray-200'
    }
  }

  return (
    <div className="p-6 space-y-6">
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          <span className="ml-3 text-gray-600">Loading attendance data...</span>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Attendance Module</h1>
              <p className="text-gray-600 mt-1">Mark and manage daily labour attendance</p>
            </div>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setShowAddStaffModal(true)}
              className="btn-primary flex items-center gap-2"
            >
              <UserPlus className="w-5 h-5" />
              Add Staff
            </motion.button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="card bg-blue-50 border-blue-200"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-blue-600 mb-1">Total Labour</p>
                  <h3 className="text-3xl font-bold text-blue-900">{stats.total}</h3>
                </div>
                <Users className="w-10 h-10 text-blue-500" />
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="card bg-green-50 border-green-200"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-green-600 mb-1">Present</p>
                  <h3 className="text-3xl font-bold text-green-900">{stats.present}</h3>
                </div>
                <CheckCircle className="w-10 h-10 text-green-500" />
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="card bg-red-50 border-red-200"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-red-600 mb-1">Absent</p>
                  <h3 className="text-3xl font-bold text-red-900">{stats.absent}</h3>
                </div>
                <XCircle className="w-10 h-10 text-red-500" />
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="card bg-yellow-50 border-yellow-200"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-yellow-600 mb-1">On Leave</p>
                  <h3 className="text-3xl font-bold text-yellow-900">{stats.leave}</h3>
                </div>
                <Clock className="w-10 h-10 text-yellow-500" />
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="card bg-gray-50 border-gray-200"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 mb-1">Unmarked</p>
                  <h3 className="text-3xl font-bold text-gray-900">{stats.unmarked}</h3>
                </div>
                <Calendar className="w-10 h-10 text-gray-500" />
              </div>
            </motion.div>
          </div>

          <div className="card">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between mb-6 gap-4">
              <h2 className="text-xl font-semibold text-gray-900">Select Date</h2>
              <div className="flex flex-col sm:flex-row gap-4">
                <input
                  type="date"
                  value={format(selectedDate, 'yyyy-MM-dd')}
                  onChange={(e) => setSelectedDate(new Date(e.target.value))}
                  className="input-field w-full sm:w-auto"
                />
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Search staff by name or role..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="input-field w-full sm:w-64 pl-10"
                  />
                  <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </div>
                </div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">ID</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Name</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Role</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Current Site</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Current Building</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Status</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {getFilteredLabourList().map((labour, index) => {
                    const status = getAttendanceStatus(labour.id)
                    return (
                      <motion.tr
                        key={labour.id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.05 }}
                        className="border-t border-gray-200 hover:bg-gray-50"
                      >
                        <td className="py-3 px-4 text-gray-900">{index + 1}</td>
                        <td className="py-3 px-4 font-medium text-gray-900">{labour.name}</td>
                        <td className="py-3 px-4 text-gray-600">{labour.role}</td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <MapPin className="w-4 h-4 text-gray-400" />
                            <select
                              value={labour.currentSite || 'Not Assigned'}
                              onChange={(e) => handleSiteChange(labour.id, e.target.value)}
                              className={`px-2 py-1 border border-gray-300 rounded focus:outline-none focus:border-primary text-sm ${
                                labour.currentSite === 'Not Assigned' || !labour.currentSite
                                  ? 'text-gray-400 italic' 
                                  : 'text-gray-700'
                              }`}
                            >
                              <option value="Not Assigned">Not Assigned</option>
                              {sites.map(site => (
                                <option key={site.id} value={site.name}>
                                  {site.name}
                                </option>
                              ))}
                            </select>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <div className="w-4 h-4 bg-gray-300 rounded"></div>
                            <select
                              value={labour.currentBuilding || 'Not Assigned'}
                              onChange={(e) => handleBuildingChange(labour.id, e.target.value)}
                              disabled={!labour.currentSite || labour.currentSite === 'Not Assigned'}
                              className={`px-2 py-1 border border-gray-300 rounded focus:outline-none focus:border-primary text-sm ${
                                !labour.currentSite || labour.currentSite === 'Not Assigned'
                                  ? 'text-gray-300 italic cursor-not-allowed' 
                                  : labour.currentBuilding === 'Not Assigned' || !labour.currentBuilding
                                    ? 'text-gray-400 italic'
                                    : 'text-gray-700'
                              }`}
                            >
                              <option value="Not Assigned">Not Assigned</option>
                              {getBuildingsForSite(labour.currentSite).map(building => (
                                <option key={building.id} value={building.name}>
                                  {building.name}
                                </option>
                              ))}
                            </select>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <span className={`badge border ${getStatusColor(status)}`}>
                            {status === 'unmarked' ? 'Not Marked' : status}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex gap-2">
                            <motion.button
                              whileHover={{ scale: 1.1 }}
                              whileTap={{ scale: 0.9 }}
                              onClick={() => handleMarkAttendance(labour.id, 'Present')}
                              className="p-2 bg-green-100 text-green-600 rounded-lg hover:bg-green-200 transition-colors"
                              title="Mark Present"
                            >
                              <CheckCircle className="w-5 h-5" />
                            </motion.button>
                            <motion.button
                              whileHover={{ scale: 1.1 }}
                              whileTap={{ scale: 0.9 }}
                              onClick={() => handleMarkAttendance(labour.id, 'Absent')}
                              className="p-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 transition-colors"
                              title="Mark Absent"
                            >
                              <XCircle className="w-5 h-5" />
                            </motion.button>
                            <motion.button
                              whileHover={{ scale: 1.1 }}
                              whileTap={{ scale: 0.9 }}
                              onClick={() => handleMarkAttendance(labour.id, 'Leave')}
                              className="p-2 bg-yellow-100 text-yellow-600 rounded-lg hover:bg-yellow-200 transition-colors"
                              title="Mark Leave"
                            >
                              <Clock className="w-5 h-5" />
                            </motion.button>
                          </div>
                        </td>
                      </motion.tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {showSummary && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="card"
            >
              <h2 className="text-xl font-semibold text-gray-900 mb-4">
                Monthly Salary Summary - {format(selectedDate, 'MMMM yyyy')}
              </h2>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-gray-50">
                      <th className="text-left py-3 px-4 font-semibold text-gray-700">Name</th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-700">Role</th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-700">Days Present</th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-700">Monthly Salary</th>
                    </tr>
                  </thead>
                  <tbody>
                    {labourList.map((labour) => {
                      const monthStart = startOfMonth(selectedDate)
                      const monthEnd = endOfMonth(selectedDate)
                      const presentDays = attendance.filter(a => {
                        const recordDate = new Date(a.date)
                        return a.labourId === labour.id && 
                               a.status === 'Present' &&
                               recordDate >= monthStart && 
                               recordDate <= monthEnd
                      }).length
                      const monthlySalary = calculateMonthlySalary(labour.id)

                      return (
                        <tr key={labour.id} className="border-t border-gray-200">
                          <td className="py-3 px-4 font-medium text-gray-900">{labour.name}</td>
                          <td className="py-3 px-4 text-gray-600">{labour.role}</td>
                          <td className="py-3 px-4 text-gray-900">{presentDays}</td>
                          <td className="py-3 px-4 font-semibold text-green-600">${monthlySalary}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="bg-gray-50 font-semibold">
                      <td colSpan="3" className="py-3 px-4 text-right text-gray-900">Total Monthly Payroll:</td>
                      <td className="py-3 px-4 text-green-600 text-lg">
                        ${labourList.reduce((sum, labour) => sum + calculateMonthlySalary(labour.id), 0)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </motion.div>
          )}

          {/* Add Staff Modal */}
          {showAddStaffModal && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
              onClick={() => setShowAddStaffModal(false)}
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="bg-white rounded-lg p-6 w-full max-w-md"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">Add New Staff</h3>
                  <button
                    onClick={() => setShowAddStaffModal(false)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                    <input
                      type="text"
                      placeholder="Enter full name"
                      value={newStaff.name}
                      onChange={(e) => setNewStaff({ ...newStaff, name: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-primary"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                    <input
                      type="text"
                      placeholder="Enter role"
                      value={newStaff.role}
                      onChange={(e) => setNewStaff({ ...newStaff, role: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-primary"
                    />
                  </div>
              
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
                    <input
                      type="tel"
                      placeholder="Enter phone number"
                      value={newStaff.phone}
                      onChange={(e) => setNewStaff({ ...newStaff, phone: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-primary"
                    />
                  </div>
                </div>
                
                <div className="flex gap-3 mt-6">
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={handleAddStaff}
                    disabled={!newStaff.name || !newStaff.role || !newStaff.phone}
                    className={`flex-1 py-2 rounded-lg font-medium transition-all ${
                      newStaff.name && newStaff.role && newStaff.phone
                        ? 'bg-primary text-white hover:bg-primary-dark'
                        : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                    }`}
                  >
                    Add Staff
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => {
                      setShowAddStaffModal(false)
                      setNewStaff({ name: '', role: '', dailyWage: '', phone: '' })
                    }}
                    className="flex-1 bg-gray-200 text-gray-700 py-2 rounded-lg font-medium hover:bg-gray-300 transition-all"
                  >
                    Cancel
                  </motion.button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </>
      )}
    </div>
  )
}

export default AttendanceModule
