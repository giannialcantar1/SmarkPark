import { useEffect, useMemo, useState } from 'react'

import { apiGet, getCachedApiData } from '../lib/api'
import { downloadCsv } from '../lib/exportCsv'
import { DEFAULT_FLOORS, buildFloorIndex, resolveVehicleFloor } from '../lib/floors'

const PERIODS = [
  { key: 'hoy', label: 'Hoy' },
  { key: 'semana', label: 'Semana' },
  { key: 'mes', label: 'Mes' },
]

const PAGE = {
  bg: 'var(--bg)',
  card: 'var(--surface)',
  cardDeep: 'var(--surface2)',
  text: 'var(--text)',
  dim: 'var(--text-dim)',
  border: 'var(--border)',
  accent: 'var(--accent)',
  accent2: 'var(--accent2)',
  success: 'var(--success)',
  warning: 'var(--accent2)',
}

const formatCurrency = (value) =>
  new Intl.NumberFormat('es-DO', {
    style: 'currency',
    currency: 'DOP',
    minimumFractionDigits: 2,
  }).format(Number(value || 0))

const formatCompactCurrency = (value) =>
  new Intl.NumberFormat('es-DO', {
    style: 'currency',
    currency: 'DOP',
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(Number(value || 0))

const parseDate = (value) => {
  if (!value) return null
  const date = new Date(String(value).replace('Z', '+00:00'))
  return Number.isNaN(date.getTime()) ? null : date
}

const formatDate = (value) => {
  const date = parseDate(value)
  if (!date) return '--'
  return new Intl.DateTimeFormat('es-DO', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date)
}

const formatTime = (value) => {
  const date = parseDate(value)
  if (!date) return '--'
  return new Intl.DateTimeFormat('es-DO', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

const formatDuration = (startValue, endValue) => {
  const start = parseDate(startValue)
  const end = parseDate(endValue)
  if (!start) return '--'
  const finish = end || new Date()
  const totalMinutes = Math.max(0, Math.round((finish.getTime() - start.getTime()) / 60000))
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  if (!hours) return `${minutes} min`
  if (!minutes) return `${hours}h`
  return `${hours}h ${minutes}m`
}

const getDurationMinutes = (startValue, endValue) => {
  const start = parseDate(startValue)
  const end = parseDate(endValue)
  if (!start) return 0
  const finish = end || new Date()
  return Math.max(0, Math.round((finish.getTime() - start.getTime()) / 60000))
}

const startOfDay = (date) => new Date(date.getFullYear(), date.getMonth(), date.getDate())

const getPeriodLabel = (periodKey) =>
  PERIODS.find((item) => item.key === periodKey)?.label || periodKey

const getFloorLabel = (floor) => (floor === 'todos' ? 'Todos los pisos' : `Piso ${floor}`)

const isWithinPeriod = (date, periodKey) => {
  if (!date) return false
  const now = new Date()
  const todayStart = startOfDay(now)

  if (periodKey === 'hoy') {
    return date >= todayStart
  }

  if (periodKey === 'semana') {
    const weekStart = new Date(todayStart)
    weekStart.setDate(todayStart.getDate() - 6)
    return date >= weekStart
  }

  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  return date >= monthStart
}

const normalizeVehicle = (vehicle, floorIndex) => {
  const entry = vehicle?.hora_entrada || vehicle?.entry_time || null
  const exit = vehicle?.hora_salida || vehicle?.exit_time || null
  const status = String(vehicle?.status || vehicle?.estado || '').toLowerCase()
  const floor = resolveVehicleFloor(vehicle, floorIndex)
  const amount = Number(vehicle?.monto_total || vehicle?.total_amount || 0)

  return {
    id: vehicle?.id || `${vehicle?.placa || 'vehiculo'}-${entry || 'sin-fecha'}`,
    placa: vehicle?.placa || 'Sin placa',
    modelo: vehicle?.modelo || vehicle?.model || 'Vehículo registrado',
    propietario: vehicle?.propietario || vehicle?.owner || 'Sin propietario',
    piso: floor || '--',
    entry,
    exit,
    status,
    amount,
    location:
      vehicle?.espacio ||
      vehicle?.ubicacion ||
      vehicle?.numero_mostrar ||
      vehicle?.space_label ||
      'Sin espacio',
  }
}

const buildDailyTotals = (rows, periodKey) => {
  const labels = periodKey === 'hoy'
    ? ['00h', '04h', '08h', '12h', '16h', '20h']
    : ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

  const totals = labels.map(() => 0)

  rows.forEach((row) => {
    const source = parseDate(row.exit || row.entry)
    if (!source) return

    if (periodKey === 'hoy') {
      const bucket = Math.min(5, Math.floor(source.getHours() / 4))
      totals[bucket] += row.amount
      return
    }

    const day = (source.getDay() + 6) % 7
    totals[day] += row.amount
  })

  const max = Math.max(...totals, 1)
  return labels.map((label, index) => ({
    label,
    value: totals[index],
    height: Math.max(10, Math.round((totals[index] / max) * 100)),
  }))
}

const buildExportBaseFilename = ({ period, floor }) => {
  const now = new Date()
  const yyyy = now.getFullYear()
  const mm = String(now.getMonth() + 1).padStart(2, '0')
  const dd = String(now.getDate()).padStart(2, '0')
  const floorLabel = floor === 'todos' ? 'todos-los-pisos' : `piso-${String(floor).toLowerCase()}`

  return `smartpark-reportes-${period}-${floorLabel}-${yyyy}-${mm}-${dd}`
}

const buildExportRows = (rows) =>
  rows.map((row) => ({
    fecha: formatDate(row.exit || row.entry),
    hora: formatTime(row.exit || row.entry),
    piso: row.piso || '--',
    placa: row.placa || 'Sin placa',
    propietario: row.propietario || 'Sin propietario',
    ubicacion: row.location || 'Sin espacio',
    estado: row.status === 'dentro' ? 'Dentro' : 'Fuera',
    entrada: row.entry ? `${formatDate(row.entry)} ${formatTime(row.entry)}` : '--',
    salida: row.exit ? `${formatDate(row.exit)} ${formatTime(row.exit)}` : '--',
    duracion: formatDuration(row.entry, row.exit),
    monto_dop: Number(row.amount || 0).toFixed(2),
  }))

const downloadBlob = ({ filename, blob }) => {
  const url = window.URL.createObjectURL(blob)
  const link = document.createElement('a')

  link.href = url
  link.download = filename
  link.style.display = 'none'

  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  window.URL.revokeObjectURL(url)
}

const drawPdfStatCard = (doc, { x, y, width, height, label, value, accent }) => {
  doc.setFillColor(248, 250, 252)
  doc.setDrawColor(226, 232, 240)
  doc.roundedRect(x, y, width, height, 16, 16, 'FD')

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.setTextColor(71, 85, 105)
  doc.text(label, x + 14, y + 18)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(16)
  doc.setTextColor(...accent)
  doc.text(String(value), x + 14, y + 42)
}

const renderChartImage = async ({ type, data, options, width = 900, height = 460 }) => {
  const chartModule = await import('chart.js/auto')
  const Chart = chartModule.default || chartModule.Chart

  if (!Chart) {
    throw new Error('Chart.js no pudo cargarse para exportar el PDF.')
  }

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height

  const context = canvas.getContext('2d')
  context.fillStyle = '#ffffff'
  context.fillRect(0, 0, width, height)

  const chart = new Chart(context, {
    type,
    data,
    options: {
      responsive: false,
      animation: false,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          labels: {
            color: '#0f172a',
            font: { family: 'Arial', size: 12, weight: '600' },
          },
        },
        tooltip: { enabled: false },
      },
      scales:
        type === 'pie'
          ? undefined
          : {
              x: {
                grid: { display: false },
                ticks: { color: '#475569', font: { family: 'Arial', size: 11 } },
              },
              y: {
                beginAtZero: true,
                grid: { color: 'rgba(148, 163, 184, 0.25)' },
                ticks: { color: '#475569', font: { family: 'Arial', size: 11 } },
              },
            },
      ...options,
    },
  })

  chart.update('none')

  const dataUrl = canvas.toDataURL('image/png', 1)
  chart.destroy()

  return dataUrl
}

const addPdfTable = (doc, { title, columns, rows, startY, marginX = 40 }) => {
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const bottomMargin = 40
  const tableWidth = pageWidth - marginX * 2
  const columnWidths = columns.map((column) => tableWidth * column.width)
  let y = startY

  const drawTitle = (label) => {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(13)
    doc.setTextColor(15, 23, 42)
    doc.text(label, marginX, y)
    y += 14
  }

  const drawHeader = () => {
    doc.setFillColor(241, 245, 249)
    doc.roundedRect(marginX, y, tableWidth, 24, 8, 8, 'F')

    let cellX = marginX + 8
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    doc.setTextColor(51, 65, 85)
    columns.forEach((column, index) => {
      doc.text(column.label, cellX, y + 16)
      cellX += columnWidths[index]
    })
    y += 30
  }

  const ensureSpace = (requiredHeight) => {
    if (y + requiredHeight <= pageHeight - bottomMargin) return
    doc.addPage()
    y = 40
    drawTitle(`${title} (continuación)`)
    drawHeader()
  }

  drawTitle(title)
  drawHeader()

  rows.forEach((row, rowIndex) => {
    const cellLines = columns.map((column, index) =>
      doc.splitTextToSize(String(row?.[column.key] ?? ''), Math.max(24, columnWidths[index] - 10)),
    )
    const lineCount = Math.max(...cellLines.map((lines) => Math.max(lines.length, 1)))
    const rowHeight = Math.max(22, lineCount * 10 + 8)

    ensureSpace(rowHeight + 4)

    if (rowIndex % 2 === 0) {
      doc.setFillColor(248, 250, 252)
      doc.roundedRect(marginX, y - 2, tableWidth, rowHeight, 6, 6, 'F')
    }

    let cellX = marginX + 8
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.setTextColor(15, 23, 42)

    cellLines.forEach((lines, index) => {
      doc.text(lines, cellX, y + 10)
      cellX += columnWidths[index]
    })

    y += rowHeight + 4
  })

  return y
}

const styles = {
  page: {
    width: '100%',
    maxWidth: 1440,
    margin: '0 auto',
    color: PAGE.text,
    fontFamily: "'DM Sans', system-ui, sans-serif",
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: 20,
    alignItems: 'flex-start',
    marginBottom: 24,
    flexWrap: 'wrap',
  },
  title: {
    margin: 0,
    fontFamily: "'Syne', sans-serif",
    fontSize: 'clamp(1.9rem, 3vw, 2.4rem)',
    lineHeight: 1,
    letterSpacing: '-0.04em',
    background: 'linear-gradient(135deg, #e2e8f0 30%, var(--accent) 100%)',
    WebkitBackgroundClip: 'text',
    backgroundClip: 'text',
    color: 'transparent',
  },
  subtitle: { margin: '10px 0 0', color: PAGE.dim, fontSize: '1rem' },
  controls: { display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'flex-end' },
  pillGroup: {
    display: 'flex',
    gap: 8,
    flexWrap: 'wrap',
  },
  exportRow: {
    display: 'flex',
    gap: 10,
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
  },
  pill: (active, mode = 'primary') => ({
    borderRadius: 999,
    padding: '10px 18px',
    border: `1px solid ${active ? 'rgba(56,189,248,0.45)' : PAGE.border}`,
    background:
      mode === 'floor'
        ? active
          ? 'rgba(129,140,248,0.18)'
          : PAGE.card
        : active
          ? PAGE.accent
          : PAGE.card,
    color:
      mode === 'floor'
        ? active
          ? PAGE.accent2
          : PAGE.text
        : active
          ? '#08101e'
          : PAGE.text,
    fontWeight: 700,
    cursor: 'pointer',
    fontFamily: 'inherit',
  }),
  metrics: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
    gap: 16,
    marginBottom: 20,
  },
  card: {
    background: PAGE.card,
    border: `1px solid ${PAGE.border}`,
    borderRadius: 20,
    padding: 22,
    boxShadow: '0 18px 32px rgba(2, 8, 23, 0.22)',
  },
  cardLabel: {
    fontSize: 11,
    letterSpacing: '0.12em',
    textTransform: 'uppercase',
    color: PAGE.dim,
    marginBottom: 12,
    fontWeight: 700,
  },
  cardValue: (color = PAGE.text) => ({
    fontFamily: "'Syne', sans-serif",
    fontSize: 'clamp(1.45rem, 2.4vw, 2rem)',
    fontWeight: 800,
    letterSpacing: '-0.03em',
    lineHeight: 1,
    color,
  }),
  cardSub: { marginTop: 10, color: PAGE.dim, fontSize: 13, lineHeight: 1.5 },
  progressTrack: {
    height: 6,
    borderRadius: 999,
    background: 'rgba(129,140,248,0.12)',
    overflow: 'hidden',
    marginTop: 14,
  },
  progressFill: (width) => ({
    width: `${width}%`,
    height: '100%',
    background: 'linear-gradient(90deg, var(--accent), var(--accent2))',
    borderRadius: 999,
    transition: 'width 0.8s cubic-bezier(0.34,1.56,0.64,1)',
  }),
  contentGrid: {
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1.15fr) minmax(320px, 0.85fr)',
    gap: 18,
  },
  tableCard: {
    background: PAGE.card,
    border: `1px solid ${PAGE.border}`,
    borderRadius: 20,
    overflow: 'hidden',
  },
  sectionHead: {
    padding: '20px 24px 12px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 16,
  },
  sectionTitle: {
    margin: 0,
    fontFamily: "'Syne', sans-serif",
    fontSize: 20,
    fontWeight: 700,
    letterSpacing: '-0.03em',
  },
  sectionSub: { margin: '6px 0 0', color: PAGE.dim, fontSize: 14 },
  tableHead: {
    display: 'grid',
    gridTemplateColumns: '1fr 0.8fr 0.9fr 1.1fr 0.8fr 1fr',
    gap: 12,
    padding: '14px 24px',
    borderTop: `1px solid rgba(99,179,237,0.06)`,
    borderBottom: `1px solid rgba(99,179,237,0.06)`,
    background: 'rgba(56,189,248,0.04)',
    color: PAGE.dim,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: '0.1em',
    fontWeight: 700,
  },
  row: {
    display: 'grid',
    gridTemplateColumns: '1fr 0.8fr 0.9fr 1.1fr 0.8fr 1fr',
    gap: 12,
    padding: '16px 24px',
    alignItems: 'center',
    borderBottom: '1px solid rgba(99,179,237,0.06)',
    fontSize: 14,
  },
  rowDim: { color: PAGE.dim },
  badgeFloor: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    minWidth: 28,
    padding: '4px 8px',
    background: 'rgba(129,140,248,0.12)',
    color: PAGE.accent2,
    fontWeight: 700,
  },
  empty: { padding: 32, textAlign: 'center', color: PAGE.dim },
  chartCard: {
    background: PAGE.card,
    border: `1px solid ${PAGE.border}`,
    borderRadius: 20,
    padding: 22,
  },
  chartBars: (count) => ({
    display: 'grid',
    gridTemplateColumns: `repeat(${count}, minmax(0, 1fr))`,
    gap: 12,
    alignItems: 'end',
    minHeight: 180,
    marginTop: 20,
  }),
  chartBarWrap: { display: 'grid', gap: 10, justifyItems: 'center' },
  chartBar: (height, active) => ({
    width: '100%',
    maxWidth: 46,
    minHeight: 14,
    height: `${height}%`,
    borderRadius: '12px 12px 8px 8px',
    background: active
      ? 'linear-gradient(180deg, var(--accent), rgba(56,189,248,0.38))'
      : 'linear-gradient(180deg, rgba(56,189,248,0.72), rgba(129,140,248,0.22))',
    boxShadow: active ? '0 14px 28px rgba(56,189,248,0.2)' : 'none',
    transition: 'height 0.8s cubic-bezier(0.34,1.56,0.64,1)',
  }),
  chartLabel: { color: PAGE.dim, fontSize: 12, fontWeight: 600 },
  chartAmount: {
    fontFamily: "'Syne', sans-serif",
    fontSize: 13,
    color: PAGE.success,
    fontWeight: 700,
    letterSpacing: '-0.03em',
  },
  sideStack: { display: 'grid', gap: 18 },
  floorGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))',
    gap: 12,
    marginTop: 18,
  },
  floorCard: {
    background: PAGE.cardDeep,
    border: `1px solid ${PAGE.border}`,
    borderRadius: 16,
    padding: 16,
  },
  floorName: {
    fontFamily: "'Syne', sans-serif",
    fontWeight: 700,
    fontSize: 20,
    margin: 0,
  },
  floorMeta: { marginTop: 8, fontSize: 13, color: PAGE.dim },
  feedbackError: {
    borderRadius: 14,
    padding: '12px 16px',
    marginBottom: 16,
    background: 'rgba(248,113,113,0.14)',
    border: '1px solid rgba(248,113,113,0.25)',
    color: '#fecaca',
    fontWeight: 600,
  },
  exportButton: (disabled, tone = 'csv') => {
    const tones = {
      csv: {
        border: 'rgba(34,197,94,0.28)',
        background: 'rgba(34,197,94,0.14)',
        color: '#bbf7d0',
      },
      pdf: {
        border: 'rgba(249,115,22,0.28)',
        background: 'rgba(249,115,22,0.14)',
        color: '#fed7aa',
      },
      powerBi: {
        border: 'rgba(234,179,8,0.28)',
        background: 'rgba(234,179,8,0.14)',
        color: '#fef08a',
      },
    }
    const palette = tones[tone] || tones.csv

    return {
      borderRadius: 999,
      padding: '10px 18px',
      border: `1px solid ${disabled ? 'rgba(148,163,184,0.18)' : palette.border}`,
      background: disabled ? 'rgba(15,23,42,0.52)' : palette.background,
      color: disabled ? 'rgba(148,163,184,0.75)' : palette.color,
      fontWeight: 700,
      cursor: disabled ? 'not-allowed' : 'pointer',
      fontFamily: 'inherit',
    }
  },
}

