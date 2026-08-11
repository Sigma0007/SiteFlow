import { doc, getDoc, updateDoc, setDoc, getDocs, collection } from 'firebase/firestore';
import { db } from '../firebase';

/**
 * Migration script to convert single organization to multi-organization with Super Admin
 * This script will:
 * 1. Designate the current admin as Super Admin
 * 2. Create a default organization for existing data
 * 3. Update all existing documents with organizationId
 */

const SUPER_ADMIN_EMAIL = 'odedraarjun928@gmail.com'; // Current admin to become Super Admin

export const migrateToMultiOrganization = async () => {
  console.log('🚀 Starting migration to multi-organization system...');
  
  try {
    // Step 1: Designate Super Admin
    console.log('📋 Step 1: Designating Super Admin...');
    await designateSuperAdmin();
    console.log('✅ Super Admin designated successfully');
    
    // Step 2: Create default organization
    console.log('📋 Step 2: Creating default organization...');
    const defaultOrgId = await createDefaultOrganization();
    console.log('✅ Default organization created with ID:', defaultOrgId);
    
    // Step 3: Migrate existing data to default organization
    console.log('📋 Step 3: Migrating existing data to default organization...');
    await migrateExistingData(defaultOrgId);
    console.log('✅ Data migration completed');
    
    console.log('🎉 Migration completed successfully!');
    return { success: true, defaultOrgId };
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    return { success: false, error: error.message };
  }
};

const designateSuperAdmin = async () => {
  const userDocRef = doc(db, 'users', SUPER_ADMIN_EMAIL);
  const userDoc = await getDoc(userDocRef);
  
  if (!userDoc.exists()) {
    throw new Error(`User document not found for ${SUPER_ADMIN_EMAIL}`);
  }
  
  const userData = userDoc.data();
  console.log('Current user data:', userData);
  
  // Update user to Super Admin
  await updateDoc(userDocRef, {
    role: 'superadmin',
    isSuperAdmin: true,
    organizationId: null, // Super Admin doesn't belong to a specific organization
    updatedAt: new Date().toISOString()
  });
  
  console.log(`✅ ${SUPER_ADMIN_EMAIL} designated as Super Admin`);
};

const createDefaultOrganization = async () => {
  const organizationsCollection = collection(db, 'organizations');
  
  const defaultOrgData = {
    name: 'Default Organization',
    logo: '',
    theme: {
      primaryColor: '#3b82f6',
      secondaryColor: '#1e40af'
    },
    domain: '',
    status: 'active',
    createdBy: SUPER_ADMIN_EMAIL,
    settings: {},
    subscription: {
      plan: 'premium',
      status: 'active'
    },
    createdAt: new Date().toISOString()
  };
  
  const orgDoc = await setDoc(doc(organizationsCollection, 'default-org'), defaultOrgData);
  console.log('✅ Default organization created');
  
  return 'default-org';
};

const migrateExistingData = async (organizationId) => {
  // Migrate supervisors
  await migrateCollection('supervisors', organizationId);
  
  // Migrate sites
  await migrateCollection('sites', organizationId);
  
  // Migrate buildings
  await migrateCollection('buildings', organizationId);
  
  // Migrate materials
  await migrateCollection('materials', organizationId);
  
  // Migrate labour
  await migrateCollection('labour', organizationId);
  
  // Migrate attendance
  await migrateCollection('attendance', organizationId);
  
  // Migrate processes
  await migrateCollection('processes', organizationId);
  
  // Migrate purchase orders
  await migrateCollection('purchaseOrders', organizationId);
  
  // Update non-Super Admin users to belong to default organization
  await migrateUsers(organizationId);
};

const migrateCollection = async (collectionName, organizationId) => {
  console.log(`Migrating ${collectionName}...`);
  
  const collectionRef = collection(db, collectionName);
  const snapshot = await getDocs(collectionRef);
  
  let updateCount = 0;
  
  for (const docSnapshot of snapshot.docs) {
    const data = docSnapshot.data();
    
    // Skip if already has organizationId
    if (data.organizationId) {
      console.log(`  ⏭️  Skipping ${collectionName}/${docSnapshot.id} - already has organizationId`);
      continue;
    }
    
    await updateDoc(doc(db, collectionName, docSnapshot.id), {
      organizationId: organizationId,
      updatedAt: new Date().toISOString()
    });
    
    updateCount++;
  }
  
  console.log(`  ✅ Migrated ${updateCount} documents from ${collectionName}`);
};

const migrateUsers = async (organizationId) => {
  console.log('Migrating users...');
  
  const usersCollection = collection(db, 'users');
  const snapshot = await getDocs(usersCollection);
  
  let updateCount = 0;
  
  for (const docSnapshot of snapshot.docs) {
    const data = docSnapshot.data();
    
    // Skip Super Admin
    if (data.role === 'superadmin' || data.email === SUPER_ADMIN_EMAIL) {
      console.log(`  ⏭️  Skipping Super Admin: ${data.email}`);
      continue;
    }
    
    // Skip if already has organizationId
    if (data.organizationId) {
      console.log(`  ⏭️  Skipping user ${data.email} - already has organizationId`);
      continue;
    }
    
    await updateDoc(doc(db, 'users', docSnapshot.id), {
      organizationId: organizationId,
      updatedAt: new Date().toISOString()
    });
    
    updateCount++;
  }
  
  console.log(`  ✅ Migrated ${updateCount} users to default organization`);
};

// Function to run migration from browser console
if (typeof window !== 'undefined') {
  window.runMigration = async () => {
    console.log('🔧 Starting migration from browser console...');
    const result = await migrateToMultiOrganization();
    console.log('Migration result:', result);
    return result;
  };
}
