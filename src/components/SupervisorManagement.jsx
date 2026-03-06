import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  Users,
  Plus,
  Edit2,
  Trash2,
  Mail,
  Phone,
  Building2,
  Save,
  X,
  UserPlus,
  Search,
  Filter,
  Upload,
  Download,
  FileSpreadsheet
} from 'lucide-react'
import { supervisorServices, siteServices, siteAssignmentServices, convertDocsToArray } from '../services/firebaseServices'

const SupervisorManagement = ({ userRole }) => {
  const [supervisors, setSupervisors] = useState([])
  const [sites, setSites] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [showAddModal, setShowAddModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showAssignModal, setShowAssignModal] = useState(false)
  const [showBulkImportModal, setShowBulkImportModal] = useState(false)
  const [selectedSupervisor, setSelectedSupervisor] = useState(null)
  const [emailValidation, setEmailValidation] = useState({ checking: false, available: null, message: '' })
  const [creatingAccount, setCreatingAccount] = useState(false)
  const [bulkImportData, setBulkImportData] = useState([])
  const [importing, setImporting] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    assignedSites: []
  })
  const [editFormData, setEditFormData] = useState({
    name: '',
    email: '',
    phone: '',
    assignedSites: []
  })

  // Load data
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true)

        // Load supervisors
        const supervisorsSnapshot = await supervisorServices.getAllSupervisors()
        const supervisorsData = convertDocsToArray(supervisorsSnapshot)
        setSupervisors(supervisorsData)

        // Load sites
        const sitesSnapshot = await siteServices.getAllSites()
        const sitesData = convertDocsToArray(sitesSnapshot)
        setSites(sitesData)

      } catch (error) {
        console.error('Error loading data:', error)
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [])

  // Check email availability
  const checkEmailAvailability = async (email) => {
    if (!email) {
      setEmailValidation({ checking: false, available: null, message: '' })
      return
    }

    setEmailValidation({ checking: true, available: null, message: 'Checking email availability...' })

    try {
      const result = await supervisorServices.checkEmailAvailability(email)
      setEmailValidation({
        checking: false,
        available: result.available,
        message: result.reason || (result.available ? 'Email is available' : 'Email not available')
      })
    } catch (error) {
      setEmailValidation({
        checking: false,
        available: false,
        message: 'Error checking email availability'
      })
    }
  }

  // Enhanced add supervisor with Firebase Auth
  const handleAddSupervisor = async () => {
    try {
      if (!formData.name || !formData.email) {
        alert('Please fill in all required fields')
        return
      }

      if (emailValidation.available === false) {
        alert('Email is not available. Please choose a different email.')
        return
      }

      setCreatingAccount(true)

      const supervisorData = {
        name: formData.name,
        email: formData.email,
        phone: formData.phone || '',
        assignedSites: formData.assignedSites || [],
        status: 'pending', // Pending first login
        createdAt: new Date().toISOString()
      }

      const result = await supervisorServices.createSupervisorWithAuth(supervisorData)

      // Show success message with credentials
      alert(`Supervisor account created successfully!\n\nEmail: ${formData.email}\nPassword reset email has been sent.\n\nThe supervisor should check their email and set their password.`)

      // Reload supervisors to get the newly created Firestore document ID
      const supervisorsSnapshot = await supervisorServices.getAllSupervisors()
      const supervisorsData = convertDocsToArray(supervisorsSnapshot)
      setSupervisors(supervisorsData)

      // Find the newly created supervisor doc to get its Firestore ID
      const newSupervisor = supervisorsData.find(s => s.email === formData.email)
      if (newSupervisor && formData.assignedSites?.length > 0) {
        // Update site documents so site.assignedSupervisors includes the new supervisor's Firestore ID
        await updateSiteAssignments(newSupervisor.id, formData.assignedSites)
        console.log('✅ Site documents updated with new supervisor assignment')
      }

      // Reset form
      setFormData({ name: '', email: '', phone: '', assignedSites: [] })
      setEmailValidation({ checking: false, available: null, message: '' })
      setShowAddModal(false)

    } catch (error) {
      console.error('Error adding supervisor:', error)
      alert(`Error creating supervisor account: ${error.message}`)
    } finally {
      setCreatingAccount(false)
    }
  }

  // Bulk import functions
  const handleFileUpload = (e) => {
    const file = e.target.files[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (event) => {
      try {
        const csvData = event.target.result
        const lines = csvData.split('\n')
        const headers = lines[0].split(',').map(h => h.trim())

        const supervisors = []
        for (let i = 1; i < lines.length; i++) {
          const values = lines[i].split(',').map(v => v.trim())
          if (values.length >= 2 && values[0] && values[1]) {
            supervisors.push({
              name: values[0],
              email: values[1],
              phone: values[2] || '',
              assignedSites: values[3] ? values[3].split(';') : []
            })
          }
        }

        setBulkImportData(supervisors)
      } catch (error) {
        alert('Error parsing CSV file. Please check the format.')
      }
    }
    reader.readAsText(file)
  }

  const handleBulkImport = async () => {
    if (bulkImportData.length === 0) {
      alert('No supervisors to import')
      return
    }

    setImporting(true)
    const results = { success: [], failed: [] }

    for (const supervisor of bulkImportData) {
      try {
        const result = await supervisorServices.createSupervisorWithAuth(supervisor)
        results.success.push({ ...supervisor, ...result })
      } catch (error) {
        results.failed.push({ ...supervisor, error: error.message })
      }
    }

    // Show results
    const message = `Import completed!\n\nSuccess: ${results.success.length}\nFailed: ${results.failed.length}\n\n${results.failed.length > 0 ? 'Failed supervisors:\n' + results.failed.map(f => `${f.name} (${f.email}): ${f.error}`).join('\n') : ''}`
    alert(message)

    // Reload supervisors
    const supervisorsSnapshot = await supervisorServices.getAllSupervisors()
    const supervisorsData = convertDocsToArray(supervisorsSnapshot)
    setSupervisors(supervisorsData)

    setBulkImportData([])
    setShowBulkImportModal(false)
    setImporting(false)
  }

  // Download CSV template
  const downloadTemplate = () => {
    const csvContent = 'Name,Email,Phone,Assigned Sites\nJohn Doe,john@example.com,+1234567890,Site1;Site2\nJane Smith,jane@example.com,+1234567891,Site3'
    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'supervisor_template.csv'
    a.click()
    window.URL.revokeObjectURL(url)
  }

  // Edit supervisor
  const handleEditSupervisor = async () => {
    try {
      if (!editFormData.name || !editFormData.email) {
        alert('Please fill in all required fields')
        return
      }

      const supervisorData = {
        name: editFormData.name,
        email: editFormData.email,
        phone: editFormData.phone || '',
        assignedSites: editFormData.assignedSites || [],
        updatedAt: new Date().toISOString()
      }

      // 1. Update the supervisor document (stores assignedSites as site IDs)
      await supervisorServices.updateSupervisor(selectedSupervisor.id, supervisorData)

      // 2. Update every site document so site.assignedSupervisors stays in sync
      //    This is what SupervisorContext uses as a fallback lookup.
      await updateSiteAssignments(selectedSupervisor.id, editFormData.assignedSites)
      console.log('✅ Site documents updated with supervisor assignment')

      // 3. Reload supervisors list
      const supervisorsSnapshot = await supervisorServices.getAllSupervisors()
      const supervisorsData = convertDocsToArray(supervisorsSnapshot)
      setSupervisors(supervisorsData)

      // Reset form
      setEditFormData({ name: '', email: '', phone: '', assignedSites: [] })
      setShowEditModal(false)
      setSelectedSupervisor(null)

      alert('✅ Supervisor and site assignments updated successfully!')

    } catch (error) {
      console.error('Error updating supervisor:', error)
      alert('Error updating supervisor. Please try again.')
    }
  }

  // Delete supervisor
  const handleDeleteSupervisor = async (supervisorId) => {
    if (!confirm('Are you sure you want to delete this supervisor?')) {
      return
    }

    try {
      await supervisorServices.deleteSupervisor(supervisorId)

      // Reload supervisors
      const supervisorsSnapshot = await supervisorServices.getAllSupervisors()
      const supervisorsData = convertDocsToArray(supervisorsSnapshot)
      setSupervisors(supervisorsData)

    } catch (error) {
      console.error('Error deleting supervisor:', error)
      alert('Error deleting supervisor. Please try again.')
    }
  }

  // Update site assignments
  const updateSiteAssignments = async (supervisorId, assignedSites) => {
    try {
      // Update all sites to remove this supervisor
      for (const site of sites) {
        const currentAssignments = site.assignedSupervisors || []
        const updatedAssignments = currentAssignments.filter(id => id !== supervisorId)

        // Add supervisor back if they're assigned to this site
        if (assignedSites.includes(site.id)) {
          updatedAssignments.push(supervisorId)
        }

        await siteAssignmentServices.assignSupervisorsToSite(site.id, updatedAssignments)
      }
    } catch (error) {
      console.error('Error updating site assignments:', error)
    }
  }

  // Open edit modal
  const openEditModal = (supervisor) => {
    setSelectedSupervisor(supervisor)
    setEditFormData({
      name: supervisor.name,
      email: supervisor.email,
      phone: supervisor.phone || '',
      assignedSites: supervisor.assignedSites || []
    })
    setShowEditModal(true)
  }

  // Filter supervisors
  const filteredSupervisors = supervisors.filter(supervisor =>
    supervisor.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    supervisor.email.toLowerCase().includes(searchTerm.toLowerCase())
  )

  if (userRole !== 'admin') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-red-600 mb-4">Access Denied</h2>
          <p className="text-gray-600">You don't have permission to access supervisor management.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Supervisor Management</h1>
            <p className="text-gray-600 mt-2">Manage supervisors and their site assignments</p>
          </div>
          <div className="flex gap-3">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={downloadTemplate}
              className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50"
            >
              <Download className="w-4 h-4" />
              Download Template
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setShowBulkImportModal(true)}
              className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50"
            >
              <Upload className="w-4 h-4" />
              Bulk Import
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setShowAddModal(true)}
              className="btn-primary flex items-center gap-2"
            >
              <Plus className="w-5 h-5" />
              Add Supervisor
            </motion.button>
          </div>
        </div>

        {/* Search and Filter */}
        <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
          <div className="flex gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Search supervisors..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>
        </div>

        {/* Supervisors Table */}
        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Supervisor
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Contact
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Assigned Sites
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredSupervisors.map((supervisor) => (
                  <motion.tr
                    key={supervisor.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="hover:bg-gray-50"
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                          <Users className="w-5 h-5 text-blue-600" />
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-900">{supervisor.name}</div>
                          <div className="text-sm text-gray-500">{supervisor.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{supervisor.phone || 'Not provided'}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {supervisor.assignedSites?.length || 0} sites assigned
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${supervisor.status === 'active'
                          ? 'bg-green-100 text-green-800'
                          : supervisor.status === 'pending'
                            ? 'bg-yellow-100 text-yellow-800'
                            : 'bg-red-100 text-red-800'
                        }`}>
                        {supervisor.status === 'pending' ? 'Pending Login' : supervisor.status || 'active'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex gap-2">
                        <motion.button
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={() => openEditModal(supervisor)}
                          className="text-blue-600 hover:text-blue-900"
                        >
                          <Edit2 className="w-4 h-4" />
                        </motion.button>
                        <motion.button
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={() => handleDeleteSupervisor(supervisor.id)}
                          className="text-red-600 hover:text-red-900"
                        >
                          <Trash2 className="w-4 h-4" />
                        </motion.button>
                      </div>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Add Supervisor Modal */}
        {showAddModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
            onClick={() => setShowAddModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-xl p-6 w-full max-w-md mx-4"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-xl font-bold text-gray-900 mb-4">Add Supervisor</h3>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Name *</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Enter supervisor name"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Email *</label>
                  <div className="relative">
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => {
                        setFormData({ ...formData, email: e.target.value })
                        // Check email availability after user stops typing
                        const timeoutId = setTimeout(() => {
                          checkEmailAvailability(e.target.value)
                        }, 500)
                        return () => clearTimeout(timeoutId)
                      }}
                      className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent pr-10 ${emailValidation.available === false
                          ? 'border-red-300 bg-red-50'
                          : emailValidation.available === true
                            ? 'border-green-300 bg-green-50'
                            : 'border-gray-300'
                        }`}
                      placeholder="Enter email address"
                    />
                    {emailValidation.checking && (
                      <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                      </div>
                    )}
                  </div>
                  {emailValidation.message && (
                    <p className={`text-xs mt-1 ${emailValidation.available === false
                        ? 'text-red-600'
                        : emailValidation.available === true
                          ? 'text-green-600'
                          : 'text-gray-500'
                      }`}>
                      {emailValidation.message}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Phone</label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Enter phone number"
                  />
                </div>

                <div className="bg-blue-50 p-3 rounded-lg">
                  <p className="text-sm text-blue-800">
                    <strong>Note:</strong> A Firebase Authentication account will be created for this supervisor.
                    They will receive a password reset email to set their password.
                  </p>
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => {
                    setShowAddModal(false)
                    setEmailValidation({ checking: false, available: null, message: '' })
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg font-medium"
                >
                  Cancel
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleAddSupervisor}
                  disabled={creatingAccount || emailValidation.available === false || !formData.name || !formData.email}
                  className={`flex-1 px-4 py-2 rounded-lg font-medium transition-colors ${creatingAccount || emailValidation.available === false || !formData.name || !formData.email
                      ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                      : 'bg-blue-500 hover:bg-blue-600 text-white'
                    }`}
                >
                  {creatingAccount ? (
                    <div className="flex items-center justify-center gap-2">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      Creating Account...
                    </div>
                  ) : (
                    'Create Supervisor Account'
                  )}
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}

        {/* Edit Supervisor Modal */}
        {showEditModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
            onClick={() => setShowEditModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-xl p-6 w-full max-w-md mx-4"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-xl font-bold text-gray-900 mb-4">Edit Supervisor</h3>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Name *</label>
                  <input
                    type="text"
                    value={editFormData.name}
                    onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Enter supervisor name"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Email *</label>
                  <input
                    type="email"
                    value={editFormData.email}
                    onChange={(e) => setEditFormData({ ...editFormData, email: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Enter email address"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Phone</label>
                  <input
                    type="tel"
                    value={editFormData.phone}
                    onChange={(e) => setEditFormData({ ...editFormData, phone: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Enter phone number"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Assigned Sites</label>
                  <div className="space-y-2 max-h-32 overflow-y-auto">
                    {sites.map((site) => (
                      <label key={site.id} className="flex items-center">
                        <input
                          type="checkbox"
                          checked={editFormData.assignedSites?.includes(site.id) || false}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setEditFormData({
                                ...editFormData,
                                assignedSites: [...(editFormData.assignedSites || []), site.id]
                              })
                            } else {
                              setEditFormData({
                                ...editFormData,
                                assignedSites: editFormData.assignedSites?.filter(id => id !== site.id) || []
                              })
                            }
                          }}
                          className="mr-2"
                        />
                        <span className="text-sm">{site.name}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setShowEditModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg font-medium"
                >
                  Cancel
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleEditSupervisor}
                  className="flex-1 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-medium"
                >
                  Update Supervisor
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}

        {/* Bulk Import Modal */}
        {showBulkImportModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
            onClick={() => setShowBulkImportModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-xl p-6 w-full max-w-2xl mx-4 max-h-[80vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-xl font-bold text-gray-900 mb-4">Bulk Import Supervisors</h3>

              <div className="space-y-4">
                <div className="bg-blue-50 p-4 rounded-lg">
                  <p className="text-sm text-blue-800 mb-2">
                    <strong>Instructions:</strong>
                  </p>
                  <ol className="text-sm text-blue-800 list-decimal list-inside space-y-1">
                    <li>Download the CSV template using the button above</li>
                    <li>Fill in supervisor details (Name, Email, Phone, Assigned Sites)</li>
                    <li>For multiple sites, separate with semicolons (;)</li>
                    <li>Upload the CSV file to import supervisors</li>
                  </ol>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Upload CSV File</label>
                  <input
                    type="file"
                    accept=".csv"
                    onChange={handleFileUpload}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                {bulkImportData.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium text-gray-700 mb-2">Preview ({bulkImportData.length} supervisors)</h4>
                    <div className="max-h-40 overflow-y-auto border border-gray-200 rounded-lg">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Phone</th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Sites</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {bulkImportData.map((supervisor, index) => (
                            <tr key={index}>
                              <td className="px-4 py-2 text-sm">{supervisor.name}</td>
                              <td className="px-4 py-2 text-sm">{supervisor.email}</td>
                              <td className="px-4 py-2 text-sm">{supervisor.phone || '-'}</td>
                              <td className="px-4 py-2 text-sm">{supervisor.assignedSites.join(', ') || '-'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex gap-3 mt-6">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => {
                    setShowBulkImportModal(false)
                    setBulkImportData([])
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg font-medium"
                >
                  Cancel
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleBulkImport}
                  disabled={importing || bulkImportData.length === 0}
                  className={`flex-1 px-4 py-2 rounded-lg font-medium transition-colors ${importing || bulkImportData.length === 0
                      ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                      : 'bg-blue-500 hover:bg-blue-600 text-white'
                    }`}
                >
                  {importing ? (
                    <div className="flex items-center justify-center gap-2">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      Importing...
                    </div>
                  ) : (
                    `Import ${bulkImportData.length} Supervisors`
                  )}
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </div>
    </div>
  )
}

export default SupervisorManagement
