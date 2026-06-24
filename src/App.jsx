import { useState, useEffect, useRef, useCallback } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid
} from 'recharts'
import './App.css'
import { BrowserMultiFormatReader } from '@zxing/browser'

// ─── Utils ───────────────────────────────────────────────────────────────────

const fmt = (n) => new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(n)
const now = () => new Date()
const ts = () => now().toISOString()

function getTurnoActual() {
  const mins = now().getHours() * 60 + now().getMinutes()
  if (mins >= 7 * 60 + 30 && mins < 14 * 60 + 30) return 'manana'
  if (mins >= 14 * 60 + 30 && mins < 21 * 60) return 'tarde'
  return null
}

function formatHora(iso) {
  return new Date(iso).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit', hour12: false })
}

function formatFecha(iso) {
  return new Date(iso).toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

// ─── API helper ──────────────────────────────────────────────────────────────

async function api(method, path, body) {
  const res = await fetch(path, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) throw new Error(await res.text())
  return res.status === 204 ? null : res.json()
}

// ─── Toast ───────────────────────────────────────────────────────────────────

function ToastContainer({ toasts }) {
  return (
    <div className="toast-container">
      {toasts.map(t => (
        <div key={t.id} className={`toast ${t.type}`}>
          <span>{t.icon}</span> {t.msg}
        </div>
      ))}
    </div>
  )
}

function useToast() {
  const [toasts, setToasts] = useState([])
  const add = useCallback((msg, type = 'success', icon = '✓') => {
    const id = Date.now()
    setToasts(p => [...p, { id, msg, type, icon }])
    setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 3000)
  }, [])
  return { toasts, add }
}

// ─── Modal Nuevo Producto ─────────────────────────────────────────────────────

