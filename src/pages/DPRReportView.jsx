import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Building2, Calendar, HardHat, FileText, CheckSquare, Package, Download, IndianRupee } from 'lucide-react';
import { siteServices, attendanceServices, labourServices, dprServices, materialServices, convertDocsToArray, expenseServices, buildingServices } from '../services/firebaseServices';
import html2pdf from 'html2pdf.js';

const DPRReportView = () => {
  const { siteId, buildingId, date } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);

  const [site, setSite] = useState(null);
  const [building, setBuilding] = useState(null);
  const [attendance, setAttendance] = useState([]);
  const [labour, setLabour] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [dpr, setDpr] = useState(null);
  const [expenses, setExpenses] = useState([]);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        // Fetch Site
        const siteDoc = await siteServices.getSiteById(siteId);
        if (siteDoc.exists()) {
          setSite({ id: siteDoc.id, ...siteDoc.data() });
        }

        if (buildingId) {
          const buildingDoc = await buildingServices.getBuildingById(buildingId);
          if (buildingDoc.exists()) {
            setBuilding({ id: buildingDoc.id, ...buildingDoc.data() });
          }
        }

        // Fetch Labour for mapping names
        const labSnap = await labourServices.getAllLabour();
        const allLabour = convertDocsToArray(labSnap);
        setLabour(allLabour);

        // Fetch Materials for fetching global stock
        const matSnap = await materialServices.getAllMaterials();
        const allMaterials = convertDocsToArray(matSnap);
        setMaterials(allMaterials);
        const attSnap = await attendanceServices.getAttendanceByDate(date);
        const allAtt = convertDocsToArray(attSnap);
        setAttendance(allAtt.filter(a => {
          const siteMatch = a.siteId === siteId ||
            ((a.isContractWorker || a.isDailyWorker) &&
              a.employeeId &&
              a.employeeId.includes(siteId));
          if (!siteMatch) return false;
          if (buildingId) {
            // Building-level report: match buildingId directly or via employeeId
            return a.buildingId === buildingId ||
              ((a.isContractWorker || a.isDailyWorker) &&
                a.employeeId &&
                a.employeeId.includes(buildingId));
          }
          return true;
        }));

        // Fetch DPR for square footage process
        const dprSnap = await dprServices.getDPRBySiteId(siteId);
        const allDprs = convertDocsToArray(dprSnap);
        setDpr(allDprs.find(d => d.date === date && !d.is_deleted && (!buildingId || d.buildingId === buildingId)));

        // Fetch Expenses
        const expSnap = await expenseServices.getExpensesBySiteAndDate(siteId, date);
        setExpenses(convertDocsToArray(expSnap));

      } catch (err) {
        console.error('Error fetching report data:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [siteId, date]);

  const handleDownloadPdf = () => {
    const element = document.getElementById('report-canvas');
    if (!element) return;

    const opt = {
      margin: 0.4,
      filename: `DPR-${site.name.replace(/\s+/g, '-')}-${date}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true },
      jsPDF: { unit: 'in', format: 'a4', orientation: 'portrait' }
    };

    html2pdf().set(opt).from(element).save();
  };

  if (loading) return <div className="p-8 text-center bg-gray-50 min-h-screen">Loading Report...</div>;
  if (!site) return <div className="p-8 text-center text-red-600 bg-gray-50 min-h-screen">Site Report Not Found!</div>;

  const presentLabour = attendance.filter(a => a.status === 'present');
  const absentLabour = attendance.filter(a => a.status === 'absent');

  const getEmpDetails = (att) => {
    if (att.isDailyWorker) {
      return { name: `Daily Workers (${att.dailyWorkerCount || 0} Total)`, id: att.employeeId };
    }
    if (att.isContractWorker) {
      return { name: `Contract Workers - ${att.contractorName} (${att.contractWorkerCount || 0} Total)`, id: att.employeeId };
    }
    return labour.find(l => l.id === att.employeeId) || { name: 'Unknown', role: 'Unknown', id: att.employeeId };
  };

  const getMaterialDetails = (matId) => {
    return materials.find(m => m.id === matId) || { currentStock: 'N/A' };
  };

  const currentAreaDone = dpr?.doneSq || 0;
  const siteTotalSq = parseFloat(site.totalSq) || 0;
  const siteOverallDoneSq = parseFloat(site.doneSq) || 0;
  const overridePercent = siteTotalSq > 0 ? ((siteOverallDoneSq) / siteTotalSq) * 100 : 0;

  return (
    <div className="bg-gray-50 min-h-screen pb-12 print:bg-white print:pb-0">
      {/* Header - Hidden on print */}
      <div className="bg-white border-b border-gray-200 print:hidden">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="py-6 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button onClick={() => navigate('/dpr')} className="p-2 bg-gray-100 hover:bg-gray-200 rounded-full transition-colors text-gray-600">
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div>
                <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                  <FileText className="w-6 h-6 text-blue-600" />
                  DPR Final Report
                </h1>
                <p className="text-gray-500 text-sm mt-1">Review and print today's progress</p>
              </div>
            </div>
            <button
              onClick={handleDownloadPdf}
              className="flex items-center gap-2 px-5 py-2.5 bg-gray-900 text-white rounded-lg font-medium hover:bg-gray-800 transition shadow-sm"
            >
              <Download className="w-4 h-4" />
              Download PDF
            </button>
          </div>
        </div>
      </div>

      {/* Report A4 Document Canvas */}
      <div className="max-w-4xl mx-auto mt-8 px-4 sm:px-6 lg:px-8 print:mt-0 print:px-0">
        <div id="report-canvas" className="bg-white rounded-xl shadow-lg border border-gray-200 p-8 sm:p-12 print:shadow-none print:border-none print:p-0 relative overflow-hidden">

          {/* Document Header */}
          <div className="flex items-start justify-between border-b-2 border-gray-900 pb-6 mb-8">
            <div>
              <h1 className="text-3xl font-black text-gray-900 uppercase tracking-tight">Daily Progress Report</h1>
              <p className="text-gray-600 mt-2 font-medium flex items-center gap-2">
                <Building2 className="w-4 h-4" /> {building ? `${site.name} - ${building.name}` : site.name}
              </p>
            </div>
            <div className="text-right">
              <div className="bg-gray-100 px-4 py-2 rounded-lg inline-block">
                <p className="text-sm font-bold text-gray-800 uppercase tracking-wider mb-1">Date</p>
                <p className="text-xl font-medium text-blue-700 flex items-center gap-2">
                  <Calendar className="w-5 h-5" />
                  {date}
                </p>
              </div>
            </div>
          </div>

          {/* Section 1: Process Entries */}
          {(dpr?.processEntries && dpr.processEntries.length > 0) && (
            <div className="mb-10 page-break-inside-avoid">
              <div className="flex items-center gap-2 mb-4">
                <CheckSquare className="w-5 h-5 text-gray-700" />
                <h2 className="text-xl font-bold text-gray-900 border-b border-gray-200 pb-1 w-full flex-1">Today's Process Work</h2>
              </div>

              <div className="overflow-x-auto border border-gray-200 rounded-lg">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Work Description</th>
                      <th className="px-6 py-3 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">Quantity</th>
                      <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Unit</th>
                      <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Remark</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {dpr.processEntries.map((entry, idx) => (
                      <tr key={idx}>
                        <td className="px-6 py-3 text-sm font-medium text-gray-900">{entry.work}</td>
                        <td className="px-6 py-3 text-sm text-gray-900 font-bold text-right">{entry.quantity}</td>
                        <td className="px-6 py-3 text-sm text-gray-600">{entry.unit}</td>
                        <td className="px-6 py-3 text-sm text-gray-600">{entry.remark || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Section 2: Work Progress Summary */}
          {/* <div className="mb-10 page-break-inside-avoid">
            <div className="flex items-center gap-2 mb-4">
              <CheckSquare className="w-5 h-5 text-gray-700" />
              <h2 className="text-xl font-bold text-gray-900 border-b border-gray-200 pb-1 w-full flex-1">Work Progress Summary</h2>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 bg-gray-50 p-6 rounded-lg border border-gray-200">
              <div>
                <p className="text-sm text-gray-500 uppercase font-semibold mb-1">Today's Progress</p>
                <p className="text-3xl font-bold text-green-600">+{currentAreaDone} <span className="text-base font-normal text-gray-500">SQ FT</span></p>
              </div>
              <div>
                <p className="text-sm text-gray-500 uppercase font-semibold mb-1">Overall Completed</p>
                <p className="text-3xl font-bold text-gray-900">{siteOverallDoneSq} <span className="text-base font-normal text-gray-500">SQ FT</span></p>
              </div>
              <div>
                <p className="text-sm text-gray-500 uppercase font-semibold mb-1">Total Project Target</p>
                <p className="text-3xl font-bold text-gray-900">{siteTotalSq} <span className="text-base font-normal text-gray-500">SQ FT</span></p>
              </div>
            </div>
            
            <div className="mt-4 px-1">
              <div className="flex justify-between text-xs font-semibold mb-1 text-gray-600">
                <span>Overall Project Completion</span>
                <span>{overridePercent.toFixed(1)}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2.5 print:border print:border-gray-300">
                <div className="bg-gray-900 h-2.5 rounded-full print:bg-gray-600" style={{ width: `${overridePercent}%` }}></div>
              </div>
            </div>
          </div> */}

          {/* Section 2: Attendance */}
          <div className="mb-10 page-break-inside-avoid">
            <div className="flex items-center gap-2 mb-4">
              <HardHat className="w-5 h-5 text-gray-700" />
              <h2 className="text-xl font-bold text-gray-900 border-b border-gray-200 pb-1 w-full flex-1">Labour Attendance</h2>
            </div>

            <div className="flex gap-4 mb-4">
              <span className="bg-green-100 text-green-800 font-semibold px-3 py-1 rounded-md text-sm border border-green-200">
                Present: {presentLabour.length}
              </span>
              <span className="bg-red-100 text-red-800 font-semibold px-3 py-1 rounded-md text-sm border border-red-200">
                Absent: {absentLabour.length}
              </span>
            </div>

            {presentLabour.length > 0 || absentLabour.length > 0 ? (
              <div className="overflow-x-auto border border-gray-200 rounded-lg">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Employee Name (ID)</th>
                      <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Status</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {[...presentLabour, ...absentLabour]
                      .sort((a, b) => {
                        const empA = getEmpDetails(a);
                        const empB = getEmpDetails(b);
                        return (empA.name || '').localeCompare(empB.name || '');
                      })
                      .map((att) => {
                        const emp = getEmpDetails(att);
                        const isPresent = att.status === 'present';
                        return (
                          <tr key={att.id}>
                            <td className="px-6 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                              {emp.name} <span className="text-gray-400 text-xs ml-1">({emp.id ? emp.id.substring(0, 6) : 'N/A'})</span>
                            </td>
                            <td className={`px-6 py-3 whitespace-nowrap text-sm font-bold ${isPresent ? 'text-green-600' : 'text-red-600'}`}>
                              {isPresent ? 'P' : 'A'}
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-gray-500 text-sm italic py-2">No workers marked present or absent for today.</p>
            )}
          </div>

          {/* Section 3: Material Usage */}
          <div className="mb-6 page-break-inside-avoid">
            <div className="flex items-center gap-2 mb-4">
              <Package className="w-5 h-5 text-gray-700" />
              <h2 className="text-xl font-bold text-gray-900 border-b border-gray-200 pb-1 w-full flex-1">Material Usage Today</h2>
            </div>

            {(dpr?.materialUsage && dpr.materialUsage.length > 0) ? (
              <div className="overflow-x-auto border border-gray-200 rounded-lg">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Material / Item</th>
                      <th className="px-6 py-3 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">Used Qty</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {dpr.materialUsage.map((mat, idx) => (
                      <tr key={idx}>
                        <td className="px-6 py-3 whitespace-nowrap text-sm font-medium text-gray-900">{mat.name}</td>
                        <td className="px-6 py-3 whitespace-nowrap text-sm text-gray-900 font-bold text-right">{mat.quantity} {mat.unit || ''}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-gray-500 text-sm italic py-2">No material usage recorded for today.</p>
            )}
          </div>

          {/* Section 4: Daily Expenses (Conditional) */}
          {expenses && expenses.length > 0 && (
            <div className="mb-6 page-break-inside-avoid">
              <div className="flex items-center gap-2 mb-4">
                <IndianRupee className="w-5 h-5 text-gray-700" />
                <h2 className="text-xl font-bold text-gray-900 border-b border-gray-200 pb-1 w-full flex-1">Daily Expenses</h2>
              </div>
              <div className="overflow-x-auto border border-gray-200 rounded-lg">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Description</th>
                      <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider hidden sm:table-cell">Category</th>
                      <th className="px-6 py-3 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {expenses.map((exp, idx) => (
                      <tr key={idx}>
                        <td className="px-6 py-3 whitespace-nowrap text-sm font-medium text-gray-900">{exp.description}</td>
                        <td className="px-6 py-3 whitespace-nowrap text-sm text-gray-500 hidden sm:table-cell">{exp.category || '-'}</td>
                        <td className="px-6 py-3 whitespace-nowrap text-sm font-bold text-gray-900 text-right">₹{exp.amount.toLocaleString('en-IN')}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-gray-50 border-t border-gray-200">
                      <td colSpan="2" className="px-6 py-3 text-right font-bold text-gray-700 uppercase focus:outline-none">Total:</td>
                      <td className="px-6 py-3 text-right font-bold text-green-700 text-base">₹{expenses.reduce((sum, e) => sum + e.amount, 0).toLocaleString('en-IN')}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}

          {/* Footer Signature Block */}
          <div className="mt-12 sm:mt-16 pt-8 border-t border-gray-300 flex flex-col sm:flex-row justify-between gap-12 sm:gap-4 px-4 sm:px-8 text-sm text-gray-600 page-break-inside-avoid relative z-10">
            <div className="text-center space-y-4 sm:space-y-8 mx-auto sm:mx-0">
              <div className="w-48 sm:w-48 border-b-2 border-gray-400 mx-auto"></div>
              <p className="font-semibold text-gray-800">Prepared By (Supervisor)</p>
            </div>
            <div className="text-center space-y-4 sm:space-y-8 mx-auto sm:mx-0">
              <div className="w-48 sm:w-48 border-b-2 border-gray-400 mx-auto"></div>
              <p className="font-semibold text-gray-800">Approved By (Site Manager)</p>
            </div>
          </div>

          {/* Watermark Logo */}
          <div className="absolute inset-0 z-0 flex items-center justify-center opacity-[0.05] pointer-events-none">
            <img src="/Site Flow.png" alt="Site Flow Logo Watermark" className="w-[80%] max-w-[600px] object-contain" />
          </div>

        </div>
      </div>

      {/* Print Specific CSS Handling */}
      <style dangerouslySetInnerHTML={{
        __html: `
        @media print {
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .page-break-inside-avoid { page-break-inside: avoid; }
        }
      `}} />
    </div>
  );
};

export default DPRReportView;
