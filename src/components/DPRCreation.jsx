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
  materials, 
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
    assignedSupervisors: []
  })

  const [staffSearchTerm, setStaffSearchTerm] = useState('')
  const [showStaffModal, setShowStaffModal] = useState(false)
  const [showMaterialsModal, setShowMaterialsModal] = useState(false)

  const dprSteps = [
    { id: 1, title: 'Create Site', icon: MapPin },
    { id: 2, title: 'Add Materials', icon: Package },
    { id: 3, title: 'Select Staff', icon: Users }
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
        createdAt: new Date().toISOString(),
        createdBy: userRole,
        status: 'submitted',
        is_deleted: false
      }

      await dprServices.addDPR(dprData)

      // Sync staff assignments
      if (dprFormData.selectedStaff.length > 0) {
        await syncStaffToSite(createdSiteId, dprFormData.selectedStaff)
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
                </div>
              )}

              {/* Step 2: Add Materials */}
              {dprStep === 2 && (
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-gray-900">Step 2: Add Materials & Staff Attendance</h3>
                  
                  {/* Staff Attendance Summary Cards */}
                  <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-5 shadow-sm">
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                        <Users className="w-5 h-5 text-blue-600" />
                        Staff Attendance Summary
                      </h4>
                      <span className="text-sm font-medium text-blue-600 bg-blue-100 px-3 py-1 rounded-full">
                        {dprFormData.siteName}
                      </span>
                    </div>
                    
                    {/* Staff Count Cards */}
                    <div className="grid grid-cols-3 gap-3 mb-4">
                      <div className="bg-white rounded-lg p-3 border border-gray-200 text-center">
                        <div className="text-2xl font-bold text-gray-800">{staff.length}</div>
                        <div className="text-xs font-medium text-gray-500 uppercase tracking-wider">Total Staff</div>
                      </div>
                      <div className="bg-green-50 rounded-lg p-3 border border-green-200 text-center">
                        <div className="text-2xl font-bold text-green-600">{attendance.filter(a => a.status === 'present').length}</div>
                        <div className="text-xs font-medium text-green-500 uppercase tracking-wider">Present</div>
                      </div>
                      <div className="bg-red-50 rounded-lg p-3 border border-red-200 text-center">
                        <div className="text-2xl font-bold text-red-600">{attendance.filter(a => a.status === 'absent').length}</div>
                        <div className="text-xs font-medium text-red-500 uppercase tracking-wider">Absent</div>
                      </div>
                    </div>
                    
                    {/* Quick Attendance Actions */}
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          const allStaffIds = staff.map(s => s.id);
                          setDprFormData({ ...dprFormData, selectedStaff: allStaffIds });
                        }}
                        className="px-3 py-1.5 bg-green-100 text-green-700 rounded-lg text-sm font-medium hover:bg-green-200 transition-colors"
                      >
                        Mark All Present
                      </button>
                      <button
                        onClick={() => {
                          setDprFormData({ ...dprFormData, selectedStaff: [] });
                        }}
                        className="px-3 py-1.5 bg-red-100 text-red-700 rounded-lg text-sm font-medium hover:bg-red-200 transition-colors"
                      >
                        Mark All Absent
                      </button>
                    </div>
                  </div>

                  {/* Materials Selection */}
                  <div>
                    <h4 className="text-md font-medium text-gray-700 mb-3">Materials</h4>
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
                              <label className="block text-sm font-medium text-gray-700 mb-2">
                                Quantity Used ({material.unit})
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

                  {/* Individual Staff Attendance */}
                  <div>
                    <h4 className="text-md font-medium text-gray-700 mb-3">Mark Individual Attendance</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {staff.map(staffMember => {
                        const isSelected = dprFormData.selectedStaff.includes(staffMember.id);
                        return (
                          <motion.div
                            key={staffMember.id}
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={() => handleStaffToggle(staffMember.id)}
                            className={`p-3 border rounded-lg cursor-pointer transition-all ${
                              isSelected 
                                ? 'border-green-500 bg-green-50 text-green-700' 
                                : 'border-red-200 bg-red-50 text-red-700'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="font-medium text-sm">{staffMember.name}</p>
                              </div>
                              <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                                isSelected ? 'border-green-500 bg-green-500' : 'border-red-300 bg-red-300'
                              }`}>
                                {isSelected ? (
                                  <Check className="w-4 h-4 text-white" />
                                ) : (
                                  <X className="w-3 h-3 text-white" />
                                )}
                              </div>
 </div>
                            <div className="mt-1 text-xs font-medium">
                              {isSelected ? 'Present' : 'Absent'}
                            </div>
                          </motion.div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* Step 3: Select Staff */}
              {dprStep === 3 && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-gray-900">Step 3: Select Staff</h3>
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <Users className="w-4 h-4" />
                      <span>Selected: {dprFormData.selectedStaff.length} staff</span>
                    </div>
                  </div>
                  
                  {/* Site Info */}
                  {dprFormData.siteName && (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                      <div className="flex items-center gap-2">
                        <MapPin className="w-4 h-4 text-blue-600" />
                        <span className="text-sm font-medium text-blue-900">
                          Site: {dprFormData.siteName}
                        </span>
                        <span className="text-xs text-blue-600">
                          ({dprFormData.selectedStaff.length} staff selected)
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Staff Categories */}
                  <div className="space-y-4">
                    {/* Available Staff */}
                    {(staffByAttendance.present.supervisors.length > 0 || staffByAttendance.present.workers.length > 0) && (
                      <div>
                        <h4 className="text-md font-medium text-green-700 mb-3 flex items-center gap-2">
                          <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                          Available Staff ({staffByAttendance.present.supervisors.length + staffByAttendance.present.workers.length})
                        </h4>
                        
                        {/* Supervisors */}
                        {staffByAttendance.present.supervisors.length > 0 && (
                          <div className="mb-4">
                            <h5 className="text-sm font-medium text-gray-700 mb-2">Supervisors</h5>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              {staffByAttendance.present.supervisors.map(staff => {
                                const isSelected = dprFormData.selectedStaff.includes(staff.id);
                                return (
                                  <motion.div
                                    key={staff.id}
                                    whileHover={{ scale: 1.02 }}
                                    whileTap={{ scale: 0.98 }}
                                    onClick={() => handleStaffToggle(staff.id)}
                                    className={`p-3 border rounded-lg cursor-pointer transition-all ${
                                      isSelected 
                                        ? 'border-blue-500 bg-blue-50 text-blue-700' 
                                        : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                                    }`}
                                  >
                                    <div className="flex items-center justify-between">
                                      <div>
                                        <p className="font-medium text-sm">{staff.name}</p>
                                      </div>
                                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                                        isSelected ? 'border-blue-500 bg-blue-500' : 'border-gray-300'
                                      }`}>
                                        {isSelected && (
                                          <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                          </svg>
                                        )}
                                      </div>
                                    </div>
                                  </motion.div>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {/* Workers */}
                        {staffByAttendance.present.workers.length > 0 && (
                          <div>
                            <h5 className="text-sm font-medium text-gray-700 mb-2">Workers</h5>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                              {staffByAttendance.present.workers.map(staff => {
                                const isSelected = dprFormData.selectedStaff.includes(staff.id);
                                return (
                                  <motion.div
                                    key={staff.id}
                                    whileHover={{ scale: 1.02 }}
                                    whileTap={{ scale: 0.98 }}
                                    onClick={() => handleStaffToggle(staff.id)}
                                    className={`p-3 border rounded-lg cursor-pointer transition-all ${
                                      isSelected 
                                        ? 'border-blue-500 bg-blue-50 text-blue-700' 
                                        : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                                    }`}
                                  >
                                    <div className="flex items-center justify-between">
                                      <div>
                                        <p className="font-medium text-sm">{staff.name}</p>
                                      </div>
                                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                                        isSelected ? 'border-blue-500 bg-blue-500' : 'border-gray-300'
                                      }`}>
                                        {isSelected && (
                                          <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                          </svg>
                                        )}
                                      </div>
                                    </div>
                                  </motion.div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* No Available Staff */}
                    {staffByAttendance.present.supervisors.length === 0 && staffByAttendance.present.workers.length === 0 && (
                      <div className="text-center py-8 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
                        <Users className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                        <h4 className="text-lg font-medium text-gray-900 mb-2">No Staff Available</h4>
                        <p className="text-gray-600">Add staff members to the system first, then select them for this site.</p>
                      </div>
                    )}
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
