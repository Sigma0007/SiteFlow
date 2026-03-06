import React, { createContext, useContext, useState, useEffect } from 'react';
import { 
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged 
} from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { motion } from 'framer-motion';
import { Lock, Mail, LogOut, User, Eye, EyeOff } from 'lucide-react';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

// Role guard helper functions
export const isAdmin = (userRole) => {
  return userRole === 'admin';
};

export const isSupervisor = (userRole) => {
  return userRole === 'supervisor';
};

// Hook-based role guards for convenience
export const useIsAdmin = () => {
  const { userRole } = useAuth();
  return isAdmin(userRole);
};

export const useIsSupervisor = () => {
  const { userRole } = useAuth();
  return isSupervisor(userRole);
};

// Function to determine role from Firestore
const determineRoleFromFirestore = async (email) => {
  try {
    console.log('🔍 Checking user document for:', email);
    
    const userDoc = await getDoc(doc(db, 'users', email));
    
    if (!userDoc.exists()) {
      console.log('❌ User document not found for:', email);
      return null;
    }
    
    const userData = userDoc.data();
    console.log('📄 User document found:', userData);
    
    // Strict role validation
    if (userData.role !== 'admin' && userData.role !== 'supervisor') {
      console.log('❌ Invalid role in user document:', userData.role, '- Must be "admin" or "supervisor"');
      return null;
    }
    
    // Strict status validation
    if (userData.status !== 'active') {
      console.log('❌ User account is not active:', userData.status, '- Account status must be "active"');
      return null;
    }
    
    console.log('✅ Valid role and status found in Firestore:', userData.role, userData.status);
    return userData.role;
    
  } catch (error) {
    console.error('❌ Error fetching user document:', error);
    return null;
  }
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        // Firebase user is logged in
        setUser(firebaseUser);
        
        console.log('Session restore for:', firebaseUser.email);
        
        // Check if user document exists and validate role/status
        console.log('🔍 Checking user document and validating role/status for session restore...');
        const firestoreRole = await determineRoleFromFirestore(firebaseUser.email);
        
        if (!firestoreRole) {
          // If validation fails, sign out user with specific error
          await signOut(auth);
          setUser(null);
          setUserRole(null);
          setLoading(false);
          console.log('❌ Session restore denied - User validation failed for:', firebaseUser.email);
          return;
        }
        
        // Set the validated role from Firestore
        setUserRole(firestoreRole);
        setLoading(false);
        
        console.log('✅ Session restored with validated role:', firestoreRole, 'for:', firebaseUser.email);
      } else {
        setUser(null);
        setUserRole(null);
        setLoading(false);
      }
    });

    return unsubscribe;
  }, []);

  const login = async (email, password) => {
    try {
      console.log('Login attempt for:', email);
      
      // Firebase Authentication first
      const result = await signInWithEmailAndPassword(auth, email, password);
      const user = result.user;
      setUser(user);
      
      console.log('✅ Firebase auth successful for:', user.email);
      
      // Check if user document exists and validate role/status
      console.log('🔍 Checking user document and validating role/status in Firestore...');
      const firestoreRole = await determineRoleFromFirestore(user.email);
      
      if (!firestoreRole) {
        // If validation fails, sign out user with specific error
        await signOut(auth);
        setUser(null);
        setUserRole(null);
        console.log('❌ Access denied - User validation failed for:', user.email);
        throw new Error('Access denied - Account not found, invalid role, or account not active. Please contact administrator.');
      }
      
      // Set the validated role from Firestore
      setUserRole(firestoreRole);
      setLoading(false);
      
      console.log('✅ Login successful with validated role:', firestoreRole, 'for:', user.email);
      
      return result;
    } catch (error) {
      // Reset role on login failure
      setUserRole(null);
      setUser(null);
      
      // Pass through our custom error messages
      if (error.message.includes('Access denied')) {
        throw error;
      }
      
      // Handle Firebase auth errors
      if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
        throw new Error('Invalid email or password');
      }
      
      throw new Error('Login failed: ' + error.message);
    }
  };

  const logout = async () => {
    try {
      await signOut(auth);
      setUser(null);
      setUserRole(null);
    } catch (error) {
      // Even if Firebase logout fails, clear local state
      setUser(null);
      setUserRole(null);
    }
  };

  const value = {
    user,
    userRole,
    login,
    logout,
    loading
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

export const LoginForm = ({ onLogin }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [loginRole, setLoginRole] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    
    // Role will be determined from Firestore after successful authentication
    setLoginRole('Loading...');

    try {
      await onLogin(email, password);
    } catch (error) {
      setError('Invalid email or password');
      setLoginRole('');
    } finally {
      setLoading(false);
    }
  };

  const getLoadingMessage = () => {
    if (loginRole === 'admin') {
      return 'Setting up admin dashboard...';
    } else if (loginRole === 'supervisor') {
      return 'Loading supervisor interface...';
    }
    return 'Signing in...';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md"
      >
        <div className="text-center mb-8">
          <div className="mx-auto w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center mb-4">
            <User className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Site Manager</h1>
          <p className="text-gray-600 mt-2">Sign in to access your dashboard</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm"
            >
              {error}
            </motion.div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Email Address
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Enter your email"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Password
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400 z-10" />
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-10 pr-12 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                placeholder="Enter your password"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 focus:outline-none transition-colors duration-200"
                tabIndex="-1"
              >
                {showPassword ? (
                  <EyeOff className="w-5 h-5" />
                ) : (
                  <Eye className="w-5 h-5" />
                )}
              </button>
            </div>
          </div>

          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <div className="flex items-center justify-center gap-2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                {getLoadingMessage()}
              </div>
            ) : (
              'Sign In'
            )}
          </motion.button>
        </form>

        <div className="mt-6 text-center">
          <p className="text-sm text-gray-600">
            Only authorized personnel can access this system
          </p>
        </div>
      </motion.div>
    </div>
  );
};

export const UserMenu = ({ user, onLogout }) => {
  return (
    <div className="relative group">
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        className="flex items-center gap-2 px-4 py-2 bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow"
      >
        <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
          <User className="w-4 h-4 text-white" />
        </div>
        <span className="text-sm font-medium text-gray-700">{user.email}</span>
      </motion.button>

      <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
        <div className="p-2">
          <button
            onClick={onLogout}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </button>
        </div>
      </div>
    </div>
  );
};
