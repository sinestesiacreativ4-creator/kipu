import React, { useState, useRef } from 'react';
import { ArrowLeft, List, Download, Folder, CheckCircle2, RefreshCw, MessageSquare, FileText } from 'lucide-react';
import MeetingChat from './MeetingChat';
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
  const [activeTab, setActiveTab] = useState<'summary' | 'transcript' | 'chat'>('summary');
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
      <header className="mb-8 no-print">
        <button
          onClick={onBack}
          className="flex items-center text-stone-500 hover:text-primary dark:text-stone-400 dark:hover:text-white mb-6 transition-colors font-medium"
        >
          <ArrowLeft size={20} className="mr-2" /> Volver al Inicio
        </button>
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
          <div>
            <h1 className="text-4xl font-display font-bold text-stone-900 dark:text-white mb-3 leading-tight">{analysis.title}</h1>
            <div className="flex flex-wrap items-center gap-3 text-sm text-stone-500 dark:text-stone-400">
              <span className="flex items-center gap-1.5 px-2.5 py-1 bg-stone-100 dark:bg-stone-800 rounded-full font-medium"><Folder size={14} /> {analysis.category}</span>
              <span className="hidden md:inline text-stone-300">•</span>
              <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 bg-stone-400 rounded-full"></span> {new Date(createdAt).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
              <span className="hidden md:inline text-stone-300">•</span>
              <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 bg-stone-400 rounded-full"></span> {formatTime(duration)}</span>
            </div>
          </div>
          <div className="flex gap-3">
            {(recording.status === RecordingStatus.OFFLINE || analysis?.title?.includes('Modo Offline')) && onReanalyze && (
              <button
                onClick={handleReanalyze}
                disabled={isReanalyzing}
                className="flex items-center gap-2 px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl shadow-lg shadow-amber-500/20 transition-all hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
              >
                <RefreshCw size={18} className={isReanalyzing ? 'animate-spin' : ''} />
                {isReanalyzing ? 'Analizando...' : 'Re-analizar'}
              </button>
            )}
            <button
              onClick={() => setShowExportModal(true)}
              className="flex items-center gap-2 px-5 py-2.5 bg-secondary hover:bg-green-800 text-white rounded-xl shadow-lg shadow-secondary/20 transition-all hover:-translate-y-0.5 font-medium"
            >
              <Download size={18} /> Exportar
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
          <div className="flex p-1 bg-stone-100 dark:bg-stone-800/50 rounded-xl no-print mb-6">
            <button
              onClick={() => setActiveTab('summary')}
              className={`flex-1 px-6 py-2.5 text-sm font-medium rounded-lg transition-all duration-200 ${activeTab === 'summary'
                ? 'bg-white dark:bg-stone-700 text-primary shadow-sm'
                : 'text-stone-500 hover:text-stone-700 dark:text-stone-400 dark:hover:text-stone-200'
                }`}
            >
              Resumen Inteligente
            </button>
            <button
              onClick={() => setActiveTab('transcript')}
              className={`flex-1 px-6 py-2.5 text-sm font-medium rounded-lg transition-all duration-200 ${activeTab === 'transcript'
                ? 'bg-white dark:bg-stone-700 text-primary shadow-sm'
                : 'text-stone-500 hover:text-stone-700 dark:text-stone-400 dark:hover:text-stone-200'
                }`}
            >
              Transcripción Completa
            </button>
            <button
              onClick={() => setActiveTab('chat')}
              className={`flex-1 px-6 py-2.5 text-sm font-medium rounded-lg transition-all duration-200 ${activeTab === 'chat'
                ? 'bg-white dark:bg-stone-700 text-primary shadow-sm'
                : 'text-stone-500 hover:text-stone-700 dark:text-stone-400 dark:hover:text-stone-200'
                }`}
            >
              <div className="flex items-center justify-center gap-2">
                <MessageSquare size={16} />
                Chat AI
              </div>
            </button>
          </div>

          {/* Summary Tab Content */}
          <div className={`${activeTab === 'summary' ? 'block' : 'hidden'} print:block space-y-8 animate-fade-in`}>

            <section className="glass-card p-8 rounded-2xl">
              <h3 className="flex items-center gap-2 text-lg font-semibold text-stone-900 dark:text-white mb-4">
                <List className="text-secondary" size={20} /> Puntos Clave
              </h3>
              <ul className="space-y-3">
                {analysis.summary.map((point, idx) => (
                  <li key={idx} className="flex items-start gap-3 text-stone-700 dark:text-stone-300 leading-relaxed">
                    <span className="mt-1.5 w-1.5 h-1.5 bg-primary rounded-full flex-shrink-0"></span>
                    {point}
                  </li>
                ))}
              </ul>
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
          <div className={`${activeTab === 'transcript' ? 'block' : 'hidden'} print:block animate-fade-in`}>
            <div className="bg-white dark:bg-stone-800 rounded-xl shadow-sm border border-stone-100 dark:border-stone-700 divide-y divide-stone-100 dark:divide-stone-700">
              {analysis.transcript.map((segment, idx) => (
                <div key={idx} className="p-4 hover:bg-stone-50 dark:hover:bg-stone-700/30 transition-colors group">
                  <div className="flex justify-between items-baseline mb-1">
                    <span className="font-semibold text-sm text-secondary">{segment.speaker}</span>
                    <span className="text-xs text-stone-400 font-mono group-hover:text-stone-600">{segment.timestamp}</span>
                  </div>
                  <p className="text-stone-700 dark:text-stone-300 leading-relaxed">{segment.text}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Chat Tab Content */}
          <div className={`${activeTab === 'chat' ? 'block' : 'hidden'} print:hidden animate-fade-in`}>
            <MeetingChat analysis={analysis} />
          </div>

        </div>

        {/* Sidebar / Sticky Player */}
        <div className="lg:col-span-1 space-y-6">
          {/* Audio Player */}
          <div className="sticky top-6 bg-white dark:bg-stone-800 p-6 rounded-xl shadow-lg border border-stone-100 dark:border-stone-700 no-print">
            <h3 className="text-sm font-semibold text-stone-500 dark:text-stone-400 uppercase tracking-wider mb-4">Grabación</h3>
            {audioBase64 && (
              <audio
                ref={audioRef}
                controls
                className="w-full mb-4 accent-primary"
                src={`data:audio/webm;base64,${audioBase64}`}
              />
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-stone-900 rounded-2xl shadow-2xl max-w-md w-full p-6 animate-in fade-in zoom-in-95 duration-200">
            <h3 className="text-xl font-bold text-stone-900 dark:text-white mb-4">Opciones de Exportación</h3>
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

            <div className="flex gap-3">
              <button
                onClick={() => setShowExportModal(false)}
                className="flex-1 px-4 py-2 text-stone-600 hover:bg-stone-100 dark:text-stone-300 dark:hover:bg-stone-800 rounded-lg transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleExportWord}
                className="flex items-center justify-center gap-2 flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium shadow-lg shadow-green-600/20 transition-all"
              >
                <FileText size={18} />
                Word
              </button>
              <button
                onClick={handleExportPDF}
                className="flex-1 px-4 py-2 bg-primary hover:bg-primary-hover text-white rounded-lg font-medium shadow-lg shadow-primary/20 transition-all"
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