import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, Edit2, Trash2, MapPin, DollarSign, TrendingUp, Search, Filter, Users, CheckCircle, XCircle, Clock, X, ArrowLeft } from 'lucide-react'
import { siteServices, labourServices, attendanceServices, buildingServices, processServices, supervisorServices, convertDocsToArray, syncSiteToSupervisors, syncStaffToSite, syncSingleStaffToSite, onSnapshot, supervisorsCollection } from '../services/firebaseServices'
import { format } from 'date-fns'
import Footer from '../components/Footer'
import storageService from '../services/storageService'
import { useSupervisor } from '../contexts/SupervisorContext.jsx'
import { useAuth } from '../components/Auth'
import { useNavigate } from 'react-router-dom'
import PropTypes from 'prop-types'
import StatusModal from '../components/StatusModal'

const SiteManagement = ({ userRole }) => {
  const navigate = useNavigate();
  const { assignedSites } = useSupervisor();
  const { user } = useAuth();
  // Default processes for new buildings
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

  const initializeDefaultProcessesForBuilding = async (siteId, buildingId) => {
    try {
      console.log('🏗️ Creating default processes for new building:', buildingId)
      console.log('📍 Site ID:', siteId)

      // Add default processes for the new building
      for (const defaultProcess of defaultProcesses) {
        const processToAdd = {
          ...defaultProcess,
          siteId: siteId,
          buildingId: buildingId,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
        console.log('➕ Adding process:', processToAdd.name)
        await processServices.addProcess(siteId, buildingId, processToAdd)
      }
      console.log('🎉 Default processes created successfully for new building!')
    } catch (error) {
      console.error('❌ Error creating default processes:', error)
    }
  }
  const [sites, setSites] = useState([])
  const [labour, setLabour] = useState([])
  const [attendance, setAttendance] = useState([])
  const [buildings, setBuildings] = useState([])
  const [showModal, setShowModal] = useState(false)
  const [showBuildingModal, setShowBuildingModal] = useState(false)
  const [editingSite, setEditingSite] = useState(null)
  const [editingBuilding, setEditingBuilding] = useState(null)
  const [selectedSiteForBuilding, setSelectedSiteForBuilding] = useState(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterStatus, setFilterStatus] = useState('All')
  const [loading, setLoading] = useState(true)
  const [showBuildingsForSite, setShowBuildingsForSite] = useState(null)
  const [availableSupervisors, setAvailableSupervisors] = useState([])
  const [availableStaff, setAvailableStaff] = useState([])
  const [formData, setFormData] = useState({
    name: '',
    location: '',
    startDate: '',
    endDate: '',
    budget: 0,
    progress: 0,
    totalSq: 0,
    status: 'Active',
    image: '',
    assignedSupervisors: [], // Add supervisor assignment
    assignedStaff: [], // Add staff assignment
    buildingName: '',
    buildingType: '',
    buildingFloors: 1,
    buildingUnits: 1,
    buildingArea: 1000,
    buildingBudget: 0,
    buildingProgress: 0,
    buildingStatus: 'Active'
  })
  const [buildingForm, setBuildingForm] = useState({
    name: '',
    type: '',
    floors: 0,
    units: 0,
    area: 0,
    budget: 0,
    progress: 0,
    status: 'Active',
    image: '',
    imagePath: '',
    imageFileName: ''
  })
  const [quickExpenseSite, setQuickExpenseSite] = useState(null)
  const [quickExpenseAmount, setQuickExpenseAmount] = useState('')
  const [quickStaffSite, setQuickStaffSite] = useState(null)
  const [staffSearchTerm, setStaffSearchTerm] = useState('')

  // Custom Notification & Confirmation System
  const [toastMessage, setToastMessage] = useState({ text: '', type: 'success', visible: false })
  const showToast = (text, type = 'success') => {
    setToastMessage({ text, type, visible: true })
    setTimeout(() => setToastMessage({ text: '', type: 'success', visible: false }), 3000)
  }

  const [statusModal, setStatusModal] = useState({ visible: false, type: 'success', title: '', message: '', onConfirm: null, onCancel: null })
  
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

  const showAlert = (title, message, type = 'success') => {
    setStatusModal({ 
      visible: true, 
      type, 
      title, 
      message, 
      onConfirm: () => setStatusModal(prev => ({ ...prev, visible: false }))
    })
  }

  const [confirmDialog, setConfirmDialog] = useState({ visible: false, title: '', message: '', onConfirm: null })
  // Keep showConfirm name for compatibility, but update its implementation to use statusModal if desired, 
  // or just use showConfirm as it is but wrap it correctly.
  // Actually, I'll just replace the confirmDialog state usage with statusModal for consistency.
  

  // Image upload handler
  const handleImageUpload = async (e, formType) => {
    const file = e.target.files[0]
    if (!file) return

    // Check file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      showToast('Image size should be less than 5MB', 'error')
      return
    }

    // Check file type
    if (!file.type.startsWith('image/')) {
      showToast('Please upload an image file', 'error')
      return
    }

    try {
      let uploadResult

      if (formType === 'site') {
        const siteId = editingSite?.id || `temp_${Date.now()}`
        uploadResult = await storageService.uploadSiteImage(siteId, file)
        setFormData(prev => ({
          ...prev,
          image: uploadResult.url,
          imagePath: uploadResult.path,
          imageFileName: uploadResult.fileName
        }))
      } else if (formType === 'building') {
        const buildingId = editingBuilding?.id || `temp_${Date.now()}`
        uploadResult = await storageService.uploadBuildingImage(buildingId, file)
        setBuildingForm(prev => ({
          ...prev,
          image: uploadResult.url,
          imagePath: uploadResult.path,
          imageFileName: uploadResult.fileName
        }))
      }

      console.log('✅ Image uploaded successfully:', uploadResult)
    } catch (error) {
      console.error('Error uploading image:', error)
      showAlert('Upload Error', error.message, 'error')
    }
  }

  // Load and sync all Site Management data in real-time
  useEffect(() => {
    setLoading(true);
    console.log('🔄 SiteManagement: Starting real-time sync...');

    // 1. Sites
    const unsubscribeSites = siteServices.onSitesChange((snapshot) => {
      const sitesData = convertDocsToArray(snapshot).filter(s => !s.is_deleted);
      setSites(sitesData);
      setLoading(false);
    });

    // 2. Labour / Workers
    const unsubscribeLabour = labourServices.onLabourChange((snapshot) => {
      const labourData = convertDocsToArray(snapshot);
      setLabour(labourData);
      if (userRole === 'admin') setAvailableStaff(labourData);
    });

    // 3. Attendance (Today)
    const today = format(new Date(), 'yyyy-MM-dd');
    const unsubscribeAttendance = attendanceServices.onAttendanceChange((snapshot) => {
      const attendanceData = convertDocsToArray(snapshot).filter(r => r.date === today);
      setAttendance(attendanceData);
    });

    // 4. Buildings
    const unsubscribeBuildings = buildingServices.onBuildingsChange((snapshot) => {
      setBuildings(convertDocsToArray(snapshot));
    });

    // 5. Supervisors (Admin Only)
    let unsubscribeSupervisors = () => {};
    if (userRole === 'admin') {
      unsubscribeSupervisors = onSnapshot(supervisorsCollection, (snap) => {
        const sups = convertDocsToArray(snap);
        setAvailableSupervisors(sups.filter(s => s.status === 'active' && s.email !== user?.email));
      });
    }

    return () => {
      unsubscribeSites();
      unsubscribeLabour();
      unsubscribeAttendance();
      unsubscribeBuildings();
      unsubscribeSupervisors();
    };
  }, [userRole, user?.email, assignedSites]);

  const handleAdd = () => {
    setEditingSite(null)
    setFormData({
      name: '',
      location: '',
      startDate: '',
      endDate: '',
      budget: 0,
      expenses: 0,
      progress: 0,
      totalSq: 0,
      status: 'Active',
      image: '',
      assignedSupervisors: [], // Add supervisor assignment
      assignedStaff: [], // Add staff assignment
      buildingName: '',
      buildingType: '',
      buildingFloors: 1,
      buildingUnits: 1,
      buildingArea: 1000,
      buildingBudget: 0,
      buildingProgress: 0,
      buildingStatus: 'Active'
    })
    setShowModal(true)
  }

  const handleDelete = (id) => {
    showConfirm(
      'Delete Site?',
      'Are you sure you want to delete this site? This cannot be undone.',
      async () => {
        try {
          await siteServices.deleteSite(id)
          showToast('Site deleted successfully!')
        } catch (error) {
          console.error('Error deleting site:', error)
          showToast('Error deleting site: ' + error.message, 'error')
        }
      }
    )
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    try {
      let siteData;

      if (editingSite) {
        // Update existing site - preserve original createdAt and add updatedAt
        siteData = {
          name: formData.name,
          location: formData.location,
          startDate: formData.startDate || null,
          endDate: formData.endDate || null,
          budget: parseInt(formData.budget) || 0,
          expenses: parseInt(formData.expenses) || 0,
          progress: parseInt(formData.progress) || 0,
          totalSq: parseInt(formData.totalSq) || 0,
          status: formData.status,
          image: formData.image || '',
          assignedSupervisors: formData.assignedSupervisors || [],
          assignedStaff: formData.assignedStaff || [],
          createdAt: editingSite.createdAt,
          updatedAt: new Date().toISOString()
        }

        console.log('Updating site:', editingSite.id, siteData)
        await siteServices.updateSite(editingSite.id, siteData)
        console.log('✅ Site updated successfully')

        // Sync supervisors for updated site
        if (siteData.assignedSupervisors.length > 0) {
          await syncSiteToSupervisors(editingSite.id, siteData.assignedSupervisors)
        }

        // Sync staff siteId so they appear in supervisor's Attendance page
        if (siteData.assignedStaff.length > 0) {
          await syncStaffToSite(editingSite.id, siteData.assignedStaff)
        }

      } else {
        // Create new site
        siteData = {
          name: formData.name,
          location: formData.location,
          startDate: formData.startDate,
          endDate: formData.endDate,
          budget: parseInt(formData.budget) || 0,
          expenses: parseInt(formData.expenses) || 0,
          progress: parseInt(formData.progress) || 0,
          totalSq: parseInt(formData.totalSq) || 0,
          status: formData.status,
          image: formData.image || '',
          assignedSupervisors: formData.assignedSupervisors || [],
          assignedStaff: formData.assignedStaff || [],
          createdBy: user?.uid, // Add createdBy field
          createdAt: new Date().toISOString()
        }

        // Validation: Admin should not be assigned as supervisor
        if (userRole === 'admin' && siteData.assignedSupervisors.includes(user?.uid)) {
          console.warn('⚠️ Admin should not be assigned as supervisor to their own sites')
          // Remove admin from assigned supervisors if present
          siteData.assignedSupervisors = siteData.assignedSupervisors.filter(uid => uid !== user?.uid)
        }

        console.log('📝 Creating site with assigned supervisors:', siteData.assignedSupervisors)
        console.log('📝 Creating site with assigned staff:', siteData.assignedStaff)
        console.log('🔄 Site should now be visible to assigned supervisors:', siteData.assignedSupervisors)

        const siteRef = await siteServices.addSite(siteData)
        const siteId = siteRef.id
        console.log('✅ Site created with ID:', siteId)

        // Bidirectional sync: use shared utility so all paths stay consistent
        if (siteData.assignedSupervisors && siteData.assignedSupervisors.length > 0) {
          await syncSiteToSupervisors(siteId, siteData.assignedSupervisors)
        }

        // Sync staff siteId so they appear in supervisor's Attendance page
        if (siteData.assignedStaff && siteData.assignedStaff.length > 0) {
          await syncStaffToSite(siteId, siteData.assignedStaff)
        }

        // Create building with form data for new sites
        const buildingData = {
          name: formData.buildingName || `Main Building - ${formData.name}`,
          type: formData.buildingType || 'Mixed Use',
          floors: parseInt(formData.buildingFloors) || 1,
          units: parseInt(formData.buildingUnits) || 1,
          area: parseInt(formData.buildingArea) || 1000,
          budget: parseInt(formData.buildingBudget) || Math.floor((parseInt(formData.budget) || 0) * 0.8),
          progress: parseInt(formData.buildingProgress) || 0,
          status: formData.buildingStatus || 'Active',
          siteId: siteId,
          createdAt: new Date().toISOString()
        }
        const buildingResult = await buildingServices.addBuilding(buildingData)
        console.log('✅ Building created with ID:', buildingResult.id)
        // Automatically create default processes for the new building
        await initializeDefaultProcessesForBuilding(siteId, buildingResult.id)
      }

      setShowModal(false)
      setEditingSite(null)
      setFormData({
        name: '',
        location: '',
        startDate: '',
        endDate: '',
        budget: 0,
        progress: 0,
        totalSq: 0,
        status: 'Active',
        image: '',
        assignedSupervisors: [],
        buildingName: '',
        buildingType: '',
        buildingFloors: 1,
        buildingUnits: 1,
        buildingArea: 1000,
        buildingBudget: 0,
        buildingProgress: 0,
        buildingStatus: 'Active'
      })
    } catch (error) {
      console.error('Error saving site:', error)
      showToast('Error saving site: ' + error.message, 'error')
    }
  }

  const handleEdit = (site) => {
    setEditingSite(site)
    setFormData({
      ...site,
      assignedSupervisors: site.assignedSupervisors || [],
      assignedStaff: site.assignedStaff || [],
      budget: site.budget || 0,
      expenses: site.expenses || 0,
      totalSq: site.totalSq || 0
    })
    setShowModal(true)
  }

  // Building management functions
  const handleAddBuilding = (siteId) => {
    setSelectedSiteForBuilding(siteId)
    setEditingBuilding(null)
    setBuildingForm({
      name: '',
      type: '',
      floors: 0,
      units: 0,
      area: 0,
      budget: 0,
      progress: 0,
      status: 'Active',
      image: '',
      imagePath: '',
      imageFileName: ''
    })
    setShowBuildingModal(true)
  }

  const handleEditBuilding = (building) => {
    setEditingBuilding(building)
    setBuildingForm({
      name: building.name,
      type: building.type,
      floors: building.floors,
      units: building.units,
      area: building.area,
      budget: building.budget,
      progress: building.progress,
      status: building.status,
      image: building.image,
      imagePath: building.imagePath,
      imageFileName: building.imageFileName
    })
    setSelectedSiteForBuilding(building.siteId)
    setShowBuildingModal(true)
  }

  const handleDeleteBuilding = async (id) => {
    showConfirm(
      'Delete Building?',
      'Are you sure you want to delete this building? This cannot be undone.',
      async () => {
        try {
          await buildingServices.deleteBuilding(id)
          showToast('Building deleted successfully!')
        } catch (error) {
          console.error('Error deleting building:', error)
          showToast('Error deleting building: ' + error.message, 'error')
        }
      }
    )
  }

  const handleBuildingSubmit = async (e) => {
    e.preventDefault()

    try {
      let buildingData;

      if (editingBuilding) {
        // Update existing building - preserve original createdAt and add updatedAt
        buildingData = {
          ...buildingForm,
          siteId: selectedSiteForBuilding,
          floors: parseInt(buildingForm.floors) || 0,
          units: parseInt(buildingForm.units) || 0,
          area: parseInt(buildingForm.area) || 0,
          budget: parseInt(buildingForm.budget) || 0,
          progress: parseInt(buildingForm.progress) || 0,
          createdAt: editingBuilding.createdAt, // Preserve original creation date
          updatedAt: new Date().toISOString() // Add update timestamp
        }

        console.log('Updating building:', editingBuilding.id, buildingData)
        await buildingServices.updateBuilding(editingBuilding.id, buildingData)
        console.log('✅ Building updated successfully')

      } else {
        // Create new building
        buildingData = {
          ...buildingForm,
          siteId: selectedSiteForBuilding,
          floors: parseInt(buildingForm.floors) || 0,
          units: parseInt(buildingForm.units) || 0,
          area: parseInt(buildingForm.area) || 0,
          budget: parseInt(buildingForm.budget) || 0,
          progress: parseInt(buildingForm.progress) || 0,
          createdAt: new Date().toISOString()
        }

        const result = await buildingServices.addBuilding(buildingData)
        console.log('✅ Building created with ID:', result.id)

        // Automatically create default processes for the new building
        await initializeDefaultProcessesForBuilding(selectedSiteForBuilding, result.id)
      }

      setShowBuildingModal(false)
      setBuildingForm({
        name: '',
        type: '',
        floors: 0,
        units: 0,
        area: 0,
        budget: 0,
        progress: 0,
        status: 'Active',
        image: '',
        imagePath: '',
        imageFileName: ''
      })
      setEditingBuilding(null)
      setSelectedSiteForBuilding(null)

    } catch (error) {
      console.error('Error saving building:', error)
      showToast('Error saving building: ' + error.message, 'error')
    }
  }

  const getBuildingsForSite = (siteId) => {
    console.log(`🔍 Looking for buildings for site ID: ${siteId}`)
    console.log(`🔍 Available buildings:`, buildings.map(b => ({ id: b.id, name: b.name, siteId: b.siteId })))

    const siteBuildings = buildings.filter(building => {
      const matches = building.siteId === siteId
      console.log(`🏗️ Building "${building.name}" (siteId: ${building.siteId}) matches site ${siteId}: ${matches}`)
      return matches
    })

    console.log(`🏗️ Final buildings for site ${siteId}:`, siteBuildings)
    console.log(`🏗️ Building count for site ${siteId}:`, siteBuildings.length)
    return siteBuildings
  }

  const handleOpenExpenseModal = (siteId) => {
    setQuickExpenseSite(siteId);
    setQuickExpenseAmount('');
  };

  const handleSaveQuickExpense = async () => {
    if (!quickExpenseAmount) return;
    const expenseAmount = parseInt(quickExpenseAmount);
    if (isNaN(expenseAmount) || expenseAmount <= 0) {
      showToast("Invalid amount entered.", "error");
      return;
    }
    try {
      const site = sites.find(s => s.id === quickExpenseSite);
      const currentExpenses = (site?.expenses) || 0;
      const newTotal = currentExpenses + expenseAmount;
      await siteServices.updateSite(quickExpenseSite, { expenses: newTotal });
      showToast(`Added $${expenseAmount} to expenses successfully.`);
      setQuickExpenseSite(null);
    } catch (err) {
      showToast("Failed to add expense: " + err.message, "error");
    }
  };

  const handleToggleQuickStaff = async (siteId, staffId, isAdding) => {
    try {
      await syncSingleStaffToSite(staffId, isAdding ? siteId : null);
      showToast(isAdding ? "Worker assigned to this site!" : "Worker removed from site.");
    } catch (err) {
      showToast("Operation failed: " + err.message, "error");
    }
  };



  const handleQuickRemoveStaff = async (siteId, staffId) => {
    showConfirm('Remove Staff?', 'Are you sure you want to remove this staff from the site?', async () => {
      try {
        await syncSingleStaffToSite(staffId, null);
        showToast("Staff removed successfully!");
      } catch (err) {
        showToast("Failed to remove staff: " + err.message, "error");
      }
    });
  };

  // Add debugging function to check all sites and their buildings
  const debugSiteBuildingLinkage = () => {
    console.log('🔍 DEBUGGING SITE-BUILDING LINKAGE:')
    console.log('📋 All sites:', sites.map(s => ({ id: s.id, name: s.name })))
    console.log('🏗️ All buildings:', buildings.map(b => ({ id: b.id, name: b.name, siteId: b.siteId })))

    sites.forEach(site => {
      const siteBuildings = buildings.filter(b => b.siteId === site.id)
      console.log(`📍 Site "${site.name}" (${site.id}) has ${siteBuildings.length} buildings:`, siteBuildings)
    })
  }

  // Call debug function
  useEffect(() => {
    if (sites.length > 0 && buildings.length > 0) {
      debugSiteBuildingLinkage()
    }
  }, [sites, buildings])

  const filteredSites = sites.filter(site => {
    const matchesSearch = site.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      site.location.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesFilter = filterStatus === 'All' || site.status === filterStatus
    return matchesSearch && matchesFilter
  })

  const getStatusColor = (status) => {
    switch (status) {
      case 'Active': return 'bg-green-100 text-green-700 border-green-200'
      case 'Completed': return 'bg-blue-100 text-blue-700 border-blue-200'
      case 'On Hold': return 'bg-yellow-100 text-yellow-700 border-yellow-200'
      default: return 'bg-gray-100 text-gray-700 border-gray-200'
    }
  }

  const getProgressColor = (progress) => {
    if (progress >= 75) return 'bg-green-500'
    if (progress >= 50) return 'bg-blue-500'
    if (progress >= 25) return 'bg-yellow-500'
    return 'bg-red-500'
  }

  const getSiteAttendanceStats = (siteId) => {
    const today = format(new Date(), 'yyyy-MM-dd')
    const staffAtSite = labour.filter(staff => staff.siteId === siteId)

    const present = staffAtSite.filter(staff => {
      const attendanceRecord = attendance.find(a =>
        a.employeeId === staff.id &&
        a.date === today &&
        String(a.status || '').toLowerCase() === 'present'
      )
      return attendanceRecord !== undefined
    }).length

    const absent = staffAtSite.filter(staff => {
      const attendanceRecord = attendance.find(a =>
        a.employeeId === staff.id &&
        a.date === today &&
        String(a.status || '').toLowerCase() === 'absent'
      )
      return attendanceRecord !== undefined
    }).length

    const leave = staffAtSite.filter(staff => {
      const attendanceRecord = attendance.find(a =>
        a.employeeId === staff.id &&
        a.date === today &&
        String(a.status || '').toLowerCase() === 'leave'
      )
      return attendanceRecord !== undefined
    }).length

    const unmarked = staffAtSite.length - present - absent - leave

    return {
      total: staffAtSite.length,
      present,
      absent,
      leave,
      unmarked
    }
  }

  const getBuildingAttendanceStats = (buildingId) => {
    const today = format(new Date(), 'yyyy-MM-dd')
    const staffAtBuilding = labour.filter(staff => staff.buildingId === buildingId)

    const present = staffAtBuilding.filter(staff => {
      const attendanceRecord = attendance.find(a =>
        a.employeeId === staff.id &&
        a.date === today &&
        String(a.status || '').toLowerCase() === 'present'
      )
      return attendanceRecord !== undefined
    }).length

    const absent = staffAtBuilding.filter(staff => {
      const attendanceRecord = attendance.find(a =>
        a.employeeId === staff.id &&
        a.date === today &&
        String(a.status || '').toLowerCase() === 'absent'
      )
      return attendanceRecord !== undefined
    }).length

    const leave = staffAtBuilding.filter(staff => {
      const attendanceRecord = attendance.find(a =>
        a.employeeId === staff.id &&
        a.date === today &&
        String(a.status || '').toLowerCase() === 'leave'
      )
      return attendanceRecord !== undefined
    }).length

    const unmarked = staffAtBuilding.length - present - absent - leave

    return {
      total: staffAtBuilding.length,
      present,
      absent,
      leave,
      unmarked
    }
  }

  return (
    <div className="p-6 space-y-6 relative">
      {/* Toast Notification */}
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

      {/* Confirmation Dialog */}
      <AnimatePresence>
        {confirmDialog.visible && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-[100]"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full border border-gray-100"
            >
              <h3 className="text-xl font-bold text-gray-900 mb-2">{confirmDialog.title}</h3>
              <p className="text-gray-600 mb-8 leading-relaxed">{confirmDialog.message}</p>
              <div className="flex gap-3 justify-end">
                <button
                  className="px-5 py-2.5 text-gray-600 bg-gray-50 hover:bg-gray-100 rounded-xl transition-colors font-medium"
                  onClick={() => setConfirmDialog({ visible: false, title: '', message: '', onConfirm: null })}
                >
                  Cancel
                </button>
                <button
                  className="px-5 py-2.5 bg-red-600 text-white rounded-xl hover:bg-red-700 transition-all font-medium shadow-sm shadow-red-200"
                  onClick={() => {
                    confirmDialog.onConfirm && confirmDialog.onConfirm()
                    setConfirmDialog({ visible: false, title: '', message: '', onConfirm: null })
                  }}
                >
                  Confirm Delete
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => navigate('/dashboard')}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <ArrowLeft className="w-6 h-6 text-gray-600" />
          </motion.button>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              {userRole === 'supervisor' ? 'My Sites' : 'Site Management'}
            </h1>
            <p className="text-gray-600 mt-1">
              {userRole === 'supervisor'
                ? 'View and manage your assigned construction sites'
                : 'Manage all construction sites and projects'
              }
            </p>
          </div>
        </div>
        {userRole === 'admin' && (
          <>
            {console.log('🔍 Add Site button visibility check - userRole:', userRole)}
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={handleAdd}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700"
            >
              <Plus className="w-5 h-5" />
              Add Site
            </motion.button>
          </>
        )}
      </div>

      <div className="card">
        <div className="flex flex-col md:flex-row gap-4 mb-6">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search sites by name or location..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="input-field pl-10"
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="w-5 h-5 text-gray-400" />
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="input-field w-40"
            >
              <option>All</option>
              <option>Active</option>
              <option>Completed</option>
              <option>On Hold</option>
            </select>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            <span className="ml-3 text-gray-600">Loading sites...</span>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredSites.map((site, index) => (
              <motion.div
                key={site.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className="card-hover border border-gray-200"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      {site.image && (
                        <img
                          src={site.image}
                          alt={site.name}
                          className="h-16 w-16 object-cover rounded-lg"
                        />
                      )}
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900 mb-1">{site.name}</h3>
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-1 text-sm text-gray-600">
                            <MapPin className="w-4 h-4" />
                            {site.location}
                          </div>
                          {userRole === 'admin' && site.assignedSupervisors && site.assignedSupervisors.length > 0 && (
                            <div className="flex items-center gap-1 text-xs text-blue-600 mt-1">
                              <Users className="w-3 h-3" />
                              <span className="font-medium">
                                Supervisors: {site.assignedSupervisors.map(id => availableSupervisors.find(s => s.firebaseUid === id || s.id === id)?.name || id).join(', ')}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                  <span className={`badge border ${getStatusColor(site.status)}`}>
                    {site.status}
                  </span>
                </div>

                <div className="space-y-3 mb-4">
                  {/* <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600 flex items-center gap-1">
                      <Calendar className="w-4 h-4" />
                      Start Date
                    </span>
                    <span className="font-medium text-gray-900">{site.startDate || 'Not set'}</span>
                  </div> */}
                  {/* <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600 flex items-center gap-1">
                      <Calendar className="w-4 h-4" />
                      End Date
                    </span>
                    <span className="font-medium text-gray-900">{site.endDate || 'Not set'}</span>
                  </div> */}
                  {userRole === 'admin' && (() => {
                    return (
                      <>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-600 flex items-center gap-1">
                            <DollarSign className="w-4 h-4" />
                            Budget
                          </span>
                          <span className="font-medium text-gray-900">${site.budget ? site.budget.toLocaleString() : '0'}</span>
                        </div>
                        <div className="flex items-center justify-between text-sm group pb-2">
                          <div className="flex flex-col">
                            <span className="text-gray-600 flex items-center gap-1">
                              <TrendingUp className="w-4 h-4 text-red-500" />
                              Est. Expenses
                            </span>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="font-medium text-red-600">${site.expenses ? site.expenses.toLocaleString() : '0'}</span>
                            <button
                              onClick={() => handleOpenExpenseModal(site.id)}
                              className="flex items-center justify-center gap-1 bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 hover:border-red-300 font-medium px-2 py-0.5 rounded transition-all text-xs shadow-sm"
                              title="Add Expense"
                            >
                              <Plus className="w-3 h-3" /> Add
                            </button>
                          </div>
                        </div>
                        <div className="flex items-center justify-between text-sm pt-3 mt-1 border-t border-gray-200">
                          <span className="text-gray-800 font-bold flex items-center gap-1">
                            Profit Margin
                          </span>
                          <span className={`font-bold ${((site.budget || 0) - (site.expenses || 0)) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            ${((site.budget || 0) - (site.expenses || 0)).toLocaleString()}
                          </span>
                        </div>
                      </>
                    )
                  })()}
                </div>

                <div className="mb-4">
                  <div className="flex items-center justify-between text-sm mb-2">
                    <span className="text-gray-600 flex items-center gap-1">
                      <TrendingUp className="w-4 h-4" />
                      Progress
                    </span>
                    <span className="font-semibold text-gray-900">{site.progress}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${site.progress}%` }}
                      transition={{ duration: 1, delay: index * 0.1 }}
                      className={`h-2 rounded-full ${getProgressColor(site.progress)}`}
                    />
                  </div>
                </div>

                {userRole === 'admin' && (
                  <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-2 mb-3">
                      <Users className="w-4 h-4 text-gray-600" />
                      <span className="text-sm font-semibold text-gray-700">Today&apos;s Attendance</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="flex items-center gap-1">
                        <CheckCircle className="w-3 h-3 text-green-600" />
                        <span className="text-gray-600">Present:</span>
                        <span className="font-semibold text-green-600">{getSiteAttendanceStats(site.id).present}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <XCircle className="w-3 h-3 text-red-600" />
                        <span className="text-gray-600">Absent:</span>
                        <span className="font-semibold text-red-600">{getSiteAttendanceStats(site.id).absent}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Clock className="w-3 h-3 text-yellow-600" />
                        <span className="text-gray-600">Leave:</span>
                        <span className="font-semibold text-yellow-600">{getSiteAttendanceStats(site.id).leave}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Users className="w-3 h-3 text-gray-600" />
                        <span className="text-gray-600">Total:</span>
                        <span className="font-semibold text-gray-700">{getSiteAttendanceStats(site.id).total}</span>
                      </div>
                    </div>
                  </div>
                )}

                <div className="mb-4 p-3 bg-blue-50 rounded-lg">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 bg-blue-500 rounded"></div>
                      <span className="text-sm font-semibold text-gray-700">Buildings</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full">
                        {getBuildingsForSite(site.id).length}
                      </span>
                      {getBuildingsForSite(site.id).length > 0 && (
                        <button
                          onClick={() => setShowBuildingsForSite(showBuildingsForSite === site.id ? null : site.id)}
                          className="text-xs text-blue-600 hover:text-blue-800"
                        >
                          {showBuildingsForSite === site.id ? 'Hide' : 'Show All'}
                        </button>
                      )}
                    </div>
                  </div>

                  {getBuildingsForSite(site.id).length > 0 ? (
                    <div className="space-y-2">
                      {getBuildingsForSite(site.id).slice(0, showBuildingsForSite === site.id ? undefined : 2).map((building) => {
                        const stats = getBuildingAttendanceStats(building.id, building.name)
                        return (
                          <div
                            key={building.id}
                            className="bg-white p-2 rounded border border-blue-100"
                          >
                            <div className="flex items-center justify-between mb-1">
                              <div className="flex items-center gap-2">
                                {building.image && (
                                  <img
                                    src={building.image}
                                    alt={building.name}
                                    className="h-8 w-8 object-cover rounded"
                                  />
                                )}
                                <span className="text-xs font-medium text-gray-800">{building.name}</span>
                              </div>
                              <div className="flex items-center gap-1">
                                <span className={`text-xs badge border ${getStatusColor(building.status)}`}>
                                  {building.progress}%
                                </span>
                                {(userRole === 'admin' || userRole === 'supervisor') && (
                                  <div className="flex gap-1">
                                    <button
                                      onClick={() => handleEditBuilding(building)}
                                      className="text-xs text-blue-600 hover:text-blue-800"
                                    >
                                      <Edit2 className="w-3 h-3" />
                                    </button>
                                    {(userRole === 'admin') && (
                                      <button
                                        onClick={() => handleDeleteBuilding(building.id)}
                                        className="text-xs text-red-600 hover:text-red-800"
                                      >
                                        <Trash2 className="w-3 h-3" />
                                      </button>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                            <div className="grid grid-cols-2 gap-1 text-xs text-gray-600 mb-1">
                              <span>Type: {building.type}</span>
                              <span>Floors: {building.floors}</span>
                              <span>Units: {building.units}</span>
                              <span>Area: {building.area?.toLocaleString()} sq ft</span>
                              {userRole === 'admin' && <span>Budget: ${building.budget ? building.budget.toLocaleString() : '0'}</span>}
                              <span>Status: {building.status}</span>
                            </div>
                            {userRole === 'admin' && (
                              <div className="border-t border-gray-100 pt-1 mt-1">
                                <div className="grid grid-cols-4 gap-1 text-xs">
                                  <div className="flex items-center gap-1 justify-center">
                                    <CheckCircle className="w-3 h-3 text-green-600" />
                                    <span className="font-semibold text-green-600">{stats.present}</span>
                                  </div>
                                  <div className="flex items-center gap-1 justify-center">
                                    <XCircle className="w-3 h-3 text-red-600" />
                                    <span className="font-semibold text-red-600">{stats.absent}</span>
                                  </div>
                                  <div className="flex items-center gap-1 justify-center">
                                    <Clock className="w-3 h-3 text-yellow-600" />
                                    <span className="font-semibold text-yellow-600">{stats.leave}</span>
                                  </div>
                                  <div className="flex items-center gap-1 justify-center">
                                    <Users className="w-3 h-3 text-gray-600" />
                                    <span className="font-semibold text-gray-700">{stats.total}</span>
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        )
                      })}
                      {showBuildingsForSite !== site.id && getBuildingsForSite(site.id).length > 2 && (
                        <div className="text-xs text-gray-500 text-center">
                          +{getBuildingsForSite(site.id).length - 2} more buildings
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-xs text-gray-500 text-center">No buildings added yet</div>
                  )}
                </div>

                {/* Assigned Staff Preview for Admin */}
                {userRole === 'admin' && (
                    <div className="mb-4">
                      <div className="flex items-center gap-2 mb-3">
                        <Users className="w-4 h-4 text-blue-600" />
                        <span className="text-sm font-semibold text-gray-800">Assigned Workers ({site.assignedStaff?.length || 0})</span>
                      </div>
                    {site.assignedStaff && site.assignedStaff.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {site.assignedStaff.slice(0, 10).map(staffId => {
                          const st = availableStaff.find(s => s.id === staffId);
                          if (!st) return null;
                          const dPresent = attendance.filter(r => r.employeeId === staffId && r.siteId === site.id && String(r.status).toLowerCase() === 'present').length;
                          return (
                            <div key={staffId} className="group relative flex flex-col bg-white border border-gray-200 rounded-lg p-2 min-w-[120px] max-w-[140px] shadow-sm">
                              <button
                                onClick={() => handleQuickRemoveStaff(site.id, staffId)}
                                className="absolute -top-2 -right-2 bg-red-100 text-red-600 p-0.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity z-10 hover:bg-red-200"
                                title="Remove Worker"
                              >
                                <X className="w-3 h-3" />
                              </button>
                              <span className="text-xs font-bold text-gray-900 truncate pr-2">{st.name}</span>
                              <span className="text-[10px] text-gray-500 truncate">{st.role}</span>
                              <div className="mt-1 flex items-center justify-between text-[10px] font-medium text-green-700 bg-green-50 px-1.5 py-0.5 rounded border border-green-100">
                                <span>Worked:</span>
                                <span>{dPresent}d</span>
                              </div>
                            </div>
                          )
                        })}
                        {site.assignedStaff.length > 10 && (
                          <div className="flex items-center justify-center bg-gray-50 border border-gray-200 rounded-lg p-2 min-w-[40px] shadow-sm text-xs font-bold text-gray-500">
                            +{site.assignedStaff.length - 10}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="text-xs text-gray-500 italic bg-gray-50 p-2 rounded-lg border border-dashed border-gray-200 text-center">No workers assigned</div>
                    )}
                  </div>
                )}

                {(userRole === 'admin' || userRole === 'manager') && (
                  <div className="space-y-2">
                    <div className="flex gap-2">
                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => handleEdit(site)}
                        className="flex-1 btn-secondary py-2 text-sm flex items-center justify-center gap-1"
                      >
                        <Edit2 className="w-4 h-4" />
                        Edit
                      </motion.button>
                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => handleDelete(site.id)}
                        className="px-4 py-2 bg-red-50 text-red-600 border border-red-200 rounded-lg hover:bg-red-100 transition-colors duration-200 text-sm"
                      >
                        <Trash2 className="w-4 h-4" />
                      </motion.button>
                    </div>
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => handleAddBuilding(site.id)}
                      className="w-full py-2 bg-blue-50 text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors duration-200 text-sm flex items-center justify-center gap-1"
                    >
                      <Plus className="w-4 h-4" />
                      Add Building
                    </motion.button>
                  </div>
                )}
              </motion.div>
            ))}
          </div>
        )}

        {!loading && filteredSites.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-500 text-lg">No sites found matching your criteria</p>
          </div>
        )}
      </div>

      <AnimatePresence>
        {showModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
            onClick={() => setShowModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
            >
              <div className="p-6 border-b border-gray-200">
                <h2 className="text-2xl font-bold text-gray-900">
                  {editingSite ? 'Edit Site' : 'Add New Site'}
                </h2>
              </div>

              <form onSubmit={handleSubmit} className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Site Name *</label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="input-field"
                    placeholder="Enter site name"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Location *</label>
                  <input
                    type="text"
                    required
                    value={formData.location}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                    className="input-field"
                    placeholder="Enter location"
                  />
                </div>

                {userRole === 'admin' && (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Total Budget ($)</label>
                      <input
                        type="number"
                        min="0"
                        value={formData.budget}
                        onChange={(e) => setFormData({ ...formData, budget: e.target.value })}
                        className="input-field"
                        placeholder="e.g. 500000"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Current Expenses ($)</label>
                      <input
                        type="number"
                        min="0"
                        value={formData.expenses}
                        onChange={(e) => setFormData({ ...formData, expenses: e.target.value })}
                        className="input-field"
                        placeholder="e.g. 15000"
                      />
                    </div>
                  </div>
                )}

                {/* <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Start Date *</label>
                    <input
                      type="date"
                      required
                      value={formData.startDate}
                      onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                      className="input-field"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">End Date</label>
                    <input
                      type="date"
                      value={formData.endDate}
                      onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                      className="input-field"
                    />
                  </div>
                </div> */}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Total Area (sq ft)</label>
                  <input
                    type="number"
                    min="0"
                    value={formData.totalSq}
                    onChange={(e) => setFormData({ ...formData, totalSq: e.target.value })}
                    className="input-field"
                    placeholder="e.g. 5000"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    className="input-field"
                  >
                    <option>Active</option>
                    <option>Completed</option>
                    <option>On Hold</option>
                  </select>
                </div>

                {/* Assign Supervisors Section - Commented out for future use
                {userRole === 'admin' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Assign Supervisors
                    </label>
                    <div className="space-y-2 max-h-32 overflow-y-auto border border-gray-200 rounded-lg p-2">
                      {availableSupervisors.length === 0 ? (
                        <p className="text-sm text-gray-500">No active supervisors available</p>
                      ) : (
                        availableSupervisors.map((supervisor) => (
                          <label key={supervisor.id} className="flex items-center gap-2 text-sm">
                            <input
                              type="checkbox"
                              // Always use Firestore doc ID for consistency with sync logic
                              checked={formData.assignedSupervisors.includes(supervisor.id)}
                              onChange={(e) => {
                                const supDocId = supervisor.id  // Firestore doc ID
                                if (e.target.checked) {
                                  setFormData({
                                    ...formData,
                                    assignedSupervisors: [...formData.assignedSupervisors, supDocId]
                                  })
                                } else {
                                  setFormData({
                                    ...formData,
                                    assignedSupervisors: formData.assignedSupervisors.filter(id => id !== supDocId)
                                  })
                                }
                              }}
                              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                            />
                            <span>{supervisor.name} ({supervisor.email})</span>
                          </label>
                        ))
                      )}
                    </div>
                    {formData.assignedSupervisors.length > 0 && (
                      <p className="text-xs text-gray-500 mt-1">
                        {formData.assignedSupervisors.length} supervisor(s) assigned
                      </p>
                    )}
                  </div>
                )}
                */}

                {/* Assigned Staff Section - Commented out for future use
                {userRole === 'admin' && (
                  <div>
                    <label className="block text-sm font-semibold text-gray-800 mb-1 mt-6">
                      Assigned Staff (Workers)
                    </label>
                    <p className="text-xs text-amber-600 mb-3 flex items-center gap-1">
                      ⚠️ Workers are exclusively assigned to one site.
                    </p>

                    <div className="space-y-3 mb-4 max-h-[300px] overflow-y-auto pr-2 rounded-lg">
                      {formData.assignedStaff.length === 0 ? (
                        <div className="text-sm text-gray-500 italic p-4 text-center border-2 border-dashed border-gray-200 rounded-xl bg-gray-50">
                          No workers currently assigned to this site.
                        </div>
                      ) : (
                        <>
                          {availableStaff
                            .filter(staff => formData.assignedStaff.includes(staff.id))
                            .map((staff) => {
                              // Calculate stats
                              const daysPresent = attendance.filter(r => r.employeeId === staff.id && r.siteId === editingSite?.id && String(r.status).toLowerCase() === 'present').length;

                              return (
                                <motion.div initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} key={staff.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 border border-gray-100 rounded-2xl bg-white shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
                                  <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-500"></div>
                                  <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 font-bold text-lg border border-blue-100">
                                      {staff.name.charAt(0).toUpperCase()}
                                    </div>
                                    <div>
                                      <h4 className="font-bold text-gray-900 text-base">{staff.name}</h4>
                                      <p className="text-xs text-gray-500 mt-0.5">{staff.role} &bull; {staff.phone || 'No Phone'}</p>
                                      <div className="flex items-center gap-1 mt-1.5">
                                        <CheckCircle className="w-3.5 h-3.5 text-green-500" />
                                        <p className="text-xs font-semibold text-gray-700">{daysPresent} <span className="font-medium text-gray-500">Days Present on Site</span></p>
                                      </div>
                                    </div>
                                  </div>
                                  <div className="flex gap-2 mt-4 sm:mt-0 opacity-100 sm:opacity-50 group-hover:opacity-100 transition-opacity">
                                    <button type="button" onClick={() => setFormData(prev => ({ ...prev, assignedStaff: prev.assignedStaff.filter(id => id !== staff.id) }))} className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-red-700 bg-red-50 hover:bg-red-100 rounded-lg transition-colors border border-red-100/50">
                                      <X className="w-3.5 h-3.5" /> Unassign
                                    </button>
                                  </div>
                                </motion.div>
                              );
                            })}
                        </>
                      )}
                    </div>

                    <div className="mt-4">
                      <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">Select Workers from Attendance Roster</label>
                      <div className="space-y-2 max-h-48 overflow-y-auto border border-gray-200 rounded-lg p-3 bg-white">
                        {availableStaff.length === 0 ? (
                          <p className="text-sm text-gray-500">No staff available in attendance.</p>
                        ) : (
                          availableStaff.map((staff) => {
                            const isAssignedToThis = formData.assignedStaff.includes(staff.id);
                            const currentSiteInfo = staff.siteId && staff.siteId !== editingSite?.id ? sites.find(s => s.id === staff.siteId) : null;
                            return (
                              <label key={staff.id} className={`flex items-start gap-3 p-2 rounded-lg cursor-pointer transition-colors ${isAssignedToThis ? 'bg-blue-50 border border-blue-100' : 'hover:bg-gray-50 border border-transparent'}`}>
                                <input
                                  type="checkbox"
                                  checked={isAssignedToThis}
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      setFormData({
                                        ...formData,
                                        assignedStaff: [...formData.assignedStaff, staff.id]
                                      });
                                    } else {
                                      setFormData({
                                        ...formData,
                                        assignedStaff: formData.assignedStaff.filter(id => id !== staff.id)
                                      });
                                    }
                                  }}
                                  className="mt-1 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                />
                                <div className="flex-1">
                                  <div className="flex items-center justify-between">
                                    <span className="text-sm font-semibold text-gray-900">{staff.name} <span className="text-xs font-medium text-gray-500 ml-1">({staff.role})</span></span>
                                  </div>
                                  {currentSiteInfo && !isAssignedToThis && (
                                    <span className="text-xs text-amber-600 flex items-center gap-1 mt-0.5">
                                      ↳ Will move from site: <b>{currentSiteInfo.name}</b>
                                    </span>
                                  )}
                                </div>
                              </label>
                            );
                          })
                        )}
                      </div>
                    </div>
                  </div>
                )}
                */}




                {/* <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Site Image</label>
                  <div className="flex items-center gap-4">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleImageUpload(e, 'site')}
                      className="hidden"
                      id="site-image-upload"
                    />
                    <label
                      htmlFor="site-image-upload"
                      className="px-4 py-2 border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors"
                    >
                      Choose Image
                    </label>
                    {formData.image && (
                      <div className="flex items-center gap-2">
                        <img
                          src={formData.image}
                          alt="Site preview"
                          className="h-12 w-12 object-cover rounded-lg"
                        />
                        <button
                          type="button"
                          onClick={() => setFormData({ ...formData, image: '' })}
                          className="text-red-500 hover:text-red-700"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mt-1">Max size: 5MB. Formats: JPG, PNG, GIF</p>
                </div> */}

                {!editingSite && (
                  <div className="border-t pt-4">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Building Details</h3>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Building Name</label>
                      <input
                        type="text"
                        value={formData.buildingName}
                        onChange={(e) => setFormData({ ...formData, buildingName: e.target.value })}
                        className="input-field"
                        placeholder="Enter building name (optional)"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Building Type</label>
                      <select
                        value={formData.buildingType || 'Mixed Use'}
                        onChange={(e) => setFormData({ ...formData, buildingType: e.target.value })}
                        className="input-field"
                      >
                        <option>Residential</option>
                        <option>Commercial</option>
                        <option>Industrial</option>
                        <option>Mixed Use</option>
                        <option>Institutional</option>
                      </select>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Floors</label>
                        <input
                          type="number"
                          min="1"
                          value={formData.buildingFloors}
                          onChange={(e) => setFormData({ ...formData, buildingFloors: e.target.value })}
                          className="input-field"
                          placeholder="Number of floors"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Units</label>
                        <input
                          type="number"
                          min="1"
                          value={formData.buildingUnits}
                          onChange={(e) => setFormData({ ...formData, buildingUnits: e.target.value })}
                          className="input-field"
                          placeholder="Number of units"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Area (sq ft)</label>
                        <input
                          type="number"
                          min="1"
                          value={formData.buildingArea}
                          onChange={(e) => setFormData({ ...formData, buildingArea: e.target.value })}
                          className="input-field"
                          placeholder="Total area"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Building Budget ($)</label>
                        <input
                          type="number"
                          min="0"
                          value={formData.buildingBudget}
                          onChange={(e) => setFormData({ ...formData, buildingBudget: e.target.value })}
                          className="input-field"
                          placeholder="Building budget"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Building Status</label>
                      <select
                        value={formData.buildingStatus}
                        onChange={(e) => setFormData({ ...formData, buildingStatus: e.target.value })}
                        className="input-field"
                      >
                        <option>Active</option>
                        <option>Completed</option>
                        <option>On Hold</option>
                      </select>
                    </div>
                  </div>
                )}

                <div className="flex gap-3 pt-4">
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    type="submit"
                    className="flex-1 btn-primary py-3"
                  >
                    {editingSite ? 'Update Site' : 'Add Site'}
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="flex-1 btn-outline py-3"
                  >
                    Cancel
                  </motion.button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showBuildingModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
            onClick={() => setShowBuildingModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
            >
              <div className="p-6 border-b border-gray-200">
                <h2 className="text-2xl font-bold text-gray-900">
                  {editingBuilding ? 'Edit Building' : 'Add New Building'}
                </h2>
                <p className="text-sm text-gray-600 mt-1">
                  Site: {sites.find(s => s.id === selectedSiteForBuilding)?.name}
                </p>
              </div>

              <form onSubmit={handleBuildingSubmit} className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Building Name *</label>
                  <input
                    type="text"
                    required
                    value={buildingForm.name}
                    onChange={(e) => setBuildingForm({ ...buildingForm, name: e.target.value })}
                    className="input-field"
                    placeholder="Enter building name"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Building Type *</label>
                  <select
                    required
                    value={buildingForm.type}
                    onChange={(e) => setBuildingForm({ ...buildingForm, type: e.target.value })}
                    className="input-field"
                  >
                    <option value="">Select building type</option>
                    <option>Residential</option>
                    <option>Commercial</option>
                    <option>Industrial</option>
                    <option>Mixed Use</option>
                    <option>Institutional</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Floors *</label>
                    <input
                      type="number"
                      required
                      min="1"
                      value={buildingForm.floors}
                      onChange={(e) => setBuildingForm({ ...buildingForm, floors: e.target.value })}
                      className="input-field"
                      placeholder="Number of floors"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Units *</label>
                    <input
                      type="number"
                      required
                      min="1"
                      value={buildingForm.units}
                      onChange={(e) => setBuildingForm({ ...buildingForm, units: e.target.value })}
                      className="input-field"
                      placeholder="Number of units"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Area (sq ft) *</label>
                    <input
                      type="number"
                      required
                      min="1"
                      value={buildingForm.area}
                      onChange={(e) => setBuildingForm({ ...buildingForm, area: e.target.value })}
                      className="input-field"
                      placeholder="Total area"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Budget ($) *</label>
                    <input
                      type="number"
                      required
                      min="0"
                      value={buildingForm.budget}
                      onChange={(e) => setBuildingForm({ ...buildingForm, budget: e.target.value })}
                      className="input-field"
                      placeholder="Building budget"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Progress (%)</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={buildingForm.progress}
                    onChange={(e) => setBuildingForm({ ...buildingForm, progress: e.target.value })}
                    className="input-field"
                    placeholder="0-100"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
                  <select
                    value={buildingForm.status}
                    onChange={(e) => setBuildingForm({ ...buildingForm, status: e.target.value })}
                    className="input-field"
                  >
                    <option>Active</option>
                    <option>Completed</option>
                    <option>On Hold</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Building Image</label>
                  <div className="flex items-center gap-4">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleImageUpload(e, 'building')}
                      className="hidden"
                      id="building-image-upload"
                    />
                    <label
                      htmlFor="building-image-upload"
                      className="px-4 py-2 border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors"
                    >
                      Choose Image
                    </label>
                    {buildingForm.image && (
                      <div className="flex items-center gap-2">
                        <img
                          src={buildingForm.image}
                          alt="Building preview"
                          className="h-12 w-12 object-cover rounded-lg"
                        />
                        <button
                          type="button"
                          onClick={() => setBuildingForm({ ...buildingForm, image: '' })}
                          className="text-red-500 hover:text-red-700"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mt-1">Max size: 5MB. Formats: JPG, PNG, GIF</p>
                </div>

                <div className="flex gap-3 pt-4">
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    type="submit"
                    className="flex-1 btn-primary py-3"
                  >
                    {editingBuilding ? 'Update Building' : 'Add Building'}
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    type="button"
                    onClick={() => setShowBuildingModal(false)}
                    className="flex-1 btn-outline py-3"
                  >
                    Cancel
                  </motion.button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

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
                <label className="block text-sm font-medium text-gray-700 mb-2">Amount ($)</label>
                <input
                  type="number" autoFocus min="1"
                  value={quickExpenseAmount}
                  onChange={(e) => setQuickExpenseAmount(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleSaveQuickExpense() }}
                  className="w-full text-lg px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none transition-shadow"
                  placeholder="e.g. 150"
                />
              </div>
              <div className="p-4 bg-gray-50 border-t border-gray-100 flex gap-3">
                <button onClick={() => setQuickExpenseSite(null)} className="flex-1 py-2.5 bg-white border border-gray-300 rounded-lg font-medium text-gray-700 hover:bg-gray-50">Cancel</button>
                <button onClick={handleSaveQuickExpense} className="flex-1 py-2.5 bg-red-600 text-white rounded-lg font-bold hover:bg-red-700 shadow-sm focus:ring-4 focus:ring-red-500/30 transition-all">Add Expense</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Custom Staff Select Modal */}
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
                  {availableStaff
                    .filter(s => (s.name + s.role + (s.phone || '')).toLowerCase().includes(staffSearchTerm.toLowerCase()))
                    .map(staff => {
                      const theSite = sites.find(s => s.id === quickStaffSite);
                      const isAssignedToThis = (theSite?.assignedStaff || []).includes(staff.id);
                      const currentSiteInfo = staff.siteId && staff.siteId !== quickStaffSite ? sites.find(s => s.id === staff.siteId) : null;

                      return (
                        <div
                          key={staff.id}
                          className={`group flex items-center justify-between p-3.5 rounded-xl border-2 transition-all cursor-pointer ${isAssignedToThis ? 'bg-blue-50 border-blue-500 shadow-sm' : 'bg-white border-gray-100 hover:border-blue-200 shadow-sm'}`}
                          onClick={() => handleToggleQuickStaff(quickStaffSite, staff.id, !isAssignedToThis)}
                        >
                          <div className="flex items-center gap-4">
                            <div className={`shrink-0 w-6 h-6 rounded-md border-2 flex items-center justify-center transition-colors ${isAssignedToThis ? 'bg-blue-600 border-blue-600' : 'border-gray-300 bg-white group-hover:border-blue-400'}`}>
                              {isAssignedToThis && (
                                <svg className="w-3.5 h-3.5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                </svg>
                              )}
                            </div>
                            <div>
                              <h4 className={`text-sm font-bold ${isAssignedToThis ? 'text-blue-900' : 'text-gray-900'}`}>{staff.name}</h4>
                              <p className="text-xs text-gray-500">{staff.role}{staff.phone ? ` • ${staff.phone}` : ''}</p>
                            </div>
                          </div>
                          <div className="shrink-0">
                            {currentSiteInfo && !isAssignedToThis ? (
                              <span className="text-xs font-semibold px-2.5 py-1 bg-amber-100 text-amber-700 rounded-lg">Moves from: {currentSiteInfo.name}</span>
                            ) : isAssignedToThis ? (
                              <span className="text-xs font-bold px-2.5 py-1 bg-blue-100 text-blue-700 rounded-lg">✓ Assigned</span>
                            ) : null}
                          </div>
                        </div>
                      );
                    })}
                  {availableStaff.filter(s => (s.name + s.role + (s.phone || '')).toLowerCase().includes(staffSearchTerm.toLowerCase())).length === 0 && (
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
    </div>
  )
}

SiteManagement.propTypes = {
  userRole: PropTypes.string.isRequired
}

export default SiteManagement