function ModalNuevoProducto({ codigo, onSave, onClose }) {
  const [form, setForm] = useState({ nombre: '', costo: '', venta: '', cantidad: '' })
  const ref = useRef()
  useEffect(() => { ref.current?.focus() }, [])
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }))

  function handleSubmit(e) {
    e.preventDefault()
    if (!form.nombre || !form.venta || !form.cantidad) return
    onSave({
      codigo,
      nombre: form.nombre.trim(),
      costo: parseInt(form.costo) || 0,
      venta: parseInt(form.venta) || 0,
      stock: parseInt(form.cantidad) || 0,
    })
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-title">📦 Nuevo Producto</div>
        <p style={{ color: 'var(--text-muted)', fontSize: 12, marginBottom: 16 }}>
          Código: <code style={{ color: 'var(--blue)' }}>{codigo}</code>
        </p>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="label">Nombre del producto</label>
            <input ref={ref} className="input" value={form.nombre} onChange={e => set('nombre', e.target.value)} placeholder="Ej: Marlboro Rojo" required />
          </div>
          <div className="grid-2" style={{ gap: 10 }}>
            <div className="form-group">
              <label className="label">Precio costo ($)</label>
              <input className="input" type="number" value={form.costo} onChange={e => set('costo', e.target.value)} placeholder="0" min="0" />
            </div>
            <div className="form-group">
              <label className="label">Precio venta ($) *</label>
              <input className="input" type="number" value={form.venta} onChange={e => set('venta', e.target.value)} placeholder="0" min="0" required />
            </div>
          </div>
          <div className="form-group">
            <label className="label">Cantidad inicial *</label>
            <input className="input" type="number" value={form.cantidad} onChange={e => set('cantidad', e.target.value)} placeholder="0" min="1" required />
          </div>
          <div className="modal-actions">
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancelar</button>
            <button type="submit" className="btn btn-success">Guardar producto</button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Modal Agregar Stock ──────────────────────────────────────────────────────

function ModalAgregarStock({ producto, onSave, onClose }) {
  const [cantidad, setCantidad] = useState('')
  const ref = useRef()
  useEffect(() => { ref.current?.focus() }, [])

  function handleSubmit(e) {
    e.preventDefault()
    const n = parseInt(cantidad)
    if (!n || n <= 0) return
    onSave(n)
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-title">➕ Agregar Stock</div>
        <p style={{ marginBottom: 16 }}>
          <strong>{producto.nombre}</strong><br />
          <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>Stock actual: {producto.stock} unidades</span>
        </p>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="label">Cantidad a agregar</label>
            <input ref={ref} className="input" type="number" value={cantidad} onChange={e => setCantidad(e.target.value)} placeholder="0" min="1" required />
          </div>
          <div className="modal-actions">
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancelar</button>
            <button type="submit" className="btn btn-primary">Agregar</button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Modal Editar Producto ────────────────────────────────────────────────────

function ModalEditarProducto({ producto, onSave, onClose }) {
  const [form, setForm] = useState({
    nombre: producto.nombre,
    costo: String(producto.costo),
    venta: String(producto.venta),
    stock: String(producto.stock),
  })
  const ref = useRef()
  useEffect(() => { ref.current?.focus() }, [])
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }))

  function handleSubmit(e) {
    e.preventDefault()
    onSave({ ...producto, nombre: form.nombre.trim(), costo: parseInt(form.costo) || 0, venta: parseInt(form.venta) || 0, stock: parseInt(form.stock) || 0 })
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-title">✏️ Editar Producto</div>
        <p style={{ color: 'var(--text-muted)', fontSize: 12, marginBottom: 16 }}>Código: <code style={{ color: 'var(--blue)' }}>{producto.codigo}</code></p>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="label">Nombre</label>
            <input ref={ref} className="input" value={form.nombre} onChange={e => set('nombre', e.target.value)} required />
          </div>
          <div className="grid-3" style={{ gap: 10 }}>
            <div className="form-group">
              <label className="label">Costo ($)</label>
              <input className="input" type="number" value={form.costo} onChange={e => set('costo', e.target.value)} min="0" />
            </div>
            <div className="form-group">
              <label className="label">Venta ($)</label>
              <input className="input" type="number" value={form.venta} onChange={e => set('venta', e.target.value)} min="0" required />
            </div>
            <div className="form-group">
              <label className="label">Stock</label>
              <input className="input" type="number" value={form.stock} onChange={e => set('stock', e.target.value)} min="0" />
            </div>
          </div>
          <div className="modal-actions">
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancelar</button>
            <button type="submit" className="btn btn-primary">Guardar</button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Modal Venta Manual ───────────────────────────────────────────────────────

function ModalVentaManual({ inventario, onVender, onClose }) {
  const [buscar, setBuscar] = useState('')
  const filtered = inventario.filter(p =>
    p.nombre.toLowerCase().includes(buscar.toLowerCase()) || p.codigo.includes(buscar)
  )

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 500 }}>
        <div className="modal-title">🛒 Venta Manual</div>
        <input className="input mb-3" placeholder="Buscar producto..." value={buscar} onChange={e => setBuscar(e.target.value)} autoFocus />
        <div style={{ maxHeight: 320, overflowY: 'auto' }}>
          {filtered.length === 0 && <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 20 }}>Sin resultados</p>}
          {filtered.map(p => (
            <div key={p.codigo} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
              <div>
                <div style={{ fontWeight: 600 }}>{p.nombre}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Stock: {p.stock} · {fmt(p.venta)}</div>
              </div>
              <button className="btn btn-success btn-sm" disabled={p.stock === 0} onClick={() => { onVender(p); onClose() }}>
                Vender
              </button>
            </div>
          ))}
        </div>
        <div className="modal-actions">
          <button className="btn btn-ghost" onClick={onClose}>Cerrar</button>
        </div>
      </div>
    </div>
  )
}

// ─── Modal Cuadratura ─────────────────────────────────────────────────────────

