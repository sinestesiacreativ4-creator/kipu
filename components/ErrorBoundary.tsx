import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
    children?: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
    errorInfo: ErrorInfo | null;
}

class ErrorBoundary extends Component<Props, State> {
    public state: State = {
        hasError: false,
        error: null,
        errorInfo: null
    };

    public static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error, errorInfo: null };
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error("Uncaught error:", error, errorInfo);
        this.setState({ errorInfo });
    }

    public render() {
        if (this.state.hasError) {
            return (
                <div className="p-8 bg-red-50 text-red-900 min-h-screen flex flex-col items-center justify-center">
                    <h1 className="text-3xl font-bold mb-4">Algo salió mal</h1>
                    <p className="mb-4 text-lg">Se ha producido un error inesperado en la aplicación.</p>
                    <div className="bg-white p-6 rounded shadow-lg max-w-2xl w-full overflow-auto border border-red-200">
                        <h2 className="font-bold text-red-700 mb-2">Error:</h2>
                        <pre className="text-sm font-mono bg-gray-100 p-4 rounded mb-4 whitespace-pre-wrap">
                            {this.state.error && this.state.error.toString()}
                        </pre>
                        <h2 className="font-bold text-red-700 mb-2">Detalles (Stack Trace):</h2>
                        <pre className="text-xs font-mono bg-gray-100 p-4 rounded overflow-x-auto">
                            {this.state.errorInfo && this.state.errorInfo.componentStack}
                        </pre>
                    </div>
                    <button
                        onClick={() => window.location.reload()}
                        className="mt-8 px-6 py-3 bg-red-600 text-white rounded-full hover:bg-red-700 transition-colors font-medium shadow-lg"
                    >
                        Recargar Aplicación
                    </button>
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
