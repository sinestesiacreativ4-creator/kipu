// Version: 2.0.1 - Fixed upload functionality
import React, { useState, useEffect } from 'react';
import { Mic, Search, Clock, FileAudio, LogOut, Trash2, Loader2, Building2, Upload } from 'lucide-react';
import Recorder from './components/Recorder';
import DetailView from './components/DetailView';
import ProfileSelector from './components/ProfileSelector';
import AuthScreen from './components/AuthScreen';
import OrgLogin from './components/OrgLogin';
import UploadProgress from './components/UploadProgress';
import { Recording, RecordingStatus, Marker, UserProfile, Organization } from './types';
import { blobToBase64, formatTime, generateId } from './utils';
import { analyzeAudio } from './services/geminiService';
import { supabaseDb as db } from './services/supabaseDb';
import { useAuth } from './hooks/useAuth';
import { uploadService } from './services/uploadService';

// --- Components defined inline for simplicity of the file structure ---

const Dashboard = ({
  recordings,
  user,
  onStartRecord,
  onSelectRecording,
  onDeleteRecording,
  onFileUpload,
  isLoading
}: {
  recordings: Recording[],
  user: UserProfile,
  onStartRecord: () => void,
  onSelectRecording: (r: Recording) => void,
  onDeleteRecording: (id: string) => void,
  onFileUpload: (file: File) => void,
  isLoading?: boolean
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onFileUpload(file);
    }
    // Reset input
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const filteredRecordings = recordings.filter(r => {
    const term = searchTerm.toLowerCase();
    return r.analysis?.title.toLowerCase().includes(term) ||
      r.analysis?.category.toLowerCase().includes(term) ||
      r.analysis?.tags.some(t => t.toLowerCase().includes(term));
  });

  return (
    <div className="max-w-6xl mx-auto p-6 md:p-10 animate-fade-in">
      {/* Header */}
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-12 sticky top-0 z-30 py-4 -mx-4 px-4 md:-mx-10 md:px-10 glass rounded-b-2xl transition-all duration-300">
        <div>
          <h1 className="text-4xl font-display font-bold text-stone-900 dark:text-white tracking-tight">
            Mari Mari, <span className="text-gradient-gold">{user.name}</span>
          </h1>
          <p className="text-stone-500 dark:text-stone-400 mt-2 font-light text-lg">
            {recordings.length === 0
              ? 'Tu archivo está esperando su primera historia.'
              : `Gestionando ${recordings.length} documentos en tu archivo.`}
          </p>
        </div>
        <div className="relative w-full md:w-auto group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400 group-focus-within:text-primary transition-colors" size={20} />
          <input
            type="text"
            placeholder="Buscar en tu sabiduría..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full md:w-96 pl-12 pr-6 py-3 bg-white/80 dark:bg-stone-800/80 backdrop-blur-sm border border-stone-200 dark:border-stone-700 rounded-2xl focus:outline-none focus:ring-2 focus:ring-gold/50 focus:border-gold text-base transition-all shadow-sm hover:shadow-md"
          />
        </div>
      </header>

      {/* Loading Overlay */}
      {isLoading && (
        <div className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40 flex items-center justify-center">
          <div className="bg-white dark:bg-stone-900 rounded-2xl p-8 shadow-2xl flex flex-col items-center gap-4">
            <Loader2 size={48} className="animate-spin text-primary" />
            <p className="text-stone-600 dark:text-stone-400 font-medium">Cargando grabaciones...</p>
          </div>
        </div>
      )}

      {/* Recent Section */}
      <section>
        <h2 className="text-lg font-semibold text-stone-800 dark:text-stone-200 mb-4">Grabaciones Recientes</h2>

        {filteredRecordings.length === 0 ? (
          <div className="text-center py-20 bg-white dark:bg-stone-900 rounded-2xl border-2 border-dashed border-stone-200 dark:border-stone-800">
            <div className="w-16 h-16 bg-stone-50 dark:bg-stone-800 rounded-full flex items-center justify-center mx-auto mb-4">
              <FileAudio className="text-stone-300 dark:text-stone-600" size={32} />
            </div>
            <p className="text-stone-500 dark:text-stone-400">Tu archivo está vacío. Comienza a documentar una sesión.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredRecordings.map(rec => (
              <div
                key={rec.id}
                className="group glass-card p-6 rounded-2xl hover:-translate-y-1 relative overflow-hidden"
              >
                <div onClick={() => onSelectRecording(rec)} className="cursor-pointer">
                  <div className="flex justify-between items-start mb-5">
                    <div className={`p-3 rounded-xl ${rec.status === RecordingStatus.PROCESSING ? 'bg-gold/10 text-gold-dark' : 'bg-primary/10 text-primary'}`}>
                      {rec.status === RecordingStatus.PROCESSING ? <Clock size={24} className="animate-spin-slow" /> : <FileAudio size={24} />}
                    </div>
                    <span className="text-xs font-medium text-stone-400 font-mono bg-stone-100 dark:bg-stone-800 px-2 py-1 rounded-md">{formatTime(rec.duration)}</span>
                  </div>

                  <h3 className="font-display font-bold text-xl text-stone-900 dark:text-stone-100 mb-2 line-clamp-1 group-hover:text-primary transition-colors">
                    {rec.analysis?.title || "Procesando..."}
                  </h3>
                  <p className="text-sm text-stone-500 dark:text-stone-400 mb-6 line-clamp-2 h-10 leading-relaxed">
                    {rec.analysis?.summary?.[0] || "Esperando resumen de IA..."}
                  </p>

                  <div className="flex items-center gap-2 mt-auto pt-4 border-t border-stone-100 dark:border-stone-800">
                    <span className="px-2.5 py-1 bg-stone-100 dark:bg-stone-800 text-xs font-medium text-stone-600 dark:text-stone-300 rounded-full">
                      {rec.analysis?.category || "Sin categoría"}
                    </span>
                    <span className="text-xs text-stone-400 ml-auto">
                      {new Date(rec.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                    </span>
                  </div>
                </div>

                {/* Delete Button */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (confirm('¿Estás seguro de que deseas eliminar esta grabación?')) {
                      onDeleteRecording(rec.id);
                    }
                  }}
                  className="absolute top-4 right-4 p-2 text-stone-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-full opacity-0 group-hover:opacity-100 transition-all transform translate-x-2 group-hover:translate-x-0"
                >
                  <Trash2 size={18} />
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Mobile-Optimized Action Buttons */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-30 flex flex-col sm:flex-row items-center gap-3">
        {/* Hidden file input */}
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          accept="audio/*,video/*,.mp3,.wav,.m4a,.webm,.ogg"
          className="hidden"
        />

        {/* Upload Button */}
        <button
          onClick={() => fileInputRef.current?.click()}
          className="bg-stone-800 hover:bg-stone-700 dark:bg-stone-700 dark:hover:bg-stone-600 text-white px-5 py-3 sm:px-6 sm:py-4 rounded-full shadow-xl transition-all hover:scale-105 active:scale-95 flex items-center gap-2 min-w-[160px] justify-center"
          title="Subir archivo de audio"
        >
          <Upload size={20} className="sm:hidden" />
          <Upload size={24} className="hidden sm:block" />
          <span className="font-semibold text-sm sm:text-base">Subir Audio</span>
        </button>

        {/* Record Button */}
        <button
          onClick={onStartRecord}
          className="bg-primary hover:bg-primary-hover text-white px-5 py-3 sm:px-6 sm:py-4 rounded-full shadow-2xl shadow-primary/40 transition-all hover:scale-105 active:scale-95 flex items-center gap-2 min-w-[160px] justify-center"
        >
          <Mic size={20} className="sm:hidden" />
          <Mic size={24} className="hidden sm:block" />
          <span className="font-semibold text-sm sm:text-base">Grabar</span>
        </button>
      </div>
    </div>
  );
};

// --- Main App Component ---

const AppContent = () => {
  // Authentication
  const { user: authUser, session, loading: authLoading, signOut } = useAuth();
  const [currentOrg, setCurrentOrg] = useState<Organization | null>(null);
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [profiles, setProfiles] = useState<UserProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingRecordings, setIsLoadingRecordings] = useState(false);
  const [showIOSWarning, setShowIOSWarning] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatus, setUploadStatus] = useState<'uploading' | 'success' | 'error' | null>(null);
  const [processingProgress, setProcessingProgress] = useState<{ current: number, total: number } | null>(null);

  const [view, setView] = useState<'dashboard' | 'recorder' | 'detail'>('dashboard');
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [selectedRecordingId, setSelectedRecordingId] = useState<string | null>(null);

  // Detect iOS and check if running as PWA
  useEffect(() => {
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const isPWA = window.matchMedia('(display-mode: standalone)').matches;

    if (isIOS && isPWA) {
      setShowIOSWarning(true);
    }
  }, []);

  // Load Org from LocalStorage on init
  useEffect(() => {
    const savedOrg = localStorage.getItem('kipu_org');
    if (savedOrg) {
      try {
        setCurrentOrg(JSON.parse(savedOrg));
      } catch (e) {
        console.error("Error parsing saved org", e);
        localStorage.removeItem('kipu_org');
      }
    }
    // Always stop loading after checking storage
    setIsLoading(false);
  }, []);

  // Initial DB Load (Load profiles when Org changes)
  useEffect(() => {
    if (!currentOrg) return;

    const init = async () => {
      setIsLoading(true);
      try {
        // Load profiles from CURRENT organization
        const fetchedProfiles = await db.getProfiles(currentOrg.id);
        setProfiles(fetchedProfiles);
      } catch (err) {
        console.error("Failed to initialize DB:", err);
      } finally {
        setIsLoading(false);
      }
    };

    init();
  }, [currentOrg]);

  // Load recordings when user changes
  useEffect(() => {
    if (!currentUser || !currentOrg) {
      setRecordings([]);
      return;
    }

    const loadUserRecordings = async () => {
      setIsLoadingRecordings(true);
      try {
        const userRecordings = await db.getRecordings(currentUser.id, currentOrg.id);
        setRecordings(userRecordings);
      } catch (err) {
        console.error("Error loading recordings:", err);
      } finally {
        setIsLoadingRecordings(false);
      }
    };
    loadUserRecordings();
    setView('dashboard');
  }, [currentUser, currentOrg]);

  // Polling for processing recordings
  useEffect(() => {
    if (!currentUser || !currentOrg) return;

    // Check if any recording is processing
    const isProcessing = recordings.some(r => r.status === RecordingStatus.PROCESSING);

    if (isProcessing) {
      console.log('[Polling] Active processing detected. Starting poll...');
      const intervalId = setInterval(async () => {
        try {
          console.log('[Polling] Checking for updates...');
          const updatedRecordings = await db.getRecordings(currentUser.id, currentOrg.id);

          // Always update to ensure we catch any status changes or errors
          // The React diffing algorithm will handle the DOM updates efficiently
          setRecordings(updatedRecordings);
        } catch (err) {
          console.error('[Polling] Error fetching updates:', err);
        }
      }, 5000); // Poll every 5 seconds

      return () => clearInterval(intervalId);
    }
  }, [recordings, currentUser, currentOrg]);

  const handleCreateProfile = async (profile: UserProfile) => {
    try {
      // Force profile to belong to Current Org
      if (!currentOrg) return;
      const publicProfile = { ...profile, organizationId: currentOrg.id };
      await db.addProfile(publicProfile);
      setProfiles(prev => [...prev, publicProfile]);
      setCurrentUser(publicProfile);
    } catch (err) {
      console.error("Error creating profile:", err);
      alert("Error al crear el perfil.");
    }
  };

  const handleDeleteProfile = async (profileId: string) => {
    try {
      await db.deleteProfile(profileId);
      setProfiles(prev => prev.filter(p => p.id !== profileId));
      // If the deleted profile was the current user (unlikely from UI but possible), logout
      if (currentUser?.id === profileId) {
        handleLogout();
      }
    } catch (err) {
      console.error("Error deleting profile:", err);
      alert("Error al eliminar el perfil.");
    }
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setRecordings([]);
    setSelectedRecordingId(null);
    signOut(); // Sign out from Supabase Auth
  };

  const handleOrgSelected = (org: Organization) => {
    setCurrentOrg(org);
    localStorage.setItem('kipu_org', JSON.stringify(org));
  };

  const handleExitOrg = () => {
    if (confirm('¿Quieres salir de esta organización?')) {
      setCurrentOrg(null);
      setCurrentUser(null);
      setRecordings([]);
      localStorage.removeItem('kipu_org');
    }
  };

  const handleDeleteRecording = async (id: string) => {
    try {
      await db.deleteRecording(id);
      setRecordings(prev => prev.filter(r => r.id !== id));
      if (selectedRecordingId === id) {
        setSelectedRecordingId(null);
        setView('dashboard');
      }
    } catch (err) {
      console.error("Error deleting recording:", err);
      alert("No se pudo eliminar la grabación.");
    }
  };

  const handleRecordingComplete = async (blob: Blob, duration: number, markers: Marker[]) => {
    if (!currentUser) return;

    const id = generateId();
    console.log('[App] Recording complete. Duration:', duration, 'seconds, Size:', blob.size, 'bytes');

    // For long recordings (>5 minutes), skip base64 conversion to prevent freezing
    const isLongRecording = duration > 300; // 5 minutes
    let base64 = null;

    if (!isLongRecording) {
      console.log('[App] Converting to base64 (short recording)...');
      base64 = await blobToBase64(blob);
    } else {
      console.log('[App] Skipping base64 conversion (long recording)');
    }

    // Extract segments if available
    const segments: Blob[] = (blob as any).segments || [blob];
    console.log('[App] Processing', segments.length, 'segment(s)');

    // 1. Create initial recording entry
    const newRecording: Recording = {
      id,
      userId: currentUser.id,
      organizationId: currentUser.organizationId,
      audioBase64: base64,
      duration,
      createdAt: Date.now(),
      status: RecordingStatus.PROCESSING,
      markers,
      analysis: {
        title: "Nueva Grabación...",
        category: "Procesando",
        summary: ["Procesando audio..."],
        actionItems: [],
        transcript: [],
        tags: []
      }
    };

    // Optimistic update
    setRecordings(prev => [newRecording, ...prev]);
    setSelectedRecordingId(id);
    setView('detail');

    // Async Save to DB (Upload to Storage)
    try {
      setUploadProgress(0);
      setUploadStatus('uploading');

      // Try async backend first
      try {
        console.log("[App] Attempting async backend upload...");
        const { uploadUrl, filePath, token } = await uploadService.getUploadUrl(`${id}.webm`, 'audio/webm', currentUser.id);

        await uploadService.uploadFileToSupabase(uploadUrl, blob, token, (p) => setUploadProgress(p));

        await uploadService.notifyUploadComplete(filePath, id, currentUser.id, currentUser.organizationId);

        console.log("[App] Async upload successful");

        const completedRecording = { ...newRecording, status: RecordingStatus.PROCESSING };
        setRecordings(prev => prev.map(rec => rec.id === id ? completedRecording : rec));

      } catch (backendError) {
        console.warn("[App] Backend unavailable, using direct upload:", backendError);

        // Fallback: Direct upload to Supabase
        await db.saveRecording(newRecording, blob, (progress) => {
          setUploadProgress(progress);
        });
      }

      setUploadStatus('success');
      setTimeout(() => setUploadStatus(null), 1500);
    } catch (err) {
      console.error("[App] Failed to save recording:", err);
      setUploadStatus('error');
      setTimeout(() => setUploadStatus(null), 3000);
    }

    // 2. Trigger AI Processing
    try {
      setProcessingProgress({ current: 0, total: segments.length });
      console.log('[App] Starting AI analysis...');

      const analysis = await analyzeAudio(segments, markers.length, (current, total) => {
        setProcessingProgress({ current, total });
      });

      const updatedRecording = {
        ...newRecording,
        status: RecordingStatus.COMPLETED,
        analysis
      };

      setRecordings(prev => prev.map(rec => rec.id === id ? updatedRecording : rec));
      await db.updateRecordingAnalysis(id, analysis, RecordingStatus.COMPLETED);

    } catch (error) {
      console.error("[App] AI Processing Failed:", error);

      const fallbackAnalysis = {
        title: "Grabación Guardada (Modo Offline)",
        category: "General",
        summary: [
          "La IA no pudo procesar el audio en este momento.",
          "Se ha guardado la grabación original para referencia futura.",
          "Puedes editar este resumen manualmente."
        ],
        actionItems: ["Revisar grabación manualmente", "Verificar conexión a internet"],
        tags: ["Offline", "Pendiente"],
        transcript: [
          { speaker: "Sistema", text: "Transcripción no disponible en modo offline.", timestamp: "00:00" }
        ]
      };

      const completedRecording = {
        ...newRecording,
        status: RecordingStatus.COMPLETED,
        analysis: fallbackAnalysis
      };

      setRecordings(prev => prev.map(rec => rec.id === id ? completedRecording : rec));
      await db.saveRecording(completedRecording);
    } finally {
      setProcessingProgress(null);
    }
  };

  const handleReanalyze = async (recordingId: string) => {
    const recording = recordings.find(r => r.id === recordingId);
    if (!recording || !recording.audioBase64) {
      alert('No se pudo encontrar la grabación');
      return;
    }

    // Update to processing status
    const processingRecording = {
      ...recording,
      status: RecordingStatus.PROCESSING
    };
    setRecordings(prev => prev.map(rec => rec.id === recordingId ? processingRecording : rec));

    try {
      // For re-analysis, we need to convert the base64 back to a blob to match the new signature
      // This is a bit inefficient for re-analysis but necessary for the unified API
      const blob = await (await fetch(`data:audio/webm;base64,${recording.audioBase64}`)).blob();

      setProcessingProgress({ current: 0, total: 1 });
      const analysis = await analyzeAudio([blob], recording.markers?.length || 0, (current, total) => {
        setProcessingProgress({ current, total });
      });

      const completedRecording = {
        ...recording,
        status: RecordingStatus.COMPLETED,
        analysis
      };

      // Actualizar UI inmediatamente
      setRecordings(prev => prev.map(rec => rec.id === recordingId ? completedRecording : rec));

      // Guardar en DB en segundo plano (no esperar, evita timeout bloqueante)
      db.updateRecordingAnalysis(recordingId, analysis, RecordingStatus.COMPLETED)
        .catch(err => console.error('Error guardando en DB (no crítico):', err));

    } catch (error) {
      console.error('Error during re-analysis:', error);
      // Revert to offline status
      const offlineRecording = {
        ...recording,
        status: RecordingStatus.OFFLINE
      };
      setRecordings(prev => prev.map(rec => rec.id === recordingId ? offlineRecording : rec));
      throw error;
    } finally {
      setProcessingProgress(null);
    }
  };

  const handleFileUpload = async (file: File) => {
    if (!currentUser) {
      alert('Debes iniciar sesión primero');
      return;
    }

    console.log('[Upload] Starting upload for file:', file.name, 'Size:', file.size, 'Type:', file.type);

    const id = generateId();

    const newRecording: Recording = {
      id,
      userId: currentUser.id,
      organizationId: currentUser.organizationId,
      audioBase64: null,
      duration: 0,
      createdAt: Date.now(),
      status: RecordingStatus.PROCESSING,
      markers: [],
      analysis: {
        title: file.name,
        category: "Procesando",
        summary: ["Subiendo archivo..."],
        actionItems: [],
        transcript: [],
        tags: ["Subido"]
      }
    };

    setRecordings(prev => [newRecording, ...prev]);
    setSelectedRecordingId(id);
    setView('detail');

    try {
      setUploadProgress(0);
      setUploadStatus('uploading');

      console.log('[Upload] Uploading directly to Supabase Storage...');
      const filePath = `${currentUser.id}/${id}_${file.name}`;

      setUploadProgress(50);

      const { data: uploadData, error: uploadError } = await db.supabase
        .storage
        .from('recordings')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) {
        console.error('[Upload] Supabase Storage Error:', uploadError);
        console.error('[Upload] Error details:', {
          message: uploadError.message,
          filePath: filePath
        });
        throw new Error(`Upload failed: ${uploadError.message}`);
      }

      setUploadProgress(100);
      console.log('[Upload] File uploaded successfully to:', filePath);
      setUploadStatus('success');
      setTimeout(() => setUploadStatus(null), 1500);

      // --- ASYNC BACKEND PROCESSING ---
      // Instead of analyzing in browser (which fails for large files),
      // we notify the backend worker to process it.

      try {
        console.log('[Upload] Notifying backend worker to process file...');
        await uploadService.notifyUploadComplete(filePath, id, currentUser.id, currentUser.organizationId);
        console.log('[Upload] Backend notified successfully. Job queued.');

        // Update status to indicate backend processing
        const queuedRecording = {
          ...newRecording,
          status: RecordingStatus.PROCESSING,
          analysis: {
            ...newRecording.analysis,
            summary: ["Archivo subido. Procesando en la nube (esto puede tomar unos minutos)..."]
          }
        };
        setRecordings(prev => prev.map(rec => rec.id === id ? queuedRecording : rec));

      } catch (backendError) {
        console.error('[Upload] Failed to notify backend:', backendError);
        console.warn('[Upload] Falling back to browser processing (limited capability)...');

        // Fallback: Browser processing (only works for small files)
        setProcessingProgress({ current: 0, total: 1 });
        const analysis = await analyzeAudio([file], 0, (current, total) => {
          setProcessingProgress({ current, total });
        });

        const completedRecording = {
          ...newRecording,
          status: RecordingStatus.COMPLETED,
          analysis
        };
        setRecordings(prev => prev.map(rec => rec.id === id ? completedRecording : rec));
        await db.saveRecording(completedRecording);
      }

    } catch (err: any) {
      console.error('[Upload] Error:', err);
      const errorMsg = err.message || 'Error desconocido';
      alert(`Error al subir el archivo: ${errorMsg}`);
      setRecordings(prev => prev.filter(r => r.id !== id));
      setUploadStatus('error');
      setTimeout(() => setUploadStatus(null), 3000);
    } finally {
      setProcessingProgress(null);
    }
  };

  const activeRecording = recordings.find(r => r.id === selectedRecordingId);

  // --- Loading State ---
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bone dark:bg-stone-950">
        <Loader2 className="animate-spin text-primary" size={48} />
      </div>
    );
  }

  // --- AUTH LOADING ---
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bone dark:bg-darkbg">
        <Loader2 size={48} className="animate-spin text-primary" />
      </div>
    );
  }

  // --- ORG LOGIN SCREEN ---
  if (!currentOrg) {
    return <OrgLogin onOrgSelected={handleOrgSelected} />;
  }

  // --- Profile Selection Gate: Must select a profile ---
  if (!currentUser) {
    return (
      <ProfileSelector
        profiles={profiles}
        onSelect={setCurrentUser}
        onCreate={handleCreateProfile}
        onDelete={handleDeleteProfile}
        organizationName={currentOrg.name}
      />
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-bone dark:bg-darkbg text-stone-800 dark:text-stone-200 transition-colors duration-200">
      {/* Navbar */}
      <nav className="h-16 border-b border-stone-200 dark:border-stone-800 flex items-center px-6 bg-white dark:bg-stone-900 sticky top-0 z-40 no-print shadow-sm">
        <div className="flex items-center gap-3 text-2xl font-bold tracking-tighter cursor-pointer hover:opacity-80 transition-opacity" onClick={() => setView('dashboard')}>
          <img src="/kipu_logo.png" alt="Kipu" className="h-10 w-auto" />
          <span className="text-stone-900 dark:text-white tracking-tight hidden sm:flex items-center gap-2">
            <span className="beta-badge">BETA</span>
          </span>
        </div>

        <div className="ml-auto flex items-center gap-4">
          {/* User Profile Badge */}
          <div className="flex items-center gap-3 pl-4 border-l border-stone-200 dark:border-stone-700">
            <div className="text-right hidden sm:block">
              <p className="text-sm font-bold text-stone-900 dark:text-white leading-none">{currentUser.name}</p>
              <p className="text-xs text-stone-500 dark:text-stone-400">{currentUser.role}</p>
            </div>
            <div className={`w - 9 h - 9 rounded - full ${currentUser.avatarColor} flex items - center justify - center text - white font - bold shadow - sm border - 2 border - white dark: border - stone - 800`}>
              {currentUser.name.charAt(0).toUpperCase()}
            </div>
            <button
              onClick={handleLogout}
              className="p-2 text-stone-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
              title="Cerrar Sesión"
            >
              <LogOut size={18} />
            </button>
            <button
              onClick={handleExitOrg}
              className="p-2 text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 transition-colors border-l border-stone-200 dark:border-stone-700 ml-2 pl-3"
              title="Cambiar Organización"
            >
              <Building2 size={18} />
            </button>
          </div>
        </div>
      </nav>

      {/* iOS PWA Warning Banner */}
      {showIOSWarning && (
        <div className="bg-amber-500 text-white px-4 py-3 flex items-start gap-3 shadow-lg relative">
          <div className="flex-shrink-0 mt-0.5">
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="flex-1">
            <p className="font-semibold text-sm mb-1">⚠️ Limitación de iOS</p>
            <p className="text-sm">
              Para grabar audio en iPhone/iPad, debes usar <strong>Safari directamente</strong>, no la app instalada.
              {' '}Abre Safari y ve a <span className="font-mono bg-amber-600 px-1 rounded">kipu-lemon.vercel.app</span>
            </p>
          </div>
          <button
            onClick={() => setShowIOSWarning(false)}
            className="flex-shrink-0 hover:bg-amber-600 rounded p-1 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      <main className="flex-1 relative">
        {view === 'dashboard' && (
          <Dashboard
            recordings={recordings}
            user={currentUser}
            onStartRecord={() => setView('recorder')}
            onSelectRecording={(rec) => {
              setSelectedRecordingId(rec.id);
              setView('detail');
            }}
            onDeleteRecording={handleDeleteRecording}
            onFileUpload={handleFileUpload}
            isLoading={isLoadingRecordings}
          />
        )}

        {view === 'recorder' && (
          <Recorder
            onComplete={handleRecordingComplete}
            onCancel={() => setView('dashboard')}
          />
        )}

        {view === 'detail' && activeRecording && (
          <DetailView
            recording={activeRecording}
            onBack={() => {
              setSelectedRecordingId(null);
              setView('dashboard');
            }}
            onReanalyze={handleReanalyze}
          />
        )}
      </main>

      {/* Upload Progress Overlay */}
      {uploadStatus && (
        <UploadProgress
          progress={uploadProgress}
          status={uploadStatus}
          fileName="grabacion.webm"
        />
      )}

      {/* Processing Progress Overlay */}
      {processingProgress && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-stone-900 rounded-2xl p-8 shadow-2xl max-w-md w-full text-center animate-in zoom-in-95">
            <div className="w-16 h-16 bg-primary/10 text-primary rounded-full flex items-center justify-center mx-auto mb-6">
              <Loader2 size={32} className="animate-spin" />
            </div>
            <h3 className="text-xl font-bold text-stone-900 dark:text-white mb-2">Analizando Reunión...</h3>
            <p className="text-stone-500 dark:text-stone-400 mb-6">
              Procesando segmento {processingProgress.current} de {processingProgress.total}
            </p>
            <div className="w-full bg-stone-100 dark:bg-stone-800 rounded-full h-3 overflow-hidden">
              <div
                className="bg-primary h-full transition-all duration-500 ease-out"
                style={{ width: `${(processingProgress.current / processingProgress.total) * 100}% ` }}
              ></div>
            </div>
            <p className="text-xs text-stone-400 mt-4">
              Esto puede tomar unos minutos para reuniones largas. Por favor no cierres la pestaña.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

const App = () => {
  return <AppContent />;
};

export default App;