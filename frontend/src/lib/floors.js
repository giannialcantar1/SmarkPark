export const DEFAULT_FLOORS = ['A', 'B', 'C', 'D', 'E']

export function normalizeFloorValue(value) {
  return String(value || '').trim().toUpperCase()
}

export function getSpaceFloor(space = {}) {
  const explicitFloor = normalizeFloorValue(
    space.nivel || space.nivel_mostrar || space.piso || space.floor || space.tipo || '',
  )
  if (explicitFloor) return explicitFloor

  const label = getSpaceLabel(space)
  const match = label.match(/^([A-Z])/)
  return match ? match[1] : ''
}

export function getSpaceLabel(space = {}) {
  return String(space.numero_mostrar || space.codigo || space.nombre || '').trim().toUpperCase()
}

export function buildFloorIndex(spaces = []) {
  const byId = new Map()
  const byLabel = new Map()
  const foundFloors = []

  spaces.forEach((space) => {
    const floor = getSpaceFloor(space)
    const id = String(space.id || '').trim()
    const label = getSpaceLabel(space)

    if (id && floor) byId.set(id, floor)
    if (label && floor) byLabel.set(label, floor)
    if (floor && !foundFloors.includes(floor)) {
      foundFloors.push(floor)
    }
  })

  const orderedFloors = [
    ...DEFAULT_FLOORS.filter((floor) => foundFloors.includes(floor)),
    ...foundFloors.filter((floor) => !DEFAULT_FLOORS.includes(floor)).sort(),
  ]

  return { byId, byLabel, floors: orderedFloors }
}

export function resolveVehicleFloor(vehicle = {}, floorIndex = {}) {
  const byId = floorIndex.byId || new Map()
  const byLabel = floorIndex.byLabel || new Map()
  const spaceId = String(vehicle.espacio_id || vehicle.space_id || '').trim()
  const rawLabel = String(vehicle.espacio || vehicle.ubicacion || vehicle.space_label || '').trim().toUpperCase()

  if (spaceId && byId.has(spaceId)) return byId.get(spaceId)
  if (rawLabel && byLabel.has(rawLabel)) return byLabel.get(rawLabel)
  return ''
}
