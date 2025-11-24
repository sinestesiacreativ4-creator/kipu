import React from 'react';
import { Loader2, Upload, CheckCircle2, AlertCircle } from 'lucide-react';

interface UploadProgressProps {
  progress: number;
  status: 'uploading' | 'success' | 'error';
  fileName?: string;
  errorMessage?: string;
}

const UploadProgress: React.FC<UploadProgressProps> = ({ 
  progress, 
  status, 
  fileName = 'audio.webm',
  errorMessage 
}) => {
  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-stone-900 rounded-2xl p-8 shadow-2xl max-w-md w-full animate-fade-in-up">
        
        {/* Status Icon */}
        <div className="flex justify-center mb-6">
          {status === 'uploading' && (
            <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
              <Loader2 size={32} className="text-primary animate-spin" />
            </div>
          )}
          {status === 'success' && (
            <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center">
              <CheckCircle2 size={32} className="text-green-600 dark:text-green-400" />
            </div>
          )}
          {status === 'error' && (
            <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center">
              <AlertCircle size={32} className="text-red-600 dark:text-red-400" />
            </div>
          )}
        </div>

        {/* Title */}
        <h3 className="text-xl font-display font-bold text-center text-stone-900 dark:text-white mb-2">
          {status === 'uploading' && 'Subiendo grabación...'}
          {status === 'success' && '¡Listo!'}
          {status === 'error' && 'Error al subir'}
        </h3>

        {/* Description */}
        <p className="text-sm text-center text-stone-500 dark:text-stone-400 mb-6">
          {status === 'uploading' && `Guardando ${fileName} en la nube`}
          {status === 'success' && 'Tu grabación se guardó correctamente'}
          {status === 'error' && (errorMessage || 'No se pudo completar la subida. Reintentando...')}
        </p>

        {/* Progress Bar */}
        {status === 'uploading' && (
          <>
            <div className="w-full bg-stone-200 dark:bg-stone-700 rounded-full h-3 overflow-hidden mb-3">
              <div 
                className="h-full bg-gradient-to-r from-primary to-orange-500 transition-all duration-300 ease-out"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="text-center text-sm font-mono font-medium text-stone-600 dark:text-stone-300">
              {progress}%
            </p>
          </>
        )}

        {/* Success checkmark animation */}
        {status === 'success' && (
          <div className="flex justify-center">
            <div className="w-20 h-1 bg-green-500 rounded-full animate-pulse"></div>
          </div>
        )}
      </div>
    </div>
  );
};

export default UploadProgress;
