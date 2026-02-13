// Initial data setup for Site Manager Firestore database
import { 
  collection, 
  addDoc, 
  doc, 
  setDoc,
  getDocs,
  deleteDoc
} from 'firebase/firestore';
import { db } from '../firebase';

// Sample sites data
const sampleSites = [
  {
    name: "Downtown Complex",
    location: "123 Main Street, Downtown",
    startDate: "2024-01-01",
    endDate: "2024-12-31",
    budget: 500000,
    progress: 65,
    status: "Active",
    createdAt: new Date().toISOString()
  },
  {
    name: "Highland Tower",
    location: "456 Highland Avenue",
    startDate: "2024-02-01",
    endDate: "2024-11-30",
    budget: 750000,
    progress: 45,
    status: "Active",
    createdAt: new Date().toISOString()
  },
  {
    name: "Riverside Plaza",
    location: "789 River Road",
    startDate: "2023-12-01",
    endDate: "2024-10-31",
    budget: 300000,
    progress: 80,
    status: "Active",
    createdAt: new Date().toISOString()
  }
];

// Sample labour data
const sampleLabour = [
  {
    name: "John Smith",
    role: "Site Manager",
    phone: "+1234567890",
    joinDate: "2024-01-15",
    currentSite: "Downtown Complex",
    dailyWage: 150,
    createdAt: new Date().toISOString()
  },
  {
    name: "Mike Johnson",
    role: "Foreman",
    phone: "+1234567891",
    joinDate: "2024-01-20",
    currentSite: "Downtown Complex",
    dailyWage: 120,
    createdAt: new Date().toISOString()
  },
  {
    name: "Sarah Williams",
    role: "Engineer",
    phone: "+1234567892",
    joinDate: "2024-02-01",
    currentSite: "Highland Tower",
    dailyWage: 140,
    createdAt: new Date().toISOString()
  },
  {
    name: "Tom Davis",
    role: "Electrician",
    phone: "+1234567893",
    joinDate: "2024-02-15",
    currentSite: "Riverside Plaza",
    dailyWage: 110,
    createdAt: new Date().toISOString()
  },
  {
    name: "Emily Brown",
    role: "Architect",
    phone: "+1234567894",
    joinDate: "2024-01-10",
    currentSite: "Highland Tower",
    dailyWage: 130,
    createdAt: new Date().toISOString()
  },
  {
    name: "David Wilson",
    role: "Carpenter",
    phone: "+1234567895",
    joinDate: "2024-03-01",
    currentSite: "Riverside Plaza",
    dailyWage: 100,
    createdAt: new Date().toISOString()
  }
];

// Sample attendance data
const generateSampleAttendance = () => {
  const attendance = [];
  const today = new Date();
  const labourIds = [1, 2, 3, 4, 5, 6]; // Corresponds to sampleLabour IDs
  
  // Generate attendance for today
  labourIds.forEach(labourId => {
    const statuses = ['Present', 'Absent', 'Leave'];
    const randomStatus = statuses[Math.floor(Math.random() * statuses.length)];
    
    attendance.push({
      labourId: labourId,
      date: today.toISOString().split('T')[0], // YYYY-MM-DD format
      status: randomStatus,
      checkInTime: randomStatus === 'Present' ? '09:00' : null,
      checkOutTime: randomStatus === 'Present' ? '17:00' : null,
      notes: randomStatus === 'Leave' ? 'Personal leave' : '',
      createdAt: new Date().toISOString()
    });
  });
  
  return attendance;
};

// Function to initialize Firestore with sample data
export const initializeFirestoreData = async () => {
  try {
    console.log('Initializing Firestore data...');
    
    // Add sites
    const sitesCollection = collection(db, 'sites');
    for (const site of sampleSites) {
      await addDoc(sitesCollection, site);
    }
    console.log('Sites added successfully');
    
    // Add labour
    const labourCollection = collection(db, 'labour');
    for (const labour of sampleLabour) {
      await addDoc(labourCollection, labour);
    }
    console.log('Labour added successfully');
    
    // Add attendance
    const attendanceCollection = collection(db, 'attendance');
    const sampleAttendance = generateSampleAttendance();
    for (const attendance of sampleAttendance) {
      await addDoc(attendanceCollection, attendance);
    }
    console.log('Attendance data added successfully');
    
    console.log('Firestore initialization complete!');
    return true;
  } catch (error) {
    console.error('Error initializing Firestore:', error);
    return false;
  }
};

// Function to clear all data (for testing)
export const clearFirestoreData = async () => {
  try {
    console.log('Clearing Firestore data...');
    
    // Get all collections and delete documents
    const collections = ['sites', 'labour', 'attendance'];
    
    for (const collectionName of collections) {
      const querySnapshot = await getDocs(collection(db, collectionName));
      const deletePromises = [];
      
      querySnapshot.forEach((doc) => {
        deletePromises.push(deleteDoc(doc.ref));
      });
      
      await Promise.all(deletePromises);
    }
    
    console.log('Firestore data cleared successfully!');
    return true;
  } catch (error) {
    console.error('Error clearing Firestore:', error);
    return false;
  }
};
