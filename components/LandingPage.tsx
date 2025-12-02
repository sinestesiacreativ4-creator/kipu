import React from 'react';
import { ArrowRight, Mic, Sparkles, FileText, Users, Shield, Clock, CheckCircle2, Zap } from 'lucide-react';

interface LandingPageProps {
    onEnter: () => void;
}

const LandingPage: React.FC<LandingPageProps> = ({ onEnter }) => {
    return (
        <div className="min-h-screen bg-white text-stone-800 font-sans selection:bg-blue-100 relative overflow-hidden">

            {/* Background - Solid earth tones */}
            <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0 pointer-events-none">
                <div className="absolute top-0 left-0 w-full h-1/2 bg-gradient-to-b from-amber-50/40 to-transparent" />
                <div className="absolute bottom-0 right-0 w-full h-1/2 bg-gradient-to-t from-orange-50/30 to-transparent" />
            </div>

            {/* Navbar */}
            <nav className="relative z-10 flex items-center justify-between px-6 py-6 md:px-12 max-w-7xl mx-auto sticky top-0 bg-white/80 backdrop-blur-md border-b border-stone-200">
                <div className="flex items-center">
                    <img src="/kipu_logo.png" alt="Kipu" className="h-12 w-auto" />
                </div>
                <div className="flex items-center gap-6">
                    <a href="#caracteristicas" className="text-sm font-medium text-stone-600 hover:text-blue-600 transition-colors hidden md:block">Características</a>
                    <a href="#como-funciona" className="text-sm font-medium text-stone-600 hover:text-blue-600 transition-colors hidden md:block">Cómo Funciona</a>
                    <a href="#casos" className="text-sm font-medium text-stone-600 hover:text-blue-600 transition-colors hidden md:block">Casos de Uso</a>
                    <button
                        onClick={onEnter}
                        className="px-6 py-2 rounded-full border-2 border-blue-600 hover:bg-blue-600 hover:text-white transition-all text-sm font-semibold text-blue-600"
                    >
                        Iniciar Sesión
                    </button>
                </div>
            </nav>

            {/* Hero Section */}
            <section className="relative z-10 flex flex-col items-center justify-center min-h-[85vh] px-6 text-center max-w-5xl mx-auto">

                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-50 border border-blue-200 mb-8 animate-fade-in-up">
                    <Sparkles size={16} className="text-blue-600" />
                    <span className="text-xs md:text-sm font-semibold text-blue-800">Inteligencia Artificial para tu Gestión de Conocimiento</span>
                </div>

                <h1 className="text-5xl md:text-7xl lg:text-8xl font-display font-bold tracking-tight mb-8 leading-[1.1] animate-fade-in-up delay-100 text-stone-900">
                    Transforma Audio en <br />
                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-700 via-orange-600 to-red-700">Conocimiento Estructurado</span>
                </h1>

                <p className="text-lg md:text-2xl text-stone-600 max-w-2xl mb-12 leading-relaxed animate-fade-in-up delay-200">
                    Convierte tus reuniones y grabaciones en documentos accionables con resúmenes, tareas y decisiones automáticas.
                </p>

                <button
                    onClick={onEnter}
                    className="group relative px-8 py-4 bg-blue-600 text-white rounded-full font-bold text-lg shadow-xl shadow-blue-600/20 hover:shadow-blue-600/40 hover:scale-105 hover:bg-blue-700 transition-all duration-300 flex items-center gap-3 animate-fade-in-up delay-300"
                >
                    Comenzar Ahora
                    <ArrowRight className="group-hover:translate-x-1 transition-transform" />
                </button>

                {/* Stats */}
                <div className="grid grid-cols-3 gap-8 mt-20 w-full max-w-3xl animate-fade-in-up delay-400">
                    <div className="text-center">
                        <div className="text-3xl md:text-4xl font-bold text-blue-600 mb-2">40x</div>
                        <div className="text-sm text-stone-500">Más Rápido</div>
                    </div>
                    <div className="text-center">
                        <div className="text-3xl md:text-4xl font-bold text-amber-700 mb-2">95%</div>
                        <div className="text-sm text-stone-500">Precisión IA</div>
                    </div>
                    <div className="text-center">
                        <div className="text-3xl md:text-4xl font-bold text-orange-700 mb-2">24/7</div>
                        <div className="text-sm text-stone-500">Disponible</div>
                    </div>
                </div>
            </section>

            {/* Features Section */}
            <section id="caracteristicas" className="relative z-10 py-24 px-6 bg-gradient-to-b from-stone-50 to-white">
                <div className="max-w-7xl mx-auto">
                    <div className="text-center mb-16">
                        <h2 className="text-4xl md:text-5xl font-bold text-stone-900 mb-4">Características Principales</h2>
                        <p className="text-xl text-stone-600 max-w-2xl mx-auto">
                            Tecnología empresarial para optimizar tu productividad
                        </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                        <FeatureCard
                            icon={<Mic className="text-amber-700" size={28} />}
                            title="Grabación Profesional"
                            description="Captura reuniones y llamadas sin interrupciones. Compatible con grabaciones de hasta 4 horas de duración."
                        />
                        <FeatureCard
                            icon={<Sparkles className="text-blue-600" size={28} />}
                            title="Análisis IA"
                            description="Nuestra IA extrae resúmenes ejecutivos, decisiones, tareas y transcripciones completas automáticamente."
                        />
                        <FeatureCard
                            icon={<FileText className="text-orange-700" size={28} />}
                            title="Gestión Documental"
                            description="Organiza, busca y exporta tu conocimiento corporativo al instante en múltiples formatos."
                        />
                        <FeatureCard
                            icon={<Users className="text-purple-600" size={28} />}
                            title="Colaborativo"
                            description="Perfiles múltiples por organización. Ideal para equipos, empresas y consultorías."
                        />
                        <FeatureCard
                            icon={<Shield className="text-green-600" size={28} />}
                            title="Seguridad Empresarial"
                            description="Tus datos están protegidos con encriptación de nivel empresarial. Tu información, tu control."
                        />
                        <FeatureCard
                            icon={<Zap className="text-yellow-600" size={28} />}
                            title="Procesamiento Rápido"
                            description="Resultados en minutos, no horas. Optimizado para archivos largos con chunking inteligente."
                        />
                    </div>
                </div>
            </section>

            {/* How It Works Section */}
            <section id="como-funciona" className="relative z-10 py-24 px-6">
                <div className="max-w-6xl mx-auto">
                    <div className="text-center mb-16">
                        <h2 className="text-4xl md:text-5xl font-bold text-stone-900 mb-4">¿Cómo Funciona?</h2>
                        <p className="text-xl text-stone-600">
                            Tres pasos simples para transformar audio en acción
                        </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                        <ProcessStep
                            number={1}
                            title="Graba o Sube"
                            description="Graba directamente desde la app o sube archivos de audio existentes. Soporta múltiples formatos."
                            color="amber"
                        />
                        <ProcessStep
                            number={2}
                            title="IA Procesa"
                            description="Nuestra IA analiza, transcribe y extrae información clave: resúmenes, decisiones, tareas y más."
                            color="blue"
                        />
                        <ProcessStep
                            number={3}
                            title="Organiza y Exporta"
                            description="Accede a tu archivo digital, busca, filtra y exporta en PDF o Word cuando lo necesites."
                            color="orange"
                        />
                    </div>
                </div>
            </section>

            {/* Use Cases Section */}
            <section id="casos" className="relative z-10 py-24 px-6 bg-gradient-to-b from-amber-50/30 to-white">
                <div className="max-w-6xl mx-auto">
                    <div className="text-center mb-16">
                        <h2 className="text-4xl md:text-5xl font-bold text-stone-900 mb-4">Casos de Uso</h2>
                        <p className="text-xl text-stone-600">
                            Ideal para diferentes áreas de tu organización
                        </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <UseCaseCard
                            title="Juntas Directivas"
                            description="Documenta reuniones ejecutivas, acuerdos estratégicos y decisiones de alto nivel con transcripciones completas."
                            icon="🏢"
                        />
                        <UseCaseCard
                            title="Sesiones de Capacitación"
                            description="Captura y documenta talleres, formaciones y transferencia de conocimiento para tu equipo."
                            icon="🎓"
                        />
                        <UseCaseCard
                            title="Project Management"
                            description="Extrae automáticamente tareas, responsables y acuerdos de reuniones de proyecto y equipos."
                            icon="📊"
                        />
                        <UseCaseCard
                            title="Atención al Cliente"
                            description="Transcribe y analiza llamadas con clientes para mejorar servicio y detectar insights clave."
                            icon="📞"
                        />
                    </div>
                </div>
            </section>

            {/* CTA Section */}
            <section className="relative z-10 py-24 px-6">
                <div className="max-w-4xl mx-auto text-center bg-gradient-to-br from-blue-600 to-blue-800 rounded-3xl p-12 md:p-16 shadow-2xl">
                    <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">
                        Optimiza tu Gestión de Conocimiento Hoy
                    </h2>
                    <p className="text-xl text-blue-100 mb-8 max-w-2xl mx-auto">
                        Únete a organizaciones que ya están optimizando su productividad con Kipu
                    </p>
                    <button
                        onClick={onEnter}
                        className="group px-10 py-5 bg-white text-blue-600 rounded-full font-bold text-lg shadow-xl hover:shadow-2xl hover:scale-105 transition-all duration-300 inline-flex items-center gap-3"
                    >
                        Empezar Gratis
                        <ArrowRight className="group-hover:translate-x-1 transition-transform" size={24} />
                    </button>
                </div>
            </section>

            {/* Footer */}
            <footer className="relative z-10 py-12 px-6 border-t border-stone-200 bg-stone-50">
                <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-8">
                    <div>
                        <img src="/kipu_logo.png" alt="Kipu" className="h-10 w-auto mb-4" />
                        <p className="text-sm text-stone-600">
                            Potenciando la productividad mediante IA
                        </p>
                    </div>

                    <div>
                        <h4 className="font-bold text-stone-900 mb-3">Producto</h4>
                        <ul className="space-y-2 text-sm text-stone-600">
                            <li><a href="#caracteristicas" className="hover:text-blue-600 transition-colors">Características</a></li>
                            <li><a href="#como-funciona" className="hover:text-blue-600 transition-colors">Cómo Funciona</a></li>
                            <li><a href="#casos" className="hover:text-blue-600 transition-colors">Casos de Uso</a></li>
                        </ul>
                    </div>

                    <div>
                        <h4 className="font-bold text-stone-900 mb-3">Soporte</h4>
                        <ul className="space-y-2 text-sm text-stone-600">
                            <li><a href="#" className="hover:text-blue-600 transition-colors">Documentación</a></li>
                            <li><a href="#" className="hover:text-blue-600 transition-colors">Ayuda</a></li>
                            <li><a href="#" className="hover:text-blue-600 transition-colors">Contacto</a></li>
                        </ul>
                    </div>

                    <div>
                        <h4 className="font-bold text-stone-900 mb-3">Legal</h4>
                        <ul className="space-y-2 text-sm text-stone-600">
                            <li><a href="#" className="hover:text-blue-600 transition-colors">Privacidad</a></li>
                            <li><a href="#" className="hover:text-blue-600 transition-colors">Términos</a></li>
                        </ul>
                    </div>
                </div>

                <div className="max-w-6xl mx-auto mt-12 pt-8 border-t border-stone-200 text-center text-sm text-stone-500">
                    <p>© 2025 Kipu. Todos los derechos reservados.</p>
                </div>
            </footer>
        </div>
    );
};

