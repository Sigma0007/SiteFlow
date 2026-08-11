import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { 
  Search, 
  Filter, 
  Plus, 
  Edit, 
  Trash2, 
  Eye,
  Calendar,
  Clock,
  CheckCircle,
  AlertCircle,
  MoreVertical
} from 'lucide-react'
import { processServices, convertDocsToArray } from '../services/firebaseServices'

const ProcessTable = ({ siteId, buildingId, userRole = 'admin' }) => {
  const [processes, setProcesses] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterStatus, setFilterStatus] = useState('All')
  const [showProcessModal, setShowProcessModal] = useState(false)
  const [editingProcess, setEditingProcess] = useState(null)
  const [selectedProcess, setSelectedProcess] = useState(null)
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    status: 'active',
    image: ''
  })

  // Load processes from Firebase
  useEffect(() => {
    const loadProcesses = async () => {
      try {
        setLoading(true)
        if (siteId && buildingId) {
          const processesSnapshot = await processServices.getProcessesForBuilding(siteId, buildingId)
          const processesData = convertDocsToArray(processesSnapshot)
          setProcesses(processesData)
        }
      } catch (error) {
        console.error('Error loading processes:', error)
      } finally {
        setLoading(false)
      }
    }

    loadProcesses()
  }, [siteId, buildingId])

  // Set up real-time listener for processes
  useEffect(() => {
    if (siteId && buildingId) {
      const unsubscribe = processServices.onProcessesChange(siteId, buildingId, (snapshot) => {
        setProcesses(convertDocsToArray(snapshot))
      })

      return unsubscribe
    }
  }, [siteId, buildingId])

  const handleAdd = () => {
    setEditingProcess(null)
    setFormData({
      name: '',
      description: '',
      status: 'active',
      image: ''
    })
    setShowProcessModal(true)
  }

  const handleEdit = (process) => {
    setEditingProcess(process)
    setFormData({
      name: process.name,
      description: process.description,
      status: process.status,
      image: process.image || ''
    })
    setShowProcessModal(true)
  }

  const handleDelete = async (processId) => {
    if (window.confirm('Are you sure you want to delete this process?')) {
      try {
        await processServices.deleteProcess(siteId, buildingId, processId)
      } catch (error) {
        console.error('Error deleting process:', error)
        alert('Error deleting process: ' + error.message)
      }
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    try {
      const processData = {
        ...formData,
        siteId,
        buildingId,
        updatedAt: new Date().toISOString()
      }

      if (editingProcess) {
        // Update existing process
        await processServices.updateProcess(siteId, buildingId, editingProcess.id, processData)
      } else {
        // Create new process
        const newProcessData = {
          ...processData,
          createdAt: new Date().toISOString(),
          subProcesses: []
        }
        await processServices.addProcess(siteId, buildingId, newProcessData)
      }

      setShowProcessModal(false)
      setEditingProcess(null)
      setFormData({
        name: '',
        description: '',
        status: 'active',
        image: ''
      })
    } catch (error) {
      console.error('Error saving process:', error)
      alert('Error saving process: ' + error.message)
    }
  }

  const getStatusColor = (status) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-700 border-green-200'
      case 'completed': return 'bg-blue-100 text-blue-700 border-blue-200'
      case 'pending': return 'bg-yellow-100 text-yellow-700 border-yellow-200'
      case 'on-hold': return 'bg-red-100 text-red-700 border-red-200'
      default: return 'bg-gray-100 text-gray-700 border-gray-200'
    }
  }

  const getStatusIcon = (status) => {
    switch (status) {
      case 'active': return <CheckCircle className="w-4 h-4" />
      case 'completed': return <CheckCircle className="w-4 h-4" />
      case 'pending': return <Clock className="w-4 h-4" />
      case 'on-hold': return <AlertCircle className="w-4 h-4" />
      default: return <Clock className="w-4 h-4" />
    }
  }

  const filteredProcesses = processes.filter(process => {
    const matchesSearch = process.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         process.description.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesFilter = filterStatus === 'All' || process.status === filterStatus
    return matchesSearch && matchesFilter
  })

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Processes</h2>
          <p className="text-gray-600 mt-1">Manage construction processes and workflows</p>
        </div>
        {userRole === 'admin' && (
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleAdd}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700"
          >
            <Plus className="w-5 h-5" />
            Add Process
          </motion.button>
        )}
      </div>

      {/* Filters */}
      <div className="card">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search processes..."
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
              <option value="All">All Status</option>
              <option value="active">Active</option>
              <option value="completed">Completed</option>
              <option value="pending">Pending</option>
              <option value="on-hold">On Hold</option>
            </select>
          </div>
        </div>
      </div>

      {/* Processes Table */}
      <div className="card">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            <span className="ml-3 text-gray-600">Loading processes...</span>
          </div>
        ) : filteredProcesses.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-gray-400 mb-4">
              <Calendar className="w-12 h-12 mx-auto" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No processes found</h3>
            <p className="text-gray-600">
              {searchTerm || filterStatus !== 'All' 
                ? 'Try adjusting your search or filters' 
                : 'Get started by adding your first process'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 font-semibold text-gray-900">Process Name</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-900">Description</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-900">Status</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-900">Created</th>
                  <th className="text-right py-3 px-4 font-semibold text-gray-900">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredProcesses.map((process, index) => (
                  <motion.tr
                    key={process.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className="border-b border-gray-100 hover:bg-gray-50"
                  >
                    <td className="py-3 px-4">
                      <div className="font-medium text-gray-900">{process.name}</div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="text-sm text-gray-600 max-w-xs truncate">{process.description}</div>
                    </td>
                    <td className="py-3 px-4">
                      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium border ${getStatusColor(process.status)}`}>
                        {getStatusIcon(process.status)}
                        {process.status}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <div className="text-sm text-gray-600">
                        {process.createdAt ? new Date(process.createdAt).toLocaleDateString() : 'N/A'}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center justify-end gap-2">
                        <motion.button
                          whileHover={{ scale: 1.1 }}
                          whileTap={{ scale: 0.9 }}
                          onClick={() => setSelectedProcess(process)}
                          className="p-1 text-gray-600 hover:text-blue-600"
                          title="View Details"
                        >
                          <Eye className="w-4 h-4" />
                        </motion.button>
                        {userRole === 'admin' && (
                          <>
                            <motion.button
                              whileHover={{ scale: 1.1 }}
                              whileTap={{ scale: 0.9 }}
                              onClick={() => handleEdit(process)}
                              className="p-1 text-gray-600 hover:text-blue-600"
                              title="Edit Process"
                            >
                              <Edit className="w-4 h-4" />
                            </motion.button>
                            <motion.button
                              whileHover={{ scale: 1.1 }}
                              whileTap={{ scale: 0.9 }}
                              onClick={() => handleDelete(process.id)}
                              className="p-1 text-gray-600 hover:text-red-600"
                              title="Delete Process"
                            >
                              <Trash2 className="w-4 h-4" />
                            </motion.button>
                          </>
                        )}
                      </div>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Process Modal */}
      {showProcessModal && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
          onClick={() => setShowProcessModal(false)}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-xl shadow-2xl w-full max-w-md"
          >
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-xl font-bold text-gray-900">
                {editingProcess ? 'Edit Process' : 'Add New Process'}
              </h3>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Process Name
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="input-field"
                  placeholder="Enter process name"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  required
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="input-field"
                  rows={3}
                  placeholder="Enter process description"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Status
                </label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                  className="input-field"
                >
                  <option value="active">Active</option>
                  <option value="completed">Completed</option>
                  <option value="pending">Pending</option>
                  <option value="on-hold">On Hold</option>
                </select>
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowProcessModal(false)}
                  className="px-4 py-2 text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  {editingProcess ? 'Update Process' : 'Add Process'}
                </button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}

      {/* Process Details Modal */}
      {selectedProcess && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
          onClick={() => setSelectedProcess(null)}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-xl shadow-2xl w-full max-w-md"
          >
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-xl font-bold text-gray-900">Process Details</h3>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <h4 className="font-semibold text-gray-900">{selectedProcess.name}</h4>
                <p className="text-gray-600 mt-1">{selectedProcess.description}</p>
              </div>

              <div className="flex items-center gap-2">
                <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium border ${getStatusColor(selectedProcess.status)}`}>
                  {getStatusIcon(selectedProcess.status)}
                  {selectedProcess.status}
                </span>
              </div>

              <div className="text-sm text-gray-600">
                <p>Created: {selectedProcess.createdAt ? new Date(selectedProcess.createdAt).toLocaleDateString() : 'N/A'}</p>
                <p>Updated: {selectedProcess.updatedAt ? new Date(selectedProcess.updatedAt).toLocaleDateString() : 'N/A'}</p>
              </div>

              <div className="flex justify-end pt-4">
                <button
                  onClick={() => setSelectedProcess(null)}
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
                >
                  Close
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </div>
  )
}

export default ProcessTable
