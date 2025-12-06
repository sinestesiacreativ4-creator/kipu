import React, { useState } from 'react';
import { api } from '../services/api';
import { Organization } from '../types';
import { ArrowRight, Loader2, Building2, Sparkles, Key, Plus } from 'lucide-react';

interface OrgLoginProps {
    onOrgSelected: (org: Organization) => void;
}

const OrgLogin: React.FC<OrgLoginProps> = ({ onOrgSelected }) => {
    const [slug, setSlug] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [mode, setMode] = useState<'login' | 'create'>('login');
    const [newOrgName, setNewOrgName] = useState('');

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

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newOrgName.trim()) return;

        setIsLoading(true);
        setError(null);

        try {
            const slugGenerated = newOrgName.toLowerCase()
                .normalize('NFD')
                .replace(/[\u0300-\u036f]/g, '')
                .replace(/[^a-z0-9]/g, '-')
                .replace(/-+/g, '-')
                .replace(/^-|-$/g, '')
                .substring(0, 20) || `org-${Date.now()}`;

            const org = await api.createOrganization(newOrgName.trim(), slugGenerated);
            onOrgSelected(org);
        } catch (err) {
            console.error(err);
            setError('Error al crear la organización.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-bone via-stone-50 to-stone-100 dark:from-stone-950 dark:via-stone-900 dark:to-stone-950 p-4 relative overflow-hidden">
            {/* Decorative Background */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute -top-40 -right-40 w-80 h-80 bg-primary/10 rounded-full blur-3xl animate-pulse-soft" />
                <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-gold/10 rounded-full blur-3xl animate-pulse-soft" style={{ animationDelay: '1s' }} />
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-gradient-radial from-primary/5 to-transparent rounded-full blur-2xl" />
            </div>

            <div className="w-full max-w-md relative z-10">
                {/* Logo Card */}
                <div className="text-center mb-8 animate-fade-in">
                    <div className="inline-flex items-center justify-center bg-white dark:bg-stone-900 rounded-3xl p-8 shadow-2xl border border-stone-200 dark:border-stone-800 mb-6">
                        <img src="/kipu_logo.png" alt="Kipu Logo" className="h-20 w-auto object-contain" />
                    </div>
                    <div className="flex items-center justify-center gap-2 mb-3">
                        <h1 className="text-3xl font-bold tracking-tight text-stone-900 dark:text-white">
                            Bienvenido a Kipu
                        </h1>
                        <Sparkles className="text-gold animate-pulse-soft" size={24} />
                    </div>
                    <p className="text-stone-600 dark:text-stone-400">
                        Documentación inteligente para asesores étnicos
                    </p>
                </div>

                {/* Main Card */}
                <div className="bg-white dark:bg-stone-900 rounded-3xl shadow-2xl border border-stone-200 dark:border-stone-800 overflow-hidden animate-slide-up">
                    {/* Tab Switcher */}
                    <div className="flex border-b border-stone-100 dark:border-stone-800">
                        <button
                            onClick={() => { setMode('login'); setError(null); }}
                            className={`flex-1 py-4 px-4 text-sm font-semibold transition-all flex items-center justify-center gap-2 ${mode === 'login'
                                    ? 'text-primary bg-primary/5 border-b-2 border-primary'
                                    : 'text-stone-500 hover:text-stone-700 dark:hover:text-stone-300'
                                }`}
                        >
                            <Key size={18} />
                            Ingresar con Código
                        </button>
                        <button
                            onClick={() => { setMode('create'); setError(null); }}
                            className={`flex-1 py-4 px-4 text-sm font-semibold transition-all flex items-center justify-center gap-2 ${mode === 'create'
                                    ? 'text-primary bg-primary/5 border-b-2 border-primary'
                                    : 'text-stone-500 hover:text-stone-700 dark:hover:text-stone-300'
                                }`}
                        >
                            <Plus size={18} />
                            Crear Organización
                        </button>
                    </div>

                    <div className="p-8">
                        {mode === 'login' ? (
                            <form onSubmit={handleSubmit} className="space-y-6">
                                <div>
                                    <label htmlFor="org-code" className="block text-sm font-semibold text-stone-700 dark:text-stone-300 mb-3">
                                        Código de Organización
                                    </label>
                                    <input
                                        id="org-code"
                                        type="text"
                                        value={slug}
                                        onChange={(e) => setSlug(e.target.value)}
                                        placeholder="ej. asesorias"
                                        className="input-field font-mono text-center text-lg uppercase tracking-widest"
                                        autoFocus
                                    />
                                    {error && (
                                        <p className="mt-3 text-sm text-red-500 font-medium flex items-center gap-2 animate-fade-in">
                                            <span className="w-1.5 h-1.5 bg-red-500 rounded-full" />
                                            {error}
                                        </p>
                                    )}
                                </div>

                                <button
                                    type="submit"
                                    disabled={isLoading || !slug.trim()}
                                    className="btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
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
                        ) : (
                            <form onSubmit={handleCreate} className="space-y-6">
                                <div>
                                    <label htmlFor="org-name" className="block text-sm font-semibold text-stone-700 dark:text-stone-300 mb-3">
                                        Nombre de tu Organización
                                    </label>
                                    <input
                                        id="org-name"
                                        type="text"
                                        value={newOrgName}
                                        onChange={(e) => setNewOrgName(e.target.value)}
                                        placeholder="Ej. Asesorías Mapuche"
                                        className="input-field"
                                        autoFocus
                                    />
                                    {error && (
                                        <p className="mt-3 text-sm text-red-500 font-medium flex items-center gap-2 animate-fade-in">
                                            <span className="w-1.5 h-1.5 bg-red-500 rounded-full" />
                                            {error}
                                        </p>
                                    )}
                                </div>

                                <button
                                    type="submit"
                                    disabled={isLoading || !newOrgName.trim()}
                                    className="btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {isLoading ? (
                                        <>
                                            <Loader2 size={20} className="animate-spin" />
                                            Creando...
                                        </>
                                    ) : (
                                        <>
                                            <Building2 size={20} />
                                            Crear Organización
                                        </>
                                    )}
                                </button>
                            </form>
                        )}
                    </div>
                </div>

                {/* Footer */}
                <div className="mt-8 text-center animate-fade-in" style={{ animationDelay: '0.3s' }}>
                    <p className="text-xs text-stone-400 dark:text-stone-500">
                        ¿Necesitas ayuda? Contacta a tu administrador de sistema
                    </p>
                    <div className="mt-4 flex items-center justify-center gap-3">
                        <span className="px-3 py-1 bg-primary/10 text-primary text-xs font-bold rounded-full">
                            BETA
                        </span>
                        <span className="text-xs text-stone-400">v3.0.0</span>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default OrgLogin;
