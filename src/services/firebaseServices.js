import { 
  collection, 
  doc, 
  getDocs, 
  getDoc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  orderBy,
  onSnapshot 
} from 'firebase/firestore';
import { db } from '../firebase.js';

// Collection references
const sitesCollection = collection(db, 'sites');
const labourCollection = collection(db, 'labour');
const attendanceCollection = collection(db, 'attendance');
const buildingsCollection = collection(db, 'buildings');
const materialsCollection = collection(db, 'materials');
const purchaseOrdersCollection = collection(db, 'purchaseOrders');
const processesCollection = collection(db, 'processes');

// Site Management Services
export const siteServices = {
  // Get all sites
  getAllSites: () => getDocs(sitesCollection),
  
  // Get site by ID
  getSiteById: (id) => getDoc(doc(db, 'sites', id)),
  
  // Add new site
  addSite: (siteData) => addDoc(sitesCollection, siteData),
  
  // Update site
  updateSite: (id, siteData) => updateDoc(doc(db, 'sites', id), siteData),
  
  // Delete site (with cascade delete for DPRs)
  deleteSite: async (id) => {
    try {
      // First, delete all related DPRs
      await dprServices.deleteDPRsBySiteId(id)
      
      // Then delete the site
      return deleteDoc(doc(db, 'sites', id))
    } catch (error) {
      console.error('Error deleting site and related DPRs:', error)
      throw error
    }
  },
  
  // Soft delete site (mark as deleted without removing DPRs)
  softDeleteSite: (id) => updateDoc(doc(db, 'sites', id), { 
    is_deleted: true, 
    deletedAt: new Date().toISOString() 
  }),
  
  // Real-time listener for sites
  onSitesChange: (callback) => onSnapshot(sitesCollection, callback)
};

// Building Management Services
export const buildingServices = {
  // Get all buildings
  getAllBuildings: () => getDocs(buildingsCollection),
  
  // Get buildings by site ID
  getBuildingsBySite: (siteId) => {
    const q = query(buildingsCollection, where('siteId', '==', siteId));
    return getDocs(q);
  },
  
  // Get building by ID
  getBuildingById: (id) => getDoc(doc(db, 'buildings', id)),
  
  // Add new building
  addBuilding: (buildingData) => addDoc(buildingsCollection, buildingData),
  
  // Update building
  updateBuilding: (id, buildingData) => updateDoc(doc(db, 'buildings', id), buildingData),
  
  // Delete building
  deleteBuilding: (id) => deleteDoc(doc(db, 'buildings', id)),
  
  // Get buildings by site with real-time listener
  onBuildingsBySiteChange: (siteId, callback) => {
    const q = query(buildingsCollection, where('siteId', '==', siteId));
    return onSnapshot(q, callback);
  },
  
  // Real-time listener for all buildings
  onBuildingsChange: (callback) => onSnapshot(buildingsCollection, callback)
};

// Labour Management Services
export const labourServices = {
  // Get all labour
  getAllLabour: () => getDocs(labourCollection),
  
  // Get labour by ID
  getLabourById: (id) => getDoc(doc(db, 'labour', id)),
  
  // Add new labour
  addLabour: (labourData) => addDoc(labourCollection, labourData),
  
  // Update labour
  updateLabour: (id, labourData) => updateDoc(doc(db, 'labour', id), labourData),
  
  // Delete labour
  deleteLabour: (id) => deleteDoc(doc(db, 'labour', id)),
  
  // Get labour by site
  getLabourBySite: (siteName) => {
    const q = query(labourCollection, where('currentSite', '==', siteName));
    return getDocs(q);
  },
  
  // Real-time listener for labour
  onLabourChange: (callback) => onSnapshot(labourCollection, callback)
};

