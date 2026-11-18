import React, { useEffect, useRef, useState } from 'react'

interface MeshData {
  positions: Float32Array
  normals: Float32Array
  materials: Float32Array
  vertexCount: number
}

/**
 * Parsea un archivo STL binario y devuelve los vértices y normales transformados
 * para que el eje Z del STL (eje del tubo, 0..40 mm) corra a lo largo del eje X del mundo,
 * el eje Y permanezca vertical (+Y arriba para pinza_top, -Y abajo para pinza_bottom),
 * y la pinza quede centrada en `offsetX`.
 */
function parseBinaryStlInstance(buffer: ArrayBuffer, offsetX: number, matId: number): MeshData {
  const view = new DataView(buffer)
  const triCount = view.getUint32(80, true)
  const vertexCount = triCount * 3
  const positions = new Float32Array(vertexCount * 3)
  const normals = new Float32Array(vertexCount * 3)
  const materials = new Float32Array(vertexCount)

  for (let i = 0; i < triCount; i++) {
    const byteOffset = 84 + i * 50

    // Lee los 3 vértices en espacio STL (sx, sy, sz) y aplica R_y(-90°):
    // wx = (sz - 20) + offsetX, wy = sy, wz = -sx
    const v0x = view.getFloat32(byteOffset + 20, true) - 20 + offsetX
    const v0y = view.getFloat32(byteOffset + 16, true)
    const v0z = -view.getFloat32(byteOffset + 12, true)

    const v1x = view.getFloat32(byteOffset + 32, true) - 20 + offsetX
    const v1y = view.getFloat32(byteOffset + 28, true)
    const v1z = -view.getFloat32(byteOffset + 24, true)

    const v2x = view.getFloat32(byteOffset + 44, true) - 20 + offsetX
    const v2y = view.getFloat32(byteOffset + 40, true)
    const v2z = -view.getFloat32(byteOffset + 36, true)

    // Calcula normal geométrica exacta de la cara para sombreado CAD nítido
    const ux = v1x - v0x
    const uy = v1y - v0y
    const uz = v1z - v0z
    const vx = v2x - v0x
    const vy = v2y - v0y
    const vz = v2z - v0z

    let nx = uy * vz - uz * vy
    let ny = uz * vx - ux * vz
    let nz = ux * vy - uy * vx
    const len = Math.hypot(nx, ny, nz) || 1
    nx /= len
    ny /= len
    nz /= len

    const base = i * 9
    positions[base] = v0x
    positions[base + 1] = v0y
    positions[base + 2] = v0z
    positions[base + 3] = v1x
    positions[base + 4] = v1y
    positions[base + 5] = v1z
    positions[base + 6] = v2x
    positions[base + 7] = v2y
    positions[base + 8] = v2z

    for (let k = 0; k < 3; k++) {
      normals[base + k * 3] = nx
      normals[base + k * 3 + 1] = ny
      normals[base + k * 3 + 2] = nz
      materials[i * 3 + k] = matId
    }
  }

  return { positions, normals, materials, vertexCount }
}

/**
 * Genera la malla de una tubería hueca de PVC cédula 40 de 1" (OD 33.2 mm, ID 26.0 mm)
 * a lo largo del eje X desde -halfLen hasta +halfLen, más un plano de sombra suave debajo.
 */
