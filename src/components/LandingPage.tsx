import React from 'react';
import { ArrowRight, Mic, Sparkles, FileText } from 'lucide-react';

interface LandingPageProps {
    onEnter: () => void;
}

const LandingPage: React.FC<LandingPageProps> = ({ onEnter }) => {
    return (
        <div className="min-h-screen bg-stone-950 text-stone-100 font-sans selection:bg-gold/30 relative overflow-hidden">

            {/* Background Gradients */}
            <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0 pointer-events-none">
                <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-gold/10 rounded-full blur-[120px] animate-pulse-slow" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-primary/10 rounded-full blur-[120px] animate-pulse-slow delay-1000" />
            </div>

            {/* Navbar */}
            <nav className="relative z-10 flex items-center justify-between px-6 py-6 md:px-12 max-w-7xl mx-auto">
                <div className="flex items-center gap-3">
                    <img src="/kipu_logo.png" alt="Kipu" className="h-12 w-auto" />
                    <span className="text-xl font-bold tracking-tighter text-white hidden sm:block">Kipu</span>
                </div>
                <button
                    onClick={onEnter}
                    className="px-6 py-2 rounded-full border border-stone-700 hover:border-gold/50 hover:bg-stone-900 transition-all text-sm font-medium text-stone-300 hover:text-gold"
                >
                    Iniciar Sesión
                </button>
            </nav>

            {/* Hero Section */}
            <main className="relative z-10 flex flex-col items-center justify-center min-h-[80vh] px-6 text-center max-w-5xl mx-auto">

                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-stone-900/50 border border-stone-800 backdrop-blur-md mb-8 animate-fade-in-up">
                    <Sparkles size={16} className="text-gold" />
                    <span className="text-xs md:text-sm font-medium text-stone-300">Inteligencia Artificial para Sabiduría Ancestral</span>
                </div>

                <h1 className="text-5xl md:text-7xl lg:text-8xl font-display font-bold tracking-tight mb-8 leading-[1.1] animate-fade-in-up delay-100">
                    Documenta tu <br />
                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-gold via-amber-200 to-gold">Legado Oral</span>
                </h1>

                <p className="text-lg md:text-2xl text-stone-400 max-w-2xl mb-12 leading-relaxed animate-fade-in-up delay-200">
                    Kipu transforma tus grabaciones de voz en documentos estructurados, preservando el conocimiento con la precisión de la tecnología moderna.
                </p>

                <button
                    onClick={onEnter}
                    className="group relative px-8 py-4 bg-white text-stone-950 rounded-full font-bold text-lg shadow-xl shadow-white/10 hover:shadow-white/20 hover:scale-105 transition-all duration-300 flex items-center gap-3 animate-fade-in-up delay-300"
                >
                    Comenzar Ahora
                    <ArrowRight className="group-hover:translate-x-1 transition-transform" />
                </button>

                {/* Features Grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-24 w-full animate-fade-in-up delay-500">
                    <FeatureCard
                        icon={<Mic className="text-gold" size={24} />}
                        title="Grabación Natural"
                        description="Captura historias y reuniones sin interrupciones, con calidad de estudio."
                    />
                    <FeatureCard
                        icon={<Sparkles className="text-purple-400" size={24} />}
                        title="Análisis IA"
                        description="Nuestra IA extrae puntos clave, decisiones y resúmenes automáticamente."
                    />
                    <FeatureCard
                        icon={<FileText className="text-emerald-400" size={24} />}
                        title="Archivo Vivo"
                        description="Organiza y busca en tu sabiduría acumulada al instante."
                    />
                </div>

            </main>

            {/* Footer */}
            <footer className="relative z-10 py-8 text-center text-stone-600 text-sm">
                <p>© 2025 Kipu. Preservando el futuro.</p>
            </footer>
        </div>
    );
};

const FeatureCard = ({ icon, title, description }: { icon: React.ReactNode, title: string, description: string }) => (
    <div className="p-6 rounded-2xl bg-stone-900/40 border border-stone-800 hover:border-stone-700 backdrop-blur-sm transition-all hover:-translate-y-1 text-left">
        <div className="mb-4 p-3 bg-stone-800/50 rounded-xl w-fit">{icon}</div>
        <h3 className="text-xl font-bold text-stone-200 mb-2">{title}</h3>
        <p className="text-stone-400 leading-relaxed">{description}</p>
    </div>
);

export default LandingPage;
