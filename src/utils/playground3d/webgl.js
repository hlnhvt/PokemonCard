// Can this device draw the 3D playground? Checked once (a throwaway WebGL context is released).
let cached = null;

export function canUseWebGL() {
  if (cached != null) return cached;
  try {
    if (typeof window === 'undefined' || typeof document === 'undefined' || typeof window.WebGLRenderingContext === 'undefined') {
      cached = false;
      return cached;
    }
    const c = document.createElement('canvas');
    const gl = c.getContext('webgl2') || c.getContext('webgl');
    cached = !!gl;
    gl?.getExtension?.('WEBGL_lose_context')?.loseContext?.();
  } catch {
    cached = false;
  }
  return cached;
}

/** Tests: force the answer (null = detect again). */
export function setWebGLSupport(value) {
  cached = value;
}
