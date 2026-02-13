import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, Edit2, Trash2, CheckSquare, Square, ChevronDown, ChevronRight, MapPin, Building, X } from 'lucide-react'
import { siteServices, buildingServices, processServices, convertDocsToArray } from '../services/firebaseServices'

const ProcessManagement = ({ userRole }) => {
  const [sites, setSites] = useState([])
  const [buildings, setBuildings] = useState([])
  const [processes, setProcesses] = useState([])
  const [selectedSite, setSelectedSite] = useState('')
  const [selectedBuilding, setSelectedBuilding] = useState('')
  const [expandedProcesses, setExpandedProcesses] = useState([])
  const [showModal, setShowModal] = useState(false)
  const [modalType, setModalType] = useState('process')
  const [editingItem, setEditingItem] = useState(null)
  const [selectedProcessId, setSelectedProcessId] = useState(null)
  const [loading, setLoading] = useState(true)
  const [formData, setFormData] = useState({ name: '', description: '', status: 'active', image: '' })
  const [showImagePreview, setShowImagePreview] = useState(false)
  const [previewImage, setPreviewImage] = useState('')

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

  // Load data from Firebase on component mount
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true)
        
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
  }, [])

  // Load processes when site and building are selected
  useEffect(() => {
    const loadProcesses = async () => {
      if (selectedSite && selectedBuilding) {
        try {
          console.log('Loading processes for site:', selectedSite, 'building:', selectedBuilding)
          setLoading(true)
          
          const processesSnapshot = await processServices.getProcessesByBuilding(selectedSite, selectedBuilding)
          console.log('Processes snapshot:', processesSnapshot)
          
          const processesArray = convertDocsToArray(processesSnapshot)
          console.log('Processes array:', processesArray)
          
          setProcesses(processesArray)
        } catch (error) {
          console.error('Error loading processes:', error)
          console.error('Error details:', error.message, error.code)
          setProcesses([])
        } finally {
          setLoading(false)
        }
      } else {
        setProcesses([])
        setLoading(false)
      }
    }

    loadProcesses()
  }, [selectedSite, selectedBuilding])

  // Set up real-time listeners
  useEffect(() => {
    const unsubscribeSites = siteServices.onSitesChange((snapshot) => {
      setSites(convertDocsToArray(snapshot))
    })

    const unsubscribeBuildings = buildingServices.onBuildingsChange((snapshot) => {
      setBuildings(convertDocsToArray(snapshot))
    })

    const unsubscribeProcesses = selectedSite && selectedBuilding 
      ? processServices.onProcessesChange(selectedSite, selectedBuilding, (snapshot) => {
          setProcesses(convertDocsToArray(snapshot))
        })
      : null

    return () => {
      unsubscribeSites()
      unsubscribeBuildings()
      if (unsubscribeProcesses) unsubscribeProcesses()
    }
  }, [selectedSite, selectedBuilding])

  const getBuildingsForSite = (siteId) => {
    const site = sites.find(s => s.id === siteId)
    if (!site) return []
    return buildings.filter(b => b.siteId === siteId)
  }

  const handleSiteChange = (siteId) => {
    setSelectedSite(siteId)
    setSelectedBuilding('') // Reset building when site changes
    setExpandedProcesses([]) // Reset expanded processes
  }

  const handleBuildingChange = (buildingId) => {
    setSelectedBuilding(buildingId)
    setExpandedProcesses([]) // Reset expanded processes
    // Add a small delay to ensure the building is fully selected before initializing
    setTimeout(() => {
      initializeDefaultProcesses()
    }, 500)
  }

  const initializeDefaultProcesses = async () => {
    if (!selectedSite || !selectedBuilding) return
    
    try {
      console.log('🔧 Initializing default processes for building:', selectedBuilding)
      console.log('📍 Selected site ID:', selectedSite)
      console.log('🏢 Selected building ID:', selectedBuilding)
      
      // Check if processes already exist for this building
      const existingProcesses = await processServices.getProcessesByBuilding(selectedSite, selectedBuilding)
      const existingProcessesArray = convertDocsToArray(existingProcesses)
      
      console.log('📊 Existing processes count:', existingProcessesArray.length)
      console.log('📋 Existing processes:', existingProcessesArray)
      
      // Always add default processes if less than 7 exist (in case some are missing)
      if (existingProcessesArray.length < 7) {
        console.log('➕ Adding missing default processes...')
        
        // Get existing process names to avoid duplicates
        const existingProcessNames = existingProcessesArray.map(p => p.name.toLowerCase())
        
        // Add default processes that don't already exist
        for (const defaultProcess of defaultProcesses) {
          if (!existingProcessNames.includes(defaultProcess.name.toLowerCase())) {
            const processToAdd = {
              ...defaultProcess,
              siteId: selectedSite,
              buildingId: selectedBuilding,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            }
            console.log('➕ Adding process:', processToAdd.name)
            const result = await processServices.addProcess(selectedSite, selectedBuilding, processToAdd)
            console.log('✅ Process added with ID:', result.id)
          } else {
            console.log('⏭️ Skipping existing process:', defaultProcess.name)
          }
        }
        console.log('🎉 Default processes initialization completed!')
        
        // Reload processes to verify they were added
        setTimeout(async () => {
          const newProcesses = await processServices.getProcessesByBuilding(selectedSite, selectedBuilding)
          const newProcessesArray = convertDocsToArray(newProcesses)
          console.log('✅ Verification - processes after adding:', newProcessesArray)
          console.log('📈 Total processes now:', newProcessesArray.length)
        }, 1000)
      } else {
        console.log('✅ All 7 processes already exist, skipping initialization')
      }
    } catch (error) {
      console.error('❌ Error initializing default processes:', error)
      console.error('🔍 Full error object:', JSON.stringify(error, null, 2))
    }
  }

  const updateSubProcessStatus = async (processId, subProcessId, newStatus) => {
    try {
      const process = processes.find(p => p.id === processId)
      const subProcess = process.subProcesses.find(sp => sp.id === subProcessId)
      
      await processServices.updateSubProcess(selectedSite, selectedBuilding, processId, subProcessId, {
        ...subProcess,
        status: newStatus,
        updatedAt: new Date().toISOString()
      })
    } catch (error) {
      console.error('Error updating sub-process status:', error)
    }
  }

  const updateProcessStatus = async (processId, newStatus) => {
    try {
      const process = processes.find(p => p.id === processId)
      
      await processServices.updateProcess(selectedSite, selectedBuilding, processId, {
        ...process,
        status: newStatus,
        updatedAt: new Date().toISOString()
      })
    } catch (error) {
      console.error('Error updating process status:', error)
    }
  }

  const getProcessStatusColor = (status) => {
    switch (status) {
      case 'completed':
        return 'text-green-600 bg-green-100 border-green-200'
      case 'hold':
        return 'text-yellow-600 bg-yellow-100 border-yellow-200'
      case 'active':
      default:
        return 'text-blue-600 bg-blue-100 border-blue-200'
    }
  }

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed':
        return 'text-green-600 bg-green-100'
      case 'hold':
        return 'text-yellow-600 bg-yellow-100'
      case 'pending':
      default:
        return 'text-gray-600 bg-gray-100'
    }
  }

  const getStatusIcon = (status) => {
    switch (status) {
      case 'completed':
        return <CheckSquare className="w-5 h-5 text-green-600" />
      case 'hold':
        return <Square className="w-5 h-5 text-yellow-600" />
      case 'pending':
      default:
        return <Square className="w-5 h-5 text-gray-400" />
    }
  }

  // Image upload handler
  const handleImageUpload = async (e) => {
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
      const filename = `process_${timestamp}_${file.name}`
      
      // For now, convert to base64 and store in Firestore
      // In production, you'd want to use Firebase Storage
      const reader = new FileReader()
      reader.onload = async (event) => {
        const base64String = event.target.result
        setFormData(prev => ({ ...prev, image: base64String }))
      }
      reader.readAsDataURL(file)
    } catch (error) {
      console.error('Error uploading image:', error)
      alert('Error uploading image')
    }
  }

  const toggleProcess = (processId) => {
    setExpandedProcesses(prev => 
      prev.includes(processId) 
        ? prev.filter(id => id !== processId)
        : [...prev, processId]
    )
  }

  const handleAddProcess = () => {
    setModalType('process')
    setEditingItem(null)
    setFormData({ name: '', description: '', status: 'active', image: '' })
    setShowModal(true)
  }

  const handleAddSubProcess = (processId) => {
    setModalType('subprocess')
    setEditingItem(null)
    setSelectedProcessId(processId)
    setFormData({ name: '', description: '' })
    setShowModal(true)
  }

  const handleEdit = (item, type, processId = null) => {
    setModalType(type)
    setEditingItem(item)
    setSelectedProcessId(processId)
    if (type === 'process') {
      setFormData({ 
        name: item.name, 
        description: item.description || '',
        status: item.status || 'active',
        image: item.image || ''
      })
    } else {
      setFormData({ 
        name: item.name, 
        description: item.description || '' 
      })
    }
    setShowModal(true)
  }

  const handleDelete = async (id, type, processId = null) => {
    if (!window.confirm(`Are you sure you want to delete this ${type}?`)) return

    try {
      if (type === 'process') {
        await processServices.deleteProcess(selectedSite, selectedBuilding, id)
      } else {
        await processServices.deleteSubProcess(selectedSite, selectedBuilding, processId, id)
      }
    } catch (error) {
      console.error('Error deleting:', error)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    try {
      const processData = {
        ...formData,
        siteId: selectedSite,
        buildingId: selectedBuilding,
        updatedAt: new Date().toISOString()
      }

      if (modalType === 'process') {
        if (editingItem) {
          await processServices.updateProcess(selectedSite, selectedBuilding, editingItem.id, processData)
        } else {
          await processServices.addProcess(selectedSite, selectedBuilding, {
            ...processData,
            subProcesses: [],
            createdAt: new Date().toISOString()
          })
        }
      } else {
        const subProcessData = {
          ...formData,
          status: 'pending',
          updatedAt: new Date().toISOString()
        }
        
        if (editingItem) {
          await processServices.updateSubProcess(selectedSite, selectedBuilding, selectedProcessId, editingItem.id, subProcessData)
        } else {
          await processServices.addSubProcess(selectedSite, selectedBuilding, selectedProcessId, {
            ...subProcessData,
            createdAt: new Date().toISOString()
          })
        }
      }

      setShowModal(false)
      setFormData({ name: '', description: '', status: 'active', image: '' })
      setEditingItem(null)
      setSelectedProcessId(null)
    } catch (error) {
      console.error('Error saving:', error)
    }
  }

  const toggleSubProcessCompletion = async (processId, subProcessId) => {
    try {
      const process = processes.find(p => p.id === processId)
      const subProcess = process.subProcesses.find(sp => sp.id === subProcessId)
      
      await processServices.updateSubProcess(selectedSite, selectedBuilding, processId, subProcessId, {
        ...subProcess,
        completed: !subProcess.completed,
        updatedAt: new Date().toISOString()
      })
    } catch (error) {
      console.error('Error toggling completion:', error)
    }
  }

  const getProcessProgress = (process) => {
    if (process.subProcesses.length === 0) return 0
    const completed = process.subProcesses.filter(sp => sp.status === 'completed').length
    return Math.round((completed / process.subProcesses.length) * 100)
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Process Management</h1>
          <p className="text-gray-600 mt-1">Manage construction processes and sub-processes for specific buildings</p>
        </div>
      </div>

      {/* Site and Building Selection */}
      <div className="card">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <MapPin className="w-4 h-4 inline mr-1" />
              Select Site *
            </label>
            <select
              value={selectedSite}
              onChange={(e) => handleSiteChange(e.target.value)}
              className="input-field"
              required
            >
              <option value="">Choose a site</option>
              {sites.map((site) => (
                <option key={site.id} value={site.id}>
                  {site.name} - {site.location}
                </option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Building className="w-4 h-4 inline mr-1" />
              Select Building *
            </label>
            <select
              value={selectedBuilding}
              onChange={(e) => handleBuildingChange(e.target.value)}
              className="input-field"
              required
              disabled={!selectedSite}
            >
              <option value="">Choose a building</option>
              {getBuildingsForSite(selectedSite).map((building) => (
                <option key={building.id} value={building.id}>
                  {building.name} ({building.type})
                </option>
              ))}
            </select>
          </div>
        </div>
        {selectedSite && selectedBuilding && (
          <div className="mt-4 p-3 bg-blue-50 rounded-lg">
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-blue-600" />
              <span className="text-sm font-medium text-blue-900">
                {sites.find(s => s.id === selectedSite)?.name}
              </span>
              <span className="text-blue-400">→</span>
              <Building className="w-4 h-4 text-blue-600" />
              <span className="text-sm font-medium text-blue-900">
                {getBuildingsForSite(selectedSite).find(b => b.id === selectedBuilding)?.name}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Processes Section */}
      {selectedSite && selectedBuilding ? (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-900">
              Building Processes
              <span className="ml-2 text-sm font-normal text-gray-600">
                ({processes.length} {processes.length === 1 ? 'process' : 'processes'})
              </span>
            </h2>
            <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
              {(userRole === 'admin' || userRole === 'manager') && (
                <>
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={initializeDefaultProcesses}
                    className="btn-secondary text-sm py-2 px-4 flex items-center justify-center gap-2 w-full sm:w-auto"
                  >
                    <Plus className="w-4 h-4 flex-shrink-0" />
                    <span className="hidden sm:inline">Initialize Default Processes</span>
                    <span className="sm:hidden">Initialize</span>
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={handleAddProcess}
                    className="btn-primary flex items-center justify-center gap-2 w-full sm:w-auto"
                  >
                    <Plus className="w-5 h-5 flex-shrink-0" />
                    <span className="hidden sm:inline">Add Process</span>
                    <span className="sm:hidden">Add</span>
                  </motion.button>
                </>
              )}
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              <span className="ml-3 text-gray-600">Loading processes...</span>
            </div>
          ) : processes.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-gray-400 mb-4">
                <Building className="w-16 h-16 mx-auto" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">No processes yet</h3>
              <p className="text-gray-600 mb-4">
                Start by adding your first construction process for this building
              </p>
              {(userRole === 'admin' || userRole === 'manager') && (
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={handleAddProcess}
                  className="btn-primary flex items-center justify-center gap-2 mx-auto w-full sm:w-auto max-w-xs"
                >
                  <Plus className="w-5 h-5 flex-shrink-0" />
                  <span className="hidden sm:inline">Add First Process</span>
                  <span className="sm:hidden">Add Process</span>
                </motion.button>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {processes.map((process, index) => {
                const isExpanded = expandedProcesses.includes(process.id)
                const progress = getProcessProgress(process)
                
                return (
                  <motion.div
                    key={process.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.1 }}
                    className="card border border-gray-200 overflow-hidden"
                  >
                    <div className="flex flex-col lg:flex-row lg:items-start gap-4 mb-4 pr-20 lg:pr-0">
                      <div className="flex items-start gap-3 flex-1 min-w-0">
                        <motion.button
                          whileHover={{ scale: 1.1 }}
                          whileTap={{ scale: 0.9 }}
                          onClick={() => toggleProcess(process.id)}
                          className="p-1 hover:bg-gray-100 rounded transition-colors mt-1 flex-shrink-0"
                        >
                          {isExpanded ? (
                            <ChevronDown className="w-5 h-5 text-gray-600" />
                          ) : (
                            <ChevronRight className="w-5 h-5 text-gray-600" />
                          )}
                        </motion.button>
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-col sm:flex-row sm:items-start gap-3 mb-2">
                            {process.image && (
                              <img
                                src={process.image}
                                alt={process.name}
                                className="h-12 w-12 object-cover rounded-lg flex-shrink-0 cursor-pointer hover:opacity-80 transition-opacity"
                                onClick={() => {
                                  setPreviewImage(process.image)
                                  setShowImagePreview(true)
                                }}
                              />
                            )}
                            <div className="flex-1 min-w-0">
                              <h3 className="text-lg font-semibold text-gray-900 truncate">{process.name}</h3>
                              <p className="text-sm text-gray-600 line-clamp-2">{process.description}</p>
                            </div>
                            {(userRole === 'admin' || userRole === 'manager') && (
                              <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 flex-shrink-0">
                                <select
                                  value={process.status || 'active'}
                                  onChange={(e) => updateProcessStatus(process.id, e.target.value)}
                                  className={`text-xs px-2 py-1 rounded border ${getProcessStatusColor(process.status || 'active')} border-current font-medium`}
                                >
                                  <option value="active">Active</option>
                                  <option value="hold">Hold</option>
                                  <option value="completed">Completed</option>
                                </select>
                                <div className="flex gap-1 sm:gap-2">
                                  <motion.button
                                    whileHover={{ scale: 1.1 }}
                                    whileTap={{ scale: 0.9 }}
                                    onClick={() => handleEdit(process, 'process')}
                                    className="p-1.5 sm:p-2 bg-white hover:bg-gray-100 rounded-lg shadow-md transition-colors"
                                    title="Edit Process"
                                  >
                                    <Edit2 className="w-4 h-4 text-gray-600" />
                                  </motion.button>
                                  <motion.button
                                    whileHover={{ scale: 1.1 }}
                                    whileTap={{ scale: 0.9 }}
                                    onClick={() => handleDelete(process.id, 'process')}
                                    className="p-1.5 sm:p-2 bg-white hover:bg-red-50 rounded-lg shadow-md transition-colors"
                                    title="Delete Process"
                                  >
                                    <Trash2 className="w-4 h-4 text-red-600" />
                                  </motion.button>
                                </div>
                              </div>
                            )}
                          </div>
                          <div className="flex items-center gap-2 mt-3">
                            <span className="text-sm text-gray-600">
                              {process.subProcesses?.filter(sp => sp.status === 'completed').length || 0} / {process.subProcesses?.length || 0} sub-processes completed
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <AnimatePresence>
                      {isExpanded && process.subProcesses && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.3 }}
                          className="overflow-hidden"
                        >
                          <div className="border-t border-gray-200 pt-4 mt-4">
                            <div className="flex items-center justify-between mb-3">
                              <h4 className="font-semibold text-gray-900">Sub-Processes</h4>
                              {(userRole === 'admin' || userRole === 'manager') && (
                                <motion.button
                                  whileHover={{ scale: 1.05 }}
                                  whileTap={{ scale: 0.95 }}
                                  onClick={() => handleAddSubProcess(process.id)}
                                  className="btn-secondary text-sm py-1.5 px-3 flex items-center justify-center gap-1 w-full sm:w-auto"
                                >
                                  <Plus className="w-4 h-4 flex-shrink-0" />
                                  <span className="hidden sm:inline">Add Sub-Process</span>
                                  <span className="sm:hidden">Add</span>
                                </motion.button>
                              )}
                            </div>

                            {process.subProcesses.length === 0 ? (
                              <p className="text-gray-500 text-sm py-4 text-center">No sub-processes added yet</p>
                            ) : (
                              <div className="space-y-2">
                                {process.subProcesses.map((subProcess, spIndex) => (
                                  <motion.div
                                    key={subProcess.id}
                                    initial={{ opacity: 0, x: -20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: spIndex * 0.05 }}
                                    className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                                  >
                                    <motion.button
                                      whileHover={{ scale: 1.1 }}
                                      whileTap={{ scale: 0.9 }}
                                      onClick={() => updateSubProcessStatus(process.id, subProcess.id, subProcess.status === 'completed' ? 'pending' : 'completed')}
                                      className="mt-0.5"
                                    >
                                      {getStatusIcon(subProcess.status || 'pending')}
                                    </motion.button>
                                    <div className="flex-1">
                                      <h5 className={`font-medium ${
                                        subProcess.status === 'completed' ? 'text-gray-500 line-through' : 'text-gray-900'
                                      }`}>
                                        {subProcess.name}
                                      </h5>
                                      {subProcess.description && (
                                        <p className="text-sm text-gray-600 mt-1">{subProcess.description}</p>
                                      )}
                                    </div>
                                    {(userRole === 'admin' || userRole === 'manager') && (
                                      <div className="flex gap-1">
                                        <motion.button
                                          whileHover={{ scale: 1.1 }}
                                          whileTap={{ scale: 0.9 }}
                                          onClick={() => handleEdit(subProcess, 'subprocess', process.id)}
                                          className="p-1 sm:p-1.5 hover:bg-gray-200 rounded transition-colors"
                                          title="Edit Sub-Process"
                                        >
                                          <Edit2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-gray-600" />
                                        </motion.button>
                                        <motion.button
                                          whileHover={{ scale: 1.1 }}
                                          whileTap={{ scale: 0.9 }}
                                          onClick={() => handleDelete(subProcess.id, 'subprocess', process.id)}
                                          className="p-1 sm:p-1.5 hover:bg-red-100 rounded transition-colors"
                                          title="Delete Sub-Process"
                                        >
                                          <Trash2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-red-600" />
                                        </motion.button>
                                      </div>
                                    )}
                                  </motion.div>
                                ))}
                              </div>
                            )}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                )
              })}
            </div>
          )}
        </div>
      ) : (
        <div className="text-center py-12">
          <div className="text-gray-400 mb-4">
            <MapPin className="w-16 h-16 mx-auto" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">Select Site and Building</h3>
          <p className="text-gray-600">
            Please select a site and building to manage processes
          </p>
        </div>
      )}

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
              className="bg-white rounded-xl shadow-2xl w-full max-w-md"
            >
              <div className="p-6 border-b border-gray-200">
                <h2 className="text-2xl font-bold text-gray-900">
                  {editingItem ? 'Edit' : 'Add'} {modalType === 'process' ? 'Process' : 'Sub-Process'}
                </h2>
              </div>

              <form onSubmit={handleSubmit} className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Name *</label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="input-field"
                    placeholder="Enter name"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="input-field"
                    rows="3"
                    placeholder="Enter description (optional)"
                  />
                </div>

                {modalType === 'process' && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
                      <select
                        value={formData.status || 'active'}
                        onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                        className="input-field"
                      >
                        <option value="active">Active</option>
                        <option value="hold">Hold</option>
                        <option value="completed">Completed</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Process Image</label>
                      <div className="flex items-center gap-4">
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleImageUpload}
                          className="hidden"
                          id="process-image-upload"
                        />
                        <label
                          htmlFor="process-image-upload"
                          className="px-4 py-2 border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors"
                        >
                          Choose Image
                        </label>
                        {formData.image && (
                          <div className="flex items-center gap-2">
                            <img
                              src={formData.image}
                              alt="Process preview"
                              className="h-12 w-12 object-cover rounded-lg cursor-pointer hover:opacity-80 transition-opacity"
                              onClick={() => {
                                setPreviewImage(formData.image)
                                setShowImagePreview(true)
                              }}
                            />
                            <button
                              type="button"
                              onClick={() => setFormData({ ...formData, image: '' })}
                              className="text-red-500 hover:text-red-700"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 mt-1">Max size: 5MB. Formats: JPG, PNG, GIF</p>
                    </div>
                  </>
                )}

                <div className="flex gap-3 pt-4">
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    type="submit"
                    className="flex-1 btn-primary py-3"
                  >
                    {editingItem ? 'Update' : 'Add'}
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

        {showImagePreview && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-95 flex items-center justify-center z-50 p-4"
            onClick={() => setShowImagePreview(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative w-full h-full flex items-center justify-center"
              onClick={(e) => e.stopPropagation()}
            >
              <img
                src={previewImage}
                alt="Process preview"
                className="max-w-full max-h-[90vh] w-auto h-auto object-contain rounded-lg shadow-2xl"
              />
              <button
                onClick={() => setShowImagePreview(false)}
                className="absolute top-4 right-4 p-3 bg-white rounded-full shadow-lg hover:bg-gray-100 transition-colors z-10"
              >
                <X className="w-6 h-6 text-gray-600" />
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default ProcessManagement