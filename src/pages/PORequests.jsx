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
import { supervisorServices, siteServices, materialServices, buildingServices, notificationServices, convertDocsToArray } from '../services/firebaseServices'
import { useSupervisor } from '../contexts/SupervisorContext.jsx'
import { useAuth } from '../components/Auth'
import StatusModal from '../components/StatusModal'
import InputModal from '../components/InputModal'

const PORequests = ({ userRole = 'admin' }) => {
  const navigate = useNavigate()
  const { currentSupervisor, assignedSites } = useSupervisor()
  const { user } = useAuth()
  const [poRequests, setPORequests] = useState([])
  const [sites, setSites] = useState([])
  const [buildings, setBuildings] = useState([])
  const [materials, setMaterials] = useState([])
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterStatus, setFilterStatus] = useState('all')
  const [loading, setLoading] = useState(true)
  const [formData, setFormData] = useState({
    siteId: '',
    buildingId: '',
    urgency: 'normal',
    reason: '',
    expectedDate: '',
    items: [{ id: Date.now(), materialName: '', quantity: '', unit: '' }]
  })

  // Helper functions for managing items
  const addItem = () => {
    setFormData(prev => ({
      ...prev,
      items: [...prev.items, { id: Date.now(), materialName: '', quantity: '', unit: '' }]
    }))
  }

  const removeItem = (itemId) => {
    if (formData.items.length === 1) {
      showAlert('Warning', 'At least one item is required.', 'warning')
      return
    }
    setFormData(prev => ({
      ...prev,
      items: prev.items.filter(item => item.id !== itemId)
    }))
  }

  const updateItem = (itemId, field, value) => {
    setFormData(prev => ({
      ...prev,
      items: prev.items.map(item =>
        item.id === itemId ? { ...item, [field]: value } : item
      )
    }))
  }

  // Status Modal State
  const [statusModal, setStatusModal] = useState({
    visible: false, type: 'success', title: '', message: '', onConfirm: null, onCancel: null
  })
  const showAlert = (title, message, type = 'success') => {
    setStatusModal({ visible: true, type, title, message, onConfirm: () => setStatusModal(prev => ({ ...prev, visible: false })) })
  }
  const showConfirm = (title, message, onConfirm) => {
    setStatusModal({
      visible: true, type: 'confirm', title, message,
      onConfirm: () => { onConfirm(); setStatusModal(prev => ({ ...prev, visible: false })); },
      onCancel: () => setStatusModal(prev => ({ ...prev, visible: false }))
    })
  }

  // Input Modal for rejection reason
  const [inputModal, setInputModal] = useState({
    visible: false, title: '', message: '', defaultValue: '', onConfirm: null
  })

  // Helper – reload PO list and apply role filter
  const reloadRequests = async () => {
    const snapshot = await supervisorServices.getPORequests()
    const all = convertDocsToArray(snapshot)
    if (userRole === 'supervisor') {
      setPORequests(all.filter(r =>
        r.requestedBy === (currentSupervisor?.email || user?.email)
      ))
    } else {
      setPORequests(all)
    }
  }

  useEffect(() => {
    const loadPORequests = async () => {
      try {
        setLoading(true)
        // Always load all sites for the dropdown so supervisors can create POs for any site
        const sitesSnapshot = await siteServices.getAllSites()
        setSites(convertDocsToArray(sitesSnapshot))
        const buildingsSnapshot = await buildingServices.getAllBuildings()
        setBuildings(convertDocsToArray(buildingsSnapshot))
        const materialsSnapshot = await materialServices.getAllMaterials()
        setMaterials(convertDocsToArray(materialsSnapshot))
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
        showAlert('Required', 'Please select a site for this request.', 'warning')
        return
      }

      // Validate items
      const validItems = formData.items.filter(item => item.materialName && item.quantity)
      if (validItems.length === 0) {
        showAlert('Required', 'Please add at least one material item.', 'warning')
        return
      }

      // Calculate total amount
      let totalAmount = 0
      validItems.forEach(item => {
        const selectedMaterial = materials.find(m => m.name === item.materialName)
        const unitPrice = selectedMaterial ? Number(selectedMaterial.unitPrice || 0) : 0
        totalAmount += unitPrice * Number(item.quantity || 1)
      })

      const newRequest = {
        siteId: formData.siteId,
        buildingId: formData.buildingId || null,
        items: validItems,
        urgency: formData.urgency,
        reason: formData.reason,
        expectedDate: formData.expectedDate,
        totalAmount,
        requestedBy: currentSupervisor?.email || user?.email || '',
        requestDate: new Date().toISOString().split('T')[0],
        status: 'pending',
        approvedBy: '',
        adminNotes: ''
      }
      const poDoc = await supervisorServices.createPORequest(newRequest)

      const targetSite = sites.find(s => s.id === formData.siteId)
      const siteName = targetSite ? targetSite.name : 'Site'
      const requesterName = formatDisplayName(currentSupervisor?.email || user?.email)
      const materialList = validItems.map(item => `${item.materialName} (${item.quantity} ${item.unit})`).join(', ')

      // Send notification to all admins using role-based targeting.
      // recipientRole:'admin' avoids needing to know specific admin emails
      // (supervisors cannot read the users collection due to Firestore rules).
      notificationServices.addNotificationWithPush({
        recipientRole: 'admin',
        type: 'po_generated',
        poId: poDoc.id,
        message: `Materials: ${materialList}\nSite: ${siteName}\nRequested by: ${requesterName}`,
        materialName: materialList,
        quantity: validItems.length,
        siteId: formData.siteId,
        siteName: siteName,
        requestedBy: requesterName
      }).catch(err => console.log('Notification failed (non-critical):', err))

      await reloadRequests()
      setShowCreateModal(false)
      setFormData({ siteId: '', buildingId: '', urgency: 'normal', reason: '', expectedDate: '', items: [{ id: Date.now(), materialName: '', quantity: '', unit: '' }] })
      showAlert('Success', 'PO request created successfully!')
    } catch (error) {
      console.error('Error creating PO request:', error)
      showAlert('Error', 'Error creating PO request. Please try again.', 'error')
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

      // Notify the supervisor who made this request.
      // recipientEmail targets their personal bell listener directly.
      const request = poRequests.find(r => r.id === requestId)
      if (request?.requestedBy) {
        const targetSite = sites.find(s => s.id === request.siteId)
        const siteName = targetSite ? targetSite.name : 'Site'
        const materialList = request.items
          ? request.items.map(i => `${i.materialName} (${i.quantity} ${i.unit})`).join(', ')
          : (request.materialName || 'Materials')
        notificationServices.addNotificationWithPush({
          recipientEmail: request.requestedBy,
          type: 'po_approved',
          poId: requestId,
          message: `Your PO request has been approved!\nMaterials: ${materialList}\nSite: ${siteName}`,
          materialName: materialList,
          siteId: request.siteId,
          siteName: siteName,
        }).catch(err => console.log('Approval notification failed (non-critical):', err))
      }

      await reloadRequests()
      showAlert('Approved', 'PO request has been approved successfully!')
    } catch (error) {
      console.error('Error approving PO request:', error)
      showAlert('Error', 'Error approving PO request. Please try again.', 'error')
    }
  }

  const handleArrived = async (request) => {
    try {
      // 1. Update PO status
      const updateData = {
        status: 'arrived',
        arrivedDate: new Date().toISOString().split('T')[0]
      }
      await supervisorServices.updatePORequest(request.id, updateData)

      // 2. Add materials directly to site (handle multiple items)
      const siteDoc = await siteServices.getSiteById(request.siteId)
      if (siteDoc.exists()) {
        const siteData = siteDoc.data()
        let assignedMaterials = siteData.assignedMaterials || []

        const itemsToAdd = request.items || [{
          materialName: request.materialName,
          quantity: request.quantity,
          unit: request.unit
        }]

        itemsToAdd.forEach(item => {
          const existingMatIndex = assignedMaterials.findIndex(m => m.name.toLowerCase() === item.materialName.toLowerCase())
          const quantityNum = parseFloat(item.quantity) || 1

          if (existingMatIndex >= 0) {
            assignedMaterials[existingMatIndex].quantity += quantityNum
          } else {
            assignedMaterials.push({
              materialId: `direct_po_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
              name: item.materialName,
              category: 'PO Directed',
              quantity: quantityNum,
              unit: item.unit || ''
            })
          }
        })

        await siteServices.updateSite(request.siteId, { assignedMaterials })
      }

      const targetSite = sites.find(s => s.id === request?.siteId)
      const siteName = targetSite ? targetSite.name : 'Site'
      const requesterName = formatDisplayName(request.requestedBy)

      // 3. Notify admin that PO has arrived
      const itemsList = request.items ? request.items.map(i => `${i.materialName} (${i.quantity} ${i.unit})`).join(', ') : `${request.materialName} (${request.quantity} ${request.unit})`

      // Send notification to all admins using role-based targeting.
      notificationServices.addNotificationWithPush({
        recipientRole: 'admin',
        type: 'po_arrived',
        poId: request.id,
        message: `Material Arrived: ${itemsList}\nSite: ${siteName}\nRequested by: ${requesterName}`,
        materialName: itemsList,
        quantity: request.items ? request.items.length : request.quantity,
        siteId: request.siteId,
        siteName: siteName,
        requestedBy: request.requestedBy
      }).catch(err => console.log('Notification failed:', err))

      await reloadRequests()
      showAlert('Arrived & Allocated', 'PO material has arrived and stock was allocated to the site!')
    } catch (error) {
      console.error('Error marking PO arrived:', error)
      showAlert('Error', 'Error updating PO workflow. Please try again.', 'error')
    }
  }

  const handleReject = async (requestId, notes) => {
    setInputModal({
      visible: true,
      title: 'Rejection Reason',
      message: 'Please provide a reason for rejecting this PO request:',
      defaultValue: notes || '',
      onConfirm: async (rejectNotes) => {
        setInputModal(prev => ({ ...prev, visible: false }))
        try {
          await supervisorServices.updatePORequest(requestId, {
            status: 'rejected',
            rejectedBy: user?.email || 'admin',
            rejectedDate: new Date().toISOString().split('T')[0],
            adminNotes: rejectNotes
          })
          await reloadRequests()
          showAlert('Rejected', 'PO request has been rejected.')
        } catch (error) {
          console.error('Error rejecting PO request:', error)
          showAlert('Error', 'Error rejecting PO request. Please try again.', 'error')
        }
      }
    })
  }

  const handleDelete = async (requestId) => {
    showConfirm(
      'Delete PO Request?',
      'Are you sure you want to delete this PO request? This action cannot be undone.',
      async () => {
        try {
          await supervisorServices.deletePORequest(requestId)
          await reloadRequests()
          showAlert('Deleted', 'PO request deleted successfully.')
        } catch (error) {
          console.error('Error deleting PO request:', error)
          showAlert('Error', 'Error deleting PO request. Please try again.', 'error')
        }
      }
    )
  }

  const formatDisplayName = (emailOrName) => {
    if (!emailOrName) return 'User';
    if (currentSupervisor?.email === emailOrName && currentSupervisor?.name) {
      return currentSupervisor.name;
    }
    const knownNames = {
      'odedraarjun928@gmail.com': 'Arjun Odedra (Admin)',
      'aodedra259@rku.ac.in': 'Arjun Odedra (Supervisor)',
      'odedraarjun0007@gmail.com': 'Arjun Odedra (Supervisor 2)'
    };
    if (knownNames[emailOrName]) {
      return knownNames[emailOrName];
    }
    if (!emailOrName.includes('@')) {
      return emailOrName;
    }
    const username = emailOrName.split('@')[0];
    const cleanName = username.replace(/[0-9]+$/g, '');
    return cleanName
      .replace(/[._-]/g, ' ')
      .split(' ')
      .filter(Boolean)
      .map(w => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-700 border-yellow-200'
      case 'approved': return 'bg-blue-100 text-blue-700 border-blue-200'
      case 'arrived': return 'bg-green-100 text-green-700 border-green-200'
      case 'rejected': return 'bg-red-100 text-red-700 border-red-200'
      default: return 'bg-gray-100 text-gray-700 border-gray-200'
    }
  }

  const getStatusIcon = (status) => {
    switch (status) {
      case 'pending': return Clock
      case 'approved': return CheckCircle
      case 'arrived': return Package
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
    const searchStr = searchTerm.toLowerCase();
    const materialNames = request.items ? request.items.map(i => i.materialName).join(' ') : (request.materialName || '');
    const reason = request.reason || '';

    const matchesSearch = materialNames.toLowerCase().includes(searchStr) || reason.toLowerCase().includes(searchStr);
    const matchesFilter = filterStatus === 'all' || request.status === filterStatus;

    return matchesSearch && matchesFilter;
  });

  const stats = {
    total: poRequests.length,
    pending: poRequests.filter(r => r.status === 'pending').length,
    approved: poRequests.filter(r => r.status === 'approved').length,
    arrived: poRequests.filter(r => r.status === 'arrived').length,
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
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg font-medium"
        >
          <Plus className="w-4 h-4" />
          New Request
        </motion.button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-4 sm:grid-cols-4 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Requests</p>
              <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
            </div>
            <FileText className="w-8 h-8 text-blue-500 hidden sm:hidden md:block" />
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Pending</p>
              <p className="text-2xl font-bold text-yellow-600">{stats.pending}</p>
            </div>
            <Clock className="w-8 h-8 text-yellow-500 hidden sm:hidden md:block" />
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Approved</p>
              <p className="text-2xl font-bold text-green-600">{stats.approved}</p>
            </div>
            <CheckCircle className="w-8 h-8 text-green-500 hidden sm:hidden md:block" />
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Rejected</p>
              <p className="text-2xl font-bold text-red-600">{stats.rejected}</p>
            </div>
            <XCircle className="w-8 h-8 text-red-500 hidden sm:hidden md:block" />
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
        <div className="flex flex-wrap gap-2">
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
              ? 'bg-blue-500 text-white'
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
          >
            Approved
          </button>
          <button
            onClick={() => setFilterStatus('arrived')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${filterStatus === 'arrived'
              ? 'bg-green-500 text-white'
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
          >
            Arrived
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
              <div className="flex items-start justify-between mb-4 gap-3">
                <div className="flex items-start gap-3 min-w-0">
                  <div className={`p-2.5 rounded-lg flex-shrink-0 ${request.status === 'pending' ? 'bg-yellow-100' :
                    request.status === 'approved' ? 'bg-green-100' : 'bg-red-100'
                    }`}>
                    <StatusIcon className={`w-5 h-5 ${request.status === 'pending' ? 'text-yellow-600' :
                      request.status === 'approved' ? 'text-green-600' : 'text-red-600'
                      }`} />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-base font-semibold text-gray-900 leading-tight">
                      {request.items
                        ? request.items.map(i => `${i.materialName} (${i.quantity} ${i.unit || ''})`).join(', ')
                        : `${request.materialName} (${request.quantity} ${request.unit || ''})`
                      }
                    </h3>
                    <p className="text-gray-500 text-sm mt-0.5 line-clamp-2">{request.reason}</p>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-2 flex-shrink-0 ml-2">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium border whitespace-nowrap ${getStatusColor(request.status)}`}>
                    {request.status}
                  </span>
                  <span className={`px-2 py-0.5 rounded text-xs font-medium whitespace-nowrap ${getUrgencyColor(request.urgency)}`}>
                    {request.urgency} urgency
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 mb-4">
                {/* Materials breakdown — shows each item name + quantity + unit */}
                <div className="col-span-2">
                  <p className="text-xs text-gray-500 mb-1">Materials &amp; Quantities</p>
                  {request.items && request.items.length > 0 ? (
                    <div className="space-y-1">
                      {request.items.map((item, idx) => (
                        <div key={idx} className="flex items-center gap-2 text-sm">
                          <span className="w-2 h-2 rounded-full bg-blue-400 flex-shrink-0" />
                          <span className="font-semibold text-gray-900">{item.materialName}</span>
                          <span className="text-gray-500">—</span>
                          <span className="font-medium text-blue-700">{item.quantity} {item.unit || ''}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="font-semibold text-gray-900 text-sm">
                      {request.materialName} — {request.quantity} {request.unit || ''}
                    </p>
                  )}
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-0.5">Est. Total</p>
                  <p className="font-semibold text-gray-900 text-sm">₹{Number(request.totalAmount || 0).toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-0.5">Site</p>
                  <p className="font-semibold text-gray-900 text-sm">
                    {sites.find(s => s.id === request.siteId)?.name || '—'}
                    {request.buildingId && buildings.find(b => b.id === request.buildingId) && (
                      <span className="text-gray-500 text-xs ml-1">({buildings.find(b => b.id === request.buildingId)?.name})</span>
                    )}
                  </p>
                </div>
                <div className="col-span-2 sm:col-span-1">
                  <p className="text-xs text-gray-500 mb-0.5">Requested By</p>
                  <p className="font-semibold text-gray-900 text-sm truncate max-w-[180px] sm:max-w-none">{request.requestedBy}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-0.5">Request Date</p>
                  <p className="font-semibold text-gray-900 text-sm">{request.requestDate}</p>
                </div>
              </div>

              {request.status === 'arrived' && (
                <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-3 mb-4 flex items-center gap-3">
                  <Package className="w-5 h-5 text-green-600 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-bold text-green-800">Material Arrived & Allocated</p>
                    <p className="text-xs text-green-600 mt-0.5">
                      Delivered to: <span className="font-semibold">{sites.find(s => s.id === request.siteId)?.name || request.siteId}
                        {request.buildingId && buildings.find(b => b.id === request.buildingId) && ` (${buildings.find(b => b.id === request.buildingId)?.name})`}
                      </span>
                      {request.arrivedDate && <span className="ml-2">on {request.arrivedDate}</span>}
                    </p>
                  </div>
                </div>
              )}

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
                    className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-medium"
                  >
                    <CheckCircle className="w-4 h-4 inline mr-2" />
                    Approve
                  </motion.button>
                  {userRole === 'admin' && (
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => handleReject(request.id, request.adminNotes)}
                      className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg font-medium"
                    >
                      <XCircle className="w-4 h-4 inline mr-2" />
                      Reject
                    </motion.button>
                  )}
                </div>
              )}

              {request.status === 'approved' && (
                <div className="flex gap-3 pt-4 border-t border-gray-200">
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => handleArrived(request)}
                    className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg font-medium"
                  >
                    <Package className="w-4 h-4 inline mr-2" />
                    Mark Arrived (Allocate to Site)
                  </motion.button>
                </div>
              )}

              {/* Delete button - Admin only */}
              {userRole === 'admin' && (
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
            <div className="p-5 border-b border-gray-200 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-gray-900">New Purchase Order Request</h2>
                <p className="text-gray-600 mt-0.5 text-sm">Submit a request for materials needed</p>
              </div>
              <button
                onClick={() => setShowCreateModal(false)}
                className="p-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors flex-shrink-0"
              >
                <ArrowLeft className="w-5 h-5 text-gray-600" />
              </button>
            </div>

            <form onSubmit={handleSubmitRequest} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Site *</label>
                <select
                  required
                  value={formData.siteId}
                  onChange={(e) => setFormData({ ...formData, siteId: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">Select site</option>
                  {sites.sort((a, b) => (a.name || '').localeCompare(b.name || '')).map(site => (
                    <option key={site.id} value={site.id}>{site.name}</option>
                  ))}
                </select>
              </div>

              {formData.siteId && buildings.filter(b => b.siteId === formData.siteId).length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Building (Optional)</label>
                  <select
                    value={formData.buildingId}
                    onChange={(e) => setFormData({ ...formData, buildingId: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">Select building</option>
                    {buildings.filter(b => b.siteId === formData.siteId).map(building => (
                      <option key={building.id} value={building.id}>{building.name}</option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <div className="flex items-center justify-between mb-3">
                  <label className="block text-sm font-medium text-gray-700">Material Items *</label>
                  <button
                    type="button"
                    onClick={addItem}
                    className="text-sm text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1"
                  >
                    <Plus className="w-4 h-4" />
                    Add Item
                  </button>
                </div>

                <div className="space-y-3">
                  {formData.items.map((item, index) => (
                    <div key={item.id} className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-sm font-medium text-gray-700">Item {index + 1}</span>
                        {formData.items.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeItem(item.id)}
                            className="text-red-500 hover:text-red-700"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">Material Name *</label>
                          <select
                            required
                            value={item.materialName}
                            onChange={(e) => {
                              const selectedMat = materials.find(m => m.name === e.target.value);
                              updateItem(item.id, 'materialName', e.target.value);
                              if (selectedMat) {
                                updateItem(item.id, 'unit', selectedMat.unit || '');
                              }
                            }}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                          >
                            <option value="">Select item</option>
                            {materials.sort((a, b) => (a.name || '').localeCompare(b.name || '')).map(m => (
                              <option key={m.id} value={m.name}>
                                {m.name} ({m.category === 'tool' ? 'Tool' : 'Material'})
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">Quantity *</label>
                          <input
                            type="number"
                            // min="1"
                            required
                            value={item.quantity}
                            onChange={(e) => updateItem(item.id, 'quantity', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                            placeholder="e.g., 100"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">Unit</label>
                          <input
                            type="text"
                            value={item.unit}
                            onChange={(e) => updateItem(item.id, 'unit', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                            placeholder="e.g., bags"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
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
                <label className="block text-sm font-medium text-gray-700 mb-2">Reason</label>
                <textarea
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

      <StatusModal
        {...statusModal}
        onCancel={() => setStatusModal(prev => ({ ...prev, visible: false }))}
      />
      <InputModal
        {...inputModal}
        type="text"
        placeholder="Enter reason..."
        confirmLabel="Reject"
        onCancel={() => setInputModal(prev => ({ ...prev, visible: false }))}
      />
    </div>
  )
}

export default PORequests