function buildPipeAndShadowMesh(halfLen: number, rOut: number, rIn: number, segments: number): MeshData {
  const pos: number[] = []
  const norm: number[] = []
  const mat: number[] = []

  const pushTri = (
    ax: number, ay: number, az: number, anx: number, any: number, anz: number,
    bx: number, by: number, bz: number, bnx: number, bny: number, bnz: number,
    cx: number, cy: number, cz: number, cnx: number, cny: number, cnz: number,
    m: number,
  ) => {
    pos.push(ax, ay, az, bx, by, bz, cx, cy, cz)
    norm.push(anx, any, anz, bnx, bny, bnz, cnx, cny, cnz)
    mat.push(m, m, m)
  }

  for (let s = 0; s < segments; s++) {
    const a0 = (s / segments) * Math.PI * 2
    const a1 = ((s + 1) / segments) * Math.PI * 2
    const c0 = Math.cos(a0)
    const s0 = Math.sin(a0)
    const c1 = Math.cos(a1)
    const s1 = Math.sin(a1)

    const yOut0 = rOut * c0
    const zOut0 = rOut * s0
    const yOut1 = rOut * c1
    const zOut1 = rOut * s1

    const yIn0 = rIn * c0
    const zIn0 = rIn * s0
    const yIn1 = rIn * c1
    const zIn1 = rIn * s1

    // Pared exterior del tubo (matId = 0.0 -> PVC blanco/gris claro)
    pushTri(
      -halfLen, yOut0, zOut0, 0, c0, s0,
      halfLen, yOut0, zOut0, 0, c0, s0,
      halfLen, yOut1, zOut1, 0, c1, s1,
      0.0,
    )
    pushTri(
      -halfLen, yOut0, zOut0, 0, c0, s0,
      halfLen, yOut1, zOut1, 0, c1, s1,
      -halfLen, yOut1, zOut1, 0, c1, s1,
      0.0,
    )

    // Pared interior del tubo (matId = 2.0 -> interior hueco sombreado)
    pushTri(
      -halfLen, yIn0, zIn0, 0, -c0, -s0,
      halfLen, yIn1, zIn1, 0, -c1, -s1,
      halfLen, yIn0, zIn0, 0, -c0, -s0,
      2.0,
    )
    pushTri(
      -halfLen, yIn0, zIn0, 0, -c0, -s0,
      -halfLen, yIn1, zIn1, 0, -c1, -s1,
      halfLen, yIn1, zIn1, 0, -c1, -s1,
      2.0,
    )

    // Anillo extremo derecho (+halfLen, normal +X)
    pushTri(
      halfLen, yIn0, zIn0, 1, 0, 0,
      halfLen, yOut0, zOut0, 1, 0, 0,
      halfLen, yOut1, zOut1, 1, 0, 0,
      0.0,
    )
    pushTri(
      halfLen, yIn0, zIn0, 1, 0, 0,
      halfLen, yOut1, zOut1, 1, 0, 0,
      halfLen, yIn1, zIn1, 1, 0, 0,
      0.0,
    )

    // Anillo extremo izquierdo (-halfLen, normal -X)
    pushTri(
      -halfLen, yIn0, zIn0, -1, 0, 0,
      -halfLen, yOut1, zOut1, -1, 0, 0,
      -halfLen, yOut0, zOut0, -1, 0, 0,
      0.0,
    )
    pushTri(
      -halfLen, yIn0, zIn0, -1, 0, 0,
      -halfLen, yIn1, zIn1, -1, 0, 0,
      -halfLen, yOut1, zOut1, -1, 0, 0,
      0.0,
    )
  }

  // Plano de sombra de estudio en y = -32 mm (matId = 3.0)
  const sy = -32
  const sx = 180
  const sz = 95
  pushTri(-sx, sy, -sz, 0, 1, 0, -sx, sy, sz, 0, 1, 0, sx, sy, sz, 0, 1, 0, 3.0)
  pushTri(-sx, sy, -sz, 0, 1, 0, sx, sy, sz, 0, 1, 0, sx, sy, -sz, 0, 1, 0, 3.0)

  return {
    positions: new Float32Array(pos),
    normals: new Float32Array(norm),
    materials: new Float32Array(mat),
    vertexCount: mat.length,
  }
}

