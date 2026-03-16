import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  FileText,
  Plus,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Calendar,
  Package,
  User,
  Search,
  Filter,
  Trash2,
  ArrowLeft
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { supervisorServices, siteServices, convertDocsToArray } from '../services/firebaseServices'
import { useSupervisor } from '../contexts/SupervisorContext.jsx'
import { useAuth } from '../components/Auth'

const PORequests = ({ userRole = 'admin' }) => {
  const navigate = useNavigate()
  const { currentSupervisor, assignedSites } = useSupervisor()
  const { user } = useAuth()
  const [poRequests, setPORequests] = useState([])
  const [sites, setSites] = useState([])
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterStatus, setFilterStatus] = useState('all')
  const [loading, setLoading] = useState(true)
  const [formData, setFormData] = useState({
    siteId: '',
    materialName: '',
    quantity: '',
    unit: '',
    urgency: 'normal',
    reason: '',
    expectedDate: ''
  })

  // Helper – reload PO list and apply role filter
  const reloadRequests = async () => {
    const snapshot = await supervisorServices.getPORequests()
    const all = convertDocsToArray(snapshot)
    if (userRole === 'supervisor') {
      const allowedSiteIds = new Set((assignedSites || []).map(s => s.id))
      setPORequests(all.filter(r =>
        r.requestedBy === (currentSupervisor?.email || user?.email) &&
        (!r.siteId || allowedSiteIds.has(r.siteId))
      ))
    } else {
      setPORequests(all)
    }
  }

  useEffect(() => {
    const loadPORequests = async () => {
      try {
        setLoading(true)
        if (userRole === 'supervisor') {
          // Wait until context has resolved sites
          if (assignedSites.length === 0 && !currentSupervisor) return
          setSites(assignedSites || [])
        } else {
          const sitesSnapshot = await siteServices.getAllSites()
          setSites(convertDocsToArray(sitesSnapshot))
        }
        await reloadRequests()
      } catch (error) {
        console.error('Error loading PO requests:', error)
        setPORequests([])
      } finally {
        setLoading(false)
      }
    }
    loadPORequests()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userRole, currentSupervisor, assignedSites])

  const handleSubmitRequest = async (e) => {
    e.preventDefault()
    try {
      if (!formData.siteId) {
        alert('Please select a site for this request.')
        return
      }
      const newRequest = {
        ...formData,
        requestedBy: currentSupervisor?.email || user?.email || '',
        requestDate: new Date().toISOString().split('T')[0],
        status: 'pending',
        approvedBy: '',
        adminNotes: ''
      }
      await supervisorServices.createPORequest(newRequest)
      await reloadRequests()
      setShowCreateModal(false)
      setFormData({ siteId: '', materialName: '', quantity: '', unit: '', urgency: 'normal', reason: '', expectedDate: '' })
    } catch (error) {
      console.error('Error creating PO request:', error)
      alert('Error creating PO request. Please try again.')
    }
  }

  const handleApprove = async (requestId) => {
    try {
      const updateData = {
        status: 'approved',
        approvedBy: user?.email || 'admin',
        approvedDate: new Date().toISOString().split('T')[0]
      }
      await supervisorServices.updatePORequest(requestId, updateData)
      await reloadRequests()
    } catch (error) {
      console.error('Error approving PO request:', error)
      alert('Error approving PO request. Please try again.')
    }
  }

  const handleReject = async (requestId, notes) => {
    const rejectNotes = prompt('Please provide rejection reason:', notes || '')
    if (rejectNotes !== null) {
      try {
        await supervisorServices.updatePORequest(requestId, {
          status: 'rejected',
          rejectedBy: user?.email || 'admin',
          rejectedDate: new Date().toISOString().split('T')[0],
          adminNotes: rejectNotes
        })
        await reloadRequests()
      } catch (error) {
        console.error('Error rejecting PO request:', error)
        alert('Error rejecting PO request. Please try again.')
      }
    }
  }

  const handleDelete = async (requestId) => {
    if (window.confirm('Are you sure you want to delete this PO request? This action cannot be undone.')) {
      try {
        await supervisorServices.deletePORequest(requestId)
        await reloadRequests()
      } catch (error) {
        console.error('Error deleting PO request:', error)
        alert('Error deleting PO request. Please try again.')
      }
    }
  }

  const getStatusColor = (status) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-700 border-yellow-200'
      case 'approved': return 'bg-green-100 text-green-700 border-green-200'
      case 'rejected': return 'bg-red-100 text-red-700 border-red-200'
      default: return 'bg-gray-100 text-gray-700 border-gray-200'
    }
  }

  const getStatusIcon = (status) => {
    switch (status) {
      case 'pending': return Clock
      case 'approved': return CheckCircle
      case 'rejected': return XCircle
      default: return FileText
    }
  }

  const getUrgencyColor = (urgency) => {
    switch (urgency) {
      case 'high': return 'bg-red-100 text-red-700'
      case 'normal': return 'bg-blue-100 text-blue-700'
      case 'low': return 'bg-gray-100 text-gray-700'
      default: return 'bg-gray-100 text-gray-700'
    }
  }

  const filteredRequests = poRequests.filter(request => {
    const matchesSearch = request.materialName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      request.reason.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesFilter = filterStatus === 'all' || request.status === filterStatus
    return matchesSearch && matchesFilter
  })

  const stats = {
    total: poRequests.length,
    pending: poRequests.filter(r => r.status === 'pending').length,
    approved: poRequests.filter(r => r.status === 'approved').length,
    rejected: poRequests.filter(r => r.status === 'rejected').length
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-3 text-gray-600">Loading PO requests...</span>
      </div>
    )
  }

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
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
            <h1 className="text-2xl font-bold text-gray-900">Purchase Order Requests</h1>
            <p className="text-gray-600">
              {userRole === 'admin' ? 'Review and approve PO requests' : 'Create and track your PO requests'}
            </p>
          </div>
        </div>
        {userRole === 'supervisor' && (
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg font-medium"
          >
            <Plus className="w-4 h-4" />
            New Request
          </motion.button>
        )}
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Requests</p>
              <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
            </div>
            <FileText className="w-8 h-8 text-blue-500" />
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Pending</p>
              <p className="text-2xl font-bold text-yellow-600">{stats.pending}</p>
            </div>
            <Clock className="w-8 h-8 text-yellow-500" />
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Approved</p>
              <p className="text-2xl font-bold text-green-600">{stats.approved}</p>
            </div>
            <CheckCircle className="w-8 h-8 text-green-500" />
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Rejected</p>
              <p className="text-2xl font-bold text-red-600">{stats.rejected}</p>
            </div>
            <XCircle className="w-8 h-8 text-red-500" />
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="flex-1">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search by material name or reason..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setFilterStatus('all')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${filterStatus === 'all'
              ? 'bg-blue-500 text-white'
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
          >
            All
          </button>
          <button
            onClick={() => setFilterStatus('pending')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${filterStatus === 'pending'
              ? 'bg-yellow-500 text-white'
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
          >
            Pending
          </button>
          <button
            onClick={() => setFilterStatus('approved')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${filterStatus === 'approved'
              ? 'bg-green-500 text-white'
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
          >
            Approved
          </button>
          <button
            onClick={() => setFilterStatus('rejected')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${filterStatus === 'rejected'
              ? 'bg-red-500 text-white'
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
          >
            Rejected
          </button>
        </div>
      </div>

      {/* Requests List */}
      <div className="space-y-4">
        {filteredRequests.map((request, index) => {
          const StatusIcon = getStatusIcon(request.status)
          return (
            <motion.div
              key={request.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className="bg-white rounded-xl shadow-sm border border-gray-200 p-6"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-start gap-4">
                  <div className={`p-3 rounded-lg ${request.status === 'pending' ? 'bg-yellow-100' :
                    request.status === 'approved' ? 'bg-green-100' : 'bg-red-100'
                    }`}>
                    <StatusIcon className={`w-6 h-6 ${request.status === 'pending' ? 'text-yellow-600' :
                      request.status === 'approved' ? 'text-green-600' : 'text-red-600'
                      }`} />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">{request.materialName}</h3>
                    <p className="text-gray-600">{request.reason}</p>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <span className={`px-3 py-1 rounded-full text-sm font-medium border ${getStatusColor(request.status)}`}>
                    {request.status}
                  </span>
                  <span className={`px-2 py-1 rounded text-xs font-medium ${getUrgencyColor(request.urgency)}`}>
                    {request.urgency} urgency
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                <div>
                  <p className="text-sm text-gray-600 mb-1">Quantity</p>
                  <p className="font-semibold text-gray-900">{request.quantity} {request.unit}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600 mb-1">Expected Date</p>
                  <p className="font-semibold text-gray-900">{request.expectedDate}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600 mb-1">Requested By</p>
                  <p className="font-semibold text-gray-900">{request.requestedBy}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600 mb-1">Request Date</p>
                  <p className="font-semibold text-gray-900">{request.requestDate}</p>
                </div>
              </div>

              {request.adminNotes && (
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 mb-4">
                  <p className="text-sm text-gray-600 mb-1">Admin Notes:</p>
                  <p className="text-gray-900">{request.adminNotes}</p>
                </div>
              )}

              {userRole === 'admin' && request.status === 'pending' && (
                <div className="flex gap-3 pt-4 border-t border-gray-200">
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => handleApprove(request.id)}
                    className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg font-medium"
                  >
                    <CheckCircle className="w-4 h-4 inline mr-2" />
                    Approve
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => handleReject(request.id, request.adminNotes)}
                    className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg font-medium"
                  >
                    <XCircle className="w-4 h-4 inline mr-2" />
                    Reject
                  </motion.button>
                </div>
              )}

              {/* Delete button - Admin can delete any, Supervisor can delete their own */}
              {(userRole === 'admin' || (userRole === 'supervisor' && request.requestedBy === currentSupervisor?.email)) && (
                <div className="flex gap-3 pt-2">
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => handleDelete(request.id)}
                    className="px-4 py-2 bg-gray-500 hover:bg-gray-600 text-white rounded-lg font-medium"
                  >
                    <Trash2 className="w-4 h-4 inline mr-2" />
                    Delete
                  </motion.button>
                </div>
              )}
            </motion.div>
          )
        })}
      </div>

      {/* Create Request Modal */}
      {showCreateModal && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
          onClick={() => setShowCreateModal(false)}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
          >
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-2xl font-bold text-gray-900">New Purchase Order Request</h2>
              <p className="text-gray-600 mt-1">Submit a request for materials needed</p>
            </div>

            <form onSubmit={handleSubmitRequest} className="p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Material Name *</label>
                  <input
                    type="text"
                    required
                    value={formData.materialName}
                    onChange={(e) => setFormData({ ...formData, materialName: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="e.g., Cement"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Quantity *</label>
                  <input
                    type="number"
                    required
                    min="1"
                    value={formData.quantity}
                    onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="e.g., 100"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Unit *</label>
                  <input
                    type="text"
                    required
                    value={formData.unit}
                    onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="e.g., bags, tons, pieces"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Site *</label>
                  <select
                    required
                    value={formData.siteId}
                    onChange={(e) => setFormData({ ...formData, siteId: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">Select site</option>
                    {sites.map(site => (
                      <option key={site.id} value={site.id}>{site.name}</option>
                    ))}
                  </select>
                </div>
                {/* <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Expected Date *</label>
                  <input
                    type="date"
                    required
                    value={formData.expectedDate}
                    onChange={(e) => setFormData({...formData, expectedDate: e.target.value})}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div> */}
              </div>

              {/* <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Urgency *</label>
                <select
                  required
                  value={formData.urgency}
                  onChange={(e) => setFormData({...formData, urgency: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="low">Low</option>
                  <option value="normal">Normal</option>
                  <option value="high">High</option>
                </select>
              </div> */}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Reason *</label>
                <textarea
                  required
                  rows={3}
                  value={formData.reason}
                  onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Explain why this material is needed..."
                />
              </div>

              <div className="flex gap-3 pt-4 border-t border-gray-200">
                <motion.button
                  type="button"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg font-medium"
                >
                  Cancel
                </motion.button>
                <motion.button
                  type="submit"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="flex-1 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-medium"
                >
                  Submit Request
                </motion.button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
    </div>
  )
}

export default PORequests
