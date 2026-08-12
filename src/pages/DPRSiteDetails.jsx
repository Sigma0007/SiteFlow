import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, Building2, Package, Users, Activity, CheckCircle, Plus, Search, RotateCcw, Clock, FileText, Trash2, TrendingUp
} from 'lucide-react';
import {
  siteServices, labourServices, materialServices, attendanceServices, dprServices, convertDocsToArray
} from '../services/firebaseServices';
import { onSnapshot, doc, query, where, collection } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../components/Auth';
import StatusModal from '../components/StatusModal';
import InputModal from '../components/InputModal';
import { PlusCircle } from 'lucide-react';

const DPRSiteDetails = ({ userRole }) => {
  const { siteId, buildingId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [site, setSite] = useState(null);
  const [building, setBuilding] = useState(null);
  const [siteBuildings, setSiteBuildings] = useState([]);
  const [buildingsLoading, setBuildingsLoading] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(true);

  // Data States
  const [allMaterials, setAllMaterials] = useState([]);
  const [allLabour, setAllLabour] = useState([]);
  const [todayAttendance, setTodayAttendance] = useState([]);
  const [todayDpr, setTodayDpr] = useState(null);

  // Process entries state
  const [processEntries, setProcessEntries] = useState([
    { id: Date.now(), work: '', quantity: '', unit: 'sq', remark: '' }
  ]);
  const [savingProcess, setSavingProcess] = useState(false);

  // Optimistic local state for immediate UI feedback
  const [dailyWorkerCounts, setDailyWorkerCounts] = useState({});
  // contractorAssignments: { "contractorName@siteId_buildingId": { count, contractorName } }
  const [contractorAssignments, setContractorAssignments] = useState({});
  const [showAddContractModal, setShowAddContractModal] = useState(false);
  const [newContractEntry, setNewContractEntry] = useState({ contractorName: '', workerCount: '' });
  const [addingContract, setAddingContract] = useState(false);

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

  const todayDate = new Date().toISOString().split('T')[0];

  const loadData = () => {
    // Kept for manual reloads if necessary, onSnapshot handles standard updates
  };

  // Fetch buildings for this site
  useEffect(() => {
    if (!siteId) return;
    setBuildingsLoading(true);
    const unsubBldg = onSnapshot(
      query(collection(db, 'buildings'), where('siteId', '==', siteId)),
      (snap) => {
        const bldgs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        setSiteBuildings(bldgs);
        setBuildingsLoading(false);
      },
      (err) => { console.error('Buildings fetch error:', err); setBuildingsLoading(false); }
    );
    return () => unsubBldg();
  }, [siteId]);

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

    // 2. Fetch Building
    if (buildingId) {
      unsubscribers.push(
        onSnapshot(doc(db, 'buildings', buildingId), (buildingDoc) => {
          if (buildingDoc.exists()) {
            setBuilding({ id: buildingDoc.id, ...buildingDoc.data() });
          }
        }, (err) => console.error('Building Error:', err))
      );
    }

    // 3. Fetch Materials
    unsubscribers.push(
      onSnapshot(collection(db, 'materials'), (snap) => {
        setAllMaterials(convertDocsToArray(snap));
      }, (err) => console.error('Material Error:', err))
    );

    // 4. Fetch Labour
    unsubscribers.push(
      onSnapshot(collection(db, 'labour'), (snap) => {
        setAllLabour(convertDocsToArray(snap));
      }, (err) => console.error('Labour Error:', err))
    );

    // 5. Fetch today's Attendance
    unsubscribers.push(
      onSnapshot(query(collection(db, 'attendance'), where('date', '==', todayDate)), (snap) => {
        setTodayAttendance(convertDocsToArray(snap));
      }, (err) => console.error('Attendance Error:', err))
    );

    // 6. Fetch DPR and load process entries
    const dprQuery = buildingId
      ? query(collection(db, 'dpr'), where('siteId', '==', siteId), where('buildingId', '==', buildingId))
      : query(collection(db, 'dpr'), where('siteId', '==', siteId));

    unsubscribers.push(
      onSnapshot(dprQuery, (snap) => {
        const allDprs = convertDocsToArray(snap);
        const todays = allDprs.find(d => d.date === todayDate && !d.is_deleted);
        setTodayDpr(todays || null);
        if (todays?.processEntries?.length > 0) {
          setProcessEntries(todays.processEntries);
        }
      }, (err) => console.error('DPR Error:', err))
    );

    return () => {
      unsubscribers.forEach(unsub => unsub());
    };
  }, [siteId, buildingId, todayDate]);

  // Load existing daily/contract counts to optimistic local state
  useEffect(() => {
    const dailyRecords = todayAttendance.filter(record => record.isDailyWorker && record.date === todayDate);
    const counts = {};
    dailyRecords.forEach(record => {
      if (record.siteId) {
        const key = record.buildingId ? `${record.siteId}_${record.buildingId}` : record.siteId;
        counts[key] = record.dailyWorkerCount || 0;
      }
    });
    setDailyWorkerCounts(counts);

    // Per-contractor assignments (non-unassigned records only, one per contractor per location)
    const contractRecords = todayAttendance.filter(
      record => record.isContractWorker && record.date === todayDate && record.siteId !== 'unassigned'
    );
    const assignments = {};
    contractRecords.forEach(record => {
      if (record.siteId && record.contractorName) {
        const locationKey = record.buildingId
          ? `${record.siteId}_${record.buildingId}`
          : record.siteId;
        assignments[`${record.contractorName}@${locationKey}`] = {
          count: record.contractWorkerCount || 0,
          contractorName: record.contractorName
        };
      }
    });
    setContractorAssignments(assignments);
  }, [todayAttendance, todayDate]);


  // === ENTERPRISE PATTERN: DERIVED STATE ===
  const unassignedDailyRecord = useMemo(() =>
    todayAttendance.find(a => a.isDailyWorker && a.siteId === 'unassigned' && a.date === todayDate),
    [todayAttendance, todayDate]);

  const unassignedDailyCount = unassignedDailyRecord?.dailyWorkerCount || 0;

  // Multiple contractors in unassigned pool — one record per contractor
  const unassignedContractRecords = useMemo(() =>
    todayAttendance.filter(a => a.isContractWorker && a.siteId === 'unassigned' && a.date === todayDate),
    [todayAttendance, todayDate]);

  const unassignedContractCount = unassignedContractRecords.reduce(
    (sum, r) => sum + (r.contractWorkerCount || 0), 0
  );

  // Location key for this page's building/site
  const locationKey = buildingId ? `${siteId}_${buildingId}` : siteId;

  const getAssignedDailyWorkers = () => {
    const key = buildingId ? `${siteId}_${buildingId}` : siteId;
    return dailyWorkerCounts[key] || 0;
  };

  // Total assigned contract workers at this building across ALL contractors
  const getAssignedContractWorkers = () =>
    Object.entries(contractorAssignments)
      .filter(([k]) => k.endsWith(`@${locationKey}`))
      .reduce((sum, [, v]) => sum + (v.count || 0), 0);

  // Per-contractor count assigned to this building
  const getAssignedCountForContractor = (contractorName) =>
    contractorAssignments[`${contractorName}@${locationKey}`]?.count || 0;

  // Pool count for a specific contractor
  const getPoolCountForContractor = (contractorName) =>
    unassignedContractRecords.find(r => r.contractorName === contractorName)?.contractWorkerCount || 0;

  // All unique contractor names from pool + assigned
  const allContractorNames = useMemo(() => {
    const names = new Set([
      ...unassignedContractRecords.map(r => r.contractorName).filter(Boolean),
      ...Object.values(contractorAssignments).map(v => v.contractorName).filter(Boolean)
    ]);
    return Array.from(names).sort();
  }, [unassignedContractRecords, contractorAssignments]);

  const showDailyPanel = unassignedDailyCount > 0 || getAssignedDailyWorkers() > 0;
  const showContractPanel = unassignedContractCount > 0 || getAssignedContractWorkers() > 0;


  // === ATOMIC WORKER ASSIGNMENT TRANSACTIONS ===
  const handleDailyWorkerAssignment = async (change) => {
    const currentAssigned = getAssignedDailyWorkers();
    const newAssigned = Math.max(0, currentAssigned + change);
    const actualChange = newAssigned - currentAssigned;

    if (actualChange === 0) return;
    if (actualChange > 0 && unassignedDailyCount < actualChange) {
      showAlert('Error', `Only ${unassignedDailyCount} unassigned daily workers available`, 'error');
      return;
    }

    const newUnassigned = unassignedDailyCount - actualChange;
    const key = buildingId ? `${siteId}_${buildingId}` : siteId;

    // Optimistic UI update
    setDailyWorkerCounts(prev => ({ ...prev, [key]: newAssigned }));

    try {
      const promises = [];
      const uniqueId = buildingId ? `daily-${siteId}-${buildingId}-${todayDate}` : `daily-${siteId}-${todayDate}`;
      const existingSiteRecord = todayAttendance.find(r => r.employeeId === uniqueId && r.date === todayDate);

      // 1. Update site record
      if (existingSiteRecord) {
        promises.push(attendanceServices.updateAttendance(existingSiteRecord.id, {
          dailyWorkerCount: newAssigned,
          updatedAt: new Date().toISOString()
        }));
      } else {
        promises.push(attendanceServices.addAttendance({
          employeeId: uniqueId,
          siteId: siteId,
          buildingId: buildingId || null,
          supervisorId: user?.uid || null,
          date: todayDate,
          status: 'present',
          isDailyWorker: true,
          dailyWorkerCount: newAssigned,
          checkIn: new Date().toTimeString().slice(0, 5),
          checkOut: '17:30',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }));
      }

      // 2. Update unassigned pool record
      if (unassignedDailyRecord) {
        promises.push(attendanceServices.updateAttendance(unassignedDailyRecord.id, {
          dailyWorkerCount: newUnassigned,
          updatedAt: new Date().toISOString()
        }));
      }

      // 3. Update DPR log
      if (todayDpr) {
        promises.push(dprServices.updateDPR(todayDpr.id, {
          dailyWorkerCount: newAssigned,
          updatedAt: new Date().toISOString()
        }));
        setTodayDpr(prev => ({ ...prev, dailyWorkerCount: newAssigned }));
      }

      await Promise.all(promises);
    } catch (error) {
      console.error('Error syncing worker assignment:', error);
      showAlert('Sync Error', 'Failed to save assignments to database.', 'error');
    }
  };

  // Per-contractor assignment: move workers between pool and this building
  const handleContractWorkerAssignment = async (contractorName, change) => {
    const unassignedRecord = unassignedContractRecords.find(r => r.contractorName === contractorName);
    const currentUnassigned = unassignedRecord?.contractWorkerCount || 0;
    const fullKey = `${contractorName}@${locationKey}`;
    const currentAssigned = contractorAssignments[fullKey]?.count || 0;
    const newAssigned = Math.max(0, currentAssigned + change);
    const actualChange = newAssigned - currentAssigned;

    if (actualChange === 0) return;
    if (actualChange > 0 && currentUnassigned < actualChange) {
      showAlert('Error', `Only ${currentUnassigned} unassigned workers from "${contractorName}" available`, 'error');
      return;
    }

    const newUnassigned = currentUnassigned - actualChange;

    // Optimistic UI update
    setContractorAssignments(prev => ({
      ...prev,
      [fullKey]: { count: newAssigned, contractorName }
    }));

    try {
      const promises = [];
      const safeName = contractorName.replace(/[^a-zA-Z0-9]/g, '_');
      const uniqueId = buildingId
        ? `contract-${siteId}-${buildingId}-${safeName}-${todayDate}`
        : `contract-${siteId}-${safeName}-${todayDate}`;
      const existingAssigned = todayAttendance.find(r => r.employeeId === uniqueId && r.date === todayDate);

      // 1. Update/create assigned record for this contractor at this building
      if (existingAssigned) {
        promises.push(attendanceServices.updateAttendance(existingAssigned.id, {
          contractWorkerCount: newAssigned,
          contractorName,
          updatedAt: new Date().toISOString()
        }));
      } else {
        promises.push(attendanceServices.addAttendance({
          employeeId: uniqueId,
          siteId,
          buildingId: buildingId || null,
          supervisorId: user?.uid || null,
          date: todayDate,
          status: 'present',
          isContractWorker: true,
          contractWorkerCount: newAssigned,
          contractorName,
          checkIn: new Date().toTimeString().slice(0, 5),
          checkOut: '17:30',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }));
      }

      // 2. Update this contractor's unassigned pool count
      if (unassignedRecord) {
        promises.push(attendanceServices.updateAttendance(unassignedRecord.id, {
          contractWorkerCount: newUnassigned,
          updatedAt: new Date().toISOString()
        }));
      }

      // 3. Update DPR with new total across all contractors
      if (todayDpr) {
        const newTotal = getAssignedContractWorkers() + actualChange;
        promises.push(dprServices.updateDPR(todayDpr.id, {
          contractWorkerCount: newTotal,
          contractorName,
          updatedAt: new Date().toISOString()
        }));
        setTodayDpr(prev => ({ ...prev, contractWorkerCount: newTotal, contractorName }));
      }

      await Promise.all(promises);
    } catch (error) {
      // Rollback optimistic update
      setContractorAssignments(prev => ({
        ...prev,
        [fullKey]: { count: currentAssigned, contractorName }
      }));
      console.error('Error syncing contract assignment:', error);
      showAlert('Sync Error', 'Failed to save assignments to database.', 'error');
    }
  };

  // Add a fresh batch of contract workers to the unassigned pool (per-contractor record)
  const handleAddNewContractWorkers = async () => {
    const count = parseInt(newContractEntry.workerCount, 10);
    const contractorName = newContractEntry.contractorName.trim();
    if (!contractorName || isNaN(count) || count <= 0) {
      showAlert('Validation', 'Please enter a valid contractor name and worker count.', 'warning');
      return;
    }
    setAddingContract(true);
    try {
      // Each contractor has a unique record in the unassigned pool
      const safeName = contractorName.replace(/[^a-zA-Z0-9]/g, '_');
      const employeeId = `contract-unassigned-${safeName}-${todayDate}`;
      const existingRecord = unassignedContractRecords.find(r => r.contractorName === contractorName);

      if (existingRecord) {
        // Add to existing contractor's pool count
        await attendanceServices.updateAttendance(existingRecord.id, {
          contractWorkerCount: (existingRecord.contractWorkerCount || 0) + count,
          updatedAt: new Date().toISOString()
        });
      } else {
        // New contractor — create a new attendance record
        await attendanceServices.addAttendance({
          employeeId,
          siteId: 'unassigned',
          buildingId: null,
          date: todayDate,
          status: 'present',
          isContractWorker: true,
          contractWorkerCount: count,
          contractorName,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
      }
      setNewContractEntry({ contractorName: '', workerCount: '' });
      setShowAddContractModal(false);
      showAlert('Success', `${count} contract worker${count > 1 ? 's' : ''} added to pool for "${contractorName}".`);
    } catch (err) {
      console.error('Error adding contract workers:', err);
      showAlert('Error', 'Failed to add contract workers.', 'error');
    } finally {
      setAddingContract(false);
    }
  };


  // --- TAB: MATERIALS ---
  const [matSearch, setMatSearch] = useState('');

  const handleAddMaterialToSite = async (material, quantity) => {
    if (quantity <= 0 || quantity > material.currentStock) {
      showAlert('Invalid Quantity', 'Please ensure you have enough stock available.', 'error');
      return;
    }
    try {
      await materialServices.updateMaterial(material.id, {
        currentStock: material.currentStock - quantity
      });
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

      setSite(prev => ({ ...prev, assignedMaterials: newSiteMaterials }));
      setAllMaterials(prev => prev.map(m => m.id === material.id ? { ...m, currentStock: m.currentStock - quantity } : m));
      showAlert('Success', 'Material allocated to site successfully!');
      loadData();
    } catch (err) {
      console.error(err);
      showAlert('Error', 'Failed to allocate material.', 'error');
    }
  };

  const handleUseMaterial = async (siteMat, useQty) => {
    if (useQty <= 0 || useQty > siteMat.quantity) {
      showAlert('Invalid Quantity', 'Cannot use more than what is available on site.', 'error');
      return;
    }
    try {
      let newSiteMaterials = [...(site.assignedMaterials || [])];
      const matIndex = newSiteMaterials.findIndex(m => m.materialId === siteMat.materialId);

      if (matIndex >= 0) {
        newSiteMaterials[matIndex].quantity -= useQty;
        if (newSiteMaterials[matIndex].quantity < 0) newSiteMaterials[matIndex].quantity = 0;
      }

      await siteServices.updateSite(siteId, { assignedMaterials: newSiteMaterials });

      let dprRef = todayDpr;
      if (!dprRef) {
        const newDpr = {
          date: todayDate,
          siteId,
          buildingId: buildingId || null,
          siteName: site.name,
          buildingName: building?.name || null,
          materialUsage: [],
          status: 'submitted',
          createdAt: new Date().toISOString()
        };
        const newDoc = await dprServices.addDPR(newDpr);
        dprRef = { id: newDoc.id, ...newDpr };
        setTodayDpr(dprRef);
      }

      const currentUsage = dprRef.materialUsage || [];
      const existingUsageIndex = currentUsage.findIndex(u => u.materialId === siteMat.materialId);

      let newUsage = [...currentUsage];
      if (existingUsageIndex >= 0) {
        newUsage[existingUsageIndex].quantity += useQty;
      } else {
        newUsage.push({
          materialId: siteMat.materialId,
          name: siteMat.name,
          quantity: useQty,
          unit: siteMat.unit || ''
        });
      }

      await dprServices.updateDPR(dprRef.id, { materialUsage: newUsage });
      setTodayDpr(prev => ({ ...prev, materialUsage: newUsage }));

      setSite(prev => ({ ...prev, assignedMaterials: newSiteMaterials }));
      showAlert('Success', `Recorded usage of ${useQty} ${siteMat.unit || ''} for ${siteMat.name}.`);
    } catch (err) {
      console.error(err);
      showAlert('Error', 'Failed to record usage.', 'error');
    }
  };

  const handleReturnMaterial = async (siteMat, returnQty) => {
    if (returnQty <= 0 || returnQty > siteMat.quantity) {
      showAlert('Invalid', 'Enter a valid quantity to return.', 'warning');
      return;
    }
    try {
      const mat = allMaterials.find(m => m.id === siteMat.materialId);
      if (mat) {
        const newStock = (mat.currentStock || mat.available || 0) + returnQty;
        await materialServices.updateMaterial(mat.id, {
          currentStock: newStock,
          available: newStock,
          updatedAt: new Date().toISOString()
        });
      }

      let newSiteMaterials = [...(site.assignedMaterials || [])];
      const matIndex = newSiteMaterials.findIndex(m => m.materialId === siteMat.materialId);
      if (matIndex >= 0) {
        newSiteMaterials[matIndex].quantity -= returnQty;
        if (newSiteMaterials[matIndex].quantity <= 0) {
          newSiteMaterials.splice(matIndex, 1);
        }
      }

      await siteServices.updateSite(siteId, { assignedMaterials: newSiteMaterials });

      setSite(prev => ({ ...prev, assignedMaterials: newSiteMaterials }));
      if (mat) {
        setAllMaterials(prev => prev.map(m => m.id === mat.id ? { ...m, currentStock: m.currentStock + returnQty } : m));
      }
      showAlert('Success', `${returnQty} units returned to general inventory.`);
      loadData();
    } catch (err) {
      console.error(err);
      showAlert('Error', 'Failed to return material.', 'error');
    }
  };

  // --- TAB: ATTENDANCE ---
  const visibleEmployees = allLabour.filter(emp => {
    const empAtt = todayAttendance.filter(a => a.employeeId === emp.id);

    const markedElsewhere = empAtt.some(a => {
      // If marked at a different site
      if (a.siteId !== siteId) return a.status === 'present' || a.status === 'absent';
      // If we are in a specific building, and they are marked in a different building
      if (buildingId && a.buildingId && a.buildingId !== buildingId) return a.status === 'present' || a.status === 'absent';
      return false;
    });

    const isOnLeave = emp.onLeave || empAtt.some(a => a.status === 'leave');

    // Only show employees assigned to this building, or unassigned (no building)
    const assignedToOtherBuilding = buildingId && emp.buildingId && emp.buildingId !== buildingId;

    return !markedElsewhere && !isOnLeave && !assignedToOtherBuilding;
  }).sort((a, b) => (a.name || '').localeCompare(b.name || ''));

  const handleMarkAttendance = async (employeeId, status) => {
    try {
      const existingRecord = todayAttendance.find(a => a.employeeId === employeeId && a.date === todayDate);
      if (existingRecord) {
        if (existingRecord.siteId === siteId) {
          await attendanceServices.updateAttendance(existingRecord.id, {
            status,
            buildingId: buildingId || null,
            updatedAt: new Date().toISOString()
          });
        } else {
          showAlert('Warning', 'Employee already has an attendance record at another site today.', 'warning');
          return;
        }
      } else {
        const attData = {
          employeeId,
          siteId,
          buildingId: buildingId || null,
          date: todayDate,
          status,
          createdAt: new Date().toISOString()
        };
        await attendanceServices.addAttendance(attData);
      }

      if (status === 'present') {
        const emp = allLabour.find(l => l.id === employeeId);
        if (emp) {
          const updates = {};
          if (emp.siteId !== siteId) updates.siteId = siteId;
          if (buildingId && emp.buildingId !== buildingId) updates.buildingId = buildingId;

          if (Object.keys(updates).length > 0) {
            await labourServices.updateLabour(employeeId, updates);
          }
        }
      }

      loadData();
    } catch (err) {
      console.error(err);
      showAlert('Error', 'Failed to mark attendance.', 'error');
    }
  };

  // --- PROCESS: Save dynamic process entries to DPR ---
  const saveProcessEntries = async () => {
    const valid = processEntries.filter(e => e.work.trim() && e.quantity && e.unit);
    if (valid.length === 0) {
      showAlert('Validation', 'Please fill at least one process with Work, Quantity and Unit.', 'warning');
      return;
    }

    if (todayDpr && todayDpr.createdAt) {
      const createdAt = new Date(todayDpr.createdAt);
      const now = new Date();
      const hoursSinceCreation = (now - createdAt) / (1000 * 60 * 60);

      if (hoursSinceCreation > 48) {
        showAlert('Edit Restricted', 'DPR can only be edited within 48 hours of creation.', 'error');
        return;
      }
    }

    setSavingProcess(true);
    try {
      let dprRef = todayDpr;
      if (!dprRef) {
        const newDpr = {
          date: todayDate,
          siteId,
          buildingId: buildingId || null,
          siteName: site.name,
          buildingName: building?.name || null,
          processEntries: valid,
          status: 'draft',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        const newDoc = await dprServices.addDPR(newDpr);
        dprRef = { id: newDoc.id, ...newDpr };
        setTodayDpr(dprRef);
      } else {
        await dprServices.updateDPR(dprRef.id, {
          processEntries: valid,
          updatedAt: new Date().toISOString()
        });
        setTodayDpr(prev => ({ ...prev, processEntries: valid }));
      }
      showAlert('Saved', 'Process entries saved successfully!');
    } catch (err) {
      console.error(err);
      showAlert('Error', 'Failed to save process entries.', 'error');
    } finally {
      setSavingProcess(false);
    }
  };

  const addProcessEntry = () => setProcessEntries(prev => [...prev, { id: Date.now(), work: '', quantity: '', unit: 'sq', remark: '' }]);
  const removeProcessEntry = (id) => setProcessEntries(prev => prev.filter(e => e.id !== id));
  const updateProcessEntry = (id, field, value) => setProcessEntries(prev => prev.map(e => e.id === id ? { ...e, [field]: value } : e));

  if (loading || buildingsLoading) {
    return (
      <div className="p-8 text-center bg-gray-50 min-h-screen flex flex-col items-center justify-center gap-4">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
        <p className="text-gray-500 text-sm">Loading site data...</p>
      </div>
    );
  }

  if (!site) return <div className="p-8 text-center text-red-600 bg-gray-50 min-h-screen">Site not found!</div>;

  if (!buildingId && siteBuildings.length > 1) {
    return (
      <div className="bg-gray-50 min-h-screen">
        <div className="bg-white border-b border-gray-200">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 py-5 flex items-center gap-4">
            <button onClick={() => navigate('/dpr')} className="p-2 bg-gray-100 hover:bg-gray-200 rounded-full transition-colors text-gray-600">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                <Building2 className="w-6 h-6 text-blue-600" /> {site.name}
              </h1>
              <p className="text-gray-500 text-sm mt-0.5">Select a building to start today's DPR</p>
            </div>
          </div>
        </div>

        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {siteBuildings.map((bldg, idx) => (
              <motion.div
                key={bldg.id}
                initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.06 }}
                whileHover={{ scale: 1.03, y: -2 }} whileTap={{ scale: 0.97 }}
                onClick={() => navigate(`/dpr/${siteId}/${bldg.id}`)}
                className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5 cursor-pointer hover:shadow-lg hover:border-blue-300 transition-all group"
              >
                <h3 className="text-lg font-bold text-gray-900 group-hover:text-blue-600 transition-colors truncate">{bldg.name}</h3>
                <div className="mt-2 flex flex-wrap gap-2">
                  {bldg.buildingType && <span className="px-2 py-0.5 bg-blue-50 text-blue-700 text-xs rounded-full font-medium">{bldg.buildingType}</span>}
                  {bldg.buildingFloors && <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded-full">{bldg.buildingFloors} floor{bldg.buildingFloors > 1 ? 's' : ''}</span>}
                  {bldg.status && (
                    <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${bldg.status === 'Active' ? 'bg-green-50 text-green-700' : bldg.status === 'Completed' ? 'bg-purple-50 text-purple-700' : 'bg-yellow-50 text-yellow-700'}`}>
                      {bldg.status}
                    </span>
                  )}
                </div>
                {typeof bldg.buildingProgress === 'number' && (
                  <div className="mt-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-gray-500">Progress</span>
                      <span className="text-xs font-semibold text-blue-600">{bldg.buildingProgress}%</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-1.5">
                      <div className="bg-blue-500 h-1.5 rounded-full transition-all" style={{ width: `${Math.min(100, bldg.buildingProgress)}%` }} />
                    </div>
                  </div>
                )}
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const siteMaterials = site.assignedMaterials || [];

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
                  {building ? `${building.name} DPR` : `${site.name} DPR`}
                </h1>
                <p className="text-gray-500 text-sm mt-1 flex items-center gap-1">
                  <Activity className="w-4 h-4" /> Today's Date: {todayDate}
                  {building && <span> • {site.name}</span>}
                </p>
              </div>
            </div>
            <button
              onClick={() => navigate(`/dpr/${siteId}/history`)}
              className="px-4 py-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors font-semibold text-sm flex items-center gap-2"
            >
              <Clock className="w-4 h-4" /> History
            </button>
          </div>

          {todayDpr && (
            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-4 p-4 bg-green-50 border border-green-100 rounded-xl flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center text-green-600"><CheckCircle className="w-6 h-6" /></div>
                <div>
                  <p className="font-bold text-green-800">DPR Already Submitted</p>
                  <p className="text-xs text-green-600">You've already completed today's tracking. You can view or download the report.</p>
                </div>
              </div>
              <button onClick={() => navigate(`/dpr/${siteId}/report/${todayDate}`)} className="px-4 py-2 bg-green-600 text-white rounded-lg font-bold text-sm hover:bg-green-700 transition flex items-center gap-2">
                <FileText className="w-4 h-4" /> View Report
              </button>
            </motion.div>
          )}

          {/* STEPPER */}
          <div className="flex items-center justify-between mt-6 max-w-xl mx-auto">
            <div className={`flex flex-col items-center cursor-pointer ${currentStep >= 1 ? 'text-blue-600' : 'text-gray-400'}`} onClick={() => setCurrentStep(1)}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold mb-1 ${currentStep >= 1 ? 'bg-blue-100' : 'bg-gray-100'}`}>1</div>
              <span className="text-xs font-semibold">Process</span>
            </div>
            <div className={`flex-1 h-1 mx-4 rounded ${currentStep >= 2 ? 'bg-blue-600' : 'bg-gray-200'}`}></div>
            <div className={`flex flex-col items-center cursor-pointer ${currentStep >= 2 ? 'text-blue-600' : 'text-gray-400'}`} onClick={() => setCurrentStep(2)}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold mb-1 ${currentStep >= 2 ? 'bg-blue-100' : 'bg-gray-100'}`}>2</div>
              <span className="text-xs font-semibold">Attendance</span>
            </div>
            <div className={`flex-1 h-1 mx-4 rounded ${currentStep >= 3 ? 'bg-blue-600' : 'bg-gray-200'}`}></div>
            <div className={`flex flex-col items-center cursor-pointer ${currentStep >= 3 ? 'text-blue-600' : 'text-gray-400'}`} onClick={() => setCurrentStep(3)}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold mb-1 ${currentStep >= 3 ? 'bg-blue-100' : 'bg-gray-100'}`}>3</div>
              <span className="text-xs font-semibold">Material</span>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* STEP 1: PROCESS SECTION */}
        {currentStep === 1 && (
          <div className="space-y-4">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="p-4 border-b border-gray-100 bg-blue-50/40 flex items-center justify-between">
                <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
                  <Activity className="w-4 h-4 text-blue-600" /> Today's Work Log
                </h3>
                <span className="text-xs text-gray-400">{processEntries.filter(e => e.work.trim()).length} entr{processEntries.filter(e => e.work.trim()).length === 1 ? 'y' : 'ies'}</span>
              </div>

              <div className="p-4 space-y-3">
                <div className="hidden sm:grid sm:grid-cols-[2fr_1fr_1fr_2fr_auto] gap-2 px-1">
                  <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Work <span className="text-red-400">*</span></span>
                  <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Quantity <span className="text-red-400">*</span></span>
                  <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Unit <span className="text-red-400">*</span></span>
                  <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Remark</span>
                  <span className="w-8" />
                </div>

                <AnimatePresence>
                  {processEntries.map((entry) => (
                    <motion.div key={entry.id} initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: -20 }} className="grid grid-cols-1 sm:grid-cols-[2fr_1fr_1fr_2fr_auto] gap-2 p-3 bg-gray-50 rounded-xl border border-gray-200">
                      <div>
                        <label className="sm:hidden text-[10px] font-semibold text-gray-400 uppercase mb-1 block">Work *</label>
                        <input type="text" placeholder="e.g. Waterproofing" value={entry.work} onChange={e => updateProcessEntry(entry.id, 'work', e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white" />
                      </div>
                      <div>
                        <label className="sm:hidden text-[10px] font-semibold text-gray-400 uppercase mb-1 block">Quantity *</label>
                        <input type="number" placeholder="0" value={entry.quantity} onChange={e => updateProcessEntry(entry.id, 'quantity', e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white" />
                      </div>
                      <div>
                        <label className="sm:hidden text-[10px] font-semibold text-gray-400 uppercase mb-1 block">Unit *</label>
                        <select value={entry.unit} onChange={e => updateProcessEntry(entry.id, 'unit', e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white">
                          <option value="sq">Sq Ft</option>
                          <option value="pieces">Pieces</option>
                          <option value="rmt">RMT</option>
                          <option value="kg">KG</option>
                          <option value="ltr">Ltr</option>
                          <option value="nos">Nos</option>
                        </select>
                      </div>
                      <div>
                        <label className="sm:hidden text-[10px] font-semibold text-gray-400 uppercase mb-1 block">Remark</label>
                        <input type="text" placeholder="Optional note" value={entry.remark} onChange={e => updateProcessEntry(entry.id, 'remark', e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white" />
                      </div>
                      <div className="flex items-end sm:items-center justify-end sm:justify-center">
                        {processEntries.length > 1 && (
                          <motion.button whileTap={{ scale: 0.9 }} onClick={() => removeProcessEntry(entry.id)} className="w-8 h-8 rounded-lg bg-red-100 text-red-500 hover:bg-red-200 flex items-center justify-center transition-colors">
                            <Trash2 className="w-4 h-4" />
                          </motion.button>
                        )}
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>

                <motion.button whileTap={{ scale: 0.98 }} onClick={addProcessEntry} className="w-full py-2.5 border-2 border-dashed border-blue-300 text-blue-500 rounded-xl text-sm font-medium hover:border-blue-400 hover:bg-blue-50 transition-colors flex items-center justify-center gap-2">
                  <Plus className="w-4 h-4" /> Add Process
                </motion.button>
              </div>

              <div className="px-4 pb-4">
                <motion.button whileTap={{ scale: 0.98 }} onClick={saveProcessEntries} disabled={savingProcess} className="w-full py-3 bg-blue-600 text-white rounded-xl font-semibold text-sm hover:bg-blue-700 transition-colors disabled:opacity-60 flex items-center justify-center gap-2">
                  {savingProcess ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Saving...</> : <><CheckCircle className="w-4 h-4" /> Save Process Log</>}
                </motion.button>
              </div>
            </div>
          </div>
        )}

        {/* STEP 2: ATTENDANCE SECTION */}
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

            {/* Attendance Count Cards */}
            <div className="p-6 bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-gray-200">

              {/* === Daily Worker Assigner === */}
              {showDailyPanel && (userRole === 'admin' || userRole === 'supervisor') && (
                <div className="bg-purple-50 rounded-xl border border-purple-200 p-3 mb-4 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-purple-500 rounded-full flex items-center justify-center flex-shrink-0">
                      <Users className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <p className="text-[10px] text-purple-600 font-medium uppercase tracking-wide">Unassigned Daily Staff Pool</p>
                      <p className="text-2xl font-bold text-purple-800 leading-none">{unassignedDailyCount}</p>
                    </div>
                  </div>

                  <div className="w-px h-12 bg-purple-200 hidden sm:block" />

                  <div className="flex flex-col items-center gap-1">
                    <p className="text-[10px] text-purple-600 font-medium uppercase tracking-wide">At This Site</p>
                    <div className="flex items-center gap-2">
                      <motion.button
                        whileTap={{ scale: 0.9 }}
                        onClick={() => handleDailyWorkerAssignment(-1)}
                        disabled={getAssignedDailyWorkers() <= 0}
                        className={`w-8 h-8 rounded-lg font-bold flex items-center justify-center text-lg transition-colors ${getAssignedDailyWorkers() <= 0 ? 'bg-gray-100 text-gray-300 cursor-not-allowed' : 'bg-red-100 text-red-600 hover:bg-red-200'}`}
                      >
                        -
                      </motion.button>
                      <span className="text-2xl font-bold text-gray-800 w-10 text-center">{getAssignedDailyWorkers()}</span>
                      <motion.button
                        whileTap={{ scale: 0.9 }}
                        onClick={() => handleDailyWorkerAssignment(1)}
                        disabled={unassignedDailyCount <= 0}
                        className={`w-8 h-8 rounded-lg font-bold flex items-center justify-center text-lg transition-colors ${unassignedDailyCount <= 0 ? 'bg-gray-100 text-gray-300 cursor-not-allowed' : 'bg-green-100 text-green-600 hover:bg-green-200'}`}
                      >
                        +
                      </motion.button>
                    </div>
                  </div>
                </div>
              )}

              {/* === Contract Worker Panel === */}
              {(userRole === 'admin' || userRole === 'supervisor') && (
                <div className="mb-4">

                  {/* Per-contractor pool + assignment widget */}
                  {(showContractPanel || allContractorNames.length > 0) && (
                    <div className="bg-orange-50 rounded-xl border border-orange-200 p-3 mb-2">
                      {/* Header */}
                      <div className="flex items-center gap-2 mb-3">
                        <div className="w-8 h-8 bg-orange-500 rounded-full flex items-center justify-center flex-shrink-0">
                          <Users className="w-4 h-4 text-white" />
                        </div>
                        <p className="text-xs font-bold text-orange-800 uppercase tracking-wide flex-1">Contract Workers</p>
                        <span className="text-xs bg-orange-200 text-orange-800 px-2 py-0.5 rounded-full font-semibold">
                          {unassignedContractCount} in pool
                        </span>
                      </div>

                      {/* Per-contractor rows */}
                      <div className="space-y-2">
                        {allContractorNames.map(contractorName => {
                          const poolCount = getPoolCountForContractor(contractorName);
                          const assignedCount = getAssignedCountForContractor(contractorName);
                          return (
                            <div key={contractorName} className="bg-white rounded-lg border border-orange-100 px-3 py-2">
                              <div className="flex items-center justify-between gap-2">
                                <div className="min-w-0 flex-1">
                                  <p className="text-xs font-semibold text-gray-800 truncate">{contractorName}</p>
                                  <p className="text-[10px] text-orange-500 font-medium">{poolCount} in pool</p>
                                </div>
                                <div className="flex items-center gap-1.5 flex-shrink-0">
                                  <span className="text-[10px] text-gray-500 uppercase tracking-wide hidden sm:block">Here</span>
                                  <motion.button
                                    whileTap={{ scale: 0.9 }}
                                    onClick={() => handleContractWorkerAssignment(contractorName, -1)}
                                    disabled={assignedCount <= 0}
                                    className={`w-7 h-7 rounded-lg font-bold flex items-center justify-center text-sm transition-colors ${assignedCount <= 0 ? 'bg-gray-100 text-gray-300 cursor-not-allowed' : 'bg-red-100 text-red-600 hover:bg-red-200'}`}
                                  >-</motion.button>
                                  <span className="text-base font-bold text-gray-800 w-7 text-center">{assignedCount}</span>
                                  <motion.button
                                    whileTap={{ scale: 0.9 }}
                                    onClick={() => handleContractWorkerAssignment(contractorName, 1)}
                                    disabled={poolCount <= 0}
                                    className={`w-7 h-7 rounded-lg font-bold flex items-center justify-center text-sm transition-colors ${poolCount <= 0 ? 'bg-gray-100 text-gray-300 cursor-not-allowed' : 'bg-green-100 text-green-600 hover:bg-green-200'}`}
                                  >+</motion.button>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                        {allContractorNames.length === 0 && (
                          <p className="text-xs text-orange-400 text-center py-1">No contractors yet. Use the button below to add.</p>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Always-visible button to add a new batch of contract workers */}
                  <motion.button
                    whileTap={{ scale: 0.97 }}
                    onClick={() => { setNewContractEntry({ contractorName: '', workerCount: '' }); setShowAddContractModal(true); }}
                    className="w-full py-2 border-2 border-dashed border-orange-300 text-orange-600 rounded-xl text-sm font-medium hover:border-orange-400 hover:bg-orange-50 transition-colors flex items-center justify-center gap-2"
                  >
                    <PlusCircle className="w-4 h-4" />
                    Add Contract Workers
                  </motion.button>
                </div>
              )}

              <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 mb-4">
                <div className="bg-white rounded-lg p-4 border border-gray-200 text-center">
                  <div className="text-2xl font-bold text-gray-800">{todayAttendance.filter(a => (a.status === 'present' || a.status === 'absent') && a.siteId === siteId).length}</div>
                  <div className="text-xs font-medium text-gray-500 uppercase tracking-wider">Total Marked</div>
                </div>
                <div className="bg-green-50 rounded-lg p-4 border border-green-200 text-center">
                  <div className="text-2xl font-bold text-green-600">{todayAttendance.filter(a => a.status === 'present' && a.siteId === siteId).length}</div>
                  <div className="text-xs font-medium text-green-500 uppercase tracking-wider">Present</div>
                </div>
                <div className="bg-red-50 rounded-lg p-4 border border-red-200 text-center">
                  <div className="text-2xl font-bold text-red-600">{todayAttendance.filter(a => a.status === 'absent' && a.siteId === siteId).length}</div>
                  <div className="text-xs font-medium text-red-500 uppercase tracking-wider">Absent</div>
                </div>
                <div className="bg-purple-50 rounded-lg p-4 border border-purple-200 text-center">
                  <div className="text-2xl font-bold text-purple-600">{todayAttendance.filter(a => a.isDailyWorker && a.siteId === siteId).reduce((sum, a) => sum + (a.dailyWorkerCount || 0), 0)}</div>
                  <div className="text-xs font-medium text-purple-500 uppercase tracking-wider">Daily Workers</div>
                </div>
                <div className="bg-orange-50 rounded-lg p-4 border border-orange-200 text-center">
                  <div className="text-2xl font-bold text-orange-600">{todayAttendance.filter(a => a.isContractWorker && a.siteId === siteId).reduce((sum, a) => sum + (a.contractWorkerCount || 0), 0)}</div>
                  <div className="text-xs font-medium text-orange-500 uppercase tracking-wider">Contract Workers</div>
                </div>
              </div>
            </div>

            <div className="overflow-x-auto p-0">
              <table className="w-full text-left text-sm">
                <thead className="bg-gray-50 text-gray-700 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Employee</th>
                    <th className="px-4 py-3 font-semibold text-right">Status (P/A)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {visibleEmployees.length === 0 ? (
                    <tr><td colSpan="2" className="text-center py-8 text-gray-500">No available employees to show</td></tr>
                  ) : visibleEmployees.map(emp => {
                    const att = todayAttendance.find(a => a.employeeId === emp.id && a.siteId === siteId);
                    const status = att?.status || 'unmarked';

                    return (
                      <tr key={emp.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <p className="font-semibold text-gray-900 text-base">{emp.name}</p>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex justify-end gap-3">
                            <button onClick={() => handleMarkAttendance(emp.id, 'present')} className={`w-10 h-10 flex items-center justify-center rounded-lg text-lg font-bold transition-all ${status === 'present' ? 'bg-green-500 text-white shadow-md scale-105 border-2 border-green-600' : 'bg-gray-100 text-gray-500 border border-gray-200 hover:bg-green-50 hover:text-green-600'}`}>P</button>
                            <button onClick={() => handleMarkAttendance(emp.id, 'absent')} className={`w-10 h-10 flex items-center justify-center rounded-lg text-lg font-bold transition-all ${status === 'absent' ? 'bg-red-500 text-white shadow-md scale-105 border-2 border-red-600' : 'bg-gray-100 text-gray-500 border border-gray-200 hover:bg-red-50 hover:text-red-600'}`}>A</button>
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

        {/* STEP 3: MATERIALS SECTION */}
        {currentStep === 3 && (
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
                          <td className="px-4 py-3">
                            <span className="font-bold text-lg">{mat.quantity}</span>
                            <span className="text-xs text-gray-500 ml-1">{mat.unit || ''}</span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <button type="button" disabled={allMaterials.length === 0} onClick={() => { showPrompt('Report Usage', `How much ${mat.name} was used at the site today?`, '0', (val) => { const qty = parseInt(val); if (!isNaN(qty)) handleUseMaterial(mat, qty); }, <TrendingUp className="w-12 h-12 text-green-500" />); }} className={`flex items-center gap-1 text-xs font-bold px-3 py-1.5 rounded-lg border ${allMaterials.length === 0 ? 'text-gray-400 bg-gray-100 border-gray-200 cursor-not-allowed' : 'text-green-600 hover:text-green-800 bg-green-50 border-green-100'}`}>
                                <Activity className="w-3.5 h-3.5" /> Use
                              </button>
                              <button type="button" disabled={allMaterials.length === 0} onClick={() => { showPrompt('Return Material', `Enter quantity of ${mat.name} to return to central warehouse:`, mat.quantity.toString(), (val) => { const qty = parseInt(val); if (!isNaN(qty)) handleReturnMaterial(mat, qty); }, <RotateCcw className="w-12 h-12 text-orange-500" />); }} className={`flex items-center gap-1 text-xs font-bold px-3 py-1.5 rounded-lg border ${allMaterials.length === 0 ? 'text-gray-400 bg-gray-100 border-gray-200 cursor-not-allowed' : 'text-orange-600 hover:text-orange-800 bg-orange-50 border-orange-100'}`}>
                                <RotateCcw className="w-3.5 h-3.5" /> Return
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {userRole === 'admin' && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <h3 className="text-lg font-bold text-gray-900 mb-4">Allocate from Global Inventory</h3>
                <div className="relative mb-6">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input type="text" placeholder="Search materials..." className="pl-10 pr-4 py-2 w-full md:w-96 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" value={matSearch} onChange={(e) => setMatSearch(e.target.value)} />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {allMaterials.filter(m => m.name.toLowerCase().includes(matSearch.toLowerCase())).slice(0, 12).map(mat => (
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
                          <button onClick={() => { showPrompt('Allocate Material', `Enter quantity of ${mat.name} to send to ${site.name}:`, '1', (val) => { const qty = parseInt(val); if (!isNaN(qty)) handleAddMaterialToSite(mat, qty); }, <PlusCircle className="w-12 h-12 text-blue-500" />); }} className="w-full text-center bg-blue-50 hover:bg-blue-100 text-blue-700 py-1.5 rounded-lg text-sm font-semibold transition-colors">
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
            )}
          </div>
        )}

        {/* NAVIGATION BUTTONS */}
        <div className="mt-8 flex justify-between max-w-2xl mx-auto">
          {currentStep > 1 ? (
            <button onClick={() => setCurrentStep(prev => prev - 1)} className="px-6 py-2.5 bg-white border border-gray-300 text-gray-700 rounded-lg font-bold hover:bg-gray-50 shadow-sm">
              Back
            </button>
          ) : <div></div>}

          {currentStep < 3 ? (
            <button onClick={() => setCurrentStep(prev => prev + 1)} className="px-8 py-2.5 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 shadow-md">
              Next Step
            </button>
          ) : (
            <button onClick={() => navigate(`/dpr/${siteId}/report/${todayDate}`)} className="px-8 py-2.5 bg-green-600 text-white rounded-lg font-bold hover:bg-green-700 shadow-md">
              Finish & View Report
            </button>
          )}
        </div>

      </div>

      <StatusModal {...statusModal} onCancel={() => setStatusModal(prev => ({ ...prev, visible: false }))} />
      <InputModal {...inputModal} onCancel={() => setInputModal(prev => ({ ...prev, visible: false }))} />

      {/* Add Contract Workers Modal */}
      {showAddContractModal && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setShowAddContractModal(false)}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            onClick={e => e.stopPropagation()}
            className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6"
          >
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center">
                <PlusCircle className="w-5 h-5 text-orange-600" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900">Add Contract Workers</h3>
                <p className="text-xs text-gray-500">They'll be added to the unassigned pool</p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wider">Contractor Name</label>
                <input
                  type="text"
                  placeholder="e.g. ABC Contractors"
                  value={newContractEntry.contractorName}
                  onChange={e => setNewContractEntry(prev => ({ ...prev, contractorName: e.target.value }))}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-400 focus:border-transparent text-sm outline-none"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wider">Number of Workers</label>
                <input
                  type="number"
                  min="1"
                  placeholder="e.g. 5"
                  value={newContractEntry.workerCount}
                  onChange={e => setNewContractEntry(prev => ({ ...prev, workerCount: e.target.value }))}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-400 focus:border-transparent text-sm outline-none"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowAddContractModal(false)}
                className="flex-1 py-2.5 border border-gray-300 text-gray-700 rounded-lg font-semibold text-sm hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleAddNewContractWorkers}
                disabled={addingContract}
                className="flex-1 py-2.5 bg-orange-500 text-white rounded-lg font-semibold text-sm hover:bg-orange-600 transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {addingContract
                  ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Saving...</>
                  : <><PlusCircle className="w-4 h-4" /> Add to Pool</>
                }
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
};

export default DPRSiteDetails;