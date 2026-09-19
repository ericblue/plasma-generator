import { FRAG, VERT } from './shaders'

export type RenderMode = 'indexed' | 'sines' | 'direct' | 'tom-direct' | 'tom-indexed'
export type TextureSampling = 'pixel' | 'smooth'

export interface DrawOptions {
  mode: RenderMode
  offset: number
  time: number
  scale: number
  outputWidth: number
  outputHeight: number
  smooth: boolean
  glow: number
  demoPattern?: number
  demoFinish?: number
  demoMotion?: number
  demoIntensity?: number
  demoAudio?: readonly [number, number]
  looping?: boolean
  loopCycles?: number
  tomFirst?: readonly [number, number]
  tomSecond?: readonly [number, number]
  tomSwim?: boolean
}

function compile(gl: WebGL2RenderingContext, type: number, src: string): WebGLShader {
  const s = gl.createShader(type)
  if (!s) throw new Error('createShader failed')
  gl.shaderSource(s, src)
  gl.compileShader(s)
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
    throw new Error('Shader compile failed: ' + gl.getShaderInfoLog(s))
  }
  return s
}

export class PlasmaRenderer {
  private gl: WebGL2RenderingContext
  private program: WebGLProgram
  private vao: WebGLVertexArrayObject
  private indexTex: WebGLTexture
  private paletteTex: WebGLTexture
  private u: Record<string, WebGLUniformLocation | null> = {}
  private texW = 1
  private texH = 1

  constructor(private canvas: HTMLCanvasElement) {
    const gl = canvas.getContext('webgl2', { antialias: false, alpha: false })
    if (!gl) throw new Error('WebGL2 is not available in this browser.')
    this.gl = gl

    const prog = gl.createProgram()
    if (!prog) throw new Error('createProgram failed')
    gl.attachShader(prog, compile(gl, gl.VERTEX_SHADER, VERT))
    gl.attachShader(prog, compile(gl, gl.FRAGMENT_SHADER, FRAG))
    gl.linkProgram(prog)
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      throw new Error('Program link failed: ' + gl.getProgramInfoLog(prog))
    }
    this.program = prog
    gl.useProgram(prog)

    for (const n of [
      'uIndices', 'uPalette', 'uOffset', 'uTime', 'uMode', 'uScale', 'uAspect',
      'uOutputSize', 'uTomA', 'uTomB', 'uTomSwim', 'uSmooth', 'uGlow',
      'uPattern', 'uFinish', 'uMotion', 'uIntensity',
      'uAudio', 'uLooping', 'uLoopCycles',
    ]) {
      this.u[n] = gl.getUniformLocation(prog, n)
    }

    const vao = gl.createVertexArray()
    if (!vao) throw new Error('createVertexArray failed')
    this.vao = vao

    // Index texture: one byte per pixel, NEAREST so pixels stay chunky and authentic.
    this.indexTex = this.makeTex(gl.NEAREST)
    // Palette texture: 256x1. NEAREST reproduces the DAC's discrete entries.
    this.paletteTex = this.makeTex(gl.NEAREST)

    gl.uniform1i(this.u['uIndices']!, 0)
    gl.uniform1i(this.u['uPalette']!, 1)
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1)
  }

  private makeTex(filter: number): WebGLTexture {
    const gl = this.gl
    const t = gl.createTexture()
    if (!t) throw new Error('createTexture failed')
    gl.bindTexture(gl.TEXTURE_2D, t)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    return t
  }

  /** Upload a new indexed image (the generated or loaded plasma). */
  setIndices(data: Uint8Array, width: number, height: number): void {
    const gl = this.gl
    this.texW = width; this.texH = height
    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, this.indexTex)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8, width, height, 0, gl.RED, gl.UNSIGNED_BYTE, data)
  }

  /** Replace pixels without reallocating the texture (used by Tom's moving window). */
  updateIndices(data: Uint8Array): void {
    if (data.length !== this.texW * this.texH) {
      throw new Error(`index update is ${data.length} bytes; expected ${this.texW * this.texH}`)
    }
    const gl = this.gl
    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, this.indexTex)
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, this.texW, this.texH, gl.RED, gl.UNSIGNED_BYTE, data)
  }

  /** Upload a 256x3-byte RGB palette. */
  setPalette(rgb: Uint8Array): void {
    const gl = this.gl
    gl.activeTexture(gl.TEXTURE1)
    gl.bindTexture(gl.TEXTURE_2D, this.paletteTex)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB8, 256, 1, 0, gl.RGB, gl.UNSIGNED_BYTE, rgb)
  }

  setSampling(sampling: TextureSampling): void {
    const gl = this.gl
    const filter = sampling === 'pixel' ? gl.NEAREST : gl.LINEAR
    for (const [unit, texture] of [[gl.TEXTURE0, this.indexTex], [gl.TEXTURE1, this.paletteTex]] as const) {
      gl.activeTexture(unit)
      gl.bindTexture(gl.TEXTURE_2D, texture)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter)
    }
  }

  get imageAspect(): number { return this.texW / this.texH }

  draw(options: DrawOptions): void {
    const gl = this.gl
    const w = options.outputWidth
    const h = options.outputHeight
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w; this.canvas.height = h
    }
    gl.viewport(0, 0, w, h)
    gl.useProgram(this.program)
    gl.bindVertexArray(this.vao)
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, this.indexTex)
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, this.paletteTex)
    gl.uniform1f(this.u['uOffset']!, options.offset)
    gl.uniform1f(this.u['uTime']!, options.time)
    const modes: Record<RenderMode, number> = {
      indexed: 0, sines: 1, direct: 2, 'tom-direct': 3, 'tom-indexed': 4,
    }
    gl.uniform1i(this.u['uMode']!, modes[options.mode])
    gl.uniform1f(this.u['uScale']!, options.scale)
    gl.uniform1f(this.u['uAspect']!, w / h)
    gl.uniform2f(this.u['uOutputSize']!, w, h)
    gl.uniform2f(this.u['uTomA']!, ...(options.tomFirst ?? [0, 0]))
    gl.uniform2f(this.u['uTomB']!, ...(options.tomSecond ?? [0, 0]))
    gl.uniform1i(this.u['uTomSwim']!, options.tomSwim ? 1 : 0)
    gl.uniform1i(this.u['uSmooth']!, options.smooth ? 1 : 0)
    gl.uniform1f(this.u['uGlow']!, options.glow)
    gl.uniform1i(this.u['uPattern']!, options.demoPattern ?? 0)
    gl.uniform1i(this.u['uFinish']!, options.demoFinish ?? 0)
    gl.uniform1f(this.u['uMotion']!, options.demoMotion ?? 1)
    gl.uniform1f(this.u['uIntensity']!, options.demoIntensity ?? 1)
    gl.uniform2f(this.u['uAudio']!, ...(options.demoAudio ?? [0, 0]))
    gl.uniform1i(this.u['uLooping']!, options.looping ? 1 : 0)
    gl.uniform1f(this.u['uLoopCycles']!, options.loopCycles ?? 1)
    gl.drawArrays(gl.TRIANGLES, 0, 3)
  }

  /** Grab the current frame as a PNG blob. */
  toBlob(): Promise<Blob | null> {
    return new Promise((res) => this.canvas.toBlob(res, 'image/png'))
  }
}
