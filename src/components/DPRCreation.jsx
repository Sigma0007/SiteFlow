import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  MapPin, 
  Package, 
  Users, 
  X, 
  Building2, 
  Search, 
  Check, 
  ChevronDown,
  ChevronUp
} from 'lucide-react'
import { 
  siteServices, 
  buildingServices, 
  labourServices, 
  materialServices, 
  dprServices, 
  convertDocsToArray, 
  syncSiteToSupervisors, 
  syncStaffToSite 
} from '../services/firebaseServices'

const DPRCreation = ({ 
  showDPRFlow, 
  setShowDPRFlow, 
  userRole, 
  user, 
  sites, 
  buildings, 
  staff, 
  materials = [], 
  attendance, 
  supervisorsList,
  onDPRCreated 
}) => {
  const [dprStep, setDprStep] = useState(1)
  const [dprFormData, setDprFormData] = useState({
    siteName: '',
    siteArea: '',
    siteLocation: '',
    buildingId: '',
    buildingType: 'Mixed Use',
    buildingFloors: 1,
    buildingUnits: 1,
    buildingArea: '',
    buildingBudget: '',
    buildingProgress: 0,
    buildingStatus: 'Active',
    buildingImage: '',
    selectedMaterials: [],
    materialQuantities: {},
    selectedStaff: [],
    dailyWorkersCount: 0,
    dailyWorkers: [],
    contractWorkers: [],
    assignedSupervisors: []
  })

  const [staffSearchTerm, setStaffSearchTerm] = useState('')
  const [showStaffModal, setShowStaffModal] = useState(false)
  const [showMaterialsModal, setShowMaterialsModal] = useState(false)
  const [showMaterialsList, setShowMaterialsList] = useState(true)
  const [showToolsList, setShowToolsList] = useState(false)

  const dprSteps = [
    { id: 1, title: 'Create Site', icon: MapPin },
    { id: 2, title: 'Add Materials', icon: Package }
  ]

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

  const handleMaterialToggle = (materialId) => {
    if (dprFormData.selectedMaterials.includes(materialId)) {
      setDprFormData({
        ...dprFormData,
        selectedMaterials: dprFormData.selectedMaterials.filter(id => id !== materialId),
        materialQuantities: {
          ...dprFormData.materialQuantities,
          [materialId]: ''
        }
      })
    } else {
      setDprFormData({
        ...dprFormData,
        selectedMaterials: [...dprFormData.selectedMaterials, materialId]
      })
    }
  }

  const handleMaterialQuantityChange = (materialId, quantity) => {
    setDprFormData({
      ...dprFormData,
      materialQuantities: {
        ...dprFormData.materialQuantities,
        [materialId]: quantity
      }
    })
  }

  const handleStaffToggle = (staffId) => {
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

  const handleSubmitDPRFlow = async () => {
    try {
      // Create site
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

      // Create DPR
      const dprData = {
        date: new Date().toISOString().split('T')[0],
        siteName: dprFormData.siteName,
        siteId: createdSiteId,
        selectedStaff: dprFormData.selectedStaff,
        selectedMaterials: dprFormData.selectedMaterials,
        materialQuantities: dprFormData.materialQuantities,
        dailyWorkersCount: dprFormData.dailyWorkersCount,
        dailyWorkers: dprFormData.dailyWorkers,
        contractWorkers: dprFormData.contractWorkers,
        createdAt: new Date().toISOString(),
        createdBy: userRole,
        status: 'submitted',
        is_deleted: false
      }

      await dprServices.addDPR(dprData)

      // Sync materials with inventory (real-time update)
      if (dprFormData.selectedMaterials.length > 0) {
        for (const materialId of dprFormData.selectedMaterials) {
          const quantityUsed = parseInt(dprFormData.materialQuantities[materialId]) || 0;
          if (quantityUsed > 0) {
            // Update material inventory in real-time
            await materialServices.updateMaterial(materialId, {
              available: materialServices.decrementAvailable(materialId, quantityUsed),
              lastUsed: new Date().toISOString(),
              usedIn: dprFormData.siteName
            });
          }
        }
      }

      // Sync staff assignments
      if (dprFormData.selectedStaff.length > 0) {
        await syncStaffToSite(createdSiteId, dprFormData.selectedStaff)
      }

      // Create and assign daily workers to site
      if (dprFormData.dailyWorkersCount > 0 && dprFormData.dailyWorkers.length > 0) {
        for (const dailyWorker of dprFormData.dailyWorkers) {
          const workerData = {
            name: dailyWorker.name,
            role: dailyWorker.role,
            siteId: createdSiteId,
            isDailyWorker: true,
            temporary: true,
            createdAt: new Date().toISOString(),
            createdBy: userRole,
            status: 'active',
            joinDate: new Date().toISOString().split('T')[0]
          };
          
          await labourServices.addLabour(workerData);
        }
      }

      // Create and assign contract workers to site
      if (dprFormData.contractWorkers && dprFormData.contractWorkers.length > 0) {
        for (const contractWorker of dprFormData.contractWorkers) {
          const workerData = {
            name: contractWorker.name,
            role: contractWorker.role,
            siteId: createdSiteId,
            employmentType: 'contract',
            createdAt: new Date().toISOString(),
            createdBy: userRole,
            status: 'active',
            joinDate: new Date().toISOString().split('T')[0]
          };
          
          await labourServices.addLabour(workerData);
        }
      }

      // Sync supervisors
      if (dprFormData.assignedSupervisors && dprFormData.assignedSupervisors.length > 0) {
        await syncSiteToSupervisors(createdSiteId, dprFormData.assignedSupervisors)
      }

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
        buildingBudget: '',
        buildingProgress: 0,
        buildingStatus: 'Active',
        buildingImage: '',
        selectedMaterials: [],
        materialQuantities: {},
        selectedStaff: [],
        dailyWorkersCount: 0,
        dailyWorkers: [],
        contractWorkers: [],
        assignedSupervisors: []
      })

      if (onDPRCreated) {
        onDPRCreated()
      }

      alert('DPR created successfully!')

    } catch (error) {
      console.error('Error creating DPR:', error)
      alert('Error creating DPR. Please try again.')
    }
  }

  const getStaffByAttendance = () => {
    if (!staff || staff.length === 0) {
      return {
        present: { supervisors: [], workers: [] },
        assigned: { supervisors: [], workers: [] },
        absent: []
      }
    }

    const presentStaff = staff
    const absentStaff = []

    const availableSupervisors = presentStaff.filter(person =>
      person.role && person.role.toLowerCase().includes('supervisor')
    )
    const availableWorkers = presentStaff.filter(person =>
      person.role && !person.role.toLowerCase().includes('supervisor')
    )

    return {
      present: {
        supervisors: availableSupervisors,
        workers: availableWorkers
      },
      assigned: {
        supervisors: [],
        workers: []
      },
      absent: absentStaff
    }
  }

  const staffByAttendance = getStaffByAttendance()

  return (
    <AnimatePresence>
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
            {/* Header */}
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Create New DPR</h2>
                <p className="text-gray-600">Daily Progress Report</p>
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
                          : 'border-gray-300 bg-gray-100 text-gray-500'
                        }`}>
                        <Icon className="w-5 h-5" />
                      </div>
                      <span className={`ml-3 text-sm font-medium ${isActive ? 'text-blue-600' : isCompleted ? 'text-green-600' : 'text-gray-500'}`}>
                        {step.title}
                      </span>
                      {index < dprSteps.length - 1 && (
                        <div className={`w-full sm:w-24 h-0.5 mx-4 ${step.id < dprStep ? 'bg-green-500' : 'bg-gray-300'}`} />
                      )}
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Step Content */}
            <div className="p-6">
              {/* Step 1: Create Site */}
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

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Area (Sq Ft) (Optional)</label>
                    <input
                      type="number"
                      min="0"
                      value={dprFormData.siteArea}
                      onChange={(e) => setDprFormData({ ...dprFormData, siteArea: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="e.g., 10000"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Building Type (Optional)</label>
                    <input
                      type="text"
                      value={dprFormData.buildingType || ''}
                      onChange={(e) => setDprFormData({ ...dprFormData, buildingType: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="e.g., Residential, Commercial, Mixed Use"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Start Date (Optional)</label>
                    <input
                      type="date"
                      value={dprFormData.startDate || ''}
                      onChange={(e) => setDprFormData({ ...dprFormData, startDate: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Total Budget (₹) (Optional)</label>
                    <input
                      type="number"
                      min="0"
                      value={dprFormData.buildingBudget || ''}
                      onChange={(e) => setDprFormData({ ...dprFormData, buildingBudget: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="e.g., 5000000"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Current Expenses (₹) (Optional)</label>
                    <input
                      type="number"
                      min="0"
                      value={dprFormData.currentExpenses || ''}
                      onChange={(e) => setDprFormData({ ...dprFormData, currentExpenses: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="e.g., 100000"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Total Area (sq ft) (Optional)</label>
                    <input
                      type="number"
                      min="0"
                      value={dprFormData.buildingArea || ''}
                      onChange={(e) => setDprFormData({ ...dprFormData, buildingArea: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="e.g., 25000"
                    />
                  </div>
                </div>
              )}

              {/* Step 2: Add Materials & Tools */}
              {dprStep === 2 && (
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-gray-900">Step 2: Add Materials & Tools</h3>
                  
                  {/* Quick Tags Section */}
                  <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                    <p className="text-sm font-medium text-gray-700 mb-3">Quick Add Common Items:</p>
                    <div className="flex flex-wrap gap-2">
                      <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-medium cursor-pointer hover:bg-blue-200">🧱 Bricks</span>
                      <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium cursor-pointer hover:bg-green-200">🔧 Tools</span>
                      <span className="px-3 py-1 bg-yellow-100 text-yellow-700 rounded-full text-xs font-medium cursor-pointer hover:bg-yellow-200">⚡ Electrical</span>
                      <span className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-xs font-medium cursor-pointer hover:bg-purple-200">🔨 Hardware</span>
                      <span className="px-3 py-1 bg-orange-100 text-orange-700 rounded-full text-xs font-medium cursor-pointer hover:bg-orange-200">👷 Workers</span>
                    </div>
                  </div>

                  {/* Always Visible Info Section */}
                  <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                    <h4 className="text-md font-medium text-blue-900 mb-2">📋 DPR Creation Guide</h4>
                    <div className="space-y-2 text-sm text-blue-800">
                      <p>• Select materials and tools from inventory</p>
                      <p>• Add daily workers (count-based)</p>
                      <p>• Add contract workers (named individuals)</p>
                      <p>• Review inventory impact before submission</p>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <span className="px-2 py-1 bg-white text-blue-600 rounded text-xs font-medium">Materials</span>
                      <span className="px-2 py-1 bg-white text-blue-600 rounded text-xs font-medium">Tools</span>
                      <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded text-xs font-medium">Daily Workers</span>
                      <span className="px-2 py-1 bg-orange-100 text-orange-700 rounded text-xs font-medium">Contract Workers</span>
                    </div>
                  </div>
                  
                  <div className="flex gap-4 mb-4">
                    <button
                      onClick={() => setShowMaterialsList(!showMaterialsList)}
                      className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                        showMaterialsList 
                          ? 'bg-blue-500 text-white' 
                          : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                      }`}
                    >
                      Materials ({materials?.filter(m => m.category !== 'tool' && (m.available || m.currentStock || 0) > 0).length || 0})
                    </button>
                    <button
                      onClick={() => setShowToolsList(!showToolsList)}
                      className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                        showToolsList 
                          ? 'bg-green-500 text-white' 
                          : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                      }`}
                    >
                      Tools ({materials?.filter(m => m.category === 'tool' && (m.available || m.currentStock || 0) > 0).length || 0})
                    </button>
                  </div>

                  {/* Materials List */}
                  {showMaterialsList && (
                    <div className="mb-6">
                      <h4 className="text-md font-medium text-gray-700 mb-3">Available Materials</h4>
                      <div className="space-y-3">
                        {(materials || []).filter(item => item.category !== 'tool' && (item.available || item.currentStock || 0) > 0).length > 0 ? (
                          (materials || []).filter(item => item.category !== 'tool' && (item.available || item.currentStock || 0) > 0).map(item => (
                            <div key={item.id} className="p-4 border border-gray-200 rounded-lg">
                              <div className="flex items-center justify-between mb-3">
                                <div>
                                  <p className="font-medium text-gray-900">{item.name}</p>
                                  <p className="text-sm text-gray-600">
                                    Material • Available: {item.available || item.currentStock} {item.unit || 'units'}
                                  </p>
                                </div>
                                <motion.button
                                  whileHover={{ scale: 1.05 }}
                                  whileTap={{ scale: 0.95 }}
                                  onClick={() => handleMaterialToggle(item.id)}
                                  className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${dprFormData.selectedMaterials.includes(item.id)
                                    ? 'bg-blue-500 text-white'
                                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                                    }`}
                                >
                                  {dprFormData.selectedMaterials.includes(item.id) ? 'Added' : 'Add'}
                                </motion.button>
                              </div>
                              {dprFormData.selectedMaterials.includes(item.id) && (
                                <motion.div
                                  initial={{ opacity: 0, height: 0 }}
                                  animate={{ opacity: 1, height: 'auto' }}
                                  className="mt-3"
                                >
                                  <div className="flex items-center gap-3">
                                    <div className="flex-1">
                                      <label className="block text-xs font-medium text-gray-700 mb-1">Quantity to Use</label>
                                      <input
                                        type="number"
                                        min="1"
                                        max={item.available || item.currentStock}
                                        value={dprFormData.materialQuantities[item.id] || ''}
                                        onChange={(e) => {
                                          const value = parseInt(e.target.value) || 0;
                                          const maxStock = item.available || item.currentStock;
                                          if (value <= maxStock) {
                                            handleMaterialQuantityChange(item.id, e.target.value);
                                          } else {
                                            alert(`Only ${maxStock} ${item.unit || 'units'} available in stock!`);
                                            e.target.value = maxStock;
                                            handleMaterialQuantityChange(item.id, maxStock.toString());
                                          }
                                        }}
                                        className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                                          parseInt(dprFormData.materialQuantities[item.id] || 0) > (item.available || item.currentStock)
                                            ? 'border-red-300 bg-red-50'
                                            : 'border-gray-300'
                                        }`}
                                        placeholder={`Max: ${item.available || item.currentStock} ${item.unit || 'units'}`}
                                      />
                                      {parseInt(dprFormData.materialQuantities[item.id] || 0) > (item.available || item.currentStock) && (
                                        <p className="text-xs text-red-600 mt-1">
                                          ⚠️ Exceeds available stock!
                                        </p>
                                      )}
                                    </div>
                                  </div>
                                </motion.div>
                              )}
                            </div>
                          ))
                        ) : (
                          <div className="text-center py-8 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
                            <Package className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                            <p className="text-gray-600 font-medium mb-2">No Materials Available</p>
                            <p className="text-sm text-gray-500 mb-4">Add materials to inventory first</p>
                            <div className="flex flex-wrap gap-2 justify-center">
                              <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">Cement</span>
                              <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">Steel</span>
                              <span className="px-3 py-1 bg-yellow-100 text-yellow-700 rounded-full text-xs font-medium">Bricks</span>
                              <span className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-xs font-medium">Sand</span>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Tools List */}
                  {showToolsList && (
                    <div>
                      <h4 className="text-md font-medium text-gray-700 mb-3">Available Tools</h4>
                      <div className="space-y-3">
                        {(materials || []).filter(item => item.category === 'tool' && (item.available || item.currentStock || 0) > 0).length > 0 ? (
                          (materials || []).filter(item => item.category === 'tool' && (item.available || item.currentStock || 0) > 0).map(item => (
                            <div key={item.id} className="p-4 border border-gray-200 rounded-lg">
                              <div className="flex items-center justify-between mb-3">
                                <div>
                                  <p className="font-medium text-gray-900">{item.name}</p>
                                  <p className="text-sm text-gray-600">
                                    Tool • Available: {item.available || item.currentStock} {item.unit || 'units'}
                                  </p>
                                </div>
                                <motion.button
                                  whileHover={{ scale: 1.05 }}
                                  whileTap={{ scale: 0.95 }}
                                  onClick={() => handleMaterialToggle(item.id)}
                                  className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${dprFormData.selectedMaterials.includes(item.id)
                                    ? 'bg-green-500 text-white'
                                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                                    }`}
                                >
                                  {dprFormData.selectedMaterials.includes(item.id) ? 'Added' : 'Add'}
                                </motion.button>
                              </div>
                              {dprFormData.selectedMaterials.includes(item.id) && (
                                <motion.div
                                  initial={{ opacity: 0, height: 0 }}
                                  animate={{ opacity: 1, height: 'auto' }}
                                  className="mt-3"
                                >
                                  <div className="flex items-center gap-3">
                                    <div className="flex-1">
                                      <label className="block text-xs font-medium text-gray-700 mb-1">Quantity to Use</label>
                                      <input
                                        type="number"
                                        min="1"
                                        max={item.available || item.currentStock}
                                        value={dprFormData.materialQuantities[item.id] || ''}
                                        onChange={(e) => {
                                          const value = parseInt(e.target.value) || 0;
                                          const maxStock = item.available || item.currentStock;
                                          if (value <= maxStock) {
                                            handleMaterialQuantityChange(item.id, e.target.value);
                                          } else {
                                            alert(`Only ${maxStock} ${item.unit || 'units'} available in stock!`);
                                            e.target.value = maxStock;
                                            handleMaterialQuantityChange(item.id, maxStock.toString());
                                          }
                                        }}
                                        className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent ${
                                          parseInt(dprFormData.materialQuantities[item.id] || 0) > (item.available || item.currentStock)
                                            ? 'border-red-300 bg-red-50'
                                            : 'border-gray-300'
                                        }`}
                                        placeholder={`Max: ${item.available || item.currentStock} ${item.unit || 'units'}`}
                                      />
                                      {parseInt(dprFormData.materialQuantities[item.id] || 0) > (item.available || item.currentStock) && (
                                        <p className="text-xs text-red-600 mt-1">
                                          ⚠️ Exceeds available stock!
                                        </p>
                                      )}
                                    </div>
                                  </div>
                                </motion.div>
                              )}
                            </div>
                          ))
                        ) : (
                          <div className="text-center py-8 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
                            <Package className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                            <p className="text-gray-600 font-medium mb-2">No Tools Available</p>
                            <p className="text-sm text-gray-500 mb-4">Add tools to inventory first</p>
                            <div className="flex flex-wrap gap-2 justify-center">
                              <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">Drill</span>
                              <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">Saw</span>
                              <span className="px-3 py-1 bg-yellow-100 text-yellow-700 rounded-full text-xs font-medium">Hammer</span>
                              <span className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-xs font-medium">Wrench</span>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Real-time Stock Impact Summary */}
                  {dprFormData.selectedMaterials.length > 0 && (
                    <div className="bg-gradient-to-r from-orange-50 to-amber-50 border border-orange-200 rounded-xl p-5 shadow-sm">
                      <h4 className="text-lg font-bold text-gray-800 flex items-center gap-2 mb-4">
                        <Package className="w-5 h-5 text-orange-600" />
                        Inventory Impact Summary
                      </h4>
                      <div className="space-y-2">
                        {dprFormData.selectedMaterials.map(materialId => {
                          const material = (materials || []).find(m => m.id === materialId);
                          const quantityUsed = parseInt(dprFormData.materialQuantities[materialId]) || 0;
                          const remainingStock = material ? (material.available || material.currentStock) - quantityUsed : 0;
                          
                          if (!material || quantityUsed === 0) return null;
                          
                          return (
                            <div key={materialId} className="flex items-center justify-between p-3 bg-white rounded-lg border border-gray-200">
                              <div className="flex-1">
                                <p className="font-medium text-gray-900">{material.name}</p>
                                <p className="text-sm text-gray-600">
                                  Using: {quantityUsed} {material.unit || 'units'} → 
                                  <span className={`font-medium ${remainingStock <= 0 ? 'text-red-600' : remainingStock <= 5 ? 'text-orange-600' : 'text-green-600'}`}>
                                    {remainingStock <= 0 ? ' Out of Stock!' : remainingStock <= 5 ? ` Low Stock (${remainingStock} left)` : ` ${remainingStock} remaining`}
                                  </span>
                                </p>
                              </div>
                              <div className={`w-3 h-3 rounded-full ${
                                remainingStock <= 0 ? 'bg-red-500' : 
                                remainingStock <= 5 ? 'bg-orange-500' : 'bg-green-500'
                              }`}></div>
                            </div>
                          );
                        })}
                      </div>
                      <div className="mt-4 pt-3 border-t border-orange-200">
                        <p className="text-xs text-orange-700 font-medium">
                          💡 Inventory will be updated in real-time when DPR is created
                        </p>
                      </div>
                    </div>
                  )}

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
                  Create DPR
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
    </AnimatePresence>
  )
}

export default DPRCreation