// Attendance Management Services
export const attendanceServices = {
  // Get all attendance
  getAllAttendance: () => getDocs(attendanceCollection),
  
  // Get attendance by date
  getAttendanceByDate: (date) => {
    const q = query(attendanceCollection, where('date', '==', date));
    return getDocs(q);
  },
  
  // Get attendance by labour and date
  getAttendanceByLabourAndDate: (labourId, date) => {
    const q = query(
      attendanceCollection, 
      where('labourId', '==', labourId),
      where('date', '==', date)
    );
    return getDocs(q);
  },
  
  // Get all attendance for a specific labour
  getAttendanceByLabour: (labourId) => {
    const q = query(attendanceCollection, where('labourId', '==', labourId));
    return getDocs(q);
  },
  
  // Add new attendance record
  addAttendance: (attendanceData) => addDoc(attendanceCollection, attendanceData),
  
  // Update attendance record
  updateAttendance: (id, attendanceData) => updateDoc(doc(db, 'attendance', id), attendanceData),
  
  // Delete attendance record
  deleteAttendance: (id) => deleteDoc(doc(db, 'attendance', id)),
  
  // Mark attendance (legacy function - now uses add/update)
  markAttendance: (attendanceData) => {
    // Check if attendance already exists for this labour and date
    const q = query(
      attendanceCollection,
      where('labourId', '==', attendanceData.labourId),
      where('date', '==', attendanceData.date)
    );
    
    return getDocs(q).then((snapshot) => {
      if (snapshot.empty) {
        // Add new attendance record
        return addDoc(attendanceCollection, attendanceData);
      } else {
        // Update existing record
        const docId = snapshot.docs[0].id;
        return updateDoc(doc(db, 'attendance', docId), attendanceData);
      }
    });
  },
  
  // Get attendance for a date range
  getAttendanceByDateRange: (startDate, endDate) => {
    const q = query(
      attendanceCollection,
      where('date', '>=', startDate),
      where('date', '<=', endDate),
      orderBy('date')
    );
    return getDocs(q);
  },
  
  // Real-time listener for attendance
  onAttendanceChange: (callback) => onSnapshot(attendanceCollection, callback)
};

// Material Management Services
export const materialServices = {
  // Get all materials
  getAllMaterials: () => getDocs(materialsCollection),
  
  // Get material by ID
  getMaterialById: (id) => getDoc(doc(db, 'materials', id)),
  
  // Add new material
  addMaterial: (materialData) => addDoc(materialsCollection, materialData),
  
  // Update material
  updateMaterial: (id, materialData) => updateDoc(doc(db, 'materials', id), materialData),
  
  // Delete material
  deleteMaterial: (id) => deleteDoc(doc(db, 'materials', id)),
  
  // Get materials by category
  getMaterialsByCategory: (category) => {
    const q = query(materialsCollection, where('category', '==', category));
    return getDocs(q);
  },
  
  // Get low stock materials
  getLowStockMaterials: () => {
    const q = query(materialsCollection, where('currentStock', '<=', 'minStock'));
    return getDocs(q);
  },
  
  // Real-time listener for materials
  onMaterialsChange: (callback) => onSnapshot(materialsCollection, callback)
};

// Purchase Order Management Services
export const purchaseOrderServices = {
  // Get all purchase orders
  getAllPurchaseOrders: () => getDocs(purchaseOrdersCollection),
  
  // Get purchase order by ID
  getPurchaseOrderById: (id) => getDoc(doc(db, 'purchaseOrders', id)),
  
  // Add new purchase order
  addPurchaseOrder: (poData) => addDoc(purchaseOrdersCollection, poData),
  
  // Update purchase order
  updatePurchaseOrder: (id, poData) => updateDoc(doc(db, 'purchaseOrders', id), poData),
  
  // Delete purchase order
  deletePurchaseOrder: (id) => deleteDoc(doc(db, 'purchaseOrders', id)),
  
  // Get purchase orders by status
  getPurchaseOrdersByStatus: (status) => {
    const q = query(purchaseOrdersCollection, where('status', '==', status));
    return getDocs(q);
  },
  
  // Get purchase orders by material
  getPurchaseOrdersByMaterial: (materialName) => {
    const q = query(purchaseOrdersCollection, where('materialName', '==', materialName));
    return getDocs(q);
  },
  
  // Real-time listener for purchase orders
  onPurchaseOrdersChange: (callback) => onSnapshot(purchaseOrdersCollection, callback)
};

