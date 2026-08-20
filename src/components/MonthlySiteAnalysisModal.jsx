import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Users, Package, TrendingUp, Download, Printer, FileText } from 'lucide-react';
import { attendanceServices, dprServices, materialServices, buildingServices, convertDocsToArray } from '../services/firebaseServices';

const MonthlySiteAnalysisModal = ({ site, building = null, onClose, labour, defaultTab = 'attendance' }) => {
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState(defaultTab);

  const [attendanceRecords, setAttendanceRecords] = useState([]);
  const [dprRecords, setDprRecords] = useState([]);
  const [allMaterials, setAllMaterials] = useState([]);
  const [buildings, setBuildings] = useState([]);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const startDate = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-01`;
        const endDate = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-31`;

        // Fetch Attendance for the month
        const attSnapshot = await attendanceServices.getAttendanceByDateRange(startDate, endDate);
        const allAtt = convertDocsToArray(attSnapshot);
        // BUG FIX B: Building-level filter.
        // Primary match:  a.buildingId === building.id  (all records written after the fix)
        // Fallback match: employeeId contains the building.id  (backward-compat for older
        //                 DPR-written contract/daily records that may lack a buildingId field)
        setAttendanceRecords(
          building
            ? allAtt.filter(a =>
              a.buildingId === building.id ||
              ((a.isContractWorker || a.isDailyWorker) &&
                a.employeeId &&
                a.employeeId.includes(building.id))
            )
            : allAtt.filter(a => a.siteId === site.id)
        );

        // Fetch DPR for the site or building
        // When a building is selected, query DPRs scoped to that building
        // When no building, fall back to site-level (existing behaviour)
        const dprSnapshot = building
          ? await dprServices.getDPRBySiteAndBuilding(site.id, building.id)
          : await dprServices.getDPRBySiteId(site.id);
        const allDpr = convertDocsToArray(dprSnapshot);
        setDprRecords(allDpr.filter(d => {
          const dDate = new Date(d.date);
          return dDate.getMonth() === selectedMonth && dDate.getFullYear() === selectedYear;
        }));

        // Fetch all materials
        const matSnapshot = await materialServices.getAllMaterials();
        setAllMaterials(convertDocsToArray(matSnapshot));

        // Fetch buildings for this site (used for CSV grouping in site-level mode)
        if (!building) {
          const buildingSnapshot = await buildingServices.getBuildingsBySite(site.id);
          setBuildings(convertDocsToArray(buildingSnapshot));
        }

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

  // Staff analysis - strictly building-aware and aggregates daily/contract workers reliably
  const staffAnalysis = useMemo(() => {
    const analysis = {};

    // 1. Add permanent staff assigned strictly to THIS specific scope
    const assignedPermanentStaff = (site.assignedStaff || [])
      .map(empId => labour.find(l => l.id === empId))
      .filter(emp => {
        if (!emp) return false;
        // If a specific building report is requested, ONLY include staff assigned to THAT building
        if (building && emp.buildingId !== building.id) return false;
        return true;
      });

    assignedPermanentStaff.forEach(emp => {
      analysis[emp.id] = {
        id: emp.id,
        emp: { name: emp.name, role: emp.role || 'Staff', dailyWage: emp.dailyWage || 0 },
        days: {}, present: 0, absent: 0, leave: 0,
        buildingId: emp.buildingId || null
      };
    });

    // 2. Process the actual attendance records (which are already securely filtered to the selected building/site)
    attendanceRecords.forEach(record => {
      const day = parseInt(record.date.split('-')[2], 10);
      let groupKey = record.employeeId;

      if (record.isContractWorker) {
        // Force contract workers into a single, unified row for the entire month
        groupKey = `contract_${record.contractorName}_${record.buildingId || 'site'}`;
        if (!analysis[groupKey]) {
          analysis[groupKey] = {
            id: groupKey,
            emp: { name: record.contractorName, role: 'Contractor Pool', dailyWage: 0 },
            days: {}, present: 0, absent: 0, leave: 0, buildingId: record.buildingId
          };
        }
        const count = Number(record.contractWorkerCount || 0);
        if (count > 0) {
          analysis[groupKey].days[day] = (analysis[groupKey].days[day] || 0) + count;
          analysis[groupKey].present += count;
        }
      } else if (record.isDailyWorker) {
        // Force daily workers into a single, unified row for the entire month
        groupKey = `daily_${record.buildingId || 'site'}`;
        if (!analysis[groupKey]) {
          analysis[groupKey] = {
            id: groupKey,
            emp: { name: 'Daily Workers', role: 'Daily Pool', dailyWage: 0 },
            days: {}, present: 0, absent: 0, leave: 0, buildingId: record.buildingId,
            totalLabourCost: 0
          };
        }
        const count = Number(record.dailyWorkerCount || 0);
        const charge = Number(record.labourCharge || 0);
        if (count > 0) {
          analysis[groupKey].days[day] = (analysis[groupKey].days[day] || 0) + count;
          analysis[groupKey].present += count;
          analysis[groupKey].totalLabourCost = (analysis[groupKey].totalLabourCost || 0) + (count * charge);
          // Track the latest non-zero charge for display in the Wage column
          if (charge > 0) analysis[groupKey].emp.dailyWage = charge;
        }
      } else {
        // Standard Permanent Employee Processing
        if (!analysis[groupKey]) {
          const empData = labour.find(l => l.id === groupKey) || { name: 'Unknown', role: '-', dailyWage: 0 };
          analysis[groupKey] = {
            id: groupKey,
            emp: { name: empData.name, role: empData.role, dailyWage: empData.dailyWage || 0 },
            days: {}, present: 0, absent: 0, leave: 0, buildingId: record.buildingId
          };
        }
        analysis[groupKey].days[day] = record.status;
        if (record.status === 'present') analysis[groupKey].present++;
        if (record.status === 'absent') analysis[groupKey].absent++;
        if (record.status === 'leave') analysis[groupKey].leave++;
      }
    });

    return Object.values(analysis).sort((a, b) => (a.emp.name || '').localeCompare(b.emp.name || ''));
  }, [attendanceRecords, site, labour, building]);
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

  // Process analysis
  const processAnalysis = useMemo(() => {
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
  }, [dprRecords]);

  const monthName = new Date(2000, selectedMonth, 1).toLocaleString('default', { month: 'long' });

  const handleDownloadCSV = () => {
    let csvContent = "";


    csvContent += `Site: ${site.name}\r\n`;
    if (building) csvContent += `Building: ${building.name}\r\n`;
    csvContent += `Month: ${monthName} ${selectedYear}\r\n\r\n`;

    // Group staff by building if site has multiple buildings
    const hasMultipleBuildings = buildings.length > 1;
    const buildingGroups = hasMultipleBuildings
      ? buildings.reduce((acc, building) => {
        acc[building.id] = {
          name: building.name,
          staff: staffAnalysis.filter(s => s.buildingId === building.id)
        };
        return acc;
      }, { 'unassigned': { name: 'No Building', staff: staffAnalysis.filter(s => !s.buildingId) } })
      : { 'all': { name: 'All Staff', staff: staffAnalysis } };

    // STAFF - Building-wise if multiple buildings exist
    Object.entries(buildingGroups).forEach(([buildingId, group]) => {
      if (group.staff.length === 0) return;

      csvContent += `--- STAFF ATTENDANCE & SALARY - ${group.name} ---\r\n`;
      csvContent += `Employee,Role,Daily Wage,${daysArray.join(',')},Present,Absent,Leave,Est. Salary\r\n`;
      group.staff.forEach(({ emp, days, present, absent, leave, totalLabourCost }) => {
        const wage = Number(emp.dailyWage || 0);
        const estSalary = (totalLabourCost !== undefined && totalLabourCost > 0)
          ? totalLabourCost
          : present * wage;
        const dayStatuses = daysArray.map(d => {
          const s = days[d];
          return s === 'present' ? 'P' : s === 'absent' ? 'A' : s === 'leave' ? 'L' : (typeof s === 'number' ? s : '-');
        });
        // Escape commas in names
        const safeName = emp.name ? `"${emp.name.replace(/"/g, '""')}"` : 'Unknown';
        csvContent += `${safeName},${emp.role},${wage},${dayStatuses.join(',')},${present},${absent},${leave},${estSalary}\r\n`;
      });
      csvContent += "\r\n";
    });

    // MATERIALS
    csvContent += "--- MATERIAL USAGE & COST ---\r\n";
    csvContent += `Item Name,Type,Unit Price,${daysArray.join(',')},Total Used,Est. Cost\r\n`;
    materialAnalysis.forEach(({ mat, days, totalUsed }) => {
      const price = Number(mat.unitPrice || 0);
      const estCost = totalUsed * price;
      const dayUsages = daysArray.map(d => days[d] || '-');
      const safeMatName = mat.name ? `"${mat.name.replace(/"/g, '""')}"` : 'Unknown';
      csvContent += `${safeMatName},${mat.category},${price},${dayUsages.join(',')},${totalUsed} ${mat.unit},${estCost}\r\n`;
    });

    // PROCESS WORK
    csvContent += "\r\n--- PROCESS WORK PROGRESS ---\r\n";
    csvContent += `Process Name,Unit,${daysArray.join(',')},Total Quantity\r\n`;
    processAnalysis.forEach(({ work, unit, days, totalQuantity }) => {
      const dayQuantities = daysArray.map(d => days[d] || '-');
      const safeWorkName = work ? `"${work.replace(/"/g, '""')}"` : 'Unknown';
      csvContent += `${safeWorkName},${unit},${dayQuantities.join(',')},${totalQuantity} ${unit}\r\n`;
    });

    // Add BOM for Excel UTF-8 compatibility
    const BOM = "\uFEFF";
    const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    const reportLabel = building ? `${building.name}` : site.name;
    link.setAttribute("download", `${reportLabel}_Monthly_Report_${monthName}_${selectedYear}.csv`);
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
        @media (max-width: 640px) {
          .mobile-table th, .mobile-table td {
            padding: 4px 2px !important;
            font-size: 10px !important;
          }
          .mobile-table th {
            min-width: 25px !important;
          }
          .mobile-table .sticky-col {
            min-width: 60px !important;
            max-width: 60px !important;
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
              Monthly Building Analysis
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              {site.name}{building ? <span className="ml-1 text-blue-600 font-medium">› {building.name}</span> : null}
            </p>
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
          <h1 className="text-3xl font-black text-gray-900">Monthly Building Analysis</h1>
          <div className="mt-4 text-gray-600 flex justify-between">
            <div>
              <p><strong>Site:</strong> {site.name}</p>
              {building && <p><strong>Building:</strong> {building.name}</p>}
              <p><strong>Location:</strong> {site.location}</p>
            </div>
            <div className="text-right">
              <p><strong>Month:</strong> {monthName} {selectedYear}</p>
              <p><strong>Generated On:</strong> {new Date().toLocaleDateString()}</p>
            </div>
          </div>
        </div>

        <div className="p-2 sm:p-4 bg-white border-b border-gray-200 shrink-0 flex flex-row gap-2 sm:gap-4 print:hidden">
          <div className="flex-1 sm:max-w-xs">
            <label className="block text-[10px] sm:text-xs font-semibold text-gray-600 mb-0.5 sm:mb-1 uppercase tracking-wider">Month</label>
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(Number(e.target.value))}
              className="w-full p-1.5 sm:p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-xs sm:text-sm"
            >
              {Array.from({ length: 12 }).map((_, i) => (
                <option key={i} value={i}>{new Date(2000, i, 1).toLocaleString('default', { month: 'long' })}</option>
              ))}
            </select>
          </div>
          <div className="flex-1 sm:max-w-xs">
            <label className="block text-[10px] sm:text-xs font-semibold text-gray-600 mb-0.5 sm:mb-1 uppercase tracking-wider">Year</label>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              className="w-full p-1.5 sm:p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-xs sm:text-sm"
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
                    <table className="w-full text-sm text-left border-collapse mobile-table">
                      <thead className="bg-gray-50 border-b border-gray-200 sticky top-0 z-10">
                        <tr>
                          <th className="px-2 py-2 font-semibold text-gray-600 border-r border-gray-200 sticky left-0 bg-gray-50 z-20 min-w-[90px] w-24 text-xs sticky-col">Employee</th>
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
                          staffAnalysis.map(({ emp, days, present, absent, totalLabourCost }) => {
                            const wage = Number(emp.dailyWage || 0);
                            const estSalary = (totalLabourCost !== undefined && totalLabourCost > 0)
                              ? totalLabourCost
                              : present * wage;
                            return (
                              <tr key={emp.id} className="hover:bg-gray-50">
                                <td className="px-2 py-2 font-medium text-gray-900 border-r border-gray-200 sticky left-0 bg-white z-10 text-xs truncate max-w-[90px] sticky-col">
                                  {emp.name}
                                  <span className="block text-[9px] text-gray-400 font-normal truncate">{emp.role}</span>
                                </td>
                                <td className="px-3 py-2 text-gray-600 text-center border-r border-gray-200 text-xs">₹{wage}</td>
                                {daysArray.map(day => {
                                  const status = days[day];
                                  let txt = '-'; let color = 'text-gray-300';
                                  if (status === 'present') { txt = 'P'; color = 'text-green-600 font-bold bg-green-50'; }
                                  else if (status === 'absent') { txt = 'A'; color = 'text-red-600 font-bold bg-red-50'; }
                                  else if (status === 'leave') { txt = 'L'; color = 'text-yellow-600 font-bold bg-yellow-50'; }
                                  else if (typeof status === 'number' && status > 0) { txt = status; color = 'text-green-600 font-bold bg-green-50'; }
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
                    <table className="w-full text-sm text-left border-collapse mobile-table">
                      <thead className="bg-gray-50 border-b border-gray-200 sticky top-0 z-10">
                        <tr>
                          <th className="px-2 py-2 font-semibold text-gray-600 border-r border-gray-200 sticky left-0 bg-gray-50 z-20 min-w-[90px] w-24 text-xs sticky-col">Item Name</th>
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
                                <td className="px-2 py-2 font-medium text-gray-900 border-r border-gray-200 sticky left-0 bg-white z-10 text-xs truncate max-w-[90px] sticky-col">
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

                {/* Process Work Summary */}
                <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
                  <div className="p-4 bg-purple-50 border-b border-purple-100 flex items-center gap-2 sticky left-0">
                    <FileText className="w-5 h-5 text-purple-600" />
                    <h3 className="font-bold text-gray-900">Day-by-Day Process Work Progress</h3>
                  </div>
                  <div className="overflow-x-auto relative">
                    <table className="w-full text-sm text-left border-collapse mobile-table">
                      <thead className="bg-gray-50 border-b border-gray-200 sticky top-0 z-10">
                        <tr>
                          <th className="px-2 py-2 font-semibold text-gray-600 border-r border-gray-200 sticky left-0 bg-gray-50 z-20 min-w-[90px] w-24 text-xs sticky-col">Process Name</th>
                          <th className="px-3 py-2 font-semibold text-gray-600 border-r border-gray-200 text-center">Unit</th>
                          {daysArray.map(day => (
                            <th key={day} className="px-1 py-2 font-semibold text-gray-600 border-r border-gray-200 text-center min-w-[28px] text-xs">
                              {day}
                            </th>
                          ))}
                          <th className="px-3 py-2 font-semibold text-purple-700 text-center border-l border-gray-200">Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {processAnalysis.length > 0 ? (
                          processAnalysis.map(({ work, unit, days, totalQuantity }) => (
                            <tr key={work} className="hover:bg-gray-50">
                              <td className="px-2 py-2 font-medium text-gray-900 border-r border-gray-200 sticky left-0 bg-white z-10 text-xs truncate max-w-[90px] sticky-col">
                                {work}
                              </td>
                              <td className="px-3 py-2 text-gray-600 text-center border-r border-gray-200 text-xs max-w-[50px] truncate">{unit}</td>
                              {daysArray.map(day => {
                                const qty = days[day];
                                return (
                                  <td key={day} className={`px-1 py-2 text-center text-xs border-r border-gray-200 ${qty ? 'font-bold text-gray-800 bg-purple-50' : 'text-gray-300'}`}>
                                    {qty || '-'}
                                  </td>
                                );
                              })}
                              <td className="px-3 py-2 text-center font-bold text-purple-700 border-l border-gray-200">
                                {totalQuantity} <span className="text-[10px] font-normal text-gray-500">{unit}</span>
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr><td colSpan={daysInMonth + 3} className="px-4 py-8 text-center text-gray-500 italic">No process work recorded in DPRs for {monthName}.</td></tr>
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
                      <h4 className="text-[10px] font-bold text-gray-600 mb-1">Part {idx + 1} (Days {chunk[0]} to {chunk[chunk.length - 1]})</h4>
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
                            staffAnalysis.map(({ emp, days, present, absent, totalLabourCost }) => {
                              const wage = Number(emp.dailyWage || 0);
                              const estSalary = (totalLabourCost !== undefined && totalLabourCost > 0)
                                ? totalLabourCost
                                : present * wage;
                              return (
                                <tr key={emp.id}>
                                  <td className="px-1 py-1 font-medium text-gray-900 border-r border-gray-300">{emp.name}</td>
                                  <td className="px-1 py-1 text-gray-800 text-center border-r border-gray-300">₹{wage}</td>
                                  {chunk.map(day => {
                                    const status = days[day];
                                    let txt = '-'; let color = 'text-gray-400';
                                    if (status === 'present') { txt = 'P'; color = 'text-gray-900 font-bold'; }
                                    else if (status === 'absent') { txt = 'A'; color = 'text-gray-900 font-bold'; }
                                    else if (status === 'leave') { txt = 'L'; color = 'text-gray-900 font-bold'; }
                                    else if (typeof status === 'number' && status > 0) { txt = status; color = 'text-gray-900 font-bold'; }
                                    return <td key={day} className={`px-1 py-1 text-center border-r border-gray-300 ${color}`}>{txt}</td>;
                                  })}
                                  {idx === 1 && (
                                    <>  
                                      <td className="px-1 py-1 text-center font-bold text-gray-900 border-l border-gray-300">{present}</td>
                                      <td className="px-1 py-1 text-center font-bold text-gray-900 border-x border-gray-300">{absent}</td>
                                      <td className="px-1 py-1 text-right font-black text-gray-900">₹{estSalary.toLocaleString()}</td>
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
                      <h4 className="text-[10px] font-bold text-gray-600 mb-1">Part {idx + 1} (Days {chunk[0]} to {chunk[chunk.length - 1]})</h4>
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

                {/* Process Work Split */}
                <div className="break-inside-avoid mt-8">
                  <div className="p-2 bg-gray-100 border-b border-gray-300 flex items-center gap-2 mb-2">
                    <FileText className="w-4 h-4 text-gray-800" />
                    <h3 className="font-bold text-gray-900 text-sm">Day-by-Day Process Work Progress</h3>
                  </div>
                  {[daysArray.slice(0, 16), daysArray.slice(16)].map((chunk, idx) => (
                    <div key={idx} className={`mb-6 ${idx === 1 ? 'break-inside-avoid' : ''}`}>
                      <h4 className="text-[10px] font-bold text-gray-600 mb-1">Part {idx + 1} (Days {chunk[0]} to {chunk[chunk.length - 1]})</h4>
                      <table className="w-full text-left border-collapse print-compact-table border border-gray-300">
                        <thead className="bg-gray-100 border-b border-gray-300">
                          <tr>
                            <th className="px-1 py-1 font-semibold text-gray-800 border-r border-gray-300">Process Name</th>
                            <th className="px-1 py-1 font-semibold text-gray-800 border-r border-gray-300 text-center">Unit</th>
                            {chunk.map(day => (
                              <th key={day} className="px-1 py-1 font-semibold text-gray-800 border-r border-gray-300 text-center">{day}</th>
                            ))}
                            {idx === 1 && (
                              <th className="px-1 py-1 font-semibold text-gray-900 text-right border-l border-gray-300">Total</th>
                            )}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-300">
                          {processAnalysis.length > 0 ? (
                            processAnalysis.map(({ work, unit, days, totalQuantity }) => (
                              <tr key={work}>
                                <td className="px-1 py-1 font-medium text-gray-900 border-r border-gray-300">{work}</td>
                                <td className="px-1 py-1 text-gray-800 text-center border-r border-gray-300">{unit}</td>
                                {chunk.map(day => {
                                  const qty = days[day];
                                  return <td key={day} className={`px-1 py-1 text-center border-r border-gray-300 ${qty ? 'font-bold text-gray-900' : 'text-gray-400'}`}>{qty || '-'}</td>;
                                })}
                                {idx === 1 && (
                                  <td className="px-1 py-1 text-right font-black text-gray-900 border-l border-gray-300">{totalQuantity} <span className="font-normal">{unit}</span></td>
                                )}
                              </tr>
                            ))
                          ) : (
                            <tr><td colSpan={chunk.length + (idx === 1 ? 3 : 2)} className="px-2 py-4 text-center text-gray-600 italic">No process work records.</td></tr>
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
