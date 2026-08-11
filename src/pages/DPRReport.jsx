import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Calendar, Search, FileText, Download, Printer } from 'lucide-react';
import { siteServices, dprServices, convertDocsToArray } from '../services/firebaseServices';

const DPRReport = () => {
  const navigate = useNavigate();
  const [selectedSite, setSelectedSite] = useState(null);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [sites, setSites] = useState([]);
  const [dprRecords, setDprRecords] = useState([]);

  useEffect(() => {
    const loadSites = async () => {
      try {
        const sitesSnapshot = await siteServices.getAllSites();
        setSites(convertDocsToArray(sitesSnapshot));
      } catch (err) {
        console.error("Error loading sites:", err);
      }
    };
    loadSites();
  }, []);

  useEffect(() => {
    if (selectedSite) {
      const loadDPRs = async () => {
        try {
          const dprSnapshot = await dprServices.getDPRBySiteId(selectedSite.id);
          setDprRecords(convertDocsToArray(dprSnapshot).filter(d => !d.is_deleted));
        } catch (err) {
          console.error("Error loading DPRs:", err);
        }
      };
      loadDPRs();
    }
  }, [selectedSite]);

  const handleViewReport = () => {
    if (selectedSite && selectedDate) {
      navigate(`/dpr/${selectedSite.id}/report/${selectedDate}`);
    }
  };

  const availableDates = [...new Set(dprRecords.map(d => d.date))].sort().reverse();

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
                <FileText className="w-6 h-6 text-blue-600" />
                DPR Report
              </h1>
              <p className="text-gray-500 text-sm mt-1">Select site and date to view Daily Progress Report</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="space-y-6">
            {/* Site Selection */}
            <div>
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
            </div>

            {/* Date Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Select Date</label>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {/* Available DPRs */}
            {selectedSite && availableDates.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Available DPR Reports</label>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {availableDates.map(date => (
                    <button
                      key={date}
                      onClick={() => setSelectedDate(date)}
                      className={`w-full flex items-center justify-between p-3 rounded-lg border transition-colors ${
                        selectedDate === date
                          ? 'bg-blue-50 border-blue-300 text-blue-700'
                          : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
                      }`}
                    >
                      <span className="font-medium">{date}</span>
                      <Calendar className="w-4 h-4" />
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* View Report Button */}
            <button
              onClick={handleViewReport}
              disabled={!selectedSite || !selectedDate}
              className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <FileText className="w-5 h-5" />
              View DPR Report
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DPRReport;
