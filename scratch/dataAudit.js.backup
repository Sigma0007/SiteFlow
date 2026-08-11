import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyAzEeofBjsiV-EglmTQexG9VVZ5uR5Rzi4",
  authDomain: "siteflow-c93e8.firebaseapp.com",
  projectId: "siteflow-c93e8",
  storageBucket: "siteflow-c93e8.firebasestorage.app",
  messagingSenderId: "619615369937",
  appId: "1:619615369937:web:620f0bb66ad610955fe3f0",
  measurementId: "G-PQYNR1BNXL"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function runAudit() {
  console.log("🔍 Starting Attendance Duplicate Audit...");
  try {
    const attendanceCollection = collection(db, 'attendance');
    const snapshot = await getDocs(attendanceCollection);
    const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    console.log(`📊 Total Attendance Documents: ${docs.length}`);

    let legacyCount = 0;
    let employeeIdCount = 0;
    let neitherCount = 0;

    // Grouping map: key = `${employeeId || labourId}_${date}` -> array of docs
    const groupings = {};

    docs.forEach(doc => {
      const empId = doc.employeeId || doc.labourId;
      const date = doc.date;

      if (doc.labourId && !doc.employeeId) legacyCount++;
      else if (doc.employeeId) employeeIdCount++;
      else neitherCount++;

      if (!empId || !date) {
        return; // Skip invalid records
      }

      const key = `${empId}_${date}`;
      if (!groupings[key]) {
        groupings[key] = [];
      }
      groupings[key].push(doc);
    });

    console.log(`- Legacy (labourId only): ${legacyCount}`);
    console.log(`- Modern (employeeId): ${employeeIdCount}`);
    console.log(`- Invalid (no ID): ${neitherCount}`);

    const duplicates = [];
    let totalDuplicateDocs = 0;

    Object.entries(groupings).forEach(([key, list]) => {
      if (list.length > 1) {
        duplicates.push({ key, count: list.length, docs: list.map(d => ({ id: d.id, employeeId: d.employeeId, labourId: d.labourId, date: d.date, status: d.status, siteId: d.siteId })) });
        totalDuplicateDocs += list.length;
      }
    });

    console.log(`\n🚨 Found ${duplicates.length} duplicate groups containing ${totalDuplicateDocs} documents!`);
    
    if (duplicates.length > 0) {
      console.log("\n📋 Duplicate Groups Details:");
      duplicates.forEach((dup, i) => {
        console.log(`\nGroup ${i+1}: Key = ${dup.key} (Total: ${dup.count})`);
        dup.docs.forEach(d => {
          console.log(`  - Doc ID: ${d.id} | employeeId: ${d.employeeId} | labourId: ${d.labourId} | date: ${d.date} | status: ${d.status} | siteId: ${d.siteId}`);
        });
      });
    }

  } catch (error) {
    console.error("❌ Audit failed:", error);
  }
}

runAudit().then(() => process.exit(0));
