import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Users, Package, TrendingUp, Download, Printer } from 'lucide-react';
import { attendanceServices, dprServices, materialServices, convertDocsToArray } from '../services/firebaseServices';

const MonthlySiteAnalysisModal = ({ site, onClose, labour }) => {
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [loading, setLoading] = useState(false);
  
  const [attendanceRecords, setAttendanceRecords] = useState([]);
  const [dprRecords, setDprRecords] = useState([]);
  const [allMaterials, setAllMaterials] = useState([]);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const startDate = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-01`;
        const endDate = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-31`;
        
        // Fetch Attendance for the month
        const attSnapshot = await attendanceServices.getAttendanceByDateRange(startDate, endDate);
        const allAtt = convertDocsToArray(attSnapshot);
        setAttendanceRecords(allAtt.filter(a => a.siteId === site.id));
        
        // Fetch DPR for the month
        // const dprSnapshot = await dprServices.getDPRBySite(site.id);
        const dprSnapshot = await dprServices.getDPRBySiteId(site.id);
        const allDpr = convertDocsToArray(dprSnapshot);
        setDprRecords(allDpr.filter(d => {
          const dDate = new Date(d.date);
          return dDate.getMonth() === selectedMonth && dDate.getFullYear() === selectedYear;
        }));
        
        // Fetch all materials
        const matSnapshot = await materialServices.getAllMaterials();
        setAllMaterials(convertDocsToArray(matSnapshot));

      } catch (err) {
        console.error("Error fetching analysis data", err);
      }
      setLoading(false);
    };
    
    if (site) fetchData();
  }, [site, selectedMonth, selectedYear]);

  // Derived Data
  const daysInMonth = new Date(selectedYear, selectedMonth + 1, 0).getDate();
  const daysArray = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  // Staff analysis
  const staffAnalysis = useMemo(() => {
    const analysis = {};
    
    // Initialize for all assigned staff or staff with records
    const relevantStaffIds = new Set([
      ...(site.assignedStaff || []),
      ...attendanceRecords.map(a => a.employeeId).filter(Boolean)
    ]);

    relevantStaffIds.forEach(empId => {
      analysis[empId] = {
        emp: labour.find(l => l.id === empId) || { name: 'Unknown', role: '-', dailyWage: 0 },
        days: {},
        present: 0,
        absent: 0,
        leave: 0
      };
    });

    attendanceRecords.forEach(record => {
      if (analysis[record.employeeId]) {
        const day = parseInt(record.date.split('-')[2], 10);
        analysis[record.employeeId].days[day] = record.status;
        if (record.status === 'present') analysis[record.employeeId].present++;
        if (record.status === 'absent') analysis[record.employeeId].absent++;
        if (record.status === 'leave') analysis[record.employeeId].leave++;
      }
    });

    return Object.values(analysis).sort((a, b) => (a.emp.name || '').localeCompare(b.emp.name || ''));
  }, [attendanceRecords, site, labour]);

  // Material analysis

  console.log("DPR Records", dprRecords);
console.log("All Materials", allMaterials);

console.log(
  "First Material",
  dprRecords[0]?.materialUsage?.[0]
);

