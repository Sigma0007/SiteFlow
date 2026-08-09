import React, { useState, useEffect } from 'react';
import { organizationServices } from '../services/firebaseServices';
import { useIsSuperAdmin } from '../components/Auth';
import { motion } from 'framer-motion';
import { Building2, Plus, Edit2, Trash2, Users, Settings } from 'lucide-react';

const CompanyManagement = () => {
  const isSuperAdmin = useIsSuperAdmin();
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingCompany, setEditingCompany] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    logo: '',
    primaryColor: '#3b82f6',
    secondaryColor: '#1e40af'
  });

  useEffect(() => {
    if (!isSuperAdmin) return;
    
    loadCompanies();
  }, [isSuperAdmin]);

  const loadCompanies = async () => {
    try {
      const snapshot = await organizationServices.getAllOrganizations();
      const companiesData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setCompanies(companiesData);
    } catch (error) {
      console.error('Error loading companies:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      if (editingCompany) {
        await organizationServices.updateOrganization(editingCompany.id, {
          name: formData.name,
          logo: formData.logo,
          theme: {
            primaryColor: formData.primaryColor,
            secondaryColor: formData.secondaryColor
          }
        });
      } else {
        await organizationServices.createOrganization({
          name: formData.name,
          logo: formData.logo,
          theme: {
            primaryColor: formData.primaryColor,
            secondaryColor: formData.secondaryColor
          }
        });
      }
      
      setShowModal(false);
      setEditingCompany(null);
      setFormData({ name: '', logo: '', primaryColor: '#3b82f6', secondaryColor: '#1e40af' });
      loadCompanies();
    } catch (error) {
      console.error('Error saving company:', error);
      alert('Error saving company: ' + error.message);
    }
  };

  const handleEdit = (company) => {
    setEditingCompany(company);
    setFormData({
      name: company.name,
      logo: company.logo || '',
      primaryColor: company.theme?.primaryColor || '#3b82f6',
      secondaryColor: company.theme?.secondaryColor || '#1e40af'
    });
    setShowModal(true);
  };

  const handleDelete = async (companyId) => {
    if (!confirm('Are you sure you want to delete this company? This will affect all associated data.')) return;
    
    try {
      await organizationServices.deleteOrganization(companyId);
      loadCompanies();
    } catch (error) {
      console.error('Error deleting company:', error);
      alert('Error deleting company: ' + error.message);
    }
  };

  if (!isSuperAdmin) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-red-600 mb-4">Access Denied</h2>
          <p className="text-gray-600">Only Super Admin can access company management.</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Company Management</h1>
            <p className="text-gray-600 mt-1">Create and manage companies for your platform</p>
          </div>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => {
              setEditingCompany(null);
              setFormData({ name: '', logo: '', primaryColor: '#3b82f6', secondaryColor: '#1e40af' });
              setShowModal(true);
            }}
            className="flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700"
          >
            <Plus className="w-5 h-5" />
            Add Company
          </motion.button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {companies.map((company) => (
            <motion.div
              key={company.id}
              whileHover={{ scale: 1.02 }}
              className="bg-white rounded-xl shadow-lg p-6 border border-gray-200"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="w-16 h-16 rounded-lg flex items-center justify-center" style={{ backgroundColor: company.theme?.primaryColor || '#3b82f6' }}>
                  {company.logo ? (
                    <img src={company.logo} alt={company.name} className="w-12 h-12 rounded" />
                  ) : (
                    <Building2 className="w-8 h-8 text-white" />
                  )}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleEdit(company)}
                    className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(company.id)}
                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
              
              <h3 className="text-lg font-semibold text-gray-900 mb-2">{company.name}</h3>
              
              <div className="space-y-2 text-sm text-gray-600">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4" />
                  <span>Status: {company.status}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Settings className="w-4 h-4" />
                  <span>Created: {new Date(company.createdAt).toLocaleDateString()}</span>
                </div>
              </div>
              
              <div className="mt-4 pt-4 border-t border-gray-200">
                <div className="flex gap-2">
                  <div 
                    className="w-6 h-6 rounded-full border-2 border-gray-300"
                    style={{ backgroundColor: company.theme?.primaryColor }}
                  />
                  <div 
                    className="w-6 h-6 rounded-full border-2 border-gray-300"
                    style={{ backgroundColor: company.theme?.secondaryColor }}
                  />
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {companies.length === 0 && (
          <div className="text-center py-12">
            <Building2 className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No companies yet</h3>
            <p className="text-gray-600 mb-4">Create your first company to get started</p>
            <button
              onClick={() => {
                setEditingCompany(null);
                setFormData({ name: '', logo: '', primaryColor: '#3b82f6', secondaryColor: '#1e40af' });
                setShowModal(true);
              }}
              className="bg-blue-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-blue-700"
            >
              Create Company
            </button>
          </div>
        )}

        {/* Modal */}
        {showModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-white rounded-xl p-6 w-full max-w-md mx-4"
            >
              <h2 className="text-xl font-bold text-gray-900 mb-4">
                {editingCompany ? 'Edit Company' : 'Create Company'}
              </h2>
              
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Company Name
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Logo URL
                  </label>
                  <input
                    type="url"
                    value={formData.logo}
                    onChange={(e) => setFormData({ ...formData, logo: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="https://example.com/logo.png"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Primary Color
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="color"
                      value={formData.primaryColor}
                      onChange={(e) => setFormData({ ...formData, primaryColor: e.target.value })}
                      className="w-12 h-10 rounded cursor-pointer"
                    />
                    <input
                      type="text"
                      value={formData.primaryColor}
                      onChange={(e) => setFormData({ ...formData, primaryColor: e.target.value })}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg"
                    />
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Secondary Color
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="color"
                      value={formData.secondaryColor}
                      onChange={(e) => setFormData({ ...formData, secondaryColor: e.target.value })}
                      className="w-12 h-10 rounded cursor-pointer"
                    />
                    <input
                      type="text"
                      value={formData.secondaryColor}
                      onChange={(e) => setFormData({ ...formData, secondaryColor: e.target.value })}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg"
                    />
                  </div>
                </div>
                
                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setShowModal(false);
                      setEditingCompany(null);
                      setFormData({ name: '', logo: '', primaryColor: '#3b82f6', secondaryColor: '#1e40af' });
                    }}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg font-medium hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700"
                  >
                    {editingCompany ? 'Update' : 'Create'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CompanyManagement;
