import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, TrendingUp, FileText, Building2, Users, Package } from 'lucide-react';
import { siteServices, labourServices, convertDocsToArray } from '../services/firebaseServices';
import MonthlySiteAnalysisModal from '../components/MonthlySiteAnalysisModal';
import ProcessMonthlyAnalysisModal from '../components/ProcessMonthlyAnalysisModal';

const MonthlyReportsSelector = () => {
  const navigate = useNavigate();
  const [sites, setSites] = useState([]);
  const [labour, setLabour] = useState([]);
  const [selectedSite, setSelectedSite] = useState(null);
  const [selectedReportType, setSelectedReportType] = useState(null); // 'attendance' or 'process'

  useEffect(() => {
    const loadData = async () => {
      try {
        const sitesSnapshot = await siteServices.getAllSites();
        setSites(convertDocsToArray(sitesSnapshot));
        
        const labourSnapshot = await labourServices.getAllLabour();
        setLabour(convertDocsToArray(labourSnapshot));
      } catch (err) {
        console.error("Error loading data:", err);
      }
    };
    loadData();
  }, []);

  const handleOpenReport = (reportType, siteOverride = null) => {
    const site = siteOverride || selectedSite;
    if (!site) return;
    
    setSelectedReportType(reportType);
    setSelectedSite(site);
  };

  const handleCloseModal = () => {
    setSelectedReportType(null);
  };

  // Auto-open report when site is selected
  useEffect(() => {
    if (selectedSite) {
      handleOpenReport('attendance');
    }
  }, [selectedSite]);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/dashboard')}
              className="p-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors text-gray-600"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                <TrendingUp className="w-6 h-6 text-blue-600" />
                Monthly Reports
              </h1>
              <p className="text-gray-500 text-sm mt-1">Select a site to view monthly analysis reports</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="space-y-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">Select Site</label>
            <select
              value={selectedSite?.id || ''}
              onChange={(e) => setSelectedSite(sites.find(s => s.id === e.target.value) || null)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">Select a site</option>
              {sites.sort((a, b) => (a.name || '').localeCompare(b.name || '')).map(site => (
                <option key={site.id} value={site.id}>{site.name}</option>
              ))}
            </select>

            {selectedSite && (
              <div className="mt-6 text-center py-4 bg-green-50 border border-green-200 rounded-lg">
                <p className="text-green-700 font-medium">Loading report for {selectedSite.name}...</p>
              </div>
            )}

            {!selectedSite && (
              <div className="mt-6 text-center py-8 bg-gray-50 rounded-lg">
                <Building2 className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                <p className="text-gray-500">Please select a site to view reports</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modals */}
      {selectedReportType === 'attendance' && selectedSite && (
        <MonthlySiteAnalysisModal
          site={selectedSite}
          labour={labour}
          onClose={handleCloseModal}
        />
      )}
    </div>
  );
};

export default MonthlyReportsSelector;