function mergeMeshes(meshes: MeshData[]): MeshData {
  const totalVerts = meshes.reduce((acc, m) => acc + m.vertexCount, 0)
  const positions = new Float32Array(totalVerts * 3)
  const normals = new Float32Array(totalVerts * 3)
  const materials = new Float32Array(totalVerts)

  let offset = 0
  for (const m of meshes) {
    positions.set(m.positions, offset * 3)
    normals.set(m.normals, offset * 3)
    materials.set(m.materials, offset)
    offset += m.vertexCount
  }
  return { positions, normals, materials, vertexCount: totalVerts }
}

const VERTEX_SHADER = `
  attribute vec3 aPosition;
  attribute vec3 aNormal;
  attribute float aMaterial;

  uniform mat4 uProjection;
  uniform mat4 uView;

  varying vec3 vWorldPos;
  varying vec3 vNormal;
  varying float vMaterial;

  void main() {
    vWorldPos = aPosition;
    vNormal = aNormal;
    vMaterial = aMaterial;
    gl_Position = uProjection * uView * vec4(aPosition, 1.0);
  }
`

const FRAGMENT_SHADER = `
  precision highp float;

  varying vec3 vWorldPos;
  varying vec3 vNormal;
  varying float vMaterial;

  uniform vec3 uCameraPos;

  void main() {
    vec3 bg = vec3(0.9569, 0.9686, 0.9804); // #F4F7FA

    // Plano de sombra de contacto en estudio (vMaterial == 3.0)
    if (vMaterial > 2.5) {
      float pipeShadow = exp(-pow(vWorldPos.z / 26.0, 2.0)) * smoothstep(155.0, 95.0, abs(vWorldPos.x));
      float clampA = exp(-(pow((vWorldPos.x + 56.0) / 28.0, 2.0) + pow(vWorldPos.z / 42.0, 2.0)));
      float clampB = exp(-(pow((vWorldPos.x - 56.0) / 28.0, 2.0) + pow(vWorldPos.z / 42.0, 2.0)));
      float shadow = clamp(pipeShadow * 0.11 + (clampA + clampB) * 0.14, 0.0, 0.24);
      vec3 shadowColor = mix(bg, vec3(0.74, 0.79, 0.85), shadow);
      gl_FragColor = vec4(shadowColor, 1.0);
      return;
    }

    vec3 N = normalize(vNormal);
    vec3 V = normalize(uCameraPos - vWorldPos);

    // Luces de estudio de 3 puntos
    vec3 L1 = normalize(vec3(0.52, 0.80, 0.64));
    vec3 L2 = normalize(vec3(-0.68, 0.35, 0.48));
    vec3 L3 = normalize(vec3(0.05, 0.45, -0.88));

    float diff1 = max(dot(N, L1), 0.0);
    float diff2 = max(dot(N, L2), 0.0);
    float diff3 = max(dot(N, L3), 0.0);

    vec3 H1 = normalize(L1 + V);
    float hemi = N.y * 0.5 + 0.5;

    vec3 baseColor;
    vec3 ambientColor;
    float specPower;
    float specStrength;

    if (vMaterial > 0.5 && vMaterial < 1.5) {
      // Pinzas piezoeléctricas en naranja industrial (#FF6B1A / #F25C05)
      baseColor = vec3(0.96, 0.38, 0.08);
      ambientColor = mix(vec3(0.42, 0.16, 0.05), vec3(1.0, 0.56, 0.24), hemi);
      specPower = 34.0;
      specStrength = 0.28;
    } else if (vMaterial > 1.5) {
      // Interior hueco de la tubería
      baseColor = vec3(0.50, 0.56, 0.64);
      ambientColor = mix(vec3(0.28, 0.33, 0.40), vec3(0.62, 0.68, 0.75), hemi);
      specPower = 18.0;
      specStrength = 0.08;
    } else {
      // Tubería de PVC blanca / gris claro cédula 40 con contraste limpio sobre #F4F7FA
      baseColor = vec3(0.87, 0.90, 0.94);
      ambientColor = mix(vec3(0.58, 0.64, 0.72), vec3(0.97, 0.98, 1.0), hemi);
      specPower = 56.0;
      specStrength = 0.35;
    }

    // Oclusión suave cerca de las zonas donde las pinzas abrazan el tubo
    float nearClamp = exp(-pow(( abs(vWorldPos.x) - 56.0 ) / 18.0, 2.0));
    float ao = (vMaterial < 0.5) ? (1.0 - 0.22 * nearClamp) : 1.0;

    float spec = pow(max(dot(N, H1), 0.0), specPower) * specStrength;
    float rim = pow(1.0 - max(dot(N, V), 0.0), 3.0) * 0.14;

    vec3 color = (
      ambientColor * 0.46 +
      baseColor * (diff1 * 0.68 + diff2 * 0.26 + diff3 * 0.18)
    ) * ao + vec3(1.0, 0.98, 0.95) * (spec + rim);

    gl_FragColor = vec4(clamp(color, 0.0, 1.0), 1.0);
  }
`

