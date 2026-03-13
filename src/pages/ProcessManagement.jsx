import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus,
  Edit2,
  Trash2,
  CheckSquare,
  Square,
  ChevronDown,
  ChevronRight,
  MapPin,
  Building,
  X,
} from "lucide-react";
import {
  siteServices,
  buildingServices,
  processServices,
  supervisorServices,
  siteAssignmentServices,
  convertDocsToArray,
  query,
  where,
} from "../services/firebaseServices";
import { useSupervisor } from "../contexts/SupervisorContext.jsx";

const ProcessManagement = ({ userRole }) => {
  const { assignedSites } = useSupervisor();
  const [sites, setSites] = useState([]);
  const [buildings, setBuildings] = useState([]);
  const [processes, setProcesses] = useState([]);
  const [selectedSite, setSelectedSite] = useState("");
  const [selectedBuilding, setSelectedBuilding] = useState("");
  const [expandedProcesses, setExpandedProcesses] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState("process");
  const [editingItem, setEditingItem] = useState(null);
  const [selectedProcessId, setSelectedProcessId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [siteCompletion, setSiteCompletion] = useState(0);
  const [showCompletionModal, setShowCompletionModal] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    status: "active",
    image: "",
  });
  const [showImagePreview, setShowImagePreview] = useState(false);
  const [previewImage, setPreviewImage] = useState("");

  // Default processes for new buildings
  const defaultProcesses = [
    {
      name: "Foundation Work",
      description: "Building foundation and base structure preparation",
      status: "active",
      image: "",
      subProcesses: [],
    },
    {
      name: "Structural Framework",
      description:
        "Main structural elements including columns, beams, and slabs",
      status: "active",
      image: "",
      subProcesses: [],
    },
    {
      name: "Masonry Work",
      description: "Wall construction and brick/block laying",
      status: "active",
      image: "",
      subProcesses: [],
    },
    {
      name: "Electrical Installation",
      description: "Electrical wiring, fixtures, and power systems",
      status: "active",
      image: "",
      subProcesses: [],
    },
    {
      name: "Plumbing Works",
      description: "Water supply, drainage, and sanitary installations",
      status: "active",
      image: "",
      subProcesses: [],
    },
    {
      name: "Interior Finishing",
      description: "Flooring, painting, and interior fixtures",
      status: "active",
      image: "",
      subProcesses: [],
    },
    {
      name: "External Works",
      description: "Landscaping, external walls, and site development",
      status: "active",
      image: "",
      subProcesses: [],
    },
  ];

  // Load data from Firebase on component mount
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);

        if (userRole === 'supervisor') {
          // Use sites already resolved by SupervisorContext – no extra Firestore query needed
          console.log('👷 ProcessManagement: supervisor assignedSites from context:', assignedSites.length);
          setSites(assignedSites.filter(s => !s.is_deleted));
        } else {
          // Admin sees all sites
          const sitesSnapshot = await siteServices.getAllSites();
          const sitesData = convertDocsToArray(sitesSnapshot);
          setSites(sitesData);
        }

        // Load buildings
        const buildingsSnapshot = await buildingServices.getAllBuildings();
        setBuildings(convertDocsToArray(buildingsSnapshot));
      } catch (error) {
        console.error("Error loading data:", error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [userRole, assignedSites]);

  // Update site completion percentage
  const updateSiteCompletion = async (completionPercentage) => {
    try {
      if (!selectedSite) {
        alert('Please select a site first');
        return;
      }

      if (completionPercentage < 0 || completionPercentage > 100) {
        alert('Completion percentage must be between 0 and 100');
        return;
      }

      // Get supervisor ID (simplified for now)
      const supervisorEmail = 'aodedra259@rku.ac.in';
      const supervisorSnapshot = await supervisorServices.getSupervisorByEmail(supervisorEmail);
      const supervisors = supervisorSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      const supervisorId = supervisors.length > 0 ? supervisors[0].id : 'unknown';

      await siteAssignmentServices.updateSiteCompletion(selectedSite, completionPercentage, supervisorId);

      // Update local state
      setSiteCompletion(completionPercentage);

      // Update sites array
      setSites(prevSites =>
        prevSites.map(site =>
          site.id === selectedSite
            ? { ...site, completionPercentage, lastUpdatedBy: supervisorId, lastUpdatedTimestamp: new Date().toISOString() }
            : site
        )
      );

      alert('Site completion updated successfully!');
    } catch (error) {
      console.error('Error updating site completion:', error);
      alert('Error updating site completion. Please try again.');
    }
  };

  // Load processes when site is selected (with or without building)
  useEffect(() => {
    const loadProcesses = async () => {
      console.log("🔄 Process loading useEffect triggered");
      console.log("📍 selectedSite:", selectedSite);
      console.log("🏢 selectedBuilding:", selectedBuilding);

      if (selectedSite) {
        try {
          console.log(
            "Loading processes for site:",
            selectedSite,
            "building:",
            selectedBuilding || "site-level"
          );
          setLoading(true);

          let processesSnapshot;
          if (selectedBuilding && selectedBuilding !== 'virtual-building') {
            // Load processes for specific building
            console.log("🏢 Loading building-level processes");
            processesSnapshot = await processServices.getProcessesByBuilding(selectedSite, selectedBuilding);
          } else if (selectedBuilding === 'virtual-building') {
            // For virtual buildings, load site-level processes
            console.log("🏗️ Loading processes for virtual building");
            processesSnapshot = await processServices.getProcessesBySite(selectedSite);
          } else {
            // No building selected - load site-level processes
            console.log("🏗️ No building selected, loading site-level processes");
            processesSnapshot = await processServices.getProcessesBySite(selectedSite);
          }

          console.log("Processes snapshot:", processesSnapshot);
          console.log("Type of processesSnapshot:", typeof processesSnapshot);
          console.log("Has docs:", processesSnapshot && processesSnapshot.docs);
          console.log("Has forEach:", processesSnapshot && typeof processesSnapshot.forEach === 'function');

          let processesArray;
          if (processesSnapshot &&
            processesSnapshot.docs !== undefined &&
            typeof processesSnapshot.docs === 'object') {
            // It's a proper Firebase snapshot with docs property
            console.log("Converting Firebase snapshot to array");
            processesArray = convertDocsToArray(processesSnapshot);
          } else {
            // It's already an array or empty, use as-is
            console.log("Using processes as-is (already array or empty)");
            processesArray = Array.isArray(processesSnapshot) ? processesSnapshot : [];
          }

          console.log("Final processes array:", processesArray);
          console.log("About to setProcesses with:", processesArray);
          setProcesses(processesArray);
          console.log("Processes state after setProcesses:", processesArray);
        } catch (error) {
          console.error("Error loading processes:", error);
          console.error("Error details:", error.message, error.code);
          setProcesses([]);
        } finally {
          setLoading(false);
        }
      } else {
        setProcesses([]);
        setLoading(false);
      }
    };

    loadProcesses();
  }, [selectedSite, selectedBuilding]);

  // Set up real-time listeners
  useEffect(() => {
    const unsubscribeSites = siteServices.onSitesChange((snapshot) => {
      setSites(convertDocsToArray(snapshot));
    });

    const unsubscribeBuildings = buildingServices.onBuildingsChange(
      (snapshot) => {
        setBuildings(convertDocsToArray(snapshot));
      },
    );

    const unsubscribeProcesses =
      selectedSite
        ? selectedBuilding && selectedBuilding !== 'virtual-building'
          ? processServices.onProcessesChange(
            selectedSite,
            selectedBuilding,
            (snapshot) => {
              setProcesses(convertDocsToArray(snapshot));
            },
          )
          : processServices.onSiteProcessesChange(
            selectedSite,
            (snapshot) => {
              setProcesses(convertDocsToArray(snapshot));
            },
          )
        : null;

    return () => {
      unsubscribeSites();
      unsubscribeBuildings();
      if (unsubscribeProcesses) unsubscribeProcesses();
    };
  }, [selectedSite, selectedBuilding]);

  const getBuildingsForSite = (siteId) => {
    const site = sites.find((s) => s.id === siteId);
    if (!site) return [];
    const siteBuildings = buildings.filter((b) => b.siteId === siteId);

    // If site has no buildings, create a virtual building
    if (siteBuildings.length === 0) {
      return [{
        id: 'virtual-building',
        name: site.name,
        type: 'Virtual Building',
        siteId: siteId
      }];
    }

    return siteBuildings;
  };

  const handleSiteChange = (siteId) => {
    console.log(" Site changed to:", siteId);
    setSelectedSite(siteId);
    setSelectedBuilding(""); // Reset building when site changes
    setExpandedProcesses([]); // Reset expanded processes

    // Debug: Show all sites and buildings
    console.log("🔍 All available sites:", sites);
    console.log("🔍 All available buildings:", buildings);

    // Debug: Show which buildings belong to this site
    const siteBuildings = getBuildingsForSite(siteId);
    console.log("🔍 Buildings for this site:", siteBuildings);
    console.log("🔍 Buildings found for site:", siteBuildings.length);

    if (siteId) {
      if (siteBuildings.length === 1) {
        // Only one building, auto-select it
        console.log(" Auto-selecting single building:", siteBuildings[0].name);
        console.log("🏢 Setting building ID to:", siteBuildings[0].id);
        setSelectedBuilding(siteBuildings[0].id);
        setTimeout(() => {
          initializeDefaultProcesses();
        }, 500);
      } else if (siteBuildings.length === 0) {
        console.log(" No buildings found for this site");
        console.log("🏗️ Creating virtual building for site");
        // Auto-select the virtual building
        console.log("🏗️ Setting building ID to: virtual-building");
        setSelectedBuilding('virtual-building');
        setTimeout(() => {
          initializeDefaultProcesses();
        }, 500);
      } else {
        console.log(" Multiple buildings found, user must select");
      }
    }
  };

  const handleBuildingChange = (buildingId) => {
    setSelectedBuilding(buildingId);
    setExpandedProcesses([]); // Reset expanded processes
    // Add a small delay to ensure the building is fully selected before initializing
    setTimeout(() => {
      initializeDefaultProcesses();
    }, 500);
  };

  const initializeDefaultProcesses = async () => {
    if (!selectedSite) {
      console.log("❌ No site selected, cannot initialize processes");
      return;
    }

    try {
      console.log(
        "🔧 Initializing default processes for building:",
        selectedBuilding || "site-level",
      );
      console.log("📍 Selected site ID:", selectedSite);
      console.log("🏢 Selected building ID:", selectedBuilding);

      // Check if processes already exist for this building/site
      let existingProcesses, existingProcessesArray;

      if (selectedBuilding && selectedBuilding !== 'virtual-building') {
        // Building-level processes
        console.log("🏢 Checking building-level processes");
        existingProcesses = await processServices.getProcessesByBuilding(
          selectedSite,
          selectedBuilding,
        );
        existingProcessesArray = convertDocsToArray(existingProcesses);
      } else if (selectedBuilding === 'virtual-building') {
        // Virtual building - use site-level processes
        console.log("�️ Checking virtual building processes");
        existingProcesses = await processServices.getProcessesBySite(selectedSite);
        existingProcessesArray = convertDocsToArray(existingProcesses);
      } else {
        // No building selected
        console.log("❌ No building selected");
        existingProcessesArray = [];
      }

      console.log(
        "📊 Existing processes count:",
        existingProcessesArray.length,
      );
      console.log("📋 Existing processes:", existingProcessesArray);

      // Always add default processes if less than 7 exist (in case some are missing)
      if (existingProcessesArray.length < 7) {
        console.log("➕ Adding missing default processes...");

        // Get existing process names to avoid duplicates
        const existingProcessNames = existingProcessesArray.map((p) =>
          p.name.toLowerCase(),
        );

        // Add default processes that don't already exist
        for (const defaultProcess of defaultProcesses) {
          if (
            !existingProcessNames.includes(defaultProcess.name.toLowerCase())
          ) {
            const processToAdd = {
              ...defaultProcess,
              siteId: selectedSite,
              buildingId: selectedBuilding || "site-level",
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            };
            console.log("➕ Adding process:", processToAdd.name);

            let result;
            if (selectedBuilding && selectedBuilding !== 'virtual-building') {
              // Building-level process
              console.log("🏢 Adding building-level process");
              result = await processServices.addProcess(
                selectedSite,
                selectedBuilding,
                processToAdd,
              );
            } else if (selectedBuilding === 'virtual-building') {
              // Virtual building - use site-level process addition
              console.log("�️ Adding virtual building process");
              result = await processServices.addSiteProcess(
                selectedSite,
                processToAdd,
              );
            } else {
              // No building selected
              console.log("❌ No building selected, cannot add process");
              return;
            }
            console.log("✅ Process added with ID:", result.id);
          } else {
            console.log("⏭️ Skipping existing process:", defaultProcess.name);
          }
        }
        console.log("🎉 Default processes initialization completed!");

        // Reload processes to verify they were added
        setTimeout(async () => {
          const newProcesses = await processServices.getProcessesByBuilding(
            selectedSite,
            selectedBuilding,
          );
          const newProcessesArray = convertDocsToArray(newProcesses);
          console.log(
            "✅ Verification - processes after adding:",
            newProcessesArray,
          );
          console.log("📈 Total processes now:", newProcessesArray.length);
        }, 1000);
      } else {
        console.log(
          "✅ All 7 processes already exist, skipping initialization",
        );
      }
    } catch (error) {
      console.error("❌ Error initializing default processes:", error);
      console.error("🔍 Full error object:", JSON.stringify(error, null, 2));
    }
  };

  const updateSubProcessStatus = async (processId, subProcessId, newStatus) => {
    try {
      const process = processes.find((p) => p.id === processId);
      const subProcess = process.subProcesses.find(
        (sp) => sp.id === subProcessId,
      );

      await processServices.updateSubProcess(
        selectedSite,
        selectedBuilding,
        processId,
        subProcessId,
        {
          ...subProcess,
          status: newStatus,
          updatedAt: new Date().toISOString(),
        },
      );
    } catch (error) {
      console.error("Error updating sub-process status:", error);
    }
  };

  const updateProcessStatus = async (processId, newStatus) => {
    try {
      const process = processes.find((p) => p.id === processId);

      await processServices.updateProcess(
        selectedSite,
        selectedBuilding,
        processId,
        {
          ...process,
          status: newStatus,
          updatedAt: new Date().toISOString(),
        },
      );
    } catch (error) {
      console.error("Error updating process status:", error);
    }
  };

  const getProcessStatusColor = (status) => {
    switch (status) {
      case "completed":
        return "text-green-600 bg-green-100 border-green-200";
      case "hold":
        return "text-yellow-600 bg-yellow-100 border-yellow-200";
      case "active":
      default:
        return "text-blue-600 bg-blue-100 border-blue-200";
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case "completed":
        return "text-green-600 bg-green-100";
      case "hold":
        return "text-yellow-600 bg-yellow-100";
      case "pending":
      default:
        return "text-gray-600 bg-gray-100";
    }
  };

  const getProcessIcon = (processName) => {
    const name = processName.toLowerCase();
    if (name.includes('foundation')) return '🏗️';
    if (name.includes('structural')) return '🏗️';
    if (name.includes('masonry')) return '🧱';
    if (name.includes('electrical')) return '⚡';
    if (name.includes('plumbing')) return '🚰';
    if (name.includes('interior')) return '🏠';
    if (name.includes('external')) return '🌳';
    return '🔧'; // Default icon
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case "completed":
        return <CheckSquare className="w-5 h-5 text-green-600" />;
      case "hold":
        return <Square className="w-5 h-5 text-yellow-600" />;
      case "pending":
      default:
        return <Square className="w-5 h-5 text-gray-400" />;
    }
  };

  // Image upload handler
  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Check file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert("Image size should be less than 5MB");
      return;
    }

    // Check file type
    if (!file.type.startsWith("image/")) {
      alert("Please upload an image file");
      return;
    }

    try {
      // Create a unique filename
      const timestamp = new Date().getTime();
      const filename = `process_${timestamp}_${file.name}`;

      // For now, convert to base64 and store in Firestore
      // In production, you'd want to use Firebase Storage
      const reader = new FileReader();
      reader.onload = async (event) => {
        const base64String = event.target.result;
        setFormData((prev) => ({ ...prev, image: base64String }));
      };
      reader.readAsDataURL(file);
    } catch (error) {
      console.error("Error uploading image:", error);
      alert("Error uploading image");
    }
  };

  const toggleProcess = (processId) => {
    setExpandedProcesses((prev) =>
      prev.includes(processId)
        ? prev.filter((id) => id !== processId)
        : [...prev, processId],
    );
  };

  const handleAddProcess = () => {
    setModalType("process");
    setEditingItem(null);
    setFormData({ name: "", description: "", status: "active", image: "" });
    setShowModal(true);
  };

  const handleAddSubProcess = (processId) => {
    setModalType("subprocess");
    setEditingItem(null);
    setSelectedProcessId(processId);
    setFormData({ name: "", description: "" });
    setShowModal(true);
  };

  const handleEdit = (item, type, processId = null) => {
    setModalType(type);
    setEditingItem(item);
    setSelectedProcessId(processId);
    if (type === "process") {
      setFormData({
        name: item.name,
        description: item.description || "",
        status: item.status || "active",
        image: item.image || "",
      });
    } else {
      setFormData({
        name: item.name,
        description: item.description || "",
      });
    }
    setShowModal(true);
  };

  const handleDelete = async (id, type, processId = null) => {
    if (!window.confirm(`Are you sure you want to delete this ${type}?`))
      return;

    try {
      if (type === "process") {
        await processServices.deleteProcess(selectedSite, selectedBuilding, id);
      } else {
        await processServices.deleteSubProcess(
          selectedSite,
          selectedBuilding,
          processId,
          id,
        );
      }
    } catch (error) {
      console.error("Error deleting:", error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      const processData = {
        ...formData,
        siteId: selectedSite,
        buildingId: selectedBuilding || "site-level", // Use "site-level" for site processes
        updatedAt: new Date().toISOString(),
      };

      if (modalType === "process") {
        if (editingItem) {
          if (selectedBuilding) {
            await processServices.updateProcess(selectedSite, selectedBuilding, editingItem.id, processData);
          } else {
            // For site-level processes, we need a different approach
            console.log("Updating site-level process:", editingItem.id);
            // TODO: Implement site-level process update
          }
        } else {
          if (selectedBuilding) {
            await processServices.addProcess(selectedSite, selectedBuilding, {
              ...processData,
              subProcesses: [],
              createdAt: new Date().toISOString(),
            });
          } else {
            // For site-level processes, we need a different approach
            console.log("Adding site-level process:", processData);
            // TODO: Implement site-level process addition
            console.log("⚠️ Site-level process creation not yet implemented");
          }
        }
      } else {
        const subProcessData = {
          ...formData,
          status: "pending",
          updatedAt: new Date().toISOString(),
        };

        if (editingItem) {
          await processServices.updateSubProcess(
            selectedSite,
            selectedBuilding,
            selectedProcessId,
            editingItem.id,
            subProcessData,
          );
        } else {
          await processServices.addSubProcess(
            selectedSite,
            selectedBuilding,
            selectedProcessId,
            {
              ...subProcessData,
              createdAt: new Date().toISOString(),
            },
          );
        }
      }

      setShowModal(false);
      setFormData({ name: "", description: "", status: "active", image: "" });
      setEditingItem(null);
      setSelectedProcessId(null);
    } catch (error) {
      console.error("Error saving:", error);
    }
  };

  const toggleSubProcessCompletion = async (processId, subProcessId) => {
    try {
      const process = processes.find((p) => p.id === processId);
      const subProcess = process.subProcesses.find(
        (sp) => sp.id === subProcessId,
      );

      // Cycle through three states: not-started -> in-progress -> completed -> not-started
      let newStatus;
      if (subProcess.status === 'completed') {
        newStatus = 'not-started';
      } else if (subProcess.status === 'in-progress') {
        newStatus = 'completed';
      } else {
        newStatus = 'in-progress';
      }

      const updatedSubProcess = {
        ...subProcess,
        status: newStatus,
        updatedAt: new Date().toISOString(),
      };

      if (selectedBuilding && selectedBuilding !== 'virtual-building') {
        await processServices.updateSubProcess(
          selectedSite,
          selectedBuilding,
          processId,
          subProcessId,
          updatedSubProcess,
        );
      } else if (selectedBuilding === 'virtual-building') {
        // Virtual building - update site-level sub-process
        console.log("🏗️ Updating virtual building sub-process");
        // TODO: Implement site-level sub-process update
      }
    } catch (error) {
      console.error("Error toggling completion:", error);
    }
  };

  const updateProcessProgress = async (processId, newProgress) => {
    try {
      const process = processes.find((p) => p.id === processId);

      const updatedProcess = {
        ...process,
        progress: newProgress,
        updatedAt: new Date().toISOString(),
      };

      if (selectedBuilding && selectedBuilding !== 'virtual-building') {
        await processServices.updateProcess(selectedSite, selectedBuilding, processId, updatedProcess);
      } else if (selectedBuilding === 'virtual-building') {
        // Virtual building - update site-level process
        console.log("🏗️ Updating virtual building process progress");
        // TODO: Implement site-level process update
      }
    } catch (error) {
      console.error("Error updating process progress:", error);
    }
  };

  const getOverallSiteProgress = () => {
    if (!selectedSite || processes.length === 0) return 0;

    const totalProgress = processes.reduce((sum, process) => {
      const processProgress = process.progress || getProcessProgress(process);
      return sum + processProgress;
    }, 0);

    return Math.round(totalProgress / processes.length);
  };

  const getProcessProgress = (process) => {
    if (process.subProcesses.length === 0) return 0;
    const completed = process.subProcesses.filter(
      (sp) => sp.status === "completed",
    ).length;
    return Math.round((completed / process.subProcesses.length) * 100);
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            Process Management
          </h1>
          <p className="text-gray-600 mt-1">
            Manage construction processes and sub-processes for specific
            buildings
          </p>
        </div>
      </div>
      {/* Site and Building Selection */}
      <div className="card">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <MapPin className="w-4 h-4 inline mr-1" />
              Select Site
            </label>
            <select
              value={selectedSite}
              onChange={(e) => handleSiteChange(e.target.value)}
              className="input-field"
            >
              <option value="">Choose a site</option>
              {sites.map((site) => (
                <option key={site.id} value={site.id}>
                  {site.name} - {site.location}
                </option>
              ))}
            </select>
          </div>

          {selectedSite && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Building className="w-4 h-4 inline mr-1" />
                Select Building
              </label>
              <select
                value={selectedBuilding}
                onChange={(e) => handleBuildingChange(e.target.value)}
                className="input-field"
              >
                <option value="">Choose a building</option>
                {getBuildingsForSite(selectedSite).map((building) => (
                  <option key={building.id} value={building.id}>
                    {building.name} ({building.type})
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Overall Site Progress */}
        {selectedSite && processes.length > 0 && (
          <div className="mt-4 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-200">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-blue-900 mb-1">
                  Overall Site Progress
                </h3>
                <p className="text-sm text-blue-700">
                  {sites.find(s => s.id === selectedSite)?.name}
                </p>
                {userRole === 'supervisor' && (
                  <p className="text-xs text-blue-600 mt-1">
                    Supervisor: Click percentage to update
                  </p>
                )}
              </div>
              <div className="text-right">
                {userRole === 'supervisor' ? (
                  <div>
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => setShowCompletionModal(true)}
                      className="text-3xl font-bold text-blue-600 hover:text-blue-700 cursor-pointer"
                    >
                      {sites.find(s => s.id === selectedSite)?.completionPercentage || 0}%
                    </motion.button>
                    <div className="w-32 bg-gray-200 rounded-full h-3 mt-2">
                      <div
                        className="bg-gradient-to-r from-blue-500 to-indigo-600 h-3 rounded-full transition-all duration-500"
                        style={{ width: `${sites.find(s => s.id === selectedSite)?.completionPercentage || 0}%` }}
                      />
                    </div>
                  </div>
                ) : (
                  <div>
                    <div className="text-3xl font-bold text-blue-600">
                      {getOverallSiteProgress()}%
                    </div>
                    <div className="w-32 bg-gray-200 rounded-full h-3 mt-2">
                      <div
                        className="bg-gradient-to-r from-blue-500 to-indigo-600 h-3 rounded-full transition-all duration-500"
                        style={{ width: `${getOverallSiteProgress()}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
        {selectedSite && selectedBuilding && (
          <div className="mt-4 p-3 bg-blue-50 rounded-lg">
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-blue-600" />
              <span className="text-sm font-medium text-blue-900">
                {sites.find((s) => s.id === selectedSite)?.name}
              </span>
              <span className="text-blue-400">→</span>
              <Building className="w-4 h-4 text-blue-600" />
              <span className="text-sm font-medium text-blue-900">
                {selectedBuilding === 'virtual-building'
                  ? 'Virtual Building'
                  : getBuildingsForSite(selectedSite).find((b) => b.id === selectedBuilding)?.name
                }
              </span>
            </div>
          </div>
        )}
        {selectedSite && !selectedBuilding && (
          <div className="mt-4 p-3 bg-green-50 rounded-lg">
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-green-600" />
              <span className="text-sm font-medium text-green-900">
                {sites.find((s) => s.id === selectedSite)?.name}
              </span>
              <span className="text-green-600">→</span>
              <span className="text-sm font-medium text-green-900">
                Site-Level Processes
              </span>
            </div>
          </div>
        )}
      </div>
      {/* Processes Section */}
      {selectedSite ? (
        selectedBuilding || getBuildingsForSite(selectedSite).length === 0 ? (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-gray-900">
                {selectedBuilding ? "Building Processes" : "Site Processes"}
                <span className="ml-2 text-sm font-normal text-gray-600">
                  ({processes.length} {processes.length === 1 ? "process" : "processes"})
                </span>
              </h2>
              <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
                {(userRole === "admin" || userRole === "manager") && (
                  <>
                    {selectedBuilding && (
                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={initializeDefaultProcesses}
                        className="btn-secondary text-sm py-2 px-4 flex items-center justify-center gap-2 w-full sm:w-auto"
                      >
                        <Plus className="w-4 h-4 flex-shrink-0" />
                        <span className="hidden sm:inline">
                          Initialize Default Processes
                        </span>
                        <span className="sm:hidden">Initialize</span>
                      </motion.button>
                    )}
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={handleAddProcess}
                      className="btn-primary flex items-center justify-center gap-2 w-full sm:w-auto"
                    >
                      <Plus className="w-5 h-5 flex-shrink-0" />
                      <span className="hidden sm:inline">Add Process</span>
                      <span className="sm:hidden">Add</span>
                    </motion.button>
                  </>
                )}
              </div>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                <span className="ml-3 text-gray-600">Loading processes...</span>
              </div>
            ) : processes.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-gray-400 mb-4">
                  <Building className="w-16 h-16 mx-auto" />
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  No processes yet
                </h3>
                <p className="text-gray-600 mb-4">
                  {selectedBuilding
                    ? "Start by adding your first construction process for this building"
                    : "Start by adding your first construction process for this site"
                  }
                </p>
                {(userRole === "admin" || userRole === "manager") && (
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={handleAddProcess}
                    className="btn-primary flex items-center justify-center gap-2 mx-auto w-full sm:w-auto max-w-xs"
                  >
                    <Plus className="w-5 h-5 flex-shrink-0" />
                    <span className="hidden sm:inline">Add First Process</span>
                    <span className="sm:hidden">Add Process</span>
                  </motion.button>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                {processes.map((process, index) => {
                  const isExpanded = expandedProcesses.includes(process.id);
                  const progress = getProcessProgress(process);

                  return (
                    <motion.div
                      key={process.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.1 }}
                      className="card border border-gray-200 overflow-hidden hover:shadow-lg transition-shadow"
                    >
                      <div className="p-4">
                        <div className="flex items-start justify-between mb-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                              <div className="">
                                {getProcessIcon(process.name)}
                              </div>
                              <div>
                                <h3 className="font-bold text-gray-900 text-base mb-1">
                                  {process.name || 'Unnamed Process'}
                                </h3>
                                {process.description && (
                                  <p className="text-sm text-gray-600 line-clamp-2 leading-relaxed">
                                    {process.description}
                                  </p>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={`px-3 py-1.5 rounded-full text-sm font-semibold ${getProcessStatusColor(process.status || 'active')}`}>
                              {process.status || 'active'}
                            </span>
                            <div className="flex items-center gap-1">
                              {process.image && (
                                <button
                                  onClick={() => {
                                    setPreviewImage(process.image);
                                    setShowImagePreview(true);
                                  }}
                                  className="w-8 h-8 rounded-lg overflow-hidden hover:opacity-80 transition-all duration-200"
                                  title="View process image"
                                >
                                  <img
                                    src={process.image}
                                    alt={process.name || 'Process'}
                                    className="w-full h-full object-cover"
                                  />
                                </button>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Progress Section */}
                        <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-medium text-gray-700">Overall Progress</span>
                            <div className="flex items-center gap-2">
                              <input
                                type="number"
                                min="0"
                                max="100"
                                value={process.progress || progress}
                                onChange={(e) => updateProcessProgress(process.id, parseInt(e.target.value))}
                                className="w-16 px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                title="Set progress (0-100)"
                              />
                              <span className="text-lg font-bold text-blue-600">%</span>
                            </div>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-3">
                            <div
                              className="bg-gradient-to-r from-blue-500 to-blue-600 h-3 rounded-full transition-all duration-500 ease-out"
                              style={{ width: `${process.progress || progress}%` }}
                            />
                          </div>
                        </div>

                        <div className="flex items-center gap-1 mt-3">
                          {(userRole === "admin" || userRole === "manager") && (
                            <>
                              <motion.button
                                whileHover={{ scale: 1.1 }}
                                whileTap={{ scale: 0.9 }}
                                onClick={() => handleEdit(process, "process")}
                                className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                title="Edit process"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </motion.button>
                              <motion.button
                                whileHover={{ scale: 1.1 }}
                                whileTap={{ scale: 0.9 }}
                                onClick={() => handleAddSubProcess(process.id)}
                                className="p-1.5 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                                title="Add sub-process"
                              >
                                <Plus className="w-3.5 h-3.5" />
                              </motion.button>
                              <motion.button
                                whileHover={{ scale: 1.1 }}
                                whileTap={{ scale: 0.9 }}
                                onClick={() => handleDelete(process.id, "process")}
                                className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                title="Delete process"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </motion.button>
                            </>
                          )}
                          <motion.button
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.9 }}
                            onClick={() => toggleProcess(process.id)}
                            className="p-1.5 text-gray-600 hover:bg-gray-50 rounded-lg transition-colors ml-auto"
                            title={isExpanded ? "Collapse" : "Expand"}
                          >
                            {isExpanded ? (
                              <ChevronDown className="w-3.5 h-3.5" />
                            ) : (
                              <ChevronRight className="w-3.5 h-3.5" />
                            )}
                          </motion.button>
                        </div>
                      </div>

                      {isExpanded && process.subProcesses && process.subProcesses.length > 0 && (
                        <div className="border-t border-gray-200 bg-white/80 backdrop-blur-md p-4">
                          <h4 className="text-sm font-semibold text-gray-700 mb-3">Sub-Processes</h4>
                          <div className="space-y-2">
                            {process.subProcesses.map((subProcess) => (
                              <div
                                key={subProcess.id}
                                className="flex items-center justify-between p-3 bg-white/60 backdrop-blur-sm rounded-lg text-sm shadow-lg border border-white/20"
                              >
                                <div className="flex items-center gap-3">
                                  <button
                                    onClick={() => toggleSubProcessCompletion(process.id, subProcess.id)}
                                    className={`w-6 h-6 rounded-lg flex items-center justify-center transition-all duration-200 ${subProcess.status === 'completed'
                                        ? 'bg-green-500 text-white shadow-green-500/50'
                                        : subProcess.status === 'in-progress'
                                          ? 'bg-yellow-500 text-white shadow-yellow-500/50'
                                          : 'bg-gray-200 text-gray-400 hover:bg-blue-500 hover:text-white shadow-lg'
                                      }`}
                                    title={
                                      subProcess.status === 'completed' ? 'Mark as incomplete' :
                                        subProcess.status === 'in-progress' ? 'Mark as complete' :
                                          'Mark as in-progress'
                                    }
                                  >
                                    {subProcess.status === 'completed' ? '✓' :
                                      subProcess.status === 'in-progress' ? '⟳' : '○'}
                                  </button>
                                  <div className="flex items-center gap-2">
                                    <span className={`font-medium ${subProcess.status === 'completed' ? 'line-through text-gray-500' :
                                        subProcess.status === 'in-progress' ? 'text-yellow-600' :
                                          'text-gray-800'
                                      }`}>
                                      {subProcess.name}
                                    </span>
                                    <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${subProcess.status === 'completed'
                                        ? 'bg-green-100 text-green-700'
                                        : subProcess.status === 'in-progress'
                                          ? 'bg-yellow-100 text-yellow-700'
                                          : 'bg-gray-100 text-gray-600'
                                      }`}>
                                      {subProcess.status === 'completed' ? 'Done' :
                                        subProcess.status === 'in-progress' ? 'In Progress' :
                                          'Not Started'}
                                    </span>
                                  </div>
                                </div>
                                {(userRole === "admin" || userRole === "manager") && (
                                  <div className="flex items-center gap-2">
                                    <motion.button
                                      whileHover={{ scale: 1.05 }}
                                      whileTap={{ scale: 0.95 }}
                                      onClick={() => handleEdit(subProcess, "subprocess", process.id)}
                                      className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                      title="Edit sub-process"
                                    >
                                      <Edit2 className="w-4 h-4" />
                                    </motion.button>
                                    <motion.button
                                      whileHover={{ scale: 1.05 }}
                                      whileTap={{ scale: 0.95 }}
                                      onClick={() => handleDelete(subProcess.id, "subprocess", process.id)}
                                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                      title="Delete sub-process"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </motion.button>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </motion.div>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          // Site selected but no building selected
          <div className="text-center py-12">
            <div className="text-gray-400 mb-4">
              <Building className="w-16 h-16 mx-auto" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              {getBuildingsForSite(selectedSite).length === 0
                ? "No buildings found"
                : "Select a building"}
            </h3>
            <p className="text-gray-600 mb-4">
              {getBuildingsForSite(selectedSite).length === 0
                ? "This site doesn't have any buildings yet. Add buildings first to manage processes."
                : "Please select a building to view and manage its processes."}
            </p>
          </div>
        )
      ) : (
        // No site selected
        <div className="text-center py-12">
          <div className="text-gray-400 mb-4">
            <MapPin className="w-16 h-16 mx-auto" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            Select a site
          </h3>
          <p className="text-gray-600 mb-4">
            Choose a site to start managing construction processes
          </p>
        </div>
      )}

      <AnimatePresence>
        {showModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
            onClick={() => setShowModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-xl shadow-2xl w-full max-w-md"
            >
              <div className="p-6 border-b border-gray-200">
                <h2 className="text-2xl font-bold text-gray-900">
                  {editingItem ? "Edit" : "Add"}{" "}
                  {modalType === "process" ? "Process" : "Sub-Process"}
                </h2>
              </div>

              <form onSubmit={handleSubmit} className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                    className="input-field"
                    placeholder="Enter name"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Description
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) =>
                      setFormData({ ...formData, description: e.target.value })
                    }
                    className="input-field"
                    rows="3"
                    placeholder="Enter description (optional)"
                  />
                </div>

                {modalType === "process" && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Status
                      </label>
                      <select
                        value={formData.status || "active"}
                        onChange={(e) =>
                          setFormData({ ...formData, status: e.target.value })
                        }
                        className="input-field"
                      >
                        <option value="active">Active</option>
                        <option value="hold">Hold</option>
                        <option value="completed">Completed</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Process Image
                      </label>
                      <div className="flex items-center gap-4">
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleImageUpload}
                          className="hidden"
                          id="process-image-upload"
                        />
                        <label
                          htmlFor="process-image-upload"
                          className="px-4 py-2 border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors"
                        >
                          Choose Image
                        </label>
                        {formData.image && (
                          <div className="flex items-center gap-2">
                            <img
                              src={formData.image}
                              alt="Process preview"
                              className="h-12 w-12 object-cover rounded-lg cursor-pointer hover:opacity-80 transition-opacity"
                              onClick={() => {
                                setPreviewImage(formData.image);
                                setShowImagePreview(true);
                              }}
                            />
                            <button
                              type="button"
                              onClick={() =>
                                setFormData({ ...formData, image: "" })
                              }
                              className="text-red-500 hover:text-red-700"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        Max size: 5MB. Formats: JPG, PNG, GIF
                      </p>
                    </div>
                  </>
                )}

                <div className="flex gap-3 pt-4">
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    type="submit"
                    className="flex-1 btn-primary py-3"
                  >
                    {editingItem ? "Update" : "Add"}
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="flex-1 btn-outline py-3"
                  >
                    Cancel
                  </motion.button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}

        {showImagePreview && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-95 flex items-center justify-center z-50 p-4"
            onClick={() => setShowImagePreview(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative w-full h-full flex items-center justify-center"
              onClick={(e) => e.stopPropagation()}
            >
              <img
                src={previewImage}
                alt="Process preview"
                className="max-w-full max-h-[90vh] w-auto h-auto object-contain rounded-lg shadow-2xl"
              />
              <button
                onClick={() => setShowImagePreview(false)}
                className="absolute top-4 right-4 p-3 bg-white rounded-full shadow-lg hover:bg-gray-100 transition-colors z-10"
              >
                <X className="w-6 h-6 text-gray-600" />
              </button>
            </motion.div>
          </motion.div>
        )}

        {/* Site Completion Modal for Supervisors */}
        {showCompletionModal && userRole === 'supervisor' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
            onClick={() => setShowCompletionModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-xl p-6 w-full max-w-md mx-4"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-xl font-bold text-gray-900 mb-4">Update Site Completion</h3>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Completion Percentage (0-100)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={siteCompletion}
                    onChange={(e) => setSiteCompletion(Math.min(100, Math.max(0, parseInt(e.target.value) || 0)))}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Enter completion percentage"
                  />
                  <div className="mt-2">
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${siteCompletion}%` }}
                      />
                    </div>
                    <p className="text-xs text-gray-500 mt-1">{siteCompletion}% Complete</p>
                  </div>
                </div>

                <div className="bg-blue-50 p-3 rounded-lg">
                  <p className="text-sm text-blue-800">
                    <strong>Site:</strong> {sites.find(s => s.id === selectedSite)?.name}
                  </p>
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setShowCompletionModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg font-medium"
                >
                  Cancel
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => {
                    updateSiteCompletion(siteCompletion);
                    setShowCompletionModal(false);
                  }}
                  className="flex-1 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-medium"
                >
                  Update Completion
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ProcessManagement;
