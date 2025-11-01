// ============================================================================
// WEBGL GPU-ACCELERATED RENDERER
// 10×–100× faster than CPU processing
// ============================================================================

class WebGLRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.gl = null;
    this.program = null;
    this.texture = null;
    this.paletteTexture = null;
    this.initialized = false;
    this.lastPaletteParams = null;
  }

  /**
   * Initialize WebGL context and shaders
   */
  init() {
    if (this.initialized) return true;

    const gl = this.canvas.getContext('webgl', {
      premultipliedAlpha: false,
      preserveDrawingBuffer: true
    });

    if (!gl) {
      console.warn('WebGL not supported, falling back to CPU');
      return false;
    }

    this.gl = gl;

    // Vertex shader - simple quad
    const vertexShaderSource = `
      attribute vec2 a_position;
      attribute vec2 a_texCoord;
      varying vec2 v_texCoord;

      void main() {
        gl_Position = vec4(a_position, 0.0, 1.0);
        v_texCoord = a_texCoord;
      }
    `;

    // Fragment shader - does all the magic
    const fragmentShaderSource = `
      precision mediump float;

      uniform sampler2D u_image;
      uniform sampler2D u_palette;
      uniform vec2 u_resolution;
      uniform float u_pixelation;

      varying vec2 v_texCoord;

      void main() {
        vec2 uv = v_texCoord;

        // Pixelation effect
        if (u_pixelation > 1.0) {
          vec2 pixelSize = vec2(u_pixelation) / u_resolution;
          uv = floor(uv / pixelSize) * pixelSize + pixelSize * 0.5;
        }

        // Sample original image
        vec4 color = texture2D(u_image, uv);

        // Calculate luma (brightness)
        float luma = (color.r + color.g + color.b) / 3.0;

        // Lookup color from 1D palette texture
        vec4 paletteColor = texture2D(u_palette, vec2(luma, 0.5));

        gl_FragColor = vec4(paletteColor.rgb, color.a);
      }
    `;

    // Compile shaders
    const vertexShader = this.compileShader(gl.VERTEX_SHADER, vertexShaderSource);
    const fragmentShader = this.compileShader(gl.FRAGMENT_SHADER, fragmentShaderSource);

    if (!vertexShader || !fragmentShader) {
      console.error('Failed to compile shaders');
      return false;
    }

    // Link program
    this.program = gl.createProgram();
    gl.attachShader(this.program, vertexShader);
    gl.attachShader(this.program, fragmentShader);
    gl.linkProgram(this.program);

    if (!gl.getProgramParameter(this.program, gl.LINK_STATUS)) {
      console.error('Failed to link program:', gl.getProgramInfoLog(this.program));
      return false;
    }

    // Set up geometry (full-screen quad)
    const positions = new Float32Array([
      -1, -1,  1, -1,  -1, 1,
      -1,  1,  1, -1,   1, 1
    ]);

    const texCoords = new Float32Array([
      0, 1,  1, 1,  0, 0,
      0, 0,  1, 1,  1, 0
    ]);

    this.setupAttribute(positions, 'a_position', 2);
    this.setupAttribute(texCoords, 'a_texCoord', 2);

    // Create textures
    this.texture = gl.createTexture();
    this.paletteTexture = gl.createTexture();

    this.initialized = true;
    return true;
  }

  /**
   * Compile a shader
   */
  compileShader(type, source) {
    const gl = this.gl;
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      console.error('Shader compile error:', gl.getShaderInfoLog(shader));
      gl.deleteShader(shader);
      return null;
    }

    return shader;
  }

  /**
   * Set up vertex attribute
   */
  setupAttribute(data, name, size) {
    const gl = this.gl;
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);

    const location = gl.getAttribLocation(this.program, name);
    gl.enableVertexAttribArray(location);
    gl.vertexAttribPointer(location, size, gl.FLOAT, false, 0, 0);
  }

  /**
   * Update palette texture from current settings
   */
  updatePalette() {
    const params = `${currentSeed}_${mixRatioValue}_${brightnessValue}`;
    if (this.lastPaletteParams === params) {
      return; // Already up to date
    }

    const gl = this.gl;
    const lut = precomputeFullLUT();

    // Create 256×1 RGB texture from LUT
    const paletteData = new Uint8Array(256 * 3);
    for (let i = 0; i < 256; i++) {
      paletteData[i * 3] = lut[i * 3];
      paletteData[i * 3 + 1] = lut[i * 3 + 1];
      paletteData[i * 3 + 2] = lut[i * 3 + 2];
    }

    gl.bindTexture(gl.TEXTURE_2D, this.paletteTexture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, 256, 1, 0, gl.RGB, gl.UNSIGNED_BYTE, paletteData);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

    this.lastPaletteParams = params;
  }

  /**
   * Render an image/video frame with GPU acceleration
   */
  render(source, width, height) {
    if (!this.initialized && !this.init()) {
      return false; // Fallback to CPU
    }

    const gl = this.gl;

    // Update canvas size if needed
    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width;
      this.canvas.height = height;
      gl.viewport(0, 0, width, height);
    }

    // Update palette texture
    this.updatePalette();

    // Upload source image to texture
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);

    // Use program
    gl.useProgram(this.program);

    // Set uniforms
    gl.uniform2f(gl.getUniformLocation(this.program, 'u_resolution'), width, height);
    gl.uniform1f(gl.getUniformLocation(this.program, 'u_pixelation'), pixelationValue);

    // Bind textures
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.uniform1i(gl.getUniformLocation(this.program, 'u_image'), 0);

    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.paletteTexture);
    gl.uniform1i(gl.getUniformLocation(this.program, 'u_palette'), 1);

    // Draw
    gl.drawArrays(gl.TRIANGLES, 0, 6);

    return true;
  }

  /**
   * Render from ImageData
   */
  renderImageData(imageData) {
    // Create temporary canvas to convert ImageData to texture source
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = imageData.width;
    tempCanvas.height = imageData.height;
    const ctx = tempCanvas.getContext('2d');
    ctx.putImageData(imageData, 0, 0);

    return this.render(tempCanvas, imageData.width, imageData.height);
  }

  /**
   * Clean up resources
   */
  destroy() {
    if (!this.gl) return;

    const gl = this.gl;
    if (this.texture) gl.deleteTexture(this.texture);
    if (this.paletteTexture) gl.deleteTexture(this.paletteTexture);
    if (this.program) gl.deleteProgram(this.program);

    this.initialized = false;
  }
}

// Global WebGL renderer instance
let webglRenderer = null;

/**
 * Get or create WebGL renderer
 */
function getWebGLRenderer(canvas) {
  if (!webglRenderer || webglRenderer.canvas !== canvas) {
    if (webglRenderer) webglRenderer.destroy();
    webglRenderer = new WebGLRenderer(canvas);
  }
  return webglRenderer;
}
