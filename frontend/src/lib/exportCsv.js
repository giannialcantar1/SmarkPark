const CSV_BOM = '\uFEFF'
const DEFAULT_DELIMITER = ';'

function escapeCsvValue(value, delimiter = DEFAULT_DELIMITER) {
  if (value === null || value === undefined) return ''

  const normalized = String(value).replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  const needsQuotes = normalized.includes('"') || normalized.includes('\n') || normalized.includes(delimiter)
  const escaped = normalized.replace(/"/g, '""')

  return needsQuotes ? `"${escaped}"` : escaped
}

function normalizeColumns(columns) {
  return columns.map((column) => {
    if (typeof column === 'string') {
      return { key: column, label: column }
    }

    return {
      key: column.key,
      label: column.label || column.key,
    }
  })
}

function buildCsvContent(columns, rows, delimiter = DEFAULT_DELIMITER) {
  const normalizedColumns = normalizeColumns(columns)
  const header = normalizedColumns.map((column) => escapeCsvValue(column.label, delimiter)).join(delimiter)

  const lines = rows.map((row) =>
    normalizedColumns
      .map((column) => escapeCsvValue(row?.[column.key] ?? '', delimiter))
      .join(delimiter),
  )

  return [header, ...lines].join('\n')
}

export function downloadCsv({ filename, columns, rows, delimiter = DEFAULT_DELIMITER }) {
  if (!Array.isArray(columns) || !columns.length) {
    throw new Error('columns is required to export CSV')
  }

  const safeRows = Array.isArray(rows) ? rows : []
  const csvContent = CSV_BOM + buildCsvContent(columns, safeRows, delimiter)
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const url = window.URL.createObjectURL(blob)
  const link = document.createElement('a')

  link.href = url
  link.download = filename || 'smartpark-export.csv'
  link.style.display = 'none'

  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  window.URL.revokeObjectURL(url)
}

export default downloadCsv
