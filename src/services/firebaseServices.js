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
  onSnapshot,
  documentId,
  deleteField,
  arrayUnion,
  setDoc
} from 'firebase/firestore';
import {
  getAuth,
  createUserWithEmailAndPassword,
  signOut
} from 'firebase/auth';
import { db, auth, secondaryAuth } from '../firebase.js';

// Collection references
export const sitesCollection = collection(db, 'sites');
export const labourCollection = collection(db, 'labour');
export const attendanceCollection = collection(db, 'attendance');
export const buildingsCollection = collection(db, 'buildings');
export const materialsCollection = collection(db, 'materials');
export const purchaseOrdersCollection = collection(db, 'purchaseOrders');
export const processesCollection = collection(db, 'processes');
export const supervisorsCollection = collection(db, 'supervisors');
export const organizationsCollection = collection(db, 'organizations');
export const siteInventoryCollection = collection(db, 'siteInventory');
export const siteMaterialLogsCollection = collection(db, 'siteMaterialLogs');
export const notificationsCollection = collection(db, 'notifications');

// Site Management Services
export const siteServices = {
  // Get all sites (Super Admin can see all, others filtered by organization)
  getAllSites: (organizationId = null) => {
    if (organizationId) {
      const q = query(sitesCollection, where('organizationId', '==', organizationId));
      return getDocs(q);
    }
    return getDocs(sitesCollection);
  },

  // Get site by ID
  getSiteById: (id) => getDoc(doc(db, 'sites', id)),

  // Add new site (with organizationId)
  addSite: (siteData) => {
    const siteWithOrg = {
      ...siteData,
      organizationId: siteData.organizationId || null,
      createdAt: new Date().toISOString()
    };
    return addDoc(sitesCollection, siteWithOrg);
  },

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
  onSitesChange: (callback) => onSnapshot(sitesCollection, callback),

  // Assign supervisor to site
  assignSupervisorToSite: (siteId, supervisorId) => {
    return updateDoc(doc(db, 'sites', siteId), {
      assignedSupervisors: arrayUnion(supervisorId)
    });
  },

  // Remove supervisor from site
  removeSupervisorFromSite: (siteId, supervisorId) => {
    // This would need a custom implementation since arrayRemove is not imported
    // For now, we'll read, filter, and update
  },

  // Get sites for supervisor
  getSitesForSupervisor: (supervisorId) => {
    const q = query(sitesCollection, where('assignedSupervisors', 'array-contains', supervisorId));
    return getDocs(q);
  }
};

