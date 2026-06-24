import express from 'express'
import { fileURLToPath } from 'url'
import path from 'path'
import { readFile } from 'fs/promises'
import pg from 'pg'

const { Pool } = pg
const __dirname = path.dirname(fileURLToPath(import.meta.url))

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false,
})

// Inicializar schema al arrancar
const initSql = await readFile(path.join(__dirname, 'db/init.sql'), 'utf8')
await pool.query(initSql)
console.log('Base de datos inicializada')

const app = express()
app.use(express.json())

// ─── Inventario ───────────────────────────────────────────────────────────────

app.get('/api/inventario', async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM inventario ORDER BY nombre')
  res.json(rows)
})

app.post('/api/inventario', async (req, res) => {
  const { codigo, nombre, costo, venta, stock } = req.body
  const { rows } = await pool.query(
    'INSERT INTO inventario (codigo, nombre, costo, venta, stock) VALUES ($1,$2,$3,$4,$5) RETURNING *',
    [codigo, nombre, costo, venta, stock]
  )
  res.status(201).json(rows[0])
})

app.put('/api/inventario/:codigo', async (req, res) => {
  const { nombre, costo, venta, stock } = req.body
  const { rows } = await pool.query(
    'UPDATE inventario SET nombre=$1, costo=$2, venta=$3, stock=$4 WHERE codigo=$5 RETURNING *',
    [nombre, costo, venta, stock, req.params.codigo]
  )
  if (!rows.length) return res.status(404).json({ error: 'No encontrado' })
  res.json(rows[0])
})

app.patch('/api/inventario/:codigo/stock', async (req, res) => {
  const { delta } = req.body
  const { rows } = await pool.query(
    'UPDATE inventario SET stock = GREATEST(0, stock + $1) WHERE codigo=$2 RETURNING *',
    [delta, req.params.codigo]
  )
  if (!rows.length) return res.status(404).json({ error: 'No encontrado' })
  res.json(rows[0])
})

app.delete('/api/inventario/:codigo', async (req, res) => {
  await pool.query('DELETE FROM inventario WHERE codigo=$1', [req.params.codigo])
  res.status(204).end()
})

// ─── Ventas ───────────────────────────────────────────────────────────────────

app.get('/api/ventas', async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM ventas ORDER BY ts')
  // Mapear turno_id → turnoId para el frontend
  res.json(rows.map(v => ({ ...v, turnoId: v.turno_id })))
})

app.post('/api/ventas', async (req, res) => {
  const { id, ts, codigo, nombre, precio, costo, turno, turnoId } = req.body
  const { rows } = await pool.query(
    'INSERT INTO ventas (id, ts, codigo, nombre, precio, costo, turno, turno_id) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *',
    [id, ts, codigo, nombre, precio, costo, turno, turnoId]
  )
  res.status(201).json({ ...rows[0], turnoId: rows[0].turno_id })
})

// ─── Turno activo ─────────────────────────────────────────────────────────────

app.get('/api/turno-activo', async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM turno_activo WHERE id=$1', ['singleton'])
  const row = rows[0]
  if (!row || !row.turno_id) return res.json(null)
  res.json({
    id: row.turno_id,
    tipo: row.tipo,
    inicio: row.inicio,
    stockInicio: row.stock_inicio,
  })
})

app.put('/api/turno-activo', async (req, res) => {
  const { id, tipo, inicio, stockInicio } = req.body
  await pool.query(
    'UPDATE turno_activo SET turno_id=$1, tipo=$2, inicio=$3, stock_inicio=$4 WHERE id=$5',
    [id, tipo, inicio, JSON.stringify(stockInicio), 'singleton']
  )
  res.json({ id, tipo, inicio, stockInicio })
})

app.delete('/api/turno-activo', async (req, res) => {
  await pool.query(
    'UPDATE turno_activo SET turno_id=NULL, tipo=NULL, inicio=NULL, stock_inicio=$1 WHERE id=$2',
    ['[]', 'singleton']
  )
  res.status(204).end()
})

// ─── Turnos (historial) ───────────────────────────────────────────────────────

app.get('/api/turnos', async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM turnos ORDER BY inicio')
  res.json(rows.map(t => ({ ...t, stockInicio: t.stock_inicio })))
})

app.post('/api/turnos', async (req, res) => {
  const { id, tipo, inicio, fin, stockInicio } = req.body
  const { rows } = await pool.query(
    'INSERT INTO turnos (id, tipo, inicio, fin, stock_inicio) VALUES ($1,$2,$3,$4,$5) ON CONFLICT (id) DO UPDATE SET fin=$4 RETURNING *',
    [id, tipo, inicio, fin, JSON.stringify(stockInicio)]
  )
  res.status(201).json({ ...rows[0], stockInicio: rows[0].stock_inicio })
})

// ─── Static (producción) ──────────────────────────────────────────────────────

if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, 'dist')))
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'dist/index.html'))
  })
}

const PORT = process.env.PORT || 3000
app.listen(PORT, () => console.log(`Servidor corriendo en puerto ${PORT}`))
