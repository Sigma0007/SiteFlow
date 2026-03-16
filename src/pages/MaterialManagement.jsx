import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Package, Plus, TrendingDown, AlertTriangle, FileText, CheckCircle, Clock, XCircle, Edit2, Trash2 } from 'lucide-react'
import { materialServices, purchaseOrderServices, siteServices, convertDocsToArray } from '../services/firebaseServices'
import Footer from '../components/Footer'
import { auth } from '../firebase'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'

const MaterialManagement = ({ userRole }) => {
  const navigate = useNavigate()
  const [materials, setMaterials] = useState([])
  const [purchaseOrders, setPurchaseOrders] = useState([])
  const [sites, setSites] = useState([])
  const [activeTab, setActiveTab] = useState('materials')
  const [showPOModal, setShowPOModal] = useState(false)
  const [showMaterialModal, setShowMaterialModal] = useState(false)
  const [editingMaterial, setEditingMaterial] = useState(null)
  const [loading, setLoading] = useState(true)
  const [poFormData, setPoFormData] = useState({
    siteId: '',
    materialId: '',
    quantity: '',
    supplier: '',
    expectedDate: ''
  })
  const [materialForm, setMaterialForm] = useState({
    name: '',
    category: 'material',
    unit: '',
    currentStock: 0,
    unitPrice: 0,
    description: '',
    location: 'godown',
    lastIssued: null,
    condition: 'good'
  })

  // Dynamic categories - will be updated from materials
  const [categories, setCategories] = useState([
    { value: 'material', label: 'Materials', description: 'Raw materials and supplies' },
    { value: 'tool-durable', label: 'Durable Tools', description: 'Long-lasting tools (drills, saws, etc.)' },
    { value: 'tool-consumable', label: 'Consumable Tools', description: 'Single-use tools (blades, bits, etc.)' }
  ])

  // Extract unique categories from materials and merge with default categories
  useEffect(() => {
    const uniqueCategories = new Set(categories.map(cat => cat.value))

    materials.forEach(material => {
      if (material.category && !uniqueCategories.has(material.category)) {
        uniqueCategories.add(material.category)
        // Add new category to the list
        setCategories(prev => [...prev, {
          value: material.category,
          label: material.category.charAt(0).toUpperCase() + material.category.slice(1),
          description: `Custom category: ${material.category}`
        }])
      }
    })
  }, [materials])

  // Tool conditions for durable tools
  const toolConditions = [
    { value: 'excellent', label: 'Excellent', color: 'text-green-600' },
    { value: 'good', label: 'Good', color: 'text-blue-600' },
    { value: 'fair', label: 'Fair', color: 'text-yellow-600' },
    { value: 'poor', label: 'Poor', color: 'text-red-600' }
  ]

  // Storage locations
  const storageLocations = [
    { value: 'godown', label: 'Godown' },
    { value: 'site', label: 'On Site' },
    { value: 'workshop', label: 'Workshop' },
    { value: 'vehicle', label: 'Vehicle' }
  ]

  // Load materials and purchase orders from Firebase on component mount
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true)

        // Load materials
        const materialsSnapshot = await materialServices.getAllMaterials()
        setMaterials(convertDocsToArray(materialsSnapshot))

        // Load purchase orders
        const purchaseOrdersSnapshot = await purchaseOrderServices.getAllPurchaseOrders()
        setPurchaseOrders(convertDocsToArray(purchaseOrdersSnapshot))

        // Load sites (purchaseOrders require siteId)
        const sitesSnapshot = userRole === 'supervisor' ? await siteServices.getSitesForSupervisor(auth.currentUser?.uid) : await siteServices.getAllSites()
        setSites(convertDocsToArray(sitesSnapshot))

      } catch (error) {
        console.error('Error loading data:', error)
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [])

  // Set up real-time listeners
  useEffect(() => {
    const unsubscribeMaterials = materialServices.onMaterialsChange((snapshot) => {
      setMaterials(convertDocsToArray(snapshot))
    })

    const unsubscribePurchaseOrders = purchaseOrderServices.onPurchaseOrdersChange((snapshot) => {
      setPurchaseOrders(convertDocsToArray(snapshot))
    })

    return () => {
      unsubscribeMaterials()
      unsubscribePurchaseOrders()
    }
  }, [])

  const handleAddMaterial = () => {
    setEditingMaterial(null)
    setMaterialForm({
      name: '',
      category: 'material',
      unit: '',
      currentStock: 0,
      unitPrice: 0,
      description: '',
      location: 'godown',
      lastIssued: null,
      condition: 'good'
    })
    setShowMaterialModal(true)
  }

  const handleEditMaterial = (material) => {
    setEditingMaterial(material)
    setMaterialForm(material)
    setShowMaterialModal(true)
  }

  const handleDeleteMaterial = async (id) => {
    if (window.confirm('Are you sure you want to delete this material?')) {
      try {
        await materialServices.deleteMaterial(id)
      } catch (error) {
        console.error('Error deleting material:', error)
      }
    }
  }

  const handleMaterialSubmit = async (e) => {
    e.preventDefault()

    try {
      const materialData = {
        ...materialForm,
        currentStock: parseInt(materialForm.currentStock) || 0,
        unitPrice: parseFloat(materialForm.unitPrice) || 0,
        createdAt: new Date().toISOString()
      }

      if (editingMaterial) {
        await materialServices.updateMaterial(editingMaterial.id, materialData)
      } else {
        await materialServices.addMaterial(materialData)
      }

      setShowMaterialModal(false)
      setMaterialForm({
        name: '',
        category: 'material',
        unit: '',
        currentStock: 0,
        unitPrice: 0,
        description: '',
        location: 'godown',
        lastIssued: null,
        condition: 'good'
      })
      setEditingMaterial(null)
    } catch (error) {
      console.error('Error saving material:', error)
    }
  }

  const handleCreatePO = async (e) => {
    e.preventDefault()
    const material = materials.find(m => m.id === poFormData.materialId)
    if (!material) return

    try {
      const poData = {
        poNumber: `PO-${Date.now()}`,
        siteId: poFormData.siteId,
        materialName: material.name,
        materialId: material.id,
        quantity: parseInt(poFormData.quantity),
        unit: material.unit || '',
        supplier: poFormData.supplier,
        orderDate: new Date().toISOString().split('T')[0],
        expectedDate: poFormData.expectedDate,
        status: 'Pending',
        totalAmount: material.unitPrice * parseInt(poFormData.quantity),
        requestedBy: userRole || '',
        approvedBy: '',
        createdAt: new Date().toISOString()
      }

      await purchaseOrderServices.addPurchaseOrder(poData)
      setShowPOModal(false)
      setPoFormData({ siteId: '', materialId: '', quantity: '', supplier: '', expectedDate: '' })
    } catch (error) {
      console.error('Error creating purchase order:', error)
    }
  }

  const handlePOStatusUpdate = async (poId, newStatus) => {
    try {
      const po = purchaseOrders.find(p => p.id === poId)
      if (!po) return

      await purchaseOrderServices.updatePurchaseOrder(poId, {
        status: newStatus,
        updatedAt: new Date().toISOString()
      })

      // If PO is marked as received, update material stock
      if (newStatus === 'Received') {
        const material = materials.find(m => m.id === po.materialId)
        if (material) {
          const updatedStock = material.currentStock + po.quantity
          await materialServices.updateMaterial(material.id, {
            currentStock: updatedStock,
            updatedAt: new Date().toISOString()
          })
        }
      }
    } catch (error) {
      console.error('Error updating purchase order status:', error)
    }
  }

  const handleDeletePO = async (poId) => {
    if (window.confirm('Are you sure you want to delete this purchase order? This action cannot be undone.')) {
      try {
        await purchaseOrderServices.deletePurchaseOrder(poId)
      } catch (error) {
        console.error('Error deleting purchase order:', error)
      }
    }
  }

  const getStockStatus = (material) => {
    if (material.currentStock === 0) {
      return { label: 'Out of Stock', color: 'bg-red-100 text-red-700 border-red-200' }
    } else if (material.currentStock <= 5) {
      return { label: 'Low', color: 'bg-yellow-100 text-yellow-700 border-yellow-200' }
    }
    return { label: 'Available', color: 'bg-green-100 text-green-700 border-green-200' }
  }

  const getPOStatusColor = (status) => {
    switch (status) {
      case 'Pending': return 'bg-yellow-100 text-yellow-700 border-yellow-200'
      case 'Approved': return 'bg-blue-100 text-blue-700 border-blue-200'
      case 'Received': return 'bg-green-100 text-green-700 border-green-200'
      case 'Cancelled': return 'bg-red-100 text-red-700 border-red-200'
      default: return 'bg-gray-100 text-gray-700 border-gray-200'
    }
  }

  const getPOStatusIcon = (status) => {
    switch (status) {
      case 'Pending': return Clock
      case 'Approved': return CheckCircle
      case 'Received': return Package
      case 'Cancelled': return XCircle
      default: return FileText
    }
  }

  const lowStockMaterials = materials.filter(m => m.currentStock <= 5)

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 min-h-screen bg-gray-50">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
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
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 flex items-center gap-2">
              <Package className="w-10 h-10 text-blue-600" />
              Inventory & Materials
            </h1>
            <p className="text-gray-600 mt-1">Manage stock and purchase orders</p>
          </div>
        </div>
        {(userRole === 'admin' || (userRole === 'supervisor' && true)) && (
          <div className="flex gap-3">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setShowMaterialModal(true)}
              className="btn-secondary flex items-center justify-center gap-2 w-full sm:w-auto"
            >
              <Plus className="w-5 h-5" />
              <span className="hidden sm:inline">Add Material</span>
              <span className="sm:hidden">Add</span>
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setShowPOModal(true)}
              className="btn-primary flex items-center justify-center gap-2 w-full sm:w-auto"
            >
              <Plus className="w-5 h-5" />
              <span className="hidden sm:inline">Create PO</span>
              <span className="sm:hidden">PO</span>
            </motion.button>
          </div>
        )}
      </div>

      {lowStockMaterials.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 sm:p-4 flex flex-col sm:flex-row sm:items-start gap-3"
        >
          <AlertTriangle className="w-5 h-5 sm:w-6 sm:h-6 text-yellow-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <h3 className="font-semibold text-yellow-900 mb-1 text-sm sm:text-base">Low Stock Alert</h3>
            <p className="text-xs sm:text-sm text-yellow-700">
              {lowStockMaterials.length} material(s) are running low on stock. Consider creating purchase orders.
            </p>
            <div className="flex flex-wrap gap-1 sm:gap-2 mt-2">
              {lowStockMaterials.map(m => (
                <span key={m.id} className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded">
                  {m.name}
                </span>
              ))}
            </div>
          </div>
        </motion.div>
      )}

      <div className="card">
        <div className="flex border-b border-gray-200 mb-6">
          <button
            onClick={() => setActiveTab('materials')}
            className={`px-6 py-3 font-medium transition-colors ${activeTab === 'materials'
              ? 'text-primary border-b-2 border-primary'
              : 'text-gray-600 hover:text-gray-900'
              }`}
          >
            Materials Inventory
          </button>
          <button
            onClick={() => setActiveTab('purchase-orders')}
            className={`px-6 py-3 font-medium transition-colors ${activeTab === 'purchase-orders'
              ? 'text-primary border-b-2 border-primary'
              : 'text-gray-600 hover:text-gray-900'
              }`}
          >
            Purchase Orders
          </button>
        </div>

        {activeTab === 'materials' && (
          <>
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                <span className="ml-3 text-gray-600">Loading materials...</span>
              </div>
            ) : (
              <div className="overflow-x-auto -mx-4 sm:mx-0">
                <table className="w-full min-w-[600px] sm:min-w-0">
                  <thead>
                    <tr className="bg-gray-50">
                      <th className="text-left py-3 px-2 sm:px-4 font-semibold text-gray-700 text-xs sm:text-sm">Name</th>
                      <th className="text-left py-3 px-2 sm:px-4 font-semibold text-gray-700 text-xs sm:text-sm hidden sm:table-cell">Category</th>
                      <th className="text-left py-3 px-2 sm:px-4 font-semibold text-gray-700 text-xs sm:text-sm hidden md:table-cell">Unit</th>
                      <th className="text-left py-3 px-2 sm:px-4 font-semibold text-gray-700 text-xs sm:text-sm">Stock</th>
                      <th className="text-left py-3 px-2 sm:px-4 font-semibold text-gray-700 text-xs sm:text-sm">Allocated to Sites</th>
                      <th className="text-left py-3 px-2 sm:px-4 font-semibold text-gray-700 text-xs sm:text-sm hidden lg:table-cell">Price</th>
                      <th className="text-left py-3 px-2 sm:px-4 font-semibold text-gray-700 text-xs sm:text-sm">Status</th>
                      {(userRole === 'admin' || userRole === 'manager') && (
                        <th className="text-left py-3 px-2 sm:px-4 font-semibold text-gray-700 text-xs sm:text-sm">Actions</th>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {materials.map((material, index) => {
                      const stockStatus = getStockStatus(material)
                      return (
                        <motion.tr
                          key={material.id}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: index * 0.05 }}
                          className="border-t border-gray-200 hover:bg-gray-50"
                        >
                          <td className="py-3 px-2 sm:px-4">
                            <div className="flex flex-col sm:block">
                              <span className="font-medium text-gray-900 text-sm sm:text-base">{material.name}</span>
                              <span className="text-xs text-gray-600 sm:hidden">{material.category}</span>
                            </div>
                          </td>
                          <td className="py-3 px-2 sm:px-4 text-gray-600 hidden sm:table-cell text-sm">{material.category}</td>
                          <td className="py-3 px-2 sm:px-4 text-gray-600 hidden md:table-cell text-sm">{material.unit}</td>
                          <td className="py-3 px-2 sm:px-4">
                            <span className={`font-semibold text-sm ${material.currentStock <= 5 ? 'text-red-600' : 'text-gray-900'
                              }`}>
                              {material.currentStock}
                            </span>
                          </td>
                          <td className="py-3 px-2 sm:px-4 text-xs">
                            {(() => {
                              const allocations = sites.reduce((acc, site) => {
                                const sm = (site.assignedMaterials || []).find(m => m.materialId === material.id);
                                if (sm && sm.quantity > 0) acc.push(`${site.name}: ${sm.quantity}`);
                                return acc;
                              }, []);
                              return allocations.length > 0 ? (
                                <div className="space-y-1">
                                  {allocations.map((a, i) => <div key={i} className="text-indigo-600 bg-indigo-50 inline-block px-1.5 py-0.5 rounded mr-1 mb-1">{a}</div>)}
                                </div>
                              ) : <span className="text-gray-400">Not allocated</span>;
                            })()}
                          </td>
                          <td className="py-3 px-2 sm:px-4 text-gray-900 hidden lg:table-cell text-sm">₹{material.unitPrice}</td>
                          <td className="py-3 px-2 sm:px-4">
                            <span className={`badge border text-xs ${stockStatus.color}`}>
                              {stockStatus.label}
                            </span>
                          </td>
                          {(userRole === 'admin' || userRole === 'manager') && (
                            <td className="py-3 px-2 sm:px-4">
                              <div className="flex gap-1 sm:gap-2">
                                <motion.button
                                  whileHover={{ scale: 1.05 }}
                                  whileTap={{ scale: 0.95 }}
                                  onClick={() => handleEditMaterial(material)}
                                  className="text-blue-600 hover:text-blue-800 p-1"
                                >
                                  <Edit2 className="w-4 h-4" />
                                </motion.button>
                                <motion.button
                                  whileHover={{ scale: 1.05 }}
                                  whileTap={{ scale: 0.95 }}
                                  onClick={() => handleDeleteMaterial(material.id)}
                                  className="text-red-600 hover:text-red-800 p-1"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </motion.button>
                              </div>
                            </td>
                          )}
                        </motion.tr>
                      )
                    })}
                  </tbody>
                </table>
                {materials.length === 0 && (
                  <div className="text-center py-12">
                    <p className="text-gray-500 text-lg">No materials found. Add your first material to get started.</p>
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {activeTab === 'purchase-orders' && (
          <div className="space-y-4">
            {purchaseOrders.map((po, index) => {
              const StatusIcon = getPOStatusIcon(po.status)
              return (
                <motion.div
                  key={po.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-start gap-3">
                      <div className="p-2 bg-primary/10 rounded-lg">
                        <StatusIcon className="w-6 h-6 text-primary" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-900 text-lg">{po.poNumber}</h3>
                        <p className="text-gray-600">{po.materialName}</p>
                      </div>
                    </div>
                    <span className={`badge border ${getPOStatusColor(po.status)}`}>
                      {po.status}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                    <div>
                      <p className="text-sm text-gray-600 mb-1">Quantity</p>
                      <p className="font-semibold text-gray-900">{po.quantity}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600 mb-1">Supplier</p>
                      <p className="font-semibold text-gray-900">{po.supplier}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600 mb-1">Order Date</p>
                      <p className="font-semibold text-gray-900">{po.orderDate}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600 mb-1">Expected Date</p>
                      <p className="font-semibold text-gray-900">{po.expectedDate}</p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-3 border-t border-gray-200">
                    <div>
                      <p className="text-sm text-gray-600">Total Amount</p>
                      <p className="text-xl font-bold text-primary">₹{po.totalAmount.toLocaleString()}</p>
                    </div>
                    {(userRole === 'admin' || userRole === 'manager') && po.status !== 'Received' && po.status !== 'Cancelled' && (
                      <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 mt-3 sm:mt-0">
                        {po.status === 'Pending' && (
                          <motion.button
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={() => handlePOStatusUpdate(po.id, 'Approved')}
                            className="flex-1 sm:flex-initial px-3 py-2 sm:px-4 sm:py-2.5 bg-green-500 hover:bg-green-600 text-white rounded-lg font-medium text-xs sm:text-sm transition-colors min-w-[80px] sm:min-w-[90px] whitespace-nowrap"
                          >
                            Approve
                          </motion.button>
                        )}
                        {po.status === 'Approved' && (
                          <motion.button
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={() => handlePOStatusUpdate(po.id, 'Received')}
                            className="flex-1 sm:flex-initial px-3 py-2 sm:px-4 sm:py-2.5 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-medium text-xs sm:text-sm transition-colors min-w-[80px] sm:min-w-[90px] whitespace-nowrap"
                          >
                            Mark as Received
                          </motion.button>
                        )}
                        <motion.button
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => handlePOStatusUpdate(po.id, 'Cancelled')}
                          className="flex-1 sm:flex-initial px-3 py-2 sm:px-4 sm:py-2.5 bg-gray-500 hover:bg-gray-600 text-white rounded-lg font-medium text-xs sm:text-sm transition-colors min-w-[80px] sm:min-w-[90px] whitespace-nowrap"
                        >
                          Cancel
                        </motion.button>
                        <motion.button
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => handleDeletePO(po.id)}
                          className="flex-1 sm:flex-initial px-3 py-2 sm:px-4 sm:py-2.5 bg-red-500 hover:bg-red-600 text-white rounded-lg font-medium text-xs sm:text-sm transition-colors min-w-[80px] sm:min-w-[90px] whitespace-nowrap"
                        >
                          Delete
                        </motion.button>
                      </div>
                    )}
                  </div>
                </motion.div>
              )
            })}
          </div>
        )}
      </div>

      <AnimatePresence>
        {showPOModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
            onClick={() => setShowPOModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-xl shadow-2xl w-full max-w-md"
            >
              <div className="p-6 border-b border-gray-200">
                <h2 className="text-2xl font-bold text-gray-900">Create Purchase Order</h2>
              </div>

              <form onSubmit={handleCreatePO} className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Site *</label>
                  <select
                    required
                    value={poFormData.siteId}
                    onChange={(e) => setPoFormData({ ...poFormData, siteId: e.target.value })}
                    className="input-field"
                  >
                    <option value="">Select site</option>
                    {sites.map(s => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Material *</label>
                  <select
                    required
                    value={poFormData.materialId}
                    onChange={(e) => setPoFormData({ ...poFormData, materialId: e.target.value })}
                    className="input-field"
                  >
                    <option value="">Select material</option>
                    {materials.map(m => (
                      <option key={m.id} value={m.id}>
                        {m.name} (Stock: {m.currentStock} {m.unit})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Quantity *</label>
                  <input
                    type="number"
                    required
                    min="1"
                    value={poFormData.quantity}
                    onChange={(e) => setPoFormData({ ...poFormData, quantity: e.target.value })}
                    className="input-field"
                    placeholder="Enter quantity"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Supplier *</label>
                  <input
                    type="text"
                    required
                    value={poFormData.supplier}
                    onChange={(e) => setPoFormData({ ...poFormData, supplier: e.target.value })}
                    className="input-field"
                    placeholder="Enter supplier name"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Expected Delivery Date *</label>
                  <input
                    type="date"
                    required
                    value={poFormData.expectedDate}
                    onChange={(e) => setPoFormData({ ...poFormData, expectedDate: e.target.value })}
                    className="input-field"
                  />
                </div>

                <div className="flex gap-3 pt-4">
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    type="submit"
                    className="flex-1 btn-primary py-3"
                  >
                    Create PO
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    type="button"
                    onClick={() => setShowPOModal(false)}
                    className="flex-1 btn-outline py-3"
                  >
                    Cancel
                  </motion.button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showMaterialModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
            onClick={() => setShowMaterialModal(false)}
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
                  {editingMaterial ? 'Edit Material' : 'Add New Material'}
                </h2>
              </div>

              <form onSubmit={handleMaterialSubmit} className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Material Name *</label>
                  <input
                    type="text"
                    required
                    value={materialForm.name}
                    onChange={(e) => setMaterialForm({ ...materialForm, name: e.target.value })}
                    className="input-field"
                    placeholder="Enter material name"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Category *</label>
                  <input
                    type="text"
                    required
                    value={materialForm.category}
                    onChange={(e) => setMaterialForm({ ...materialForm, category: e.target.value })}
                    className="input-field"
                    placeholder="Enter category (e.g., material, tool-durable, tool-consumable)"
                    list="categories-list"
                  />
                  <datalist id="categories-list">
                    {categories.map(cat => (
                      <option key={cat.value} value={cat.value}>
                        {cat.label} - {cat.description}
                      </option>
                    ))}
                  </datalist>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Unit *</label>
                  <select
                    required
                    value={materialForm.unit}
                    onChange={(e) => setMaterialForm({ ...materialForm, unit: e.target.value })}
                    className="input-field"
                  >
                    <option value="">Select unit</option>
                    <option>kg</option>
                    <option>tons</option>
                    <option>bags</option>
                    <option>cubic meters</option>
                    <option>liters</option>
                    <option>meters</option>
                    <option>pieces</option>
                    <option>boxes</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Current Stock *</label>
                    <input
                      type="number"
                      required
                      min="0"
                      value={materialForm.currentStock}
                      onChange={(e) => setMaterialForm({ ...materialForm, currentStock: e.target.value })}
                      className="input-field"
                      placeholder="0"
                    />
                  </div>

                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Unit Price (₹) *</label>
                  <input
                    type="number"
                    required
                    min="0"
                    step="0.01"
                    value={materialForm.unitPrice}
                    onChange={(e) => setMaterialForm({ ...materialForm, unitPrice: e.target.value })}
                    className="input-field"
                    placeholder="0.00"
                  />
                </div>

                <div className="flex gap-3 pt-4">
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    type="submit"
                    className="flex-1 btn-primary py-3"
                  >
                    {editingMaterial ? 'Update Material' : 'Add Material'}
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    type="button"
                    onClick={() => setShowMaterialModal(false)}
                    className="flex-1 btn-outline py-3"
                  >
                    Cancel
                  </motion.button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <Footer />
    </div>
  )
}

export default MaterialManagement