export default function Reports() {
  const cachedVehiculos = getCachedApiData('/api/vehiculos')
  const cachedSpaces = getCachedApiData('/api/parking-spaces')
  const hasCache = Boolean(cachedVehiculos && cachedSpaces)

  const [vehiculos, setVehiculos] = useState(() => cachedVehiculos?.data || [])
  const [parqueos, setParqueos] = useState(() => cachedSpaces?.data || [])
  const [loading, setLoading] = useState(() => !hasCache)
  const [error, setError] = useState('')
  const [period, setPeriod] = useState('mes')
  const [floor, setFloor] = useState('todos')
  const [barsAnimated, setBarsAnimated] = useState(false)
  const [exporting, setExporting] = useState({ pdf: false })

  useEffect(() => {
    const timer = window.setTimeout(() => setBarsAnimated(true), 200)
    return () => window.clearTimeout(timer)
  }, [period, floor])

  const load = async ({ showLoader = true, forceFresh = true } = {}) => {
    if (showLoader) setLoading(true)
    setError('')
    try {
      const [vehiculosPayload, parqueosPayload] = await Promise.all([
        apiGet('/api/vehiculos', { forceFresh }),
        apiGet('/api/parking-spaces', { forceFresh }),
      ])
      setVehiculos(Array.isArray(vehiculosPayload?.data) ? vehiculosPayload.data : [])
      setParqueos(Array.isArray(parqueosPayload?.data) ? parqueosPayload.data : [])
    } catch (err) {
      setError(err.message || 'No se pudieron cargar los Reports.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load({ showLoader: !hasCache })

    const intervalId = window.setInterval(() => {
      load({ showLoader: false, forceFresh: true })
    }, 5000)

    const handleDataRefresh = () => load({ showLoader: false, forceFresh: true })
    window.addEventListener('smartpark:data-refresh', handleDataRefresh)
    return () => {
      window.clearInterval(intervalId)
      window.removeEventListener('smartpark:data-refresh', handleDataRefresh)
    }
  }, [])

  const floorIndex = useMemo(() => buildFloorIndex(parqueos), [parqueos])
  const availableFloors = useMemo(
    () => (floorIndex.floors.length ? floorIndex.floors : DEFAULT_FLOORS),
    [floorIndex],
  )

  const rows = useMemo(
    () =>
      (Array.isArray(vehiculos) ? vehiculos : [])
        .map((vehicle) => normalizeVehicle(vehicle, floorIndex))
        .filter((vehicle) => vehicle.entry || vehicle.exit)
        .sort(
          (a, b) =>
            (parseDate(b.exit || b.entry)?.getTime() || 0) -
            (parseDate(a.exit || a.entry)?.getTime() || 0),
        ),
    [vehiculos, floorIndex],
  )

  const filteredRows = useMemo(() => {
    return rows.filter((row) => {
      const source = parseDate(row.exit || row.entry)
      const matchesPeriod = isWithinPeriod(source, period)
      const matchesFloor = floor === 'todos' || row.piso === floor
      return matchesPeriod && matchesFloor
    })
  }, [rows, period, floor])

  const occupancyStats = useMemo(() => {
    const scopedSpaces = floor === 'todos'
      ? parqueos
      : parqueos.filter((space) => (floorIndex.byId.get(String(space.id || '')) || '').toUpperCase() === floor)
    const scopedRows = floor === 'todos' ? rows : rows.filter((row) => row.piso === floor)
    const activeVehicles = scopedRows.filter((row) => row.status === 'dentro').length
    const totalSpaces = scopedSpaces.length
    const occupiedSpaces = scopedSpaces.filter((space) => {
      const state = String(space?.estado || '').toLowerCase()
      return state === 'ocupado' || Boolean(space?.ocupado)
    }).length
    return {
      activeVehicles,
      totalSpaces,
      occupiedSpaces,
      occupancyPct: totalSpaces ? Math.round((occupiedSpaces / totalSpaces) * 100) : 0,
    }
  }, [parqueos, rows, floor, floorIndex])

  const metrics = useMemo(() => {
    const ingresos = filteredRows.reduce((sum, row) => sum + row.amount, 0)
    const promedio = filteredRows.length ? ingresos / filteredRows.length : 0
    return {
      totalVehiculos: filteredRows.length,
      ingresos,
      promedio,
    }
  }, [filteredRows])

  const chartData = useMemo(() => buildDailyTotals(filteredRows, period), [filteredRows, period])

  const occupancyByFloor = useMemo(() => {
    const scopedFloors = floor === 'todos'
      ? availableFloors
      : availableFloors.filter((item) => item === floor)

    return scopedFloors.map((item) => {
      const totalSpaces = parqueos.filter((space) => {
        const spaceFloor = floorIndex.byId.get(String(space.id || '')) || ''
        return spaceFloor === item
      }).length

      const occupiedSpaces = parqueos.filter((space) => {
        const spaceFloor = floorIndex.byId.get(String(space.id || '')) || ''
        if (spaceFloor !== item) return false
        const state = String(space?.estado || '').toLowerCase()
        return state === 'ocupado' || Boolean(space?.ocupado)
      }).length

      const activeVehicles = rows.filter((row) => row.piso === item && row.status === 'dentro').length

      return {
        floor: item,
        totalSpaces,
        occupiedSpaces,
        availableSpaces: Math.max(totalSpaces - occupiedSpaces, 0),
        activeVehicles,
        occupancyPct: totalSpaces ? Math.round((occupiedSpaces / totalSpaces) * 100) : 0,
      }
    })
  }, [availableFloors, floor, floorIndex, parqueos, rows])

  const handleExportCsv = () => {
    if (!filteredRows.length) return

    downloadCsv({
      filename: `${buildExportBaseFilename({ period, floor })}.csv`,
      columns: [
        { key: 'fecha', label: 'Fecha' },
        { key: 'hora', label: 'Hora' },
        { key: 'piso', label: 'Piso' },
        { key: 'placa', label: 'Placa' },
        { key: 'propietario', label: 'Propietario' },
        { key: 'ubicacion', label: 'Ubicacion' },
        { key: 'estado', label: 'Estado' },
        { key: 'entrada', label: 'Entrada' },
        { key: 'salida', label: 'Salida' },
        { key: 'duracion', label: 'Duracion' },
        { key: 'monto_dop', label: 'Monto DOP' },
      ],
      rows: buildExportRows(filteredRows),
    })
  }

  const handleExportPdf = async () => {
    if (!filteredRows.length || exporting.pdf) return

    setExporting((current) => ({ ...current, pdf: true }))
    setError('')

    try {
      const [{ jsPDF }] = await Promise.all([import('jspdf')])
      const selectedPeriodLabel = getPeriodLabel(period)
      const selectedFloorLabel = getFloorLabel(floor)
      const generatedAt = new Date()
      const detailRows = filteredRows.map((row) => ({
        fecha: `${formatDate(row.exit || row.entry)} ${formatTime(row.exit || row.entry)}`,
        piso: row.piso || '--',
        placa: row.placa || 'Sin placa',
        propietario: row.propietario || 'Sin propietario',
        duracion: formatDuration(row.entry, row.exit),
        monto: formatCurrency(row.amount),
      }))

      const pieChartImage = await renderChartImage({
        type: 'pie',
        width: 560,
        height: 360,
        data: {
          labels: ['Ocupados', 'Disponibles'],
          datasets: [
            {
              data: [
                occupancyStats.occupiedSpaces,
                Math.max(occupancyStats.totalSpaces - occupancyStats.occupiedSpaces, 0),
              ],
              backgroundColor: ['#0ea5e9', '#cbd5e1'],
              borderColor: '#ffffff',
              borderWidth: 3,
            },
          ],
        },
      })

      const revenueChartImage = await renderChartImage({
        type: 'bar',
        width: 900,
        height: 380,
        data: {
          labels: chartData.map((item) => item.label),
          datasets: [
            {
              label: 'Ingresos DOP',
              data: chartData.map((item) => item.value),
              backgroundColor: ['#0ea5e9', '#38bdf8', '#60a5fa', '#818cf8', '#22c55e', '#14b8a6', '#06b6d4'],
              borderRadius: 12,
            },
          ],
        },
      })

      const floorChartImage = await renderChartImage({
        type: 'bar',
        width: 900,
        height: 380,
        data: {
          labels: occupancyByFloor.map((item) => `Piso ${item.floor}`),
          datasets: [
            {
              label: 'Ocupacion %',
              data: occupancyByFloor.map((item) => item.occupancyPct),
              backgroundColor: '#f59e0b',
              borderRadius: 12,
            },
          ],
        },
        options: {
          scales: {
            x: {
              grid: { display: false },
              ticks: { color: '#475569', font: { family: 'Arial', size: 11 } },
            },
            y: {
              beginAtZero: true,
              max: 100,
              grid: { color: 'rgba(148, 163, 184, 0.25)' },
              ticks: { color: '#475569', font: { family: 'Arial', size: 11 } },
            },
          },
        },
      })

      const doc = new jsPDF({ unit: 'pt', format: 'a4' })
      const pageWidth = doc.internal.pageSize.getWidth()
      const cardGap = 12
      const cardWidth = (pageWidth - 80 - cardGap) / 2

      doc.setFillColor(248, 250, 252)
      doc.rect(0, 0, pageWidth, 145, 'F')

      doc.setFont('helvetica', 'bold')
      doc.setFontSize(24)
      doc.setTextColor(15, 23, 42)
      doc.text('Reporte SmartPark', 40, 54)

      doc.setFont('helvetica', 'normal')
      doc.setFontSize(11)
      doc.setTextColor(71, 85, 105)
      doc.text(`Periodo: ${selectedPeriodLabel}`, 40, 80)
      doc.text(`Filtro de piso: ${selectedFloorLabel}`, 40, 98)
      doc.text(
        `Generado: ${formatDate(generatedAt.toISOString())} ${formatTime(generatedAt.toISOString())}`,
        40,
        116,
      )

      drawPdfStatCard(doc, {
        x: 40,
        y: 165,
        width: cardWidth,
        height: 58,
        label: 'Vehiculos del filtro',
        value: metrics.totalVehiculos,
        accent: [14, 165, 233],
      })
      drawPdfStatCard(doc, {
        x: 40 + cardWidth + cardGap,
        y: 165,
        width: cardWidth,
        height: 58,
        label: 'Ingresos del periodo',
        value: formatCurrency(metrics.ingresos),
        accent: [34, 197, 94],
      })
      drawPdfStatCard(doc, {
        x: 40,
        y: 235,
        width: cardWidth,
        height: 58,
        label: 'Ocupacion global',
        value: `${occupancyStats.occupancyPct}%`,
        accent: [245, 158, 11],
      })
      drawPdfStatCard(doc, {
        x: 40 + cardWidth + cardGap,
        y: 235,
        width: cardWidth,
        height: 58,
        label: 'Ticket promedio',
        value: formatCurrency(metrics.promedio),
        accent: [99, 102, 241],
      })

      doc.setFont('helvetica', 'bold')
      doc.setFontSize(13)
      doc.setTextColor(15, 23, 42)
      doc.text('Distribucion actual de ocupacion', 40, 326)
      doc.addImage(pieChartImage, 'PNG', 40, 342, pageWidth - 80, 190)

      doc.addPage()
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(13)
      doc.setTextColor(15, 23, 42)
      doc.text('Ingresos por periodo', 40, 48)
      doc.addImage(revenueChartImage, 'PNG', 40, 62, pageWidth - 80, 180)

      doc.text('Ocupacion por piso', 40, 278)
      doc.addImage(floorChartImage, 'PNG', 40, 292, pageWidth - 80, 170)

      const summaryTableRows = [
        { indicador: 'Periodo seleccionado', valor: selectedPeriodLabel },
        { indicador: 'Filtro de piso', valor: selectedFloorLabel },
        { indicador: 'Vehiculos registrados', valor: String(metrics.totalVehiculos) },
        { indicador: 'Vehiculos activos', valor: String(occupancyStats.activeVehicles) },
        { indicador: 'Espacios ocupados', valor: String(occupancyStats.occupiedSpaces) },
        { indicador: 'Espacios totales', valor: String(occupancyStats.totalSpaces) },
        { indicador: 'Ingresos del periodo', valor: formatCurrency(metrics.ingresos) },
        { indicador: 'Ticket promedio', valor: formatCurrency(metrics.promedio) },
      ]

      addPdfTable(doc, {
        title: 'Resumen ejecutivo',
        columns: [
          { key: 'indicador', label: 'Indicador', width: 0.46 },
          { key: 'valor', label: 'Valor', width: 0.54 },
        ],
        rows: summaryTableRows,
        startY: 490,
      })

      doc.addPage()
      addPdfTable(doc, {
        title: 'Movimientos del periodo seleccionado',
        columns: [
          { key: 'fecha', label: 'Fecha', width: 0.2 },
          { key: 'piso', label: 'Piso', width: 0.1 },
          { key: 'placa', label: 'Placa', width: 0.14 },
          { key: 'propietario', label: 'Propietario', width: 0.24 },
          { key: 'duracion', label: 'Duracion', width: 0.14 },
          { key: 'monto', label: 'Monto', width: 0.18 },
        ],
        rows: detailRows,
        startY: 40,
      })

      doc.save(`${buildExportBaseFilename({ period, floor })}.pdf`)
    } catch (err) {
      setError(err.message || 'No se pudo exportar el PDF del reporte.')
    } finally {
      setExporting((current) => ({ ...current, pdf: false }))
    }
  }

  const floorCards = useMemo(() => {
    const sourceRows = floor === 'todos' ? rows : rows.filter((row) => row.piso === floor)
    return availableFloors.map((item) => {
      const total = parqueos.filter((space) => {
        const spaceFloor = floorIndex.byId.get(String(space.id || '')) || ''
        return spaceFloor === item
      }).length
      const active = sourceRows.filter((row) => row.piso === item && row.status === 'dentro').length
      const pct = total ? Math.round((active / total) * 100) : 0
      return { floor: item, total, active, pct }
    })
  }, [availableFloors, parqueos, floorIndex, rows, floor])

  return (
    <div className="Reports-shell" style={styles.page}>
      <header className="Reports-header" style={styles.header}>
        <div>
          <h1>Reports</h1>
          <p>Análisis y estadísticas del sistema.</p>
        </div>

        <div style={styles.controls}>
          <div style={styles.pillGroup}>
            {PERIODS.map((item) => (
              <button
                key={item.key}
                type="button"
                style={styles.pill(period === item.key)}
                onClick={() => setPeriod(item.key)}
              >
                {item.label}
              </button>
            ))}
          </div>
          <div style={styles.pillGroup}>
            <button
              type="button"
              style={styles.pill(floor === 'todos', 'floor')}
              onClick={() => setFloor('todos')}
            >
              Todos los pisos
            </button>
            {availableFloors.map((item) => (
              <button
                key={item}
                type="button"
                style={styles.pill(floor === item, 'floor')}
                onClick={() => setFloor(item)}
              >
                Piso {item}
              </button>
            ))}
          </div>
          <div style={styles.exportRow}>
            <button
              type="button"
              style={styles.exportButton(loading || filteredRows.length === 0, 'csv')}
              onClick={handleExportCsv}
              disabled={loading || filteredRows.length === 0}
            >
              Exportar CSV
            </button>
            <button
              type="button"
              style={styles.exportButton(loading || filteredRows.length === 0 || exporting.pdf, 'pdf')}
              onClick={handleExportPdf}
              disabled={loading || filteredRows.length === 0 || exporting.pdf}
            >
              {exporting.pdf ? 'Generando PDF...' : 'Exportar PDF'}
            </button>
          </div>
        </div>
      </header>

      {error && <div style={styles.feedbackError}>{error}</div>}

      <section style={styles.metrics}>
        <article style={styles.card}>
          <div style={styles.cardLabel}>Vehículos del filtro</div>
          <div style={styles.cardValue(PAGE.text)}>{loading ? '--' : metrics.totalVehiculos}</div>
          <div style={styles.cardSub}>Piso: {floor === 'todos' ? 'Todos' : `Piso ${floor}`}</div>
        </article>

        <article style={styles.card}>
          <div style={styles.cardLabel}>Ocupación global</div>
          <div style={styles.cardValue(PAGE.accent2)}>
            {loading ? '--' : `${occupancyStats.occupancyPct}%`}
          </div>
          <div style={styles.progressTrack}>
            <div
              style={styles.progressFill(barsAnimated ? occupancyStats.occupancyPct : 0)}
            />
          </div>
          <div style={styles.cardSub}>
            {loading ? 'Calculando...' : `${occupancyStats.occupiedSpaces} ocupados de ${occupancyStats.totalSpaces} espacios`}
          </div>
        </article>

        <article style={styles.card}>
          <div style={styles.cardLabel}>Ingresos del período</div>
          <div style={styles.cardValue(PAGE.success)}>{loading ? '--' : formatCurrency(metrics.ingresos)}</div>
          <div style={styles.cardSub}>Movimientos completados en el período seleccionado.</div>
        </article>

        <article style={styles.card}>
          <div style={styles.cardLabel}>Promedio del filtro</div>
          <div style={styles.cardValue(PAGE.accent)}>{loading ? '--' : formatCurrency(metrics.promedio)}</div>
          <div style={styles.cardSub}>Ticket promedio por vehículo registrado.</div>
        </article>
      </section>

      <section style={styles.contentGrid}>
        <div style={styles.tableCard}>
          <div style={styles.sectionHead}>
            <div>
              <h2 style={styles.sectionTitle}>Historial detallado</h2>
              <p style={styles.sectionSub}>Últimos movimientos del período seleccionado.</p>
            </div>
          </div>

          <div style={styles.tableHead}>
            <span>Fecha</span>
            <span>Piso</span>
            <span>Placa</span>
            <span>Propietario</span>
            <span>Duración</span>
            <span>Monto</span>
          </div>

          {loading ? (
            <div style={styles.empty}>Cargando Reports...</div>
          ) : filteredRows.length === 0 ? (
            <div style={styles.empty}>No hay registros para el filtro seleccionado.</div>
          ) : (
            filteredRows.slice(0, 8).map((row) => (
              <div key={row.id} style={styles.row}>
                <span style={styles.rowDim}>
                  {formatDate(row.exit || row.entry)} - {formatTime(row.exit || row.entry)}
                </span>
                <span><span style={styles.badgeFloor}>{row.piso}</span></span>
                <strong style={{ fontFamily: "'Syne', sans-serif", color: PAGE.accent }}>{row.placa}</strong>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {row.propietario}
                </span>
                <span style={styles.rowDim}>{formatDuration(row.entry, row.exit)}</span>
                <strong style={{ fontFamily: "'Syne', sans-serif", color: PAGE.success, letterSpacing: '-0.03em' }}>
                  {formatCurrency(row.amount)}
                </strong>
              </div>
            ))
          )}
        </div>

        <div style={styles.sideStack}>
          <div style={styles.chartCard}>
            <div style={styles.sectionHead}>
              <div>
                <h2 style={styles.sectionTitle}>Ingresos por período</h2>
                <p style={styles.sectionSub}>Distribución de montos en {period}.</p>
              </div>
            </div>
            <div style={styles.chartBars(chartData.length)}>
              {chartData.map((item, index) => (
                <div key={item.label} style={styles.chartBarWrap}>
                  <span style={styles.chartAmount}>{item.value > 0 ? formatCompactCurrency(item.value) : 'RD$0'}</span>
                  <div style={styles.chartBar(barsAnimated ? item.height : 10, index === chartData.length - 1)} />
                  <span style={styles.chartLabel}>{item.label}</span>
                </div>
              ))}
            </div>
          </div>

          <div style={styles.chartCard}>
            <div style={styles.sectionHead}>
              <div>
                <h2 style={styles.sectionTitle}>Resumen por piso</h2>
                <p style={styles.sectionSub}>Disponibilidad y vehículos activos en tiempo real.</p>
              </div>
            </div>

            <div style={styles.floorGrid}>
              {floorCards.map((item) => (
                <article key={item.floor} style={styles.floorCard}>
                  <h3 style={styles.floorName}>Piso {item.floor}</h3>
                  <div style={styles.progressTrack}>
                    <div style={styles.progressFill(barsAnimated ? item.pct : 0)} />
                  </div>
                  <div style={styles.cardSub}>{item.active} activos / {item.total || 0} espacios</div>
                  <div style={{ ...styles.cardValue(item.pct >= 50 ? PAGE.warning : PAGE.success), fontSize: 22, marginTop: 10 }}>
                    {item.pct}%
                  </div>
                </article>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}


