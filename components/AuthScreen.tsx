import React, { useState } from 'react';

interface AuthScreenProps {
    onSignIn: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
    onSignUp: (email: string, password: string, orgName: string, fullName?: string) => Promise<{ success: boolean; error?: string }>;
    onSignInWithGoogle: () => Promise<{ success: boolean; error?: string }>;
}

const AuthScreen: React.FC<AuthScreenProps> = ({ onSignInWithGoogle }) => {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleGoogleSignIn = async () => {
        setError('');
        setLoading(true);
        const result = await onSignInWithGoogle();
        if (!result.success && result.error) {
            setError(result.error);
        }
        setLoading(false);
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-bone dark:bg-stone-950 p-6">
            <div className="max-w-md w-full">
                {/* Header */}
                <div className="text-center mb-8">
                    <h1 className="text-4xl font-bold text-stone-900 dark:text-white mb-2 tracking-tight">
                        Asesorías <span className="text-primary">Étnicas</span>
                    </h1>
                    <p className="text-stone-600 dark:text-stone-400">
                        Ingresa con tu cuenta de Google
                    </p>
                </div>

                {/* Form Card */}
                <div className="bg-white dark:bg-stone-900 p-8 rounded-2xl shadow-xl border border-stone-200 dark:border-stone-800">
                    {error && (
                        <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-600 dark:text-red-400 text-sm break-words mb-4">
                            <strong>Error:</strong> {error}
                        </div>
                    )}

                    {/* Google Sign In Button */}
                    <button
                        type="button"
                        onClick={handleGoogleSignIn}
                        disabled={loading}
                        className="w-full flex items-center justify-center gap-3 px-4 py-4 bg-white dark:bg-stone-800 border-2 border-stone-300 dark:border-stone-700 hover:border-primary dark:hover:border-primary text-stone-700 dark:text-stone-200 rounded-lg font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-md hover:shadow-lg"
                    >
                        <svg className="w-6 h-6" viewBox="0 0 24 24">
                            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                        </svg>
                        {loading ? 'Conectando...' : 'Continuar con Google'}
                    </button>

                    <p className="text-xs text-stone-500 dark:text-stone-400 text-center mt-6">
                        Al continuar, aceptas los términos de servicio y la política de privacidad.
                    </p>
                </div>
            </div>
        </div>
    );
};

export default AuthScreen;