function ModalCuadratura({ turno, ventas, onCerrar, onClose }) {
  const ventasTurno = ventas.filter(v => v.turnoId === turno.id)
  const totalUnidades = ventasTurno.length
  const totalDinero = ventasTurno.reduce((s, v) => s + v.precio, 0)
  const totalCosto = ventasTurno.reduce((s, v) => s + (v.costo || 0), 0)
  const margen = totalDinero - totalCosto

  const porProducto = {}
  ventasTurno.forEach(v => {
    if (!porProducto[v.codigo]) porProducto[v.codigo] = { nombre: v.nombre, unidades: 0, total: 0 }
    porProducto[v.codigo].unidades++
    porProducto[v.codigo].total += v.precio
  })

  const turnoNombre = turno.tipo === 'manana' ? '🌅 Turno Mañana' : '🌆 Turno Tarde'
  const horaInicio = formatHora(turno.inicio)
  const horaFin = new Date().toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit', hour12: false })

  function exportarTexto() {
    const lineas = [
      `===== CUADRATURA ${turnoNombre} =====`,
      `Fecha: ${formatFecha(turno.inicio)}`,
      `Hora: ${horaInicio} → ${horaFin}`,
      ``,
      `📦 Total unidades vendidas: ${totalUnidades}`,
      `💰 Total recaudado: ${fmt(totalDinero)}`,
      `📉 Total costo: ${fmt(totalCosto)}`,
      `📈 Margen: ${fmt(margen)}`,
      ``,
      `--- DETALLE POR PRODUCTO ---`,
      ...Object.values(porProducto).map(p => `${p.nombre}: ${p.unidades} uds → ${fmt(p.total)}`),
      ``,
      `===========================`,
    ]
    navigator.clipboard.writeText(lineas.join('\n')).catch(() => {
      const el = document.createElement('textarea')
      el.value = lineas.join('\n')
      document.body.appendChild(el); el.select(); document.execCommand('copy'); document.body.removeChild(el)
    })
    alert('Cuadratura copiada al portapapeles ✓')
  }

  return (
    <div className="modal-overlay">
      <div className="modal" style={{ maxWidth: 520 }}>
        <div className="modal-title">📋 Cuadratura — {turnoNombre}</div>
        <div className="cuad-section">
          <h3>Resumen del turno</h3>
          {[
            ['Fecha', formatFecha(turno.inicio)],
            ['Horario', `${horaInicio} → ${horaFin}`],
            ['Unidades vendidas', <span className="fw-bold text-blue">{totalUnidades}</span>],
            ['Total recaudado', <span className="fw-bold text-green">{fmt(totalDinero)}</span>],
            ['Total costo', <span className="fw-bold text-red">{fmt(totalCosto)}</span>],
            ['Margen bruto', <span className="fw-bold" style={{ color: margen >= 0 ? 'var(--green)' : 'var(--red)' }}>{fmt(margen)}</span>],
          ].map(([label, val]) => (
            <div key={label} className="stat-row">
              <span className="text-muted">{label}</span>
              <span className="fw-bold">{val}</span>
            </div>
          ))}
        </div>
        {Object.keys(porProducto).length > 0 && (
          <div className="cuad-section">
            <h3>Detalle por producto</h3>
            {Object.values(porProducto).sort((a, b) => b.unidades - a.unidades).map((p, i) => (
              <div key={i} className="stat-row">
                <span>{p.nombre}</span>
                <div style={{ display: 'flex', gap: 16 }}>
                  <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>{p.unidades} uds</span>
                  <span className="fw-bold text-green">{fmt(p.total)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
        <div className="modal-actions">
          <button className="btn btn-ghost" onClick={exportarTexto}>📋 Copiar texto</button>
          <button className="btn btn-danger" onClick={onCerrar}>Cerrar turno</button>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>Cancelar</button>
        </div>
      </div>
    </div>
  )
}

// ─── Modal Scanner Cámara ─────────────────────────────────────────────────────

function ModalScannerCamara({ onScan, onClose }) {
  const videoRef = useRef()

  useEffect(() => {
    const reader = new BrowserMultiFormatReader()
    reader.decodeFromVideoDevice(null, videoRef.current, (result, err) => {
      if (result) {
        reader.reset()
        onScan(result.getText())
      }
    }).catch(() => {})
    return () => { try { reader.reset() } catch {} }
  }, [onScan])

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 380 }}>
        <div className="modal-title">📷 Escanear código de barras</div>
        <video ref={videoRef} style={{ width: '100%', borderRadius: 8, background: '#000', minHeight: 200 }} />
        <p style={{ color: 'var(--text-muted)', fontSize: 12, textAlign: 'center', marginTop: 10 }}>
          Apunta la cámara al código de barras
        </p>
        <div className="modal-actions">
          <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
        </div>
      </div>
    </div>
  )
}

// ─── Módulo Inventario ────────────────────────────────────────────────────────

function ModuloInventario({ inventario, onScanInventario, onEditProduct, onDeleteProduct, toast }) {
  const [scanCode, setScanCode] = useState('')
  const [buscar, setBuscar] = useState('')
  const [editando, setEditando] = useState(null)
  const [confirmDel, setConfirmDel] = useState(null)
  const [showCamera, setShowCamera] = useState(false)
  const scanRef = useRef()

  useEffect(() => { scanRef.current?.focus() }, [])

  function handleScan(e) {
    e.preventDefault()
    const code = scanCode.trim()
    if (!code) return
    onScanInventario(code)
    setScanCode('')
    setTimeout(() => scanRef.current?.focus(), 100)
  }

  const filtered = inventario.filter(p =>
    p.nombre.toLowerCase().includes(buscar.toLowerCase()) || p.codigo.includes(buscar)
  )

  const totalStock = inventario.reduce((s, p) => s + p.stock, 0)
  const totalValorVenta = inventario.reduce((s, p) => s + p.stock * p.venta, 0)
  const sinStock = inventario.filter(p => p.stock === 0).length

  return (
    <div>
      <div className="scanner-box">
        <h2>📷 Lector de código de barras — Inventario</h2>
        <form onSubmit={handleScan} style={{ display: 'flex', gap: 10 }}>
          <input
            ref={scanRef}
            className="scanner-input"
            value={scanCode}
            onChange={e => setScanCode(e.target.value)}
            placeholder="Escanea o escribe el código de barras..."
            autoComplete="off"
          />
          <button type="submit" className="btn btn-primary">Procesar</button>
          <button type="button" className="btn btn-ghost" onClick={() => setShowCamera(true)}>📷 Cámara</button>
        </form>
      </div>

      <div className="grid-3 mb-4">
        <div className="card"><div className="card-title">Productos</div><div className="card-value">{inventario.length}</div></div>
        <div className="card"><div className="card-title">Unidades en stock</div><div className="card-value">{totalStock}</div></div>
        <div className="card"><div className="card-title">Valor inventario</div><div className="card-value" style={{ fontSize: 18 }}>{fmt(totalValorVenta)}</div></div>
      </div>

      {sinStock > 0 && (
        <div className="stock-alert mb-3">
          <span style={{ fontSize: 20 }}>⚠️</span>
          <span><strong>{sinStock}</strong> producto{sinStock > 1 ? 's' : ''} sin stock</span>
        </div>
      )}

      <div className="card">
        <div className="section-header">
          <div className="section-title">📋 Inventario completo</div>
          <input className="input" style={{ maxWidth: 240 }} placeholder="Buscar..." value={buscar} onChange={e => setBuscar(e.target.value)} />
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Producto</th><th>Código</th><th>Stock</th><th>P. Venta</th><th>P. Costo</th><th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 24 }}>Sin productos</td></tr>
              )}
              {filtered.map(p => (
                <tr key={p.codigo}>
                  <td style={{ fontWeight: 600 }}>{p.nombre}</td>
                  <td><code style={{ color: 'var(--text-muted)', fontSize: 11 }}>{p.codigo}</code></td>
                  <td>
                    <span className={`badge ${p.stock === 0 ? 'badge-red' : p.stock <= 5 ? 'badge-yellow' : 'badge-green'}`}>
                      {p.stock}
                    </span>
                  </td>
                  <td className="text-green fw-bold">{fmt(p.venta)}</td>
                  <td className="text-muted">{fmt(p.costo)}</td>
                  <td style={{ display: 'flex', gap: 6 }}>
                    <button className="btn btn-ghost btn-sm" onClick={() => setEditando(p)}>✏️</button>
                    <button className="btn btn-danger btn-sm" onClick={() => setConfirmDel(p)}>🗑️</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {editando && (
        <ModalEditarProducto
          producto={editando}
          onSave={prod => { onEditProduct(prod); setEditando(null) }}
          onClose={() => setEditando(null)}
        />
      )}

      {confirmDel && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: 360 }}>
            <div className="modal-title">🗑️ Eliminar producto</div>
            <p>¿Eliminar <strong>{confirmDel.nombre}</strong>? Esta acción no se puede deshacer.</p>
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => setConfirmDel(null)}>Cancelar</button>
              <button className="btn btn-danger" onClick={() => { onDeleteProduct(confirmDel.codigo); setConfirmDel(null) }}>Eliminar</button>
            </div>
          </div>
        </div>
      )}

      {showCamera && (
        <ModalScannerCamara
          onScan={code => { onScanInventario(code); setShowCamera(false) }}
          onClose={() => setShowCamera(false)}
        />
      )}
    </div>
  )
}