// Process Management Services
export const processServices = {
  // Get processes by building
  getProcessesByBuilding: (siteId, buildingId) => {
    const q = query(
      processesCollection, 
      where('siteId', '==', siteId),
      where('buildingId', '==', buildingId)
    );
    return getDocs(q);
  },

  // Get processes by site (for site-level processes)
  getProcessesBySite: (siteId) => {
    const q = query(
      processesCollection, 
      where('siteId', '==', siteId),
      where('buildingId', '==', 'site-level')
    );
    return getDocs(q);
  },

  // Get process by ID
  getProcessById: (siteId, buildingId, processId) => {
    return getDoc(doc(db, 'processes', processId));
  },

  // Add process (works for both building and site level)
  addProcess: (siteId, buildingId, processData) => {
    return addDoc(collection(db, 'processes'), processData);
  },
  
  // Add new process
  addProcess: (siteId, buildingId, processData) => {
    const processDataWithIds = {
      ...processData,
      siteId,
      buildingId
    };
    return addDoc(processesCollection, processDataWithIds);
  },
  
  // Update process
  updateProcess: (siteId, buildingId, processId, processData) => {
    const processDataWithIds = {
      ...processData,
      siteId,
      buildingId
    };
    return updateDoc(doc(db, 'processes', processId), processDataWithIds);
  },
  
  // Delete process
  deleteProcess: (siteId, buildingId, processId) => {
    return deleteDoc(doc(db, 'processes', processId));
  },
  
  // Add sub-process to a process
  addSubProcess: async (siteId, buildingId, processId, subProcessData) => {
    const processRef = doc(db, 'processes', processId);
    const processDoc = await getDoc(processRef);
    
    if (processDoc.exists()) {
      const currentData = processDoc.data();
      const updatedSubProcesses = [...(currentData.subProcesses || []), subProcessData];
      
      return updateDoc(processRef, { 
        subProcesses: updatedSubProcesses,
        updatedAt: new Date().toISOString()
      });
    }
  },
  
  // Update sub-process
  updateSubProcess: async (siteId, buildingId, processId, subProcessId, subProcessData) => {
    const processRef = doc(db, 'processes', processId);
    const processDoc = await getDoc(processRef);
    
    if (processDoc.exists()) {
      const currentData = processDoc.data();
      const updatedSubProcesses = currentData.subProcesses.map(sp => 
        sp.id === subProcessId ? { ...sp, ...subProcessData } : sp
      );
      
      return updateDoc(processRef, { 
        subProcesses: updatedSubProcesses,
        updatedAt: new Date().toISOString()
      });
    }
  },
  
  // Delete sub-process
  deleteSubProcess: async (siteId, buildingId, processId, subProcessId) => {
    const processRef = doc(db, 'processes', processId);
    const processDoc = await getDoc(processRef);
    
    if (processDoc.exists()) {
      const currentData = processDoc.data();
      const updatedSubProcesses = currentData.subProcesses.filter(sp => sp.id !== subProcessId);
      
      return updateDoc(processRef, { 
        subProcesses: updatedSubProcesses,
        updatedAt: new Date().toISOString()
      });
    }
  },
  
  // Real-time listener for processes by building
  onProcessesChange: (siteId, buildingId, callback) => {
    const q = query(
      processesCollection, 
      where('siteId', '==', siteId),
      where('buildingId', '==', buildingId)
    );
    return onSnapshot(q, callback);
  },

  // Real-time listener for site-level processes
  onSiteProcessesChange: (siteId, callback) => {
    const q = query(
      processesCollection, 
      where('siteId', '==', siteId),
      where('buildingId', '==', 'site-level')
    );
    return onSnapshot(q, callback);
  },
};

// DPR Collection
const dprCollection = collection(db, 'dpr')

export const dprServices = {
  // Get all DPR
  getAllDPR: () => getDocs(dprCollection),
  
  // Get DPR by date
  getDPRByDate: (date) => {
    const q = query(dprCollection, where('date', '==', date))
    return getDocs(q)
  },
  
  // Get DPR by site
  getDPRBySite: (siteName) => {
    const q = query(dprCollection, where('siteName', '==', siteName))
    return getDocs(q)
  },
  
  // Get DPR by site ID
  getDPRBySiteId: (siteId) => {
    const q = query(dprCollection, where('siteId', '==', siteId))
    return getDocs(q)
  },
  
  // Add new DPR
  addDPR: (dprData) => addDoc(dprCollection, dprData),
  
  // Update DPR
  updateDPR: (id, dprData) => updateDoc(doc(db, 'dpr', id), dprData),
  
  // Delete DPR
  deleteDPR: (id) => deleteDoc(doc(db, 'dpr', id)),
  
  // Delete all DPRs for a site (cascade delete)
  deleteDPRsBySiteId: async (siteId) => {
    const q = query(dprCollection, where('siteId', '==', siteId))
    const snapshot = await getDocs(q)
    
    const deletePromises = snapshot.docs.map(doc => deleteDoc(doc.ref))
    return Promise.all(deletePromises)
  },
  
  // Real-time listener for DPR
  onDPRChange: (callback) => onSnapshot(dprCollection, callback)
}

// Utility function to convert Firestore docs to objects
export const convertDocsToArray = (snapshot) => {
  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  }));
};

// Utility function to get today's date string
export const getTodayString = () => {
  return new Date().toISOString().split('T')[0];
};