const FeatureCard = ({ icon, title, description }: { icon: React.ReactNode, title: string, description: string }) => (
    <div className="p-6 rounded-2xl bg-white border-2 border-stone-200 hover:border-blue-300 hover:shadow-lg transition-all hover:-translate-y-1 text-left">
        <div className="mb-4 p-3 bg-stone-50 rounded-xl w-fit">{icon}</div>
        <h3 className="text-xl font-bold text-stone-900 mb-2">{title}</h3>
        <p className="text-stone-600 leading-relaxed">{description}</p>
    </div>
);

const ProcessStep = ({ number, title, description, color }: { number: number, title: string, description: string, color: string }) => {
    const colorClasses = {
        amber: 'bg-amber-600 text-white',
        blue: 'bg-blue-600 text-white',
        orange: 'bg-orange-600 text-white'
    };

    return (
        <div className="text-center relative">
            <div className={`inline-flex items-center justify-center w-16 h-16 rounded-full ${colorClasses[color as keyof typeof colorClasses]} font-bold text-2xl mb-6 shadow-lg`}>
                {number}
            </div>
            <h3 className="text-2xl font-bold text-stone-900 mb-3">{title}</h3>
            <p className="text-stone-600 leading-relaxed">{description}</p>
        </div>
    );
};

const UseCaseCard = ({ title, description, icon }: { title: string, description: string, icon: string }) => (
    <div className="p-8 rounded-2xl bg-white border-2 border-stone-200 hover:border-amber-300 hover:shadow-xl transition-all">
        <div className="text-5xl mb-4">{icon}</div>
        <h3 className="text-2xl font-bold text-stone-900 mb-3">{title}</h3>
        <p className="text-stone-600 leading-relaxed">{description}</p>
    </div>
);

export default LandingPage;
