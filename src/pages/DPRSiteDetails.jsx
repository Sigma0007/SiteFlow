import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, Building2, Package, Users, Activity, CheckCircle, Plus, Minus, Search, RotateCcw, Clock, FileText, IndianRupee, Trash2
} from 'lucide-react';
import {
  siteServices, labourServices, materialServices, attendanceServices, dprServices, convertDocsToArray, expenseServices
} from '../services/firebaseServices';
import { onSnapshot, doc, query, where, collection } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../components/Auth';
import StatusModal from '../components/StatusModal';
import InputModal from '../components/InputModal';
import { PlusCircle, MinusCircle } from 'lucide-react';

const DPRSiteDetails = ({ userRole }) => {
  const { siteId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [site, setSite] = useState(null);
  const [currentStep, setCurrentStep] = useState(1); // 1=Materials 2=Attendance 3=Process 4=Expenses
  const [loading, setLoading] = useState(true);
  
  // Data States
  const [allMaterials, setAllMaterials] = useState([]);
  const [allLabour, setAllLabour] = useState([]);
  const [todayAttendance, setTodayAttendance] = useState([]);
  const [todayDpr, setTodayDpr] = useState(null);
  const [todayExpenses, setTodayExpenses] = useState([]);

  // Expense modal state
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [expenseForm, setExpenseForm] = useState({ description: '', amount: '', category: 'Labour' });
  const expenseCategories = ['Labour', 'Materials', 'Transport', 'Equipment', 'Other'];
  
  const todayDate = new Date().toISOString().split('T')[0];

  // Status Modal State
  const [statusModal, setStatusModal] = useState({
    visible: false,
    type: 'success',
    title: '',
    message: '',
    onConfirm: null,
    onCancel: null
  });

  const showAlert = (title, message, type = 'success') => {
    setStatusModal({ 
      visible: true, 
      type, 
      title, 
      message, 
      onConfirm: () => setStatusModal(prev => ({ ...prev, visible: false })) 
    });
  };

  // Input Modal State
  const [inputModal, setInputModal] = useState({
    visible: false,
    title: '',
    message: '',
    defaultValue: '',
    onConfirm: null,
    icon: null
  });

  const showPrompt = (title, message, defaultValue, onConfirm, icon) => {
    setInputModal({
      visible: true,
      title,
      message,
      defaultValue,
      onConfirm: (val) => {
        onConfirm(val);
        setInputModal(prev => ({ ...prev, visible: false }));
      },
      icon
    });
  };

  const loadData = () => {
    // Kept for manual reloads if absolutely necessary, but onSnapshot handles it automatically
  };

  useEffect(() => {
    if (!siteId) return;
    setLoading(true);

    const unsubscribers = [];

    // 1. Fetch Site
    unsubscribers.push(
      onSnapshot(doc(db, 'sites', siteId), (siteDoc) => {
        if (siteDoc.exists()) {
          setSite({ id: siteDoc.id, ...siteDoc.data() });
        }
        setLoading(false);
      }, (err) => console.error('Site Error:', err))
    );

    // 2. Fetch Materials
    unsubscribers.push(
      onSnapshot(collection(db, 'materials'), (snap) => {
        setAllMaterials(convertDocsToArray(snap));
      }, (err) => console.error('Material Error:', err))
    );

    // 3. Fetch Labour
    unsubscribers.push(
      onSnapshot(collection(db, 'labour'), (snap) => {
        setAllLabour(convertDocsToArray(snap));
      }, (err) => console.error('Labour Error:', err))
    );
    
    // 4. Fetch today's Attendance
    unsubscribers.push(
      onSnapshot(query(collection(db, 'attendance'), where('date', '==', todayDate)), (snap) => {
        setTodayAttendance(convertDocsToArray(snap));
      }, (err) => console.error('Attendance Error:', err))
    );

    // 5. Fetch DPR
    unsubscribers.push(
      onSnapshot(query(collection(db, 'dpr'), where('siteId', '==', siteId)), (snap) => {
        const allDprs = convertDocsToArray(snap);
        const todays = allDprs.find(d => d.date === todayDate && !d.is_deleted);
        setTodayDpr(todays || null);
      }, (err) => console.error('DPR Error:', err))
    );

    // 6. Fetch Expenses
    unsubscribers.push(
      onSnapshot(
        query(collection(db, 'expenses'), where('siteId', '==', siteId), where('date', '==', todayDate)), 
        (snap) => {
          setTodayExpenses(convertDocsToArray(snap));
        }, 
        (err) => console.error('Expense Error:', err)
      )
    );

    return () => {
      unsubscribers.forEach(unsub => unsub());
    };
  }, [siteId, todayDate]);

  // --- TAB: MATERIALS ---
  const [matSearch, setMatSearch] = useState('');
  
  const handleAddMaterialToSite = async (material, quantity) => {
    if (quantity <= 0 || quantity > material.currentStock) {
      showAlert('Invalid Quantity', 'Please ensure you have enough stock available.', 'error');
      return;
    }
    try {
      // 1. Reduce from central inventory
      await materialServices.updateMaterial(material.id, {
        currentStock: material.currentStock - quantity
      });
      // 2. Add to site's assigned materials
      const currentSiteMaterials = site.assignedMaterials || [];
      const existingMatIndex = currentSiteMaterials.findIndex(m => m.materialId === material.id);
      
      let newSiteMaterials = [...currentSiteMaterials];
      if (existingMatIndex >= 0) {
        newSiteMaterials[existingMatIndex].quantity += quantity;
      } else {
        newSiteMaterials.push({
          materialId: material.id,
          name: material.name,
          category: material.category,
          quantity: quantity
        });
      }
      
      await siteServices.updateSite(siteId, { assignedMaterials: newSiteMaterials });
      
      // Update local state
      setSite(prev => ({ ...prev, assignedMaterials: newSiteMaterials }));
      setAllMaterials(prev => prev.map(m => m.id === material.id ? { ...m, currentStock: m.currentStock - quantity } : m));
      showAlert('Success', 'Material allocated to site successfully!');
      loadData();
    } catch (err) {
      console.error(err);
      showAlert('Error', 'Failed to allocate material.', 'error');
    }
  };

  const handleReturnMaterial = async (siteMat, returnQty) => {
    if (returnQty <= 0 || returnQty > siteMat.quantity) return;
    try {
      // 1. Add back to central inventory
      const mat = allMaterials.find(m => m.id === siteMat.materialId);
      if (mat) {
        await materialServices.updateMaterial(mat.id, { currentStock: mat.currentStock + returnQty });
      }
      
      // 2. Reduce from site's assigned materials
      let newSiteMaterials = [...(site.assignedMaterials || [])];
      const matIndex = newSiteMaterials.findIndex(m => m.materialId === siteMat.materialId);
      if (matIndex >= 0) {
        newSiteMaterials[matIndex].quantity -= returnQty;
        if (newSiteMaterials[matIndex].quantity <= 0) {
          newSiteMaterials.splice(matIndex, 1);
        }
      }
      
      await siteServices.updateSite(siteId, { assignedMaterials: newSiteMaterials });
      
      // Update local state
      setSite(prev => ({ ...prev, assignedMaterials: newSiteMaterials }));
      if (mat) {
        setAllMaterials(prev => prev.map(m => m.id === mat.id ? { ...m, currentStock: m.currentStock + returnQty } : m));
      }
      showAlert('Success', 'Material returned to inventory successfully!');
      loadData();
    } catch (err) {
      console.error(err);
      showAlert('Error', 'Failed to return material.', 'error');
    }
  };

  // --- TAB: ATTENDANCE ---
  // The rule: If an employee is marked PRESENT at ANOTHER site today, do NOT show them here.
  // Otherwise, show them.
  const visibleEmployees = allLabour.filter(emp => {
    const empAtt = todayAttendance.filter(a => a.employeeId === emp.id);
    const markedPresentElsewhere = empAtt.some(a => a.status === 'present' && a.siteId !== siteId);
    return !markedPresentElsewhere;
  });

  const handleMarkAttendance = async (employeeId, status) => {
    try {
      const existingRecord = todayAttendance.find(a => a.employeeId === employeeId && a.date === todayDate);
      if (existingRecord) {
        // If they have a record here, we update it
        if (existingRecord.siteId === siteId) {
          await attendanceServices.updateAttendance(existingRecord.id, { status, updatedAt: new Date().toISOString() });
          setTodayAttendance(prev => prev.map(a => a.id === existingRecord.id ? { ...a, status } : a));
        } else {
          // Record is at another site. Should not happen if they are marked Present there. 
          // If they are marked absent there, we can override and mark present here? 
          if (existingRecord && existingRecord.siteId !== siteId) {
      showAlert('Warning', 'Employee already has an attendance record at another site today.', 'warning');
      return;
    }    }
      } else {
        // Create new record
        const attData = {
          employeeId,
          siteId,
          date: todayDate,
          status,
          createdAt: new Date().toISOString()
        };
        const newDoc = await attendanceServices.addAttendance(attData);
        setTodayAttendance(prev => [...prev, { id: newDoc.id, ...attData }]);
      }
      loadData();
    } catch (err) {
      console.error(err);
      showAlert('Error', 'Failed to mark attendance.', 'error');
    }
  };

  // --- TAB: PROCESS (SQ FT) ---
  const [doneSqInput, setDoneSqInput] = useState('');
  
  const handleUpdateProcessSq = async () => {
    const sqVal = parseFloat(doneSqInput);
    if (!sqVal || sqVal <= 0) return;
    
    try {
      // Add to today's DPR
      if (todayDpr) {
        const newDoneSq = (todayDpr.doneSq || 0) + sqVal;
        await dprServices.updateDPR(todayDpr.id, { doneSq: newDoneSq });
        setTodayDpr(prev => ({ ...prev, doneSq: newDoneSq }));
      } else {
        // Create today's DPR for this site
        const newDpr = {
          date: todayDate,
          siteId: siteId,
          siteName: site.name,
          doneSq: sqVal,
          status: 'submitted',
          createdAt: new Date().toISOString()
        };
        const newDoc = await dprServices.addDPR(newDpr);
        setTodayDpr({ id: newDoc.id, ...newDpr });
      }
      
      // Update Site's total doneSq
      const newSiteDoneSq = (site.doneSq || 0) + sqVal;
      await siteServices.updateSite(siteId, { doneSq: newSiteDoneSq });
      setSite(prev => ({ ...prev, doneSq: newSiteDoneSq }));
      
      setDoneSqInput('');
      showAlert('Success', `Added ${sqVal} sq ft successfully!`);
      loadData();
    } catch (err) {
      console.error(err);
      showAlert('Error', 'Failed to update square footage.', 'error');
    }
  };

  const handleAddExpense = async () => {
    const amt = parseFloat(expenseForm.amount);
    if (!expenseForm.description || !amt || amt <= 0) {
      showAlert('Required', 'Please enter a description and a valid amount.', 'warning');
      return;
    }
    try {
      const newExp = {
        siteId,
        siteName: site.name,
        date: todayDate,
        description: expenseForm.description,
        amount: amt,
        category: expenseForm.category,
        addedBy: user?.email || '',
        createdAt: new Date().toISOString()
      };
      const ref = await expenseServices.addExpense(newExp);
      setTodayExpenses(prev => [...prev, { id: ref.id, ...newExp }]);
      setExpenseForm({ description: '', amount: '', category: 'Labour' });
      showAlert('Success', 'Expense added successfully!');
    } catch (err) {
      console.error(err);
      showAlert('Error', 'Failed to add expense.', 'error');
    }
  };

  const handleDeleteExpense = async (expId) => {
    try {
      await expenseServices.deleteExpense(expId);
      setTodayExpenses(prev => prev.filter(e => e.id !== expId));
      showAlert('Deleted', 'Expense removed.', 'success');
    } catch (err) {
      showAlert('Error', 'Failed to delete expense.', 'error');
    }
  };

  if (loading) {
    return <div className="p-8 text-center bg-gray-50 min-h-screen">Loading...</div>;
  }
  
  if (!site) {
    return <div className="p-8 text-center text-red-600 bg-gray-50 min-h-screen">Site not found!</div>;
  }

  const siteMaterials = site.assignedMaterials || [];
  const siteTotalSq = parseFloat(site.totalSq) || 0;
  const siteDoneSq = parseFloat(site.doneSq) || 0;
  const processPercent = siteTotalSq > 0 ? Math.min(100, (siteDoneSq / siteTotalSq) * 100) : 0;

  return (
    <div className="bg-gray-50 min-h-screen pb-10">
      {/* HEADER */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="py-6 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button onClick={() => navigate('/dpr')} className="p-2 bg-gray-100 hover:bg-gray-200 rounded-full transition-colors text-gray-600">
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div>
                <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                  <Building2 className="w-6 h-6 text-blue-600" />
                  {site.name} DPR
                </h1>
                <p className="text-gray-500 text-sm mt-1 flex items-center gap-1">
                  <Activity className="w-4 h-4" /> Today's Date: {todayDate}
                </p>
              </div>
            </div>
            <button 
              onClick={() => navigate(`/dpr/${siteId}/history`)}
              className="px-4 py-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors font-semibold text-sm flex items-center gap-2"
            >
              <Clock className="w-4 h-4" />
              History
            </button>
          </div>
          
          {todayDpr && (
            <motion.div 
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-4 p-4 bg-green-50 border border-green-100 rounded-xl flex items-center justify-between"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center text-green-600">
                  <CheckCircle className="w-6 h-6" />
                </div>
                <div>
                  <p className="font-bold text-green-800">DPR Already Submitted</p>
                  <p className="text-xs text-green-600">You've already completed today's tracking. You can view or download the report.</p>
                </div>
              </div>
              <button
                onClick={() => navigate(`/dpr/${siteId}/report/${todayDate}`)}
                className="px-4 py-2 bg-green-600 text-white rounded-lg font-bold text-sm hover:bg-green-700 transition flex items-center gap-2"
              >
                <FileText className="w-4 h-4" />
                View Report
              </button>
            </motion.div>
          )}
          
          {/* STEPPER */}
          <div className="flex items-center justify-between mt-6 max-w-2xl mx-auto">
            <div className={`flex flex-col items-center ${currentStep >= 1 ? 'text-blue-600' : 'text-gray-400'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold mb-1 ${currentStep >= 1 ? 'bg-blue-100' : 'bg-gray-100'}`}>1</div>
              <span className="text-xs font-semibold">Materials</span>
            </div>
            <div className={`flex-1 h-1 mx-4 rounded ${currentStep >= 2 ? 'bg-blue-600' : 'bg-gray-200'}`}></div>
            <div className={`flex flex-col items-center ${currentStep >= 2 ? 'text-blue-600' : 'text-gray-400'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold mb-1 ${currentStep >= 2 ? 'bg-blue-100' : 'bg-gray-100'}`}>2</div>
              <span className="text-xs font-semibold">Attendance</span>
            </div>
            <div className={`flex-1 h-1 mx-4 rounded ${currentStep >= 3 ? 'bg-blue-600' : 'bg-gray-200'}`}></div>
            <div className={`flex flex-col items-center ${currentStep >= 3 ? 'text-blue-600' : 'text-gray-400'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold mb-1 ${currentStep >= 3 ? 'bg-blue-100' : 'bg-gray-100'}`}>3</div>
              <span className="text-xs font-semibold">Process</span>
            </div>
            <div className={`flex-1 h-1 mx-4 rounded ${currentStep >= 4 ? 'bg-blue-600' : 'bg-gray-200'}`}></div>
            <div className={`flex flex-col items-center ${currentStep >= 4 ? 'text-blue-600' : 'text-gray-400'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold mb-1 ${currentStep >= 4 ? 'bg-blue-100' : 'bg-gray-100'}`}>4</div>
              <span className="text-xs font-semibold">Expenses</span>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* MATERIALS SECTION */}
        {currentStep === 1 && (
          <div className="space-y-8">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                <Package className="w-5 h-5 text-gray-500" /> Current Site Materials
              </h3>
              {siteMaterials.length === 0 ? (
                <p className="text-gray-500 text-sm py-4">No materials allocated to this site yet.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-gray-50 text-gray-700">
                      <tr>
                        <th className="px-4 py-2 rounded-tl-lg">Item</th>
                        <th className="px-4 py-2">Category</th>
                        <th className="px-4 py-2">Assigned Qty</th>
                        <th className="px-4 py-2 rounded-tr-lg text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {siteMaterials.map((mat, i) => (
                        <tr key={i} className="hover:bg-gray-50">
                          <td className="px-4 py-3 font-medium text-gray-900">{mat.name}</td>
                          <td className="px-4 py-3 text-gray-500">{mat.category || 'N/A'}</td>
                          <td className="px-4 py-3 font-semibold">{mat.quantity}</td>
                          <td className="px-4 py-3 text-right">
                            <button
                              onClick={() => {
                      showPrompt(
                        'Return Material',
                        `Enter quantity of ${mat.name} to return to central warehouse:`,
                        mat.quantity.toString(),
                        (val) => {
                          const qty = parseInt(val);
                          if (!isNaN(qty)) handleReturnMaterial(mat, qty);
                        },
                        <MinusCircle className="w-12 h-12 text-blue-500" />
                      );
                    }}
                              className="text-orange-600 hover:text-orange-800 flex items-center justify-end gap-1 text-xs font-medium bg-orange-50 px-3 py-1.5 rounded-md inline-flex ml-auto"
                            >
                              <RotateCcw className="w-3 h-3" /> Return to Inventory
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-4">Allocate from Global Inventory</h3>
              
              <div className="relative mb-6">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search materials..."
                  className="pl-10 pr-4 py-2 w-full md:w-96 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  value={matSearch}
                  onChange={(e) => setMatSearch(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {allMaterials
                  .filter(m => m.name.toLowerCase().includes(matSearch.toLowerCase()))
                  .slice(0, 12)
                  .map(mat => (
                  <div key={mat.id} className="border border-gray-200 rounded-xl p-4 flex flex-col justify-between">
                    <div>
                      <h4 className="font-semibold text-gray-900">{mat.name}</h4>
                      <p className="text-xs text-gray-500 flex items-center justify-between mt-1">
                        <span>{mat.category || 'Uncategorized'}</span>
                        <span className="font-medium text-blue-600 bg-blue-50 px-2 py-0.5 rounded">Stock: {mat.currentStock}</span>
                      </p>
                    </div>
                    
                    <div className="mt-4 pt-4 border-t border-gray-100">
                      {mat.currentStock > 0 ? (
                        <button
                          onClick={() => {
                      showPrompt(
                        'Allocate Material',
                        `Enter quantity of ${mat.name} to send to ${site.name}:`,
                        '1',
                        (val) => {
                          const qty = parseInt(val);
                          if (!isNaN(qty)) handleAddMaterialToSite(mat, qty);
                        },
                        <PlusCircle className="w-12 h-12 text-blue-500" />
                      );
                    }}
                          className="w-full text-center bg-blue-50 hover:bg-blue-100 text-blue-700 py-1.5 rounded-lg text-sm font-semibold transition-colors"
                        >
                          Allocate
                        </button>
                      ) : (
                        <span className="block w-full text-center text-sm font-medium text-red-500 bg-red-50 py-1.5 rounded-lg">Out of Stock</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ATTENDANCE SECTION */}
        {currentStep === 2 && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="p-6 border-b border-gray-200 bg-blue-50/50">
              <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <Users className="w-5 h-5 text-blue-600" /> Site Attendance - {todayDate}
              </h3>
              <p className="text-sm text-gray-600 flex items-center mt-1">
                If an employee is marked present at another site today, they will not appear below.
              </p>
            </div>
            
            <div className="overflow-x-auto p-0">
              <table className="w-full text-left text-sm">
                <thead className="bg-gray-50 text-gray-700 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Employee</th>
                    <th className="px-4 py-3 font-semibold hidden sm:table-cell">Role</th>
                    <th className="px-4 py-3 font-semibold text-right">Status (P/A)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {visibleEmployees.length === 0 ? (
                    <tr><td colSpan="4" className="text-center py-8 text-gray-500">No available employees to show</td></tr>
                  ) : visibleEmployees.map(emp => {
                    const att = todayAttendance.find(a => a.employeeId === emp.id && a.siteId === siteId);
                    const status = att?.status || 'unmarked';
                    
                    return (
                      <tr key={emp.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <p className="font-semibold text-gray-900 text-base">{emp.name}</p>
                          <p className="text-xs text-gray-500 sm:hidden">{emp.role}</p>
                        </td>
                        <td className="px-4 py-3 text-gray-600 hidden sm:table-cell">{emp.role}</td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex justify-end gap-3">
                            <button
                              onClick={() => handleMarkAttendance(emp.id, 'present')}
                              className={`w-10 h-10 flex items-center justify-center rounded-lg text-lg font-bold transition-all ${status === 'present' ? 'bg-green-500 text-white shadow-md scale-105 border-2 border-green-600' : 'bg-gray-100 text-gray-500 border border-gray-200 hover:bg-green-50 hover:text-green-600'}`}
                            >
                              P
                            </button>
                            <button
                              onClick={() => handleMarkAttendance(emp.id, 'absent')}
                              className={`w-10 h-10 flex items-center justify-center rounded-lg text-lg font-bold transition-all ${status === 'absent' ? 'bg-red-500 text-white shadow-md scale-105 border-2 border-red-600' : 'bg-gray-100 text-gray-500 border border-gray-200 hover:bg-red-50 hover:text-red-600'}`}
                            >
                              A
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* PROCESS SECTION */}
        {currentStep === 3 && (
          <div className="max-w-2xl">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
              <h3 className="text-lg font-bold text-gray-900 mb-6 flex items-center gap-2">
                <Activity className="w-5 h-5 text-gray-500" /> Enter Daily Square Footage
              </h3>
              
              <div className="flex gap-4 items-end">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Done SQ Today (sq ft)</label>
                  <input
                    type="number"
                    value={doneSqInput}
                    onChange={e => setDoneSqInput(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-lg"
                    placeholder="e.g. 500"
                  />
                </div>
                <button
                  onClick={handleUpdateProcessSq}
                  className="px-6 py-2.5 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition"
                >
                  Save Progress
                </button>
              </div>

              {todayDpr && todayDpr.doneSq > 0 && (
                <div className="mt-6 p-4 rounded-lg bg-green-50 border border-green-100">
                  <p className="text-green-800 text-sm flex items-center gap-2">
                    <CheckCircle className="w-5 h-5 text-green-600" />
                    <strong>{todayDpr.doneSq} sq ft</strong> progress registered for today.
                  </p>
                </div>
              )}
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h4 className="font-semibold text-gray-700 mb-4 border-b pb-2">Site Progress Summary</h4>
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <p className="text-sm text-gray-500 uppercase tracking-wider mb-1">Total Target</p>
                  <p className="text-3xl font-bold text-gray-900">{siteTotalSq} <span className="text-base font-normal text-gray-500">SQ</span></p>
                </div>
                <div>
                  <p className="text-sm text-gray-500 uppercase tracking-wider mb-1">Total Done</p>
                  <p className="text-3xl font-bold text-blue-600">{siteDoneSq} <span className="text-base font-normal text-gray-500">SQ</span></p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* EXPENSE SECTION */}
        {currentStep === 4 && (
          <div className="space-y-6 max-w-2xl">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-6 flex items-center gap-2">
                <IndianRupee className="w-5 h-5 text-green-600" /> Daily Expenses — {todayDate}
              </h3>
              
              {/* Inline Add Expense Form */}
              <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 mb-6">
                <h4 className="text-sm font-semibold text-gray-700 mb-3">Add New Expense</h4>
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
                  <div className="sm:col-span-4">
                    <label className="block text-xs font-medium text-gray-600 mb-1">Description *</label>
                    <input
                      type="text"
                      value={expenseForm.description}
                      onChange={e => setExpenseForm(f => ({ ...f, description: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 text-sm"
                      placeholder="e.g., Labour wages"
                    />
                  </div>
                  <div className="sm:col-span-3">
                    <label className="block text-xs font-medium text-gray-600 mb-1">Amount (₹) *</label>
                    <input
                      type="number"
                      min="1"
                      value={expenseForm.amount}
                      onChange={e => setExpenseForm(f => ({ ...f, amount: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 text-sm"
                      placeholder="5000"
                    />
                  </div>
                  <div className="sm:col-span-3">
                    <label className="block text-xs font-medium text-gray-600 mb-1">Category</label>
                    <select
                      value={expenseForm.category}
                      onChange={e => setExpenseForm(f => ({ ...f, category: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 text-sm bg-white"
                    >
                      {expenseCategories.map(c => <option key={c}>{c}</option>)}
                    </select>
                  </div>
                  <div className="sm:col-span-2">
                    <button
                      onClick={handleAddExpense}
                      className="w-full py-2 bg-green-600 text-white rounded-lg font-semibold text-sm hover:bg-green-700 transition h-[38px] flex items-center justify-center gap-1"
                    >
                      <Plus className="w-4 h-4" /> Add
                    </button>
                  </div>
                </div>
              </div>

              {todayExpenses.length === 0 ? (
                <p className="text-gray-400 text-sm py-6 text-center">No expenses recorded for today.</p>
              ) : (
                <div className="overflow-x-auto border border-gray-200 rounded-lg">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 text-gray-600">
                      <tr>
                        <th className="px-4 py-2 text-left font-semibold">Description</th>
                        <th className="px-4 py-2 text-left font-semibold">Category</th>
                        <th className="px-4 py-2 text-right font-semibold">Amount</th>
                        <th className="px-4 py-2"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {todayExpenses.map(exp => (
                        <tr key={exp.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 font-medium text-gray-900">{exp.description}</td>
                          <td className="px-4 py-3">
                            <span className="text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded-full">{exp.category}</span>
                          </td>
                          <td className="px-4 py-3 text-right font-bold text-green-700">₹{exp.amount.toLocaleString('en-IN')}</td>
                          <td className="px-4 py-3 text-center">
                            <button onClick={() => handleDeleteExpense(exp.id)} className="text-red-400 hover:text-red-600 transition-colors">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t border-gray-200 bg-gray-50">
                        <td colSpan="2" className="px-4 py-3 font-bold text-gray-700 text-right uppercase tracking-wider text-xs">Total</td>
                        <td className="px-4 py-3 text-right font-black text-green-700 text-base">
                          ₹{todayExpenses.reduce((sum, e) => sum + e.amount, 0).toLocaleString('en-IN')}
                        </td>
                        <td></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* NAVIGATION BUTTONS */}
        <div className="mt-8 flex justify-between max-w-2xl mx-auto">
          {currentStep > 1 ? (
            <button
              onClick={() => setCurrentStep(prev => prev - 1)}
              className="px-6 py-2.5 bg-white border border-gray-300 text-gray-700 rounded-lg font-bold hover:bg-gray-50 shadow-sm"
            >
              Back
            </button>
          ) : (
            <div></div>
          )}

          {currentStep < 4 ? (
            <button
              onClick={() => setCurrentStep(prev => prev + 1)}
              className="px-8 py-2.5 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 shadow-md"
            >
              Next Step
            </button>
          ) : (
            <button
              onClick={() => navigate(`/dpr/${siteId}/report/${todayDate}`)}
              className="px-8 py-2.5 bg-green-600 text-white rounded-lg font-bold hover:bg-green-700 shadow-md"
            >
              Finish & View Report
            </button>
          )}
        </div>

      </div>

      {/* Modals */}
      <StatusModal 
        {...statusModal} 
        onCancel={() => setStatusModal(prev => ({ ...prev, visible: false }))}
      />
      <InputModal
        {...inputModal}
        onCancel={() => setInputModal(prev => ({ ...prev, visible: false }))}
      />
    </div>
  );
};

export default DPRSiteDetails;
