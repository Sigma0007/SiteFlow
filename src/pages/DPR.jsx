import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import {
  Plus,
  MapPin,
  Users,
  Package,
  Calendar,
  CheckCircle,
  AlertCircle,
  TrendingUp,
  FileText,
  ChevronRight
} from 'lucide-react'
import { siteServices, buildingServices, processServices, convertDocsToArray } from '../services/firebaseServices'
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'
import { storage, auth } from '../firebase'

const DPR = ({ userRole = 'admin' }) => {
  const navigate = useNavigate()
  const [showCreateFlow, setShowCreateFlow] = useState(false)
  const [sites, setSites] = useState([])
  const [buildings, setBuildings] = useState([])
  const [staff, setStaff] = useState([])
  const [materials, setMaterials] = useState([])
  const [loading, setLoading] = useState(true)
  const [expandedSiteId, setExpandedSiteId] = useState(null)
  const [formData, setFormData] = useState({
    siteName: '',
    siteArea: '',
    budget: 0,
    startDate: '',
    selectedStaff: [],
    selectedMaterials: [],
    materialQuantities: {},
    // Building fields
    buildingName: '',
    buildingType: 'Mixed Use',
    buildingFloors: 1,
    buildingUnits: 1,
    buildingArea: 1000,
    buildingBudget: 0,
    buildingProgress: 0,
    buildingStatus: 'Active',
    buildingImage: ''
  })

  const handleBuildingImageUpload = async (file) => {
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
      console.log('Starting image upload...', file.name)
      const storageRef = ref(storage, `buildings/${Date.now()}-${file.name}`)
      const snapshot = await uploadBytes(storageRef, file)
      const downloadURL = await getDownloadURL(snapshot.ref)

      console.log('Image uploaded successfully:', downloadURL)
      setFormData(prev => ({
        ...prev,
        buildingImage: downloadURL
      }))
    } catch (error) {
      console.error('Error uploading building image:', error)
      if (error.code === 'storage/unauthorized') {
        alert('Storage access denied. Please check Firebase Storage rules.')
      } else if (error.code === 'storage/cors-error') {
        alert('CORS error. Please configure Firebase Storage CORS.')
      } else {
        alert('Error uploading image: ' + error.message)
      }
    }
  }

  // Load sites and buildings from Firebase on component mount
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true)
        const sitesSnapshot = userRole === 'supervisor' ? await siteServices.getSitesForSupervisor(auth.currentUser?.uid) : await siteServices.getAllSites()
        const sitesData = convertDocsToArray(sitesSnapshot)
        setSites(sitesData)

        const buildingsSnapshot = await buildingServices.getAllBuildings()
        const buildingsData = convertDocsToArray(buildingsSnapshot)
        setBuildings(buildingsData)
      } catch (error) {
        console.error('Error loading data:', error)
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [userRole])

  // Set up real-time listener for sites
  useEffect(() => {
    if (userRole === 'supervisor') return; // Don't use global listener for supervisors
    const unsubscribe = siteServices.onSitesChange((snapshot) => {
      setSites(convertDocsToArray(snapshot))
    })

    return unsubscribe
  }, [userRole])

  // Set up real-time listener for buildings
  useEffect(() => {
    const unsubscribe = buildingServices.onBuildingsChange((snapshot) => {
      setBuildings(convertDocsToArray(snapshot))
    })

    return unsubscribe
  }, [])

  const getBuildingsForSite = (siteId) => {
    return buildings.filter(building => building.siteId === siteId)
  }

  const handleStaffToggle = (staffId) => {
    setFormData(prev => ({
      ...prev,
      selectedStaff: prev.selectedStaff.includes(staffId)
        ? prev.selectedStaff.filter(id => id !== staffId)
        : [...prev.selectedStaff, staffId]
    }))
  }

  const handleMaterialQuantityChange = (materialId, quantity) => {
    setFormData(prev => ({
      ...prev,
      materialQuantities: {
        ...prev.materialQuantities,
        [materialId]: quantity
      }
    }))
  }

  const handleMaterialToggle = (materialId) => {
    setFormData(prev => ({
      ...prev,
      selectedMaterials: prev.selectedMaterials.includes(materialId)
        ? prev.selectedMaterials.filter(id => id !== materialId)
        : [...prev.selectedMaterials, materialId]
    }))
  }

  const handleSubmitFlow = async () => {
    try {
      // Create site in Firebase with ALL data
      const siteData = {
        name: formData.siteName,
        location: formData.siteArea,
        budget: parseInt(formData.budget) || 0,
        startDate: formData.startDate || '',
        progress: 0,
        status: 'Active',
        image: '',
        createdBy: 'admin',
        createdAt: new Date().toISOString(),
        // Add staff data
        staff: formData.selectedStaff.map(id => {
          const staffMember = staff.find(s => s.id === id)
          return staffMember ? {
            id: staffMember.id,
            name: staffMember.name,
            role: staffMember.role
          } : null
        }).filter(Boolean),
        // Add materials data
        materials: formData.selectedMaterials.map(id => {
          const material = materials.find(m => m.id === id)
          const quantity = formData.materialQuantities[id] || 0
          return material ? {
            id: material.id,
            name: material.name,
            unit: material.unit,
            requiredQuantity: quantity
          } : null
        }).filter(Boolean)
      }

      console.log('📍 DPR - Creating site with ALL data:', siteData)

      const siteRef = await siteServices.addSite(siteData)
      const siteId = siteRef.id
      console.log('✅ Site created with ID:', siteId)

      // Create a detailed building for the site (matching Site Management structure)
      const buildingData = {
        name: formData.buildingName || `Main Building - ${formData.siteName}`,
        type: formData.buildingType || 'Mixed Use',
        floors: parseInt(formData.buildingFloors) || 1,
        units: parseInt(formData.buildingUnits) || 1,
        area: parseInt(formData.buildingArea) || 1000,
        budget: parseInt(formData.buildingBudget) || Math.floor((parseInt(formData.budget) || 0) * 0.8),
        progress: parseInt(formData.buildingProgress) || 0,
        status: formData.buildingStatus || 'Active',
        image: formData.buildingImage || '',
        siteId: siteId,
        createdAt: new Date().toISOString()
      }

      console.log('🏗️ DPR - Creating detailed building with data:', buildingData)
      console.log('🏗️ DPR - Site ID for building:', siteId)

      const buildingResult = await buildingServices.addBuilding(buildingData)
      console.log('✅ DPR - Building created with ID:', buildingResult.id)

      // Verify building was created with correct siteId
      const allBuildings = await buildingServices.getAllBuildings()
      const buildingsList = convertDocsToArray(allBuildings)
      console.log('🏗️ DPR - All buildings after creation:', buildingsList)
      console.log('🏗️ DPR - Created building details:', buildingsList.find(b => b.id === buildingResult.id))

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
      console.log('🎉 Default processes created successfully!')

      // Close modal and reset form
      setShowCreateFlow(false)
      setFormData({
        siteName: '',
        siteArea: '',
        budget: 0,
        startDate: '',
        selectedStaff: [],
        selectedMaterials: [],
        materialQuantities: {},
        // Reset building fields
        buildingName: '',
        buildingType: 'Mixed Use',
        buildingFloors: 1,
        buildingUnits: 1,
        buildingArea: 1000,
        buildingBudget: 0,
        buildingProgress: 0,
        buildingStatus: 'Active',
        buildingImage: ''
      })

      alert('✅ Site and building created successfully! They are now available in Site Management and Process Management.')

    } catch (error) {
      console.error('Error creating site and building:', error)
      alert('Error creating site and building: ' + error.message)
    }
  }

  const getStatusColor = (status) => {
    return status === 'active'
      ? 'bg-green-100 text-green-700 border-green-200'
      : 'bg-gray-100 text-gray-700 border-gray-200'
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-6">
      <div className="max-w-7xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Daily Progress Report (DPR)</h1>
          <p className="text-gray-600">Manage sites, staff, and materials in a unified workflow</p>
        </motion.div>

        {/* Quick Actions */}
        <div className="flex flex-wrap gap-4 mb-8">
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setShowCreateFlow(true)}
            className="flex items-center gap-2 px-6 py-3 bg-primary text-white rounded-lg font-medium"
          >
            <Plus className="w-5 h-5" />
            Create New Site Flow
          </motion.button>
        </div>

        {/* Sites Overview */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            <span className="ml-3 text-gray-600">Loading sites...</span>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            {sites.map((site, index) => {
              const siteBuildings = getBuildingsForSite(site.id)
              const hasMultipleBuildings = siteBuildings.length > 1

              return (
                <motion.div
                  key={site.id}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: index * 0.1 }}
                  className="bg-white rounded-xl shadow-sm p-6 border border-gray-200"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="text-xl font-semibold text-gray-900">{site.name}</h3>
                      <p className="text-gray-600 flex items-center gap-1">
                        <MapPin className="w-4 h-4" />
                        {site.location || 'No location set'}
                      </p>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-sm font-medium border ${getStatusColor(site.status)}`}>
                      {site.status}
                    </span>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <p className="text-sm text-gray-600 mb-1">Progress</p>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-blue-500 h-2 rounded-full transition-all duration-500"
                          style={{ width: `${site.progress}%` }}
                        />
                      </div>
                      <p className="text-xs text-gray-500 mt-1">{site.progress}% complete</p>
                    </div>

                    {/* Buildings Section */}
                    {hasMultipleBuildings ? (
                      <div>
                        <button
                          onClick={() => setExpandedSiteId(expandedSiteId === site.id ? null : site.id)}
                          className="flex items-center justify-between w-full text-sm text-gray-600 mb-2 hover:text-blue-600 transition-colors"
                        >
                          <span>Buildings ({siteBuildings.length})</span>
                          <ChevronRight
                            className={`w-4 h-4 transition-transform ${expandedSiteId === site.id ? 'rotate-90' : ''}`}
                          />
                        </button>
                        {expandedSiteId === site.id && (
                          <div className="space-y-2 mt-2">
                            {siteBuildings.map((building) => (
                              <button
                                key={building.id}
                                onClick={() => navigate(`/dpr/${site.id}/${building.id}`)}
                                className="w-full text-left bg-gray-50 p-3 rounded-lg border border-gray-100 hover:bg-blue-50 hover:border-blue-200 transition-colors"
                              >
                                <div className="flex items-center justify-between">
                                  <span className="text-sm font-medium text-gray-800">{building.name}</span>
                                  <span className="text-xs text-gray-500">{building.progress}%</span>
                                </div>
                                <div className="text-xs text-gray-600 mt-1">
                                  {building.type} • {building.floors} floors • {building.area} sq ft
                                </div>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    ) : (
                      // Single building - click directly on site card
                      <button
                        onClick={() => navigate(`/dpr/${site.id}`)}
                        className="w-full text-left"
                      >
                        <div className="text-sm text-blue-600 hover:text-blue-800 font-medium">
                          Open DPR →
                        </div>
                      </button>
                    )}

                    <div>
                      <p className="text-sm text-gray-600 mb-2">Assigned Staff</p>
                      <div className="flex flex-wrap gap-2">
                        {site.staff.map((staffName, idx) => (
                          <span key={idx} className="px-2 py-1 bg-blue-50 text-blue-700 rounded text-xs">
                            {staffName}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div>
                      <p className="text-sm text-gray-600 mb-2">Materials</p>
                      <div className="space-y-1">
                        {site.materials.map((material, idx) => (
                          <p key={idx} className="text-xs text-gray-700 bg-gray-50 px-2 py-1 rounded">
                            {material}
                          </p>
                        ))}
                      </div>
                    </div>
                  </div>
                </motion.div>
              )
            })}
          </div>
        )}

        {/* Create Flow Modal */}
        {showCreateFlow && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
            onClick={() => setShowCreateFlow(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[95vh] overflow-y-auto"
            >
              <div className="p-6 border-b border-gray-200">
                <h2 className="text-2xl font-bold text-gray-900">Create New Site</h2>
                <p className="text-gray-600 mt-1">Add a new construction site with building and processes</p>
              </div>

              <form onSubmit={handleSubmitFlow} className="p-6 space-y-6">
                {/* Site Information */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Site Name *</label>
                    <input
                      type="text"
                      required
                      value={formData.siteName}
                      onChange={(e) => setFormData({ ...formData, siteName: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Enter site name"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Location *</label>
                    <input
                      type="text"
                      required
                      value={formData.siteArea}
                      onChange={(e) => setFormData({ ...formData, siteArea: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Enter site location"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Budget</label>
                    <input
                      type="number"
                      value={formData.budget}
                      onChange={(e) => setFormData({ ...formData, budget: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Enter budget amount"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
                    <select
                      value="Active"
                      disabled
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-500"
                    >
                      <option value="Active">Active</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Start Date</label>
                    <input
                      type="date"
                      value={formData.startDate}
                      onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>

                {/* Building Information */}
                <div className="border-t pt-6 border-blue-200 bg-blue-50">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">🏢 Add New Building</h3>
                  <div className="bg-white p-4 rounded-lg mb-4 border-2 border-blue-300">
                    <p className="text-sm text-gray-600">
                      <strong>Site:</strong> {formData.siteName || 'Enter site name above'}
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Building Name *</label>
                      <input
                        type="text"
                        value={formData.buildingName}
                        onChange={(e) => setFormData({ ...formData, buildingName: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="Enter building name"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Building Type *</label>
                      <select
                        value={formData.buildingType}
                        onChange={(e) => setFormData({ ...formData, buildingType: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      >
                        <option value="Mixed Use">Mixed Use</option>
                        <option value="Residential">Residential</option>
                        <option value="Commercial">Commercial</option>
                        <option value="Industrial">Industrial</option>
                        <option value="Institutional">Institutional</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Floors *</label>
                      <input
                        type="number"
                        min="1"
                        value={formData.buildingFloors}
                        onChange={(e) => setFormData({ ...formData, buildingFloors: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Units *</label>
                      <input
                        type="number"
                        min="1"
                        value={formData.buildingUnits}
                        onChange={(e) => setFormData({ ...formData, buildingUnits: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Area (sq ft) *</label>
                      <input
                        type="number"
                        min="1"
                        value={formData.buildingArea}
                        onChange={(e) => setFormData({ ...formData, buildingArea: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Budget ($) *</label>
                      <input
                        type="number"
                        min="0"
                        value={formData.buildingBudget}
                        onChange={(e) => setFormData({ ...formData, buildingBudget: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Progress (%)</label>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={formData.buildingProgress}
                        onChange={(e) => setFormData({ ...formData, buildingProgress: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
                      <select
                        value={formData.buildingStatus}
                        onChange={(e) => setFormData({ ...formData, buildingStatus: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      >
                        <option value="Active">Active</option>
                        <option value="Completed">Completed</option>
                        <option value="On Hold">On Hold</option>
                        <option value="Pending">Pending</option>
                      </select>
                    </div>
                  </div>

                  <div className="mt-6 space-y-3">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Building Image
                    </label>
                    <input
                      type="text"
                      value={formData.buildingImage}
                      onChange={(e) => setFormData({ ...formData, buildingImage: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Paste an image URL (optional)"
                    />
                    <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                      <label htmlFor="building-image-upload" className="block cursor-pointer">
                        <div className="text-gray-400">
                          <svg className="mx-auto h-12 w-12 text-gray-400" stroke="currentColor" fill="none" viewBox="0 0 48 48">
                            <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                          <p className="mt-2 text-sm text-gray-600">
                            Click to upload image
                          </p>
                          <p className="text-xs text-gray-500">
                            Max size: 5MB. Formats: JPG, PNG, GIF
                          </p>
                        </div>
                      </label>
                      <input
                        id="building-image-upload"
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => handleBuildingImageUpload(e.target.files[0])}
                      />
                      {formData.buildingImage && (
                        <div className="mt-4">
                          <p className="text-xs text-gray-500 mb-2">Preview:</p>
                          <img
                            src={formData.buildingImage}
                            alt="Building preview"
                            className="mx-auto max-h-40 rounded-md object-cover"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Staff Assignment */}
                <div className="border-t pt-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Assign Staff (Optional)</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {staff.map(person => (
                      <motion.div
                        key={person.id}
                        whileHover={{ scale: 1.02 }}
                        className={`p-3 border rounded-lg cursor-pointer transition-colors ${formData.selectedStaff.includes(person.id)
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-gray-300'
                          }`}
                        onClick={() => {
                          setFormData(prev => ({
                            ...prev,
                            selectedStaff: prev.selectedStaff.includes(person.id)
                              ? prev.selectedStaff.filter(id => id !== person.id)
                              : [...prev.selectedStaff, person.id]
                          }))
                        }}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium text-gray-900">{person.name}</p>
                            <p className="text-sm text-gray-600">{person.role}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={`w-2 h-2 rounded-full ${person.available ? 'bg-green-500' : 'bg-red-500'
                              }`}></span>
                            <span className="text-xs text-gray-500">
                              {person.available ? 'Available' : 'Unavailable'}
                            </span>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </div>

                {/* Materials */}
                <div className="border-t pt-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Add Materials (Optional)</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {materials.map(material => (
                      <motion.div
                        key={material.id}
                        className="border border-gray-200 rounded-lg p-4"
                      >
                        <div className="flex items-center justify-between mb-3">
                          <div>
                            <h4 className="font-medium text-gray-900">{material.name}</h4>
                            <p className="text-sm text-gray-600">Available: {material.available} {material.unit}</p>
                          </div>
                          <motion.button
                            type="button"
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => {
                              setFormData(prev => ({
                                ...prev,
                                selectedMaterials: prev.selectedMaterials.includes(material.id)
                                  ? prev.selectedMaterials.filter(id => id !== material.id)
                                  : [...prev.selectedMaterials, material.id]
                              }))
                            }}
                            className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${formData.selectedMaterials.includes(material.id)
                              ? 'bg-blue-500 text-white'
                              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                              }`}
                          >
                            {formData.selectedMaterials.includes(material.id) ? 'Added' : 'Add'}
                          </motion.button>
                        </div>
                        {formData.selectedMaterials.includes(material.id) && (
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
                              value={formData.materialQuantities[material.id] || ''}
                              onChange={(e) => setFormData(prev => ({
                                ...prev,
                                materialQuantities: {
                                  ...prev.materialQuantities,
                                  [material.id]: e.target.value
                                }
                              }))}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                              placeholder="Enter quantity"
                            />
                          </motion.div>
                        )}
                      </motion.div>
                    ))}
                  </div>
                </div>

                {/* Form Actions */}
                <div className="flex justify-end gap-3 pt-6 border-t">
                  <button
                    type="button"
                    onClick={() => setShowCreateFlow(false)}
                    className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium"
                  >
                    Create Site & Building
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </div>
    </div>
  )
}

export default DPR
