import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { FileText, Download, Calendar, TrendingUp, Users, Package, DollarSign, Filter, Building2, ArrowLeft } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { labourServices, attendanceServices, materialServices, siteServices, purchaseOrderServices, convertDocsToArray } from '../services/firebaseServices'
import Footer from '../components/Footer'
import { auth } from '../firebase'

const Reports = ({ userRole }) => {
  const navigate = useNavigate()
  const [selectedReport, setSelectedReport] = useState('attendance')
  const [dateRange, setDateRange] = useState({
    start: '2024-01-01',
    end: '2024-01-31'
  })
  const [selectedSite, setSelectedSite] = useState('All')
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth())
  const [selectedYear, setSelectedYear] = useState(2026)
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0])
  const [dateViewMode, setDateViewMode] = useState('monthly') // 'monthly' or 'single'
  const [labourList, setLabourList] = useState([])
  const [attendanceRecords, setAttendanceRecords] = useState([])
  const [materials, setMaterials] = useState([])
  const [sites, setSites] = useState([])
  const [purchaseOrders, setPurchaseOrders] = useState([])
  const [loading, setLoading] = useState(true)

  // Load real-time data from Firebase
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true)

        // Load labour data
        const labourSnapshot = await labourServices.getAllLabour()
        setLabourList(convertDocsToArray(labourSnapshot))

        // Load material data
        const materialSnapshot = await materialServices.getAllMaterials()
        setMaterials(convertDocsToArray(materialSnapshot))

        // Load sites data
        const sitesSnapshot = userRole === 'supervisor' ? await siteServices.getSitesForSupervisor(auth.currentUser?.uid) : await siteServices.getAllSites()
        setSites(convertDocsToArray(sitesSnapshot))

        // Load purchase orders data
        const poSnapshot = await purchaseOrderServices.getAllPurchaseOrders()
        setPurchaseOrders(convertDocsToArray(poSnapshot))

        // Load attendance data based on view mode
        let attendanceSnapshot
        if (dateViewMode === 'monthly') {
          attendanceSnapshot = await attendanceServices.getAttendanceByMonth(selectedMonth, selectedYear)
        } else {
          attendanceSnapshot = await attendanceServices.getAttendanceByDate(selectedDate)
        }
        setAttendanceRecords(convertDocsToArray(attendanceSnapshot))
      } catch (error) {
        console.error('Error loading report data:', error)
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [selectedMonth, selectedYear, selectedDate, dateViewMode])

  const reportTypes = [
    { id: 'sites', name: 'Total Sites Report', icon: Building2, color: 'bg-blue-500' },
    { id: 'attendance', name: 'Attendance Report', icon: Users, color: 'bg-green-500' },
    { id: 'material', name: 'Material Usage Report', icon: Package, color: 'bg-purple-500' }
  ]

  const generateSiteProgressData = () => {
    const filteredSites = selectedSite === 'All' ? sites : sites.filter(s => s.name === selectedSite)
    return filteredSites.map(site => ({
      site: site.name,
      progress: site.progress,
      status: site.status,
      startDate: site.startDate,
      endDate: site.endDate
    }))
  }

  const generateAttendanceData = () => {
    return attendanceRecords.map(record => ({
      date: record.date,
      labourName: labourList.find(l => l.id === record.employeeId)?.name || 'Unknown',
      status: record.status,
      siteName: sites.find(s => s.id === record.siteId)?.name || 'Unknown Site'
    }))
  }

  const generateMaterialData = () => {
    return materials.map(material => ({
      name: material.name,
      category: material.category,
      currentStock: material.currentStock,
      unitPrice: material.unitPrice,
      totalValue: material.currentStock * material.unitPrice
    }))
  }

  const generateFinancialData = () => {
    const totalBudget = sites.reduce((sum, s) => sum + s.budget, 0)
    const totalPOAmount = purchaseOrders.reduce((sum, po) => sum + po.totalAmount, 0)
    const totalLabourCost = labourList.reduce((sum, l) => {
      const presentDays = attendanceRecords.filter(r => r.employeeId === l.id && String(r.status || '').toLowerCase() === 'present').length
      return sum + (presentDays * (l.dailyWage || 0))
    }, 0)
    const materialValue = materials.reduce((sum, m) => sum + (m.currentStock * m.unitPrice), 0)

    return {
      totalBudget,
      totalPOAmount,
      totalLabourCost,
      materialValue,
      profit: totalBudget - totalLabourCost - materialValue
    }
  }

  const exportToCSV = (data, filename) => {
    const csv = [
      Object.keys(data[0]).join(','),
      ...data.map(row => Object.values(row).join(','))
    ].join('\n')

    const blob = new Blob([csv], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    window.URL.revokeObjectURL(url)
  }

  const exportSitesReport = () => {
    const sitesData = generateSiteProgressData()
    const exportData = sitesData.map(site => ({
      'Site Name': site.site,
      'Progress (%)': site.progress,
      'Status': site.status,
      'Start Date': site.startDate,
      'End Date': site.endDate
    }))

    const filename = `Total_Sites_Report_${new Date().toISOString().split('T')[0]}.csv`
    exportToCSV(exportData, filename)
  }

  const exportAttendanceReport = () => {
    const attendanceData = generateAttendanceData()
    const exportData = attendanceData.map(record => ({
      'Date': record.date,
      'Labour Name': record.labourName,
      'Status': record.status,
      'Site': record.siteName
    }))

    const filename = `Attendance_Report_${new Date().toISOString().split('T')[0]}.csv`
    exportToCSV(exportData, filename)
  }

  const exportMaterialReport = () => {
    const materialData = generateMaterialData()
    const exportData = materialData.map(material => ({
      'Material Name': material.name,
      'Category': material.category,
      'Current Stock': material.currentStock,
      'Unit Price': material.unitPrice,
      'Total Value': material.totalValue
    }))

    const filename = `Material_Usage_Report_${new Date().toISOString().split('T')[0]}.csv`
    exportToCSV(exportData, filename)
  }

  const handleExportReport = () => {
    switch (selectedReport) {
      case 'sites':
        exportSitesReport()
        break
      case 'attendance':
        exportAttendanceReport()
        break
      case 'material':
        exportMaterialReport()
        break
    }
  }

  const generateReport = () => {
    switch (selectedReport) {
      case 'sites':
        if (loading) {
          return (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          )
        }

        const sitesData = generateSiteProgressData()
        return (
          <div>
            <div className="overflow-x-auto mb-6">
              <table className="min-w-full bg-white rounded-lg shadow">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Site Name</th>
                    <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Progress</th>
                    <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Start Date</th>
                    <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">End Date</th>
                  </tr>
                </thead>
                <tbody>
                  {sitesData.map((site, index) => (
                    <tr key={index} className="border-t border-gray-200">
                      <td className="py-3 px-4 font-medium text-gray-900">{site.site}</td>
                      <td className="py-3 px-4">{site.progress}%</td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-1 text-xs rounded-full ${site.status === 'Active' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                          }`}>
                          {site.status}
                        </span>
                      </td>
                      <td className="py-3 px-4">{site.startDate}</td>
                      <td className="py-3 px-4">{site.endDate}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex justify-end">
              <button
                onClick={exportSitesReport}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                <Download className="w-4 h-4" />
                Export Sites Report
              </button>
            </div>
          </div>
        )

      case 'attendance':
        if (loading) {
          return (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          )
        }

        const attendanceData = generateAttendanceData()
        return (
          <div>
            <div className="overflow-x-auto mb-6">
              <table className="min-w-full bg-white rounded-lg shadow">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                    <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Labour Name</th>
                    <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Site</th>
                  </tr>
                </thead>
                <tbody>
                  {attendanceData.map((record, index) => (
                    <tr key={index} className="border-t border-gray-200">
                      <td className="py-3 px-4">{record.date}</td>
                      <td className="py-3 px-4">{record.labourName}</td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-1 text-xs rounded-full ${record.status === 'Present' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                          }`}>
                          {record.status}
                        </span>
                      </td>
                      <td className="py-3 px-4">{record.siteName}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex justify-end">
              <button
                onClick={exportAttendanceReport}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                <Download className="w-4 h-4" />
                Export Attendance Report
              </button>
            </div>
          </div>
        )

      case 'material':
        if (loading) {
          return (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          )
        }

        const materialData = generateMaterialData()
        return (
          <div>
            <div className="overflow-x-auto mb-6">
              <table className="min-w-full bg-white rounded-lg shadow">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Material Name</th>
                    <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Category</th>
                    <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Current Stock</th>
                    <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Unit Price</th>
                    <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total Value</th>
                  </tr>
                </thead>
                <tbody>
                  {materialData.map((material, index) => (
                    <tr key={index} className="border-t border-gray-200">
                      <td className="py-3 px-4 font-medium text-gray-900">{material.name}</td>
                      <td className="py-3 px-4">{material.category}</td>
                      <td className="py-3 px-4">{material.currentStock}</td>
                      <td className="py-3 px-4">${material.unitPrice}</td>
                      <td className="py-3 px-4">${material.totalValue}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex justify-end">
              <button
                onClick={exportMaterialReport}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                <Download className="w-4 h-4" />
                Export Material Report
              </button>
            </div>
          </div>
        )

      default:
        return <div>Select a report type</div>
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        <div className="mb-8 flex items-center gap-4">
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => navigate('/dashboard')}
            className="p-2 bg-white rounded-lg shadow-sm border border-gray-200 text-gray-600 hover:text-blue-600 transition-colors"
          >
            <ArrowLeft className="w-6 h-6" />
          </motion.button>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Reports</h1>
            <p className="mt-2 text-gray-600">Generate and export various reports for your construction sites.</p>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            {reportTypes.map((type) => (
              <button
                key={type.id}
                onClick={() => setSelectedReport(type.id)}
                className={`p-4 rounded-lg border-2 transition-all ${selectedReport === type.id
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300'
                  }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${type.color}`}>
                    <type.icon className="w-6 h-6 text-white" />
                  </div>
                  <div className="text-left">
                    <div className="font-medium text-gray-900">{type.name}</div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          {generateReport()}
        </motion.div>
      </div>

      <Footer />
    </div>
  )
}

export default Reports
