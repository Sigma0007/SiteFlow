import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
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
  UserPlus,
  ArrowLeft
} from 'lucide-react'
import { labourServices, attendanceServices, siteServices, buildingServices, convertDocsToArray, query, where, getDocs, labourCollection, attendanceCollection, buildingsCollection } from '../services/firebaseServices'
import { onSnapshot } from 'firebase/firestore'
import { useSupervisor } from '../contexts/SupervisorContext.jsx'
import Footer from '../components/Footer'

const AttendanceSimple = ({ userRole = 'admin' }) => {
  const navigate = useNavigate()
  const { currentSupervisor, assignedSites } = useSupervisor()
  const [attendance, setAttendance] = useState([])
  const [employees, setEmployees] = useState([])
  const [sites, setSites] = useState([])
  const [buildings, setBuildings] = useState([])
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0])
  const [searchTerm, setSearchTerm] = useState('')
  const [filterStatus, setFilterStatus] = useState('all')
  const [selectedSiteFilter, setSelectedSiteFilter] = useState('all')
  const [workerTypeFilter, setWorkerTypeFilter] = useState('all')
  const [loading, setLoading] = useState(true)
  const [submittedToday, setSubmittedToday] = useState(false)

  // Staff management states
  const [showAddStaffModal, setShowAddStaffModal] = useState(false)
  const [showEditStaffModal, setShowEditStaffModal] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [staffToDelete, setStaffToDelete] = useState(null)
  const [staffToEdit, setStaffToEdit] = useState(null)
  const [newStaff, setNewStaff] = useState({ name: '', role: '', dailyWage: '', phone: '', siteId: '', buildingId: '', employmentType: 'permanent' })
  const [editStaff, setEditStaff] = useState({ name: '', role: '', dailyWage: '', phone: '', siteId: '', buildingId: '', employmentType: 'permanent' })

  // Daily worker count management with 24-hour expiration
  const [dailyWorkerCounts, setDailyWorkerCounts] = useState(() => {
    const saved = localStorage.getItem('dailyWorkerCounts')
    if (saved) {
      const parsed = JSON.parse(saved)
      // Check if data is older than 24 hours
      if (parsed.timestamp) {
        const dataAge = Date.now() - parsed.timestamp
        const twentyFourHours = 24 * 60 * 60 * 1000
        if (dataAge > twentyFourHours) {
          localStorage.removeItem('dailyWorkerCounts')
          return {}
        }
        return parsed.data || {}
      }
    }
    return {}
  })
  const [quickDailyWorkerCount, setQuickDailyWorkerCount] = useState(0)
  const [showDailyWorkerModal, setShowDailyWorkerModal] = useState(false)

  // Contract worker count management with 24-hour expiration
  const [contractWorkerCounts, setContractWorkerCounts] = useState(() => {
    const saved = localStorage.getItem('contractWorkerCounts')
    if (saved) {
      const parsed = JSON.parse(saved)
      // Check if data is older than 24 hours
      if (parsed.timestamp) {
        const dataAge = Date.now() - parsed.timestamp
        const twentyFourHours = 24 * 60 * 60 * 1000
        if (dataAge > twentyFourHours) {
          localStorage.removeItem('contractWorkerCounts')
          return {}
        }
        return parsed.data || {}
      }
    }
    return {}
  })
  const [showContractWorkerModal, setShowContractWorkerModal] = useState(false)
  const [newContractWorker, setNewContractWorker] = useState({ contractorName: '', workerCount: 0, siteId: '', buildingId: '' })

  // Persist counts to localStorage with timestamp
  useEffect(() => {
    localStorage.setItem('dailyWorkerCounts', JSON.stringify({
      data: dailyWorkerCounts,
      timestamp: Date.now()
    }))
  }, [dailyWorkerCounts])

  useEffect(() => {
    localStorage.setItem('contractWorkerCounts', JSON.stringify({
      data: contractWorkerCounts,
      timestamp: Date.now()
    }))
  }, [contractWorkerCounts])

  // Attendance editing states
  const [editingAttendance, setEditingAttendance] = useState(null)
  const [editAttendanceData, setEditAttendanceData] = useState({})

  // Custom Toast Notification
  const [toastMessage, setToastMessage] = useState({ text: '', type: 'success', visible: false })
  const showToast = (text, type = 'success') => {
    setToastMessage({ text, type, visible: true })
    setTimeout(() => setToastMessage({ text: '', type: 'success', visible: false }), 3000)
  }



  // Real-time synchronization for zero-delay updates (CRUD)
  useEffect(() => {
    // Guard: wait if supervisor sites aren't resolved
    if (userRole === 'supervisor' && assignedSites.length === 0) {
      setLoading(false);
      return;
    }

    setLoading(true);
    const accessibleSites = userRole === 'supervisor' ? assignedSites : null;
    const siteIds = accessibleSites?.map(s => s.id) || [];
    const supervisorId = currentSupervisor?.firebaseUid || currentSupervisor?.id || null;

    if (userRole === 'supervisor') {
      setSites(assignedSites);
    }

    const labourQuery = userRole === 'supervisor' && siteIds.length > 0
      ? query(labourCollection, where('siteId', 'in', siteIds))
      : labourCollection;

    const attendanceQuery = userRole === 'supervisor' && siteIds.length > 0
      ? query(attendanceCollection, where('date', '==', selectedDate), where('siteId', 'in', siteIds))
      : query(attendanceCollection, where('date', '==', selectedDate));

    const buildingsQuery = userRole === 'supervisor' && siteIds.length > 0
      ? query(buildingsCollection, where('siteId', 'in', siteIds))
      : buildingsCollection;

    const unsubscribeLabour = onSnapshot(labourQuery, (snapshot) => {
      const allLabour = convertDocsToArray(snapshot);
      // Filter out unassigned workers
      setEmployees(allLabour.filter(emp => emp.siteId && emp.siteId !== 'unassigned' && emp.siteId !== ''));
    });

    const unsubscribeAttendance = onSnapshot(attendanceQuery, (snapshot) => {
      const attendanceData = convertDocsToArray(snapshot);
      setAttendance(attendanceData);

      if (userRole === 'supervisor') {
        const isDone = attendanceData.some(r => {
          const submitted = !!r.submittedAt || !!r.isSubmitted;
          if (!submitted) return false;
          if (supervisorId && r.supervisorId === supervisorId) return true;
          return r.markedBy === currentSupervisor?.email || r.markedBy === currentSupervisor?.name;
        });
        setSubmittedToday(isDone);
      }
      setLoading(false);
    });

    const unsubscribeBuildings = onSnapshot(buildingsQuery, (snapshot) => {
      setBuildings(convertDocsToArray(snapshot));
    });

    // Admin site sync (reactive)
    let unsubscribeSites = () => {};
    if (userRole !== 'supervisor') {
      unsubscribeSites = siteServices.onSitesChange((snapshot) => { 
        setSites(convertDocsToArray(snapshot)); 
      });
    }

    return () => {
      unsubscribeLabour();
      unsubscribeAttendance();
      unsubscribeBuildings();
      unsubscribeSites();
    };
  }, [selectedDate, userRole, assignedSites, currentSupervisor]);

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

      // If submitted, supervisor cannot modify even to the same status (or delete)
      if (existingRecord && (existingRecord.status !== newStatus || newStatus === 'removed')) {
        showToast('You cannot modify attendance after submission.', 'error')
        return
      }
    }

    try {
      // Check if attendance record already exists
      const existingRecord = attendance.find(record =>
        record.employeeId === employeeId && record.date === selectedDate
      );

      // Prevent changing from Leave to Present/Absent unless it's explicitly removing the leave or if Admin
      if (existingRecord && existingRecord.status === 'leave' && newStatus !== 'removed' && newStatus !== 'leave') {
        if (userRole !== 'admin') {
          showToast('Leave status is locked. Please click "L" to remove leave status first.', 'error');
          return;
        }
      }

      if (newStatus === 'removed') {
        if (existingRecord) {
          await attendanceServices.deleteAttendance(existingRecord.id);
        }
        if (employee.onLeave) {
          await labourServices.updateLabour(employeeId, { onLeave: false });
        }
        return;
      }

      // Sync persistent leave state
      if (newStatus === 'leave') {
        if (!employee.onLeave) await labourServices.updateLabour(employeeId, { onLeave: true });
      } else {
        if (employee.onLeave) await labourServices.updateLabour(employeeId, { onLeave: false });
      }

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

    // Apply worker type filter to both records and employees
    let filteredEmployees = employees.filter(emp => {
      const employmentType = emp.employmentType || 'permanent'
      const isDailyWorker = emp.isDailyWorker || emp.temporary
      
      // Apply worker type filter
      let matchesWorkerType = true;
      if (workerTypeFilter === 'permanent') {
        matchesWorkerType = employmentType === 'permanent' && !isDailyWorker;
      } else if (workerTypeFilter === 'contract') {
        matchesWorkerType = employmentType === 'contract' && !isDailyWorker;
      } else if (workerTypeFilter === 'daily') {
        matchesWorkerType = isDailyWorker;
      }

      let matchesSite = true;
      if (userRole === 'supervisor') {
        matchesSite = emp.siteId && assignedSites.some(site => site.id === emp.siteId);
      } else if (userRole === 'admin' && selectedSiteFilter !== 'all') {
        matchesSite = emp.siteId === selectedSiteFilter;
      }
      
      return matchesSite && matchesWorkerType;
    });

    // Filter records to only include employees that match the current filters
    const filteredEmployeeIds = new Set(filteredEmployees.map(emp => emp.id));
    todayRecords = todayRecords.filter(record => filteredEmployeeIds.has(record.employeeId));

    const present = todayRecords.filter(record => record.status === 'present').length
    const absent = todayRecords.filter(record => record.status === 'absent').length
    const leave = todayRecords.filter(record => record.status === 'leave').length + filteredEmployees.filter(emp => emp.onLeave && !todayRecords.some(r => r.employeeId === emp.id)).length
    const total = filteredEmployees.length;

    const finalTotal = total;
    return { present, absent, leave, total: finalTotal, percentage: finalTotal > 0 ? (present / finalTotal * 100).toFixed(1) : 0 }
  }

  // Daily Worker Count Management - Shared pool across sites
  const handleDailyWorkerCountChange = (siteId, change) => {
    setDailyWorkerCounts(prev => {
      const currentCount = prev[siteId] || 0
      const unassignedCount = prev['unassigned'] || 0
      
      // Calculate new count for this site (prevent negative)
      const newCount = Math.max(0, currentCount + change)
      
      // Calculate actual change (could be 0 if trying to go below 0)
      const actualChange = newCount - currentCount
      
      // If no actual change (e.g., trying to subtract from 0), do nothing
      if (actualChange === 0) return prev
      
      // If adding, check if we have enough unassigned workers
      if (actualChange > 0) {
        if (unassignedCount < actualChange) {
          showToast(`Only ${unassignedCount} unassigned workers available`, 'error')
          return prev
        }
        // Deduct from unassigned and add to target site
        return {
          ...prev,
          'unassigned': unassignedCount - actualChange,
          [siteId]: newCount
        }
      }
      
      // If removing, add back to unassigned
      if (actualChange < 0) {
        return {
          ...prev,
          'unassigned': unassignedCount + Math.abs(actualChange),
          [siteId]: newCount
        }
      }
      
      return prev
    })
  }

  const getDailyWorkerCountForSite = (siteId) => {
    return dailyWorkerCounts[siteId] || 0
  }

  const saveDailyWorkerAttendance = async (siteId) => {
    const dailyData = dailyWorkerCounts[siteId]
    const count = dailyData?.count || 0
    
    try {
      // Create attendance record for daily workers (count-based)
      const attendanceData = {
        employeeId: `daily-${siteId}-${selectedDate}`,
        siteId: siteId,
        buildingId: dailyData?.buildingId || null,
        supervisorId: userRole === 'supervisor' ? (currentSupervisor?.firebaseUid || currentSupervisor?.id || null) : null,
        date: selectedDate,
        status: 'present',
        isDailyWorker: true,
        dailyWorkerCount: count,
        checkIn: new Date().toTimeString().slice(0, 5),
        checkOut: '17:30',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }

      // Check if record already exists
      const existingRecord = attendance.find(record =>
        record.employeeId === attendanceData.employeeId &&
        record.date === selectedDate
      )

      if (existingRecord) {
        await attendanceServices.updateAttendance(existingRecord.id, {
          ...attendanceData,
          dailyWorkerCount: count
        })
      } else {
        await attendanceServices.addAttendance(attendanceData)
      }

      showToast(`Daily workers saved: ${count} workers`)
    } catch (error) {
      console.error('Error saving daily worker attendance:', error)
      showToast('Error saving daily worker attendance', 'error')
    }
  }

  // Save unassigned count to database
  const saveUnassignedDailyWorkers = async () => {
    const count = dailyWorkerCounts['unassigned'] || 0
    
    try {
      const attendanceData = {
        employeeId: `daily-unassigned-${selectedDate}`,
        siteId: 'unassigned',
        buildingId: null,
        supervisorId: userRole === 'supervisor' ? (currentSupervisor?.firebaseUid || currentSupervisor?.id || null) : null,
        date: selectedDate,
        status: 'present',
        isDailyWorker: true,
        dailyWorkerCount: count,
        checkIn: new Date().toTimeString().slice(0, 5),
        checkOut: '17:30',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }

      const existingRecord = attendance.find(record =>
        record.employeeId === attendanceData.employeeId &&
        record.date === selectedDate
      )

      if (existingRecord) {
        await attendanceServices.updateAttendance(existingRecord.id, {
          ...attendanceData,
          dailyWorkerCount: count
        })
      } else {
        await attendanceServices.addAttendance(attendanceData)
      }
    } catch (error) {
      console.error('Error saving unassigned daily workers:', error)
    }
  }

  // Contract Worker Count Management
  const handleAddContractWorker = () => {
    if (!newContractWorker.contractorName || newContractWorker.workerCount <= 0) {
      showToast('Please enter contractor name and worker count', 'error')
      return
    }

    const targetSiteId = newContractWorker.siteId || 'unassigned'
    const targetBuildingId = newContractWorker.buildingId || ''

    setContractWorkerCounts(prev => ({
      ...prev,
      [targetSiteId]: {
        contractorName: newContractWorker.contractorName,
        count: (prev[targetSiteId]?.count || 0) + newContractWorker.workerCount,
        buildingId: targetBuildingId
      }
    }))

    setNewContractWorker({ contractorName: '', workerCount: 0, siteId: '', buildingId: '' })
    showToast(`${newContractWorker.workerCount} contract workers added for ${newContractWorker.contractorName}`)
  }

  const handleContractWorkerAssignment = (siteId, change) => {
    setContractWorkerCounts(prev => {
      const unassigned = prev['unassigned'] || { contractorName: '', count: 0 }
      const currentCount = (prev[siteId]?.count) || 0
      
      if (change > 0) {
        if (unassigned.count < change) {
          showToast(`Only ${unassigned.count} unassigned contract workers available`, 'error')
          return prev
        }
        return {
          ...prev,
          'unassigned': { ...unassigned, count: unassigned.count - change },
          [siteId]: {
            contractorName: unassigned.contractorName,
            count: currentCount + change
          }
        }
      } else if (change < 0) {
        const actualChange = Math.abs(change)
        const newCount = Math.max(0, currentCount - actualChange)
        const returnedCount = currentCount - newCount
        return {
          ...prev,
          'unassigned': { ...unassigned, count: unassigned.count + returnedCount },
          [siteId]: {
            contractorName: prev[siteId]?.contractorName || unassigned.contractorName,
            count: newCount
          }
        }
      }
      return prev
    })
  }

  const saveContractWorkerAttendance = async (siteId) => {
    const contractData = contractWorkerCounts[siteId]
    if (!contractData || contractData.count <= 0) return

    try {
      const attendanceData = {
        employeeId: `contract-${siteId}-${selectedDate}`,
        siteId: siteId,
        buildingId: contractData.buildingId || null,
        supervisorId: userRole === 'supervisor' ? (currentSupervisor?.firebaseUid || currentSupervisor?.id || null) : null,
        date: selectedDate,
        status: 'present',
        isContractWorker: true,
        contractorName: contractData.contractorName,
        contractWorkerCount: contractData.count,
        checkIn: new Date().toTimeString().slice(0, 5),
        checkOut: '17:30',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }

      const existingRecord = attendance.find(record =>
        record.employeeId === attendanceData.employeeId &&
        record.date === selectedDate
      )

      if (existingRecord) {
        await attendanceServices.updateAttendance(existingRecord.id, attendanceData)
      } else {
        await attendanceServices.addAttendance(attendanceData)
      }

      showToast(`Contract workers saved: ${contractData.count} workers from ${contractData.contractorName}`)
    } catch (error) {
      console.error('Error saving contract worker attendance:', error)
      showToast('Error saving contract worker attendance', 'error')
    }
  }

  // Load existing contract worker attendance for the selected date
  const loadContractWorkerAttendance = () => {
    const contractRecords = attendance.filter(record => 
      record.isContractWorker && record.date === selectedDate
    )
    
    const loadedCounts = {}
    contractRecords.forEach(record => {
      if (record.siteId) {
        loadedCounts[record.siteId] = {
          contractorName: record.contractorName,
          count: record.contractWorkerCount
        }
      }
    })
    
    setContractWorkerCounts(loadedCounts)
  }

  // Load existing daily worker attendance for the selected date
  const loadDailyWorkerAttendance = () => {
    const dailyRecords = attendance.filter(record => 
      record.isDailyWorker && record.date === selectedDate
    )
    
    const loadedCounts = {}
    dailyRecords.forEach(record => {
      const key = record.siteId === 'unassigned' ? 'unassigned' : record.siteId
      loadedCounts[key] = {
        count: record.dailyWorkerCount,
        buildingId: record.buildingId || null
      }
    })
    
    // Only update if we have records, otherwise keep localStorage data
    if (Object.keys(loadedCounts).length > 0) {
      setDailyWorkerCounts(loadedCounts)
    }
  }

  // Load daily worker attendance when date changes
  useEffect(() => {
    loadDailyWorkerAttendance()
  }, [selectedDate, attendance])

  // Load contract worker attendance when date changes
  useEffect(() => {
    loadContractWorkerAttendance()
  }, [selectedDate, attendance])
  const handleQuickDailyWorkerAdd = async () => {
    if (quickDailyWorkerCount <= 0) {
      showToast('Please enter worker count', 'error')
      return
    }
    
    // Calculate new count
    const currentUnassigned = dailyWorkerCounts['unassigned'] || 0
    const newUnassigned = currentUnassigned + quickDailyWorkerCount
    
    console.log('Adding daily workers:', { currentUnassigned, quickDailyWorkerCount, newUnassigned })
    
    try {
      // Find existing record
      const existingRecord = attendance.find(record =>
        record.employeeId === `daily-unassigned-${selectedDate}` &&
        record.date === selectedDate
      )

      if (existingRecord) {
        console.log('Updating existing record:', existingRecord.id, existingRecord.dailyWorkerCount, '->', newUnassigned)
        // Update existing record
        await attendanceServices.updateAttendance(existingRecord.id, {
          dailyWorkerCount: newUnassigned,
          updatedAt: new Date().toISOString()
        })
      } else {
        console.log('Creating new record with count:', newUnassigned)
        // Create new record
        const attendanceData = {
          employeeId: `daily-unassigned-${selectedDate}`,
          siteId: 'unassigned',
          buildingId: null,
          supervisorId: userRole === 'supervisor' ? (currentSupervisor?.firebaseUid || currentSupervisor?.id || null) : null,
          date: selectedDate,
          status: 'present',
          isDailyWorker: true,
          dailyWorkerCount: newUnassigned,
          checkIn: new Date().toTimeString().slice(0, 5),
          checkOut: '17:30',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
        await attendanceServices.addAttendance(attendanceData)
      }
      
      // Update local state immediately
      setDailyWorkerCounts(prev => ({
        ...prev,
        'unassigned': newUnassigned
      }))
      setQuickDailyWorkerCount(0)
      
      showToast(`${quickDailyWorkerCount} daily workers added! Total: ${newUnassigned}`)
    } catch (error) {
      console.error('Error saving daily workers:', error)
      showToast('Error saving daily workers', 'error')
    }
  }
  const handleAddStaff = async () => {
    try {
      // Handle daily worker count addition (if count is provided)
      if (newStaff.employmentType === 'daily' && newStaff.dailyWorkerCount > 0) {
        // For daily workers, add to daily worker counts without requiring site
        const targetSiteId = newStaff.siteId || 'unassigned'
        setDailyWorkerCounts(prev => ({
          ...prev,
          [targetSiteId]: (prev[targetSiteId] || 0) + newStaff.dailyWorkerCount
        }))
        setNewStaff({ name: '', role: '', dailyWage: '', phone: '', siteId: '', buildingId: '', employmentType: 'permanent', dailyWorkerCount: 0 })
        setShowAddStaffModal(false)
        showToast(`${newStaff.dailyWorkerCount} daily workers added!`)
        return
      }

      // Handle individual daily staff member (with name)
      if (newStaff.employmentType === 'daily' && newStaff.name) {
        const staffData = {
          ...newStaff,
          employeeCode: Date.now().toString(),
          joinDate: new Date().toISOString().split('T')[0],
          dailyWage: newStaff.dailyWage ? parseFloat(newStaff.dailyWage) : 0,
          createdAt: new Date().toISOString(),
          createdBy: userRole,
          status: 'active',
          siteId: newStaff.siteId || 'unassigned',
          role: 'Daily Worker'
        }

        await labourServices.addLabour(staffData)
        setNewStaff({ name: '', role: '', dailyWage: '', phone: '', siteId: '', buildingId: '', employmentType: 'permanent', dailyWorkerCount: 0 })
        setShowAddStaffModal(false)
        showToast('Daily staff added successfully!')
        return
      }

      // Handle regular staff (permanent/contract)
      if (!newStaff.name) {
        showToast('Please enter staff name', 'error')
        return
      }

      // Generate unique number ID for the staff member
      const uniqueNumber = Date.now() + Math.floor(Math.random() * 1000)

      const staffData = {
        ...newStaff,
        employeeCode: uniqueNumber.toString(),
        joinDate: new Date().toISOString().split('T')[0],
        dailyWage: newStaff.dailyWage ? parseFloat(newStaff.dailyWage) : 0,
        createdAt: new Date().toISOString(),
        createdBy: userRole,
        status: 'active',
        siteId: newStaff.siteId || 'unassigned'
      }

      await labourServices.addLabour(staffData)
      setNewStaff({ name: '', role: '', dailyWage: '', phone: '', siteId: '', buildingId: '', employmentType: 'permanent', dailyWorkerCount: 0 })
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
      setEditStaff({ name: '', role: '', dailyWage: '', phone: '', siteId: '', buildingId: '', employmentType: 'permanent' })
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

  // Inline site assignment from the table dropdown
  const handleInlineSiteChange = async (employeeId, newSiteId) => {
    try {
      await labourServices.updateLabour(employeeId, {
        siteId: newSiteId || '',
        buildingId: '',
        updatedAt: new Date().toISOString(),
        updatedBy: userRole
      })
      showToast(newSiteId ? 'Site assigned!' : 'Site removed.')
    } catch (error) {
      console.error('Error updating site:', error)
      showToast('Failed to update site.', 'error')
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
      buildingId: staff.buildingId || '',
      employmentType: staff.employmentType || 'permanent'
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
    const status = attendanceRecord?.status || (employee.onLeave ? 'leave' : 'not-marked')
    
    // Check employee employment type
    const employmentType = employee.employmentType || 'permanent'
    const isDailyWorker = employee.isDailyWorker || employee.temporary

    // Get site name from sites data
    const siteName = sites.find(site => site.id === employee.siteId)?.name || 'Unassigned'

    const matchesSearch = employee.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      siteName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      employee.role.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesFilter = filterStatus === 'all' || status === filterStatus
    
    // Filter by worker type
    let matchesWorkerType = true;
    if (workerTypeFilter === 'permanent') {
      matchesWorkerType = employmentType === 'permanent' && !isDailyWorker;
    } else if (workerTypeFilter === 'contract') {
      matchesWorkerType = employmentType === 'contract' && !isDailyWorker;
    } else if (workerTypeFilter === 'daily') {
      matchesWorkerType = isDailyWorker;
    }

    // Filter by assigned sites for supervisors, or selected site for admin
    let matchesSite = true;
    if (userRole === 'supervisor') {
      // Show all employees assigned to supervisor's sites OR unassigned employees
      matchesSite = !employee.siteId || employee.siteId === 'unassigned' || assignedSites.some(site => site.id === employee.siteId);
    } else if (userRole === 'admin' && selectedSiteFilter !== 'all') {
      // Show employees matching the site filter OR unassigned employees
      matchesSite = !employee.siteId || employee.siteId === 'unassigned' || employee.siteId === selectedSiteFilter;
    }

    return matchesSearch && matchesFilter && matchesSite && matchesWorkerType
  }).map(employee => {
    // Determine employment type for display
    let displayEmploymentType = employee.employmentType || 'permanent';
    if (employee.isDailyWorker || employee.temporary) {
      displayEmploymentType = 'daily';
    }
    
    return {
      ...employee,
      site: sites.find(site => site.id === employee.siteId)?.name || 'Unassigned',
      employmentType: displayEmploymentType
    };
  }).sort((a, b) => {
    // Sort by attendance status: unmarked → daily workers → present/absent → leave
    const aAttendance = attendance.find(record => record.employeeId === a.id && record.date === selectedDate)
    const bAttendance = attendance.find(record => record.employeeId === b.id && record.date === selectedDate)
    const aStatus = aAttendance?.status || (a.onLeave ? 'leave' : 'not-marked')
    const bStatus = bAttendance?.status || (b.onLeave ? 'leave' : 'not-marked')
    
    // Check if employee is a daily worker
    const aIsDaily = a.isDailyWorker || a.temporary
    const bIsDaily = b.isDailyWorker || b.temporary
    
    // Define priority: not-marked = 0, daily workers = 1, present/absent = 2, leave = 3
    const getPriority = (status, isDaily) => {
      if (isDaily) return 1
      if (status === 'not-marked') return 0
      if (status === 'leave') return 3
      return 2 // present or absent
    }
    
    const aPriority = getPriority(aStatus, aIsDaily)
    const bPriority = getPriority(bStatus, bIsDaily)
    
    if (aPriority !== bPriority) {
      return aPriority - bPriority
    }
    
    // Then sort by employment type: permanent → contract → daily
    const order = { permanent: 0, contract: 1, daily: 2 };
    const aOrder = order[a.employmentType] || 0;
    const bOrder = order[b.employmentType] || 0;
    
    if (aOrder !== bOrder) {
      return aOrder - bOrder;
    }
    return a.name.localeCompare(b.name);
  })

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
    <div className="p-3 space-y-6 relative">
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
        <div className="flex items-center gap-4">
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => navigate('/dashboard')}
            className="p-2 bg-white rounded-lg shadow-sm border border-gray-200 text-gray-600 hover:text-blue-600 transition-colors"
          >
            <ArrowLeft className="w-6 h-6" />
          </motion.button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Attendance Management</h1>
            <p className="text-gray-600">Track daily attendance - Present or Absent</p>
          </div>
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

      {/* Stats Cards - compact single row */}
      <div className="grid grid-cols-6 gap-1.5 sm:gap-2 mb-4">
        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.1 }} className="bg-white rounded-lg shadow-sm p-1 sm:p-2 border border-gray-200">
          <p className="text-[8px] sm:text-[10px] text-gray-500 leading-tight">Total</p>
          <p className="text-xs sm:text-lg font-bold text-gray-900">{stats.total}</p>
          <Users className="w-2 h-2 sm:w-4 sm:h-4 text-gray-400 mt-0.5" />
        </motion.div>
        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.2 }} className="bg-white rounded-lg shadow-sm p-1 sm:p-2 border border-gray-200">
          <p className="text-[8px] sm:text-[10px] text-gray-500 leading-tight">Present</p>
          <p className="text-xs sm:text-lg font-bold text-green-600">{stats.present}</p>
          <CheckCircle className="w-2 h-2 sm:w-4 sm:h-4 text-green-500 mt-0.5" />
        </motion.div>
        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.3 }} className="bg-white rounded-lg shadow-sm p-1 sm:p-2 border border-gray-200">
          <p className="text-[8px] sm:text-[10px] text-gray-500 leading-tight">Absent</p>
          <p className="text-xs sm:text-lg font-bold text-red-600">{stats.absent}</p>
          <XCircle className="w-2 h-2 sm:w-4 sm:h-4 text-red-500 mt-0.5" />
        </motion.div>
        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.4 }} className="bg-white rounded-lg shadow-sm p-1 sm:p-2 border border-gray-200">
          <p className="text-[8px] sm:text-[10px] text-gray-500 leading-tight">Leave</p>
          <p className="text-xs sm:text-lg font-bold text-yellow-600">{stats.leave}</p>
          <Clock className="w-2 h-2 sm:w-4 sm:h-4 text-yellow-500 mt-0.5" />
        </motion.div>
        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.5 }} className="bg-white rounded-lg shadow-sm p-1 sm:p-2 border border-gray-200">
          <p className="text-[8px] sm:text-[10px] text-gray-500 leading-tight">Daily Staff</p>
          <p className="text-xs sm:text-lg font-bold text-blue-600">{Object.values(dailyWorkerCounts).reduce((a,b)=>a+(b?.count||0),0)}</p>
          <Users className="w-2 h-2 sm:w-4 sm:h-4 text-blue-500 mt-0.5" />
        </motion.div>
        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.6 }} className="bg-white rounded-lg shadow-sm p-1 sm:p-2 border border-gray-200">
          <p className="text-[8px] sm:text-[10px] text-gray-500 leading-tight">Contract Staff</p>
          <p className="text-xs sm:text-lg font-bold text-orange-600">{Object.values(contractWorkerCounts).reduce((a,b)=>a+(b?.count||0),0)}</p>
          <Users className="w-2 h-2 sm:w-4 sm:h-4 text-orange-500 mt-0.5" />
        </motion.div>
      </div>

      {/* Quick Actions */}
      {(userRole === 'admin' || userRole === 'supervisor') && (
        <div className="flex flex-wrap gap-2 sm:gap-3 mb-6">
          {userRole === 'admin' && (
            <>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => {
                  setNewStaff({ name: '', role: '', dailyWage: '', phone: '', siteId: '', buildingId: '', employmentType: 'permanent', dailyWorkerCount: 0 })
                  setShowAddStaffModal(true)
                }}
                className="flex items-center gap-1.5 sm:gap-2 px-2 sm:px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-medium text-xs sm:text-sm"
              >
                <UserPlus className="w-3 h-3 sm:w-4 sm:h-4" />
                <span className="hidden sm:inline">Add Staff</span>
                <span className="sm:hidden">Staff</span>
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={markAllPresent}
                className="flex items-center gap-1.5 sm:gap-2 px-2 sm:px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg font-medium text-xs sm:text-sm"
              >
                <Check className="w-3 h-3 sm:w-4 sm:h-4" />
                <span className="hidden sm:inline">Mark All Present</span>
                <span className="sm:hidden">Present</span>
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setShowContractWorkerModal(true)}
                className="flex items-center gap-1.5 sm:gap-2 px-2 sm:px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-medium text-xs sm:text-sm"
              >
                <UserPlus className="w-3 h-3 sm:w-4 sm:h-4" />
                <span className="hidden sm:inline">Add Contract Workers</span>
                <span className="sm:hidden">Contract</span>
              </motion.button>
              {Object.keys(contractWorkerCounts).some(key => contractWorkerCounts[key]?.count > 0) && (
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => {
                    setShowContractWorkerModal(true)
                    // Scroll to assignment section
                    setTimeout(() => {
                      const assignmentSection = document.querySelector('[data-contract-assignment]')
                      if (assignmentSection) assignmentSection.scrollIntoView({ behavior: 'smooth' })
                    }, 100)
                  }}
                  className="flex items-center gap-1.5 sm:gap-2 px-2 sm:px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg font-medium text-xs sm:text-sm"
                >
                  <Users className="w-3 h-3 sm:w-4 sm:h-4" />
                  <span className="hidden sm:inline">Assign Contract Workers</span>
                  <span className="sm:hidden">Assign</span>
                </motion.button>
              )}
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
      <div className="flex flex-col gap-2 mb-4">
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative w-full sm:flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Search..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
            />
          </div>
          <div className="flex gap-2 w-full sm:w-auto">
            {(userRole === 'admin' || userRole === 'supervisor') && (
              <select
                value={selectedSiteFilter}
                onChange={(e) => setSelectedSiteFilter(e.target.value)}
                className="px-2 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm flex-1"
              >
                <option value="all">All Sites</option>
                {sites.filter(site => site.status !== 'On Hold' && site.status !== 'Completed').map(site => (
                  <option key={site.id} value={site.id}>{site.name}</option>
                ))}
              </select>
            )}
            <select
              value={workerTypeFilter}
              onChange={(e) => setWorkerTypeFilter(e.target.value)}
              className="px-2 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm flex-1 sm:w-32"
            >
              <option value="all">All Types</option>
              <option value="permanent">Perm</option>
              <option value="contract">Contract</option>
              <option value="daily">Daily</option>
            </select>
          </div>
        </div>
        <div className="flex gap-1">
          {['all','present','absent','leave'].map(s => (
            <button key={s} onClick={() => setFilterStatus(s)}
              className={`flex-1 py-1.5 rounded-lg font-medium text-xs transition-colors ${
                filterStatus === s
                  ? s === 'all' ? 'bg-blue-500 text-white'
                    : s === 'present' ? 'bg-green-500 text-white'
                    : s === 'absent' ? 'bg-red-500 text-white'
                    : 'bg-yellow-500 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}>
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Daily Worker Section - Combined Row */}
      {(userRole === 'admin' || userRole === 'supervisor') && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
          {/* Quick Daily Worker Addition */}
          <div className="bg-purple-50 rounded-xl shadow-sm border border-purple-200 p-2 sm:p-3">
            <h3 className="text-[10px] sm:text-xs font-bold text-purple-800 mb-1 sm:mb-2 flex items-center gap-1">
              <Users className="w-2 h-2 sm:w-3 sm:h-3" />
              Quick Add Daily Workers
            </h3>
            <div className="flex gap-2 sm:gap-3">
              <input
                type="number"
                placeholder="Worker Count"
                value={quickDailyWorkerCount || ''}
                onChange={(e) => setQuickDailyWorkerCount(parseInt(e.target.value) || 0)}
                className="flex-1 px-2 py-1.5 border border-purple-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 text-xs sm:text-sm"
                min="1"
              />
              <motion.button
                whileTap={{ scale: 0.9 }}
                onClick={handleQuickDailyWorkerAdd}
                className="px-3 py-1.5 bg-purple-500 text-white text-[10px] sm:text-xs font-medium rounded-lg hover:bg-purple-600"
              >
                Add
              </motion.button>
            </div>
          </div>

          {/* Daily Worker Count Management - Compact */}
          {Object.values(dailyWorkerCounts).some(data => data?.count > 0) && (
            <div className="bg-purple-50 rounded-xl shadow-sm border border-purple-200 p-2 sm:p-3">
              <div className="flex items-center justify-between mb-1 sm:mb-2">
                <h3 className="text-[10px] sm:text-xs font-bold text-purple-800 flex items-center gap-1">
                  <Users className="w-2 h-2 sm:w-3 sm:h-3" />
                  Daily Workers (Count-based)
                </h3>
                <span className="px-1.5 py-0.5 bg-purple-500 text-white text-[8px] sm:text-[10px] font-bold rounded-full">
                  Daily Staff
                </span>
              </div>
              
              {/* Unassigned Summary */}
              <div className="bg-white rounded-lg p-1.5 sm:p-2 border border-purple-200">
                <div className="flex items-center justify-between">
                  <span className="text-[9px] sm:text-[10px] font-medium text-gray-700">Unassigned Workers</span>
                  <span className="text-xs sm:text-sm font-bold text-purple-700">{dailyWorkerCounts['unassigned']?.count || 0}</span>
                </div>
                <button
                  onClick={() => setShowDailyWorkerModal(true)}
                  className="mt-1.5 w-full px-2 py-1 bg-purple-500 text-white text-[8px] sm:text-[10px] font-medium rounded-lg hover:bg-purple-600"
                >
                  Assign to Sites
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Attendance List */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {/* Daily Workers Section */}
        {Object.keys(dailyWorkerCounts).some(siteId => siteId !== 'unassigned' && dailyWorkerCounts[siteId]?.count > 0) && (
          <div className="bg-purple-50 border-b-2 border-purple-200">
            <div className="p-2 bg-purple-100 border-b border-purple-200">
              <h3 className="text-xs font-bold text-purple-800 flex items-center gap-1">
                <Users className="w-3 h-3" />
                Daily Workers
              </h3>
            </div>
            <div className="p-2 space-y-2">
              {Object.entries(dailyWorkerCounts).map(([siteId, dailyData]) => {
                if (siteId === 'unassigned' || !dailyData?.count) return null
                const site = sites.find(s => s.id === siteId)
                const siteName = site?.name || 'Unknown Site'
                const building = dailyData.buildingId ? buildings.find(b => b.id === dailyData.buildingId) : null
                const buildingName = building?.name || ''
                const locationText = buildingName ? `${siteName} - ${buildingName}` : siteName
                
                return (
                  <div key={siteId} className="bg-white rounded-lg p-2 border border-purple-200">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-purple-500 flex items-center justify-center text-white text-xs font-bold">
                          D
                        </div>
                        <div>
                          <p className="text-xs font-bold text-gray-900">Daily Workers</p>
                          <p className="text-[10px] text-gray-500">{locationText}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-xs font-bold text-purple-700">{dailyData.count} workers</span>
                        <span className="px-1.5 py-0.5 bg-green-500 text-white text-[8px] font-bold rounded-full">P</span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Contract Workers Section */}
        {Object.keys(contractWorkerCounts).some(siteId => siteId !== 'unassigned' && contractWorkerCounts[siteId]?.count > 0) && (
          <div className="bg-orange-50 border-b-2 border-orange-200">
            <div className="p-2 bg-orange-100 border-b border-orange-200">
              <h3 className="text-xs font-bold text-orange-800 flex items-center gap-1">
                <Users className="w-3 h-3" />
                Contract Workers
              </h3>
            </div>
            <div className="p-2 space-y-2">
              {Object.entries(contractWorkerCounts).map(([siteId, contractData]) => {
                if (siteId === 'unassigned' || !contractData?.count) return null
                const site = sites.find(s => s.id === siteId)
                const siteName = site?.name || 'Unknown Site'
                const building = contractData.buildingId ? buildings.find(b => b.id === contractData.buildingId) : null
                const buildingName = building?.name || ''
                const locationText = buildingName ? `${siteName} - ${buildingName}` : siteName
                
                return (
                  <div key={siteId} className="bg-white rounded-lg p-2 border border-orange-200">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-orange-500 flex items-center justify-center text-white text-xs font-bold">
                          C
                        </div>
                        <div>
                          <p className="text-xs font-bold text-gray-900">{contractData.contractorName}</p>
                          <p className="text-[10px] text-gray-500">{locationText}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-xs font-bold text-orange-700">{contractData.count} workers</span>
                        <span className="px-1.5 py-0.5 bg-green-500 text-white text-[8px] font-bold rounded-full">P</span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="py-2 px-1 text-left text-[10px] font-medium text-gray-400 uppercase w-5">#</th>
                <th className="py-2 px-1 text-left text-[10px] font-medium text-gray-400 uppercase">Employee</th>
                <th className="py-2 px-2 text-left text-[10px] font-medium text-gray-400 uppercase hidden sm:table-cell">Site</th>
                <th className="py-2 px-2 text-center text-[10px] font-medium text-gray-400 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredEmployees.map((employee, index) => {
                const attendanceRecord = attendance.find(record =>
                  record.employeeId === employee.id && record.date === selectedDate
                )
                const status = attendanceRecord?.status || (employee.onLeave ? 'leave' : 'not-marked')

                return (
                  <motion.tr
                    key={employee.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className={`border-t hover:bg-gray-50 ${
                      employee.employmentType === 'daily' 
                        ? 'bg-purple-50 border-purple-200 hover:bg-purple-100' 
                        : employee.employmentType === 'contract'
                        ? 'bg-orange-50 border-orange-200 hover:bg-orange-100'
                        : 'border-gray-200'
                    }`}
                  >
                    <td className="py-2 px-1 text-[10px] text-gray-400 w-5 text-center">{index + 1}</td>
                    <td className={`py-2 px-1 ${
                      employee.employmentType === 'daily' ? 'bg-purple-50' : 
                      employee.employmentType === 'contract' ? 'bg-orange-50' : 'bg-white'
                    }`}>
                      <div className="flex items-center gap-2">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-medium text-sm flex-shrink-0 ${
                          employee.employmentType === 'daily' ? 'bg-purple-500' : 
                          employee.employmentType === 'contract' ? 'bg-orange-500' : 'bg-blue-500'
                        }`}>
                          {employee.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-xs text-gray-900 truncate">{employee.name}</p>
                          <p className="text-[10px] text-gray-500 truncate">{employee.role}</p>
                        </div>
                      </div>
                      <div className="sm:hidden mt-1">
                        <select
                          value={employee.siteId || ''}
                          onChange={(e) => handleInlineSiteChange(employee.id, e.target.value)}
                          className={`px-2 py-0.5 text-[10px] font-semibold rounded border cursor-pointer w-auto max-w-[130px] focus:outline-none focus:ring-1 ${
                            employee.employmentType === 'daily'
                              ? 'border-purple-200 bg-purple-50 text-purple-700'
                              : employee.employmentType === 'contract'
                              ? 'border-orange-200 bg-orange-50 text-orange-700'
                              : 'border-blue-200 bg-blue-50 text-blue-700'
                          }`}
                        >
                          <option value="">No Site</option>
                          {sites.filter(site => site.status !== 'On Hold' && site.status !== 'Completed').map(site => (
                            <option key={site.id} value={site.id}>{site.name}</option>
                          ))}
                        </select>
                      </div>
                    </td>
                    <td className={`py-2 px-2 hidden sm:table-cell ${
                      employee.employmentType === 'daily' ? 'bg-purple-50' : 
                      employee.employmentType === 'contract' ? 'bg-orange-50' : ''
                    }`}>
                      <select
                        value={employee.siteId || ''}
                        onChange={(e) => handleInlineSiteChange(employee.id, e.target.value)}
                        className={`px-2 py-1 text-xs rounded-lg border cursor-pointer w-full focus:outline-none focus:ring-1 ${
                          employee.employmentType === 'daily'
                            ? 'border-purple-200 bg-purple-50 text-purple-700'
                            : employee.employmentType === 'contract'
                            ? 'border-orange-200 bg-orange-50 text-orange-700'
                            : 'border-gray-200 bg-white text-gray-700'
                        }`}
                      >
                        <option value="">No Site</option>
                        {sites.filter(site => site.status !== 'On Hold' && site.status !== 'Completed').map(site => (
                          <option key={site.id} value={site.id}>{site.name}</option>
                        ))}
                      </select>
                    </td>
                    <td className="py-2 px-2">
                      <div className="flex gap-0.5 sm:gap-1 items-center justify-end sm:justify-center">
                        <motion.button
                          whileTap={{ scale: 0.9 }}
                          onClick={() => handleAttendanceChange(employee.id, status === 'present' ? 'removed' : 'present')}
                          className={`w-6 h-6 sm:w-8 sm:h-8 rounded-md sm:rounded-lg transition-colors text-[10px] sm:text-xs font-bold flex items-center justify-center ${status === 'present'
                            ? 'bg-green-500 text-white'
                            : 'bg-gray-200 text-gray-700 hover:bg-green-100'
                            } ${userRole === 'supervisor' && submittedToday ? 'opacity-50 cursor-not-allowed' : ''}`}
                          disabled={userRole === 'supervisor' && submittedToday}
                        >P</motion.button>
                        <motion.button
                          whileTap={{ scale: 0.9 }}
                          onClick={() => handleAttendanceChange(employee.id, status === 'absent' ? 'removed' : 'absent')}
                          className={`w-6 h-6 sm:w-8 sm:h-8 rounded-md sm:rounded-lg transition-colors text-[10px] sm:text-xs font-bold flex items-center justify-center ${status === 'absent'
                            ? 'bg-red-500 text-white'
                            : 'bg-gray-200 text-gray-700 hover:bg-red-100'
                            } ${userRole === 'supervisor' && submittedToday ? 'opacity-50 cursor-not-allowed' : ''}`}
                          disabled={userRole === 'supervisor' && submittedToday}
                        >A</motion.button>
                        <motion.button
                          whileTap={{ scale: 0.9 }}
                          onClick={() => handleAttendanceChange(employee.id, status === 'leave' ? 'removed' : 'leave')}
                          className={`w-6 h-6 sm:w-8 sm:h-8 rounded-md sm:rounded-lg transition-colors text-[10px] sm:text-xs font-bold flex items-center justify-center ${status === 'leave'
                            ? 'bg-yellow-500 text-white'
                            : 'bg-gray-200 text-gray-700 hover:bg-yellow-100'
                            } ${userRole === 'supervisor' && submittedToday ? 'opacity-50 cursor-not-allowed' : ''}`}
                          disabled={userRole === 'supervisor' && submittedToday}
                        >L</motion.button>
                        {userRole === 'admin' && (
                          <>
                            <motion.button
                              whileTap={{ scale: 0.9 }}
                              onClick={() => openEditStaffModal(employee)}
                              className="w-6 h-6 sm:w-7 sm:h-7 rounded-md sm:rounded-lg bg-blue-500 text-white hover:bg-blue-600 transition-colors flex items-center justify-center ml-1"
                            >
                              <Edit2 className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                            </motion.button>
                            <motion.button
                              whileTap={{ scale: 0.9 }}
                              onClick={() => { setStaffToDelete(employee); setShowDeleteConfirm(true) }}
                              className="w-6 h-6 sm:w-7 sm:h-7 rounded-md sm:rounded-lg bg-red-500 text-white hover:bg-red-600 transition-colors flex items-center justify-center"
                            >
                              <Trash2 className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                            </motion.button>
                          </>
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

      {/* Contract Worker Modal */}
      {showContractWorkerModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-4 w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto">
            <h3 className="text-sm font-semibold mb-3">Add Contract Workers</h3>
            
            <div className="space-y-3 mb-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Contractor Name</label>
                <input
                  type="text"
                  placeholder="Enter contractor name"
                  value={newContractWorker.contractorName}
                  onChange={(e) => setNewContractWorker({ ...newContractWorker, contractorName: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Worker Count</label>
                <input
                  type="number"
                  placeholder="Enter number of workers"
                  value={newContractWorker.workerCount || ''}
                  onChange={(e) => setNewContractWorker({ ...newContractWorker, workerCount: parseInt(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm"
                  min="1"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Select Site (Optional)</label>
                <select
                  value={newContractWorker.siteId}
                  onChange={(e) => setNewContractWorker({ ...newContractWorker, siteId: e.target.value, buildingId: '' })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm"
                >
                  <option value="">No Site (Unassigned)</option>
                  {sites.filter(site => site.status !== 'On Hold' && site.status !== 'Completed')
                    .sort((a, b) => a.name.localeCompare(b.name))
                    .map(site => (
                    <option key={site.id} value={site.id}>{site.name}</option>
                  ))}
                </select>
              </div>
              {newContractWorker.siteId && (
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Select Building (Optional)</label>
                  <select
                    value={newContractWorker.buildingId}
                    onChange={(e) => setNewContractWorker({ ...newContractWorker, buildingId: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm"
                  >
                    <option value="">No Building</option>
                    {buildings.filter(building => building.siteId === newContractWorker.siteId)
                      .sort((a, b) => a.name.localeCompare(b.name))
                      .map(building => (
                      <option key={building.id} value={building.id}>{building.name}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>
            
            <div className="flex gap-2">
              <button
                onClick={handleAddContractWorker}
                className="flex-1 px-3 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 font-medium text-xs"
              >
                Add Workers
              </button>
              <button
                onClick={() => {
                  setShowContractWorkerModal(false)
                  setNewContractWorker({ contractorName: '', workerCount: 0 })
                }}
                className="flex-1 px-3 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-medium text-xs"
              >
                Cancel
              </button>
            </div>

            {/* Contract Worker Assignment Section */}
            {Object.keys(contractWorkerCounts).some(key => contractWorkerCounts[key]?.count > 0) && (
              <div className="mt-4 pt-4 border-t border-gray-200" data-contract-assignment>
                <h4 className="text-xs font-semibold mb-2 text-orange-700">Assign to Sites</h4>
                
                {contractWorkerCounts['unassigned']?.count > 0 && (
                  <div className="bg-orange-50 rounded-lg p-2 mb-3 border border-orange-200">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-gray-700">Unassigned: {contractWorkerCounts['unassigned']?.contractorName}</span>
                      <span className="text-sm font-bold text-orange-700">{contractWorkerCounts['unassigned']?.count || 0}</span>
                    </div>
                  </div>
                )}
                
                <div className="space-y-2 mb-3">
                  {sites.filter(site => site.status !== 'On Hold' && site.status !== 'Completed')
                    .sort((a, b) => a.name.localeCompare(b.name))
                    .map(site => {
                    const contractData = contractWorkerCounts[site.id] || { contractorName: '', count: 0 }
                    const isSupervisorSite = userRole === 'supervisor' && assignedSites.some(s => s.id === site.id)
                    const canManage = userRole === 'admin' || isSupervisorSite

                    if (!canManage) return null

                    return (
                      <div key={site.id} className="bg-gray-50 rounded-lg p-2 border border-gray-200">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-medium text-gray-700">{site.name}</span>
                          <div className="flex items-center gap-2">
                            {contractData.contractorName && (
                              <span className="text-[10px] text-gray-500">{contractData.contractorName}</span>
                            )}
                            <span className="text-xs font-bold text-orange-700">{contractData.count}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleContractWorkerAssignment(site.id, -1)}
                            className="w-6 h-6 rounded bg-red-100 text-red-600 font-bold hover:bg-red-200 flex items-center justify-center text-xs"
                          >
                            -
                          </button>
                          <button
                            onClick={() => handleContractWorkerAssignment(site.id, 1)}
                            className="w-6 h-6 rounded bg-green-100 text-green-600 font-bold hover:bg-green-200 flex items-center justify-center text-xs"
                          >
                            +
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
                
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      Object.keys(contractWorkerCounts).forEach(siteId => {
                        if (siteId !== 'unassigned' && contractWorkerCounts[siteId]?.count > 0) {
                          saveContractWorkerAttendance(siteId)
                        }
                      })
                      setShowContractWorkerModal(false)
                    }}
                    className="flex-1 px-3 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 font-medium text-xs"
                  >
                    Save Assignments
                  </button>
                  <button
                    onClick={() => setShowContractWorkerModal(false)}
                    className="flex-1 px-3 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-medium text-xs"
                  >
                    Close
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Daily Worker Assignment Modal */}
      {showDailyWorkerModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-4 w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto">
            <h3 className="text-sm font-semibold mb-3">Assign Daily Workers to Sites</h3>
            
            <div className="bg-purple-50 rounded-lg p-2 mb-3 border border-purple-200">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-gray-700">Unassigned Workers</span>
                <span className="text-sm font-bold text-purple-700">{dailyWorkerCounts['unassigned'] || 0}</span>
              </div>
            </div>
            
            <div className="space-y-2 mb-3">
              {sites.filter(site => site.status !== 'On Hold' && site.status !== 'Completed')
                .sort((a, b) => a.name.localeCompare(b.name))
                .map(site => {
                const count = dailyWorkerCounts[site.id]?.count || 0
                const buildingId = dailyWorkerCounts[site.id]?.buildingId || null
                const isSupervisorSite = userRole === 'supervisor' && assignedSites.some(s => s.id === site.id)
                const canManage = userRole === 'admin' || isSupervisorSite

                if (!canManage) return null

                return (
                  <div key={site.id} className="bg-gray-50 rounded-lg p-2 border border-gray-200">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium text-gray-700">{site.name}</span>
                      <span className="text-xs font-bold text-purple-700">{count}</span>
                    </div>
                    {site.id && buildings.filter(b => b.siteId === site.id).length > 0 && (
                      <div className="mb-2">
                        <select
                          value={buildingId || ''}
                          onChange={(e) => {
                            setDailyWorkerCounts(prev => ({
                              ...prev,
                              [site.id]: {
                                ...prev[site.id],
                                count: prev[site.id]?.count || 0,
                                buildingId: e.target.value || null
                              }
                            }))
                          }}
                          className="w-full px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-purple-500 text-[10px]"
                        >
                          <option value="">No Building</option>
                          {buildings.filter(b => b.siteId === site.id)
                            .sort((a, b) => a.name.localeCompare(b.name))
                            .map(building => (
                            <option key={building.id} value={building.id}>{building.name}</option>
                          ))}
                        </select>
                      </div>
                    )}
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleDailyWorkerCountChange(site.id, -1)}
                        className="w-6 h-6 rounded bg-red-100 text-red-600 font-bold hover:bg-red-200 flex items-center justify-center text-xs"
                      >
                        -
                      </button>
                      <button
                        onClick={() => handleDailyWorkerCountChange(site.id, 1)}
                        className="w-6 h-6 rounded bg-green-100 text-green-600 font-bold hover:bg-green-200 flex items-center justify-center text-xs"
                      >
                        +
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
            
            <div className="flex gap-2">
              <button
                onClick={() => {
                  Object.keys(dailyWorkerCounts).forEach(siteId => {
                    if (siteId !== 'unassigned' && dailyWorkerCounts[siteId]?.count > 0) {
                      saveDailyWorkerAttendance(siteId)
                    }
                  })
                  setShowDailyWorkerModal(false)
                }}
                className="flex-1 px-3 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 font-medium text-xs"
              >
                Save Assignments
              </button>
              <button
                onClick={() => setShowDailyWorkerModal(false)}
                className="flex-1 px-3 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-medium text-xs"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

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
              {newStaff.employmentType !== 'daily' && (
                <input
                  type="text"
                  placeholder="Role"
                  value={newStaff.role}
                  onChange={(e) => setNewStaff({ ...newStaff, role: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              )}
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
              <label className="block text-sm font-medium text-gray-700 mb-2">Select Site (Optional)</label>
              <select
                value={newStaff.siteId}
                onChange={(e) => setNewStaff({ ...newStaff, siteId: e.target.value, buildingId: '' })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">No Site (Unassigned)</option>
                {sites.filter(site => site.status !== 'On Hold' && site.status !== 'Completed')
                  .sort((a, b) => a.name.localeCompare(b.name))
                  .map(site => (
                  <option key={site.id} value={site.id}>{site.name}</option>
                ))}
              </select>
            </div>
            
            {newStaff.employmentType !== 'daily' && newStaff.siteId && (
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
            )}
            <div className="flex gap-3 mt-6">
              <button
                onClick={handleAddStaff}
                className="flex-1 bg-blue-500 text-white py-2 rounded-lg hover:bg-blue-600 transition-colors"
              >
                Add Staff
              </button>
              <button
                onClick={() => {
                  setNewStaff({ name: '', role: '', dailyWage: '', phone: '', siteId: '', buildingId: '', employmentType: 'permanent', dailyWorkerCount: 0 })
                  setShowAddStaffModal(false)
                }}
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
                value={editStaff.employmentType}
                onChange={(e) => setEditStaff({ ...editStaff, employmentType: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="permanent">Permanent Staff</option>
                <option value="contract">Contract Worker</option>
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Select Site (Optional)</label>
              <select
                value={editStaff.siteId}
                onChange={(e) => setEditStaff({ ...editStaff, siteId: e.target.value, buildingId: '' })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">No Site (Unassigned)</option>
                {sites.filter(site => site.status !== 'On Hold' && site.status !== 'Completed')
                  .sort((a, b) => a.name.localeCompare(b.name))
                  .map(site => (
                  <option key={site.id} value={site.id}>{site.name}</option>
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