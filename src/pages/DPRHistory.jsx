import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Building2, Calendar, FileText, Search, ChevronRight, Clock, MapPin, Trash2 } from 'lucide-react';
import { collection, query, where, getDocs, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../firebase';
import { siteServices, dprServices, convertDocsToArray } from '../services/firebaseServices';
import Footer from '../components/Footer';
import StatusModal from '../components/StatusModal';

const DPRHistory = () => {
  const { siteId } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [site, setSite] = useState(null);
  const [reports, setReports] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');

  const [statusModal, setStatusModal] = useState({
    visible: false,
    type: 'success',
    title: '',
    message: '',
    onConfirm: null,
    onCancel: null
  });

  const showAlert = (title, message, type = 'success', onConfirm = null, onCancel = null) => {
    setStatusModal({ 
      visible: true, 
      type, 
      title, 
      message, 
      onConfirm: onConfirm || (() => setStatusModal(prev => ({ ...prev, visible: false }))),
      onCancel: onCancel || (() => setStatusModal(prev => ({ ...prev, visible: false })))
    });
  };

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        // Fetch Site Details
        const siteDoc = await siteServices.getSiteById(siteId);
        if (siteDoc.exists()) {
          setSite({ id: siteDoc.id, ...siteDoc.data() });
        }

        // Fetch all DPRs for this site
        const snapshot = await dprServices.getDPRBySiteId(siteId);
        const allReports = convertDocsToArray(snapshot);
        
        // Sort by date descending
        const sortedReports = allReports
          .filter(r => !r.is_deleted)
          .sort((a, b) => b.date.localeCompare(a.date));
          
        setReports(sortedReports);
      } catch (error) {
        console.error('Error loading report history:', error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [siteId]);

  const filteredReports = reports.filter(report => 
    report.date.includes(searchTerm)
  );

  const handleDeleteReport = (e, reportId) => {
    e.stopPropagation();
    showAlert(
      'Confirm Deletion',
      'Are you sure you want to delete this report? This action cannot be undone.',
      'confirm',
      async () => {
        try {
          const reportToDelete = reports.find(r => r.id === reportId);
          let updatedSiteFields = {};
          let newSiteMaterials = [...(site.assignedMaterials || [])];

          if (reportToDelete && reportToDelete.processProgress) {
            const siteProgress = { ...(site.processProgress || {}) };
            let newSiteDoneSq = site.doneSq || 0;

            Object.entries(reportToDelete.processProgress).forEach(([processKey, processData]) => {
              if (siteProgress[processKey]) {
                const sqToSubtract = processData.doneSq || 0;
                siteProgress[processKey].doneSq = Math.max(0, (siteProgress[processKey].doneSq || 0) - sqToSubtract);
                newSiteDoneSq = Math.max(0, newSiteDoneSq - sqToSubtract);

                if (processData.subProcesses && siteProgress[processKey].subProcesses) {
                  Object.entries(processData.subProcesses).forEach(([subKey, subSq]) => {
                    if (siteProgress[processKey].subProcesses[subKey]) {
                      siteProgress[processKey].subProcesses[subKey] = Math.max(0, siteProgress[processKey].subProcesses[subKey] - subSq);
                    }
                  });
                }
              }
            });

            updatedSiteFields = { processProgress: siteProgress, doneSq: newSiteDoneSq };
          }

          if (reportToDelete && reportToDelete.materialUsage) {
            reportToDelete.materialUsage.forEach(usage => {
              const matIndex = newSiteMaterials.findIndex(m => m.materialId === usage.materialId);
              if (matIndex >= 0) {
                newSiteMaterials[matIndex].quantity = Number(newSiteMaterials[matIndex].quantity || 0) + Number(usage.quantity || 0);
              } else {
                newSiteMaterials.push({
                  materialId: usage.materialId,
                  name: usage.name,
                  category: usage.category || 'material',
                  quantity: usage.quantity,
                  unit: usage.unit || ''
                });
              }
            });
            updatedSiteFields.assignedMaterials = newSiteMaterials;
          }

          if (Object.keys(updatedSiteFields).length > 0) {
            await siteServices.updateSite(siteId, updatedSiteFields);
            setSite(prev => ({ ...prev, ...updatedSiteFields }));
          }

          if (reportToDelete && reportToDelete.date) {
            const attQuery = query(
              collection(db, 'attendance'),
              where('siteId', '==', siteId),
              where('date', '==', reportToDelete.date)
            );
            const attSnapshot = await getDocs(attQuery);
            const deletePromises = attSnapshot.docs.map(attDoc => deleteDoc(doc(db, 'attendance', attDoc.id)));
            await Promise.all(deletePromises);
          }

          await dprServices.updateDPR(reportId, { is_deleted: true });
          setReports(prev => prev.filter(r => r.id !== reportId));
          setStatusModal(prev => ({ ...prev, visible: false }));
        } catch (err) {
          console.error("Error deleting report:", err);
          showAlert('Error', 'Failed to delete report.', 'error');
        }
      }
    );
  };

  if (loading && !site) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!site) {
    return (
      <div className="p-8 text-center text-red-600 bg-gray-50 min-h-screen">
        <h2 className="text-2xl font-bold mb-4">Site Not Found</h2>
        <button 
          onClick={() => navigate('/dpr')}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
        >
          Back to Sites
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <div className="flex-1">
        {/* Header */}
        <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={() => navigate('/dpr')}
                  className="p-2 bg-gray-50 rounded-lg shadow-sm border border-gray-200 text-gray-600 hover:text-blue-600 transition-colors"
                >
                  <ArrowLeft className="w-6 h-6" />
                </motion.button>
                <div>
                  <h1 className="text-2xl font-black text-gray-900 flex items-center gap-2">
                    <FileText className="w-7 h-7 text-blue-600" />
                    Report History
                  </h1>
                  <p className="text-gray-500 text-sm font-medium flex items-center gap-1.5 mt-0.5">
                    <Building2 className="w-4 h-4" /> {site.name} • <MapPin className="w-4 h-4" /> {site.location}
                  </p>
                </div>
              </div>

              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search by date (YYYY-MM-DD)..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white text-sm w-full md:w-64"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {loading ? (
             <div className="flex items-center justify-center py-12">
               <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
             </div>
          ) : filteredReports.length === 0 ? (
            <div className="text-center py-20 bg-white rounded-2xl shadow-sm border border-gray-200 px-4">
              <div className="bg-blue-50 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
                <Calendar className="w-10 h-10 text-blue-300" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">No Reports Found</h3>
              <p className="text-gray-500 max-w-sm mx-auto">
                {searchTerm
                  ? "We couldn't find any reports matching that date."
                  : "No daily progress reports have been submitted for this site yet."}
              </p>
              {!searchTerm && (
                <button
                  onClick={() => navigate(`/dpr/${siteId}`)}
                  className="mt-6 px-8 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition shadow-lg shadow-blue-200"
                >
                  Create First Report
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-8">
              {/* Last 5 Days Quick Access */}
              {!searchTerm && (
                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-2xl p-6 border border-blue-100">
                  <div className="flex items-center gap-2 mb-4">
                    <Clock className="w-5 h-5 text-blue-600" />
                    <h2 className="text-lg font-bold text-gray-900">Basic DPR History (Last 5 Days)</h2>
                  </div>
                  <p className="text-sm text-gray-600 mb-4">Quick access to recently submitted DPR records</p>
                  
                  {filteredReports.slice(0, 5).length > 0 ? (
                    <div className="space-y-2">
                      {filteredReports.slice(0, 5).map((report) => (
                        <button
                          key={report.id}
                          onClick={() => {
                            if (report.status === 'draft' || !report.status) {
                              const url = report.buildingId
                                ? `/dpr/${siteId}/${report.buildingId}`
                                : `/dpr/${siteId}`;
                              navigate(url);
                            } else {
                              const url = report.buildingId
                                ? `/dpr/${siteId}/${report.buildingId}/report/${report.date}`
                                : `/dpr/${siteId}/report/${report.date}`;
                              navigate(url);
                            }
                          }}
                          className="w-full flex items-center justify-between bg-white p-4 rounded-lg border border-gray-200 hover:border-blue-300 hover:shadow-md transition-all"
                        >
                          <div className="flex items-center gap-3">
                            <Calendar className="w-4 h-4 text-gray-500" />
                            <span className="font-medium text-gray-900">{report.date}</span>
                            {report.buildingName && (
                              <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                                {report.buildingName}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={`text-xs font-semibold px-2 py-1 rounded ${
                              report.status === 'submitted' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                            }`}>
                              {report.status || 'draft'}
                            </span>
                            <ChevronRight className="w-4 h-4 text-gray-400" />
                          </div>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500 italic">No recent DPR records found</p>
                  )}
                </div>
              )}

              {/* All Reports */}
              <div className="space-y-4">
                <h2 className="text-sm font-black text-gray-400 uppercase tracking-widest pl-1 mb-4">
                  All Reports: {filteredReports.length}
                </h2>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <AnimatePresence>
                    {filteredReports.map((report, index) => (
                      <motion.div
                        key={report.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.05 }}
                        whileHover={{ y: -4, scale: 1.01 }}
                        onClick={() => {
                          if (report.status === 'draft' || !report.status) {
                            const url = report.buildingId
                              ? `/dpr/${siteId}/${report.buildingId}`
                              : `/dpr/${siteId}`;
                            navigate(url);
                          } else {
                            const url = report.buildingId
                              ? `/dpr/${siteId}/${report.buildingId}/report/${report.date}`
                              : `/dpr/${siteId}/report/${report.date}`;
                            navigate(url);
                          }
                        }}
                        className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 cursor-pointer hover:shadow-md hover:border-blue-100 transition-all flex items-center justify-between group"
                      >
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center group-hover:bg-blue-600 group-hover:text-white transition-colors">
                            <Calendar className="w-6 h-6" />
                          </div>
                          <div>
                            <p className="text-lg font-bold text-gray-900 group-hover:text-blue-600 transition-colors">
                              {new Date(report.date).toLocaleDateString('en-GB', {
                                day: '2-digit',
                                month: 'long',
                                year: 'numeric'
                              })}
                            </p>
                            <div className="flex items-center gap-3 mt-1">
                              <span className="text-xs font-bold text-gray-400 flex items-center gap-1">
                                <Clock className="w-3 h-3" /> {report.date}
                              </span>
                              <span className="text-[10px] font-black uppercase tracking-wider bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
                                Completed
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={(e) => handleDeleteReport(e, report.id)}
                            className="w-10 h-10 rounded-full border border-gray-100 flex items-center justify-center text-gray-400 hover:bg-red-50 hover:text-red-600 hover:border-red-100 transition-all z-10"
                            title="Delete Report"
                          >
                            <Trash2 className="w-5 h-5" />
                          </button>
                          <div className="w-10 h-10 rounded-full border border-gray-100 flex items-center justify-center text-gray-400 group-hover:bg-blue-50 group-hover:text-blue-600 group-hover:border-blue-100 transition-all">
                            <ChevronRight className="w-5 h-5" />
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
      <Footer />
      <StatusModal {...statusModal} />
    </div>
  );
};

export default DPRHistory;
