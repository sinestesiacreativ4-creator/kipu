import React, { useState, useRef } from 'react';
import { ArrowLeft, List, Download, Folder, CheckCircle2, RefreshCw, MessageSquare, FileText, Mic } from 'lucide-react';
import MeetingChat from './MeetingChat';
import VoiceAgent from './VoiceAgent';
import { Recording, RecordingStatus, ExportOptions } from '../types';
import { formatTime } from '../utils';
import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } from 'docx';
import { saveAs } from 'file-saver';

interface DetailViewProps {
  recording: Recording;
  onBack: () => void;
  onReanalyze?: (recordingId: string) => Promise<void>;
}

const DetailView: React.FC<DetailViewProps> = ({ recording, onBack, onReanalyze }) => {
  const [activeTab, setActiveTab] = useState<'summary' | 'transcript' | 'chat' | 'voice'>('summary');
  const [showExportModal, setShowExportModal] = useState(false);
  const [isReanalyzing, setIsReanalyzing] = useState(false);
  const [showTimeout, setShowTimeout] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [exportOpts, setExportOpts] = useState<ExportOptions>({
    includeSummary: true,
    includeTranscript: true,
    includeActionItems: true
  });

  const { analysis, duration, createdAt, audioBase64 } = recording;

  const handleReanalyze = async () => {
    if (!onReanalyze) return;
    setIsReanalyzing(true);
    try {
      await onReanalyze(recording.id);
    } catch (error) {
      console.error('Error re-analyzing:', error);
      alert('Error al re-analizar la grabación');
    } finally {
      setIsReanalyzing(false);
    }
  };

  const handleExportPDF = () => {
    window.print();
    setShowExportModal(false);
  };

  const handleExportWord = async () => {
    try {
      const doc = new Document({
        sections: [{
          properties: {},
          children: [
            // Title
            new Paragraph({
              text: analysis.title,
              heading: HeadingLevel.HEADING_1,
              alignment: AlignmentType.CENTER,
              spacing: { after: 200 }
            }),
            // Metadata
            new Paragraph({
              text: `Fecha: ${new Date(createdAt).toLocaleDateString()} | Duración: ${formatTime(duration)}`,
              alignment: AlignmentType.CENTER,
              spacing: { after: 400 }
            }),
            // Executive Summary (if available)
            ...(analysis.executiveSummary ? [
              new Paragraph({
                text: "Resumen Ejecutivo",
                heading: HeadingLevel.HEADING_2,
                spacing: { before: 200, after: 100 }
              }),
              new Paragraph({
                text: analysis.executiveSummary,
                spacing: { after: 300 }
              })
            ] : []),
            // Participants (if available)
            ...(analysis.participants && analysis.participants.length > 0 ? [
              new Paragraph({
                text: "Participantes",
                heading: HeadingLevel.HEADING_2,
                spacing: { before: 200, after: 100 }
              }),
              new Paragraph({
                text: analysis.participants.join(", "),
                spacing: { after: 300 }
              })
            ] : []),
            // Decisions (if available)
            ...(analysis.decisions && analysis.decisions.length > 0 && exportOpts.includeSummary ? [
              new Paragraph({
                text: "Decisiones Tomadas",
                heading: HeadingLevel.HEADING_2,
                spacing: { before: 200, after: 100 }
              }),
              ...analysis.decisions.map((decision: string) =>
                new Paragraph({
                  text: `• ${decision}`,
                  spacing: { after: 100 }
                })
              )
            ] : []),
            // Key Points
            ...(exportOpts.includeSummary ? [
              new Paragraph({
                text: "Puntos Clave",
                heading: HeadingLevel.HEADING_2,
                spacing: { before: 200, after: 100 }
              }),
              ...analysis.summary.map((point: string) =>
                new Paragraph({
                  text: `• ${point}`,
                  spacing: { after: 100 }
                })
              )
            ] : []),
            // Action Items
            ...(exportOpts.includeActionItems && analysis.actionItems.length > 0 ? [
              new Paragraph({
                text: "Tareas Pendientes",
                heading: HeadingLevel.HEADING_2,
                spacing: { before: 200, after: 100 }
              }),
              ...analysis.actionItems.map((item: string) =>
                new Paragraph({
                  text: `☐ ${item}`,
                  spacing: { after: 100 }
                })
              )
            ] : []),
            // Transcript
            ...(exportOpts.includeTranscript ? [
              new Paragraph({
                text: "Transcripción Completa",
                heading: HeadingLevel.HEADING_2,
                spacing: { before: 400, after: 200 }
              }),
              ...analysis.transcript.flatMap((segment: any) => [
                new Paragraph({
                  children: [
                    new TextRun({
                      text: `${segment.speaker} `,
                      bold: true,
                      color: "1a56db"
                    }),
                    new TextRun({
                      text: `[${segment.timestamp}]`,
                      color: "6b7280",
                      size: 18
                    })
                  ],
                  spacing: { before: 100 }
                }),
                new Paragraph({
                  text: segment.text,
                  spacing: { after: 200 }
                })
              ])
            ] : [])
          ]
        }]
      });

      const blob = await Packer.toBlob(doc);
      saveAs(blob, `${analysis.title.replace(/[^a-z0-9]/gi, '_')}.docx`);
      setShowExportModal(false);
    } catch (error) {
      console.error('Error generating Word document:', error);
      alert('Error al generar el documento Word');
    }
  };

  // Timeout de seguridad: si lleva más de 5 minutos procesando, mostrar error
  React.useEffect(() => {
    let timer: NodeJS.Timeout;
    if (recording.status === RecordingStatus.PROCESSING) {
      timer = setTimeout(() => {
        setShowTimeout(true);
      }, 300000); // 5 minutos
    }
    return () => clearTimeout(timer);
  }, [recording.status]);

  if (recording.status === RecordingStatus.PROCESSING && !showTimeout) {
    return (
      <div className="flex flex-col items-center justify-center h-screen text-center p-8">
        <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mb-6"></div>
        <h2 className="text-2xl font-bold mb-2">La IA está procesando el audio...</h2>
        <p className="text-stone-500 mb-4">Identificando hablantes, resumiendo puntos clave y extrayendo tareas.</p>
        <p className="text-xs text-stone-400">Esto puede tomar unos minutos dependiendo de la duración.</p>
      </div>
    );
  }

  if (recording.status === RecordingStatus.ERROR || showTimeout) {
    return (
      <div className="flex flex-col items-center justify-center h-screen text-center p-8">
        <div className="w-16 h-16 bg-red-100 text-red-500 rounded-full flex items-center justify-center mb-6">
          <RefreshCw size={32} />
        </div>
        <h2 className="text-2xl font-bold mb-2 text-stone-800 dark:text-white">Hubo un error en el análisis</h2>
        <p className="text-stone-500 mb-8 max-w-md">
          La IA no pudo procesar este archivo. Puede deberse a un error temporal o al formato del archivo.
        </p>
        <div className="flex gap-4">
          <button
            onClick={onBack}
            className="px-6 py-3 text-stone-600 hover:bg-stone-100 dark:text-stone-300 dark:hover:bg-stone-800 rounded-xl transition-colors font-medium"
          >
            Volver
          </button>
          {onReanalyze && (
            <button
              onClick={handleReanalyze}
              disabled={isReanalyzing}
              className="flex items-center gap-2 px-6 py-3 bg-primary hover:bg-primary-hover text-white rounded-xl shadow-lg shadow-primary/20 transition-all hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
            >
              <RefreshCw size={20} className={isReanalyzing ? 'animate-spin' : ''} />
              {isReanalyzing ? 'Reintentando...' : 'Reintentar Análisis'}
            </button>
          )}
        </div>
      </div>
    );
  }

  if (!analysis) {
    return (
      <div className="p-8 text-center">
        <h2 className="text-xl text-red-500">Error: Faltan datos de análisis.</h2>
        <button onClick={onBack} className="mt-4 text-primary underline">Volver Atrás</button>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto p-4 md:p-8 print:p-0 print:max-w-none">
      {/* Header */}
      <header className="mb-6 md:mb-8 no-print" role="banner">
        <button
          onClick={onBack}
          className="flex items-center text-stone-600 hover:text-primary dark:text-stone-400 dark:hover:text-white mb-4 md:mb-6 transition-colors font-medium focus:outline-none focus:ring-2 focus:ring-primary/50 rounded-lg px-2 py-1 -ml-2"
          aria-label="Volver al inicio"
        >
          <ArrowLeft size={20} className="mr-2" aria-hidden="true" /> Volver al Inicio
        </button>
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 md:gap-6">
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-display font-bold text-stone-900 dark:text-white mb-3 leading-tight">{analysis.title}</h1>
            <div className="flex flex-wrap items-center gap-2 md:gap-3 text-xs sm:text-sm text-stone-600 dark:text-stone-400">
              <span className="flex items-center gap-1.5 px-2.5 py-1 bg-stone-100 dark:bg-stone-800 rounded-full font-medium">
                <Folder size={14} aria-hidden="true" /> {analysis.category}
              </span>
              <span className="hidden md:inline text-stone-300 dark:text-stone-600" aria-hidden="true">•</span>
              <time 
                className="flex items-center gap-1.5"
                dateTime={new Date(createdAt).toISOString()}
              >
                <span className="w-1.5 h-1.5 bg-stone-400 rounded-full" aria-hidden="true"></span> 
                {new Date(createdAt).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
              </time>
              <span className="hidden md:inline text-stone-300 dark:text-stone-600" aria-hidden="true">•</span>
              <span className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 bg-stone-400 rounded-full" aria-hidden="true"></span> 
                {formatTime(duration)}
              </span>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 md:gap-3">
            {(recording.status === RecordingStatus.OFFLINE || analysis?.title?.includes('Modo Offline')) && onReanalyze && (
              <button
                onClick={handleReanalyze}
                disabled={isReanalyzing}
                className="flex items-center gap-2 px-4 md:px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl shadow-lg shadow-amber-500/20 transition-all hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed font-medium focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                aria-label={isReanalyzing ? 'Analizando grabación' : 'Re-analizar grabación'}
              >
                <RefreshCw size={18} className={isReanalyzing ? 'animate-spin' : ''} aria-hidden="true" />
                <span className="text-sm md:text-base">{isReanalyzing ? 'Analizando...' : 'Re-analizar'}</span>
              </button>
            )}
            <button
              onClick={() => setShowExportModal(true)}
              className="flex items-center gap-2 px-4 md:px-5 py-2.5 bg-secondary hover:bg-green-800 text-white rounded-xl shadow-lg shadow-secondary/20 transition-all hover:-translate-y-0.5 font-medium focus:outline-none focus:ring-2 focus:ring-green-600/50"
              aria-label="Exportar grabación"
            >
              <Download size={18} aria-hidden="true" /> 
              <span className="text-sm md:text-base">Exportar</span>
            </button>
          </div>
        </div>
      </header>

      {/* Print Only Header */}
      <div className="hidden print-only mb-8">
        <h1 className="text-4xl font-bold mb-2">{analysis.title}</h1>
        <p className="text-stone-600 mb-4">Fecha: {new Date(createdAt).toLocaleDateString()} | Duración: {formatTime(duration)}</p>
        <hr className="border-stone-300" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Content Area */}
        <div className="lg:col-span-2 space-y-6">

          {/* Tabs (No Print) */}
          <nav 
            className="flex p-1.5 bg-stone-100 dark:bg-stone-800/50 rounded-2xl no-print mb-6 md:mb-8 border border-stone-200 dark:border-stone-700"
            role="tablist"
            aria-label="Secciones de la grabación"
          >
            <button
              onClick={() => setActiveTab('summary')}
              role="tab"
              aria-selected={activeTab === 'summary'}
              aria-controls="summary-panel"
              id="summary-tab"
              className={`flex-1 px-4 md:px-6 py-2.5 md:py-3 text-xs sm:text-sm font-bold rounded-xl transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-primary/50 ${activeTab === 'summary'
                ? 'bg-white dark:bg-stone-700 text-primary shadow-md transform scale-[1.02]'
                : 'text-stone-600 hover:text-stone-800 dark:text-stone-400 dark:hover:text-stone-200 hover:bg-stone-200/50 dark:hover:bg-stone-700/30'
                }`}
            >
              Resumen Inteligente
            </button>
            <button
              onClick={() => setActiveTab('transcript')}
              role="tab"
              aria-selected={activeTab === 'transcript'}
              aria-controls="transcript-panel"
              id="transcript-tab"
              className={`flex-1 px-4 md:px-6 py-2.5 md:py-3 text-xs sm:text-sm font-bold rounded-xl transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-primary/50 ${activeTab === 'transcript'
                ? 'bg-white dark:bg-stone-700 text-primary shadow-md transform scale-[1.02]'
                : 'text-stone-600 hover:text-stone-800 dark:text-stone-400 dark:hover:text-stone-200 hover:bg-stone-200/50 dark:hover:bg-stone-700/30'
                }`}
            >
              Transcripción Completa
            </button>
            <button
              onClick={() => setActiveTab('chat')}
              role="tab"
              aria-selected={activeTab === 'chat'}
              aria-controls="chat-panel"
              id="chat-tab"
              className={`flex-1 px-4 md:px-6 py-2.5 md:py-3 text-xs sm:text-sm font-bold rounded-xl transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-primary/50 ${activeTab === 'chat'
                ? 'bg-white dark:bg-stone-700 text-primary shadow-md transform scale-[1.02]'
                : 'text-stone-600 hover:text-stone-800 dark:text-stone-400 dark:hover:text-stone-200 hover:bg-stone-200/50 dark:hover:bg-stone-700/30'
                }`}
            >
              <div className="flex items-center justify-center gap-2">
                <MessageSquare size={16} aria-hidden="true" />
                <span>Chat AI</span>
              </div>
            </button>
            <button
              onClick={() => setActiveTab('voice')}
              role="tab"
              aria-selected={activeTab === 'voice'}
              aria-controls="voice-panel"
              id="voice-tab"
              className={`flex-1 px-4 md:px-6 py-2.5 md:py-3 text-xs sm:text-sm font-bold rounded-xl transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-primary/50 ${activeTab === 'voice'
                ? 'bg-white dark:bg-stone-700 text-primary shadow-md transform scale-[1.02]'
                : 'text-stone-600 hover:text-stone-800 dark:text-stone-400 dark:hover:text-stone-200 hover:bg-stone-200/50 dark:hover:bg-stone-700/30'
                }`}
            >
              <div className="flex items-center justify-center gap-2">
                <Mic size={16} aria-hidden="true" />
                <span>Voz</span>
              </div>
            </button>
          </nav>

          {/* Summary Tab Content */}
          <div 
            id="summary-panel"
            role="tabpanel"
            aria-labelledby="summary-tab"
            className={`${activeTab === 'summary' ? 'block' : 'hidden'} print:block space-y-6 md:space-y-8 animate-fade-in`}
          >

            <section className="glass-card p-8 rounded-2xl">
              <h3 className="flex items-center gap-2 text-lg font-semibold text-stone-900 dark:text-white mb-4">
                <List className="text-secondary" size={20} /> Puntos Clave
              </h3>
              {analysis.summary.length > 0 ? (
                <ul className="space-y-3">
                  {analysis.summary.map((point, idx) => (
                    <li key={idx} className="flex items-start gap-3 text-stone-700 dark:text-stone-300 leading-relaxed">
                      <span className="mt-1.5 w-1.5 h-1.5 bg-primary rounded-full flex-shrink-0"></span>
                      {point}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-stone-500 italic">
                  No se generaron puntos clave. La grabación podría ser demasiado corta o no contener diálogo claro.
                </p>
              )}
            </section>

            <section className="bg-white dark:bg-stone-800 p-6 rounded-xl shadow-sm border border-stone-100 dark:border-stone-700">
              <h3 className="flex items-center gap-2 text-lg font-semibold text-stone-900 dark:text-white mb-4">
                <CheckCircle2 className="text-secondary" size={20} /> Tareas Pendientes
              </h3>
              {analysis.actionItems.length > 0 ? (
                <ul className="space-y-3">
                  {analysis.actionItems.map((item, idx) => (
                    <li key={idx} className="flex items-center gap-3 p-3 bg-stone-50 dark:bg-stone-700/50 rounded-lg border border-stone-100 dark:border-stone-600">
                      <div className="w-5 h-5 border-2 border-stone-300 rounded flex-shrink-0"></div>
                      <span className="text-stone-800 dark:text-stone-200">{item}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-stone-500 italic">No se detectaron tareas específicas.</p>
              )}
            </section>

          </div>

          {/* Transcript Tab Content */}
          <div 
            id="transcript-panel"
            role="tabpanel"
            aria-labelledby="transcript-tab"
            className={`${activeTab === 'transcript' ? 'block' : 'hidden'} print:block animate-fade-in`}
          >
            <div className="bg-white dark:bg-stone-800 rounded-2xl shadow-sm border border-stone-100 dark:border-stone-700 divide-y divide-stone-100 dark:divide-stone-700 overflow-hidden">
              {analysis.transcript.length > 0 ? (
                analysis.transcript.map((segment, idx) => (
                  <div key={idx} className="p-6 hover:bg-stone-50 dark:hover:bg-stone-700/30 transition-colors group flex gap-4">
                    <div className={`w-10 h-10 rounded-full flex-shrink-0 flex items-center justify-center text-white font-bold text-sm shadow-sm ${idx % 2 === 0 ? 'bg-blue-500' : 'bg-amber-500'}`}>
                      {segment.speaker.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1">
                      <div className="flex justify-between items-baseline mb-2">
                        <span className="font-bold text-sm text-stone-900 dark:text-white">{segment.speaker}</span>
                        <span className="text-xs text-stone-400 font-mono bg-stone-100 dark:bg-stone-700 px-2 py-0.5 rounded opacity-70 group-hover:opacity-100 transition-opacity">
                          {segment.timestamp}
                        </span>
                      </div>
                      <p className="text-stone-700 dark:text-stone-300 leading-relaxed text-base">
                        {segment.text}
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-12 text-center text-stone-500 italic flex flex-col items-center gap-4">
                  <FileText size={48} className="text-stone-300" />
                  <p>No se generó transcripción. El audio podría ser demasiado corto o no contener diálogo claro.</p>
                </div>
              )}
            </div>
          </div>

          {/* Chat Tab Content */}
          <div 
            id="chat-panel"
            role="tabpanel"
            aria-labelledby="chat-tab"
            className={`${activeTab === 'chat' ? 'block' : 'hidden'} print:hidden animate-fade-in`}
          >
            <MeetingChat analysis={analysis} />
          </div>

          {/* Voice Tab Content */}
          <div 
            id="voice-panel"
            role="tabpanel"
            aria-labelledby="voice-tab"
            className={`${activeTab === 'voice' ? 'block' : 'hidden'} print:hidden animate-fade-in`}
          >
            <VoiceAgent recordingId={recording.id} />
          </div>

        </div>

        {/* Sidebar / Sticky Player */}
        <div className="lg:col-span-1 space-y-6">
          {/* Audio Player */}
          <aside className="sticky top-6 bg-white dark:bg-stone-800 p-4 md:p-6 rounded-xl shadow-lg border border-stone-100 dark:border-stone-700 no-print">
            <h3 className="text-sm font-semibold text-stone-600 dark:text-stone-400 uppercase tracking-wider mb-4">Grabación</h3>
            {audioBase64 && (
              <audio
                ref={audioRef}
                controls
                className="w-full mb-4 accent-primary"
                src={`data:audio/webm;base64,${audioBase64}`}
                aria-label="Reproductor de audio de la grabación"
              >
                Tu navegador no soporta el elemento de audio.
              </audio>
            )}

            <div className="mt-6">
              <h4 className="text-sm font-semibold text-stone-900 dark:text-white mb-3">Etiquetas</h4>
              <div className="flex flex-wrap gap-2">
                {analysis.tags.map((tag, idx) => (
                  <span key={idx} className="px-2 py-1 bg-stone-100 dark:bg-stone-700 text-stone-600 dark:text-stone-300 text-xs rounded-md border border-stone-200 dark:border-stone-600">
                    #{tag}
                  </span>
                ))}
              </div>
            </div>

            <div className="mt-6">
              <h4 className="text-sm font-semibold text-stone-900 dark:text-white mb-3">Hablantes</h4>
              <div className="space-y-2">
                {[...new Set(analysis.transcript.map(t => t.speaker))].map((speaker, idx) => (
                  <div key={idx} className="flex items-center gap-2 text-sm text-stone-600 dark:text-stone-400">
                    <div className={`w-2 h-2 rounded-full ${idx === 0 ? 'bg-blue-400' : 'bg-amber-500'}`}></div>
                    {speaker}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Export Modal */}
      {showExportModal && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 dark:bg-black/70 backdrop-blur-sm p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="export-modal-title"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowExportModal(false);
          }}
        >
          <div className="bg-white dark:bg-stone-900 rounded-2xl shadow-2xl max-w-md w-full p-6 animate-in fade-in zoom-in-95 duration-200">
            <h3 id="export-modal-title" className="text-xl font-bold text-stone-900 dark:text-white mb-4">Opciones de Exportación</h3>
            <p className="text-stone-500 dark:text-stone-400 text-sm mb-6">Selecciona qué deseas incluir en tu documento.</p>

            <div className="space-y-3 mb-8">
              <label className="flex items-center gap-3 p-3 rounded-lg border border-stone-200 dark:border-stone-700 cursor-pointer hover:bg-stone-50 dark:hover:bg-stone-800">
                <input
                  type="checkbox"
                  checked={exportOpts.includeSummary}
                  onChange={e => setExportOpts({ ...exportOpts, includeSummary: e.target.checked })}
                  className="w-5 h-5 text-primary rounded focus:ring-primary"
                />
                <span className="text-stone-700 dark:text-stone-200">Resumen Ejecutivo</span>
              </label>
              <label className="flex items-center gap-3 p-3 rounded-lg border border-stone-200 dark:border-stone-700 cursor-pointer hover:bg-stone-50 dark:hover:bg-stone-800">
                <input
                  type="checkbox"
                  checked={exportOpts.includeActionItems}
                  onChange={e => setExportOpts({ ...exportOpts, includeActionItems: e.target.checked })}
                  className="w-5 h-5 text-primary rounded focus:ring-primary"
                />
                <span className="text-stone-700 dark:text-stone-200">Lista de Tareas</span>
              </label>
              <label className="flex items-center gap-3 p-3 rounded-lg border border-stone-200 dark:border-stone-700 cursor-pointer hover:bg-stone-50 dark:hover:bg-stone-800">
                <input
                  type="checkbox"
                  checked={exportOpts.includeTranscript}
                  onChange={e => setExportOpts({ ...exportOpts, includeTranscript: e.target.checked })}
                  className="w-5 h-5 text-primary rounded focus:ring-primary"
                />
                <span className="text-stone-700 dark:text-stone-200">Transcripción Completa</span>
              </label>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => setShowExportModal(false)}
                className="flex-1 min-w-[100px] px-4 py-2 text-stone-700 hover:bg-stone-100 dark:text-stone-300 dark:hover:bg-stone-800 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-stone-500/50 font-medium"
                aria-label="Cancelar exportación"
              >
                Cancelar
              </button>
              <button
                onClick={handleExportWord}
                className="flex items-center justify-center gap-2 flex-1 min-w-[100px] px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium shadow-lg shadow-green-600/20 transition-all focus:outline-none focus:ring-2 focus:ring-green-500/50"
                aria-label="Exportar como documento Word"
              >
                <FileText size={18} aria-hidden="true" />
                Word
              </button>
              <button
                onClick={handleExportPDF}
                className="flex-1 min-w-[100px] px-4 py-2 bg-primary hover:bg-primary-hover text-white rounded-lg font-medium shadow-lg shadow-primary/20 transition-all focus:outline-none focus:ring-2 focus:ring-primary/50"
                aria-label="Exportar como PDF"
              >
                PDF
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DetailView;