// ─── Módulo Ventas ────────────────────────────────────────────────────────────

function ModuloVentas({ inventario, ventas, turnoActivo, onVender, toast }) {
  const [scanCode, setScanCode] = useState('')
  const [scanMsg, setScanMsg] = useState(null)
  const [showManual, setShowManual] = useState(false)
  const [showCamera, setShowCamera] = useState(false)
  const scanRef = useRef()

  useEffect(() => { scanRef.current?.focus() }, [])

  const ventasTurno = turnoActivo ? ventas.filter(v => v.turnoId === turnoActivo.id) : []
  const totalTurno = ventasTurno.reduce((s, v) => s + v.precio, 0)
  const recientes = [...ventasTurno].reverse().slice(0, 15)

  function processCode(code) {
    if (!turnoActivo) {
      setScanMsg({ type: 'error', text: 'No hay turno activo. Abre un turno primero.' })
      return
    }

    const prod = inventario.find(p => p.codigo === code)
    if (!prod) {
      setScanMsg({ type: 'error', text: `Código ${code} no encontrado en inventario` })
      setTimeout(() => { setScanMsg(null); scanRef.current?.focus() }, 3000)
      return
    }

    if (prod.stock <= 0) {
      setScanMsg({ type: 'warning', text: `⚠️ QUIEBRE DE STOCK: ${prod.nombre}` })
      setTimeout(() => { setScanMsg(null); scanRef.current?.focus() }, 3000)
      return
    }

    onVender(prod)
    setScanMsg({ type: 'success', text: `✓ Vendido: ${prod.nombre} — ${fmt(prod.venta)}` })
    setTimeout(() => { setScanMsg(null); scanRef.current?.focus() }, 1500)
  }

  function handleScan(e) {
    e.preventDefault()
    const code = scanCode.trim()
    if (!code) return
    setScanCode('')
    processCode(code)
  }

  return (
    <div>
      <div className="scanner-box">
        <h2>🛒 Lector de código de barras — Ventas</h2>
        {!turnoActivo && (
          <div className="scan-feedback error" style={{ marginBottom: 10 }}>
            ⚠️ No hay turno activo. Abre un turno para registrar ventas.
          </div>
        )}
        <form onSubmit={handleScan} style={{ display: 'flex', gap: 10 }}>
          <input
            ref={scanRef}
            className="scanner-input"
            value={scanCode}
            onChange={e => setScanCode(e.target.value)}
            placeholder="Escanea el código de barras..."
            autoComplete="off"
            disabled={!turnoActivo}
          />
          <button type="submit" className="btn btn-success" disabled={!turnoActivo}>Vender</button>
          <button type="button" className="btn btn-ghost" onClick={() => setShowManual(true)} disabled={!turnoActivo}>Manual</button>
          <button type="button" className="btn btn-ghost" onClick={() => setShowCamera(true)} disabled={!turnoActivo}>📷 Cámara</button>
        </form>
        {scanMsg && <div className={`scan-feedback ${scanMsg.type}`}>{scanMsg.text}</div>}
      </div>

      <div className="grid-4 mb-4">
        <div className="card"><div className="card-title">Ventas del turno</div><div className="card-value text-blue">{ventasTurno.length}</div></div>
        <div className="card"><div className="card-title">Recaudado</div><div className="card-value" style={{ fontSize: 18, color: 'var(--green)' }}>{fmt(totalTurno)}</div></div>
        <div className="card">
          <div className="card-title">Ticket promedio</div>
          <div className="card-value" style={{ fontSize: 18 }}>
            {ventasTurno.length ? fmt(Math.round(totalTurno / ventasTurno.length)) : fmt(0)}
          </div>
        </div>
        <div className="card"><div className="card-title">Sin stock</div><div className="card-value red">{inventario.filter(p => p.stock === 0).length}</div></div>
      </div>

      <div className="card">
        <div className="section-title mb-3">⚡ Ventas recientes del turno</div>
        {recientes.length === 0 && (
          <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 24 }}>Sin ventas en este turno</p>
        )}
        {recientes.map(v => (
          <div key={v.id} className="venta-item">
            <span className="venta-hora">{formatHora(v.ts)}</span>
            <span className="venta-nombre">{v.nombre}</span>
            <span className="venta-precio">{fmt(v.precio)}</span>
          </div>
        ))}
      </div>

      {showManual && (
        <ModalVentaManual
          inventario={inventario.filter(p => p.stock > 0)}
          onVender={prod => { onVender(prod); toast(`Vendido: ${prod.nombre}`, 'success', '✓') }}
          onClose={() => { setShowManual(false); setTimeout(() => scanRef.current?.focus(), 100) }}
        />
      )}

      {showCamera && (
        <ModalScannerCamara
          onScan={code => { setShowCamera(false); processCode(code) }}
          onClose={() => setShowCamera(false)}
        />
      )}
    </div>
  )
}

