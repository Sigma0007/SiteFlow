import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Building2, Users, Package, FileText, TrendingUp, Plus, MapPin, UserPlus, UserIcon, Package as PackageIcon, DollarSign, Search, X, PlusSquare, LogOut, ArrowLeft } from 'lucide-react'
import { siteServices, buildingServices, labourServices, materialServices, purchaseOrderServices, attendanceServices, dprServices, processServices, convertDocsToArray, supervisorServices, syncSiteToSupervisors, syncSingleStaffToSite } from '../services/firebaseServices'
import { onSnapshot, collection, query, where, doc } from 'firebase/firestore'
import { storage, db } from '../firebase'
import { useSupervisor } from '../contexts/SupervisorContext.jsx'
import { useAuth } from '../components/Auth'
import storageService from '../services/storageService'
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'
import Footer from '../components/Footer'
import { useNavigate } from 'react-router-dom'
import StatusModal from '../components/StatusModal'

const Dashboard = ({ userRole }) => {
  const navigate = useNavigate()
  const { currentSupervisor, assignedSites } = useSupervisor()
  const { user, logout } = useAuth()
  const [loading, setLoading] = useState(true)
  const [currentTime, setCurrentTime] = useState(new Date())
  const [showDPRFlow, setShowDPRFlow] = useState(false)
  const [dprStep, setDprStep] = useState(1)
  const [sites, setSites] = useState([])
  const [buildings, setBuildings] = useState([])
  const [staff, setStaff] = useState([])
  const [attendance, setAttendance] = useState([])
  const [materials, setMaterials] = useState([])
  const [dprRecords, setDprRecords] = useState([])
  const [supervisorsList, setSupervisorsList] = useState([]) // for admin supervisor picker
  const [quickExpenseSite, setQuickExpenseSite] = useState(null)
  const [quickExpenseAmount, setQuickExpenseAmount] = useState('')
  const [quickExpenseDescription, setQuickExpenseDescription] = useState('')
  const [quickExpenseFor, setQuickExpenseFor] = useState('')
  const [quickStaffSite, setQuickStaffSite] = useState(null)
  const [staffSearchTerm, setStaffSearchTerm] = useState('')
  const [dprFormData, setDprFormData] = useState({
    siteName: '',
    siteArea: '',
    siteLocation: '',
    buildingId: '',
    buildingType: 'Mixed Use',
    assignedSupervisors: [], // Supervisor doc IDs selected by admin
    // Building details (align with DPR page)
    buildingFloors: 1,
    buildingUnits: 1,
    buildingArea: '',
    buildingBudget: 0,
    buildingProgress: 0,
    buildingStatus: 'Active',
    buildingImage: '',
    selectedStaff: [],
    selectedMaterials: [],
    materialQuantities: {}
  })
  const [kpiData, setKpiData] = useState({
    activeSites: 0,
    totalLabour: 0,
    materialStock: 0,
    pendingPOs: 0
  })
  const [previousMonthData, setPreviousMonthData] = useState({
    activeSites: 0,
    totalLabour: 0,
    materialStock: 0,
    pendingPOs: 0
  })

  // Status Modal State
  const [statusModal, setStatusModal] = useState({
    visible: false,
    type: 'success',
    title: '',
    message: '',
    onConfirm: null,
    onCancel: null
  })

  const showAlert = (title, message, type = 'success') => {
    setStatusModal({ 
      visible: true, 
      type, 
      title, 
      message, 
      onConfirm: () => setStatusModal(prev => ({ ...prev, visible: false })) 
    })
  }

  const showConfirm = (title, message, onConfirm) => {
    setStatusModal({ 
      visible: true, 
      type: 'confirm', 
      title, 
      message, 
      onConfirm: () => {
        onConfirm();
        setStatusModal(prev => ({ ...prev, visible: false }));
      },
      onCancel: () => setStatusModal(prev => ({ ...prev, visible: false }))
    })
  }

  const dprSteps = [
    { id: 1, title: 'Create Site', icon: MapPin },
    { id: 2, title: 'Add Materials', icon: PackageIcon }
  ]

  // Helper function to get buildings for selected site
  const getBuildingsForSite = (siteId) => {
    if (!siteId) return []
    return buildings.filter(building => building.siteId === siteId)
  }

  // Real-time clock update
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date())
    }, 1000)

    return () => clearInterval(timer)
  }, [])

  // Load real data from Firebase in Real-Time
  useEffect(() => {
    let unsubscribers = []

    setLoading(true)

    if (userRole === 'supervisor') {
      if (!currentSupervisor) {
        setLoading(false)
        return
      }

      setSites(assignedSites)

      if (assignedSites.length === 0) {
        setBuildings([]); setStaff([]); setAttendance([]); setMaterials([]); setDprRecords([])
        setLoading(false)
        return
      }

      const assignedSiteIds = assignedSites.map(site => site.id)
      const today = new Date().toISOString().split('T')[0]

      // Setup state containers for mapping multiple snapshot merges
      const buildingsMap = {}
      const staffMap = {}
      const dprMap = {}
      const attendanceMap = {}

      assignedSiteIds.forEach(id => {
        unsubscribers.push(
          onSnapshot(query(collection(db, 'buildings'), where('siteId', '==', id)), (snap) => {
            buildingsMap[id] = convertDocsToArray(snap)
            setBuildings(Object.values(buildingsMap).flat())
          })
        )
        unsubscribers.push(
          onSnapshot(query(collection(db, 'labour'), where('siteId', '==', id)), (snap) => {
            staffMap[id] = convertDocsToArray(snap)
            setStaff(Object.values(staffMap).flat())
          })
        )
        unsubscribers.push(
          onSnapshot(query(collection(db, 'dpr'), where('siteId', '==', id)), (snap) => {
            dprMap[id] = convertDocsToArray(snap)
            setDprRecords(Object.values(dprMap).flat())
          })
        )
        unsubscribers.push(
          onSnapshot(query(collection(db, 'attendance'), where('siteId', '==', id), where('date', '==', today)), (snap) => {
            attendanceMap[id] = convertDocsToArray(snap)
            setAttendance(Object.values(attendanceMap).flat())
          })
        )
      })

      // Materials are global
      unsubscribers.push(
        onSnapshot(collection(db, 'materials'), (snap) => {
          setMaterials(convertDocsToArray(snap))
        })
      )
      
      setLoading(false)
    } else {
      // Admin sees all data
      const today = new Date().toISOString().split('T')[0]

      unsubscribers.push(
        onSnapshot(collection(db, 'sites'), (snap) => setSites(convertDocsToArray(snap))),
        onSnapshot(collection(db, 'buildings'), (snap) => setBuildings(convertDocsToArray(snap))),
        onSnapshot(collection(db, 'labour'), (snap) => setStaff(convertDocsToArray(snap))),
        onSnapshot(collection(db, 'materials'), (snap) => setMaterials(convertDocsToArray(snap))),
        onSnapshot(collection(db, 'dpr'), (snap) => setDprRecords(convertDocsToArray(snap))),
        onSnapshot(query(collection(db, 'attendance'), where('date', '==', today)), (snap) => setAttendance(convertDocsToArray(snap))),
        onSnapshot(query(collection(db, 'supervisors'), where('status', '==', 'active')), (snap) => setSupervisorsList(convertDocsToArray(snap)))
      )

      setLoading(false)
    }

    return () => {
      unsubscribers.forEach(unsub => unsub())
    }
  }, [userRole, currentSupervisor, assignedSites])

  // Filter staff by attendance status and DPR assignments
  const getStaffByAttendance = () => {
    const today = new Date().toISOString().split('T')[0]

    // Check if staff array has valid data
    if (!staff || staff.length === 0) {
      return {
        present: { supervisors: [], workers: [] },
        assigned: { supervisors: [], workers: [] },
        absent: []
      }
    }

    // TEMPORARY: Show all staff as present for testing
    // Remove this later when attendance is properly set up
    const presentStaff = staff.length > 0 ? staff : []
    const absentStaff = [] // No absent staff for testing

    // Check which staff are already assigned to other DPRs today
    const assignedStaffIds = dprRecords
      .filter(dpr => {
        // Basic date and status filter
        const basicFilter = dpr.date === today &&
          (dpr.status === 'submitted' || dpr.status === 'approved') &&
          !dpr.is_deleted

        if (!basicFilter) return false

        // Check if the site exists and is not deleted
        if (!dpr.siteId) return false // No site ID

        const relatedSite = sites.find(site => site.id === dpr.siteId)
        if (!relatedSite) return false // Site not found in sites list
        if (relatedSite.is_deleted) return false // Site is deleted

        return true // Valid DPR with existing, non-deleted site
      })
      .flatMap(dpr => dpr.selectedStaff || [])

    // Debug: Show which DPRs are blocking assignment
    const blockingDPRs = dprRecords.filter(dpr => {
      const basicFilter = dpr.date === today &&
        (dpr.status === 'submitted' || dpr.status === 'approved') &&
        !dpr.is_deleted

      if (!basicFilter) return false

      if (!dpr.siteId) return false

      const relatedSite = sites.find(site => site.id === dpr.siteId)
      if (!relatedSite || relatedSite.is_deleted) return false

      return true
    })

    console.log('DPR Assignment Filter - Debug Info:', {
      totalDPRsToday: dprRecords.filter(dpr => dpr.date === today).length,
      validDPRs: blockingDPRs.length,
      totalSites: sites.length,
      deletedSites: sites.filter(site => site.is_deleted).length,
      blockingDPRs: blockingDPRs.map(dpr => ({
        id: dpr.id,
        siteId: dpr.siteId,
        siteName: dpr.siteName,
        status: dpr.status,
        selectedStaff: dpr.selectedStaff
      }))
    })

    console.log('Assigned staff IDs from valid DPRs with existing sites:', assignedStaffIds)

    // For present staff: separate available vs assigned
    const availablePresentStaff = presentStaff.filter(staffMember => {
      const staffInfo = staff.find(person => person.id === staffMember.id)
      if (!staffInfo) return false
      const isSupervisor = staffInfo.role.toLowerCase().includes('supervisor')

      // Supervisors can be assigned to multiple sites - always available
      if (isSupervisor) return true

      // Workers are unavailable if assigned to any site
      return !assignedStaffIds.includes(staffMember.id)
    })

    const assignedPresentStaff = presentStaff.filter(staffMember => {
      const staffInfo = staff.find(person => person.id === staffMember.id)
      if (!staffInfo) return false
      const isSupervisor = staffInfo.role.toLowerCase().includes('supervisor')

      // Supervisors are never considered "assigned" in UI (they can work multiple sites)
      if (isSupervisor) return false

      // Workers are assigned only if they're in VALID DPRs (submitted/approved with site)
      return assignedStaffIds.includes(staffMember.id)
    })

    // Categorize by role
    const availableSupervisors = availablePresentStaff.filter(person =>
      person.role && person.role.toLowerCase().includes('supervisor')
    )
    const availableWorkers = availablePresentStaff.filter(person =>
      person.role && !person.role.toLowerCase().includes('supervisor')
    )
    const assignedSupervisors = assignedPresentStaff.filter(person =>
      person.role && person.role.toLowerCase().includes('supervisor')
    )
    const assignedWorkers = assignedPresentStaff.filter(person =>
      person.role && !person.role.toLowerCase().includes('supervisor')
    )

    return {
      present: {
        supervisors: availableSupervisors,
        workers: availableWorkers
      },
      assigned: {
        supervisors: assignedSupervisors,
        workers: assignedWorkers
      },
      absent: absentStaff
    }
  }

  // Check if any staff is already assigned to selected site (1 staff per site rule)
  const isStaffAssigned = (staffId, siteId) => {
    return dprRecords.some(dpr =>
      dpr.siteId === siteId &&
      dpr.selectedStaff &&
      dpr.selectedStaff.includes(staffId)
    )
  }

  // Check if selecting this staff would conflict with already selected staff for the same site
  const hasStaffConflict = (staffId) => {
    if (!dprFormData.siteName) return false

    const staffMember = staff.find(person => person.id === staffId)
    const isSupervisor = staffMember.role.toLowerCase().includes('supervisor')

    // Supervisors can be assigned to multiple sites - no conflict
    if (isSupervisor) return false

    // For workers, check if already assigned to any VALID DPR today
    const today = new Date().toISOString().split('T')[0]
    const workerAssignedToValidDPR = dprRecords
      .filter(dpr => {
        // Basic date and status filter
        const basicFilter = dpr.date === today &&
          (dpr.status === 'submitted' || dpr.status === 'approved') &&
          !dpr.is_deleted

        if (!basicFilter) return false

        // Check if the site exists and is not deleted
        if (!dpr.siteId) return false // No site ID

        const relatedSite = sites.find(site => site.id === dpr.siteId)
        if (!relatedSite) return false // Site not found in sites list
        if (relatedSite.is_deleted) return false // Site is deleted

        return true // Valid DPR with existing, non-deleted site
      })
      .some(dpr => dpr.selectedStaff && dpr.selectedStaff.includes(staffId))

    // If this worker is already selected for current DPR, no conflict
    if (dprFormData.selectedStaff.includes(staffId)) return false

    // If worker is already assigned to any valid DPR, there's a conflict
    return workerAssignedToValidDPR
  }

  // Check if selecting this supervisor would conflict with already selected supervisors
  const hasSupervisorConflict = (supervisorId) => {
    if (!dprFormData.siteName) return false

    const selectedSupervisors = dprFormData.selectedStaff.filter(staffId => {
      const staffMember = staff.find(person => person.id === staffId)
      return staffMember && staffMember.role.toLowerCase().includes('supervisor')
    })

    // If no supervisors selected yet, no conflict
    if (selectedSupervisors.length === 0) return false

    // If this supervisor is already selected, no conflict
    if (selectedSupervisors.includes(supervisorId)) return false

    // If trying to select a second supervisor, there's a conflict
    return true
  }

  // Enhanced staff toggle with staff validation (supervisors: multi-site, workers: single site)
  const handleStaffToggle = (staffId) => {
    const staffMember = staff.find(person => person.id === staffId)
    const isSupervisor = staffMember.role.toLowerCase().includes('supervisor')

    // Check for supervisor conflict (only within current DPR)
    if (isSupervisor && hasSupervisorConflict(staffId)) {
      alert('Only one supervisor can be assigned per DPR. Please deselect the current supervisor first.')
      return
    }

    // Check for worker conflict (single site assignment)
    if (!isSupervisor && hasStaffConflict(staffId)) {
      alert('This worker is already assigned to another site. Workers can only be assigned to one site.')
      return
    }

    // Toggle selection
    if (dprFormData.selectedStaff.includes(staffId)) {
      setDprFormData({
        ...dprFormData,
        selectedStaff: dprFormData.selectedStaff.filter(id => id !== staffId)
      })
    } else {
      setDprFormData({
        ...dprFormData,
        selectedStaff: [...dprFormData.selectedStaff, staffId]
      })
    }
  }

  // Submit DPR and save staff assignments to Firebase
  const handleDPRSubmit = async () => {
    try {
      const today = new Date().toISOString().split('T')[0]

      // First, create the site in Firebase
      const siteData = {
        name: dprFormData.siteName,
        area: dprFormData.siteArea,
        location: dprFormData.siteLocation,
        status: 'active',
        createdAt: new Date().toISOString(),
        createdBy: userRole,
        progress: 0
      }

      const siteDoc = await siteServices.addSite(siteData)
      const createdSiteId = siteDoc.id

      // Bidirectional sync: assign supervisors to this site
      if (dprFormData.assignedSupervisors && dprFormData.assignedSupervisors.length > 0) {
        await syncSiteToSupervisors(createdSiteId, dprFormData.assignedSupervisors)
      }

      // Then create the DPR with the site reference
      const newDPR = {
        date: today,
        siteName: dprFormData.siteName,
        siteArea: dprFormData.siteArea,
        siteLocation: dprFormData.siteLocation,
        siteId: createdSiteId,
        // Building details captured from Step 1
        buildingName: dprFormData.buildingId,
        buildingType: dprFormData.buildingType,
        buildingFloors: dprFormData.buildingFloors,
        buildingUnits: dprFormData.buildingUnits,
        buildingArea: dprFormData.buildingArea,
        buildingBudget: dprFormData.buildingBudget,
        buildingProgress: dprFormData.buildingProgress,
        buildingStatus: dprFormData.buildingStatus,
        buildingImage: dprFormData.buildingImage,
        selectedStaff: dprFormData.selectedStaff,
        selectedMaterials: dprFormData.selectedMaterials,
        materialQuantities: dprFormData.materialQuantities,
        createdAt: new Date().toISOString(),
        createdBy: userRole,
        status: 'submitted', // Changed from 'active' to 'submitted'
        is_deleted: false
      }

      // Save DPR to Firebase
      await dprServices.addDPR(newDPR)

      // Reset form
      setDprFormData({
        siteName: '',
        siteArea: '',
        siteLocation: '',
        buildingId: '',
        buildingType: 'Mixed Use',
        assignedSupervisors: [],
        buildingFloors: 1,
        buildingUnits: 1,
        buildingArea: '',
        buildingBudget: 0,
        buildingProgress: 0,
        buildingStatus: 'Active',
        buildingImage: '',
        selectedStaff: [],
        selectedMaterials: [],
        materialQuantities: {}
      })
      setDprStep(1)
      setShowDPRFlow(false)

      alert('Site and DPR created successfully!')
    } catch (error) {
      console.error('Error creating site and DPR:', error)
      alert('Error creating site and DPR. Please try again.')
    }
  }

  // DPR Handler functions
  const handleDPRNextStep = () => {
    if (dprStep < dprSteps.length) {
      setDprStep(dprStep + 1)
    }
  }

  const handleDPRPrevStep = () => {
    if (dprStep > 1) {
      setDprStep(dprStep - 1)
    }
  }

  const handleOpenExpenseModal = (siteId) => {
    setQuickExpenseSite(siteId);
    setQuickExpenseAmount('');
    setQuickExpenseDescription('');
    setQuickExpenseFor('');
  };

  const handleSaveQuickExpense = async () => {
    if (!quickExpenseAmount) return;
    const expenseAmount = parseInt(quickExpenseAmount);
    if (isNaN(expenseAmount) || expenseAmount <= 0) {
      alert("Invalid amount entered.");
      return;
    }
    try {
      const site = sites.find(s => s.id === quickExpenseSite);
      const newExpense = {
        amount: expenseAmount,
        expenseFor: quickExpenseFor,
        description: quickExpenseDescription,
        date: new Date().toISOString(),
        siteId: quickExpenseSite,
        siteName: site.name
      };

      // Get current expenses array or create new one
      const currentExpenses = site.expenses || [];
      const updatedExpenses = [...currentExpenses, newExpense];

      await siteServices.updateSite(quickExpenseSite, {
        expenses: updatedExpenses,
        totalExpenses: updatedExpenses.reduce((sum, exp) => sum + exp.amount, 0)
      });

      setSites(sites.map(s => s.id === quickExpenseSite ? {
        ...s,
        expenses: updatedExpenses,
        totalExpenses: updatedExpenses.reduce((sum, exp) => sum + exp.amount, 0)
      } : s));

      setQuickExpenseSite(null);
      alert("Expense added successfully!");
    } catch (err) {
      alert("Failed to add expense: " + err.message);
    }
  };

  const handleToggleQuickStaff = async (siteId, staffId, isAdding) => {
    try {
      await syncSingleStaffToSite(staffId, isAdding ? siteId : null);

      // Update sites state — add/remove staffId from assignedStaff
      setSites(prev => prev.map(s => {
        const cleanedOld = (s.assignedStaff || []).filter(id => id !== staffId);
        if (isAdding && s.id === siteId) {
          return { ...s, assignedStaff: [...cleanedOld, staffId] };
        }
        return { ...s, assignedStaff: cleanedOld };
      }));

      // Also update the staff list's siteId so that modal badge refreshes instantly
      setStaff(prev => prev.map(s => {
        if (s.id !== staffId) return s;
        return { ...s, siteId: isAdding ? siteId : null };
      }));
    } catch (err) {
      alert("Operation failed: " + err.message);
    }
  };

  const handleMaterialQuantityChange = (materialId, quantity) => {
    setDprFormData(prev => ({
      ...prev,
      materialQuantities: {
        ...prev.materialQuantities,
        [materialId]: quantity
      }
    }))
  }

  const handleMaterialToggle = (materialId) => {
    setDprFormData(prev => ({
      ...prev,
      selectedMaterials: prev.selectedMaterials.includes(materialId)
        ? prev.selectedMaterials.filter(id => id !== materialId)
        : [...prev.selectedMaterials, materialId]
    }))
  }

  const handleDprBuildingImageUpload = async (e) => {
    const file = e.target.files[0]
    if (!file) return

    // Validate file
    if (!file.type.startsWith('image/')) {
      alert('Please select an image file')
      return
    }

    if (file.size > 5 * 1024 * 1024) {
      alert('Image size should be less than 5MB')
      return
    }

    try {
      console.log('Starting Dashboard image upload...', file.name)
      const storageRef = ref(storage, `buildings/${Date.now()}-${file.name}`)
      const snapshot = await uploadBytes(storageRef, file)
      const downloadURL = await getDownloadURL(snapshot.ref)

      console.log('Dashboard image uploaded successfully:', downloadURL)
      setDprFormData(prev => ({
        ...prev,
        buildingImage: downloadURL
      }))
    } catch (error) {
      console.error('Error uploading Dashboard building image:', error)
      if (error.code === 'storage/unauthorized') {
        alert('Storage access denied. Please check Firebase Storage rules.')
      } else if (error.code === 'storage/cors-error') {
        alert('CORS error. Please configure Firebase Storage CORS.')
      } else {
        alert('Error uploading image: ' + error.message)
      }
    }
  }

  const handleAddBuilding = async () => {
    try {
      if (!newBuildingData.name.trim()) {
        alert('Please enter a building name')
        return
      }

      // Get selected site ID - handle both new site and existing site
      let selectedSiteId = sites.find(s => s.name === dprFormData.siteName)?.id

      // If no existing site found, this might be a new site being created
      if (!selectedSiteId) {
        // For new sites, use a temporary ID or create site first
        alert('Please save the site information first by clicking Next Step, then add building')
        return
      }

      const buildingData = {
        name: newBuildingData.name,
        type: newBuildingData.type,
        siteId: selectedSiteId,
        status: 'active',
        createdAt: new Date().toISOString(),
        createdBy: userRole
      }

      // Add building to Firebase
      await buildingServices.addBuilding(buildingData)

      // Refresh buildings list
      const buildingsSnapshot = await buildingServices.getAllBuildings()
      const buildingsData = convertDocsToArray(buildingsSnapshot)
      setBuildings(buildingsData)

      // Set the building name directly in form
      setDprFormData({ ...dprFormData, buildingId: newBuildingData.name })

      // Reset form and close modal
      setNewBuildingData({ name: '', type: 'Residential', siteId: '' })
      setShowAddBuildingModal(false)

    } catch (error) {
      console.error('Error adding building:', error)
      showAlert('Error', 'Error adding building. Please try again.', 'error')
    }
  }

  const handleSubmitDPRFlow = async () => {
    try {
      // First create the site in Firebase
      const siteData = {
        name: dprFormData.siteName,
        location: dprFormData.siteLocation,
        status: 'Active',
        budget: parseInt(dprFormData.buildingBudget) || 0,
        image: dprFormData.buildingImage || '',
        progress: parseInt(dprFormData.buildingProgress) || 0,
        createdAt: new Date().toISOString()
      }

      const siteRef = await siteServices.addSite(siteData)
      const siteId = siteRef.id
      console.log('✅ Site created with ID:', siteId)

      // Bidirectional sync: assign supervisors to this site
      if (dprFormData.assignedSupervisors && dprFormData.assignedSupervisors.length > 0) {
        await syncSiteToSupervisors(siteId, dprFormData.assignedSupervisors)
      }

      // Material Allocation
      let assignedMaterials = []
      if (dprFormData.selectedMaterials && dprFormData.selectedMaterials.length > 0) {
        for (const matId of dprFormData.selectedMaterials) {
          const qty = parseInt(dprFormData.materialQuantities[matId]) || 0;
          if (qty > 0) {
            const material = materials.find(m => m.id === matId);
            if (material) {
              // 1. Subtract from global
              await materialServices.updateMaterial(matId, {
                currentStock: Math.max(0, material.available - qty)
              });
              // 2. Add to site
              assignedMaterials.push({
                materialId: material.id,
                name: material.name,
                category: material.category,
                quantity: qty
              });
            }
          }
        }
        
        if (assignedMaterials.length > 0) {
          await siteServices.updateSite(siteId, { assignedMaterials });
        }
      }

      // Then create the building in Firebase
      if (dprFormData.buildingId) {
        const buildingData = {
          name: dprFormData.buildingId,
          type: dprFormData.buildingType || 'Mixed Use',
          siteId: siteId,
          floors: parseInt(dprFormData.buildingFloors) || 0,
          units: parseInt(dprFormData.buildingUnits) || 0,
          area: parseInt(dprFormData.buildingArea) || 0,
          budget: parseInt(dprFormData.buildingBudget) || 0,
          progress: parseInt(dprFormData.buildingProgress) || 0,
          status: dprFormData.buildingStatus || 'Active',
          image: dprFormData.buildingImage || '',
          createdAt: new Date().toISOString()
        }

        console.log('🏗️ Creating building with data:', buildingData)
        console.log('🏗️ Site ID for building:', siteId)

        const buildingResult = await buildingServices.addBuilding(buildingData)
        console.log('✅ Building created with ID:', buildingResult.id)

        // Verify building was created
        const allBuildings = await buildingServices.getAllBuildings()
        const buildingsList = convertDocsToArray(allBuildings)
        console.log('🏗️ All buildings after creation:', buildingsList)

        // Create default processes for the new building
        const defaultProcesses = [
          {
            name: "Foundation Work",
            description: "Building foundation and base structure preparation",
            status: "active",
            image: "",
            subProcesses: []
          },
          {
            name: "Structural Framework",
            description: "Main structural elements including columns, beams, and slabs",
            status: "active",
            image: "",
            subProcesses: []
          },
          {
            name: "Masonry Work",
            description: "Wall construction and brick/block laying",
            status: "active",
            image: "",
            subProcesses: []
          },
          {
            name: "Electrical Installation",
            description: "Electrical wiring, fixtures, and power systems",
            status: "active",
            image: "",
            subProcesses: []
          },
          {
            name: "Plumbing Works",
            description: "Water supply, drainage, and sanitary installations",
            status: "active",
            image: "",
            subProcesses: []
          },
          {
            name: "Interior Finishing",
            description: "Flooring, painting, and interior fixtures",
            status: "active",
            image: "",
            subProcesses: []
          },
          {
            name: "External Works",
            description: "Landscaping, external walls, and site development",
            status: "active",
            image: "",
            subProcesses: []
          }
        ]

        // Add default processes for the new building
        for (const defaultProcess of defaultProcesses) {
          const processToAdd = {
            ...defaultProcess,
            siteId: siteId,
            buildingId: buildingResult.id,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          }
          await processServices.addProcess(siteId, buildingResult.id, processToAdd)
        }
        console.log('🎉 Default processes created successfully for new building!')
      }

      // Close modal and reset form
      setShowDPRFlow(false)
      setDprStep(1)
      setDprFormData({
        siteName: '',
        siteArea: '',
        siteLocation: '',
        buildingId: '',
        buildingType: 'Mixed Use',
        buildingFloors: 1,
        buildingUnits: 1,
        buildingArea: '',
        buildingBudget: 0,
        buildingProgress: 0,
        buildingStatus: 'Active',
        buildingImage: '',
        selectedStaff: [],
        selectedMaterials: [],
        materialQuantities: {}
      })

      showAlert('Success', 'Site and building created successfully! They are now available in Site Management and Process Management.', 'success')

    } catch (error) {
      console.error('Error creating site and building:', error)
      showAlert('Error', 'Error creating site and building: ' + error.message, 'error')
    }
  }

  // Real-time data update from Firebase (admin only)
  useEffect(() => {
    // Supervisors get their KPI data from the main loadData useEffect above.
    // This uses full collection scans that only work for admins.
    if (userRole === 'supervisor') return

    const fetchRealTimeData = async () => {
      try {

        // Get current month data
        const currentDate = new Date()
        const currentMonth = currentDate.getMonth()
        const currentYear = currentDate.getFullYear()

        // Get previous month data for comparison
        const previousMonth = currentMonth === 0 ? 11 : currentMonth - 1
        const previousYear = currentMonth === 0 ? currentYear - 1 : currentYear

        // Load sites data
        const sitesSnapshot = userRole === 'supervisor' ? await siteServices.getSitesForSupervisor(user?.uid) : await siteServices.getAllSites()
        const sitesData = convertDocsToArray(sitesSnapshot)
        const activeSites = sitesData.filter(s => s.status === 'Active').length

        // Load labour data
        const labourSnapshot = await labourServices.getAllLabour()
        const labourData = convertDocsToArray(labourSnapshot)

        // Load material data
        const materialsSnapshot = await materialServices.getAllMaterials()
        const materialsData = convertDocsToArray(materialsSnapshot)
        const materialStock = materialsData.reduce((sum, m) => sum + (m.currentStock || 0), 0)

        // Load purchase orders data
        const poSnapshot = await purchaseOrderServices.getAllPurchaseOrders()
        const poData = convertDocsToArray(poSnapshot)
        const pendingPOs = poData.filter(po => po.status === 'Pending' || po.status === 'Approved').length

        // Get previous month attendance for labour comparison
        const prevMonthStart = `${previousYear}-${String(previousMonth + 1).padStart(2, '0')}-01`
        const prevMonthEnd = `${previousYear}-${String(previousMonth + 1).padStart(2, '0')}-31`
        const prevAttendanceSnapshot = await attendanceServices.getAttendanceByDateRange(prevMonthStart, prevMonthEnd)
        const prevAttendanceData = convertDocsToArray(prevAttendanceSnapshot)
        const prevActiveLabour = new Set(prevAttendanceData.map(a => a.employeeId).filter(Boolean)).size

        // Get current month attendance for labour comparison
        const currMonthStart = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-01`
        const currMonthEnd = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-31`
        const currAttendanceSnapshot = await attendanceServices.getAttendanceByDateRange(currMonthStart, currMonthEnd)
        const currAttendanceData = convertDocsToArray(currAttendanceSnapshot)
        const currActiveLabour = new Set(currAttendanceData.map(a => a.employeeId).filter(Boolean)).size

        setKpiData({
          activeSites,
          totalLabour: labourData.length,
          materialStock,
          pendingPOs
        })

        setPreviousMonthData({
          activeSites: Math.max(1, activeSites - 1), // Simulated previous month
          totalLabour: Math.max(1, prevActiveLabour),
          materialStock: Math.max(1, materialStock + 100), // Simulated previous month
          pendingPOs: Math.max(1, pendingPOs - 1) // Simulated previous month
        })

        setLoading(false)
      } catch (error) {
        console.error('Error loading real-time data:', error)
        setLoading(false)
      }
    }

    fetchRealTimeData()
    const realTimeTimer = setInterval(fetchRealTimeData, 30000)
    return () => clearInterval(realTimeTimer)
  }, [userRole])

  // Calculate trends
  const calculateTrend = (current, previous) => {
    if (previous === 0) return { percentage: 0, isUp: true }
    const change = current - previous
    const percentage = Math.abs((change / previous) * 100)
    return {
      percentage: Math.round(percentage),
      isUp: change >= 0,
      absoluteChange: change
    }
  }

  const kpiCards = [
    {
      title: 'Total Sites',
      value: sites.length,
      icon: Building2,
      color: 'bg-blue-500',
      trend: calculateTrend(sites.length, Math.max(1, sites.length - 1)),
      trendUp: calculateTrend(sites.length, Math.max(1, sites.length - 1)).isUp
    },
    {
      title: 'Active Sites',
      value: kpiData.activeSites,
      icon: Building2,
      color: 'bg-green-500',
      trend: calculateTrend(kpiData.activeSites, previousMonthData.activeSites),
      trendUp: calculateTrend(kpiData.activeSites, previousMonthData.activeSites).isUp
    },
    {
      title: 'Total Labour',
      value: kpiData.totalLabour,
      icon: Users,
      color: 'bg-purple-500',
      trend: calculateTrend(kpiData.totalLabour, previousMonthData.totalLabour),
      trendUp: calculateTrend(kpiData.totalLabour, previousMonthData.totalLabour).isUp
    },
    {
      title: 'Material Stock',
      value: kpiData.materialStock,
      icon: Package,
      color: 'bg-orange-500',
      trend: calculateTrend(kpiData.materialStock, previousMonthData.materialStock),
      trendUp: calculateTrend(kpiData.materialStock, previousMonthData.materialStock).isUp
    }
  ]

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
          className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full"
        />
      </div>
    )
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 lg:space-y-8">
      {/* Mobile-First Header & Profile Section */}
      <div className="flex flex-col md:flex-row justify-between items-center gap-6 mb-8 bg-white p-6 rounded-[2rem] shadow-sm border border-gray-100">
        <div className="text-center md:text-left">
          <h1 className="text-3xl sm:text-4xl font-black text-gray-900 tracking-tight">Dashboard</h1>
          <p className="text-gray-500 font-medium mt-1">
            Welcome back, <span className="text-blue-600 font-bold">{user?.email?.split('@')[0] || 'User'}</span>
          </p>
        </div>

        {/* User Profile Card (Moved from Sidebar) */}
        <div className="flex items-center gap-4 bg-blue-50/50 p-4 rounded-3xl border border-blue-100/50 backdrop-blur-sm">
          <div className="w-12 h-12 bg-gradient-to-tr from-blue-600 to-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-blue-200">
            <UserIcon className="w-6 h-6" />
          </div>
          <div className="hidden sm:block">
            <p className="text-[10px] font-black text-blue-400 uppercase tracking-[0.2em] mb-0.5">Logged in as</p>
            <p className="text-sm font-black text-gray-900 leading-none mb-1">{user?.email?.split('@')[0]}</p>
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
              <p className="text-[11px] font-bold text-gray-500 capitalize">{userRole} • Active Account</p>
            </div>
          </div>
        </div>
      </div>

      {/* Comprehensive Action Hub Grid */}
      <div className=" flex flex-col justify-center max-w-4xl mx-auto w-full py-6 space-y-8">

        {/* Main Hero Group */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <motion.div
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => navigate('/dpr')}
            className="bg-gradient-to-br from-indigo-600 via-indigo-700 to-blue-700 p-8 rounded-[2.5rem] shadow-2xl flex items-center justify-between cursor-pointer text-white relative overflow-hidden group"
          >
            <div className="absolute top-0 right-0 -mr-8 -mt-8 w-32 h-32 bg-white/10 rounded-full blur-3xl group-hover:bg-white/20 transition-colors" />
            <div className="flex items-center gap-5 relative z-10">
              <div className="bg-white/20 p-5 rounded-3xl backdrop-blur-xl border border-white/30 shadow-inner">
                <FileText className="w-10 h-10 text-white" />
              </div>
              <div>
                <h2 className="text-2xl font-black tracking-tight">DPR Report</h2>
                <p className="text-indigo-100 font-medium opacity-90">Daily Updates</p>
              </div>
            </div>
            <div className="bg-white/20 p-3 rounded-full backdrop-blur-md">
              <Plus className="w-6 h-6" />
            </div>
          </motion.div>

          {/* New Site Tile for Admins */}
          {userRole === 'admin' && (
            <motion.div
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setShowDPRFlow(true)}
              className="bg-gradient-to-br from-emerald-500 to-teal-600 p-8 rounded-[2.5rem] shadow-2xl flex items-center justify-between cursor-pointer text-white relative overflow-hidden group"
            >
              <div className="flex items-center gap-5 relative z-10">
                <div className="bg-white/20 p-5 rounded-3xl backdrop-blur-xl border border-white/30 shadow-inner">
                  <Building2 className="w-10 h-10 text-white" />
                </div>
                <div>
                  <h2 className="text-2xl font-black tracking-tight uppercase">New Site</h2>
                  <p className="text-emerald-100 font-medium opacity-90">Create Site/Area</p>
                </div>
              </div>
              <Plus className="w-8 h-8 opacity-50" />
            </motion.div>
          )}
        </div>

        {/* Action Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            ...(userRole === 'admin' ? [
              { icon: Users, label: 'Attendance', path: '/attendance', color: 'bg-emerald-500', desc: 'STAKEHOLDERS' }
            ] : []),
            ...(userRole === 'admin' ? [
              { icon: Building2, label: 'Management', path: '/sites', color: 'bg-blue-500', desc: 'SITES' }
            ] : []),
            ...(userRole === 'admin' ? [
              { icon: Package, label: 'Inventory', path: '/materials', color: 'bg-orange-500', desc: 'MATERIALS' }
            ] : []),
            { icon: DollarSign, label: 'PO Requests', path: '/po-requests', color: 'bg-amber-500', desc: 'PURCHASES' },
            // ...(userRole === 'admin' ? [
            //   { icon: TrendingUp, label: 'Reports', path: '/reports', color: 'bg-indigo-500', desc: 'ANALYTICS' },
            //   { icon: UserPlus, label: 'Supervisors', path: '/supervisor-management', color: 'bg-purple-500', desc: 'TEAM' }
            // ] : []),
            {
              icon: LogOut,
              label: 'Logout',
              action: () => {
                showConfirm(
                  'Confirm Logout',
                  'Are you sure you want to logout from your account?',
                  async () => {
                    await logout();
                    navigate('/login');
                  }
                );
              },
              color: 'bg-slate-400',
              desc: 'EXIT'
            }
          ].map((item) => (
            <motion.div
              key={item.label}
              whileHover={{ y: -5, scale: 1.02 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => item.path ? navigate(item.path) : item.action()}
              className="bg-white p-6 rounded-[2rem] border border-gray-100 shadow-xl flex flex-col items-center justify-center gap-4 cursor-pointer group active:bg-gray-50"
            >
              <div className={`${item.color} p-4 rounded-2xl text-white shadow-lg group-hover:rotate-6 transition-transform`}>
                <item.icon className="w-6 h-6" />
              </div>
              <div className="text-center">
                <p className="font-extrabold text-gray-900 text-sm leading-tight uppercase">{item.label}</p>
                <p className="text-[9px] text-gray-400 font-black tracking-widest mt-1 opacity-60">{item.desc}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* DPR Flow Modal */}
      {showDPRFlow && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
          onClick={() => setShowDPRFlow(false)}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto"
          >
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-black text-gray-900 uppercase">ADD NEW SITE</h2>
                <p className="text-gray-500 font-medium">Quick 2-step setup: Site Details & Materials</p>
              </div>
              <button
                onClick={() => setShowDPRFlow(false)}
                className="p-2.5 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors"
              >
                <X className="w-5 h-5 text-gray-600" />
              </button>
            </div>

            {/* Progress Steps */}
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                {dprSteps.map((step, index) => {
                  const Icon = step.icon
                  const isActive = step.id === dprStep
                  const isCompleted = step.id < dprStep

                  return (
                    <div key={step.id} className="flex items-center">
                      <div className={`flex items-center justify-center w-10 h-10 rounded-full border-2 transition-colors ${isActive
                        ? 'border-blue-500 bg-blue-500 text-white'
                        : isCompleted
                          ? 'border-green-500 bg-green-500 text-white'
                          : 'border-gray-300 text-gray-500'
                        }`}>
                        <Icon className="w-5 h-5" />
                      </div>
                      <div className="ml-3 hidden sm:block">
                        <p className={`text-sm font-medium ${isActive ? 'text-blue-600' : isCompleted ? 'text-green-600' : 'text-gray-500'
                          }`}>
                          {step.title}
                        </p>
                      </div>
                      {index < dprSteps.length - 1 && (
                        <div className={`w-full sm:w-24 h-0.5 mx-4 ${step.id < dprStep ? 'bg-green-500' : 'bg-gray-300'
                          }`} />
                      )}
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Step Content */}
            <div className="p-6">
              {dprStep === 1 && (
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-gray-900">Step 1: Create Site</h3>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Site Name *</label>
                    <input
                      type="text"
                      value={dprFormData.siteName}
                      onChange={(e) => setDprFormData({ ...dprFormData, siteName: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Enter site name"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Location *</label>
                    <input
                      type="text"
                      value={dprFormData.siteLocation}
                      onChange={(e) => setDprFormData({ ...dprFormData, siteLocation: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="e.g., Downtown, City Center"
                    />
                  </div>

                  {/* Supervisor Assignment — Commented out per user request
                  {userRole === 'admin' && supervisorsList.length > 0 && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Assign Supervisors
                        <span className="text-xs text-gray-400 font-normal ml-2">(supervisor will see this site on their dashboard)</span>
                      </label>
                      <div className="space-y-2 max-h-32 overflow-y-auto border border-gray-200 rounded-lg p-3 bg-gray-50">
                        {supervisorsList.map((sup) => (
                          <label key={sup.id} className="flex items-center gap-2 text-sm cursor-pointer">
                            <input
                              type="checkbox"
                              checked={(dprFormData.assignedSupervisors || []).includes(sup.id)}
                              onChange={(e) => {
                                const current = dprFormData.assignedSupervisors || []
                                setDprFormData({
                                  ...dprFormData,
                                  assignedSupervisors: e.target.checked
                                    ? [...current, sup.id]
                                    : current.filter(id => id !== sup.id)
                                })
                              }}
                              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                            />
                            <span className="font-medium">{sup.name}</span>
                            <span className="text-gray-400 text-xs">{sup.email}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}
                  */}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t border-gray-200 pt-4 mt-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Building Name (Optional)</label>
                      <input
                        type="text"
                        value={dprFormData.buildingId}
                        onChange={(e) => setDprFormData({ ...dprFormData, buildingId: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="e.g., Tower A"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Floors (Optional)</label>
                      <input
                        type="number"
                        min="1"
                        value={dprFormData.buildingFloors}
                        onChange={(e) => setDprFormData({ ...dprFormData, buildingFloors: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="1"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Total Area (Sq Ft) (Optional)</label>
                      <input
                        type="number"
                        min="0"
                        value={dprFormData.buildingArea}
                        onChange={(e) => setDprFormData({ ...dprFormData, buildingArea: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="e.g., 5000"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Price Budget (₹) (Optional)</label>
                      <input
                        type="number"
                        min="0"
                        value={dprFormData.buildingBudget}
                        onChange={(e) => setDprFormData({ ...dprFormData, buildingBudget: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="e.g., 1000000"
                      />
                    </div>
                  </div>

                </div>
              )}

              {dprStep === 2 && (
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-gray-900">Step 2: Add Materials</h3>
                  <div className="space-y-3">
                    {materials.map(material => (
                      <div key={material.id} className="p-4 border border-gray-200 rounded-lg">
                        <div className="flex items-center justify-between mb-3">
                          <div>
                            <p className="font-medium text-gray-900">{material.name}</p>
                            <p className="text-sm text-gray-600">Available: {material.available} {material.unit}</p>
                          </div>
                          <motion.button
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => handleMaterialToggle(material.id)}
                            className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${dprFormData.selectedMaterials.includes(material.id)
                              ? 'bg-blue-500 text-white'
                              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                              }`}
                          >
                            {dprFormData.selectedMaterials.includes(material.id) ? 'Added' : 'Add'}
                          </motion.button>
                        </div>
                        {dprFormData.selectedMaterials.includes(material.id) && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            className="mt-3"
                          >
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Required Quantity ({material.unit})
                            </label>
                            <input
                              type="number"
                              min="1"
                              max={material.available}
                              value={dprFormData.materialQuantities[material.id] || ''}
                              onChange={(e) => handleMaterialQuantityChange(material.id, e.target.value)}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                              placeholder="Enter quantity"
                            />
                          </motion.div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Navigation Buttons */}
            <div className="p-6 border-t border-gray-200 flex justify-between">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleDPRPrevStep}
                disabled={dprStep === 1}
                className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Previous
              </motion.button>

              {dprStep === dprSteps.length ? (
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleSubmitDPRFlow}
                  className="px-6 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg font-medium"
                >
                  Create Site & Building
                </motion.button>
              ) : (
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleDPRNextStep}
                  className="px-6 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-medium"
                >
                  Next Step
                </motion.button>
              )}
            </div>
          </motion.div>
        </motion.div >
      )}

      <AnimatePresence>
        {quickExpenseSite && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-[60]"
            onClick={() => setQuickExpenseSite(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden"
            >
              <div className="p-5 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
                <h3 className="font-bold text-gray-800 text-lg flex items-center gap-2"><DollarSign className="w-5 h-5 text-red-500" /> Add Expense</h3>
                <button onClick={() => setQuickExpenseSite(null)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
              </div>
              <div className="p-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Amount (₹)</label>
                  <input
                    type="number" autoFocus min="1"
                    value={quickExpenseAmount}
                    onChange={(e) => setQuickExpenseAmount(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleSaveQuickExpense() }}
                    className="w-full text-lg px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none transition-shadow"
                    placeholder="e.g. 150"
                  />
                </div>

                <div className="mt-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Expense For</label>
                  <input
                    type="text"
                    value={quickExpenseFor}
                    onChange={(e) => setQuickExpenseFor(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                    placeholder="e.g., Cement, Steel, Labor"
                  />
                </div>

                <div className="mt-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Description (Optional)</label>
                  <input
                    type="text"
                    value={quickExpenseDescription}
                    onChange={(e) => setQuickExpenseDescription(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                    placeholder="e.g., For foundation work"
                  />
                </div>
              </div>
              <div className="p-4 bg-gray-50 border-t border-gray-100 flex gap-3">
                <button onClick={() => setQuickExpenseSite(null)} className="flex-1 py-2.5 bg-white border border-gray-300 rounded-lg font-medium text-gray-700 hover:bg-gray-50">Cancel</button>
                <button onClick={handleSaveQuickExpense} className="flex-1 py-2.5 bg-red-600 text-white rounded-lg font-bold hover:bg-red-700 shadow-sm focus:ring-4 focus:ring-red-500/30 transition-all">Add Expense</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {quickStaffSite && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-[60]"
            onClick={() => { setQuickStaffSite(null); setStaffSearchTerm(''); }}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[85vh] overflow-hidden"
            >
              <div className="p-5 border-b border-gray-100 bg-white flex items-center justify-between shrink-0">
                <h3 className="font-bold text-gray-900 text-xl flex items-center gap-2">
                  <Users className="w-5 h-5 text-blue-600" /> Site Staff Registry
                </h3>
                <button onClick={() => { setQuickStaffSite(null); setStaffSearchTerm(''); }} className="p-1.5 rounded-full hover:bg-gray-100 text-gray-500 transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-4 border-b border-gray-100 bg-gray-50 shrink-0">
                <div className="relative">
                  <Search className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text" autoFocus
                    value={staffSearchTerm}
                    onChange={(e) => setStaffSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 shadow-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                    placeholder="Search by worker name, role, phone..."
                  />
                </div>
              </div>

              <div className="p-2 overflow-y-auto flex-1 bg-gray-50">
                <div className="space-y-1.5 px-2 pb-4">
                  {staff
                    .filter(s => (s.name + s.role + s.phone).toLowerCase().includes(staffSearchTerm.toLowerCase()))
                    .sort((a, b) => (a.name || '').localeCompare(b.name || ''))
                    .map(st => {
                      const theSite = sites.find(s => s.id === quickStaffSite);
                      const isAssignedToThis = (theSite?.assignedStaff || []).includes(st.id);
                      const currentSiteInfo = st.siteId && st.siteId !== quickStaffSite ? sites.find(s => s.id === st.siteId) : null;

                      return (
                        <div
                          key={st.id}
                          className={`group flex items-center justify-between p-3.5 rounded-xl border-2 transition-all cursor-pointer ${isAssignedToThis ? 'bg-blue-50/50 border-blue-500 shadow-sm' : 'bg-white border-transparent hover:border-blue-200 shadow-sm'}`}
                          onClick={() => handleToggleQuickStaff(quickStaffSite, st.id, !isAssignedToThis)}
                        >
                          <div className="flex items-center gap-4">
                            <div className={`shrink-0 w-6 h-6 rounded border flex items-center justify-center transition-colors ${isAssignedToThis ? 'bg-blue-600 border-blue-600 text-white' : 'border-gray-300 bg-white group-hover:border-blue-400'}`}>
                              {isAssignedToThis && <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                            </div>
                            <div>
                              <h4 className={`text-base font-bold ${isAssignedToThis ? 'text-blue-900' : 'text-gray-900'}`}>{st.name}</h4>
                              <p className="text-sm text-gray-500 font-medium">{st.role} {st.phone ? `• ${st.phone}` : ''}</p>
                            </div>
                          </div>
                          {currentSiteInfo && !isAssignedToThis ? (
                            <span className="text-xs font-semibold px-2.5 py-1 bg-amber-100 text-amber-800 rounded-lg">Moves from: {currentSiteInfo.name}</span>
                          ) : isAssignedToThis ? (
                            <span className="text-xs font-bold px-2.5 py-1 bg-blue-100 text-blue-700 rounded-lg">Assigned</span>
                          ) : null}
                        </div>
                      );
                    })}
                  {staff.filter(s => (s.name + s.role).toLowerCase().includes(staffSearchTerm.toLowerCase())).length === 0 && (
                    <div className="text-center py-10 px-4 text-gray-500">
                      <Users className="w-10 h-10 mx-auto text-gray-300 mb-2" />
                      <p className="text-lg font-medium text-gray-600">No workers found</p>
                      <p className="text-sm">Try adjusting your search criteria</p>
                    </div>
                  )}
                </div>
              </div>
              <div className="p-4 border-t border-gray-200 bg-white shrink-0 flex justify-end">
                <button onClick={() => { setQuickStaffSite(null); setStaffSearchTerm(''); }} className="px-6 py-2.5 bg-blue-600 text-white rounded-xl font-bold shadow-md hover:bg-blue-700 hover:shadow-lg transition-all">Done Editing</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <StatusModal 
        {...statusModal} 
        onCancel={() => setStatusModal(prev => ({ ...prev, visible: false }))}
      />
      <Footer />
    </div >
  )
}

export default Dashboard
