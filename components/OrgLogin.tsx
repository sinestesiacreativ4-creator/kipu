import React, { useState } from 'react';
import { api } from '../services/api';
import { Organization } from '../types';
import { ArrowRight, Loader2 } from 'lucide-react';

interface OrgLoginProps {
    onOrgSelected: (org: Organization) => void;
}

const OrgLogin: React.FC<OrgLoginProps> = ({ onOrgSelected }) => {
    const [slug, setSlug] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!slug.trim()) return;

        setIsLoading(true);
        setError(null);

        try {
            const org = await api.getOrganizationBySlug(slug.toLowerCase().trim());

            if (org) {
                onOrgSelected(org);
            } else {
                setError('No encontramos una organización con ese código.');
            }
        } catch (err) {
            console.error(err);
            setError('Ocurrió un error al buscar la organización.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-bone dark:bg-darkbg text-stone-800 dark:text-stone-200 p-4 transition-colors duration-200">
            <div className="w-full max-w-md bg-white dark:bg-stone-900 rounded-2xl shadow-xl p-8 border border-stone-200 dark:border-stone-800 animate-fade-in">
                <div className="flex flex-col items-center mb-8">
                    <div className="bg-stone-50 dark:bg-stone-800 rounded-3xl flex items-center justify-center mb-8 shadow-inner p-8">
                        <img src="/kipu_logo.png" alt="Kipu Logo" className="h-24 w-auto object-contain" />
                    </div>
                    <h1 className="text-2xl font-bold tracking-tight text-center">Bienvenido a Kipu</h1>
                    <p className="text-stone-500 dark:text-stone-400 text-center mt-2">
                        Ingresa el código de tu organización para continuar
                    </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                    <div>
                        <label htmlFor="org-code" className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-2">
                            Código de Organización
                        </label>
                        <div className="relative">
                            <input
                                id="org-code"
                                type="text"
                                value={slug}
                                onChange={(e) => setSlug(e.target.value)}
                                placeholder="ej. asesorias"
                                className="w-full px-4 py-3 bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all font-mono text-center text-lg uppercase tracking-wider"
                                autoFocus
                            />
                        </div>
                        {error && (
                            <p className="mt-2 text-sm text-red-500 font-medium animate-shake">
                                {error}
                            </p>
                        )}
                    </div>

                    <button
                        type="submit"
                        disabled={isLoading || !slug.trim()}
                        className="w-full py-3 px-4 bg-primary hover:bg-primary-hover text-white font-bold rounded-xl transition-all shadow-lg shadow-primary/20 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isLoading ? (
                            <>
                                <Loader2 size={20} className="animate-spin" />
                                Buscando...
                            </>
                        ) : (
                            <>
                                Ingresar
                                <ArrowRight size={20} />
                            </>
                        )}
                    </button>
                </form>

                <div className="mt-8 text-center">
                    <p className="text-xs text-stone-400">
                        ¿No tienes un código? Contacta al administrador de tu sistema.
                    </p>
                </div>
            </div>
        </div>
    );
};

export default OrgLogin;
