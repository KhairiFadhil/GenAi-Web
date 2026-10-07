import { Component } from 'react'

// Keeps a failing <Canvas> (missing GLB, WebGL off) from blanking the whole page.
export default class ErrorBoundary extends Component {
  state = { error: null }
  static getDerivedStateFromError(error) {
    return { error }
  }
  render() {
    return this.state.error ? this.props.fallback : this.props.children
  }
}
