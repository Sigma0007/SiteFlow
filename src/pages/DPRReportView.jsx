import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, FileText, Download } from 'lucide-react';
import { siteServices, attendanceServices, labourServices, dprServices, materialServices, convertDocsToArray, expenseServices, buildingServices } from '../services/firebaseServices';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

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
        const siteDoc = await siteServices.getSiteById(siteId);
        if (siteDoc.exists()) setSite({ id: siteDoc.id, ...siteDoc.data() });

        if (buildingId) {
          const buildingDoc = await buildingServices.getBuildingById(buildingId);
          if (buildingDoc.exists()) setBuilding({ id: buildingDoc.id, ...buildingDoc.data() });
        }

        const labSnap = await labourServices.getAllLabour();
        const allLabour = convertDocsToArray(labSnap);
        setLabour(allLabour);

        const matSnap = await materialServices.getAllMaterials();
        setMaterials(convertDocsToArray(matSnap));

        const attSnap = await attendanceServices.getAttendanceByDate(date);
        const allAtt = convertDocsToArray(attSnap);
        setAttendance(allAtt.filter(a => {
          const siteMatch = a.siteId === siteId || ((a.isContractWorker || a.isDailyWorker) && a.employeeId && a.employeeId.includes(siteId));
          if (!siteMatch) return false;
          if (buildingId) return a.buildingId === buildingId || ((a.isContractWorker || a.isDailyWorker) && a.employeeId && a.employeeId.includes(buildingId));
          return !a.buildingId || a.buildingId === "";
        }));

        const dprSnap = await dprServices.getDPRBySiteId(siteId);
        const allDprs = convertDocsToArray(dprSnap);
        setDpr(allDprs.find(d => d.date === date && !d.is_deleted && (!buildingId || d.buildingId === buildingId)));

        const expSnap = await expenseServices.getExpensesBySiteAndDate(siteId, date);
        setExpenses(convertDocsToArray(expSnap));

      } catch (err) {
        console.error('Error fetching report data:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [siteId, date, buildingId]);

  const getEmpDetails = (att) => {
    if (att.isDailyWorker) return { name: `Daily Workers (${att.dailyWorkerCount || 0} Total)`, id: att.employeeId };
    if (att.isContractWorker) return { name: `Subcontractor - ${att.contractorName} (${att.contractWorkerCount || 0} Total)`, id: att.employeeId };
    return labour.find(l => l.id === att.employeeId) || { name: 'Unknown', role: 'Unknown', id: att.employeeId };
  };

  const presentLabour = attendance.filter(a => a.status === 'present');
  const absentLabour = attendance.filter(a => a.status === 'absent');

  const handleDownloadPdf = () => {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const bldgName = building ? ` - ${building.name}` : '';

    doc.setFontSize(16);
    doc.setTextColor(20, 20, 20);
    doc.text('DAILY PROGRESS REPORT', 14, 20);

    doc.setFontSize(10);
    doc.setTextColor(80, 80, 80);
    doc.text(`Site: ${site.name}${bldgName}`, 14, 28);
    doc.text(`Date: ${date}`, 196, 28, { align: 'right' });

    let finalY = 35;

    // 1. Process Entries
    if (dpr?.processEntries && dpr.processEntries.length > 0) {
      doc.setFontSize(12);
      doc.setTextColor(40, 40, 40);
      doc.text('Today\'s Process Work', 14, finalY);

      autoTable(doc, {
        startY: finalY + 4,
        head: [['Work Description', 'Quantity', 'Unit', 'Remark']],
        body: dpr.processEntries.map(e => [e.work, e.quantity, e.unit, e.remark || '-']),
        theme: 'grid',
        headStyles: { fillColor: [240, 240, 240], textColor: [40, 40, 40] },
        styles: { fontSize: 9 }
      });
      finalY = doc.lastAutoTable.finalY + 12;
    }

    // 2. Attendance
    doc.setFontSize(12);
    doc.setTextColor(40, 40, 40);
    doc.text(`Labour Attendance (Present: ${presentLabour.length}, Absent: ${absentLabour.length})`, 14, finalY);

    if (attendance.length > 0) {
      const rows = attendance.map(att => {
        const emp = getEmpDetails(att);
        return [emp.name, att.status === 'present' ? 'P' : 'A'];
      }).sort((a, b) => a[0].localeCompare(b[0]));

      autoTable(doc, {
        startY: finalY + 4,
        head: [['Employee / Group', 'Status']],
        body: rows,
        theme: 'grid',
        headStyles: { fillColor: [240, 240, 240], textColor: [40, 40, 40] },
        styles: { fontSize: 9 },
        didParseCell: function (data) {
          if (data.section === 'body' && data.column.index === 1) {
            if (data.cell.raw === 'P') data.cell.styles.textColor = [34, 197, 94];
            else if (data.cell.raw === 'A') data.cell.styles.textColor = [239, 68, 68];
            data.cell.styles.halign = 'center';
          }
        }
      });
      finalY = doc.lastAutoTable.finalY + 12;
    }

    // 3. Materials
    if (dpr?.materialUsage && dpr.materialUsage.length > 0) {
      doc.setFontSize(12);
      doc.setTextColor(40, 40, 40);
      doc.text('Material Usage Today', 14, finalY);

      autoTable(doc, {
        startY: finalY + 4,
        head: [['Material / Item', 'Used Qty']],
        body: dpr.materialUsage.map(m => [m.name, `${m.quantity} ${m.unit || ''}`]),
        theme: 'grid',
        headStyles: { fillColor: [240, 240, 240], textColor: [40, 40, 40] },
        styles: { fontSize: 9 }
      });
      finalY = doc.lastAutoTable.finalY + 12;
    }

    // 4. Expenses
    if (expenses && expenses.length > 0) {
      doc.setFontSize(12);
      doc.setTextColor(40, 40, 40);
      doc.text('Daily Expenses', 14, finalY);

      const totalExp = expenses.reduce((sum, e) => sum + e.amount, 0);
      const expBody = expenses.map(e => [e.description, e.category || '-', `Rs ${e.amount.toLocaleString('en-IN')}`]);
      expBody.push(['', 'TOTAL:', `Rs ${totalExp.toLocaleString('en-IN')}`]);

      autoTable(doc, {
        startY: finalY + 4,
        head: [['Description', 'Category', 'Amount']],
        body: expBody,
        theme: 'grid',
        headStyles: { fillColor: [240, 240, 240], textColor: [40, 40, 40] },
        styles: { fontSize: 9 },
        didParseCell: function (data) {
          if (data.section === 'body' && data.row.index === expBody.length - 1) {
            data.cell.styles.fontStyle = 'bold';
          }
          if (data.column.index === 2) {
            data.cell.styles.halign = 'right';
          }
        }
      });
    }

    doc.save(`DPR-${site.name.replace(/\s+/g, '-')}-${date}.pdf`);
  };

  if (loading) return <div className="p-8 text-center bg-gray-50 min-h-screen">Loading Report...</div>;
  if (!site) return <div className="p-8 text-center text-red-600 bg-gray-50 min-h-screen">Site Report Not Found!</div>;

  return (
    <div className="bg-gray-50 min-h-screen pb-12 print:bg-white print:pb-0">
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

      <div className="max-w-4xl mx-auto mt-8 px-4 sm:px-6 lg:px-8 print:mt-0 print:px-0">
        <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-8 sm:p-12 print:shadow-none print:border-none print:p-0 relative overflow-hidden">

          <div className="flex items-start justify-between border-b-2 border-gray-900 pb-6 mb-8">
            <div>
              <h1 className="text-3xl font-black text-gray-900 uppercase tracking-tight">Daily Progress Report</h1>
              <p className="text-gray-600 mt-2 font-medium flex items-center gap-2">
                <span className="text-lg">🏢</span> {building ? `${site.name} - ${building.name}` : site.name}
              </p>
            </div>
            <div className="text-right">
              <div className="bg-gray-100 px-4 py-2 rounded-lg inline-block">
                <p className="text-sm font-bold text-gray-800 uppercase tracking-wider mb-1">Date</p>
                <p className="text-xl font-medium text-blue-700 flex items-center gap-2">
                  <span className="text-lg">📅</span>
                  {date}
                </p>
              </div>
            </div>
          </div>

          {(dpr?.processEntries && dpr.processEntries.length > 0) && (
            <div className="mb-10 page-break-inside-avoid">
              <div className="flex items-center gap-2 mb-4">
                <span className="text-gray-700 font-bold text-xl">✓</span>
                <h2 className="text-xl font-bold text-gray-900 border-b border-gray-200 pb-1 w-full flex-1">Today's Process Work</h2>
              </div>
              <div className="border border-gray-200 rounded-lg overflow-hidden">
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

          <div className="mb-10 page-break-inside-avoid">
            <div className="flex items-center gap-2 mb-4">
              <span className="text-gray-700 font-bold text-xl">👷</span>
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
              <div className="border border-gray-200 rounded-lg overflow-hidden">
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
                              <div className="flex items-center gap-2">
                                <span>{emp.name} <span className="text-gray-400 text-xs ml-1">({emp.id ? emp.id.substring(0, 6) : 'N/A'})</span></span>
                              </div>
                            </td>
                            <td className={`px-6 py-3 whitespace-nowrap text-sm font-bold ${isPresent ? 'text-green-600' : 'text-red-600'}`}> {isPresent ? 'P' : 'A'}
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

          <div className="mb-6 page-break-inside-avoid">
            <div className="flex items-center gap-2 mb-4">
              <span className="text-gray-700 font-bold text-xl">📦</span>
              <h2 className="text-xl font-bold text-gray-900 border-b border-gray-200 pb-1 w-full flex-1">Material Usage Today</h2>
            </div>
            {(dpr?.materialUsage && dpr.materialUsage.length > 0) ? (
              <div className="border border-gray-200 rounded-lg overflow-hidden">
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

          {expenses && expenses.length > 0 && (
            <div className="mb-6 page-break-inside-avoid">
              <div className="flex items-center gap-2 mb-4">
                <span className="text-gray-700 font-bold text-xl">₹</span>
                <h2 className="text-xl font-bold text-gray-900 border-b border-gray-200 pb-1 w-full flex-1">Daily Expenses</h2>
              </div>
              <div className="border border-gray-200 rounded-lg overflow-hidden">
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
        </div>
      </div>
    </div>
  );
};

export default DPRReportView;