import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Building2, Users, Package, FileText, TrendingUp, Plus, MapPin, UserIcon, Package as PackageIcon } from 'lucide-react'
import { siteServices, buildingServices, labourServices, materialServices, purchaseOrderServices, attendanceServices, dprServices, processServices, convertDocsToArray, supervisorServices, syncSiteToSupervisors } from '../services/firebaseServices'
import { useSupervisor } from '../contexts/SupervisorContext.jsx'
import { useAuth } from '../components/Auth'
import storageService from '../services/storageService'
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'
import { storage } from '../firebase'
import Footer from '../components/Footer'

const Dashboard = ({ userRole }) => {
  const { currentSupervisor, assignedSites } = useSupervisor()
  const { user } = useAuth()
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

  const dprSteps = [
    { id: 1, title: 'Create Site', icon: MapPin },
    { id: 2, title: 'Assign Staff', icon: UserIcon },
    { id: 3, title: 'Define Area', icon: TrendingUp },
    { id: 4, title: 'Add Materials', icon: PackageIcon }
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

  // Load real data from Firebase
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true)

        console.log('🔍 Dashboard loading data for role:', userRole)
        console.log('🔍 Current supervisor from context:', currentSupervisor)

        // Load sites
        if (userRole === 'supervisor') {
          // Guard: wait until SupervisorContext finishes resolving.
          // currentSupervisor is set first, then assignedSites resolves async.
          if (!currentSupervisor) {
            console.log('👷 Dashboard: supervisor context not ready yet, waiting...')
            setLoading(false)
            return
          }

          console.log('👷 Loading supervisor data for:', user?.email)
          console.log('📍 Assigned sites from context:', assignedSites.length, assignedSites.map(s => s.name))

          const sitesData = assignedSites
          setSites(sitesData)

          if (sitesData.length === 0) {
            console.log('👷 Dashboard: no assigned sites, showing empty state')
            setBuildings([]); setStaff([]); setAttendance([]); setMaterials([]); setDprRecords([])
            setLoading(false)
            return
          }

          const assignedSiteIds = sitesData.map(site => site.id)

          // Use per-site queries — full collection scans trigger permission errors
          // on documents belonging to other sites.
          const [buildingsResults, staffResults, dprResults] = await Promise.all([
            Promise.all(assignedSiteIds.map(id => buildingServices.getBuildingsBySite(id))),
            Promise.all(assignedSiteIds.map(id => labourServices.getLabourBySite(id))),
            Promise.all(assignedSiteIds.map(id => dprServices.getDPRBySiteId(id))),
          ])

          setBuildings(buildingsResults.flatMap(snap => convertDocsToArray(snap)))
          setStaff(staffResults.flatMap(snap => convertDocsToArray(snap)))
          setDprRecords(dprResults.flatMap(snap => convertDocsToArray(snap)))

          const today = new Date().toISOString().split('T')[0]
          const attendanceResults = await Promise.all(
            assignedSiteIds.map(id => attendanceServices.getAttendanceBySiteAndDate(id, today))
          )
          setAttendance(attendanceResults.flatMap(snap => convertDocsToArray(snap)))

          // Materials are global — supervisors can read all per Firestore rules
          const materialsSnapshot = await materialServices.getAllMaterials()
          setMaterials(convertDocsToArray(materialsSnapshot))
        } else {
          // Admin sees all data
          const sitesSnapshot = await siteServices.getAllSites()
          setSites(convertDocsToArray(sitesSnapshot))

          const buildingsSnapshot = await buildingServices.getAllBuildings()
          setBuildings(convertDocsToArray(buildingsSnapshot))

          const staffSnapshot = await labourServices.getAllLabour()
          setStaff(convertDocsToArray(staffSnapshot))

          const today = new Date().toISOString().split('T')[0]
          const attendanceSnapshot = await attendanceServices.getAttendanceByDate(today)
          setAttendance(convertDocsToArray(attendanceSnapshot))

          const materialsSnapshot = await materialServices.getAllMaterials()
          setMaterials(convertDocsToArray(materialsSnapshot))

          const dprSnapshot = await dprServices.getAllDPR()
          setDprRecords(convertDocsToArray(dprSnapshot))

          // Load supervisors list for the site-creation supervisor picker
          try {
            const supSnap = await supervisorServices.getAllSupervisors()
            setSupervisorsList(convertDocsToArray(supSnap).filter(s => s.status === 'active'))
          } catch { }
        }

      } catch (error) {
        console.error('Error loading data:', error)
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [userRole, currentSupervisor, assignedSites])

  // Note: Real-time listeners removed - data only loads on manual refresh
  // useEffect(() => {
  //   const unsubscribeStaff = labourServices.onLabourChange((snapshot) => {
  //     const staffData = convertDocsToArray(snapshot)
  //     console.log('Staff data from Firestore:', staffData)
  //     setStaff(staffData)
  //   })

  //   const unsubscribeAttendance = attendanceServices.onAttendanceChange((snapshot) => {
  //     const attendanceData = convertDocsToArray(snapshot)
  //     console.log('Attendance data from Firestore:', attendanceData)
  //     setAttendance(attendanceData)
  //   })

  //   const unsubscribeMaterials = materialServices.onMaterialsChange((snapshot) => {
  //     setMaterials(convertDocsToArray(snapshot))
  //   })

  //   const unsubscribeSites = siteServices.onSitesChange((snapshot) => {
  //     setSites(convertDocsToArray(snapshot))
  //   })

  //   const unsubscribeDPR = dprServices.onDPRChange((snapshot) => {
  //     const today = new Date().toISOString().split('T')[0]
  //     const dprData = convertDocsToArray(snapshot).filter(record => record.date === today)
  //     console.log('DPR data from Firestore:', dprData)
  //     setDprRecords(dprData)
  //   })

  //   return () => {
  //     unsubscribeStaff()
  //     unsubscribeAttendance()
  //     unsubscribeMaterials()
  //     unsubscribeSites()
  //     unsubscribeDPR()
  //   }
  // }, [])

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
      alert('Error adding building. Please try again.')
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

      alert('✅ Site and building created successfully! They are now available in Site Management and Process Management.')

    } catch (error) {
      console.error('Error creating site and building:', error)
      alert('Error creating site and building: ' + error.message)
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
      {/* Mobile-First Header */}
      <div className="text-center lg:text-left">
        <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-sm sm:text-base text-gray-600 mt-2">
          Welcome back, {userRole === 'admin' ? 'Admin' : userRole === 'manager' ? 'Site Manager' : 'Supervisor'}
        </p>
      </div>

      {/* Mobile-First KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        {kpiCards.map((card, index) => {
          const Icon = card.icon
          return (
            <motion.div
              key={card.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              whileHover={{ scale: 1.02 }}
              className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6 hover:shadow-lg transition-all cursor-pointer"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <p className="text-xs sm:text-sm font-medium text-gray-600 mb-2">{card.title}</p>
                  <h3 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900 mb-3">{card.value}</h3>
                  <div className="flex items-center gap-1">
                    <TrendingUp className={`w-4 h-4 ${card.trend.isUp ? 'text-green-500' : 'text-red-500'
                      } ${!card.trend.isUp && 'rotate-180'}`} />
                    <span className={`text-sm font-medium ${card.trend.isUp ? 'text-green-600' : 'text-red-600'
                      }`}>
                      {card.trend.isUp ? '+' : '-'}{card.trend.percentage}%
                    </span>
                    <span className="text-xs text-gray-500 ml-1">vs last month</span>
                  </div>
                </div>
                <div className={`${card.color} p-3 sm:p-4 rounded-lg ml-4`}>
                  <Icon className="w-5 h-5 sm:w-6 sm:h-6 lg:w-7 lg:h-7 text-white" />
                </div>
              </div>
            </motion.div>
          )
        })}
      </div>

      {/* Professional DPR Section */}
      <div className="bg-gradient-to-br from-white to-gray-50 rounded-2xl shadow-lg border border-gray-200 overflow-hidden">
        {/* DPR Header */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-4 sm:px-8 sm:py-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="text-white">
              <h2 className="text-2xl font-bold flex items-center gap-3">
                <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
                  <FileText className="w-5 h-5 text-white" />
                </div>
                Total Sites
              </h2>
              <p className="text-blue-100 mt-1">Manage sites and track progress</p>
            </div>
            {userRole === 'admin' && (
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setShowDPRFlow(true)}
                className="flex items-center gap-2 px-6 py-3 bg-white text-blue-600 rounded-lg font-semibold shadow-lg hover:shadow-xl transition-all"
              >
                <Plus className="w-5 h-5" />
                Create New Site
              </motion.button>
            )}
          </div>
        </div>

        {/* DPR Content */}
        <div className="p-6 sm:p-8">
          {/* Quick Stats */}

          {/* Sites Overview */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Building2 className="w-5 h-5 text-gray-600" />
              Active Sites
            </h3>
            {sites.length === 0 ? (
              <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
                <div className="w-16 h-16 bg-gray-200 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Building2 className="w-8 h-8 text-gray-400" />
                </div>
                <h4 className="text-lg font-medium text-gray-900 mb-2">No sites created yet</h4>
                <p className="text-gray-600 mb-4">Create your first site to start tracking progress</p>
                {userRole === 'admin' && (
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setShowDPRFlow(true)}
                    className="px-6 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
                  >
                    Create First Site
                  </motion.button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {sites.map((site, index) => (
                  <motion.div
                    key={site.id}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: index * 0.1 }}
                    className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h4 className="font-semibold text-gray-900">{site.name}</h4>
                        <p className="text-sm text-gray-600 flex items-center gap-1">
                          <MapPin className="w-3 h-3" />
                          {site.location || site.area}
                        </p>
                        {site.area && (
                          <p className="text-xs text-gray-500 mt-1">Area: {site.area}</p>
                        )}
                      </div>
                      <span className="px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">
                        Active
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-gray-600">Staff Assigned</p>
                        <p className="font-semibold text-gray-900">{site.staff?.length || 0}</p>
                      </div>
                      <div>
                        <p className="text-gray-600">Materials</p>
                        <p className="font-semibold text-gray-900">{site.materials?.length || 0}</p>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </div>
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
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-2xl font-bold text-gray-900">Create New Site - Complete Flow</h2>
              <p className="text-gray-600 mt-1">Complete all steps to create a new site with staff and materials</p>
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

                  {/* Supervisor Assignment — admin only */}
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
                      {(dprFormData.assignedSupervisors || []).length > 0 && (
                        <p className="text-xs text-blue-600 mt-1">
                          ✓ {dprFormData.assignedSupervisors.length} supervisor(s) will be assigned
                        </p>
                      )}
                    </div>
                  )}

                  <div>

                    <label className="block text-sm font-medium text-gray-700 mb-2">Building Name *</label>
                    <input
                      type="text"
                      value={dprFormData.buildingId}
                      onChange={(e) => setDprFormData({ ...dprFormData, buildingId: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Enter building name"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Building Type *</label>
                    <select
                      value={dprFormData.buildingType || 'Mixed Use'}
                      onChange={(e) => setDprFormData({ ...dprFormData, buildingType: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="Residential">Residential</option>
                      <option value="Commercial">Commercial</option>
                      <option value="Industrial">Industrial</option>
                      <option value="Mixed Use">Mixed Use</option>
                      <option value="Institutional">Institutional</option>
                    </select>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Floors *</label>
                      <input
                        type="number"
                        min="1"
                        value={dprFormData.buildingFloors}
                        onChange={(e) => setDprFormData({ ...dprFormData, buildingFloors: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Units *</label>
                      <input
                        type="number"
                        min="1"
                        value={dprFormData.buildingUnits}
                        onChange={(e) => setDprFormData({ ...dprFormData, buildingUnits: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Building Area (sq ft)</label>
                      <input
                        type="number"
                        min="1"
                        value={dprFormData.buildingArea}
                        onChange={(e) => setDprFormData({ ...dprFormData, buildingArea: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="e.g., 1000"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Building Budget</label>
                      <input
                        type="number"
                        min="0"
                        value={dprFormData.buildingBudget}
                        onChange={(e) => setDprFormData({ ...dprFormData, buildingBudget: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="e.g., 1000000"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
                      <select
                        value={dprFormData.buildingStatus}
                        onChange={(e) => setDprFormData({ ...dprFormData, buildingStatus: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      >
                        <option value="Active">Active</option>
                        <option value="Completed">Completed</option>
                        <option value="On Hold">On Hold</option>
                        <option value="Pending">Pending</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Progress (%)</label>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={dprFormData.buildingProgress}
                        onChange={(e) => setDprFormData({ ...dprFormData, buildingProgress: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                  </div>
                  {/* <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Site Area *</label>
                    <input
                      type="text"
                      value={dprFormData.siteArea}
                      onChange={(e) => setDprFormData({ ...dprFormData, siteArea: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="e.g., 5000 sq ft"
                    />
                  </div> */}
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
                </div>
              )}

              {dprStep === 2 && (
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-gray-900">Step 2: Assign Staff</h3>



                  {/* Available Staff */}
                  <div>
                    <h4 className="text-md font-medium text-green-700 mb-3 flex items-center gap-2">
                      <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                      Available Today ({getStaffByAttendance().present.supervisors.length + getStaffByAttendance().present.workers.length})
                    </h4>

                    {/* Available Supervisors */}
                    {getStaffByAttendance().present.supervisors.length > 0 && (
                      <div className="mb-6">
                        <p className="text-sm font-medium text-gray-600 mb-3">Supervisors (Can manage multiple sites)</p>
                        <div className="space-y-3">
                          {getStaffByAttendance().present.supervisors.map(person => {
                            const supervisorConflict = hasSupervisorConflict(person.id)
                            const staffConflict = hasStaffConflict(person.id)
                            const isSelected = dprFormData.selectedStaff.includes(person.id)

                            return (
                              <motion.div
                                key={person.id}
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                                onClick={() => handleStaffToggle(person.id)}
                                className={`p-4 border rounded-xl cursor-pointer transition-all ${supervisorConflict && !isSelected
                                  ? 'bg-gray-50 border-gray-200 opacity-60'
                                  : isSelected
                                    ? 'bg-blue-50 border-blue-500 shadow-sm'
                                    : 'bg-white border-gray-200 hover:border-blue-400 hover:shadow-sm'
                                  }`}
                              >
                                <div className="flex items-center justify-between">
                                  <div className="flex-1 min-w-0">
                                    <p className="font-semibold text-gray-900 truncate">{person.name}</p>
                                    <p className="text-sm text-gray-600 truncate">{person.role}</p>
                                    <p className="text-xs text-blue-600 mt-1">Can manage multiple sites</p>
                                    {supervisorConflict && !isSelected && (
                                      <p className="text-xs text-red-600 mt-2 font-medium">⚠️ Another supervisor selected</p>
                                    )}
                                  </div>
                                  <div className="ml-3 flex-shrink-0">
                                    {isSelected ? (
                                      <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center">
                                        <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                        </svg>
                                      </div>
                                    ) : supervisorConflict ? (
                                      <div className="w-6 h-6 bg-gray-300 rounded-full flex items-center justify-center">
                                        <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                        </svg>
                                      </div>
                                    ) : (
                                      <div className="w-6 h-6 border-2 border-gray-300 rounded-full"></div>
                                    )}
                                  </div>
                                </div>
                              </motion.div>
                            )
                          })}
                        </div>
                      </div>
                    )}

                    {/* Available Workers */}
                    {getStaffByAttendance().present.workers.length > 0 && (
                      <div>
                        <p className="text-sm font-medium text-gray-600 mb-3">Workers (Single site assignment only)</p>
                        <div className="space-y-3">
                          {getStaffByAttendance().present.workers.map(person => {
                            const workerConflict = hasStaffConflict(person.id)
                            const isSelected = dprFormData.selectedStaff.includes(person.id)

                            return (
                              <motion.div
                                key={person.id}
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                                onClick={() => handleStaffToggle(person.id)}
                                className={`p-4 border rounded-xl cursor-pointer transition-all ${workerConflict && !isSelected
                                  ? 'bg-gray-50 border-gray-200 opacity-60'
                                  : isSelected
                                    ? 'bg-blue-50 border-blue-500 shadow-sm'
                                    : 'bg-white border-gray-200 hover:border-blue-400 hover:shadow-sm'
                                  }`}
                              >
                                <div className="flex items-center justify-between">
                                  <div className="flex-1 min-w-0">
                                    <p className="font-semibold text-gray-900 truncate">{person.name}</p>
                                    <p className="text-sm text-gray-600 truncate">{person.role}</p>
                                    <p className="text-xs text-orange-600 mt-1">Single site assignment only</p>
                                    {workerConflict && !isSelected && (
                                      <p className="text-xs text-red-600 mt-2 font-medium">⚠️ Already assigned to another site</p>
                                    )}
                                  </div>
                                  <div className="ml-3 flex-shrink-0">
                                    {isSelected ? (
                                      <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center">
                                        <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                        </svg>
                                      </div>
                                    ) : workerConflict ? (
                                      <div className="w-6 h-6 bg-gray-300 rounded-full flex items-center justify-center">
                                        <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                        </svg>
                                      </div>
                                    ) : (
                                      <div className="w-6 h-6 border-2 border-gray-300 rounded-full"></div>
                                    )}
                                  </div>
                                </div>
                              </motion.div>
                            )
                          })}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Already Assigned Staff */}
                  {(getStaffByAttendance().assigned.supervisors.length > 0 || getStaffByAttendance().assigned.workers.length > 0) && (
                    <div>
                      <h4 className="text-md font-medium text-orange-700 mb-3 flex items-center gap-2">
                        <div className="w-3 h-3 bg-orange-500 rounded-full"></div>
                        Already Assigned to Other DPR ({getStaffByAttendance().assigned.supervisors.length + getStaffByAttendance().assigned.workers.length})
                      </h4>

                      {/* Assigned Supervisors */}
                      {getStaffByAttendance().assigned.supervisors.length > 0 && (
                        <div className="mb-4">
                          <p className="text-sm font-medium text-gray-600 mb-2">Supervisors</p>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {getStaffByAttendance().assigned.supervisors.map(person => (
                              <div
                                key={person.id}
                                className="p-4 border border-orange-200 rounded-lg bg-orange-50 opacity-70"
                              >
                                <div className="flex items-center justify-between">
                                  <div>
                                    <p className="font-medium text-gray-900">{person.name}</p>
                                    <p className="text-sm text-gray-600">{person.role}</p>
                                    <p className="text-xs text-orange-600">Already assigned today</p>
                                  </div>
                                  <div className="w-5 h-5 bg-orange-300 rounded-full flex items-center justify-center">
                                    <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                    </svg>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Assigned Workers */}
                      {getStaffByAttendance().assigned.workers.length > 0 && (
                        <div>
                          <p className="text-sm font-medium text-gray-600 mb-2">Workers</p>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {getStaffByAttendance().assigned.workers.map(person => (
                              <div
                                key={person.id}
                                className="p-4 border border-orange-200 rounded-lg bg-orange-50 opacity-70"
                              >
                                <div className="flex items-center justify-between">
                                  <div>
                                    <p className="font-medium text-gray-900">{person.name}</p>
                                    <p className="text-sm text-gray-600">{person.role}</p>
                                    <p className="text-xs text-orange-600">Already assigned today</p>
                                  </div>
                                  <div className="w-5 h-5 bg-orange-300 rounded-full flex items-center justify-center">
                                    <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                    </svg>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Absent Staff */}
                  <div>
                    <h4 className="text-md font-medium text-red-700 mb-3 flex items-center gap-2">
                      <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                      Absent Today ({getStaffByAttendance().absent.length})
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {getStaffByAttendance().absent.map(person => (
                        <motion.div
                          key={person.id}
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => handleStaffToggle(person.id)}
                          className={`p-4 border rounded-lg cursor-pointer transition-colors ${dprFormData.selectedStaff.includes(person.id)
                            ? 'bg-orange-50 border-orange-500'
                            : 'bg-red-50 border-red-200 hover:border-orange-400'
                            }`}
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-medium text-gray-900">{person.name}</p>
                              <p className="text-sm text-gray-600">{person.role}</p>
                              <p className="text-xs text-orange-600">Absent but can be assigned</p>
                            </div>
                            {dprFormData.selectedStaff.includes(person.id) && (
                              <div className="w-5 h-5 bg-orange-500 rounded-full flex items-center justify-center">
                                <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                              </div>
                            )}
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  </div>

                  {staff.length === 0 && (
                    <div className="text-center py-8">
                      <p className="text-gray-500">No staff found. Please add staff first.</p>
                    </div>
                  )}
                </div>
              )}

              {dprStep === 3 && (
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-gray-900">Step 3: Define Work Area</h3>
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <p className="text-sm text-blue-800">
                      <strong>Site:</strong> {dprFormData.siteName}<br />
                      <strong>Area:</strong> {dprFormData.siteArea}<br />
                      <strong>Staff Assigned:</strong> {dprFormData.selectedStaff.length} people
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Work Details</label>
                    <textarea
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      rows={4}
                      placeholder="Describe the work area and specific requirements..."
                    />
                  </div>
                </div>
              )}

              {dprStep === 4 && (
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-gray-900">Step 4: Add Materials</h3>
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
        </motion.div>
      )}

      <Footer />
    </div>
  )
}

export default Dashboard
