import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { X, Users, Package, TrendingUp, Download, FileText } from 'lucide-react';
import { attendanceServices, dprServices, materialServices, buildingServices, convertDocsToArray } from '../services/firebaseServices';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const MonthlySiteAnalysisModal = ({ site, building = null, onClose, labour, defaultTab = 'attendance' }) => {
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [loading, setLoading] = useState(false);

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

        const attSnapshot = await attendanceServices.getAttendanceByDateRange(startDate, endDate);
        const allAtt = convertDocsToArray(attSnapshot);
        setAttendanceRecords(
          building
            ? allAtt.filter(a =>
              a.buildingId === building.id ||
              ((a.isContractWorker || a.isDailyWorker) &&
                a.employeeId &&
                a.employeeId.includes(building.id))
            )
            : allAtt.filter(a =>
              a.siteId === site.id ||
              ((a.isContractWorker || a.isDailyWorker) &&
                a.employeeId &&
                a.employeeId.includes(site.id))
            )
        )
        const dprSnapshot = building
          ? await dprServices.getDPRBySiteAndBuilding(site.id, building.id)
          : await dprServices.getDPRBySiteId(site.id);
        const allDpr = convertDocsToArray(dprSnapshot);
        setDprRecords(allDpr.filter(d => {
          const dDate = new Date(d.date);
          return dDate.getMonth() === selectedMonth && dDate.getFullYear() === selectedYear;
        }));

        const matSnapshot = await materialServices.getAllMaterials();
        setAllMaterials(convertDocsToArray(matSnapshot));

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

  const daysInMonth = new Date(selectedYear, selectedMonth + 1, 0).getDate();
  const daysArray = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const monthName = new Date(2000, selectedMonth, 1).toLocaleString('default', { month: 'long' });

  // --- DATA MEMOIZATION ---
  const staffAnalysis = useMemo(() => {
    const analysis = {};
    const assignedPermanentStaff = (site.assignedStaff || [])
      .map(empId => labour.find(l => l.id === empId))
      .filter(emp => {
        if (!emp) return false;
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

    attendanceRecords.forEach(record => {
      const day = parseInt(record.date.split('-')[2], 10);
      let groupKey = record.employeeId;

      if (record.isContractWorker) {
        groupKey = `contract_${record.contractorName}_${record.buildingId || 'site'}`;
        if (!analysis[groupKey]) {
          analysis[groupKey] = {
            id: groupKey,
            emp: { name: record.contractorName, role: 'Subcontractor Pool', dailyWage: 0 },
            days: {}, present: 0, absent: 0, leave: 0, buildingId: record.buildingId
          };
        }
        const count = Number(record.contractWorkerCount || 0);
        if (count > 0) {
          analysis[groupKey].days[day] = (analysis[groupKey].days[day] || 0) + count;
          analysis[groupKey].present += count;
        }
      } else if (record.isDailyWorker) {
        const charge = Number(record.labourCharge || 0);
        groupKey = `daily_${record.buildingId || 'site'}_${charge}`;
        if (!analysis[groupKey]) {
          analysis[groupKey] = {
            id: groupKey,
            emp: { name: `Daily Workers (₹${charge}/day)`, role: 'Daily Pool', dailyWage: charge },
            days: {}, present: 0, absent: 0, leave: 0, buildingId: record.buildingId,
            totalLabourCost: 0
          };
        }
        const count = Number(record.dailyWorkerCount || 0);
        if (count > 0) {
          analysis[groupKey].days[day] = (analysis[groupKey].days[day] || 0) + count;
          analysis[groupKey].present += count;
          analysis[groupKey].totalLabourCost = (analysis[groupKey].totalLabourCost || 0) + (count * charge);
        }
      } else {
        if (!analysis[groupKey]) {
          const empData = labour.find(l => l.id === groupKey) || { name: 'Unknown', role: '-', dailyWage: 0 };
          analysis[groupKey] = {
            id: groupKey,
            emp: {
              name: empData.name,
              role: empData.role,
              dailyWage: empData.dailyWage || 0,
              employmentType: empData.employmentType
            },
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

    return Object.values(analysis).sort((a, b) => {
      const lastDayA = Math.max(...Object.keys(a.days).map(Number));
      const lastDayB = Math.max(...Object.keys(b.days).map(Number));

      if (lastDayA !== lastDayB) {
        return lastDayB - lastDayA;
      }

      return a.work.localeCompare(b.work);
    });
  }, [dprRecords]);

  // --- EXPORT HANDLERS ---
  const handleDownloadCSV = () => {
    let csvContent = `Site: ${site.name}\r\n`;
    if (building) csvContent += `Building: ${building.name}\r\n`;
    csvContent += `Month: ${monthName} ${selectedYear}\r\n\r\n`;

    const hasMultipleBuildings = buildings.length > 1;
    const buildingGroups = hasMultipleBuildings
      ? buildings.reduce((acc, bldg) => {
        acc[bldg.id] = { name: bldg.name, staff: staffAnalysis.filter(s => s.buildingId === bldg.id) };
        return acc;
      }, { 'unassigned': { name: 'No Building', staff: staffAnalysis.filter(s => !s.buildingId) } })
      : { 'all': { name: 'All Staff', staff: staffAnalysis } };

    Object.entries(buildingGroups).forEach(([buildingId, group]) => {
      if (group.staff.length === 0) return;
      csvContent += `--- STAFF ATTENDANCE & SALARY - ${group.name} ---\r\n`;
      csvContent += `Employee,Role,Daily Wage,${daysArray.join(',')},Present,Absent,Leave,Est. Salary\r\n`;
      group.staff.forEach(({ emp, days, present, absent, leave, totalLabourCost }) => {
        const wage = Number(emp.dailyWage || 0);
        const isDaily = totalLabourCost !== undefined;
        const estSalary = isDaily ? totalLabourCost : (emp.role === 'Subcontractor Pool' ? 0 : Math.round(wage * present));
        const dayStatuses = daysArray.map(d => {
          const s = days[d];
          return s === 'present' ? 'P' : s === 'absent' ? 'A' : s === 'leave' ? 'L' : (typeof s === 'number' ? s : '-');
        });
        const safeName = emp.name ? `"${emp.name.replace(/"/g, '""')}"` : 'Unknown';
        csvContent += `${safeName},${emp.role},${wage},${dayStatuses.join(',')},${present},${absent},${leave},${estSalary}\r\n`;
      });
      csvContent += "\r\n";
    });

    csvContent += "--- MATERIAL USAGE & COST ---\r\n";
    csvContent += `Item Name,Type,Unit Price,${daysArray.join(',')},Total Used,Est. Cost\r\n`;
    materialAnalysis.forEach(({ mat, days, totalUsed }) => {
      const price = Number(mat.unitPrice || 0);
      const estCost = totalUsed * price;
      const dayUsages = daysArray.map(d => days[d] || '-');
      const safeMatName = mat.name ? `"${mat.name.replace(/"/g, '""')}"` : 'Unknown';
      csvContent += `${safeMatName},${mat.category},${price},${dayUsages.join(',')},${totalUsed} ${mat.unit},${estCost}\r\n`;
    });

    csvContent += "\r\n--- PROCESS WORK PROGRESS ---\r\n";
    csvContent += `Process Name,Unit,${daysArray.join(',')},Total Quantity\r\n`;
    processAnalysis.forEach(({ work, unit, days, totalQuantity }) => {
      const dayQuantities = daysArray.map(d => days[d] || '-');
      const safeWorkName = work ? `"${work.replace(/"/g, '""')}"` : 'Unknown';
      csvContent += `${safeWorkName},${unit},${dayQuantities.join(',')},${totalQuantity} ${unit}\r\n`;
    });

    const BOM = "\uFEFF";
    const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `${building ? building.name : site.name}_Monthly_Report_${monthName}_${selectedYear}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleExportPDF = () => {
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const pageWidth = doc.internal.pageSize.width;

    doc.setFontSize(20);
    doc.setTextColor(40, 40, 40);
    doc.text('Monthly Building Analysis', 14, 20);

    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    doc.text(`Site: ${site.name}`, 14, 28);
    if (building) doc.text(`Building: ${building.name}`, 14, 34);

    doc.text(`Month: ${monthName} ${selectedYear}`, pageWidth - 14, 28, { align: 'right' });
    doc.text(`Generated: ${new Date().toLocaleDateString()}`, pageWidth - 14, 34, { align: 'right' });

    const tableConfig = {
      theme: 'grid',
      styles: { fontSize: 7, cellPadding: 1.5, lineColor: [200, 200, 200], lineWidth: 0.1 },
      headStyles: { fillColor: [240, 240, 240], textColor: [40, 40, 40], fontStyle: 'bold', halign: 'center' },
      columnStyles: { 0: { halign: 'left', cellWidth: 35 } },
      margin: { top: 15, right: 14, bottom: 15, left: 14 },
    };

    let finalY = 45;

    if (staffAnalysis.length > 0) {
      autoTable(doc, {
        ...tableConfig,
        startY: finalY,
        head: [['Employee', 'Wage', ...daysArray, 'P', 'A', 'Salary']],
        body: staffAnalysis.map(s => {
          const wage = Number(s.emp.dailyWage || 0);
          const estSalary = s.totalLabourCost !== undefined
            ? s.totalLabourCost
            : (s.emp.role === 'Subcontractor Pool' ? 0 : Math.round(wage * s.present));

          return [
            `${s.emp.name}\n(${s.emp.role})`,
            `Rs ${wage}`,
            ...daysArray.map(d => {
              const status = s.days[d];
              if (status === 'present') return 'P';
              if (status === 'absent') return 'A';
              if (status === 'leave') return 'L';
              if (typeof status === 'number' && status > 0) return status.toString();
              return '-';
            }),
            s.present,
            s.absent,
            `Rs ${estSalary.toLocaleString()}`
          ];
        }),
        didParseCell: function (data) {
          if (data.section === 'body' && data.column.index >= 2 && data.column.index <= 32) {
            const val = data.cell.raw;
            if (val === 'P' || !isNaN(val)) data.cell.styles.textColor = [34, 197, 94];
            if (val === 'A') data.cell.styles.textColor = [239, 68, 68];
            if (val === 'L') data.cell.styles.textColor = [234, 179, 8];
            data.cell.styles.halign = 'center';
          }
        }
      });
      finalY = doc.lastAutoTable.finalY + 15;
    }

    if (materialAnalysis.length > 0) {
      doc.setFontSize(14);
      doc.setTextColor(40, 40, 40);
      doc.text('Material & Tools Usage', 14, finalY);

      autoTable(doc, {
        ...tableConfig,
        startY: finalY + 5,
        head: [['Item Name', 'Price/Unit', ...daysArray, 'Total', 'Cost']],
        body: materialAnalysis.map(m => {
          const price = Number(m.mat.unitPrice || 0);
          return [
            m.mat.name,
            `Rs ${price}/${m.mat.unit}`,
            ...daysArray.map(d => m.days[d] || '-'),
            `${m.totalUsed} ${m.mat.unit}`,
            `Rs ${(m.totalUsed * price).toLocaleString()}`
          ];
        })
      });
      finalY = doc.lastAutoTable.finalY + 15;
    }

    if (processAnalysis.length > 0) {
      doc.setFontSize(14);
      doc.setTextColor(40, 40, 40);
      doc.text('Process Work Progress', 14, finalY);

      autoTable(doc, {
        ...tableConfig,
        startY: finalY + 5,
        head: [['Process Name', 'Unit', ...daysArray, 'Total Qty']],
        body: processAnalysis.map(p => [
          p.work,
          p.unit,
          ...daysArray.map(d => p.days[d] || '-'),
          `${p.totalQuantity} ${p.unit}`
        ])
      });
    }

    doc.save(`Monthly-Report-${building ? building.name.replace(/\s+/g, '-') : site.name.replace(/\s+/g, '-')}-${monthName}-${selectedYear}.pdf`);
  };

  if (!site) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 z-[70]" onClick={onClose}>
      <style>{`
        @media (max-width: 640px) {
          .mobile-table th, .mobile-table td {
            padding: 4px 2px !important;
            font-size: 10px !important;
          }
          .mobile-table th { min-width: 25px !important; }
          .mobile-table .sticky-col { min-width: 60px !important; max-width: 60px !important; }
        }
      `}</style>

      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        onClick={e => e.stopPropagation()}
        className="bg-gray-50 rounded-2xl w-full flex flex-col shadow-2xl overflow-hidden max-w-[95vw] h-[95vh]"
      >
        <div className="p-3 sm:p-4 border-b border-gray-200 bg-white flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shrink-0">
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
            <button onClick={handleExportPDF} className="flex-1 sm:flex-none flex items-center justify-center gap-1 px-3 py-1.5 bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 rounded-lg text-sm font-semibold transition-colors shrink-0">
              <Download className="w-4 h-4" /> Export PDF
            </button>
            <button onClick={onClose} className="hidden sm:block p-1.5 hover:bg-gray-100 rounded-full transition text-gray-500 ml-2">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="p-2 sm:p-4 bg-white border-b border-gray-200 shrink-0 flex flex-row gap-2 sm:gap-4">
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

        <div className="flex-1 overflow-y-auto p-2 sm:p-4 space-y-6 bg-gray-50">
          {loading ? (
            <div className="flex justify-center items-center py-20">
              <div className="animate-spin w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full" />
            </div>
          ) : (
            <div className="space-y-8">
              {/* Staff Table */}
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
                          <th key={day} className="px-1 py-2 font-semibold text-gray-600 border-r border-gray-200 text-center min-w-[28px] text-xs">{day}</th>
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
                          const isDaily = totalLabourCost !== undefined;
                          const estSalary = isDaily ? totalLabourCost : (emp.role === 'Subcontractor Pool' ? 0 : Math.round(wage * present));
                          return (
                            <tr key={emp.id} className="hover:bg-gray-50">
                              <td className="px-2 py-2 font-medium text-gray-900 border-r border-gray-200 sticky left-0 bg-white z-10 text-xs truncate max-w-[90px] sticky-col" title={emp.name}>
                                <div className="flex items-center gap-1">
                                  <span className="truncate">{emp.name}</span>
                                </div>
                                <span className="block text-[9px] text-gray-400 font-normal truncate mt-0.5">{emp.role}</span>
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

              {/* Material Table */}
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
                          <th key={day} className="px-1 py-2 font-semibold text-gray-600 border-r border-gray-200 text-center min-w-[30px] text-xs">{day}</th>
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

              {/* Process Work Table */}
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
                          <th key={day} className="px-1 py-2 font-semibold text-gray-600 border-r border-gray-200 text-center min-w-[28px] text-xs">{day}</th>
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
          )}
        </div>
      </motion.div>
    </div>
  );
};

export default MonthlySiteAnalysisModal;