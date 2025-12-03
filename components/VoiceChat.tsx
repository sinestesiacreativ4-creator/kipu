import React, { useState } from 'react';
import { Mic, MessageSquare } from 'lucide-react';

interface VoiceChatProps {
    recordingId: string;
}

const VoiceChat: React.FC<VoiceChatProps> = ({ recordingId }) => {
    const [showInfo, setShowInfo] = useState(true);

    const switchToChat = () => {
        // Find and click the chat tab
        const tabs = document.querySelectorAll('button');
        tabs.forEach(tab => {
            if (tab.textContent?.includes('Chat AI')) {
                tab.click();
            }
        });
    };

    return (
        <div className="flex flex-col items-center justify-center p-12 bg-gradient-to-br from-primary/5 to-secondary/5 rounded-2xl border-2 border-dashed border-stone-200 dark:border-stone-700">
            {/* Coming Soon Badge */}
            <div className="mb-6 px-4 py-2 bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-200 text-sm font-bold rounded-full border border-amber-200 dark:border-amber-800">
                🚧 Próximamente
            </div>

            {/* Icon */}
            <div className="w-32 h-32 rounded-full bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center mb-6">
                <Mic size={64} className="text-primary" />
            </div>

            {/* Title */}
            <h3 className="text-2xl font-bold text-stone-800 dark:text-white mb-3">
                Asistente de Voz
            </h3>

            {/* Description */}
            <p className="text-center text-stone-600 dark:text-stone-400 mb-6 max-w-md">
                La funcionalidad de voz está en desarrollo. Requiere configuración adicional del servidor y acceso a Gemini Live API.
            </p>

            {/* Info Box */}
            {showInfo && (
                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4 mb-6 max-w-md">
                    <div className="flex items-start gap-3">
                        <div className="text-blue-600 dark:text-blue-400 mt-0.5">
                            💡
                        </div>
                        <div className="flex-1">
                            <h4 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">
                                Usa el Chat AI mientras tanto
                            </h4>
                            <p className="text-sm text-blue-800 dark:text-blue-200 mb-3">
                                El Chat AI tiene las mismas capacidades y está completamente funcional. Puedes hacer las mismas preguntas sobre tu reunión.
                            </p>
                            <button
                                onClick={switchToChat}
                                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
                            >
                                <MessageSquare size={16} />
                                Ir al Chat AI
                            </button>
                        </div>
                        <button
                            onClick={() => setShowInfo(false)}
                            className="text-blue-400 hover:text-blue-600 dark:text-blue-500 dark:hover:text-blue-300"
                        >
                            ✕
                        </button>
                    </div>
                </div>
            )}

            {/* Features List */}
            <div className="bg-white dark:bg-stone-800 rounded-xl p-6 border border-stone-200 dark:border-stone-700 max-w-md">
                <h4 className="font-semibold text-stone-900 dark:text-white mb-4">
                    Características planeadas:
                </h4>
                <ul className="space-y-3 text-sm text-stone-600 dark:text-stone-400">
                    <li className="flex items-start gap-2">
                        <span className="text-green-500 mt-0.5">✓</span>
                        <span>Conversación en tiempo real con latencia baja</span>
                    </li>
                    <li className="flex items-start gap-2">
                        <span className="text-green-500 mt-0.5">✓</span>
                        <span>Voz natural y expresiva en español</span>
                    </li>
                    <li className="flex items-start gap-2">
                        <span className="text-green-500 mt-0.5">✓</span>
                        <span>Interrupciones naturales durante la conversación</span>
                    </li>
                    <li className="flex items-start gap-2">
                        <span className="text-green-500 mt-0.5">✓</span>
                        <span>Acceso completo al contexto de la reunión</span>
                    </li>
                </ul>
            </div>

            {/* Technical Note */}
            <p className="text-xs text-stone-500 dark:text-stone-500 mt-6 text-center max-w-md">
                Esta función requiere Gemini Live API (actualmente en preview) y configuración adicional del servidor WebSocket.
            </p>
        </div>
    );
};

export default VoiceChat;
