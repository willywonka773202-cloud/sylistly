'use client';
import { Component, type ReactNode } from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle, RefreshCw, Home, Mail } from 'lucide-react';
import Link from 'next/link';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary caught:', error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: undefined });
  };

  render() {
    if (this.state.hasError) {
      return (
        <ErrorDisplay
          error={this.state.error}
          onRetry={this.handleRetry}
        />
      );
    }

    return this.props.children;
  }
}

function ErrorDisplay({
  error,
  onRetry,
}: {
  error?: Error;
  onRetry: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="min-h-[60vh] flex flex-col items-center justify-center px-6 text-center"
    >
      <div className="w-20 h-20 rounded-2xl bg-red-500/10 flex items-center justify-center mb-6">
        <AlertTriangle className="w-10 h-10 text-red-500" />
      </div>
      
      <h2 className="font-serif text-xl font-semibold mb-2">Something went wrong</h2>
      <p className="text-sm text-muted mb-6 max-w-xs">
        {error?.message || "We're having trouble loading this. Let's try again."}
      </p>

      <div className="flex flex-col gap-2 w-full max-w-[200px]">
        <button
          onClick={onRetry}
          className="flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-accent text-white font-semibold"
        >
          <RefreshCw size={16} />
          Try again
        </button>
        
        <Link
          href="/"
          className="flex items-center justify-center gap-2 w-full py-3 rounded-xl border border-hairline text-muted font-medium"
        >
          <Home size={16} />
          Go home
        </Link>
      </div>

      <p className="text-[10px] text-muted/50 mt-8">
        Need help? Contact support@sylistly.com
      </p>
    </motion.div>
  );
}