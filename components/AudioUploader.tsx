import React, { useState, useRef, useCallback } from 'react';
import { Upload, FileAudio, X, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';

interface AudioUploaderProps {
  onFileUpload: (file: File) => void;
  maxSizeMB?: number;
  acceptedFormats?: string[];
}

const AudioUploader: React.FC<AudioUploaderProps> = ({
  onFileUpload,
  maxSizeMB = 500, // 500MB default
  acceptedFormats = ['audio/*', 'video/*', '.mp3', '.wav', '.m4a', '.webm', '.ogg', '.aac', '.flac']
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const validateFile = (file: File): { valid: boolean; error?: string } => {
    // Check file size
    const maxSizeBytes = maxSizeMB * 1024 * 1024;
    if (file.size > maxSizeBytes) {
      return {
        valid: false,
        error: `El archivo es demasiado grande. Tamaño máximo: ${maxSizeMB}MB`
      };
    }

    // Check file type
    const isValidType = acceptedFormats.some(format => {
      if (format.includes('*')) {
        const baseType = format.split('/')[0];
        return file.type.startsWith(baseType);
      }
      return file.type.includes(format.replace('.', '')) || file.name.toLowerCase().endsWith(format);
    });

    if (!isValidType) {
      return {
        valid: false,
        error: `Formato no soportado. Formatos aceptados: ${acceptedFormats.join(', ')}`
      };
    }

    return { valid: true };
  };

  const handleFile = useCallback((file: File) => {
    const validation = validateFile(file);
    
    if (!validation.valid) {
      setErrorMessage(validation.error || 'Archivo inválido');
      setUploadStatus('error');
      setTimeout(() => {
        setUploadStatus('idle');
        setErrorMessage('');
      }, 3000);
      return;
    }

    setSelectedFile(file);
    setUploadStatus('uploading');
    setErrorMessage('');

    try {
      onFileUpload(file);
      setUploadStatus('success');
      setTimeout(() => {
        setUploadStatus('idle');
        setSelectedFile(null);
      }, 2000);
    } catch (error: any) {
      setErrorMessage(error.message || 'Error al subir el archivo');
      setUploadStatus('error');
      setTimeout(() => {
        setUploadStatus('idle');
        setErrorMessage('');
        setSelectedFile(null);
      }, 3000);
    }
  }, [onFileUpload, maxSizeMB, acceptedFormats]);

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      handleFile(files[0]); // Only handle first file
    }
  }, [handleFile]);

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFile(files[0]);
    }
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  return (
    <div className="w-full">
      {/* Hidden file input */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileInputChange}
        accept={acceptedFormats.join(',')}
        className="hidden"
        aria-label="Subir archivo de audio"
      />

      {/* Upload Area */}
      <div
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`
          relative border-2 border-dashed rounded-2xl p-8 md:p-12
          transition-all duration-200 cursor-pointer
          ${isDragging
            ? 'border-primary bg-primary/10 scale-[1.02]'
            : 'border-stone-300 dark:border-stone-600 hover:border-primary/50 hover:bg-stone-50 dark:hover:bg-stone-800/50'
          }
          ${uploadStatus === 'uploading' ? 'pointer-events-none opacity-75' : ''}
        `}
        role="button"
        tabIndex={0}
        aria-label="Área de subida de archivos"
      >
        {/* Background Pattern */}
        <div className="absolute inset-0 opacity-5 pointer-events-none">
          <div className="absolute inset-0" style={{
            backgroundImage: 'radial-gradient(circle, currentColor 1px, transparent 1px)',
            backgroundSize: '20px 20px'
          }} />
        </div>

        <div className="relative z-10 flex flex-col items-center justify-center text-center">
          {/* Icon */}
          <div className={`
            mb-4 p-4 rounded-full transition-all
            ${isDragging || uploadStatus === 'uploading'
              ? 'bg-primary/20 text-primary'
              : 'bg-stone-100 dark:bg-stone-700 text-stone-600 dark:text-stone-400'
            }
          `}>
            {uploadStatus === 'uploading' ? (
              <Loader2 size={32} className="animate-spin" />
            ) : uploadStatus === 'success' ? (
              <CheckCircle2 size={32} className="text-green-600 dark:text-green-400" />
            ) : uploadStatus === 'error' ? (
              <AlertCircle size={32} className="text-red-600 dark:text-red-400" />
            ) : (
              <Upload size={32} />
            )}
          </div>

          {/* Text */}
          <h3 className="text-xl font-bold text-stone-900 dark:text-white mb-2">
            {uploadStatus === 'uploading' && 'Subiendo archivo...'}
            {uploadStatus === 'success' && '¡Archivo subido!'}
            {uploadStatus === 'error' && 'Error al subir'}
            {uploadStatus === 'idle' && (
              <>
                {isDragging ? 'Suelta el archivo aquí' : 'Arrastra y suelta tu audio aquí'}
              </>
            )}
          </h3>

          <p className="text-sm text-stone-500 dark:text-stone-400 mb-4">
            {uploadStatus === 'idle' && (
              <>
                o <span className="text-primary font-semibold">haz clic para seleccionar</span>
              </>
            )}
            {uploadStatus === 'uploading' && selectedFile && (
              <>Subiendo: {selectedFile.name}</>
            )}
            {uploadStatus === 'success' && 'El archivo se está procesando'}
            {uploadStatus === 'error' && errorMessage}
          </p>

          {/* File Info */}
          {selectedFile && uploadStatus !== 'error' && (
            <div className="mt-4 p-3 bg-stone-100 dark:bg-stone-800 rounded-lg flex items-center gap-3 max-w-md w-full">
              <FileAudio size={20} className="text-primary flex-shrink-0" />
              <div className="flex-1 min-w-0 text-left">
                <p className="text-sm font-medium text-stone-900 dark:text-white truncate">
                  {selectedFile.name}
                </p>
                <p className="text-xs text-stone-500 dark:text-stone-400">
                  {formatFileSize(selectedFile.size)}
                </p>
              </div>
              {uploadStatus === 'idle' && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedFile(null);
                  }}
                  className="p-1 hover:bg-stone-200 dark:hover:bg-stone-700 rounded transition-colors"
                  aria-label="Eliminar archivo seleccionado"
                >
                  <X size={16} className="text-stone-500" />
                </button>
              )}
            </div>
          )}

          {/* Format Info */}
          {uploadStatus === 'idle' && (
            <div className="mt-4 text-xs text-stone-400 dark:text-stone-500">
              Formatos: MP3, WAV, M4A, WEBM, OGG, AAC, FLAC
              <br />
              Tamaño máximo: {maxSizeMB}MB
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AudioUploader;

