import React, { useState, useEffect } from 'react';
import { ArrowRight, Mic, Sparkles, FileText, Users, Shield, Clock, CheckCircle2, Zap, Play, ChevronDown, Building2, BarChart3, Globe, Lock } from 'lucide-react';

interface LandingPageProps {
    onEnter: () => void;
}

const LandingPage: React.FC<LandingPageProps> = ({ onEnter }) => {
    const [scrolled, setScrolled] = useState(false);

    useEffect(() => {
        const handleScroll = () => setScrolled(window.scrollY > 50);
        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    return (
        <div className="min-h-screen bg-white text-stone-800 font-sans selection:bg-primary/20 overflow-x-hidden">

            {/* Navbar - Premium & Sticky */}
            <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${scrolled
                    ? 'bg-white/95 backdrop-blur-xl shadow-lg shadow-black/5 py-4'
                    : 'bg-transparent py-6'
                }`}>
                <div className="max-w-7xl mx-auto px-6 md:px-12 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <img src="/kipu_logo.png" alt="Kipu" className="h-10 w-auto" />
                        <span className="hidden md:inline-block px-2 py-0.5 text-[10px] font-bold bg-primary/10 text-primary rounded-full tracking-wider">
                            ENTERPRISE
                        </span>
                    </div>
                    <div className="hidden md:flex items-center gap-8">
                        <a href="#caracteristicas" className="text-sm font-medium text-stone-600 hover:text-primary transition-colors">Características</a>
                        <a href="#como-funciona" className="text-sm font-medium text-stone-600 hover:text-primary transition-colors">Cómo Funciona</a>
                        <a href="#casos" className="text-sm font-medium text-stone-600 hover:text-primary transition-colors">Casos de Uso</a>
                        <a href="#seguridad" className="text-sm font-medium text-stone-600 hover:text-primary transition-colors">Seguridad</a>
                    </div>
                    <div className="flex items-center gap-4">
                        <button
                            onClick={onEnter}
                            className="px-6 py-2.5 rounded-full bg-gradient-to-r from-primary to-amber-600 text-white font-semibold text-sm shadow-lg shadow-primary/30 hover:shadow-xl hover:shadow-primary/40 hover:scale-105 transition-all duration-300"
                        >
                            Acceder
                        </button>
                    </div>
                </div>
            </nav>

            {/* Hero Section - Premium */}
            <section className="relative min-h-screen flex flex-col items-center justify-center px-6 pt-32 pb-20 overflow-hidden">
                {/* Background Elements */}
                <div className="absolute inset-0 overflow-hidden pointer-events-none">
                    <div className="absolute -top-1/2 -right-1/4 w-[800px] h-[800px] bg-gradient-to-br from-primary/10 via-amber-100/30 to-transparent rounded-full blur-3xl" />
                    <div className="absolute -bottom-1/2 -left-1/4 w-[600px] h-[600px] bg-gradient-to-tr from-blue-100/30 via-transparent to-transparent rounded-full blur-3xl" />
                    <div className="absolute top-1/4 left-1/4 w-2 h-2 bg-primary rounded-full animate-pulse" />
                    <div className="absolute top-1/3 right-1/3 w-3 h-3 bg-gold rounded-full animate-pulse" style={{ animationDelay: '1s' }} />
                    <div className="absolute bottom-1/4 right-1/4 w-2 h-2 bg-amber-500 rounded-full animate-pulse" style={{ animationDelay: '2s' }} />
                </div>

                <div className="relative z-10 max-w-5xl mx-auto text-center">
                    {/* Badge */}
                    <div className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full bg-gradient-to-r from-stone-100 to-stone-50 border border-stone-200 mb-8 animate-fade-in shadow-sm">
                        <Sparkles size={16} className="text-primary" />
                        <span className="text-xs md:text-sm font-semibold text-stone-700">
                            Plataforma Empresarial de Gestión de Conocimiento
                        </span>
                    </div>

                    {/* Main Headline */}
                    <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight mb-8 leading-[1.1] animate-slide-up">
                        <span className="text-stone-900">Transforma Reuniones en</span>
                        <br />
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary via-amber-600 to-orange-600">
                            Conocimiento Accionable
                        </span>
                    </h1>

                    {/* Subheadline */}
                    <p className="text-lg md:text-xl text-stone-600 max-w-3xl mx-auto mb-12 leading-relaxed animate-slide-up" style={{ animationDelay: '100ms' }}>
                        Documentación inteligente para organizaciones que valoran su tiempo.
                        IA avanzada que transcribe, resume y extrae insights de cada conversación.
                    </p>

                    {/* CTA Buttons */}
                    <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16 animate-slide-up" style={{ animationDelay: '200ms' }}>
                        <button
                            onClick={onEnter}
                            className="group relative px-8 py-4 bg-gradient-to-r from-primary to-amber-600 text-white rounded-2xl font-bold text-lg shadow-2xl shadow-primary/30 hover:shadow-primary/50 hover:scale-105 transition-all duration-300 flex items-center gap-3"
                        >
                            <Play size={20} fill="white" />
                            Comenzar Ahora
                            <ArrowRight className="group-hover:translate-x-1 transition-transform" />
                        </button>
                        <button
                            onClick={() => document.getElementById('como-funciona')?.scrollIntoView({ behavior: 'smooth' })}
                            className="px-8 py-4 bg-white text-stone-700 rounded-2xl font-semibold text-lg border-2 border-stone-200 hover:border-primary hover:text-primary transition-all duration-300 flex items-center gap-2"
                        >
                            Ver Demo
                            <ChevronDown size={20} />
                        </button>
                    </div>

                    {/* Trust Badges */}
                    <div className="flex flex-wrap items-center justify-center gap-8 text-sm text-stone-500 animate-fade-in" style={{ animationDelay: '400ms' }}>
                        <div className="flex items-center gap-2">
                            <Shield size={18} className="text-green-600" />
                            <span>Encriptación E2E</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <Lock size={18} className="text-primary" />
                            <span>Datos en Colombia</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <Globe size={18} className="text-blue-600" />
                            <span>99.9% Uptime</span>
                        </div>
                    </div>
                </div>

                {/* Scroll Indicator */}
                <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce">
                    <ChevronDown size={32} className="text-stone-300" />
                </div>
            </section>

            {/* Stats Section */}
            <section className="py-16 bg-gradient-to-b from-stone-50 to-white border-y border-stone-100">
                <div className="max-w-6xl mx-auto px-6">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
                        <StatCard value="40X" label="Más Rápido" sublabel="vs. documentación manual" />
                        <StatCard value="95%" label="Precisión IA" sublabel="en transcripciones" />
                        <StatCard value="4hrs" label="Máximo" sublabel="de grabación continua" />
                        <StatCard value="24/7" label="Disponible" sublabel="soporte incluido" />
                    </div>
                </div>
            </section>

            {/* Features Section - Premium Grid */}
            <section id="caracteristicas" className="py-24 px-6">
                <div className="max-w-7xl mx-auto">
                    <div className="text-center mb-16">
                        <span className="text-sm font-bold text-primary uppercase tracking-widest mb-4 block">Características</span>
                        <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-stone-900 mb-6">
                            Tecnología Empresarial
                        </h2>
                        <p className="text-xl text-stone-600 max-w-2xl mx-auto">
                            Todo lo que necesitas para gestionar el conocimiento de tu organización
                        </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        <FeatureCard
                            icon={<Mic className="text-primary" size={28} />}
                            title="Grabación Profesional"
                            description="Captura reuniones de hasta 4 horas con audio de alta calidad. Compatible con todos los dispositivos."
                            accent="primary"
                        />
                        <FeatureCard
                            icon={<Sparkles className="text-amber-600" size={28} />}
                            title="Análisis con IA"
                            description="Resúmenes ejecutivos, decisiones, tareas y transcripciones completas. Todo automático."
                            accent="amber"
                        />
                        <FeatureCard
                            icon={<FileText className="text-blue-600" size={28} />}
                            title="Exportación Flexible"
                            description="Genera documentos PDF y Word al instante. Personaliza qué incluir en cada exportación."
                            accent="blue"
                        />
                        <FeatureCard
                            icon={<Users className="text-purple-600" size={28} />}
                            title="Multi-Usuario"
                            description="Perfiles múltiples por organización. Gestión de roles y permisos avanzados."
                            accent="purple"
                        />
                        <FeatureCard
                            icon={<BarChart3 className="text-green-600" size={28} />}
                            title="Insights Automáticos"
                            description="Identifica patrones, tendencias y oportunidades de mejora en tus reuniones."
                            accent="green"
                        />
                        <FeatureCard
                            icon={<Zap className="text-orange-600" size={28} />}
                            title="Procesamiento Rápido"
                            description="Resultados en minutos. Chunking inteligente para archivos largos."
                            accent="orange"
                        />
                    </div>
                </div>
            </section>

            {/* How It Works - Timeline */}
            <section id="como-funciona" className="py-24 px-6 bg-gradient-to-b from-stone-50 to-white">
                <div className="max-w-6xl mx-auto">
                    <div className="text-center mb-16">
                        <span className="text-sm font-bold text-primary uppercase tracking-widest mb-4 block">Proceso</span>
                        <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-stone-900 mb-6">
                            ¿Cómo Funciona?
                        </h2>
                        <p className="text-xl text-stone-600">
                            Tres pasos simples hacia la productividad
                        </p>
                    </div>

                    <div className="relative">
                        {/* Timeline Line */}
                        <div className="hidden md:block absolute top-24 left-0 right-0 h-1 bg-gradient-to-r from-primary via-amber-500 to-orange-500 rounded-full" />

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
                            <ProcessStep
                                number={1}
                                title="Graba o Sube"
                                description="Graba directamente desde cualquier dispositivo o sube archivos existentes. Soportamos MP3, WAV, M4A y más."
                                color="primary"
                            />
                            <ProcessStep
                                number={2}
                                title="IA Analiza"
                                description="Nuestra IA procesa el audio, identifica hablantes, transcribe y extrae información clave automáticamente."
                                color="amber"
                            />
                            <ProcessStep
                                number={3}
                                title="Organiza y Actúa"
                                description="Accede a resúmenes, tareas y transcripciones. Exporta, busca y gestiona tu conocimiento corporativo."
                                color="orange"
                            />
                        </div>
                    </div>
                </div>
            </section>

            {/* Security Section */}
            <section id="seguridad" className="py-24 px-6">
                <div className="max-w-6xl mx-auto">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
                        <div>
                            <span className="text-sm font-bold text-green-600 uppercase tracking-widest mb-4 block">Seguridad</span>
                            <h2 className="text-3xl md:text-4xl font-bold text-stone-900 mb-6">
                                Tu Información, <br />Tu Control
                            </h2>
                            <p className="text-lg text-stone-600 mb-8 leading-relaxed">
                                Diseñamos Kipu con la seguridad empresarial como prioridad. Tus datos están protegidos con los más altos estándares de la industria.
                            </p>

                            <div className="space-y-4">
                                <SecurityFeature
                                    icon={<Lock size={20} />}
                                    title="Encriptación End-to-End"
                                    description="Todos los datos en tránsito y reposo están encriptados."
                                />
                                <SecurityFeature
                                    icon={<Shield size={20} />}
                                    title="Datos en Latinoamérica"
                                    description="Servidores ubicados en la región para cumplimiento normativo."
                                />
                                <SecurityFeature
                                    icon={<Users size={20} />}
                                    title="Control de Acceso"
                                    description="Gestión granular de permisos por usuario y rol."
                                />
                            </div>
                        </div>

                        <div className="relative">
                            <div className="absolute -inset-4 bg-gradient-to-r from-green-100 to-emerald-100 rounded-3xl blur-3xl opacity-50" />
                            <div className="relative bg-white rounded-3xl p-8 border border-stone-200 shadow-2xl">
                                <div className="flex items-center gap-4 mb-6">
                                    <div className="w-12 h-12 bg-green-100 rounded-2xl flex items-center justify-center">
                                        <Shield className="text-green-600" size={24} />
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-stone-900">Seguridad Certificada</h4>
                                        <p className="text-sm text-stone-500">Cumplimiento SOC 2 Type II</p>
                                    </div>
                                </div>
                                <div className="space-y-3">
                                    <div className="flex items-center gap-3 text-sm text-stone-600">
                                        <CheckCircle2 size={18} className="text-green-500" />
                                        <span>Auditorías de seguridad periódicas</span>
                                    </div>
                                    <div className="flex items-center gap-3 text-sm text-stone-600">
                                        <CheckCircle2 size={18} className="text-green-500" />
                                        <span>Backups automáticos diarios</span>
                                    </div>
                                    <div className="flex items-center gap-3 text-sm text-stone-600">
                                        <CheckCircle2 size={18} className="text-green-500" />
                                        <span>Monitoreo 24/7</span>
                                    </div>
                                    <div className="flex items-center gap-3 text-sm text-stone-600">
                                        <CheckCircle2 size={18} className="text-green-500" />
                                        <span>SLA garantizado 99.9%</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Use Cases */}
            <section id="casos" className="py-24 px-6 bg-gradient-to-b from-stone-50 to-white">
                <div className="max-w-6xl mx-auto">
                    <div className="text-center mb-16">
                        <span className="text-sm font-bold text-primary uppercase tracking-widest mb-4 block">Aplicaciones</span>
                        <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-stone-900 mb-6">
                            Casos de Uso
                        </h2>
                        <p className="text-xl text-stone-600">
                            Adaptado a las necesidades de tu organización
                        </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <UseCaseCard
                            title="Juntas Directivas"
                            description="Documenta acuerdos estratégicos, decisiones de alto nivel y seguimiento de compromisos con total precisión."
                            icon={<Building2 size={32} className="text-primary" />}
                        />
                        <UseCaseCard
                            title="Capacitación Corporativa"
                            description="Captura talleres, formaciones y transferencia de conocimiento. Crea bibliotecas de formación institucional."
                            icon={<Users size={32} className="text-amber-600" />}
                        />
                        <UseCaseCard
                            title="Gestión de Proyectos"
                            description="Extrae automáticamente tareas, responsables y plazos de reuniones de equipo y seguimientos."
                            icon={<BarChart3 size={32} className="text-blue-600" />}
                        />
                        <UseCaseCard
                            title="Atención al Cliente"
                            description="Transcribe llamadas, detecta insights y mejora la calidad del servicio con datos reales."
                            icon={<Globe size={32} className="text-green-600" />}
                        />
                    </div>
                </div>
            </section>

            {/* Final CTA */}
            <section className="py-24 px-6">
                <div className="max-w-4xl mx-auto">
                    <div className="relative overflow-hidden bg-gradient-to-br from-primary via-amber-600 to-orange-600 rounded-3xl p-12 md:p-16 text-center shadow-2xl">
                        {/* Background Pattern */}
                        <div className="absolute inset-0 opacity-10">
                            <div className="absolute top-0 left-0 w-64 h-64 bg-white rounded-full -translate-x-1/2 -translate-y-1/2" />
                            <div className="absolute bottom-0 right-0 w-96 h-96 bg-white rounded-full translate-x-1/3 translate-y-1/3" />
                        </div>

                        <div className="relative z-10">
                            <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-white mb-6">
                                ¿Listo para Transformar tu Organización?
                            </h2>
                            <p className="text-xl text-white/90 mb-10 max-w-2xl mx-auto">
                                Únete a cientos de organizaciones que ya optimizan su productividad con Kipu
                            </p>
                            <button
                                onClick={onEnter}
                                className="group inline-flex items-center gap-3 px-10 py-5 bg-white text-primary rounded-2xl font-bold text-lg shadow-2xl hover:shadow-3xl hover:scale-105 transition-all duration-300"
                            >
                                Empezar Ahora — Es Gratis
                                <ArrowRight className="group-hover:translate-x-1 transition-transform" size={24} />
                            </button>
                        </div>
                    </div>
                </div>
            </section>

            {/* Footer */}
            <footer className="py-16 px-6 border-t border-stone-200 bg-stone-50">
                <div className="max-w-6xl mx-auto">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-12">
                        <div>
                            <img src="/kipu_logo.png" alt="Kipu" className="h-10 w-auto mb-4" />
                            <p className="text-sm text-stone-600 mb-4">
                                Plataforma empresarial de gestión de conocimiento potenciada por IA.
                            </p>
                            <div className="flex gap-3">
                                <span className="px-2 py-1 bg-green-100 text-green-700 text-xs font-semibold rounded">SOC 2</span>
                                <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs font-semibold rounded">GDPR</span>
                            </div>
                        </div>

                        <div>
                            <h4 className="font-bold text-stone-900 mb-4">Producto</h4>
                            <ul className="space-y-3 text-sm text-stone-600">
                                <li><a href="#caracteristicas" className="hover:text-primary transition-colors">Características</a></li>
                                <li><a href="#como-funciona" className="hover:text-primary transition-colors">Cómo Funciona</a></li>
                                <li><a href="#casos" className="hover:text-primary transition-colors">Casos de Uso</a></li>
                                <li><a href="#seguridad" className="hover:text-primary transition-colors">Seguridad</a></li>
                            </ul>
                        </div>

                        <div>
                            <h4 className="font-bold text-stone-900 mb-4">Empresa</h4>
                            <ul className="space-y-3 text-sm text-stone-600">
                                <li><a href="#" className="hover:text-primary transition-colors">Sobre Nosotros</a></li>
                                <li><a href="#" className="hover:text-primary transition-colors">Contacto</a></li>
                                <li><a href="#" className="hover:text-primary transition-colors">Blog</a></li>
                                <li><a href="#" className="hover:text-primary transition-colors">Carreras</a></li>
                            </ul>
                        </div>

                        <div>
                            <h4 className="font-bold text-stone-900 mb-4">Legal</h4>
                            <ul className="space-y-3 text-sm text-stone-600">
                                <li><a href="#" className="hover:text-primary transition-colors">Términos de Servicio</a></li>
                                <li><a href="#" className="hover:text-primary transition-colors">Política de Privacidad</a></li>
                                <li><a href="#" className="hover:text-primary transition-colors">Cookies</a></li>
                            </ul>
                        </div>
                    </div>

                    <div className="pt-8 border-t border-stone-200 flex flex-col md:flex-row justify-between items-center gap-4">
                        <p className="text-sm text-stone-500">
                            © 2025 Kipu. Todos los derechos reservados.
                        </p>
                        <p className="text-sm text-stone-400">
                            Hecho con ❤️ para organizaciones que valoran su tiempo
                        </p>
                    </div>
                </div>
            </footer>
        </div>
    );
};

// Component: Stat Card
const StatCard = ({ value, label, sublabel }: { value: string, label: string, sublabel: string }) => (
    <div className="text-center p-6 rounded-2xl bg-white border border-stone-100 shadow-sm hover:shadow-lg transition-shadow">
        <div className="text-3xl md:text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-primary to-amber-600 mb-2">
            {value}
        </div>
        <div className="font-semibold text-stone-800 mb-1">{label}</div>
        <div className="text-xs text-stone-500">{sublabel}</div>
    </div>
);

// Component: Feature Card
const FeatureCard = ({ icon, title, description, accent }: { icon: React.ReactNode, title: string, description: string, accent: string }) => {
    const accentColors: Record<string, string> = {
        primary: 'hover:border-primary/30 group-hover:bg-primary/5',
        amber: 'hover:border-amber-500/30 group-hover:bg-amber-50',
        blue: 'hover:border-blue-500/30 group-hover:bg-blue-50',
        purple: 'hover:border-purple-500/30 group-hover:bg-purple-50',
        green: 'hover:border-green-500/30 group-hover:bg-green-50',
        orange: 'hover:border-orange-500/30 group-hover:bg-orange-50',
    };

    return (
        <div className={`group p-6 rounded-2xl bg-white border-2 border-stone-100 ${accentColors[accent]} hover:shadow-xl transition-all duration-300 hover:-translate-y-1`}>
            <div className="mb-4 p-3 bg-stone-50 rounded-xl w-fit group-hover:scale-110 transition-transform duration-300">
                {icon}
            </div>
            <h3 className="text-xl font-bold text-stone-900 mb-3">{title}</h3>
            <p className="text-stone-600 leading-relaxed">{description}</p>
        </div>
    );
};

// Component: Process Step
const ProcessStep = ({ number, title, description, color }: { number: number, title: string, description: string, color: string }) => {
    const colorClasses: Record<string, string> = {
        primary: 'bg-primary text-white shadow-primary/30',
        amber: 'bg-amber-500 text-white shadow-amber-500/30',
        orange: 'bg-orange-500 text-white shadow-orange-500/30'
    };

    return (
        <div className="text-center relative group">
            <div className={`inline-flex items-center justify-center w-16 h-16 rounded-2xl ${colorClasses[color]} font-bold text-2xl mb-6 shadow-lg group-hover:scale-110 transition-transform duration-300`}>
                {number}
            </div>
            <h3 className="text-xl font-bold text-stone-900 mb-3">{title}</h3>
            <p className="text-stone-600 leading-relaxed">{description}</p>
        </div>
    );
};

// Component: Security Feature
const SecurityFeature = ({ icon, title, description }: { icon: React.ReactNode, title: string, description: string }) => (
    <div className="flex items-start gap-4 p-4 rounded-xl bg-stone-50 border border-stone-100">
        <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center flex-shrink-0 text-green-600">
            {icon}
        </div>
        <div>
            <h4 className="font-semibold text-stone-900 mb-1">{title}</h4>
            <p className="text-sm text-stone-600">{description}</p>
        </div>
    </div>
);

// Component: Use Case Card
const UseCaseCard = ({ title, description, icon }: { title: string, description: string, icon: React.ReactNode }) => (
    <div className="group p-8 rounded-2xl bg-white border-2 border-stone-100 hover:border-primary/20 hover:shadow-xl transition-all duration-300">
        <div className="mb-4 p-4 bg-stone-50 rounded-2xl w-fit group-hover:scale-110 transition-transform duration-300">
            {icon}
        </div>
        <h3 className="text-xl font-bold text-stone-900 mb-3">{title}</h3>
        <p className="text-stone-600 leading-relaxed">{description}</p>
    </div>
);

export default LandingPage;
