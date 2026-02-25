import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { 
  Plus, 
  MapPin, 
  Users, 
  Package, 
  Calendar,
  CheckCircle,
  AlertCircle,
  TrendingUp,
  FileText
} from 'lucide-react'

const DPR = ({ userRole = 'admin' }) => {
  const [showCreateFlow, setShowCreateFlow] = useState(false)
  const [sites, setSites] = useState([])
  const [staff, setStaff] = useState([])
  const [materials, setMaterials] = useState([])
  const [currentStep, setCurrentStep] = useState(1)
  const [formData, setFormData] = useState({
    siteName: '',
    siteArea: '',
    selectedStaff: [],
    selectedMaterials: [],
    materialQuantities: {}
  })

  const steps = [
    { id: 1, title: 'Create Site', icon: MapPin },
    { id: 2, title: 'Assign Staff', icon: Users },
    { id: 3, title: 'Define Area', icon: TrendingUp },
    { id: 4, title: 'Add Materials', icon: Package }
  ]

  const mockStaff = [
    { id: 1, name: 'John Smith', role: 'Supervisor', available: true },
    { id: 2, name: 'Sarah Johnson', role: 'Worker', available: true },
    { id: 3, name: 'Mike Wilson', role: 'Worker', available: true },
    { id: 4, name: 'Emily Davis', role: 'Supervisor', available: false },
    { id: 5, name: 'Robert Brown', role: 'Worker', available: true }
  ]

  const mockMaterials = [
    { id: 1, name: 'Cement', unit: 'bags', available: 500 },
    { id: 2, name: 'Steel', unit: 'tons', available: 50 },
    { id: 3, name: 'Bricks', unit: 'pieces', available: 10000 },
    { id: 4, name: 'Sand', unit: 'cubic meters', available: 100 },
    { id: 5, name: 'Paint', unit: 'liters', available: 200 }
  ]

  const mockSites = [
    {
      id: 1,
      name: 'Downtown Tower',
      area: '5000 sq ft',
      staff: ['John Smith', 'Sarah Johnson'],
      materials: ['Cement: 100 bags', 'Steel: 5 tons'],
      status: 'active',
      progress: 65
    },
    {
      id: 2,
      name: 'Riverside Complex',
      area: '3000 sq ft',
      staff: ['Mike Wilson'],
      materials: ['Bricks: 2000 pieces', 'Sand: 20 cubic meters'],
      status: 'active',
      progress: 40
    }
  ]

  useEffect(() => {
    setStaff(mockStaff)
    setMaterials(mockMaterials)
    setSites(mockSites)
  }, [])

  const handleNextStep = () => {
    if (currentStep < steps.length) {
      setCurrentStep(currentStep + 1)
    }
  }

  const handlePrevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1)
    }
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

  const handleSubmitFlow = () => {
    const newSite = {
      id: sites.length + 1,
      name: formData.siteName,
      area: formData.siteArea,
      staff: formData.selectedStaff.map(id => 
        staff.find(s => s.id === id)?.name
      ).filter(Boolean),
      materials: formData.selectedMaterials.map(id => {
        const material = materials.find(m => m.id === id)
        const quantity = formData.materialQuantities[id] || 0
        return `${material.name}: ${quantity} ${material.unit}`
      }),
      status: 'active',
      progress: 0
    }

    setSites([...sites, newSite])
    setShowCreateFlow(false)
    setCurrentStep(1)
    setFormData({
      siteName: '',
      siteArea: '',
      selectedStaff: [],
      selectedMaterials: [],
      materialQuantities: {}
    })
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
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {sites.map((site, index) => (
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
                    {site.area}
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
          ))}
        </div>

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
              className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto"
            >
              <div className="p-6 border-b border-gray-200">
                <h2 className="text-2xl font-bold text-gray-900">Create New Site - Complete Flow</h2>
                <p className="text-gray-600 mt-1">Complete all steps to create a new site with staff and materials</p>
              </div>

              {/* Progress Steps */}
              <div className="p-6 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  {steps.map((step, index) => {
                    const Icon = step.icon
                    const isActive = step.id === currentStep
                    const isCompleted = step.id < currentStep
                    
                    return (
                      <div key={step.id} className="flex items-center">
                        <div className={`flex items-center justify-center w-10 h-10 rounded-full border-2 transition-colors ${
                          isActive 
                            ? 'border-blue-500 bg-blue-500 text-white' 
                            : isCompleted 
                              ? 'border-green-500 bg-green-500 text-white'
                              : 'border-gray-300 text-gray-500'
                        }`}>
                          <Icon className="w-5 h-5" />
                        </div>
                        <div className="ml-3 hidden sm:block">
                          <p className={`text-sm font-medium ${
                            isActive ? 'text-blue-600' : isCompleted ? 'text-green-600' : 'text-gray-500'
                          }`}>
                            {step.title}
                          </p>
                        </div>
                        {index < steps.length - 1 && (
                          <div className={`w-full sm:w-24 h-0.5 mx-4 ${
                            step.id < currentStep ? 'bg-green-500' : 'bg-gray-300'
                          }`} />
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Step Content */}
              <div className="p-6">
                {currentStep === 1 && (
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold text-gray-900">Step 1: Create Site</h3>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Site Name *</label>
                      <input
                        type="text"
                        value={formData.siteName}
                        onChange={(e) => setFormData({...formData, siteName: e.target.value})}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="Enter site name"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Site Area *</label>
                      <input
                        type="text"
                        value={formData.siteArea}
                        onChange={(e) => setFormData({...formData, siteArea: e.target.value})}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="e.g., 5000 sq ft"
                      />
                    </div>
                  </div>
                )}

                {currentStep === 2 && (
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold text-gray-900">Step 2: Assign Staff</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {staff.map(person => (
                        <motion.div
                          key={person.id}
                          whileHover={{ scale: 1.02 }}
                          onClick={() => person.available && handleStaffToggle(person.id)}
                          className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                            !person.available 
                              ? 'bg-gray-50 border-gray-200 opacity-50 cursor-not-allowed'
                              : formData.selectedStaff.includes(person.id)
                                ? 'bg-blue-50 border-blue-500'
                                : 'bg-white border-gray-300 hover:border-blue-400'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-medium text-gray-900">{person.name}</p>
                              <p className="text-sm text-gray-600">{person.role}</p>
                            </div>
                            <div className="flex items-center gap-2">
                              {!person.available && (
                                <AlertCircle className="w-4 h-4 text-red-500" />
                              )}
                              {formData.selectedStaff.includes(person.id) && (
                                <CheckCircle className="w-5 h-5 text-blue-500" />
                              )}
                            </div>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  </div>
                )}

                {currentStep === 3 && (
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold text-gray-900">Step 3: Define Work Area</h3>
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                      <p className="text-sm text-blue-800">
                        <strong>Site:</strong> {formData.siteName}<br />
                        <strong>Area:</strong> {formData.siteArea}<br />
                        <strong>Staff Assigned:</strong> {formData.selectedStaff.length} people
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

                {currentStep === 4 && (
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold text-gray-900">Step 4: Add Materials</h3>
                    <div className="space-y-3">
                      {materials.map(material => (
                        <motion.div
                          key={material.id}
                          className="p-4 border border-gray-200 rounded-lg"
                        >
                          <div className="flex items-center justify-between mb-3">
                            <div>
                              <p className="font-medium text-gray-900">{material.name}</p>
                              <p className="text-sm text-gray-600">Available: {material.available} {material.unit}</p>
                            </div>
                            <motion.button
                              whileHover={{ scale: 1.05 }}
                              whileTap={{ scale: 0.95 }}
                              onClick={() => handleMaterialToggle(material.id)}
                              className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                                formData.selectedMaterials.includes(material.id)
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
                                onChange={(e) => handleMaterialQuantityChange(material.id, e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                placeholder="Enter quantity"
                              />
                            </motion.div>
                          )}
                        </motion.div>
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
                  onClick={handlePrevStep}
                  disabled={currentStep === 1}
                  className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
                </motion.button>
                
                {currentStep === steps.length ? (
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={handleSubmitFlow}
                    className="px-6 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg font-medium"
                  >
                    Complete Site Creation
                  </motion.button>
                ) : (
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={handleNextStep}
                    className="px-6 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-medium"
                  >
                    Next Step
                  </motion.button>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </div>
    </div>
  )
}

export default DPR