// ─── Módulo Historial ─────────────────────────────────────────────────────────

function ModuloHistorial({ ventas }) {
  const [filtroTurno, setFiltroTurno] = useState('todos')
  const [filtroFecha, setFiltroFecha] = useState('')

  const filtered = ventas.filter(v => {
    if (filtroTurno !== 'todos' && v.turno !== filtroTurno) return false
    if (filtroFecha && !v.ts.startsWith(filtroFecha)) return false
    return true
  })

  const porTurno = {}
  ventas.forEach(v => {
    const key = `${formatFecha(v.ts)} ${v.turno === 'manana' ? 'Mañana' : 'Tarde'}`
    if (!porTurno[key]) porTurno[key] = { name: key, ventas: 0, total: 0 }
    porTurno[key].ventas++
    porTurno[key].total += v.precio
  })
  const chartData = Object.values(porTurno).slice(-14)
  const totalFiltrado = filtered.reduce((s, v) => s + v.precio, 0)

  return (
    <div>
      <div className="card mb-4">
        <div className="section-title mb-3">📊 Ventas por turno</div>
        {chartData.length === 0 ? (
          <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 24 }}>Sin datos</p>
        ) : (
          <div className="chart-container">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 5, right: 20, left: 10, bottom: 60 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2d3148" />
                <XAxis dataKey="name" tick={{ fill: '#8892a4', fontSize: 11 }} angle={-40} textAnchor="end" interval={0} />
                <YAxis tick={{ fill: '#8892a4', fontSize: 11 }} />
                <Tooltip
                  contentStyle={{ background: '#1a1d27', border: '1px solid #2d3148', borderRadius: 8, color: '#e2e8f0' }}
                  formatter={(val, name) => [name === 'total' ? fmt(val) : val, name === 'total' ? 'Recaudado' : 'Ventas']}
                />
                <Bar dataKey="ventas" fill="#3b82f6" radius={[4, 4, 0, 0]} name="ventas" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      <div className="card">
        <div className="section-header">
          <div className="section-title">📋 Historial de ventas</div>
          <div style={{ color: 'var(--green)', fontWeight: 700 }}>{fmt(totalFiltrado)}</div>
        </div>
        <div className="filter-bar">
          <select className="select" value={filtroTurno} onChange={e => setFiltroTurno(e.target.value)}>
            <option value="todos">Todos los turnos</option>
            <option value="manana">🌅 Mañana</option>
            <option value="tarde">🌆 Tarde</option>
          </select>
          <input className="input" type="date" style={{ maxWidth: 180 }} value={filtroFecha} onChange={e => setFiltroFecha(e.target.value)} />
          {(filtroTurno !== 'todos' || filtroFecha) && (
            <button className="btn btn-ghost btn-sm" onClick={() => { setFiltroTurno('todos'); setFiltroFecha('') }}>✕ Limpiar</button>
          )}
          <span style={{ marginLeft: 'auto', color: 'var(--text-muted)', fontSize: 12 }}>{filtered.length} registros</span>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Fecha</th><th>Hora</th><th>Turno</th><th>Producto</th><th>Precio</th></tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 24 }}>Sin registros</td></tr>
              )}
              {[...filtered].reverse().slice(0, 200).map(v => (
                <tr key={v.id}>
                  <td className="text-muted">{formatFecha(v.ts)}</td>
                  <td style={{ fontVariantNumeric: 'tabular-nums' }}>{formatHora(v.ts)}</td>
                  <td>
                    <span className={`badge ${v.turno === 'manana' ? 'badge-yellow' : 'badge-purple'}`}>
                      {v.turno === 'manana' ? '🌅 Mañana' : '🌆 Tarde'}
                    </span>
                  </td>
                  <td style={{ fontWeight: 600 }}>{v.nombre}</td>
                  <td className="text-green fw-bold">{fmt(v.precio)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// ─── App Principal ────────────────────────────────────────────────────────────

export default function App() {
  const [tab, setTab] = useState('ventas')
  const [inventario, setInventario] = useState([])
  const [ventas, setVentas] = useState([])
  const [turnoActivo, setTurnoActivo] = useState(null)
  const [loading, setLoading] = useState(true)
  const [hora, setHora] = useState('')

  const [modalNuevo, setModalNuevo] = useState(null)
  const [modalStock, setModalStock] = useState(null)
  const [modalCuad, setModalCuad] = useState(false)

  const { toasts, add: toast } = useToast()

  // Carga inicial desde API
  useEffect(() => {
    Promise.all([
      api('GET', '/api/inventario'),
      api('GET', '/api/ventas'),
      api('GET', '/api/turno-activo'),
    ]).then(([inv, ven, turno]) => {
      setInventario(inv)
      setVentas(ven)
      setTurnoActivo(turno)
      setLoading(false)
    }).catch(err => {
      console.error('Error cargando datos:', err)
      setLoading(false)
    })
  }, [])

  // Reloj
  useEffect(() => {
    const tick = () => {
      const d = new Date()
      setHora(d.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }))
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [])

  const turnoSugerido = getTurnoActual()

  async function abrirTurno() {
    const tipo = turnoSugerido || 'manana'
    const t = { id: ts(), tipo, inicio: ts(), stockInicio: inventario.map(p => ({ codigo: p.codigo, stock: p.stock })) }
    await api('PUT', '/api/turno-activo', t)
    setTurnoActivo(t)
    toast(`Turno ${tipo === 'manana' ? 'Mañana' : 'Tarde'} abierto`, 'success', '✓')
  }

  function cerrarTurno() { setModalCuad(true) }

  async function confirmarCierreTurno() {
    await api('POST', '/api/turnos', { ...turnoActivo, fin: ts() })
    await api('DELETE', '/api/turno-activo')
    setTurnoActivo(null)
    setModalCuad(false)
    toast('Turno cerrado correctamente', 'info', 'ℹ️')
  }

  function handleScanInventario(code) {
    const existe = inventario.find(p => p.codigo === code)
    if (existe) setModalStock(existe)
    else setModalNuevo(code)
  }

  async function guardarNuevoProducto(prod) {
    await api('POST', '/api/inventario', prod)
    setInventario(p => [...p, prod])
    setModalNuevo(null)
    toast(`Producto "${prod.nombre}" creado`, 'success', '✓')
  }

  async function agregarStock(producto, cantidad) {
    const updated = await api('PATCH', `/api/inventario/${producto.codigo}/stock`, { delta: cantidad })
    setInventario(p => p.map(x => x.codigo === updated.codigo ? updated : x))
    setModalStock(null)
    toast(`+${cantidad} unidades a "${producto.nombre}"`, 'success', '✓')
  }

  async function registrarVenta(prod) {
    if (!turnoActivo) return
    const venta = {
      id: `${ts()}-${Math.random().toString(36).slice(2, 6)}`,
      ts: ts(),
      codigo: prod.codigo,
      nombre: prod.nombre,
      precio: prod.venta,
      costo: prod.costo,
      turno: turnoActivo.tipo,
      turnoId: turnoActivo.id,
    }
    await api('POST', '/api/ventas', venta)
    const updated = await api('PATCH', `/api/inventario/${prod.codigo}/stock`, { delta: -1 })
    setVentas(p => [...p, venta])
    setInventario(p => p.map(x => x.codigo === updated.codigo ? updated : x))
    if (updated.stock === 0) {
      toast(`⚠️ QUIEBRE: ${prod.nombre} sin stock`, 'error', '⚠️')
    }
  }

  async function onEditProduct(prod) {
    const updated = await api('PUT', `/api/inventario/${prod.codigo}`, prod)
    setInventario(p => p.map(x => x.codigo === updated.codigo ? updated : x))
    toast('Producto actualizado', 'success', '✓')
  }

  async function onDeleteProduct(codigo) {
    await api('DELETE', `/api/inventario/${codigo}`)
    setInventario(p => p.filter(x => x.codigo !== codigo))
    toast('Producto eliminado', 'warning', '⚠️')
  }

  const turnoLabel = turnoActivo
    ? (turnoActivo.tipo === 'manana' ? '🌅 Turno Mañana' : '🌆 Turno Tarde')
    : 'Sin turno'
  const turnoClass = turnoActivo ? turnoActivo.tipo : 'cerrado'
  const ventasTurno = turnoActivo ? ventas.filter(v => v.turnoId === turnoActivo.id) : []

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', flexDirection: 'column', gap: 16, color: 'var(--text-muted)' }}>
        <div style={{ fontSize: 40 }}>🚬</div>
        <div style={{ fontSize: 15 }}>Cargando datos...</div>
      </div>
    )
  }

  return (
    <div className="app">
      <ToastContainer toasts={toasts} />

      <header className="header">
        <div className="header-left">
          <div className="logo">🚬 <span>Control</span> Cigarro</div>
          <div className={`turno-badge ${turnoClass}`}>
            <span className="dot" />
            {turnoLabel}
            {turnoActivo && <span style={{ opacity: 0.7 }}>· {ventasTurno.length} ventas</span>}
          </div>
        </div>
        <div className="header-right">
          <div className="clock">{hora}</div>
          {!turnoActivo ? (
            <button className="btn btn-success" onClick={abrirTurno}>
              ▶ Abrir turno{turnoSugerido ? ` (${turnoSugerido === 'manana' ? 'Mañana' : 'Tarde'})` : ''}
            </button>
          ) : (
            <button className="btn btn-warning" onClick={cerrarTurno}>
              ■ Cerrar / Cuadratura
            </button>
          )}
        </div>
      </header>

      <nav className="nav">
        {[
          { id: 'ventas', label: '🛒 Ventas' },
          { id: 'inventario', label: '📦 Inventario' },
          { id: 'historial', label: '📊 Historial' },
        ].map(t => (
          <button key={t.id} className={`nav-btn ${tab === t.id ? 'active' : ''}`} onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </nav>

      <main className="main">
        {tab === 'ventas' && (
          <ModuloVentas
            inventario={inventario}
            ventas={ventas}
            turnoActivo={turnoActivo}
            onVender={registrarVenta}
            toast={toast}
          />
        )}
        {tab === 'inventario' && (
          <ModuloInventario
            inventario={inventario}
            onScanInventario={handleScanInventario}
            onEditProduct={onEditProduct}
            onDeleteProduct={onDeleteProduct}
            toast={toast}
          />
        )}
        {tab === 'historial' && <ModuloHistorial ventas={ventas} />}
      </main>

      {modalNuevo && (
        <ModalNuevoProducto
          codigo={modalNuevo}
          onSave={guardarNuevoProducto}
          onClose={() => setModalNuevo(null)}
        />
      )}
      {modalStock && (
        <ModalAgregarStock
          producto={modalStock}
          onSave={qty => agregarStock(modalStock, qty)}
          onClose={() => setModalStock(null)}
        />
      )}
      {modalCuad && turnoActivo && (
        <ModalCuadratura
          turno={turnoActivo}
          ventas={ventas}
          onCerrar={confirmarCierreTurno}
          onClose={() => setModalCuad(false)}
        />
      )}
    </div>
  )
}
