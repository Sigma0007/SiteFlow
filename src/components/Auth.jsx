import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { signInWithEmailAndPassword, signOut, onAuthStateChanged } from 'firebase/auth';
import { auth } from '../firebase';
import { Lock, Mail, LogOut, User, Eye, EyeOff } from 'lucide-react';
import { supervisorServices } from '../services/firebaseServices';

// Immediate role determination function
const determineRoleByEmail = (email) => {
  if (email === 'odedraarjun928@gmail.com') return 'admin';
  if (email === 'aodedra259@rku.ac.in') return 'supervisor';
  
  // 👇 ADD YOUR 3 SUPERVISOR EMAILS HERE 👇
  // Replace the placeholder emails with your actual supervisor emails from Firestore
  if (email === 'odedraarjun0007@gmail.com') return 'supervisor'; // Replace with actual email
  if (email === 'supervisor2@company.com') return 'supervisor'; // Replace with actual email
  if (email === 'supervisor3@company.com') return 'supervisor'; // Replace with actual email
  
  return null; // No access for other users
};

// Background role validation function
const validateRoleAsync = async (email, assumedRole, setUserRole) => {
  try {
    const supervisorSnapshot = await supervisorServices.getSupervisorByEmail(email);
    const supervisors = supervisorSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    
    console.log('Background validation for:', email);
    console.log('Found supervisors:', supervisors.length);
    
    let actualRole = assumedRole;
    
    if (supervisors.length > 0) {
      const supervisor = supervisors[0];
      console.log('Confirmed supervisor:', supervisor.name);
      actualRole = 'supervisor';
      
      // Update supervisor status if pending
      if (supervisor.status === 'pending') {
        await supervisorServices.updateSupervisor(supervisor.id, {
          status: 'active',
          lastLogin: new Date().toISOString()
        });
      }
    } else if (email === 'odedraarjun928@gmail.com') {
      console.log('Confirmed admin role');
      actualRole = 'admin';
    } else {
      console.log('No access - user not authorized');
      actualRole = null;
    }
    
    // Silent role correction if needed
    if (actualRole !== assumedRole) {
      console.log('Correcting role from', assumedRole, 'to', actualRole);
      setUserRole(actualRole);
    }
  } catch (error) {
    console.error('Background role validation failed:', error);
  }
};

const AuthContext = React.createContext();

export const useAuth = () => {
  const context = React.useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
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
        
        // Immediate role determination for existing sessions
        const immediateRole = determineRoleByEmail(firebaseUser.email);
        setUserRole(immediateRole);
        setLoading(false); // Stop loading immediately
        
        console.log('Session restored for:', firebaseUser.email);
        console.log('Immediate role:', immediateRole);
        
        // Only allow access if role is determined
        if (immediateRole) {
          // Background validation (non-blocking)
          validateRoleAsync(firebaseUser.email, immediateRole, setUserRole);
        } else {
          console.log('Access denied - user not authorized');
        }
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
      // Immediate role determination before Firebase auth
      const immediateRole = determineRoleByEmail(email);
      
      if (!immediateRole) {
        throw new Error('Access denied - user not authorized');
      }
      
      setUserRole(immediateRole);
      setLoading(false); // Stop loading immediately
      
      console.log('Login attempt for:', email);
      console.log('Immediate role assignment:', immediateRole);
      
      // Firebase Authentication
      const result = await signInWithEmailAndPassword(auth, email, password);
      setUser(result.user);
      
      // Background validation (non-blocking)
      validateRoleAsync(email, immediateRole, setUserRole);
      
      return result;
    } catch (error) {
      // Reset role on login failure
      setUserRole(null);
      if (error.message.includes('Access denied')) {
        throw error;
      }
      throw new Error('Invalid email or password');
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
    
    // Determine role for loading message
    const role = determineRoleByEmail(email);
    setLoginRole(role);

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