console.log("First Material From Collection", allMaterials[0]);
console.log(
  "Material Names",
  allMaterials.map(m => ({
    id: m.id,
    name: m.name
  }))
);
  const materialAnalysis = useMemo(() => {
    const analysis = {};
    
    dprRecords.forEach(dpr => {
      const day = parseInt(dpr.date.split('-')[2], 10);
      if (dpr.materialUsage) {
        dpr.materialUsage.forEach(mu => {
          if (!analysis[mu.materialId]) {
            analysis[mu.materialId] = {
              mat:
           allMaterials.find(m => m.id === mu.materialId) ||
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
  }, [dprRecords, allMaterials]);

  const monthName = new Date(2000, selectedMonth, 1).toLocaleString('default', { month: 'long' });

  const handleDownloadCSV = () => {
    let csvContent = "";

    
    csvContent += `Site: ${site.name}\r\n`;
    csvContent += `Month: ${monthName} ${selectedYear}\r\n\r\n`;
    
    // STAFF
    csvContent += "--- STAFF ATTENDANCE & SALARY ---\r\n";
    csvContent += `Employee,Role,Daily Wage,${daysArray.join(',')},Present,Absent,Leave,Est. Salary\r\n`;
    staffAnalysis.forEach(({ emp, days, present, absent, leave }) => {
      const wage = Number(emp.dailyWage || 0);
      const estSalary = present * wage;
      const dayStatuses = daysArray.map(d => {
        const s = days[d];
        return s === 'present' ? 'P' : s === 'absent' ? 'A' : s === 'leave' ? 'L' : '-';
      });
      // Escape commas in names
      const safeName = emp.name ? `"${emp.name.replace(/"/g, '""')}"` : 'Unknown';
      csvContent += `${safeName},${emp.role},${wage},${dayStatuses.join(',')},${present},${absent},${leave},${estSalary}\r\n`;
    });
    
    // MATERIALS
    csvContent += "\r\n--- MATERIAL USAGE & COST ---\r\n";
    csvContent += `Item Name,Type,Unit Price,${daysArray.join(',')},Total Used,Est. Cost\r\n`;
    materialAnalysis.forEach(({ mat, days, totalUsed }) => {
      const price = Number(mat.unitPrice || 0);
      const estCost = totalUsed * price;
      const dayUsages = daysArray.map(d => days[d] || '-');
      const safeMatName = mat.name ? `"${mat.name.replace(/"/g, '""')}"` : 'Unknown';
      csvContent += `${safeMatName},${mat.category},${price},${dayUsages.join(',')},${totalUsed} ${mat.unit},${estCost}\r\n`;
    });

    // Add BOM for Excel UTF-8 compatibility
    const BOM = "\uFEFF";
    const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `${site.name}_Detailed_Report_${monthName}_${selectedYear}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handlePrint = () => {
    window.print();
  };

  if (!site) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 z-[70]" onClick={onClose}>
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
        }
      `}</style>
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        onClick={e => e.stopPropagation()}
        className="bg-gray-50 rounded-2xl w-full max-w-[95vw] h-[95vh] flex flex-col shadow-2xl overflow-hidden print:shadow-none print:w-full print:h-full print:max-h-full print:bg-white"
      >
        <div className="p-3 sm:p-4 border-b border-gray-200 bg-white flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shrink-0 print:hidden">
          <div className="w-full flex justify-between sm:block">
            <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-blue-600" />
              Detailed Monthly Analysis
            </h2>
            <p className="text-sm text-gray-500 mt-1">{site.name}</p>
            <button onClick={onClose} className="sm:hidden p-1.5 hover:bg-gray-100 rounded-full transition text-gray-500">
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="flex flex-wrap items-center justify-start sm:justify-end gap-2 w-full sm:w-auto shrink-0">
            <button onClick={handleDownloadCSV} className="flex items-center gap-1 px-3 py-1.5 bg-green-50 text-green-700 border border-green-200 hover:bg-green-100 rounded-lg text-sm font-semibold transition-colors shrink-0">
              <Download className="w-4 h-4" /> CSV
            </button>
            <button onClick={handlePrint} className="flex-1 sm:flex-none flex items-center justify-center gap-1 px-3 py-1.5 bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 rounded-lg text-sm font-semibold transition-colors shrink-0">
              <Printer className="w-4 h-4" /> Print
            </button>
            <button onClick={onClose} className="hidden sm:block p-1.5 hover:bg-gray-100 rounded-full transition text-gray-500 ml-2">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Print Header */}
        <div className="hidden print:block p-8 pb-4 border-b border-gray-200">
          <h1 className="text-3xl font-black text-gray-900">Detailed Monthly Analysis</h1>
          <div className="mt-4 text-gray-600 flex justify-between">
            <div>
              <p><strong>Site:</strong> {site.name}</p>
              <p><strong>Location:</strong> {site.location}</p>
            </div>
            <div className="text-right">
              <p><strong>Month:</strong> {monthName} {selectedYear}</p>
              <p><strong>Generated On:</strong> {new Date().toLocaleDateString()}</p>
            </div>
          </div>
        </div>
        
        <div className="p-3 sm:p-4 bg-white border-b border-gray-200 shrink-0 flex flex-col sm:flex-row gap-3 sm:gap-4 print:hidden">
          <div className="flex-1 sm:max-w-xs">
            <label className="block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wider">Select Month</label>
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(Number(e.target.value))}
              className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
            >
              {Array.from({ length: 12 }).map((_, i) => (
                <option key={i} value={i}>{new Date(2000, i, 1).toLocaleString('default', { month: 'long' })}</option>
              ))}
            </select>
          </div>
          <div className="flex-1 sm:max-w-xs">
            <label className="block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wider">Select Year</label>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
            >
              {[...Array(5)].map((_, i) => (
                <option key={i} value={new Date().getFullYear() - i}>{new Date().getFullYear() - i}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-2 sm:p-4 space-y-6 print:overflow-visible print:p-8 bg-gray-50 print:bg-white">
          {loading ? (
            <div className="flex justify-center items-center py-20 print:hidden">
              <div className="animate-spin w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full" />
            </div>
          ) : (
            <>
              {/* Web View - Single Scrollable Table */}
              <div className="print:hidden space-y-8">
                {/* Staff Attendance Summary */}
                <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
                  <div className="p-4 bg-blue-50 border-b border-blue-100 flex items-center gap-2 sticky left-0">
                    <Users className="w-5 h-5 text-blue-600" />
                    <h3 className="font-bold text-gray-900">Day-by-Day Staff Attendance & Salary</h3>
                  </div>
                  <div className="overflow-x-auto relative">
                    <table className="w-full text-sm text-left border-collapse">
                      <thead className="bg-gray-50 border-b border-gray-200 sticky top-0 z-10">
                        <tr>
                          <th className="px-2 py-2 font-semibold text-gray-600 border-r border-gray-200 sticky left-0 bg-gray-50 z-20 min-w-[90px] w-24 text-xs">Employee</th>
                          <th className="px-3 py-2 font-semibold text-gray-600 border-r border-gray-200 text-center">Wage</th>
                          {daysArray.map(day => (
                            <th key={day} className="px-1 py-2 font-semibold text-gray-600 border-r border-gray-200 text-center min-w-[28px] text-xs">
                              {day}
                            </th>
                          ))}
                          <th className="px-3 py-2 font-semibold text-green-600 text-center border-l border-gray-200">P</th>
                          <th className="px-3 py-2 font-semibold text-red-600 text-center border-x border-gray-200">A</th>
                          <th className="px-3 py-2 font-semibold text-blue-700 text-right bg-blue-50 min-w-[100px]">Est. Salary</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {staffAnalysis.length > 0 ? (
                          staffAnalysis.map(({ emp, days, present, absent }) => {
                            const wage = Number(emp.dailyWage || 0);
                            const estSalary = present * wage;
                            return (
                              <tr key={emp.id} className="hover:bg-gray-50">
                                <td className="px-2 py-2 font-medium text-gray-900 border-r border-gray-200 sticky left-0 bg-white z-10 text-xs truncate max-w-[90px]">
                                  {emp.name}
                                  <span className="block text-[9px] text-gray-400 font-normal truncate">{emp.role}</span>
                                </td>
                                <td className="px-3 py-2 text-gray-600 text-center border-r border-gray-200 text-xs">₹{wage}</td>
                                {daysArray.map(day => {
                                  const status = days[day];
                                  let txt = '-'; let color = 'text-gray-300';
                                  if (status === 'present') { txt = 'P'; color = 'text-green-600 font-bold bg-green-50'; }
                                  if (status === 'absent') { txt = 'A'; color = 'text-red-600 font-bold bg-red-50'; }
                                  if (status === 'leave') { txt = 'L'; color = 'text-yellow-600 font-bold bg-yellow-50'; }
                                  return <td key={day} className={`px-1 py-2 text-center text-xs border-r border-gray-200 ${color}`}>{txt}</td>;
                                })}
                                <td className="px-3 py-2 text-center font-bold text-green-600 border-l border-gray-200">{present}</td>
                                <td className="px-3 py-2 text-center font-bold text-red-600 border-x border-gray-200">{absent}</td>
                                <td className="px-3 py-2 text-right font-black text-blue-700 bg-blue-50/30">₹{estSalary.toLocaleString()}</td>
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

                {/* Material Usage Summary */}
                <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm mt-8">
                  <div className="p-4 bg-orange-50 border-b border-orange-100 flex items-center gap-2 sticky left-0">
                    <Package className="w-5 h-5 text-orange-600" />
                    <h3 className="font-bold text-gray-900">Day-by-Day Material & Tools Usage</h3>
                  </div>
                  <div className="overflow-x-auto relative">
                    <table className="w-full text-sm text-left border-collapse">
                      <thead className="bg-gray-50 border-b border-gray-200 sticky top-0 z-10">
                        <tr>
                          <th className="px-2 py-2 font-semibold text-gray-600 border-r border-gray-200 sticky left-0 bg-gray-50 z-20 min-w-[90px] w-24 text-xs">Item Name</th>
                          <th className="px-3 py-2 font-semibold text-gray-600 border-r border-gray-200 text-center">Price</th>
                          {daysArray.map(day => (
                            <th key={day} className="px-1 py-2 font-semibold text-gray-600 border-r border-gray-200 text-center min-w-[30px] text-xs">
                              {day}
                            </th>
                          ))}
                          <th className="px-3 py-2 font-semibold text-orange-700 text-center border-l border-gray-200 min-w-[80px]">Total Used</th>
                          <th className="px-3 py-2 font-semibold text-red-700 text-right bg-red-50 min-w-[100px]">Est. Cost</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {materialAnalysis.length > 0 ? (
                          materialAnalysis.map(({ mat, days, totalUsed }) => {
                            const price = Number(mat.unitPrice || 0);
                            const estCost = totalUsed * price;
                            return (
                              <tr key={mat.id} className="hover:bg-gray-50">
                                <td className="px-2 py-2 font-medium text-gray-900 border-r border-gray-200 sticky left-0 bg-white z-10 text-xs truncate max-w-[90px]">
                                  {mat.name}
                                  <span className="block text-[9px] text-gray-400 font-normal capitalize truncate">{mat.category}</span>
                                </td>
                                <td className="px-3 py-2 text-gray-600 text-center border-r border-gray-200 text-xs">₹{price}/{mat.unit}</td>
                                {daysArray.map(day => {
                                  const qty = days[day];
                                  return (
                                    <td key={day} className={`px-1 py-2 text-center text-xs border-r border-gray-200 ${qty ? 'font-bold text-gray-800 bg-gray-50' : 'text-gray-300'}`}>
                                      {qty || '-'}
                                    </td>
                                  );
                                })}
                                <td className="px-3 py-2 text-center font-bold text-orange-700 border-l border-gray-200">
                                  {totalUsed} <span className="text-[10px] font-normal text-gray-500">{mat.unit}</span>
                                </td>
                                <td className="px-3 py-2 text-right font-black text-red-700 bg-red-50/30">₹{estCost.toLocaleString()}</td>
                              </tr>
                            )
                          })
                        ) : (
                          <tr><td colSpan={daysInMonth + 4} className="px-4 py-8 text-center text-gray-500 italic">No material or tool usage recorded in DPRs for {monthName}.</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* Print View - Split Tables */}
              <div className="hidden print:block space-y-8">
                {/* Staff Attendance Split */}
                <div className="break-inside-avoid">
                  <div className="p-2 bg-gray-100 border-b border-gray-300 flex items-center gap-2 mb-2">
                    <Users className="w-4 h-4 text-gray-800" />
                    <h3 className="font-bold text-gray-900 text-sm">Day-by-Day Staff Attendance & Salary</h3>
                  </div>
                  {[daysArray.slice(0, 16), daysArray.slice(16)].map((chunk, idx) => (
                    <div key={idx} className={`mb-6 ${idx === 1 ? 'break-inside-avoid' : ''}`}>
                      <h4 className="text-[10px] font-bold text-gray-600 mb-1">Part {idx + 1} (Days {chunk[0]} to {chunk[chunk.length-1]})</h4>
                      <table className="w-full text-left border-collapse print-compact-table border border-gray-300">
                        <thead className="bg-gray-100 border-b border-gray-300">
                          <tr>
                            <th className="px-1 py-1 font-semibold text-gray-800 border-r border-gray-300">Employee</th>
                            <th className="px-1 py-1 font-semibold text-gray-800 border-r border-gray-300 text-center">Wage</th>
                            {chunk.map(day => (
                              <th key={day} className="px-1 py-1 font-semibold text-gray-800 border-r border-gray-300 text-center">{day}</th>
                            ))}
                            {idx === 1 && (
                              <>
                                <th className="px-1 py-1 font-semibold text-gray-800 text-center border-l border-gray-300">P</th>
                                <th className="px-1 py-1 font-semibold text-gray-800 text-center border-x border-gray-300">A</th>
                                <th className="px-1 py-1 font-semibold text-gray-900 text-right">Est. Salary</th>
                              </>
                            )}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-300">
                          {staffAnalysis.length > 0 ? (
                            staffAnalysis.map(({ emp, days, present, absent }) => {
                              const wage = Number(emp.dailyWage || 0);
                              return (
                                <tr key={emp.id}>
                                  <td className="px-1 py-1 font-medium text-gray-900 border-r border-gray-300">{emp.name}</td>
                                  <td className="px-1 py-1 text-gray-800 text-center border-r border-gray-300">₹{wage}</td>
                                  {chunk.map(day => {
                                    const status = days[day];
                                    let txt = '-'; let color = 'text-gray-400';
                                    if (status === 'present') { txt = 'P'; color = 'text-gray-900 font-bold'; }
                                    if (status === 'absent') { txt = 'A'; color = 'text-gray-900 font-bold'; }
                                    if (status === 'leave') { txt = 'L'; color = 'text-gray-900 font-bold'; }
                                    return <td key={day} className={`px-1 py-1 text-center border-r border-gray-300 ${color}`}>{txt}</td>;
                                  })}
                                  {idx === 1 && (
                                    <>
                                      <td className="px-1 py-1 text-center font-bold text-gray-900 border-l border-gray-300">{present}</td>
                                      <td className="px-1 py-1 text-center font-bold text-gray-900 border-x border-gray-300">{absent}</td>
                                      <td className="px-1 py-1 text-right font-black text-gray-900">₹{(present * wage).toLocaleString()}</td>
                                    </>
                                  )}
                                </tr>
                              )
                            })
                          ) : (
                            <tr><td colSpan={chunk.length + (idx === 1 ? 5 : 2)} className="px-2 py-4 text-center text-gray-600 italic">No attendance records.</td></tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  ))}
                </div>

                {/* Material Usage Split */}
                <div className="break-inside-avoid mt-8">
                  <div className="p-2 bg-gray-100 border-b border-gray-300 flex items-center gap-2 mb-2">
                    <Package className="w-4 h-4 text-gray-800" />
                    <h3 className="font-bold text-gray-900 text-sm">Day-by-Day Material & Tools Usage</h3>
                  </div>
                  {[daysArray.slice(0, 16), daysArray.slice(16)].map((chunk, idx) => (
                    <div key={idx} className={`mb-6 ${idx === 1 ? 'break-inside-avoid' : ''}`}>
                      <h4 className="text-[10px] font-bold text-gray-600 mb-1">Part {idx + 1} (Days {chunk[0]} to {chunk[chunk.length-1]})</h4>
                      <table className="w-full text-left border-collapse print-compact-table border border-gray-300">
                        <thead className="bg-gray-100 border-b border-gray-300">
                          <tr>
                            <th className="px-1 py-1 font-semibold text-gray-800 border-r border-gray-300">Item Name</th>
                            <th className="px-1 py-1 font-semibold text-gray-800 border-r border-gray-300 text-center">Price</th>
                            {chunk.map(day => (
                              <th key={day} className="px-1 py-1 font-semibold text-gray-800 border-r border-gray-300 text-center">{day}</th>
                            ))}
                            {idx === 1 && (
                              <>
                                <th className="px-1 py-1 font-semibold text-gray-800 text-center border-l border-gray-300">Total Used</th>
                                <th className="px-1 py-1 font-semibold text-gray-900 text-right">Est. Cost</th>
                              </>
                            )}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-300">
                          {materialAnalysis.length > 0 ? (
                            materialAnalysis.map(({ mat, days, totalUsed }) => {
                              const price = Number(mat.unitPrice || 0);
                              return (
                                <tr key={mat.id}>
                                  <td className="px-1 py-1 font-medium text-gray-900 border-r border-gray-300">{mat.name}</td>
                                  <td className="px-1 py-1 text-gray-800 text-center border-r border-gray-300">₹{price}/{mat.unit}</td>
                                  {chunk.map(day => {
                                    const qty = days[day];
                                    return <td key={day} className={`px-1 py-1 text-center border-r border-gray-300 ${qty ? 'font-bold text-gray-900' : 'text-gray-400'}`}>{qty || '-'}</td>;
                                  })}
                                  {idx === 1 && (
                                    <>
                                      <td className="px-1 py-1 text-center font-bold text-gray-900 border-l border-gray-300">{totalUsed} <span className="font-normal">{mat.unit}</span></td>
                                      <td className="px-1 py-1 text-right font-black text-gray-900">₹{(totalUsed * price).toLocaleString()}</td>
                                    </>
                                  )}
                                </tr>
                              )
                            })
                          ) : (
                            <tr><td colSpan={chunk.length + (idx === 1 ? 4 : 2)} className="px-2 py-4 text-center text-gray-600 italic">No material usage records.</td></tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </motion.div>
    </div>
  );
};

export default MonthlySiteAnalysisModal;
