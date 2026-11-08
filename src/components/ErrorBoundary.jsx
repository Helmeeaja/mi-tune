import { Component } from 'react'

export default class ErrorBoundary extends Component {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidCatch(error) {
    console.error('Mi Tune UI:', error.message)
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children
  }
}
