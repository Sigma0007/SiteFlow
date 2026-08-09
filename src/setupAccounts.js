import { doc, setDoc, Timestamp, updateDoc } from 'firebase/firestore';
import { db } from './firebase';

export const setupClientAccounts = async () => {
  console.log('🚀 Starting Firestore Permissions Setup...');

  // Since you generated the accounts in Firebase Auth manually,
  // we only need their emails here to tell the database WHAT roles they have.
  // We don't need passwords anymore!
  const accountsToSetup = [
    { email: 'ashish.sakariya@accurateenterprise.co.in', role: 'admin' },
    { email: 'anil.solanki@accurateenterprise.co.in', role: 'supervisor' },
    { email: 'lalji.vaghani@accurateenterprise.co.in', role: 'supervisor' },
    { email: 'anil.shiyal@accurateenterprise.co.in', role: 'supervisor' }
  ];

  try {
    for (const acc of accountsToSetup) {
      console.log(`📄 Assiging ${acc.role} role to: ${acc.email}...`);
      
      try {
        // 1. Give them their "Role" in the main users database
        await setDoc(doc(db, 'users', acc.email), {
          email: acc.email,
          role: acc.role,
          status: 'active',
          updatedAt: Timestamp.now()
        }, { merge: true });

        // 2. If they are a supervisor, give them a dashboard profile record
        if (acc.role === 'supervisor') {
          await setDoc(doc(db, 'supervisors', acc.email), {
            email: acc.email,
            status: 'active',
            updatedAt: Timestamp.now()
          }, { merge: true });
        }

        console.log(`✅ Success: ${acc.email} is now fully authorized.`);
      } catch (err) {
        console.error(`❌ Error setting config for ${acc.email}:`, err);
      }
    }

    // 3. Deactivate Old Test Supervisors
    console.log('🧹 Searching for test supervisors to deactivate...');
    const testEmails = ['aodedra259@rku.ac.in', 'odedraarjun0007@gmail.com'];
    
    for (const email of testEmails) {
      try {
        await updateDoc(doc(db, 'users', email), { 
          status: 'inactive',
          updatedAt: Timestamp.now()
        });
        await updateDoc(doc(db, 'supervisors', email), {
          status: 'inactive',
          updatedAt: Timestamp.now() 
        });
        console.log(`✅ Removed access for ${email}`);
      } catch (err) {
        // Ignore errors if the document doesn't exist anymore
      }
    }
    
    console.log('🎉 CLIENT ACCOUNT SETUP COMPLETE! 🎉');
    
  } catch (err) {
    console.error('❌ Critical Error during setup:', err);
  }
};
