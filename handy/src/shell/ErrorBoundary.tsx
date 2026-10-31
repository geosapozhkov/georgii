import { Component, type ReactNode } from "react";

export class ErrorBoundary extends Component<{ name: string; children: ReactNode }, { message: string | null }> {
  state = { message: null as string | null };

  static getDerivedStateFromError(error: Error) {
    return { message: error.message || "This room hit a problem." };
  }

  render() {
    if (this.state.message) {
      return (
        <div className="studio-error">
          <strong>{this.props.name} stopped.</strong>
          <p>{this.state.message}</p>
          <button type="button" onClick={() => this.setState({ message: null })}>
            Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
