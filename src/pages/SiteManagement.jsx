import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, Edit2, Trash2, MapPin, Calendar, DollarSign, TrendingUp, Search, Filter, Users, CheckCircle, XCircle, Clock, X } from 'lucide-react'
import { siteServices, labourServices, attendanceServices, buildingServices, processServices, convertDocsToArray } from '../services/firebaseServices'
import { format, startOfMonth, endOfMonth, eachMonthOfInterval, subYears, addYears } from 'date-fns'

const SiteManagement = ({ userRole }) => {
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
  const [formData, setFormData] = useState({
    name: '',
    location: '',
    startDate: '',
    endDate: '',
    budget: 0,
    progress: 0,
    status: 'Active',
    image: '',
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
    image: ''
  })

  // Image upload handler
  const handleImageUpload = async (e, formType) => {
    const file = e.target.files[0]
    if (!file) return

    // Check file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert('Image size should be less than 5MB')
      return
    }

    // Check file type
    if (!file.type.startsWith('image/')) {
      alert('Please upload an image file')
      return
    }

    try {
      // Create a unique filename
      const timestamp = new Date().getTime()
      const filename = `${formType}_${timestamp}_${file.name}`
      
      // For now, convert to base64 and store in Firestore
      // In production, you'd want to use Firebase Storage
      const reader = new FileReader()
      reader.onload = async (event) => {
        const base64String = event.target.result
        
        if (formType === 'site') {
          setFormData(prev => ({ ...prev, image: base64String }))
        } else if (formType === 'building') {
          setBuildingForm(prev => ({ ...prev, image: base64String }))
        }
      }
      reader.readAsDataURL(file)
    } catch (error) {
      console.error('Error uploading image:', error)
      alert('Error uploading image')
    }
  }

  // Load data from Firebase on component mount
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true)
        
        // Load sites
        const sitesSnapshot = await siteServices.getAllSites()
        setSites(convertDocsToArray(sitesSnapshot))
        
        // Load labour
        const labourSnapshot = await labourServices.getAllLabour()
        setLabour(convertDocsToArray(labourSnapshot))
        
        // Load today's attendance
        const today = format(new Date(), 'yyyy-MM-dd')
        const attendanceSnapshot = await attendanceServices.getAttendanceByDate(today)
        setAttendance(convertDocsToArray(attendanceSnapshot))
        
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
  }, [])

  // Set up real-time listeners
  useEffect(() => {
    const unsubscribeSites = siteServices.onSitesChange((snapshot) => {
      setSites(convertDocsToArray(snapshot))
    })

    const unsubscribeLabour = labourServices.onLabourChange((snapshot) => {
      setLabour(convertDocsToArray(snapshot))
    })

    const unsubscribeAttendance = attendanceServices.onAttendanceChange((snapshot) => {
      setAttendance(convertDocsToArray(snapshot))
    })

    const unsubscribeBuildings = buildingServices.onBuildingsChange((snapshot) => {
      setBuildings(convertDocsToArray(snapshot))
    })

    return () => {
      unsubscribeSites()
      unsubscribeLabour()
      unsubscribeAttendance()
      unsubscribeBuildings()
    }
  }, [])

  const handleAdd = () => {
    setEditingSite(null)
    setFormData({
      name: '',
      location: '',
      startDate: '',
      endDate: '',
      budget: 0,
      progress: 0,
      status: 'Active',
      image: '',
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

  const handleEdit = (site) => {
    setEditingSite(site)
    setFormData(site)
    setShowModal(true)
  }

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this site?')) {
      try {
        await siteServices.deleteSite(id)
      } catch (error) {
        console.error('Error deleting site:', error)
      }
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    try {
      const siteData = {
        name: formData.name,
        location: formData.location,
        startDate: formData.startDate,
        endDate: formData.endDate,
        budget: parseInt(formData.budget) || 0,
        progress: parseInt(formData.progress) || 0,
        status: formData.status,
        image: formData.image || '',
        createdAt: new Date().toISOString()
      }
      
      let siteId;
      if (editingSite) {
        await siteServices.updateSite(editingSite.id, siteData)
        siteId = editingSite.id
      } else {
        const siteRef = await siteServices.addSite(siteData)
        siteId = siteRef.id
        
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
      setFormData({
        name: '',
        location: '',
        startDate: '',
        endDate: '',
        budget: 0,
        progress: 0,
        status: 'Active',
        buildingName: '',
        buildingType: '',
        buildingFloors: 1,
        buildingUnits: 1,
        buildingArea: 1000,
        buildingBudget: 0,
        buildingProgress: 0,
        buildingStatus: 'Active'
      })
      setEditingSite(null)
    } catch (error) {
      console.error('Error saving site:', error)
    }
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
      image: ''
    })
    setShowBuildingModal(true)
  }

  const handleEditBuilding = (building) => {
    setEditingBuilding(building)
    setBuildingForm(building)
    setSelectedSiteForBuilding(building.siteId)
    setShowBuildingModal(true)
  }

  const handleDeleteBuilding = async (id) => {
    if (window.confirm('Are you sure you want to delete this building?')) {
      try {
        await buildingServices.deleteBuilding(id)
      } catch (error) {
        console.error('Error deleting building:', error)
      }
    }
  }

  const handleBuildingSubmit = async (e) => {
    e.preventDefault()
    
    try {
      const buildingData = {
        ...buildingForm,
        siteId: selectedSiteForBuilding,
        floors: parseInt(buildingForm.floors) || 0,
        units: parseInt(buildingForm.units) || 0,
        area: parseInt(buildingForm.area) || 0,
        budget: parseInt(buildingForm.budget) || 0,
        progress: parseInt(buildingForm.progress) || 0,
        createdAt: new Date().toISOString()
      }
      
      if (editingBuilding) {
        await buildingServices.updateBuilding(editingBuilding.id, buildingData)
      } else {
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
        image: ''
      })
      setEditingBuilding(null)
      setSelectedSiteForBuilding(null)
    } catch (error) {
      console.error('Error saving building:', error)
    }
  }

  const getBuildingsForSite = (siteId) => {
    return buildings.filter(building => building.siteId === siteId)
  }

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

  const getSiteAttendanceStats = (siteName) => {
    const today = format(new Date(), 'yyyy-MM-dd')
    const staffAtSite = labour.filter(staff => staff.currentSite === siteName)
    
    const present = staffAtSite.filter(staff => {
      const attendanceRecord = attendance.find(a => 
        a.labourId === staff.id && a.date === today && a.status === 'Present'
      )
      return attendanceRecord !== undefined
    }).length
    
    const absent = staffAtSite.filter(staff => {
      const attendanceRecord = attendance.find(a => 
        a.labourId === staff.id && a.date === today && a.status === 'Absent'
      )
      return attendanceRecord !== undefined
    }).length
    
    const leave = staffAtSite.filter(staff => {
      const attendanceRecord = attendance.find(a => 
        a.labourId === staff.id && a.date === today && a.status === 'Leave'
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

  const getBuildingAttendanceStats = (buildingName) => {
    const today = format(new Date(), 'yyyy-MM-dd')
    const staffAtBuilding = labour.filter(staff => staff.currentBuilding === buildingName)
    
    const present = staffAtBuilding.filter(staff => {
      const attendanceRecord = attendance.find(a => 
        a.labourId === staff.id && a.date === today && a.status === 'Present'
      )
      return attendanceRecord !== undefined
    }).length
    
    const absent = staffAtBuilding.filter(staff => {
      const attendanceRecord = attendance.find(a => 
        a.labourId === staff.id && a.date === today && a.status === 'Absent'
      )
      return attendanceRecord !== undefined
    }).length
    
    const leave = staffAtBuilding.filter(staff => {
      const attendanceRecord = attendance.find(a => 
        a.labourId === staff.id && a.date === today && a.status === 'Leave'
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
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Site Management</h1>
          <p className="text-gray-600 mt-1">Manage all construction sites and projects</p>
        </div>
        {(userRole === 'admin' || userRole === 'manager') && (
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={handleAdd}
            className="btn-primary flex items-center gap-2"
          >
            <Plus className="w-5 h-5" />
            Add New Site
          </motion.button>
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
                        <div className="flex items-center gap-1 text-sm text-gray-600">
                          <MapPin className="w-4 h-4" />
                          {site.location}
                        </div>
                      </div>
                    </div>
                  </div>
                  <span className={`badge border ${getStatusColor(site.status)}`}>
                    {site.status}
                  </span>
                </div>

                <div className="space-y-3 mb-4">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600 flex items-center gap-1">
                      <Calendar className="w-4 h-4" />
                      Start Date
                    </span>
                    <span className="font-medium text-gray-900">{site.startDate}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600 flex items-center gap-1">
                      <Calendar className="w-4 h-4" />
                      End Date
                    </span>
                    <span className="font-medium text-gray-900">{site.endDate}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600 flex items-center gap-1">
                      <DollarSign className="w-4 h-4" />
                      Budget
                    </span>
                    <span className="font-medium text-gray-900">${site.budget.toLocaleString()}</span>
                  </div>
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

                <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-2 mb-3">
                    <Users className="w-4 h-4 text-gray-600" />
                    <span className="text-sm font-semibold text-gray-700">Today's Attendance</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="flex items-center gap-1">
                      <CheckCircle className="w-3 h-3 text-green-600" />
                      <span className="text-gray-600">Present:</span>
                      <span className="font-semibold text-green-600">{getSiteAttendanceStats(site.name).present}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <XCircle className="w-3 h-3 text-red-600" />
                      <span className="text-gray-600">Absent:</span>
                      <span className="font-semibold text-red-600">{getSiteAttendanceStats(site.name).absent}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Clock className="w-3 h-3 text-yellow-600" />
                      <span className="text-gray-600">Leave:</span>
                      <span className="font-semibold text-yellow-600">{getSiteAttendanceStats(site.name).leave}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Users className="w-3 h-3 text-gray-600" />
                      <span className="text-gray-600">Total:</span>
                      <span className="font-semibold text-gray-700">{getSiteAttendanceStats(site.name).total}</span>
                    </div>
                  </div>
                </div>

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
                        const stats = getBuildingAttendanceStats(building.name)
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
                                {(userRole === 'admin' || userRole === 'manager') && (
                                  <div className="flex gap-1">
                                    <button
                                      onClick={() => handleEditBuilding(building)}
                                      className="text-xs text-blue-600 hover:text-blue-800"
                                    >
                                      <Edit2 className="w-3 h-3" />
                                    </button>
                                    <button
                                      onClick={() => handleDeleteBuilding(building.id)}
                                      className="text-xs text-red-600 hover:text-red-800"
                                    >
                                      <Trash2 className="w-3 h-3" />
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>
                            <div className="grid grid-cols-2 gap-1 text-xs text-gray-600 mb-1">
                              <span>Type: {building.type}</span>
                              <span>Floors: {building.floors}</span>
                              <span>Units: {building.units}</span>
                              <span>Area: {building.area.toLocaleString()} sq ft</span>
                            </div>
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

                <div className="grid grid-cols-2 gap-4">
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

                <div>
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
                </div>

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
                        value={formData.buildingType}
                        onChange={(e) => setFormData({ ...formData, buildingType: e.target.value })}
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

    </div>
  )
}

export default SiteManagement