function perspectiveMatrix(fovRad: number, aspect: number, near: number, far: number): Float32Array {
  const f = 1.0 / Math.tan(fovRad / 2)
  const nf = 1 / (near - far)
  return new Float32Array([
    f / aspect, 0, 0, 0,
    0, f, 0, 0,
    0, 0, (far + near) * nf, -1,
    0, 0, 2 * far * near * nf, 0,
  ])
}

function lookAtMatrix(eye: [number, number, number], target: [number, number, number], up: [number, number, number]): Float32Array {
  let zx = eye[0] - target[0]
  let zy = eye[1] - target[1]
  let zz = eye[2] - target[2]
  let len = Math.hypot(zx, zy, zz) || 1
  zx /= len; zy /= len; zz /= len

  let xx = up[1] * zz - up[2] * zy
  let xy = up[2] * zx - up[0] * zz
  let xz = up[0] * zy - up[1] * zx
  len = Math.hypot(xx, xy, xz) || 1
  xx /= len; xy /= len; xz /= len

  const yx = zy * xz - zz * xy
  const yy = zz * xx - zx * xz
  const yz = zx * xy - zy * xx

  return new Float32Array([
    xx, yx, zx, 0,
    xy, yy, zy, 0,
    xz, yz, zz, 0,
    -(xx * eye[0] + xy * eye[1] + xz * eye[2]),
    -(yx * eye[0] + yy * eye[1] + yz * eye[2]),
    -(zx * eye[0] + zy * eye[1] + zz * eye[2]),
    1,
  ])
}

