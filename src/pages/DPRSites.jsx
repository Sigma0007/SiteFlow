import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Building2, Search, MapPin, ChevronRight, FileText, ArrowLeft, IndianRupee, X, Plus, Trash2, Download } from 'lucide-react';
import { siteServices, convertDocsToArray, dprServices, attendanceServices, labourServices } from '../services/firebaseServices';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { useSupervisor } from '../contexts/SupervisorContext.jsx';
import { useAuth } from '../components/Auth';
import { useNavigate } from 'react-router-dom';
import { collection, addDoc, query, where, getDocs, deleteDoc, doc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';

const DPRSites = ({ userRole }) => {
  const { currentSupervisor, assignedSites } = useSupervisor();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [sites, setSites] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [bulkDate, setBulkDate] = useState(new Date().toISOString().split('T')[0]);
  const [isGeneratingBulk, setIsGeneratingBulk] = useState(false);

  // Expense modal state
  const [expenseModal, setExpenseModal] = useState({ open: false, siteId: '', siteName: '' });
  const [expenseForm, setExpenseForm] = useState({ description: '', amount: '' });
  const [siteExpenses, setSiteExpenses] = useState([]);
  const [savingExpense, setSavingExpense] = useState(false);

  const todayDate = new Date().toISOString().split('T')[0];

  useEffect(() => {
    setLoading(true);
    const unsubscribe = siteServices.onSitesChange((snapshot) => {
      const allSites = convertDocsToArray(snapshot);
      setSites(allSites.filter(s => !s.is_deleted && s.status !== 'On Hold' && s.status !== 'Completed'));
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!expenseModal.open || !expenseModal.siteId) return;

    const q = query(
      collection(db, 'expenses'),
      where('siteId', '==', expenseModal.siteId),
      where('date', '==', todayDate)
    );

    const unsub = onSnapshot(q, (snap) => {
      const list = [];
      snap.forEach(d => list.push({ id: d.id, ...d.data() }));
      setSiteExpenses(list);
    });

    return () => unsub();
  }, [expenseModal.open, expenseModal.siteId, todayDate]);

  const openExpenseModal = (site, e) => {
    e.stopPropagation();
    setExpenseModal({ open: true, siteId: site.id, siteName: site.name });
    setExpenseForm({ description: '', amount: '' });
  };

  const handleAddExpense = async () => {
    const amt = parseFloat(expenseForm.amount);
    if (!expenseForm.description.trim() || !amt || amt <= 0) return;

    setSavingExpense(true);
    try {
      await addDoc(collection(db, 'expenses'), {
        siteId: expenseModal.siteId,
        siteName: expenseModal.siteName,
        date: todayDate,
        description: expenseForm.description.trim(),
        amount: amt,
        addedBy: user?.email || '',
        createdAt: new Date().toISOString()
      });
      setExpenseForm({ description: '', amount: '' });
    } catch (err) {
      console.error('Error adding expense:', err);
    } finally {
      setSavingExpense(false);
    }
  };

  const handleDeleteExpense = async (expId) => {
    try {
      await deleteDoc(doc(db, 'expenses', expId));
    } catch (err) {
      console.error('Error deleting expense:', err);
    }
  };

  const filteredSites = sites
    .filter(site => site.name?.toLowerCase().includes(searchTerm.toLowerCase()))
    .sort((a, b) => (a.name || '').localeCompare(b.name || ''));

  const expenseTotal = siteExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);

  const handleBulkDownload = async (targetSiteId = null) => {
    setIsGeneratingBulk(true);
    try {
      const targetSites = targetSiteId ? sites.filter(s => s.id === targetSiteId) : filteredSites;

      const [labSnap, attSnap, dprSnap] = await Promise.all([
        labourServices.getAllLabour(),
        attendanceServices.getAttendanceByDate(bulkDate),
        dprServices.getDPRByDate(bulkDate)
      ]);

      const labourList = convertDocsToArray(labSnap);
      const allAtt = convertDocsToArray(attSnap);
      const allDprs = convertDocsToArray(dprSnap);

      const expQ = query(collection(db, 'expenses'), where('date', '==', bulkDate));
      const expSnap = await getDocs(expQ);
      const allExpenses = convertDocsToArray(expSnap);

      const reportsToGenerate = [];

      for (const site of targetSites) {
        const siteDprs = allDprs.filter(d => d.siteId === site.id && !d.is_deleted);
        if (siteDprs.length === 0) continue;

        for (const dpr of siteDprs) {
          const buildingId = dpr.buildingId;
          const siteAtt = allAtt.filter(a => {
            const siteMatch = a.siteId === site.id || ((a.isContractWorker || a.isDailyWorker) && a.employeeId && a.employeeId.includes(site.id));
            if (!siteMatch) return false;
            if (buildingId) {
              return a.buildingId === buildingId || ((a.isContractWorker || a.isDailyWorker) && a.employeeId && a.employeeId.includes(buildingId));
            }
            return !a.buildingId || a.buildingId === "";
          });
          const siteExp = allExpenses.filter(e => e.siteId === site.id);

          reportsToGenerate.push({
            site,
            buildingId,
            dpr,
            attendance: siteAtt,
            expenses: siteExp
          });
        }
      }

      if (reportsToGenerate.length === 0) {
        alert(`No DPR data found for ${targetSiteId ? 'this site' : 'the selected date'}.`);
        setIsGeneratingBulk(false);
        return;
      }

      // Native Data-Driven PDF Generation
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

      reportsToGenerate.forEach((report, index) => {
        if (index > 0) doc.addPage();
        const { site, dpr, attendance, expenses } = report;
        const bldgName = dpr.buildingName ? ` - ${dpr.buildingName}` : '';

        doc.setFontSize(16);
        doc.setTextColor(20, 20, 20);
        doc.text('DAILY PROGRESS REPORT', 14, 20);

        doc.setFontSize(10);
        doc.setTextColor(80, 80, 80);
        doc.text(`Site: ${site.name}${bldgName}`, 14, 28);
        doc.text(`Date: ${bulkDate}`, 196, 28, { align: 'right' });

        let finalY = 35;

        // 1. Process Work
        if (dpr.processEntries && dpr.processEntries.length > 0) {
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
        const presentCount = attendance.filter(a => a.status === 'present').length;
        const absentCount = attendance.filter(a => a.status === 'absent').length;

        doc.setFontSize(12);
        doc.setTextColor(40, 40, 40);
        doc.text(`Labour Attendance (Present: ${presentCount}, Absent: ${absentCount})`, 14, finalY);

        if (attendance.length > 0) {
          const rows = attendance.map(att => {
            let name = 'Unknown';
            if (att.isDailyWorker) name = `Daily Workers (${att.dailyWorkerCount || 0} Total)`;
            else if (att.isContractWorker) name = `Subcontractor - ${att.contractorName} (${att.contractWorkerCount || 0} Total)`;
            else {
              const l = labourList.find(lab => lab.id === att.employeeId);
              name = l ? l.name : att.employeeId;
            }
            return [name, att.status === 'present' ? 'P' : 'A'];
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
        if (dpr.materialUsage && dpr.materialUsage.length > 0) {
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
      });

      const fileName = targetSiteId ? `DPR-${targetSites[0].name.replace(/\s+/g, '-')}-${bulkDate}.pdf` : `Bulk-DPR-${bulkDate}.pdf`;
      doc.save(fileName);
      setIsGeneratingBulk(false);

    } catch (err) {
      console.error("Error bulk generating:", err);
      setIsGeneratingBulk(false);
    }
  };

  return (
    <div className="p-3 sm:p-4 lg:p-6 space-y-4 lg:space-y-6 min-h-screen bg-gray-50">
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
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 flex items-center gap-3">
              <FileText className="w-7 h-7 text-blue-600" />
              Daily Progress Reports (DPR)
            </h1>
            <p className="text-gray-600 mt-1 text-sm">Select a site to manage its daily tracking</p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search sites A-Z..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2 w-full sm:w-64 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white shadow-sm text-sm"
            />
          </div>
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={bulkDate}
              onChange={(e) => setBulkDate(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white text-sm"
            />
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => handleBulkDownload()}
              disabled={isGeneratingBulk}
              className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 disabled:opacity-50 text-sm font-medium transition-colors whitespace-nowrap"
            >
              {isGeneratingBulk ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              ) : (
                <Download className="w-4 h-4" />
              )}
              Download All DPR
            </motion.button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      ) : filteredSites.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl shadow-sm border border-gray-200">
          <Building2 className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <h3 className="text-lg font-medium text-gray-900">No sites found</h3>
          <p className="text-gray-500">Try adjusting your search</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredSites.map((site, index) => (
            <motion.div
              key={site.id}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: index * 0.05 }}
              whileHover={{ scale: 1.02 }}
              className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 cursor-pointer hover:shadow-md transition-all group"
            >
              <div className="flex items-center justify-between">
                <div
                  className="flex-1 cursor-pointer"
                  onClick={() => navigate(`/dpr/${site.id}`)}
                >
                  <h3 className="text-lg font-bold text-gray-900 group-hover:text-blue-600 transition-colors">
                    {site.name}
                  </h3>
                  {site.location && (
                    <p className="text-sm text-gray-500 mt-1 flex items-center gap-1">
                      <MapPin className="w-4 h-4" /> {site.location}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <motion.button
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleBulkDownload(site.id);
                    }}
                    disabled={isGeneratingBulk}
                    className="p-2.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors border border-gray-200 shadow-sm"
                    title="Download PDF"
                  >
                    <Download className="w-5 h-5" />
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={(e) => openExpenseModal(site, e)}
                    className="p-2.5 bg-green-50 text-green-600 rounded-lg hover:bg-green-100 transition-colors border border-green-100 shadow-sm"
                    title="Expenses"
                  >
                    <IndianRupee className="w-5 h-5" />
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(`/dpr/${site.id}/history`);
                    }}
                    className="p-2.5 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors border border-blue-100 shadow-sm"
                    title="View Report History"
                  >
                    <FileText className="w-5 h-5" />
                  </motion.button>
                  <ChevronRight
                    className="w-6 h-6 text-gray-400 group-hover:text-blue-600 group-hover:translate-x-1 transition-all cursor-pointer"
                    onClick={() => navigate(`/dpr/${site.id}`)}
                  />
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Expense Modal */}
      <AnimatePresence>
        {expenseModal.open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            onClick={() => setExpenseModal({ open: false, siteId: '', siteName: '' })}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden"
              onClick={e => e.stopPropagation()}
            >
              <div className="bg-green-50 border-b border-green-100 px-6 py-4 flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                    <IndianRupee className="w-5 h-5 text-green-600" /> Expenses
                  </h3>
                  <p className="text-sm text-gray-500">{expenseModal.siteName} · {todayDate}</p>
                </div>
                <button
                  onClick={() => setExpenseModal({ open: false, siteId: '', siteName: '' })}
                  className="p-1.5 hover:bg-green-100 rounded-lg transition"
                >
                  <X className="w-5 h-5 text-gray-400" />
                </button>
              </div>

              <div className="px-6 py-4 space-y-3">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Description</label>
                  <input
                    type="text"
                    value={expenseForm.description}
                    onChange={e => setExpenseForm(f => ({ ...f, description: e.target.value }))}
                    placeholder="e.g., Labour wages, Transport"
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent text-base"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Amount (₹)</label>
                  <input
                    type="number"
                    min="1"
                    value={expenseForm.amount}
                    onChange={e => setExpenseForm(f => ({ ...f, amount: e.target.value }))}
                    placeholder="e.g., 5000"
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent text-base"
                  />
                </div>
                <button
                  onClick={handleAddExpense}
                  disabled={savingExpense || !expenseForm.description.trim() || !expenseForm.amount}
                  className="w-full py-2.5 bg-green-600 text-white rounded-lg font-bold text-base hover:bg-green-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  <Plus className="w-5 h-5" /> Add Expense
                </button>
              </div>

              <div className="border-t border-gray-100 px-6 py-4 max-h-60 overflow-y-auto">
                {siteExpenses.length === 0 ? (
                  <p className="text-gray-400 text-sm text-center py-4">No expenses recorded today.</p>
                ) : (
                  <div className="space-y-2">
                    {siteExpenses.map(exp => (
                      <div key={exp.id} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2.5">
                        <div>
                          <p className="font-medium text-gray-900 text-sm">{exp.description}</p>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="font-bold text-green-700 text-base">₹{(exp.amount || 0).toLocaleString('en-IN')}</span>
                          <button onClick={() => handleDeleteExpense(exp.id)} className="text-red-400 hover:text-red-600 transition">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {siteExpenses.length > 0 && (
                <div className="border-t border-gray-200 px-6 py-3 bg-gray-50 flex items-center justify-between">
                  <span className="text-sm font-bold text-gray-600 uppercase tracking-wider">Total</span>
                  <span className="text-xl font-black text-green-700">₹{expenseTotal.toLocaleString('en-IN')}</span>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default DPRSites;