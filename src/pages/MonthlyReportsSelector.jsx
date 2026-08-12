import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, TrendingUp, Building2, ChevronRight, Loader2 } from 'lucide-react';
import { siteServices, labourServices, buildingServices, convertDocsToArray } from '../services/firebaseServices';
import MonthlySiteAnalysisModal from '../components/MonthlySiteAnalysisModal';

const MonthlyReportsSelector = () => {
  const navigate = useNavigate();
  const [sites, setSites] = useState([]);
  const [labour, setLabour] = useState([]);
  const [selectedSite, setSelectedSite] = useState(null);
  const [buildings, setBuildings] = useState([]);
  const [buildingsLoading, setBuildingsLoading] = useState(false);
  const [selectedBuilding, setSelectedBuilding] = useState(null);
  const [showModal, setShowModal] = useState(false);

  // Load sites and labour on mount
  useEffect(() => {
    const loadData = async () => {
      try {
        const sitesSnapshot = await siteServices.getAllSites();
        setSites(convertDocsToArray(sitesSnapshot));

        const labourSnapshot = await labourServices.getAllLabour();
        setLabour(convertDocsToArray(labourSnapshot));
      } catch (err) {
        console.error('Error loading data:', err);
      }
    };
    loadData();
  }, []);

  // Fetch buildings whenever site changes
  useEffect(() => {
    if (!selectedSite) {
      setBuildings([]);
      setSelectedBuilding(null);
      setShowModal(false);
      return;
    }

    const fetchBuildings = async () => {
      setBuildingsLoading(true);
      setSelectedBuilding(null);
      setShowModal(false);
      try {
        const snapshot = await buildingServices.getBuildingsBySite(selectedSite.id);
        setBuildings(convertDocsToArray(snapshot));
      } catch (err) {
        console.error('Error fetching buildings:', err);
        setBuildings([]);
      }
      setBuildingsLoading(false);
    };

    fetchBuildings();
  }, [selectedSite]);

  // Open modal when a building is selected
  useEffect(() => {
    if (selectedBuilding) {
      setShowModal(true);
    }
  }, [selectedBuilding]);

  const handleCloseModal = () => {
    setShowModal(false);
    setSelectedBuilding(null);
  };

  const handleSiteChange = (e) => {
    const site = sites.find((s) => s.id === e.target.value) || null;
    setSelectedSite(site);
  };

  const handleBuildingSelect = (building) => {
    setSelectedBuilding(building);
  };

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
              <p className="text-gray-500 text-sm mt-1">
                Select a site, then a building to view the monthly analysis report
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">

        {/* Step 1 — Select Site */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center gap-2 mb-4">
            <span className="w-7 h-7 flex items-center justify-center rounded-full bg-blue-600 text-white text-sm font-bold shrink-0">1</span>
            <h2 className="text-base font-semibold text-gray-800">Select Site</h2>
          </div>
          <select
            value={selectedSite?.id || ''}
            onChange={handleSiteChange}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white text-gray-800"
          >
            <option value="">-- Select a site --</option>
            {sites
              .sort((a, b) => (a.name || '').localeCompare(b.name || ''))
              .map((site) => (
                <option key={site.id} value={site.id}>
                  {site.name}
                </option>
              ))}
          </select>
        </div>

        {/* Step 2 — Select Building (shown only when site is selected) */}
        {selectedSite && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center gap-2 mb-4">
              <span className="w-7 h-7 flex items-center justify-center rounded-full bg-blue-600 text-white text-sm font-bold shrink-0">2</span>
              <h2 className="text-base font-semibold text-gray-800">
                Select Building — <span className="text-blue-600 font-normal">{selectedSite.name}</span>
              </h2>
            </div>

            {buildingsLoading ? (
              <div className="flex items-center gap-3 py-6 justify-center text-gray-500">
                <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
                <span className="text-sm">Loading buildings…</span>
              </div>
            ) : buildings.length === 0 ? (
              <div className="text-center py-8 bg-gray-50 rounded-lg">
                <Building2 className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                <p className="text-gray-500 text-sm">No buildings found for <strong>{selectedSite.name}</strong></p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {buildings
                  .sort((a, b) => (a.name || '').localeCompare(b.name || ''))
                  .map((building) => (
                    <button
                      key={building.id}
                      onClick={() => handleBuildingSelect(building)}
                      className={`flex items-center justify-between gap-3 px-4 py-4 rounded-lg border-2 transition-all text-left group
                        ${selectedBuilding?.id === building.id
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 bg-white hover:border-blue-300 hover:bg-blue-50/40'}`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`p-2 rounded-lg shrink-0 ${selectedBuilding?.id === building.id ? 'bg-blue-600' : 'bg-gray-100 group-hover:bg-blue-100'}`}>
                          <Building2 className={`w-4 h-4 ${selectedBuilding?.id === building.id ? 'text-white' : 'text-gray-600 group-hover:text-blue-600'}`} />
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-gray-900 text-sm truncate">{building.name}</p>
                          {building.type && (
                            <p className="text-xs text-gray-400 truncate">{building.type}</p>
                          )}
                        </div>
                      </div>
                      <ChevronRight className={`w-4 h-4 shrink-0 transition-transform ${selectedBuilding?.id === building.id ? 'text-blue-600 translate-x-0.5' : 'text-gray-400 group-hover:text-blue-500'}`} />
                    </button>
                  ))}
              </div>
            )}
          </div>
        )}

        {/* Idle state — nothing selected yet */}
        {!selectedSite && (
          <div className="text-center py-12 bg-white rounded-xl border border-gray-200 shadow-sm">
            <Building2 className="w-14 h-14 text-gray-200 mx-auto mb-3" />
            <p className="text-gray-400 text-sm">Select a site above to get started</p>
          </div>
        )}
      </div>

      {/* Modal — shown when both site and building are selected */}
      {showModal && selectedSite && selectedBuilding && (
        <MonthlySiteAnalysisModal
          site={selectedSite}
          building={selectedBuilding}
          labour={labour}
          onClose={handleCloseModal}
        />
      )}
    </div>
  );
};

export default MonthlyReportsSelector;
