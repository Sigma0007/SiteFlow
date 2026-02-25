import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { FileText, Download, Calendar, TrendingUp, Users, Package, DollarSign, Filter, Building2 } from 'lucide-react'
import { labourServices, attendanceServices, materialServices, convertDocsToArray } from '../services/firebaseServices'
import { sites, materials, purchaseOrders } from '../data/mockData'
import Footer from '../components/Footer'

const Reports = ({ userRole }) => {
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
        
        // Load attendance data based on view mode
        let attendanceSnapshot
        if (dateViewMode === 'monthly') {
          const startDate = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-01`
          const endDate = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-31`
          attendanceSnapshot = await attendanceServices.getAttendanceByDateRange(startDate, endDate)
        } else {
          attendanceSnapshot = await attendanceServices.getAttendanceByDate(selectedDate)
        }
        setAttendanceRecords(convertDocsToArray(attendanceSnapshot))
        
      } catch (error) {
        console.error('Error loading data:', error)
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [selectedMonth, selectedYear, selectedDate, dateViewMode])

  // Set up real-time listeners
  useEffect(() => {
    const unsubscribeLabour = labourServices.onLabourChange((snapshot) => {
      setLabourList(convertDocsToArray(snapshot))
    })

    const unsubscribeAttendance = attendanceServices.onAttendanceChange((snapshot) => {
      let filteredAttendance
      if (dateViewMode === 'monthly') {
        const startDate = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-01`
        const endDate = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-31`
        filteredAttendance = convertDocsToArray(snapshot).filter(a => 
          a.date >= startDate && a.date <= endDate
        )
      } else {
        filteredAttendance = convertDocsToArray(snapshot).filter(a => a.date === selectedDate)
      }
      setAttendanceRecords(filteredAttendance)
    })

    const unsubscribeMaterials = materialServices.onMaterialsChange((snapshot) => {
      setMaterials(convertDocsToArray(snapshot))
    })

    return () => {
      unsubscribeLabour()
      unsubscribeAttendance()
      unsubscribeMaterials()
    }
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
      budget: site.budget,
      startDate: site.startDate,
      endDate: site.endDate
    }))
  }

  const generateAttendanceData = () => {
    return labourList.map(labour => {
      const records = attendanceRecords.filter(r => r.labourId === labour.id)
      
      const present = records.filter(r => r.status === 'Present').length
      const absent = records.filter(r => r.status === 'Absent').length
      const leave = records.filter(r => r.status === 'Leave').length
      
      return {
        name: labour.name,
        role: labour.role,
        present,
        absent,
        leave,
        totalDays: records.length,
        salary: present * (labour.dailyWage || 0)
      }
    })
  }

  const generateMaterialData = () => {
    return materials.map(material => ({
      name: material.name,
      category: material.category,
      currentStock: material.currentStock,
      minStock: material.minStock,
      unitPrice: material.unitPrice,
      totalValue: material.currentStock * material.unitPrice,
      status: material.currentStock <= material.minStock ? 'Low' : 'Good'
    }))
  }

  const generateFinancialData = () => {
    const totalBudget = sites.reduce((sum, s) => sum + s.budget, 0)
    const totalPOAmount = purchaseOrders.reduce((sum, po) => sum + po.totalAmount, 0)
    const totalLabourCost = labourList.reduce((sum, l) => {
      const presentDays = attendanceRecords.filter(r => r.labourId === l.id && r.status === 'Present').length
      return sum + (presentDays * (l.dailyWage || 0))
    }, 0)
    const materialValue = materials.reduce((sum, m) => sum + (m.currentStock * m.unitPrice), 0)
    
    return {
      totalBudget,
      totalPOAmount,
      totalLabourCost,
      materialValue,
      totalExpenses: totalPOAmount + totalLabourCost
    }
  }

  const exportToCSV = (data, filename) => {
    const headers = Object.keys(data[0])
    const csvHeaders = headers.join(',')
    const csvData = data.map(row => 
      headers.map(header => `"${row[header]}"`).join(',')
    ).join('\n')
    
    const csvContent = `${csvHeaders}\n${csvData}`
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)
    
    link.setAttribute('href', url)
    link.setAttribute('download', filename)
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const exportSitesReport = () => {
    const sitesData = generateSiteProgressData()
    const exportData = sitesData.map(site => ({
      'Site Name': site.site,
      'Progress (%)': site.progress,
      'Status': site.status,
      'Budget (₹)': site.budget,
      'Start Date': site.startDate,
      'End Date': site.endDate
    }))
    
    const filename = `Total_Sites_Report_${new Date().toISOString().split('T')[0]}.csv`
    exportToCSV(exportData, filename)
  }

  const exportAttendanceReport = () => {
    const attendanceData = generateAttendanceData()
    const exportData = attendanceData.map(data => ({
      'Name': data.name,
      'Role': data.role,
      'Present Days': data.present,
      'Absent Days': data.absent,
      'Leave Days': data.leave,
      'Total Days': data.totalDays,
      'Salary Earned': `₹${data.salary}`
    }))
    
    const dateRange = dateViewMode === 'monthly' 
      ? `${new Date(selectedYear, selectedMonth).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`
      : selectedDate
    
    const filename = `Attendance_Report_${dateRange.replace(/\s+/g, '_')}.csv`
    exportToCSV(exportData, filename)
  }

  const exportMaterialReport = () => {
    const materialData = generateMaterialData()
    const exportData = materialData.map(material => ({
      'Material Name': material.name,
      'Category': material.category,
      'Current Stock': material.currentStock,
      'Minimum Stock': material.minStock,
      'Unit Price': `₹${material.unitPrice}`,
      'Total Value': `₹${material.totalValue}`,
      'Status': material.status
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
      default:
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
              <span className="ml-3 text-gray-600">Loading site data...</span>
            </div>
          )
        }
        
        const sitesData = generateSiteProgressData()
        return (
          <div>
            <div className="overflow-x-auto mb-6">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Site Name</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Progress</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Status</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Budget</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Start Date</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">End Date</th>
                  </tr>
                </thead>
                <tbody>
                  {sitesData.map((site, index) => (
                    <tr key={index} className="border-t border-gray-200">
                      <td className="py-3 px-4 font-medium text-gray-900">{site.site}</td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <div className="w-20 bg-gray-200 rounded-full h-2">
                            <div 
                              className="bg-blue-500 h-2 rounded-full" 
                              style={{ width: `${site.progress}%` }}
                            ></div>
                          </div>
                          <span className="text-sm text-gray-600">{site.progress}%</span>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          site.status === 'Active' ? 'bg-green-100 text-green-700' :
                          site.status === 'Completed' ? 'bg-blue-100 text-blue-700' :
                          'bg-yellow-100 text-yellow-700'
                        }`}>
                          {site.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-gray-900">₹{site.budget.toLocaleString()}</td>
                      <td className="py-3 px-4 text-gray-600">{site.startDate}</td>
                      <td className="py-3 px-4 text-gray-600">{site.endDate}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )

      case 'attendance':
        if (loading) {
          return (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <span className="ml-3 text-gray-600">Loading attendance data...</span>
            </div>
          )
        }
        
        const attendanceData = generateAttendanceData()
        return (
          <div>
            <div className="overflow-x-auto mb-6">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Name</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Role</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Present</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Absent</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Leave</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Total Days</th>
                  </tr>
                </thead>
                <tbody>
                  {attendanceData.map((data, index) => (
                    <tr key={index} className="border-t border-gray-200">
                      <td className="py-3 px-4 font-medium text-gray-900">{data.name}</td>
                      <td className="py-3 px-4 text-gray-600">{data.role}</td>
                      <td className="py-3 px-4 text-green-600 font-semibold">{data.present}</td>
                      <td className="py-3 px-4 text-red-600 font-semibold">{data.absent}</td>
                      <td className="py-3 px-4 text-yellow-600 font-semibold">{data.leave}</td>
                      <td className="py-3 px-4 text-gray-900">{data.totalDays}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )

      case 'material':
        const materialData = generateMaterialData()
        const totalValue = materialData.reduce((sum, m) => sum + m.totalValue, 0)
        return (
          <div>
            <div className="overflow-x-auto mb-6">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Material</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Category</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Current Stock</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Min Stock</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Unit Price</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Total Value</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {materialData.map((material, index) => (
                    <tr key={index} className="border-t border-gray-200">
                      <td className="py-3 px-4 font-medium text-gray-900">{material.name}</td>
                      <td className="py-3 px-4 text-gray-600">{material.category}</td>
                      <td className="py-3 px-4 text-gray-900">{material.currentStock}</td>
                      <td className="py-3 px-4 text-gray-600">{material.minStock}</td>
                      <td className="py-3 px-4 text-gray-900">₹{material.unitPrice}</td>
                      <td className="py-3 px-4 text-gray-900 font-semibold">₹{material.totalValue.toLocaleString()}</td>
                      <td className="py-3 px-4">
                        <span className={`badge ${
                          material.status === 'Low' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
                        }`}>
                          {material.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-gray-50 font-semibold">
                    <td colSpan="5" className="py-3 px-4 text-right">Total Inventory Value:</td>
                    <td className="py-3 px-4 text-primary text-lg">₹{totalValue.toLocaleString()}</td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )

      default:
        return null
    }
  }

  return (
    <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Reports</h1>
          <p className="text-gray-600 mt-1 text-sm sm:text-base">Generate and export detailed reports</p>
        </div>
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={handleExportReport}
          className="btn-primary flex items-center gap-2 w-full sm:w-auto justify-center"
        >
          <Download className="w-4 h-4 sm:w-5 sm:h-5" />
          <span className="text-sm sm:text-base">Export Report</span>
        </motion.button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {reportTypes.map((report, index) => {
          const Icon = report.icon
          return (
            <motion.button
              key={report.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              onClick={() => setSelectedReport(report.id)}
              className={`card text-left transition-all duration-200 mobile-card ${
                selectedReport === report.id
                  ? 'ring-2 ring-primary shadow-lg'
                  : 'hover:shadow-md'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className={`${report.color} p-2 sm:p-3 rounded-lg`}>
                  <Icon className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900 text-sm sm:text-base">{report.name}</h3>
                </div>
              </div>
            </motion.button>
          )
        })}
      </div>

      <div className="card mobile-card">
        <div className="flex flex-col gap-4 mb-4 sm:mb-6 pb-4 sm:pb-6 border-b border-gray-200">
          {selectedReport === 'attendance' && (
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 sm:w-5 sm:h-5 text-gray-400 flex-shrink-0" />
                <select
                  value={dateViewMode}
                  onChange={(e) => setDateViewMode(e.target.value)}
                  className="input-field text-sm sm:text-base"
                >
                  <option value="monthly">Monthly View</option>
                  <option value="single">Single Date</option>
                </select>
              </div>
              {dateViewMode === 'monthly' ? (
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-4">
                  <select
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
                    className="input-field text-sm sm:text-base w-full sm:w-auto"
                  >
                    <option value="0">January</option>
                    <option value="1">February</option>
                    <option value="2">March</option>
                    <option value="3">April</option>
                    <option value="4">May</option>
                    <option value="5">June</option>
                    <option value="6">July</option>
                    <option value="7">August</option>
                    <option value="8">September</option>
                    <option value="9">October</option>
                    <option value="10">November</option>
                    <option value="11">December</option>
                  </select>
                  <select
                    value={selectedYear}
                    onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                    className="input-field text-sm sm:text-base w-full sm:w-auto"
                  >
                    <option value="2025">2025</option>
                    <option value="2026">2026</option>
                  </select>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="input-field text-sm sm:text-base"
                  />
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {renderReportContent()}
      <Footer />
    </div>
  )
}

export default Reports