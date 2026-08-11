import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, TrendingUp, Download, Printer, FileText } from 'lucide-react';
import { dprServices, convertDocsToArray } from '../services/firebaseServices';

const ProcessMonthlyAnalysisModal = ({ site, onClose }) => {
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [loading, setLoading] = useState(false);
  const [dprRecords, setDprRecords] = useState([]);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const dprSnapshot = await dprServices.getDPRBySiteId(site.id);
        const allDpr = convertDocsToArray(dprSnapshot);
        setDprRecords(allDpr.filter(d => {
          const dDate = new Date(d.date);
          return dDate.getMonth() === selectedMonth && dDate.getFullYear() === selectedYear;
        }));
      } catch (err) {
        console.error("Error fetching process data", err);
      }
      setLoading(false);
    };
    
    if (site) fetchData();
  }, [site, selectedMonth, selectedYear]);

  const daysInMonth = new Date(selectedYear, selectedMonth + 1, 0).getDate();
  const daysArray = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  const processAnalysis = useMemo(() => {
    const analysis = {};
    
    dprRecords.forEach(dpr => {
      const day = parseInt(dpr.date.split('-')[2], 10);
      
      // Process from processEntries (new format)
      if (dpr.processEntries) {
        dpr.processEntries.forEach(pe => {
          const workName = pe.work || 'Unknown';
          if (!analysis[workName]) {
            analysis[workName] = {
              work: workName,
              unit: pe.unit || '',
              days: {},
              totalQuantity: 0,
              remarks: {}
            };
          }
          const qty = Number(pe.quantity || 0);
          if (!analysis[workName].days[day]) analysis[workName].days[day] = 0;
          analysis[workName].days[day] += qty;
          analysis[workName].totalQuantity += qty;
          if (pe.remark) {
            analysis[workName].remarks[day] = pe.remark;
          }
        });
      }
      
      // Process from processProgress (old format)
      if (dpr.processProgress) {
        Object.entries(dpr.processProgress).forEach(([processKey, processData]) => {
          const workName = processData.name || processKey;
          if (!analysis[workName]) {
            analysis[workName] = {
              work: workName,
              unit: processData.unit || 'sq ft',
              days: {},
              totalQuantity: 0,
              remarks: {}
            };
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
    csvContent += `Month: ${monthName} ${selectedYear}\r\n\r\n`;
    
    csvContent += "--- PROCESS WORK ANALYSIS ---\r\n";
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
    link.setAttribute("download", `${site.name}_Process_Analysis_${monthName}_${selectedYear}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleDownloadPDF = () => {
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
              Process Monthly Analysis
            </h2>
            <p className="text-sm text-gray-500 mt-1">{site.name}</p>
            <button onClick={onClose} className="sm:hidden p-1.5 hover:bg-gray-100 rounded-full transition text-gray-500">
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="flex flex-wrap items-center justify-start sm:justify-end gap-2 w-full sm:w-auto shrink-0">
            <button onClick={handleDownloadCSV} className="flex items-center gap-1 px-3 py-1.5 bg-green-50 text-green-700 border border-green-200 hover:bg-green-100 rounded-lg text-sm font-semibold transition-colors shrink-0">
              <Download className="w-4 h-4" /> Excel
            </button>
            <button onClick={handleDownloadPDF} className="flex-1 sm:flex-none flex items-center justify-center gap-1 px-3 py-1.5 bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 rounded-lg text-sm font-semibold transition-colors shrink-0">
              <Printer className="w-4 h-4" /> PDF
            </button>
            <button onClick={onClose} className="hidden sm:block p-1.5 hover:bg-gray-100 rounded-full transition text-gray-500 ml-2">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Print Header */}
        <div className="hidden print:block p-8 pb-4 border-b border-gray-200">
          <h1 className="text-3xl font-black text-gray-900">Process Monthly Analysis</h1>
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
              {/* Web View */}
              <div className="print:hidden">
                <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
                  <div className="p-4 bg-purple-50 border-b border-purple-100 flex items-center gap-2 sticky left-0">
                    <FileText className="w-5 h-5 text-purple-600" />
                    <h3 className="font-bold text-gray-900">Day-by-Day Process Work Progress</h3>
                  </div>
                  <div className="overflow-x-auto relative">
                    <table className="w-full text-sm text-left border-collapse">
                      <thead className="bg-gray-50 border-b border-gray-200 sticky top-0 z-10">
                        <tr>
                          <th className="px-2 py-2 font-semibold text-gray-600 border-r border-gray-200 sticky left-0 bg-gray-50 z-20 min-w-[120px] w-32 text-xs">Process Name</th>
                          <th className="px-3 py-2 font-semibold text-gray-600 border-r border-gray-200 text-center">Unit</th>
                          {daysArray.map(day => (
                            <th key={day} className="px-1 py-2 font-semibold text-gray-600 border-r border-gray-200 text-center min-w-[28px] text-xs">
                              {day}
                            </th>
                          ))}
                          <th className="px-3 py-2 font-semibold text-purple-700 text-center border-l border-gray-200 min-w-[100px]">Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {processAnalysis.length > 0 ? (
                          processAnalysis.map(({ work, unit, days, totalQuantity }) => (
                            <tr key={work} className="hover:bg-gray-50">
                              <td className="px-2 py-2 font-medium text-gray-900 border-r border-gray-200 sticky left-0 bg-white z-10 text-xs truncate max-w-[120px]">
                                {work}
                              </td>
                              <td className="px-3 py-2 text-gray-600 text-center border-r border-gray-200 text-xs">{unit}</td>
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
                          <tr><td colSpan={daysInMonth + 3} className="px-4 py-8 text-center text-gray-500 italic">No process records found for {monthName}.</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* Print View */}
              <div className="hidden print:block">
                <div className="break-inside-avoid">
                  <div className="p-2 bg-gray-100 border-b border-gray-300 flex items-center gap-2 mb-2">
                    <FileText className="w-4 h-4 text-gray-800" />
                    <h3 className="font-bold text-gray-900 text-sm">Day-by-Day Process Work Progress</h3>
                  </div>
                  {[daysArray.slice(0, 16), daysArray.slice(16)].map((chunk, idx) => (
                    <div key={idx} className={`mb-6 ${idx === 1 ? 'break-inside-avoid' : ''}`}>
                      <h4 className="text-[10px] font-bold text-gray-600 mb-1">Part {idx + 1} (Days {chunk[0]} to {chunk[chunk.length-1]})</h4>
                      <table className="w-full text-left border-collapse print-compact-table border border-gray-300">
                        <thead className="bg-gray-100 border-b border-gray-300">
                          <tr>
                            <th className="px-1 py-1 font-semibold text-gray-800 border-r border-gray-300">Process Name</th>
                            <th className="px-1 py-1 font-semibold text-gray-800 border-r border-gray-300 text-center">Unit</th>
                            {chunk.map(day => (
                              <th key={day} className="px-1 py-1 font-semibold text-gray-800 border-r border-gray-300 text-center">{day}</th>
                            ))}
                            {idx === 1 && (
                              <th className="px-1 py-1 font-semibold text-gray-800 text-center border-l border-gray-300">Total</th>
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
                                  <td className="px-1 py-1 text-center font-bold text-gray-900 border-l border-gray-300">{totalQuantity} {unit}</td>
                                )}
                              </tr>
                            ))
                          ) : (
                            <tr><td colSpan={chunk.length + (idx === 1 ? 3 : 2)} className="px-2 py-4 text-center text-gray-600 italic">No process records.</td></tr>
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

export default ProcessMonthlyAnalysisModal;
