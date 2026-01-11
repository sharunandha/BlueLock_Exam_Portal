import React from 'react';

interface State {
  hasError: boolean;
  error?: Error | null;
  info?: React.ErrorInfo | null;
}

export default class ErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null, info: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // Log to console — devs can copy from browser console
    console.error('ErrorBoundary caught an error:', error, info);
    this.setState({ error, info });
  }

  reset = () => this.setState({ hasError: false, error: null, info: null });

  render() {
    if (this.state.hasError) {
      return (
        <div className="max-w-2xl mx-auto mt-20 p-8 bg-rose-900 text-white rounded-2xl shadow-lg">
          <h2 className="text-2xl font-bold mb-4">Something went wrong</h2>
          <p className="mb-4">The admin view encountered an error. You can copy the details below and send them to the developer.</p>
          <pre className="whitespace-pre-wrap text-sm bg-rose-800 p-4 rounded mb-4 overflow-auto" style={{ maxHeight: 300 }}>
            {String(this.state.error?.stack || this.state.error?.message || 'No stack available')}
            {this.state.info ? '\n\nComponent Stack:\n' + this.state.info.componentStack : ''}
          </pre>
          <div className="flex gap-2">
            <button onClick={this.reset} className="px-4 py-2 bg-white text-rose-900 rounded font-bold">Retry</button>
            <button
              onClick={() => {
                try {
                  navigator.clipboard.writeText(String(this.state.error?.stack || this.state.error?.message || ''));
                  alert('Error details copied to clipboard');
                } catch (e) {
                  alert('Could not copy to clipboard — please copy manually');
                }
              }}
              className="px-4 py-2 bg-rose-700 hover:bg-rose-600 rounded"
            >
              Copy Details
            </button>
          </div>
        </div>
      );
    }

    return this.props.children as React.ReactElement;
  }
}
