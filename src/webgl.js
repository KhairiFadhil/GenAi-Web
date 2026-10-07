let supported
export function hasWebGL() {
  if (supported === undefined) {
    try {
      supported = !!document.createElement('canvas').getContext('webgl2')
    } catch {
      supported = false
    }
  }
  return supported
}
