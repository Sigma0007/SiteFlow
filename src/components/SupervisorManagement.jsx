import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Users, Plus, Edit2, Trash2, Mail, Phone, Building2,
  X, Search, Eye, EyeOff, CheckCircle, AlertCircle, Lock, ArrowLeft
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { supervisorServices, siteServices, siteAssignmentServices, convertDocsToArray } from '../services/firebaseServices'

const SupervisorManagement = ({ userRole }) => {
  const navigate = useNavigate()
  const [supervisors, setSupervisors] = useState([])
  const [sites, setSites] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [showAddModal, setShowAddModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(null) // supervisorId
  const [showSuccessModal, setShowSuccessModal] = useState(null) // { name, email, password }
  const [selectedSupervisor, setSelectedSupervisor] = useState(null)
  const [creatingAccount, setCreatingAccount] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [toast, setToast] = useState({ visible: false, message: '', type: 'success' })

  const [formData, setFormData] = useState({ name: '', email: '', phone: '', password: '', assignedSites: [] })
  const [editFormData, setEditFormData] = useState({ name: '', email: '', phone: '', assignedSites: [] })

  const showToast = (message, type = 'success') => {
    setToast({ visible: true, message, type })
    setTimeout(() => setToast(t => ({ ...t, visible: false })), 3500)
  }

  // Load data
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true)
        const [supervisorsSnapshot, sitesSnapshot] = await Promise.all([
          supervisorServices.getAllSupervisors(),
          siteServices.getAllSites()
        ])
        setSupervisors(convertDocsToArray(supervisorsSnapshot))
        setSites(convertDocsToArray(sitesSnapshot))
      } catch (error) {
        console.error('Error loading data:', error)
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [])

  // Add supervisor — uses secondary Firebase App, admin stays logged in
  const handleAddSupervisor = async () => {
    if (!formData.name.trim() || !formData.email.trim() || !formData.password.trim()) {
      showToast('Please fill in Name, Email, and Password.', 'error')
      return
    }
    if (formData.password.length < 6) {
      showToast('Password must be at least 6 characters.', 'error')
      return
    }

    setCreatingAccount(true)
    try {
      const supervisorData = {
        name: formData.name.trim(),
        email: formData.email.trim().toLowerCase(),
        phone: formData.phone.trim() || '',
        assignedSites: formData.assignedSites || [],
        status: 'active',
      }

      // Pass password — service uses secondaryAuth so admin stays signed in
      const result = await supervisorServices.createSupervisorWithAuth(supervisorData, formData.password)

      // Reload list
      const snap = await supervisorServices.getAllSupervisors()
      const newList = convertDocsToArray(snap)
      setSupervisors(newList)

      // Sync site assignments
      const newSup = newList.find(s => s.email === supervisorData.email)
      if (newSup && supervisorData.assignedSites.length > 0) {
        await updateSiteAssignments(newSup.id, supervisorData.assignedSites)
      }

      // Show success modal with credentials (admin can share with supervisor)
      setShowSuccessModal({
        name: formData.name.trim(),
        email: formData.email.trim().toLowerCase(),
        password: formData.password
      })

      setFormData({ name: '', email: '', phone: '', password: '', assignedSites: [] })
      setShowAddModal(false)
    } catch (error) {
      console.error('Error adding supervisor:', error)
      const msg = error.code === 'auth/email-already-in-use'
        ? 'This email is already registered. Please use a different email.'
        : `Error: ${error.message}`
      showToast(msg, 'error')
    } finally {
      setCreatingAccount(false)
    }
  }

  // Edit supervisor
  const handleEditSupervisor = async () => {
    if (!editFormData.name.trim() || !editFormData.email.trim()) {
      showToast('Name and Email are required.', 'error')
      return
    }
    try {
      const supervisorData = {
        name: editFormData.name.trim(),
        email: editFormData.email.trim(),
        phone: editFormData.phone.trim() || '',
        assignedSites: editFormData.assignedSites || [],
        updatedAt: new Date().toISOString()
      }
      await supervisorServices.updateSupervisor(selectedSupervisor.id, supervisorData)
      await updateSiteAssignments(selectedSupervisor.id, editFormData.assignedSites)
      const snap = await supervisorServices.getAllSupervisors()
      setSupervisors(convertDocsToArray(snap))
      setShowEditModal(false)
      setSelectedSupervisor(null)
      showToast('Supervisor updated successfully!')
    } catch (error) {
      console.error('Error updating supervisor:', error)
      showToast('Error updating supervisor.', 'error')
    }
  }

  // Delete supervisor
  const handleDeleteSupervisor = async (supervisorId) => {
    try {
      await supervisorServices.deleteSupervisor(supervisorId)
      const snap = await supervisorServices.getAllSupervisors()
      setSupervisors(convertDocsToArray(snap))
      setShowDeleteConfirm(null)
      showToast('Supervisor deleted.')
    } catch (error) {
      console.error('Error deleting supervisor:', error)
      showToast('Error deleting supervisor.', 'error')
    }
  }

  // Sync site ↔ supervisor assignments
  const updateSiteAssignments = async (supervisorId, assignedSites) => {
    try {
      for (const site of sites) {
        const current = site.assignedSupervisors || []
        let updated = current.filter(id => id !== supervisorId)
        if (assignedSites.includes(site.id)) updated.push(supervisorId)
        await siteAssignmentServices.assignSupervisorsToSite(site.id, updated)
      }
    } catch (error) {
      console.error('Error syncing site assignments:', error)
    }
  }

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

  const filteredSupervisors = supervisors.filter(s =>
    s.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.email?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  if (userRole !== 'admin') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-red-600 mb-4">Access Denied</h2>
          <p className="text-gray-600">You don&apos;t have permission to access supervisor management.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {/* Toast */}
      <AnimatePresence>
        {toast.visible && (
          <motion.div
            initial={{ opacity: 0, y: -40 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -40 }}
            className={`fixed top-5 right-5 z-[80] flex items-center gap-3 px-5 py-3.5 rounded-xl shadow-xl text-white font-medium text-sm ${toast.type === 'error' ? 'bg-red-600' : 'bg-green-600'}`}
          >
            {toast.type === 'error' ? <AlertCircle className="w-5 h-5 shrink-0" /> : <CheckCircle className="w-5 h-5 shrink-0" />}
            {toast.message}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div className="flex items-center gap-4">
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={() => navigate('/dashboard')}
              className="p-2 bg-white rounded-lg shadow-sm border border-gray-200 text-gray-600 hover:text-blue-600 transition-colors"
            >
              <ArrowLeft className="w-6 h-6" />
            </motion.button>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Supervisor Management</h1>
              <p className="text-gray-600 mt-1">Manage supervisors and their site assignments</p>
            </div>
          </div>
          <motion.button
            whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold shadow-md transition-all"
          >
            <Plus className="w-5 h-5" /> Add Supervisor
          </motion.button>
        </div>

        {/* Search */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search supervisors by name or email..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
            />
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="animate-spin rounded-full h-10 w-10 border-4 border-blue-500 border-t-transparent" />
            </div>
          ) : filteredSupervisors.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-gray-400">
              <Users className="w-14 h-14 mb-4 text-gray-300" />
              <p className="text-lg font-medium text-gray-600">{searchTerm ? 'No supervisors match your search' : 'No supervisors yet'}</p>
              <p className="text-sm mt-1">Click "Add Supervisor" to create one</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    {['Supervisor', 'Contact', 'Assigned Sites', 'Status', 'Actions'].map(h => (
                      <th key={h} className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredSupervisors.map((supervisor) => (
                    <motion.tr
                      key={supervisor.id}
                      initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                      className="hover:bg-gray-50 transition-colors"
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center font-bold text-blue-700 text-base">
                            {supervisor.name?.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="text-sm font-semibold text-gray-900">{supervisor.name}</div>
                            <div className="text-xs text-gray-500">{supervisor.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-1.5 text-sm text-gray-600">
                          <Phone className="w-3.5 h-3.5 text-gray-400" />
                          {supervisor.phone || <span className="text-gray-400 italic">Not provided</span>}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-1.5 text-sm text-gray-700">
                          <Building2 className="w-3.5 h-3.5 text-gray-400" />
                          {supervisor.assignedSites?.length || 0} site{supervisor.assignedSites?.length !== 1 ? 's' : ''}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2.5 py-1 text-xs font-semibold rounded-full ${supervisor.status === 'active' ? 'bg-green-100 text-green-700'
                            : supervisor.status === 'pending' ? 'bg-yellow-100 text-yellow-700'
                              : 'bg-red-100 text-red-700'
                          }`}>
                          {supervisor.status === 'pending' ? '⏳ Pending' : supervisor.status === 'active' ? '✅ Active' : supervisor.status || 'active'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-3">
                          <button onClick={() => openEditModal(supervisor)} className="text-blue-500 hover:text-blue-700 transition-colors" title="Edit">
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button onClick={() => setShowDeleteConfirm(supervisor.id)} className="text-red-500 hover:text-red-700 transition-colors" title="Delete">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* ── Add Supervisor Modal ── */}
      <AnimatePresence>
        {showAddModal && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50"
            onClick={() => setShowAddModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              onClick={e => e.stopPropagation()}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden"
            >
              <div className="p-6 border-b border-gray-100 flex items-center justify-between">
                <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                  <UserPlus className="w-5 h-5 text-blue-600" /> Add New Supervisor
                </h3>
                <button onClick={() => setShowAddModal(false)} className="p-1.5 rounded-full hover:bg-gray-100 text-gray-500"><X className="w-5 h-5" /></button>
              </div>

              <div className="p-6 space-y-4">
                {/* Name */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Full Name *</label>
                  <input type="text" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                    placeholder="e.g. Rajesh Kumar" />
                </div>

                {/* Email */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Email Address *</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                    <input type="email" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })}
                      className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                      placeholder="supervisor@example.com" />
                  </div>
                </div>

                {/* Phone */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Phone Number</label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                    <input type="tel" value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })}
                      className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                      placeholder="+91 98765 43210" />
                  </div>
                </div>

                {/* Password */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Login Password * <span className="text-xs font-normal text-gray-400">(min 6 characters)</span>
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={formData.password}
                      onChange={e => setFormData({ ...formData, password: e.target.value })}
                      className="w-full pl-10 pr-12 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                      placeholder="Set a strong password"
                    />
                    <button type="button" onClick={() => setShowPassword(p => !p)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Assign Sites */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Assign Sites</label>
                  <div className="space-y-1.5 max-h-36 overflow-y-auto border border-gray-200 rounded-lg p-3 bg-gray-50">
                    {sites.length === 0 ? (
                      <p className="text-sm text-gray-500">No sites available</p>
                    ) : sites.map(site => (
                      <label key={site.id} className={`flex items-center gap-2.5 p-2 rounded-lg cursor-pointer transition-colors ${formData.assignedSites.includes(site.id) ? 'bg-blue-50' : 'hover:bg-gray-100'}`}>
                        <input type="checkbox" checked={formData.assignedSites.includes(site.id)}
                          onChange={e => setFormData({ ...formData, assignedSites: e.target.checked ? [...formData.assignedSites, site.id] : formData.assignedSites.filter(id => id !== site.id) })}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                        <span className="text-sm font-medium text-gray-800">{site.name}</span>
                        <span className="text-xs text-gray-500">{site.location}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                  <p className="text-xs text-amber-800 flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    The password you set is for the supervisor&apos;s login. Note it down before saving and share it directly with the supervisor.
                  </p>
                </div>
              </div>

              <div className="p-5 border-t border-gray-100 flex gap-3">
                <button onClick={() => setShowAddModal(false)} className="flex-1 py-2.5 bg-white border border-gray-300 rounded-xl font-medium text-gray-700 hover:bg-gray-50 transition-colors">
                  Cancel
                </button>
                <button
                  onClick={handleAddSupervisor}
                  disabled={creatingAccount || !formData.name || !formData.email || !formData.password}
                  className={`flex-1 py-2.5 rounded-xl font-bold transition-all shadow-sm ${creatingAccount || !formData.name || !formData.email || !formData.password ? 'bg-gray-200 text-gray-400 cursor-not-allowed' : 'bg-blue-600 text-white hover:bg-blue-700 shadow-blue-200'}`}
                >
                  {creatingAccount ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                      Creating...
                    </span>
                  ) : 'Create Supervisor Account'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Success Modal (show credentials) ── */}
      <AnimatePresence>
        {showSuccessModal && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-[60]"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
            >
              <div className="bg-green-50 border-b border-green-100 p-6 flex items-center gap-3">
                <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                  <CheckCircle className="w-7 h-7 text-green-600" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-green-900">Supervisor Created!</h3>
                  <p className="text-sm text-green-700">Account is ready. Share these credentials.</p>
                </div>
              </div>
              <div className="p-6 space-y-4">
                <p className="text-sm text-gray-600">Share the following login credentials with <strong>{showSuccessModal.name}</strong>:</p>
                <div className="bg-gray-50 rounded-xl p-4 space-y-3 border border-gray-200">
                  <div>
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-0.5">Email</p>
                    <p className="font-mono text-gray-900 font-semibold select-all">{showSuccessModal.email}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-0.5">Password</p>
                    <p className="font-mono text-gray-900 font-semibold select-all">{showSuccessModal.password}</p>
                  </div>
                </div>
                <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3">
                  ⚠️ This is the only time you will see this password. Copy it before closing.
                </p>
              </div>
              <div className="p-5 border-t border-gray-100">
                <button onClick={() => setShowSuccessModal(null)} className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold transition-all shadow-sm">
                  Done — I&apos;ve Noted the Credentials
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Edit Supervisor Modal ── */}
      <AnimatePresence>
        {showEditModal && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50"
            onClick={() => setShowEditModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              onClick={e => e.stopPropagation()}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden"
            >
              <div className="p-6 border-b border-gray-100 flex items-center justify-between">
                <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                  <Edit2 className="w-5 h-5 text-blue-600" /> Edit Supervisor
                </h3>
                <button onClick={() => setShowEditModal(false)} className="p-1.5 rounded-full hover:bg-gray-100 text-gray-500"><X className="w-5 h-5" /></button>
              </div>
              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Full Name *</label>
                  <input type="text" value={editFormData.name} onChange={e => setEditFormData({ ...editFormData, name: e.target.value })}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
                  <input type="email" value={editFormData.email} disabled
                    className="w-full px-4 py-2.5 border border-gray-200 bg-gray-50 rounded-lg text-gray-500 cursor-not-allowed" />
                  <p className="text-xs text-gray-400 mt-1">Email cannot be changed after account creation.</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Phone</label>
                  <input type="tel" value={editFormData.phone} onChange={e => setEditFormData({ ...editFormData, phone: e.target.value })}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Assigned Sites</label>
                  <div className="space-y-1.5 max-h-36 overflow-y-auto border border-gray-200 rounded-lg p-3 bg-gray-50">
                    {sites.map(site => (
                      <label key={site.id} className={`flex items-center gap-2.5 p-2 rounded-lg cursor-pointer transition-colors ${editFormData.assignedSites.includes(site.id) ? 'bg-blue-50' : 'hover:bg-gray-100'}`}>
                        <input type="checkbox" checked={editFormData.assignedSites.includes(site.id)}
                          onChange={e => setEditFormData({ ...editFormData, assignedSites: e.target.checked ? [...editFormData.assignedSites, site.id] : editFormData.assignedSites.filter(id => id !== site.id) })}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                        <span className="text-sm font-medium text-gray-800">{site.name}</span>
                        <span className="text-xs text-gray-500">{site.location}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
              <div className="p-5 border-t border-gray-100 flex gap-3">
                <button onClick={() => setShowEditModal(false)} className="flex-1 py-2.5 bg-white border border-gray-300 rounded-xl font-medium text-gray-700 hover:bg-gray-50">Cancel</button>
                <button onClick={handleEditSupervisor} className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold shadow-sm transition-all">Save Changes</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Delete Confirm Modal ── */}
      <AnimatePresence>
        {showDeleteConfirm && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50"
            onClick={() => setShowDeleteConfirm(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              onClick={e => e.stopPropagation()}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden"
            >
              <div className="p-6 text-center">
                <div className="w-14 h-14 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Trash2 className="w-7 h-7 text-red-600" />
                </div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">Delete Supervisor?</h3>
                <p className="text-sm text-gray-600">This will remove the supervisor from Firestore. Their Firebase Auth account must be removed manually from the Firebase Console.</p>
              </div>
              <div className="p-5 border-t border-gray-100 flex gap-3">
                <button onClick={() => setShowDeleteConfirm(null)} className="flex-1 py-2.5 bg-white border border-gray-300 rounded-xl font-medium text-gray-700 hover:bg-gray-50">Cancel</button>
                <button onClick={() => handleDeleteSupervisor(showDeleteConfirm)} className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold transition-all">Yes, Delete</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// Icon missing from imports — add inline
const UserPlus = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
  </svg>
)

export default SupervisorManagement