// Building Management Services
export const buildingServices = {
  // Get all buildings (Super Admin can see all, others filtered by organization)
  getAllBuildings: (organizationId = null) => {
    if (organizationId) {
      const q = query(buildingsCollection, where('organizationId', '==', organizationId));
      return getDocs(q);
    }
    return getDocs(buildingsCollection);
  },

  // Get buildings by site ID
  getBuildingsBySite: (siteId) => {
    const q = query(buildingsCollection, where('siteId', '==', siteId));
    return getDocs(q);
  },

  // Get building by ID
  getBuildingById: (id) => getDoc(doc(db, 'buildings', id)),

  // Add new building (with organizationId)
  addBuilding: (buildingData) => {
    const buildingWithOrg = {
      ...buildingData,
      organizationId: buildingData.organizationId || null,
      createdAt: new Date().toISOString()
    };
    return addDoc(buildingsCollection, buildingWithOrg);
  },

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
  addLabour: (labourData) => {
    return addDoc(labourCollection, labourData);
  },

  // Update labour
  updateLabour: (id, labourData) => updateDoc(doc(db, 'labour', id), labourData),

  // Delete labour
  deleteLabour: (id) => deleteDoc(doc(db, 'labour', id)),

  // Get labour by site
  getLabourBySite: (siteId) => {
    const q = query(labourCollection, where('siteId', '==', siteId));
    return getDocs(q);
  },

  // Get labour by building
  getLabourByBuilding: (buildingId) => {
    const q = query(labourCollection, where('buildingId', '==', buildingId));
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

  // Get attendance by month (0-based month index)
  getAttendanceByMonth: (month, year) => {
    const start = new Date(year, month, 1);
    const end = new Date(year, month + 1, 0);
    const startDate = start.toISOString().split('T')[0];
    const endDate = end.toISOString().split('T')[0];
    const q = query(
      attendanceCollection,
      where('date', '>=', startDate),
      where('date', '<=', endDate),
      orderBy('date')
    );
    return getDocs(q);
  },

  // Get attendance by site and date
  getAttendanceBySiteAndDate: (siteId, date) => {
    const q = query(
      attendanceCollection,
      where('siteId', '==', siteId),
      where('date', '==', date)
    );
    return getDocs(q);
  },

  // Get attendance by building and date
  getAttendanceByBuildingAndDate: (buildingId, date) => {
    const q = query(
      attendanceCollection,
      where('buildingId', '==', buildingId),
      where('date', '==', date)
    );
    return getDocs(q);
  },

  // Get attendance by employee and date (standardized field: employeeId)
  getAttendanceByEmployeeAndDate: (employeeId, date) => {
    const q = query(
      attendanceCollection,
      where('employeeId', '==', employeeId),
      where('date', '==', date)
    );
    return getDocs(q);
  },

  // Back-compat: legacy labourId-based attendance
  getAttendanceByLabourAndDate: (labourId, date) => {
    const q = query(
      attendanceCollection,
      where('labourId', '==', labourId),
      where('date', '==', date)
    );
    return getDocs(q);
  },

  // Get all attendance for a specific employee (standardized field: employeeId)
  getAttendanceByEmployee: (employeeId) => {
    const q = query(attendanceCollection, where('employeeId', '==', employeeId));
    return getDocs(q);
  },

  // Back-compat: legacy labourId-based attendance
  getAttendanceByLabour: (labourId) => {
    const q = query(attendanceCollection, where('labourId', '==', labourId));
    return getDocs(q);
  },

  // Add new attendance record
  addAttendance: (attendanceData) => {
    if (attendanceData.employeeId && attendanceData.date) {
      const customId = `${attendanceData.employeeId}_${attendanceData.date}`;
      return setDoc(doc(db, 'attendance', customId), attendanceData)
        .then(() => ({ id: customId }));
    }
    return addDoc(attendanceCollection, attendanceData);
  },

  // Update attendance record
  updateAttendance: (id, attendanceData) => updateDoc(doc(db, 'attendance', id), attendanceData),

  // Set attendance record directly (uses setDoc)
  setAttendance: (id, attendanceData) => setDoc(doc(db, 'attendance', id), attendanceData),

  // Delete attendance record
  deleteAttendance: (id) => deleteDoc(doc(db, 'attendance', id)),

  // Mark attendance (standardized to use deterministic document IDs)
  markAttendance: (attendanceData) => {
    if (attendanceData.employeeId && attendanceData.date) {
      const customId = `${attendanceData.employeeId}_${attendanceData.date}`;
      return setDoc(doc(db, 'attendance', customId), attendanceData)
        .then(() => ({ id: customId }));
    }
    // Fallback
    const q = query(
      attendanceCollection,
      where('employeeId', '==', attendanceData.employeeId),
      where('date', '==', attendanceData.date)
    );

    return getDocs(q).then((snapshot) => {
      if (snapshot.empty) {
        return addDoc(attendanceCollection, attendanceData);
      } else {
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

// Site-Specific Inventory Services (Task 3)
export const siteInventoryServices = {
  // Get all items in site's inventory
  getSiteInventory: (siteId) => {
    const q = query(siteInventoryCollection, where('siteId', '==', siteId));
    return getDocs(q);
  },

  // Real-time listener for site inventory
  onSiteInventoryChange: (siteId, callback) => {
    const q = query(siteInventoryCollection, where('siteId', '==', siteId));
    return onSnapshot(q, callback);
  },

  // Add stock / Inward transaction
  addInwardMaterial: async (siteId, materialName, category, unit, quantity, notes, userEmail) => {
    const normalizedName = materialName.trim();
    const docId = `${siteId}_${normalizedName.toLowerCase().replace(/\s+/g, '_')}`;
    const docRef = doc(db, 'siteInventory', docId);
    
    // Check if item already exists
    const docSnap = await getDoc(docRef);
    let newQty = quantity;
    let existingCategory = category || 'Raw Materials';
    let existingUnit = unit || 'pcs';
    if (docSnap.exists()) {
      newQty = (docSnap.data().currentStock || 0) + quantity;
      existingCategory = docSnap.data().category || existingCategory;
      existingUnit = docSnap.data().unit || existingUnit;
    }
    
    // Update or create inventory item
    await setDoc(docRef, {
      siteId,
      name: normalizedName,
      category: existingCategory,
      unit: existingUnit,
      currentStock: newQty,
      updatedAt: new Date().toISOString()
    });

    // Create movement log
    await addDoc(siteMaterialLogsCollection, {
      siteId,
      materialName: normalizedName,
      type: 'inward',
      quantity,
      notes: notes || '',
      date: new Date().toISOString().split('T')[0],
      addedBy: userEmail || '',
      createdAt: new Date().toISOString()
    });
    
    return { id: docId, currentStock: newQty };
  },

  // Report usage / Outward transaction
  addOutwardMaterial: async (siteId, materialName, quantity, notes, userEmail) => {
    const normalizedName = materialName.trim();
    const docId = `${siteId}_${normalizedName.toLowerCase().replace(/\s+/g, '_')}`;
    const docRef = doc(db, 'siteInventory', docId);

    const docSnap = await getDoc(docRef);
    if (!docSnap.exists()) {
      throw new Error(`Material ${normalizedName} does not exist at this site.`);
    }

    const currentStock = docSnap.data().currentStock || 0;
    if (currentStock < quantity) {
      throw new Error(`Insufficient stock. Available: ${currentStock}, Requested: ${quantity}`);
    }

    const newQty = currentStock - quantity;

    // Update inventory
    await setDoc(docRef, {
      ...docSnap.data(),
      currentStock: newQty,
      updatedAt: new Date().toISOString()
    });

    // Create movement log
    await addDoc(siteMaterialLogsCollection, {
      siteId,
      materialName: normalizedName,
      type: 'outward',
      quantity,
      notes: notes || '',
      date: new Date().toISOString().split('T')[0],
      addedBy: userEmail || '',
      createdAt: new Date().toISOString()
    });

    return { id: docId, currentStock: newQty };
  },

  // Get movement logs for a site
  getSiteLogs: (siteId) => {
    const q = query(siteMaterialLogsCollection, where('siteId', '==', siteId));
    return getDocs(q);
  },

  // Real-time listener for site logs
  onSiteLogsChange: (siteId, callback) => {
    const q = query(siteMaterialLogsCollection, where('siteId', '==', siteId));
    return onSnapshot(q, callback);
  }
};

// Purchase Order Management Services
export const purchaseOrderServices = {
  // Get all purchase orders
  getAllPurchaseOrders: () => getDocs(purchaseOrdersCollection),

  // Get purchase order by ID
  getPurchaseOrderById: (id) => getDoc(doc(db, 'purchaseOrders', id)),

  // Add new purchase order
  addPurchaseOrder: (poData) => {
    if (!poData.siteId) {
      throw new Error("siteId required");
    }
    return addDoc(purchaseOrdersCollection, poData);
  },

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

  // Get purchase orders by site
  getPurchaseOrdersBySite: (siteId) => {
    const q = query(purchaseOrdersCollection, where('siteId', '==', siteId));
    return getDocs(q);
  },

  // Get purchase orders by site and status
  getPurchaseOrdersBySiteAndStatus: (siteId, status) => {
    const q = query(
      purchaseOrdersCollection,
      where('siteId', '==', siteId),
      where('status', '==', status)
    );
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


  // Add new process
  addProcess: (siteId, buildingId, processData) => {
    const processDataWithIds = {
      ...processData,
      siteId,
      buildingId
    };
    return addDoc(processesCollection, processDataWithIds);
  },

  // Add new site-level process
  addSiteProcess: (siteId, processData) => {
    const processDataWithIds = {
      ...processData,
      siteId,
      buildingId: 'site-level'
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
  addDPR: (dprData) => {
    if (!dprData.siteId) {
      throw new Error("siteId required");
    }
    return addDoc(dprCollection, dprData);
  },

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
    ...doc.data(),
    id: doc.id
  }));
};

// Utility function to get today's date string
export const getTodayString = () => {
  return new Date().toISOString().split('T')[0];
};

// Export Firebase utilities for queries
export { query, where, documentId, orderBy, onSnapshot, getDocs, getDoc, addDoc, updateDoc, deleteDoc, collection, doc, where as getWhere };

// Initialize sample supervisor data
// Initialize user documents in Firestore for existing accounts
export const initializeUserDocuments = async () => {
  try {
    console.log('🔍 Initializing user documents in Firestore...');

    // Define users with their roles
    const users = [
      { email: 'odedraarjun928@gmail.com', role: 'admin', name: 'Admin User' },
      { email: 'aodedra259@rku.ac.in', role: 'supervisor', name: 'Supervisor 1' },
      { email: 'odedraarjun0007@gmail.com', role: 'supervisor', name: 'Supervisor 2' }
    ];

    const usersCollection = collection(db, 'users');

    for (const user of users) {
      try {
        const userDocRef = doc(usersCollection, user.email);
        const userDoc = await getDoc(userDocRef);

        if (!userDoc.exists()) {
          // Create user document if it doesn't exist
          await setDoc(userDocRef, {
            email: user.email,
            name: user.name,
            role: user.role,
            status: 'active',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          });
          console.log(`✅ Created user document for ${user.email} with role: ${user.role}`);
        } else {
          // Update existing document if role is missing or invalid
          const existingData = userDoc.data();
          if (!existingData.role || (existingData.role !== 'admin' && existingData.role !== 'supervisor')) {
            await updateDoc(userDocRef, {
              role: user.role,
              updatedAt: new Date().toISOString()
            });
            console.log(`🔄 Updated user document for ${user.email} with role: ${user.role}`);
          } else {
            console.log(`✅ User document already exists for ${user.email} with role: ${existingData.role}`);
          }
        }
      } catch (error) {
        console.error(`❌ Error processing user ${user.email}:`, error);
      }
    }

    console.log('🎉 User documents initialization complete!');

  } catch (error) {
    console.error('❌ Error initializing user documents:', error);
    throw error;
  }
};

// Migration utility: Convert email-based user documents to UID-based
export const migrateEmailToUidBasedUsers = async () => {
  try {
    console.log('🔄 Starting migration from email-based to UID-based user documents...');

    // Define the email to UID mapping (you'll need to get these from Firebase Auth)
    const emailToUidMap = {
      'odedraarjun928@gmail.com': 'admin_uid_placeholder', // Replace with actual UID
      'aodedra259@rku.ac.in': 'supervisor1_uid_placeholder', // Replace with actual UID
      'odedraarjun0007@gmail.com': 'supervisor2_uid_placeholder' // Replace with actual UID
    };

    const usersCollection = collection(db, 'users');

    for (const [email, uid] of Object.entries(emailToUidMap)) {
      try {
        // Check if email-based document exists
        const emailDocRef = doc(usersCollection, email);
        const emailDoc = await getDoc(emailDocRef);

        if (emailDoc.exists()) {
          const emailData = emailDoc.data();
          console.log(`📄 Found email-based document for ${email}`);

          // Check if UID-based document already exists
          const uidDocRef = doc(usersCollection, uid);
          const uidDoc = await getDoc(uidDocRef);

          if (!uidDoc.exists()) {
            // Create UID-based document
            await setDoc(uidDocRef, {
              uid: uid,
              email: email,
              name: emailData.name,
              role: emailData.role,
              status: emailData.status || 'active',
              createdAt: emailData.createdAt || new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              migratedFrom: email
            });

            console.log(`✅ Created UID-based document for ${email} (UID: ${uid})`);

            // Optionally delete the old email-based document
            // await deleteDoc(emailDocRef);
            // console.log(`🗑️ Deleted old email-based document for ${email}`);

          } else {
            console.log(`✅ UID-based document already exists for ${email}`);
          }
        } else {
          console.log(`📄 No email-based document found for ${email}`);
        }

      } catch (error) {
        console.error(`❌ Error migrating ${email}:`, error);
      }
    }

    console.log('🎉 Migration completed!');
    console.log('📋 Run this function once after getting actual UIDs from Firebase Auth console');

  } catch (error) {
    console.error('❌ Error during migration:', error);
    throw error;
  }
};

export const initializeSampleSupervisor = async () => {
  try {
    console.log('🔍 Initializing supervisors with site assignments...');

    // Get all sites to assign
    const allSitesSnapshot = await siteServices.getAllSites();
    const allSites = convertDocsToArray(allSitesSnapshot);
    console.log('📍 Available sites:', allSites.map(s => ({ id: s.id, name: s.name })));

    if (allSites.length === 0) {
      console.log('❌ No sites found. Please create sites first.');
      return;
    }

    // Supervisor configurations
    const supervisorsToCreate = [
      {
        email: 'aodedra259@rku.ac.in',
        name: 'Supervisor 1',
        phone: '+1234567890',
        assignedSites: [allSites[0]?.id].filter(Boolean) // Assign first site
      },
      {
        email: 'odedraarjun0007@gmail.com',
        name: 'Supervisor 2',
        phone: '+0987654321',
        assignedSites: [allSites[1]?.id || allSites[0]?.id].filter(Boolean) // Assign second site or first if only one exists
      }
    ];

    for (const supervisorConfig of supervisorsToCreate) {
      console.log(`\n👤 Setting up supervisor: ${supervisorConfig.email}`);

      // Check if supervisor already exists
      const existingSupervisor = await supervisorServices.getSupervisorByEmail(supervisorConfig.email);

      if (existingSupervisor.docs.length > 0) {
        const supDoc = existingSupervisor.docs[0];
        const supervisor = supDoc.data();
        console.log(`✅ Supervisor ${supervisorConfig.email} already exists`);

        const validSiteIds = new Set(allSites.map(s => s.id));
        const currentSites = supervisor.assignedSites || [];
        let validSites = currentSites.filter(sid => validSiteIds.has(sid));
        const staleSites = currentSites.filter(sid => !validSiteIds.has(sid));

        if (staleSites.length > 0) {
          console.warn(`⚠️ Removing stale site IDs for ${supervisorConfig.email}:`, staleSites);
          await supervisorServices.updateSupervisor(supDoc.id, {
            ...supervisor,
            assignedSites: validSites,
            updatedAt: new Date().toISOString()
          });
          console.log(`🔄 ${supervisorConfig.email} cleaned. Valid sites remaining:`, validSites);
        }

        if (validSites.length === 0 && allSites.length > 0) {
          const fallbackSite = supervisorConfig.assignedSites?.[0] || allSites[0].id;
          validSites = [fallbackSite];
          await supervisorServices.updateSupervisor(supDoc.id, {
            ...supervisor,
            assignedSites: validSites,
            updatedAt: new Date().toISOString()
          });
          console.log(`📍 Auto-assigned fallback site ${fallbackSite} to ${supervisorConfig.email}`);
        } else {
          console.log(`📍 Current assigned sites:`, validSites);
        }

      } else {
        // Create new supervisor
        const supervisorData = {
          name: supervisorConfig.name,
          email: supervisorConfig.email,
          phone: supervisorConfig.phone,
          assignedSites: supervisorConfig.assignedSites,
          status: 'active',
          createdAt: new Date().toISOString()
        };

        await supervisorServices.addSupervisor(supervisorData);
        console.log(`✅ Created supervisor ${supervisorConfig.email} with assigned sites:`, supervisorConfig.assignedSites);
      }
    }

    console.log('\n🎉 Supervisor initialization complete!');
    console.log('🔄 Please refresh the page and login again to test supervisor access.');

  } catch (error) {
    console.error('❌ Error initializing supervisors:', error);
  }
};

// Supervisor Management Services
export const supervisorServices = {
  // Get all supervisors (Super Admin can see all, others filtered by organization)
  getAllSupervisors: (organizationId = null) => {
    if (organizationId) {
      const q = query(supervisorsCollection, where('organizationId', '==', organizationId));
      return getDocs(q);
    }
    return getDocs(supervisorsCollection);
  },

  // Get supervisor by ID
  getSupervisorById: (id) => getDoc(doc(db, 'supervisors', id)),

  // Get supervisor by email
  getSupervisorByEmail: (email) => {
    const q = query(supervisorsCollection, where('email', '==', email));
    return getDocs(q);
  },

  // Add new supervisor (with organizationId)
  addSupervisor: (supervisorData) => {
    const supervisorWithOrg = {
      ...supervisorData,
      organizationId: supervisorData.organizationId || null,
      createdAt: new Date().toISOString()
    };
    return addDoc(supervisorsCollection, supervisorWithOrg);
  },

  // Update supervisor
  updateSupervisor: (id, supervisorData) => updateDoc(doc(db, 'supervisors', id), supervisorData),

  // Delete supervisor
  deleteSupervisor: (id) => deleteDoc(doc(db, 'supervisors', id)),

  // Get supervisors by site
  getSupervisorsBySite: (siteId) => {
    const q = query(supervisorsCollection, where('assignedSites', 'array-contains', siteId));
    return getDocs(q);
  },

  // Real-time listener for supervisors
  onSupervisorsChange: (callback) => onSnapshot(supervisorsCollection, callback),

  // PO Request functions
  getPORequests: () => getDocs(purchaseOrdersCollection),

  onPORequestsChange: (callback) => onSnapshot(purchaseOrdersCollection, callback),

  createPORequest: (poData) => addDoc(purchaseOrdersCollection, poData),

  updatePORequest: (id, poData) => updateDoc(doc(db, 'purchaseOrders', id), poData),

  deletePORequest: (id) => deleteDoc(doc(db, 'purchaseOrders', id)),

  // Create supervisor with Firebase Auth using secondary app (admin stays logged in)
  createSupervisorWithAuth: async (supervisorData, password) => {
    try {
      if (!password || password.length < 6) {
        throw new Error('Password must be at least 6 characters.');
      }

      // Use secondaryAuth so the admin session is NOT affected
      const userCredential = await createUserWithEmailAndPassword(
        secondaryAuth,
        supervisorData.email,
        password
      );

      // Immediately sign out of secondary auth — we don't need it signed in
      await signOut(secondaryAuth);

      const email = supervisorData.email.toLowerCase().trim();
      const uid = userCredential.user.uid;

      // ── CRITICAL: Write /users/{email} with role:'supervisor' ──────────────
      // Firestore rules use getUserRole() → get(/users/{email}).role
      // Without this doc the supervisor gets "Missing or insufficient permissions"
      // on every collection query.
      await setDoc(doc(db, 'users', email), {
        role: 'supervisor',
        status: 'active',
        email: email,
        uid: uid,
        name: supervisorData.name || '',
        createdAt: new Date().toISOString()
      });
      // ───────────────────────────────────────────────────────────────────────

      // Add supervisor to Firestore supervisors collection with Firebase UID
      const supervisorWithAuth = {
        ...supervisorData,
        email: email,
        firebaseUid: uid,
        status: 'active',
        createdAt: new Date().toISOString()
      };

      const supervisorDoc = await addDoc(supervisorsCollection, supervisorWithAuth);

      return {
        success: true,
        supervisorId: supervisorDoc.id,
        message: 'Supervisor account created successfully.'
      };

    } catch (error) {
      console.error('Error creating supervisor with auth:', error);
      throw error;
    }
  },

  // Check if email is available for supervisor
  checkEmailAvailability: async (email) => {
    try {
      // Check in supervisors collection
      const supervisorSnapshot = await supervisorServices.getSupervisorByEmail(email);
      if (supervisorSnapshot.docs.length > 0) {
        return { available: false, reason: 'Email already registered as supervisor' };
      }

      // Check if admin email
      if (email === 'odedraarjun928@gmail.com') {
        return { available: false, reason: 'Email is reserved for admin' };
      }

      return { available: true };
    } catch (error) {
      console.error('Error checking email availability:', error);
      return { available: false, reason: 'Error checking email availability' };
    }
  }
};

// Notification Management Services
export const notificationServices = {
  // Get all notifications for a user
  getNotificationsForUser: (recipientEmail) => {
    const q = query(
      notificationsCollection,
      where('recipientEmail', '==', recipientEmail),
      orderBy('createdAt', 'desc')
    );
    return getDocs(q);
  },

  // Get unread notifications for a user
  getUnreadNotifications: (recipientEmail) => {
    const q = query(
      notificationsCollection,
      where('recipientEmail', '==', recipientEmail),
      where('read', '==', false),
      orderBy('createdAt', 'desc')
    );
    return getDocs(q);
  },

  // Add new notification
  addNotification: (notificationData) => {
    const notificationWithTimestamp = {
      ...notificationData,
      read: false,
      createdAt: new Date().toISOString()
    };
    return addDoc(notificationsCollection, notificationWithTimestamp);
  },

  // Mark notification as read
  markAsRead: (notificationId) => {
    return updateDoc(doc(db, 'notifications', notificationId), {
      read: true,
      readAt: new Date().toISOString()
    });
  },

  // Mark all notifications as read for a user
  markAllAsRead: async (recipientEmail) => {
    const q = query(
      notificationsCollection,
      where('recipientEmail', '==', recipientEmail),
      where('read', '==', false)
    );
    const snapshot = await getDocs(q);
    const updatePromises = snapshot.docs.map(doc => 
      updateDoc(doc.ref, { read: true, readAt: new Date().toISOString() })
    );
    return Promise.all(updatePromises);
  },

  // Delete notification
  deleteNotification: (notificationId) => {
    return deleteDoc(doc(db, 'notifications', notificationId));
  },

  // Real-time listener for notifications
  onNotificationsChange: (recipientEmail, callback) => {
    const q = query(
      notificationsCollection,
      where('recipientEmail', '==', recipientEmail),
      orderBy('createdAt', 'desc')
    );
    return onSnapshot(q, callback);
  },

  // Save FCM token for user
  saveFCMToken: async (userEmail, token) => {
    try {
      const usersCollection = collection(db, 'users');
      const userDocRef = doc(usersCollection, userEmail);
      
      // Check if user document exists first
      const userDoc = await getDoc(userDocRef);
      if (userDoc.exists()) {
        await updateDoc(userDocRef, {
          fcmToken: token,
          tokenUpdatedAt: new Date().toISOString()
        });
        console.log('FCM token saved for user:', userEmail);
      } else {
        // Create user document if it doesn't exist
        await setDoc(userDocRef, {
          email: userEmail,
          fcmToken: token,
          tokenUpdatedAt: new Date().toISOString(),
          createdAt: new Date().toISOString()
        });
        console.log('User document created with FCM token for:', userEmail);
      }
    } catch (error) {
      console.error('Error saving FCM token:', error);
      // Don't throw - allow app to continue even if token save fails
    }
  },

  // Get FCM token for user
  getFCMToken: async (userEmail) => {
    const usersCollection = collection(db, 'users');
    const userDocRef = doc(usersCollection, userEmail);
    const userDoc = await getDoc(userDocRef);
    if (userDoc.exists()) {
      return userDoc.data().fcmToken || null;
    }
    return null;
  },

  // Send push notification via Cloudflare Worker (solves CORS issue)
  sendPushNotification: async (notificationData) => {
    try {
      const workerUrl = import.meta.env.VITE_CLOUDFLARE_WORKER_URL;
      
      if (!workerUrl || workerUrl.includes('YOUR_SUBDOMAIN')) {
        console.log('Cloudflare Worker not configured. In-app notifications (bell icon) will work.');
        console.log('To enable push notifications, deploy Cloudflare Worker and update VITE_CLOUDFLARE_WORKER_URL in .env');
        return null;
      }

      // Send notification via Cloudflare Worker (proxies to OneSignal)
      const response = await fetch(workerUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          recipientEmail: notificationData.recipientEmail,
          message: notificationData.message,
          type: notificationData.type,
          poId: notificationData.poId || '',
          materialName: notificationData.materialName || '',
          quantity: notificationData.quantity || '',
          siteId: notificationData.siteId || '',
          siteName: notificationData.siteName || '',
          requestedBy: notificationData.requestedBy || ''
        })
      });

      const result = await response.json();
      
      if (response.ok) {
        console.log('✅ Push notification sent via Cloudflare Worker:', result);
        return result;
      } else {
        console.error('❌ Cloudflare Worker error:', result);
        return null;
      }
    } catch (error) {
      console.error('❌ Error sending push notification via Cloudflare Worker:', error);
      return null;
    }
  },

  // Add notification with optional push (handles permission errors)
  addNotificationWithPush: async (notificationData) => {
    try {
      // Always save to Firestore
      await notificationServices.addNotification(notificationData);
      
      // Try to send push notification (optional)
      try {
        await notificationServices.sendPushNotification(notificationData);
      } catch (pushError) {
        console.log('Push notification failed, but Firestore notification saved:', pushError.message);
      }
      
      // Show native browser notification banner if permission is granted
      if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
        try {
          const title = getNotificationTitle(notificationData.type);
          new Notification(title, {
            body: notificationData.message,
            icon: '/Sites Flow.png',
            badge: '/Sites Flow.png',
            tag: notificationData.poId || Date.now().toString()
          });
        } catch (e) {
          console.warn('Native notification notice:', e);
        }
      }

      return { success: true };
    } catch (error) {
      console.error('Error adding notification:', error);
      throw error;
    }
  }
};

// Helper function to get notification title based on type
function getNotificationTitle(type) {
  switch (type) {
    case 'po_generated':
      return 'New PO Request';
    case 'po_approved':
      return 'PO Approved';
    case 'po_arrived':
      return 'PO Arrived';
    default:
      return 'Site Manager Notification';
  }
}

// Organization Management Services (Super Admin)
export const organizationServices = {
  // Get all organizations (Super Admin only)
  getAllOrganizations: () => getDocs(organizationsCollection),

  // Get organization by ID
  getOrganizationById: (id) => getDoc(doc(db, 'organizations', id)),

  // Create new organization (Super Admin only)
  createOrganization: (organizationData) => {
    const newOrganization = {
      ...organizationData,
      status: 'active',
      createdAt: new Date().toISOString()
    };
    return addDoc(organizationsCollection, newOrganization);
  },

  // Update organization
  updateOrganization: (id, organizationData) => {
    return updateDoc(doc(db, 'organizations', id), {
      ...organizationData,
      updatedAt: new Date().toISOString()
    });
  },

  // Delete organization (Super Admin only)
  deleteOrganization: (id) => deleteDoc(doc(db, 'organizations', id)),

  // Get organizations by Super Admin email
  getOrganizationsBySuperAdmin: (email) => {
    const q = query(organizationsCollection, where('createdBy', '==', email));
    return getDocs(q);
  },

  // Real-time listener for organizations
  onOrganizationsChange: (callback) => onSnapshot(organizationsCollection, callback)
};

// Generate secure password
const generateSecurePassword = () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
  let password = '';
  for (let i = 0; i < 12; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
};

// Site Assignment Services
export const siteAssignmentServices = {
  // Update site with supervisor assignments
  assignSupervisorsToSite: (siteId, supervisorIds) => {
    return updateDoc(doc(db, 'sites', siteId), {
      assignedSupervisors: supervisorIds,
      updatedAt: new Date().toISOString()
    });
  },

  // Get sites assigned to supervisor
  getSitesBySupervisor: (supervisorId) => {
    const q = query(sitesCollection, where('assignedSupervisors', 'array-contains', supervisorId));
    return getDocs(q);
  },

  // Update site completion percentage
  updateSiteCompletion: (siteId, completionPercentage, updatedBy) => {
    return updateDoc(doc(db, 'sites', siteId), {
      completionPercentage: completionPercentage,
      lastUpdatedBy: updatedBy,
      lastUpdatedTimestamp: new Date().toISOString()
    });
  }
};

/**
 * ONE-TIME DATA REPAIR UTILITY
 *
 * Problem: Admin assignments stored site IDs only in supervisor.assignedSites
 * but did NOT update site.assignedSupervisors, so SupervisorContext could not
 * find the sites when a supervisor logged in.
 *
 * This function iterates every supervisor, reads their assignedSites, then
 * writes the supervisor's Firestore document ID into each matching site doc.
 *
 * Usage (browser console while logged in as admin):
 *   window.fixSupervisorSiteAssignments()
 */
export const fixSupervisorSiteAssignments = async () => {
  try {
    console.log('\ud83d\udd27 Starting full bidirectional supervisor-site repair...');

    const [supervisorsSnap, sitesSnap] = await Promise.all([
      getDocs(supervisorsCollection),
      getDocs(sitesCollection)
    ]);

    const supervisors = supervisorsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    const sites = sitesSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    const validSiteIds = new Set(sites.map(s => s.id));

    console.log('\ud83d\udccb Found ' + supervisors.length + ' supervisor(s) and ' + sites.length + ' site(s)');
    console.log('\ud83d\udccb Valid site IDs:', [...validSiteIds]);

    // PASS 1: Remove stale site IDs from each supervisor and build clean map
    const supervisorCleanSites = {}; // supDocId → Set of valid siteIds
    for (const sup of supervisors) {
      const raw = sup.assignedSites || [];
      const valid = raw.filter(sid => validSiteIds.has(sid));
      const stale = raw.filter(sid => !validSiteIds.has(sid));
      if (stale.length > 0) {
        console.warn('\ud83d\uddd1\ufe0f  Removing stale siteIds from ' + sup.email + ':', stale);
        await updateDoc(doc(db, 'supervisors', sup.id), { assignedSites: valid });
      }
      supervisorCleanSites[sup.id] = new Set(valid);
    }

    // PASS 2: Merge from site.assignedSupervisors → supervisor.assignedSites
    for (const site of sites) {
      for (const supId of (site.assignedSupervisors || [])) {
        if (!supervisorCleanSites[supId]) supervisorCleanSites[supId] = new Set();
        supervisorCleanSites[supId].add(site.id);
      }
    }

    // PASS 3: Write cleaned assignedSites to each supervisor doc
    let updatedSups = 0;
    for (const sup of supervisors) {
      const newArr = Array.from(supervisorCleanSites[sup.id] || new Set());
      const oldArr = (sup.assignedSites || []).filter(sid => validSiteIds.has(sid));
      const changed = newArr.length !== oldArr.length || newArr.some(id => !oldArr.includes(id));
      if (changed) {
        await updateDoc(doc(db, 'supervisors', sup.id), { assignedSites: newArr });
        console.log('\u2705 Supervisor ' + sup.email + ' assignedSites ->', newArr);
        updatedSups++;
      }
    }

    // PASS 4: Rebuild site.assignedSupervisors from the clean map
    const siteToSups = {};
    for (const [supId, siteSet] of Object.entries(supervisorCleanSites)) {
      for (const siteId of siteSet) {
        if (!siteToSups[siteId]) siteToSups[siteId] = new Set();
        siteToSups[siteId].add(supId);
      }
    }
    let updatedSites = 0;
    for (const site of sites) {
      const newArr = Array.from(siteToSups[site.id] || new Set());
      const oldArr = site.assignedSupervisors || [];
      const changed = newArr.length !== oldArr.length || newArr.some(id => !oldArr.includes(id));
      if (changed) {
        await updateDoc(doc(db, 'sites', site.id), { assignedSupervisors: newArr });
        console.log('\u2705 Site ' + site.name + ' assignedSupervisors ->', newArr);
        updatedSites++;
      }
    }

    console.log('\n\ud83c\udf89 Repair complete! Updated ' + updatedSups + ' supervisor(s) and ' + updatedSites + ' site(s).');
    console.log('\ud83d\udd04 Supervisors should refresh / re-login now.');
    return { success: true, updatedSupervisors: updatedSups, updatedSites };
  } catch (error) {
    console.error('\u274c Error during repair:', error);
    return { success: false, error: error.message };
  }
};

/**
 * STRuctural / Relational Data Migration Utility
 * Replaces legacy keys with strictly enforced references:
 * labour.currentSite -> labour.siteId
 * labour.currentBuilding -> labour.buildingId
 * attendance.labourId -> attendance.employeeId
 */
export const runDataMigration = async () => {
  try {
    console.log('🚧 Starting Data Migration...');
    let migratedLabour = 0;
    let migratedAttendance = 0;

    // Migrate Labour
    const labourSnap = await getDocs(labourCollection);
    for (const docSnap of labourSnap.docs) {
      const data = docSnap.data();
      let updates = {};
      let changed = false;

      if (data.currentSite !== undefined) {
        updates.siteId = data.currentSite;
        updates.currentSite = deleteField();
        changed = true;
      }
      if (data.currentBuilding !== undefined) {
        updates.buildingId = data.currentBuilding;
        updates.currentBuilding = deleteField();
        changed = true;
      }

      if (changed) {
        await updateDoc(docSnap.ref, updates);
        migratedLabour++;
      }
    }

    // Migrate & Deduplicate Attendance
    const attendanceSnap = await getDocs(attendanceCollection);
    const rawAttendance = attendanceSnap.docs.map(doc => ({ id: doc.id, ref: doc.ref, ...doc.data() }));

    // Grouping by ${employeeId}_${date}
    const groupings = {};
    for (const doc of rawAttendance) {
      const empId = doc.employeeId || doc.labourId;
      const date = doc.date;
      if (!empId || !date) continue;
      
      const key = `${empId}_${date}`;
      if (!groupings[key]) groupings[key] = [];
      groupings[key].push(doc);
    }

    const docsToDelete = new Set();
    
    for (const [key, records] of Object.entries(groupings)) {
      const [empId, date] = key.split('_');
      const deterministicId = `${empId}_${date}`;

      // Pick the best status among duplicate records: present > leave > absent
      let bestRecord = records[0];
      records.forEach(r => {
        if (r.status === 'present') {
          bestRecord = r;
        } else if (r.status === 'leave' && bestRecord.status !== 'present') {
          bestRecord = r;
        }
      });

      const unifiedData = {
        employeeId: empId,
        siteId: bestRecord.siteId || null,
        buildingId: bestRecord.buildingId || null,
        supervisorId: bestRecord.supervisorId || null,
        date: date,
        status: bestRecord.status,
        checkIn: bestRecord.checkIn || null,
        checkOut: bestRecord.checkOut || null,
        updatedAt: new Date().toISOString(),
        createdAt: bestRecord.createdAt || new Date().toISOString()
      };

      // Write to deterministic ID document
      await setDoc(doc(db, 'attendance', deterministicId), unifiedData);
      migratedAttendance++;

      // Mark all raw documents that are not the deterministic doc for deletion
      records.forEach(r => {
        if (r.id !== deterministicId) {
          docsToDelete.add(r.id);
        }
      });
    }

    // Perform deletions
    for (const idToDelete of docsToDelete) {
      await deleteDoc(doc(db, 'attendance', idToDelete));
    }

    console.log(`✅ Migration complete. Migrated ${migratedLabour} labour docs, ${migratedAttendance} attendance docs.`);
    return { success: true, labour: migratedLabour, attendance: migratedAttendance };
  } catch (error) {
    console.error('❌ Data Migration failed:', error);
    throw error;
  }
};
/**
 * syncSiteToSupervisors(siteId, supervisorDocIds)
 *
 * THE single function every site-creation / assignment path must call.
 * It performs a bidirectional sync:
 *   1. sites/{siteId}.assignedSupervisors  ← adds each supervisorDocId
 *   2. supervisors/{id}.assignedSites      ← adds siteId to each supervisor's doc
 *
 * @param {string}   siteId            - Firestore doc ID of the newly created / updated site
 * @param {string[]} supervisorDocIds  - Firestore doc IDs from the supervisors collection
 */
export const syncSiteToSupervisors = async (siteId, supervisorDocIds = []) => {
  if (!siteId) throw new Error('syncSiteToSupervisors: siteId is required');
  if (!supervisorDocIds.length) return;

  console.log('🔄 syncSiteToSupervisors:', siteId, '←→', supervisorDocIds);

  // 1. Write all supervisor IDs into the site document
  await updateDoc(doc(db, 'sites', siteId), {
    assignedSupervisors: arrayUnion(...supervisorDocIds)
  });

  // 2. Write the siteId into each supervisor document
  await Promise.all(
    supervisorDocIds.map(supDocId =>
      updateDoc(doc(db, 'supervisors', supDocId), {
        assignedSites: arrayUnion(siteId)
      }).catch(err =>
        console.warn('⚠️ Could not update supervisor', supDocId, err.message)
      )
    )
  );

  console.log('✅ syncSiteToSupervisors complete for site', siteId);
};
/**
 * syncStaffToSite(siteId, staffDocIds)
 *
 * EXCLUSIVE assignment: each staff member can only belong to ONE site.
 * Steps:
 *  1. Find all other sites that currently have these staff in assignedStaff
 *  2. Remove the staff from those old sites
 *  3. Update labour.siteId = new siteId
 */
export const syncStaffToSite = async (siteId, staffDocIds = []) => {
  if (!siteId || !staffDocIds.length) return;
  console.log('\ud83d\udc65 syncStaffToSite (exclusive):', staffDocIds.length, 'staff → site', siteId);

  // Load all sites to remove these staff from any other site they are on
  const allSitesSnap = await getDocs(sitesCollection);
  const allSites = allSitesSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  const staffSet = new Set(staffDocIds);

  await Promise.all(
    allSites
      .filter(site => site.id !== siteId)
      .map(async (site) => {
        const current = site.assignedStaff || [];
        const overlap = current.filter(id => staffSet.has(id));
        if (!overlap.length) return;
        const cleaned = current.filter(id => !staffSet.has(id));
        await updateDoc(doc(db, 'sites', site.id), { assignedStaff: cleaned });
        console.log('\ud83d\uddd1\ufe0f Removed', overlap.length, 'staff from old site:', site.name);
      })
  );

  // Update each labour doc to point to the new site
  await Promise.all(
    staffDocIds.map(staffId =>
      updateDoc(doc(db, 'labour', staffId), { siteId })
        .then(() => console.log('✅ Staff', staffId, '→ siteId =', siteId))
        .catch(err => console.warn('⚠️ Could not update staff', staffId, err.message))
    )
  );

  console.log('✅ syncStaffToSite complete — staff exclusively on site', siteId);
};

export const syncSingleStaffToSite = async (staffId, siteId) => {
  if (!staffId) return;
  console.log('👷 syncSingleStaffToSite:', staffId, '→ site', siteId);

  const allSitesSnap = await getDocs(sitesCollection);

  await Promise.all(
    allSitesSnap.docs.map(async (docSnap) => {
      const site = { id: docSnap.id, ...docSnap.data() };
      const current = site.assignedStaff || [];
      const hasStaff = current.includes(staffId);

      if (siteId && site.id === siteId) {
        if (!hasStaff) {
          await updateDoc(doc(db, 'sites', site.id), {
            assignedStaff: arrayUnion(staffId)
          });
        }
      } else {
        if (hasStaff) {
          const cleaned = current.filter(id => id !== staffId);
          await updateDoc(doc(db, 'sites', site.id), { assignedStaff: cleaned });
        }
      }
    })
  );

  if (siteId !== null) {
    await updateDoc(doc(db, 'labour', staffId), { siteId }).catch(e => console.warn(e));
  }
};

// ─── Daily Expense Services ─────────────────────────────────────────────────
export const expensesCollection = collection(db, 'expenses');

export const expenseServices = {
  addExpense: (data) => addDoc(expensesCollection, data),
  getExpensesBySite: (siteId) =>
    getDocs(query(expensesCollection, where('siteId', '==', siteId))),
  getExpensesBySiteAndDate: (siteId, date) =>
    getDocs(query(expensesCollection, where('siteId', '==', siteId), where('date', '==', date))),
  deleteExpense: (id) => deleteDoc(doc(db, 'expenses', id)),
};