export default function Prototype3DViewer() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const gl = canvas.getContext('webgl', { antialias: true, alpha: false })
    if (!gl) return

    let disposed = false
    let animId = 0

    const compile = (type: number, src: string) => {
      const sh = gl.createShader(type)!
      gl.shaderSource(sh, src)
      gl.compileShader(sh)
      return sh
    }

    const vs = compile(gl.VERTEX_SHADER, VERTEX_SHADER)
    const fs = compile(gl.FRAGMENT_SHADER, FRAGMENT_SHADER)
    const prog = gl.createProgram()!
    gl.attachShader(prog, vs)
    gl.attachShader(prog, fs)
    gl.linkProgram(prog)
    gl.useProgram(prog)

    const aPosition = gl.getAttribLocation(prog, 'aPosition')
    const aNormal = gl.getAttribLocation(prog, 'aNormal')
    const aMaterial = gl.getAttribLocation(prog, 'aMaterial')
    const uProjection = gl.getUniformLocation(prog, 'uProjection')
    const uView = gl.getUniformLocation(prog, 'uView')
    const uCameraPos = gl.getUniformLocation(prog, 'uCameraPos')

    const posBuf = gl.createBuffer()!
    const normBuf = gl.createBuffer()!
    const matBuf = gl.createBuffer()!

    let vertexCount = 0

    const uploadMesh = (mesh: MeshData) => {
      gl.bindBuffer(gl.ARRAY_BUFFER, posBuf)
      gl.bufferData(gl.ARRAY_BUFFER, mesh.positions, gl.STATIC_DRAW)

      gl.bindBuffer(gl.ARRAY_BUFFER, normBuf)
      gl.bufferData(gl.ARRAY_BUFFER, mesh.normals, gl.STATIC_DRAW)

      gl.bindBuffer(gl.ARRAY_BUFFER, matBuf)
      gl.bufferData(gl.ARRAY_BUFFER, mesh.materials, gl.STATIC_DRAW)

      vertexCount = mesh.vertexCount
    }

    // Sube inicialmente la tubería para que el lienzo pinte en el primer cuadro
    const pipeMesh = buildPipeAndShadowMesh(132, 16.6, 13.0, 64)
    uploadMesh(pipeMesh)

    // Carga los dos archivos STL reales (pieza superior + pieza inferior) y monta Pinza A y Pinza B
    Promise.all([
      fetch('/landing/pinza_top.stl').then((r) => r.arrayBuffer()),
      fetch('/landing/pinza_bottom.stl').then((r) => r.arrayBuffer()),
    ])
      .then(([topBuf, bottomBuf]) => {
        if (disposed) return
        const clampATop = parseBinaryStlInstance(topBuf, -56, 1.0)
        const clampABottom = parseBinaryStlInstance(bottomBuf, -56, 1.0)
        const clampBTop = parseBinaryStlInstance(topBuf, 56, 1.0)
        const clampBBottom = parseBinaryStlInstance(bottomBuf, 56, 1.0)

        uploadMesh(mergeMeshes([pipeMesh, clampATop, clampABottom, clampBTop, clampBBottom]))
        setReady(true)
      })
      .catch(() => {
        if (!disposed) setReady(true)
      })

    // Estado de órbita y zoom con amortiguamiento suave
    let targetYaw = -0.48
    let targetPitch = 0.34
    let currentYaw = targetYaw
    let currentPitch = targetPitch
    let targetDist = 365
    let currentDist = targetDist

    let dragging = false
    let lastX = 0
    let lastY = 0
    let pinchDist = 0

    const onMouseDown = (e: MouseEvent) => {
      dragging = true
      lastX = e.clientX
      lastY = e.clientY
    }

    const onMouseMove = (e: MouseEvent) => {
      if (!dragging) return
      const dx = e.clientX - lastX
      const dy = e.clientY - lastY
      lastX = e.clientX
      lastY = e.clientY
      targetYaw += dx * 0.009
      targetPitch = Math.max(-1.15, Math.min(1.25, targetPitch + dy * 0.008))
    }

    const onMouseUp = () => {
      dragging = false
    }

    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      targetDist = Math.max(180, Math.min(620, targetDist + e.deltaY * 0.2))
    }

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 1) {
        dragging = true
        lastX = e.touches[0].clientX
        lastY = e.touches[0].clientY
      } else if (e.touches.length === 2) {
        dragging = false
        pinchDist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY,
        )
      }
    }

    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 1 && dragging) {
        const dx = e.touches[0].clientX - lastX
        const dy = e.touches[0].clientY - lastY
        lastX = e.touches[0].clientX
        lastY = e.touches[0].clientY
        targetYaw += dx * 0.009
        targetPitch = Math.max(-1.15, Math.min(1.25, targetPitch + dy * 0.008))
      } else if (e.touches.length === 2) {
        e.preventDefault()
        const d = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY,
        )
        if (pinchDist > 0) {
          targetDist = Math.max(180, Math.min(620, targetDist - (d - pinchDist) * 0.5))
        }
        pinchDist = d
      }
    }

    const onTouchEnd = () => {
      dragging = false
      pinchDist = 0
    }

    canvas.addEventListener('mousedown', onMouseDown)
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
    canvas.addEventListener('wheel', onWheel, { passive: false })
    canvas.addEventListener('touchstart', onTouchStart, { passive: true })
    canvas.addEventListener('touchmove', onTouchMove, { passive: false })
    canvas.addEventListener('touchend', onTouchEnd)

    gl.enable(gl.DEPTH_TEST)
    gl.clearColor(0.9569, 0.9686, 0.9804, 1.0) // #F4F7FA

    const render = () => {
      if (disposed) return

      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      const w = Math.max(1, Math.floor(canvas.clientWidth * dpr))
      const h = Math.max(1, Math.floor(canvas.clientHeight * dpr))
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w
        canvas.height = h
      }

      if (!dragging) {
        targetYaw += 0.0022
      }

      currentYaw += (targetYaw - currentYaw) * 0.14
      currentPitch += (targetPitch - currentPitch) * 0.14
      currentDist += (targetDist - currentDist) * 0.14

      const aspect = canvas.width / canvas.height
      const responsiveScale = Math.max(1, 1.55 / aspect)
      const effectiveDist = currentDist * responsiveScale

      const cosP = Math.cos(currentPitch)
      const sinP = Math.sin(currentPitch)
      const cosY = Math.cos(currentYaw)
      const sinY = Math.sin(currentYaw)

      const eye: [number, number, number] = [
        effectiveDist * cosP * sinY,
        effectiveDist * sinP,
        effectiveDist * cosP * cosY,
      ]

      gl.viewport(0, 0, canvas.width, canvas.height)
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT)

      const proj = perspectiveMatrix((33 * Math.PI) / 180, aspect, 10, 1500)
      const view = lookAtMatrix(eye, [0, 0, 0], [0, 1, 0])

      gl.uniformMatrix4fv(uProjection, false, proj)
      gl.uniformMatrix4fv(uView, false, view)
      gl.uniform3f(uCameraPos, eye[0], eye[1], eye[2])

      gl.bindBuffer(gl.ARRAY_BUFFER, posBuf)
      gl.enableVertexAttribArray(aPosition)
      gl.vertexAttribPointer(aPosition, 3, gl.FLOAT, false, 0, 0)

      gl.bindBuffer(gl.ARRAY_BUFFER, normBuf)
      gl.enableVertexAttribArray(aNormal)
      gl.vertexAttribPointer(aNormal, 3, gl.FLOAT, false, 0, 0)

      gl.bindBuffer(gl.ARRAY_BUFFER, matBuf)
      gl.enableVertexAttribArray(aMaterial)
      gl.vertexAttribPointer(aMaterial, 1, gl.FLOAT, false, 0, 0)

      gl.drawArrays(gl.TRIANGLES, 0, vertexCount)

      animId = window.requestAnimationFrame(render)
    }

    animId = window.requestAnimationFrame(render)

    return () => {
      disposed = true
      window.cancelAnimationFrame(animId)
      canvas.removeEventListener('mousedown', onMouseDown)
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
      canvas.removeEventListener('wheel', onWheel)
      canvas.removeEventListener('touchstart', onTouchStart)
      canvas.removeEventListener('touchmove', onTouchMove)
      canvas.removeEventListener('touchend', onTouchEnd)
      gl.deleteBuffer(posBuf)
      gl.deleteBuffer(normBuf)
      gl.deleteBuffer(matBuf)
      gl.deleteProgram(prog)
      gl.deleteShader(vs)
      gl.deleteShader(fs)
    }
  }, [])

  return (
    <div
      className="hs-viewer-3d"
      data-ready={ready ? 'true' : 'false'}
      aria-label="Modelo 3D interactivo de las dos pinzas piezoeléctricas naranjas de HydroSense montadas sobre tubería de PVC de 1 pulgada"
    >
      <canvas ref={canvasRef} className="hs-viewer-3d__canvas" />
    </div>
  )
}
