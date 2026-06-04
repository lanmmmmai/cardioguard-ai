import React from 'react';

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = {
    hasError: false,
  };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: unknown): void {
    console.error('Frontend render failure captured by ErrorBoundary:', error);
  }

  render(): React.ReactNode {
    if (this.state.hasError) {
      return (
        <div className="route-loading" role="alert" aria-live="assertive">
          Ứng dụng gặp lỗi hiển thị. Vui lòng tải lại trang hoặc đăng nhập lại.
        </div>
      );
    }

    return this.props.children;
  }
}
