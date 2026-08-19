import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Users, Package, FileText, Download, Printer, TrendingUp, Calendar } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { attendanceServices, dprServices, materialServices, convertDocsToArray } from '../services/firebaseServices';
import { siteServices, labourServices } from '../services/firebaseServices';

const ReportsPage = () => {
  const navigate = useNavigate();
  const [selectedTab, setSelectedTab] = useState('process');
  const [selectedSite, setSelectedSite] = useState(null);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [loading, setLoading] = useState(false);

  const [sites, setSites] = useState([]);
  const [labour, setLabour] = useState([]);
  const [attendanceRecords, setAttendanceRecords] = useState([]);
  const [dprRecords, setDprRecords] = useState([]);
  const [allMaterials, setAllMaterials] = useState([]);

  useEffect(() => {
    const loadSites = async () => {
      try {
        const sitesSnapshot = await siteServices.getAllSites();
        setSites(convertDocsToArray(sitesSnapshot));
      } catch (err) {
        console.error("Error loading sites:", err);
      }
    };
    loadSites();
  }, []);

  useEffect(() => {
    const loadLabour = async () => {
      try {
        const labourSnapshot = await labourServices.getAllLabour();
        setLabour(convertDocsToArray(labourSnapshot));
      } catch (err) {
        console.error("Error loading labour:", err);
      }
    };
    loadLabour();
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      if (!selectedSite) return;
      setLoading(true);
      try {
        const startDate = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-01`;
        const endDate = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-31`;

        // Fetch Attendance
        const attSnapshot = await attendanceServices.getAttendanceByDateRange(startDate, endDate);
        const allAtt = convertDocsToArray(attSnapshot);
        // Include records for the selected site AND contract/daily worker records whose
        // employeeId references this site (they may be stored with siteId='unassigned').
        setAttendanceRecords(
          allAtt.filter(a =>
            a.siteId === selectedSite.id ||
            ((a.isContractWorker || a.isDailyWorker) &&
              a.employeeId &&
              a.employeeId.includes(selectedSite.id))
          )
        );

        // Fetch DPR
        const dprSnapshot = await dprServices.getDPRBySiteId(selectedSite.id);
        const allDpr = convertDocsToArray(dprSnapshot);
        setDprRecords(allDpr.filter(d => {
          const dDate = new Date(d.date);
          return dDate.getMonth() === selectedMonth && dDate.getFullYear() === selectedYear;
        }));

        // Fetch Materials
        const matSnapshot = await materialServices.getAllMaterials();
        setAllMaterials(convertDocsToArray(matSnapshot));
      } catch (err) {
        console.error("Error fetching report data", err);
      }
      setLoading(false);
    };

    fetchData();
  }, [selectedSite, selectedMonth, selectedYear]);

  const daysInMonth = new Date(selectedYear, selectedMonth + 1, 0).getDate();
  const daysArray = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const monthName = new Date(2000, selectedMonth, 1).toLocaleString('default', { month: 'long' });

  // Process Analysis
  const processAnalysis = useMemo(() => {
    if (!selectedSite) return [];
    const analysis = {};

    dprRecords.forEach(dpr => {
      const day = parseInt(dpr.date.split('-')[2], 10);

      if (dpr.processEntries) {
        dpr.processEntries.forEach(pe => {
          const workName = pe.work || 'Unknown';
          if (!analysis[workName]) {
            analysis[workName] = { work: workName, unit: pe.unit || '', days: {}, totalQuantity: 0 };
          }
          const qty = Number(pe.quantity || 0);
          if (!analysis[workName].days[day]) analysis[workName].days[day] = 0;
          analysis[workName].days[day] += qty;
          analysis[workName].totalQuantity += qty;
        });
      }

      if (dpr.processProgress) {
        Object.entries(dpr.processProgress).forEach(([processKey, processData]) => {
          const workName = processData.name || processKey;
          if (!analysis[workName]) {
            analysis[workName] = { work: workName, unit: processData.unit || 'sq ft', days: {}, totalQuantity: 0 };
          }
          const qty = Number(processData.doneSq || 0);
          if (!analysis[workName].days[day]) analysis[workName].days[day] = 0;
          analysis[workName].days[day] += qty;
          analysis[workName].totalQuantity += qty;
        });
      }
    });

    return Object.values(analysis).sort((a, b) => a.work.localeCompare(b.work));
  }, [dprRecords, selectedSite]);

  // Staff Analysis
  const staffAnalysis = useMemo(() => {
    if (!selectedSite) return [];
    const analysis = {};

    // 1. Pre-populate permanent staff assigned to this site
    (selectedSite.assignedStaff || []).forEach(empId => {
      const empData = labour.find(l => l.id === empId) || { name: 'Unknown', role: '-', dailyWage: 0 };
      analysis[empId] = {
        emp: empData,
        days: {},
        present: 0,
        absent: 0,
        leave: 0
      };
    });

    // 2. Process attendance records — handle contract workers, daily workers, and permanent staff
    attendanceRecords.forEach(record => {
      const day = parseInt(record.date.split('-')[2], 10);

      if (record.isContractWorker) {
        // Group all contract worker records by contractor name into a single row
        const groupKey = `contract_${record.contractorName}_${record.buildingId || 'site'}`;
        if (!analysis[groupKey]) {
          analysis[groupKey] = {
            emp: { name: record.contractorName, role: 'Contractor Pool', dailyWage: 0 },
            days: {},
            present: 0,
            absent: 0,
            leave: 0
          };
        }
        const count = Number(record.contractWorkerCount || 0);
        if (count > 0) {
          analysis[groupKey].days[day] = (analysis[groupKey].days[day] || 0) + count;
          analysis[groupKey].present += count;
        }
      } else if (record.isDailyWorker) {
        // Group all daily worker records into a single row
        const groupKey = `daily_${record.buildingId || 'site'}`;
        if (!analysis[groupKey]) {
          analysis[groupKey] = {
            emp: { name: 'Daily Workers', role: 'Daily Pool', dailyWage: 0 },
            days: {},
            present: 0,
            absent: 0,
            leave: 0
          };
        }
        const count = Number(record.dailyWorkerCount || 0);
        if (count > 0) {
          analysis[groupKey].days[day] = (analysis[groupKey].days[day] || 0) + count;
          analysis[groupKey].present += count;
        }
      } else {
        // Standard permanent employee
        if (!analysis[record.employeeId]) {
          const empData = labour.find(l => l.id === record.employeeId) || { name: 'Unknown', role: '-', dailyWage: 0 };
          analysis[record.employeeId] = {
            emp: empData,
            days: {},
            present: 0,
            absent: 0,
            leave: 0
          };
        }
        analysis[record.employeeId].days[day] = record.status;
        if (record.status === 'present') analysis[record.employeeId].present++;
        if (record.status === 'absent') analysis[record.employeeId].absent++;
        if (record.status === 'leave') analysis[record.employeeId].leave++;
      }
    });

    return Object.values(analysis).sort((a, b) => (a.emp.name || '').localeCompare(b.emp.name || ''));
  }, [attendanceRecords, selectedSite, labour]);

  // Material Analysis
  const materialAnalysis = useMemo(() => {
    if (!selectedSite) return [];
    const analysis = {};

    dprRecords.forEach(dpr => {
      const day = parseInt(dpr.date.split('-')[2], 10);
      if (dpr.materialUsage) {
        dpr.materialUsage.forEach(mu => {
          if (!analysis[mu.materialId]) {
            analysis[mu.materialId] = {
              mat: allMaterials.find(m => m.id === mu.materialId) ||
                allMaterials.find(m => m.name === mu.name) || {
                name: mu.name || 'Unknown',
                category: '-',
                unitPrice: 0,
                unit: mu.unit || ''
              },
              days: {},
              totalUsed: 0
            };
          }
          const qty = Number(mu.quantity || 0);
          if (!analysis[mu.materialId].days[day]) analysis[mu.materialId].days[day] = 0;
          analysis[mu.materialId].days[day] += qty;
          analysis[mu.materialId].totalUsed += qty;
        });
      }
    });

    return Object.values(analysis).sort((a, b) => (a.mat.name || '').localeCompare(b.mat.name || ''));
  }, [dprRecords, allMaterials, selectedSite]);

  const handleDownloadCSV = () => {
    if (!selectedSite) return;
    let csvContent = "";

    csvContent += `Site: ${selectedSite.name}\r\n`;
    csvContent += `Month: ${monthName} ${selectedYear}\r\n\r\n`;

    if (selectedTab === 'process') {
      csvContent += "--- PROCESS WORK ANALYSIS ---\r\n";
      csvContent += `Process Name,Unit,${daysArray.join(',')},Total Quantity\r\n`;
      processAnalysis.forEach(({ work, unit, days, totalQuantity }) => {
        const dayQuantities = daysArray.map(d => days[d] || '-');
        const safeWorkName = work ? `"${work.replace(/"/g, '""')}"` : 'Unknown';
        csvContent += `${safeWorkName},${unit},${dayQuantities.join(',')},${totalQuantity} ${unit}\r\n`;
      });
    } else if (selectedTab === 'attendance') {
      csvContent += "--- STAFF ATTENDANCE & SALARY ---\r\n";
      csvContent += `Employee,Role,Daily Wage,${daysArray.join(',')},Present,Absent,Leave,Est. Salary\r\n`;
      staffAnalysis.forEach(({ emp, days, present, absent, leave }) => {
        const wage = Number(emp.dailyWage || 0);
        const estSalary = present * wage;
        const dayStatuses = daysArray.map(d => {
          const s = days[d];
          return s === 'present' ? 'P' : s === 'absent' ? 'A' : s === 'leave' ? 'L' : '-';
        });
        const safeName = emp.name ? `"${emp.name.replace(/"/g, '""')}"` : 'Unknown';
        csvContent += `${safeName},${emp.role},${wage},${dayStatuses.join(',')},${present},${absent},${leave},${estSalary}\r\n`;
      });
    } else if (selectedTab === 'materials') {
      csvContent += "--- MATERIAL USAGE & COST ---\r\n";
      csvContent += `Item Name,Type,Unit Price,${daysArray.join(',')},Total Used,Est. Cost\r\n`;
      materialAnalysis.forEach(({ mat, days, totalUsed }) => {
        const price = Number(mat.unitPrice || 0);
        const estCost = totalUsed * price;
        const dayUsages = daysArray.map(d => days[d] || '-');
        const safeMatName = mat.name ? `"${mat.name.replace(/"/g, '""')}"` : 'Unknown';
        csvContent += `${safeMatName},${mat.category},${price},${dayUsages.join(',')},${totalUsed} ${mat.unit},${estCost}\r\n`;
      });
    }

    const BOM = "\uFEFF";
    const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `${selectedSite.name}_${selectedTab}_Report_${monthName}_${selectedYear}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handlePrint = () => {
    window.print();
  };

  const tabs = [
    { id: 'process', label: 'Process', icon: FileText, color: 'purple' },
    { id: 'attendance', label: 'Attendance', icon: Users, color: 'blue' },
    { id: 'materials', label: 'Materials', icon: Package, color: 'orange' }
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <style>{`
        @media print {
          @page { size: landscape; margin: 5mm; }
          .print-compact-table th, .print-compact-table td {
            padding: 1px !important;
            font-size: 7px !important;
          }
          .print-compact-table {
            width: 100% !important;
            table-layout: auto !important;
          }
          .no-print { display: none !important; }
        }
      `}</style>

      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate('/dashboard')}
                className="p-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors text-gray-600"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div>
                <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                  <TrendingUp className="w-6 h-6 text-blue-600" />
                  Monthly Reports
                </h1>
                <p className="text-gray-500 text-sm mt-1">Process, Attendance & Materials Analysis</p>
              </div>
            </div>
            <div className="flex items-center gap-2 no-print">
              <button
                onClick={handleDownloadCSV}
                disabled={!selectedSite}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Download className="w-4 h-4" />
                Excel
              </button>
              <button
                onClick={handlePrint}
                disabled={!selectedSite}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Printer className="w-4 h-4" />
                PDF
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Filters */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6 no-print">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Select Site</label>
              <select
                value={selectedSite?.id || ''}
                onChange={(e) => setSelectedSite(sites.find(s => s.id === e.target.value) || null)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">Select a site</option>
                {sites.sort((a, b) => (a.name || '').localeCompare(b.name || '')).map(site => (
                  <option key={site.id} value={site.id}>{site.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Select Month</label>
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(Number(e.target.value))}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                {Array.from({ length: 12 }).map((_, i) => (
                  <option key={i} value={i}>{new Date(2000, i, 1).toLocaleString('default', { month: 'long' })}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Select Year</label>
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(Number(e.target.value))}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                {[...Array(5)].map((_, i) => (
                  <option key={i} value={new Date().getFullYear() - i}>{new Date().getFullYear() - i}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 mb-6 no-print">
          <div className="flex border-b border-gray-200">
            {tabs.map(tab => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setSelectedTab(tab.id)}
                  className={`flex items-center gap-2 px-6 py-4 font-medium transition-colors ${selectedTab === tab.id
                      ? `text-${tab.color}-600 border-b-2 border-${tab.color}-600 bg-${tab.color}-50`
                      : 'text-gray-500 hover:text-gray-700'
                    }`}
                >
                  <Icon className="w-4 h-4" />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Content */}
        {!selectedSite ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
            <Calendar className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-gray-900 mb-2">Select a Site</h3>
            <p className="text-gray-500">Choose a site from the dropdown above to view reports.</p>
          </div>
        ) : loading ? (
          <div className="flex justify-center items-center py-20">
            <div className="animate-spin w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full" />
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            {/* Print Header */}
            <div className="hidden print:block p-8 pb-4 border-b border-gray-200">
              <h1 className="text-3xl font-black text-gray-900">
                {selectedTab === 'process' ? 'Process' : selectedTab === 'attendance' ? 'Staff Attendance' : 'Material'} Monthly Analysis
              </h1>
              <div className="mt-4 text-gray-600 flex justify-between">
                <div>
                  <p><strong>Site:</strong> {selectedSite.name}</p>
                  <p><strong>Location:</strong> {selectedSite.location}</p>
                </div>
                <div className="text-right">
                  <p><strong>Month:</strong> {monthName} {selectedYear}</p>
                  <p><strong>Generated On:</strong> {new Date().toLocaleDateString()}</p>
                </div>
              </div>
            </div>

            {/* Process Tab */}
            {selectedTab === 'process' && (
              <div className="p-6">
                <div className="flex items-center gap-2 mb-4 bg-purple-50 p-4 rounded-lg">
                  <FileText className="w-5 h-5 text-purple-600" />
                  <h3 className="font-bold text-gray-900">Day-by-Day Process Work Progress</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left border-collapse">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="px-4 py-3 font-semibold text-gray-600 border-r border-gray-200 sticky left-0 bg-gray-50 min-w-[150px]">Process Name</th>
                        <th className="px-4 py-3 font-semibold text-gray-600 border-r border-gray-200 text-center">Unit</th>
                        {daysArray.map(day => (
                          <th key={day} className="px-2 py-3 font-semibold text-gray-600 border-r border-gray-200 text-center min-w-[35px]">{day}</th>
                        ))}
                        <th className="px-4 py-3 font-semibold text-purple-700 text-center border-l border-gray-200">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {processAnalysis.length > 0 ? (
                        processAnalysis.map(({ work, unit, days, totalQuantity }) => (
                          <tr key={work} className="hover:bg-gray-50">
                            <td className="px-4 py-3 font-medium text-gray-900 border-r border-gray-200 sticky left-0 bg-white">{work}</td>
                            <td className="px-4 py-3 text-gray-600 text-center border-r border-gray-200">{unit}</td>
                            {daysArray.map(day => {
                              const qty = days[day];
                              return (
                                <td key={day} className={`px-2 py-3 text-center border-r border-gray-200 ${qty ? 'font-bold text-gray-800 bg-purple-50' : 'text-gray-300'}`}>
                                  {qty || '-'}
                                </td>
                              );
                            })}
                            <td className="px-4 py-3 text-center font-bold text-purple-700 border-l border-gray-200">
                              {totalQuantity} <span className="text-xs font-normal text-gray-500">{unit}</span>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr><td colSpan={daysInMonth + 3} className="px-4 py-8 text-center text-gray-500 italic">No process records found for {monthName}.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Attendance Tab */}
            {selectedTab === 'attendance' && (
              <div className="p-6">
                <div className="flex items-center gap-2 mb-4 bg-blue-50 p-4 rounded-lg">
                  <Users className="w-5 h-5 text-blue-600" />
                  <h3 className="font-bold text-gray-900">Day-by-Day Staff Attendance & Salary</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left border-collapse">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="px-4 py-3 font-semibold text-gray-600 border-r border-gray-200 sticky left-0 bg-gray-50 min-w-[150px]">Employee</th>
                        <th className="px-4 py-3 font-semibold text-gray-600 border-r border-gray-200 text-center">Wage</th>
                        {daysArray.map(day => (
                          <th key={day} className="px-2 py-3 font-semibold text-gray-600 border-r border-gray-200 text-center min-w-[35px]">{day}</th>
                        ))}
                        <th className="px-4 py-3 font-semibold text-green-600 text-center border-l border-gray-200">P</th>
                        <th className="px-4 py-3 font-semibold text-red-600 text-center border-x border-gray-200">A</th>
                        <th className="px-4 py-3 font-semibold text-blue-700 text-right bg-blue-50">Est. Salary</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {staffAnalysis.length > 0 ? (
                        staffAnalysis.map(({ emp, days, present, absent }) => {
                          const wage = Number(emp.dailyWage || 0);
                          const estSalary = present * wage;
                          return (
                            <tr key={emp.id} className="hover:bg-gray-50">
                              <td className="px-4 py-3 font-medium text-gray-900 border-r border-gray-200 sticky left-0 bg-white">
                                {emp.name}
                                <span className="block text-xs text-gray-400">{emp.role}</span>
                              </td>
                              <td className="px-4 py-3 text-gray-600 text-center border-r border-gray-200">₹{wage}</td>
                              {daysArray.map(day => {
                                const status = days[day];
                                let txt = '-'; let color = 'text-gray-300';
                                if (status === 'present') { txt = 'P'; color = 'text-green-600 font-bold bg-green-50'; }
                                if (status === 'absent') { txt = 'A'; color = 'text-red-600 font-bold bg-red-50'; }
                                if (status === 'leave') { txt = 'L'; color = 'text-yellow-600 font-bold bg-yellow-50'; }
                                return <td key={day} className={`px-2 py-3 text-center border-r border-gray-200 ${color}`}>{txt}</td>;
                              })}
                              <td className="px-4 py-3 text-center font-bold text-green-600 border-l border-gray-200">{present}</td>
                              <td className="px-4 py-3 text-center font-bold text-red-600 border-x border-gray-200">{absent}</td>
                              <td className="px-4 py-3 text-right font-black text-blue-700 bg-blue-50/30">₹{estSalary.toLocaleString()}</td>
                            </tr>
                          )
                        })
                      ) : (
                        <tr><td colSpan={daysInMonth + 5} className="px-4 py-8 text-center text-gray-500 italic">No attendance records for {monthName}.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Materials Tab */}
            {selectedTab === 'materials' && (
              <div className="p-6">
                <div className="flex items-center gap-2 mb-4 bg-orange-50 p-4 rounded-lg">
                  <Package className="w-5 h-5 text-orange-600" />
                  <h3 className="font-bold text-gray-900">Day-by-Day Material & Tools Usage</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left border-collapse">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="px-4 py-3 font-semibold text-gray-600 border-r border-gray-200 sticky left-0 bg-gray-50 min-w-[150px]">Item Name</th>
                        <th className="px-4 py-3 font-semibold text-gray-600 border-r border-gray-200 text-center">Price</th>
                        {daysArray.map(day => (
                          <th key={day} className="px-2 py-3 font-semibold text-gray-600 border-r border-gray-200 text-center min-w-[35px]">{day}</th>
                        ))}
                        <th className="px-4 py-3 font-semibold text-orange-700 text-center border-l border-gray-200">Total Used</th>
                        <th className="px-4 py-3 font-semibold text-red-700 text-right bg-red-50">Est. Cost</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {materialAnalysis.length > 0 ? (
                        materialAnalysis.map(({ mat, days, totalUsed }) => {
                          const price = Number(mat.unitPrice || 0);
                          const estCost = totalUsed * price;
                          return (
                            <tr key={mat.id} className="hover:bg-gray-50">
                              <td className="px-4 py-3 font-medium text-gray-900 border-r border-gray-200 sticky left-0 bg-white">
                                {mat.name}
                                <span className="block text-xs text-gray-400 capitalize">{mat.category}</span>
                              </td>
                              <td className="px-4 py-3 text-gray-600 text-center border-r border-gray-200">₹{price}/{mat.unit}</td>
                              {daysArray.map(day => {
                                const qty = days[day];
                                return (
                                  <td key={day} className={`px-2 py-3 text-center border-r border-gray-200 ${qty ? 'font-bold text-gray-800 bg-gray-50' : 'text-gray-300'}`}>
                                    {qty || '-'}
                                  </td>
                                );
                              })}
                              <td className="px-4 py-3 text-center font-bold text-orange-700 border-l border-gray-200">
                                {totalUsed} <span className="text-xs font-normal text-gray-500">{mat.unit}</span>
                              </td>
                              <td className="px-4 py-3 text-right font-black text-red-700 bg-red-50/30">₹{estCost.toLocaleString()}</td>
                            </tr>
                          )
                        })
                      ) : (
                        <tr><td colSpan={daysInMonth + 4} className="px-4 py-8 text-center text-gray-500 italic">No material usage records for {monthName}.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ReportsPage;
