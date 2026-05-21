import { useEffect, useMemo, useRef, useState } from 'react'

import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png'
import markerIcon from 'leaflet/dist/images/marker-icon.png'
import markerShadow from 'leaflet/dist/images/marker-shadow.png'

const DEFAULT_CENTER = { lat: 18.4861, lng: -69.9312 }
const DEFAULT_ZOOM = 13

L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
})

function normalizeAddressLabel(item) {
  if (!item) return ''

  const address = item.address || {}
  const mainParts = [
    address.road,
    address.house_number,
    address.suburb,
    address.city || address.town || address.village,
    address.state,
    address.country,
  ].filter(Boolean)

  return mainParts.length ? mainParts.join(', ') : String(item.display_name || '').trim()
}

async function searchAddresses(query) {
  const search = String(query || '').trim()
  if (!search) return []

  const response = await fetch(
    `https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&limit=5&q=${encodeURIComponent(search)}`,
    {
      headers: {
        Accept: 'application/json',
      },
    },
  )

  if (!response.ok) {
    throw new Error('No se pudo buscar la direccion en el mapa.')
  }

  const payload = await response.json()
  return Array.isArray(payload) ? payload : []
}

async function reverseGeocode(lat, lng) {
  const response = await fetch(
    `https://nominatim.openstreetmap.org/reverse?format=jsonv2&addressdetails=1&zoom=18&lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lng)}`,
    {
      headers: {
        Accept: 'application/json',
      },
    },
  )

  if (!response.ok) {
    throw new Error('No se pudo obtener la direccion seleccionada.')
  }

  return response.json()
}

export default function RegisterMapModal({
  isOpen,
  initialAddress = '',
  onClose,
  onConfirm,
}) {
  const mapContainerRef = useRef(null)
  const mapInstanceRef = useRef(null)
  const markerRef = useRef(null)

  const [searchQuery, setSearchQuery] = useState(initialAddress)
  const [results, setResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [mapError, setMapError] = useState('')
  const [selectedLocation, setSelectedLocation] = useState(null)

  const selectedAddress = useMemo(
    () => normalizeAddressLabel(selectedLocation) || String(selectedLocation?.display_name || '').trim(),
    [selectedLocation],
  )

  const placeMarker = (lat, lng) => {
    if (!mapInstanceRef.current) return

    if (!markerRef.current) {
      markerRef.current = L.marker([lat, lng]).addTo(mapInstanceRef.current)
    } else {
      markerRef.current.setLatLng([lat, lng])
    }

    mapInstanceRef.current.setView([lat, lng], Math.max(mapInstanceRef.current.getZoom(), 16), {
      animate: true,
    })
  }

  useEffect(() => {
    if (!isOpen) return undefined

    setSearchQuery(initialAddress)
    setResults([])
    setMapError('')

    const map = L.map(mapContainerRef.current, {
      center: [DEFAULT_CENTER.lat, DEFAULT_CENTER.lng],
      zoom: DEFAULT_ZOOM,
      zoomControl: true,
    })

    mapInstanceRef.current = map

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(map)

    map.on('click', async (event) => {
      const { lat, lng } = event.latlng
      setMapError('')
      placeMarker(lat, lng)

      try {
        const reverseResult = await reverseGeocode(lat, lng)
        setSelectedLocation(reverseResult)
      } catch (error) {
        setSelectedLocation({
          lat,
          lon: lng,
          display_name: `Lat ${lat.toFixed(6)}, Lng ${lng.toFixed(6)}`,
        })
        setMapError(error.message || 'No se pudo resolver la direccion de ese punto.')
      }
    })

    window.setTimeout(() => {
      map.invalidateSize()
    }, 60)

    return () => {
      markerRef.current = null
      mapInstanceRef.current = null
      map.remove()
    }
  }, [initialAddress, isOpen])

  const handleSearch = async (event) => {
    event?.preventDefault?.()
    setSearching(true)
    setMapError('')

    try {
      const nextResults = await searchAddresses(searchQuery)
      setResults(nextResults)

      if (!nextResults.length) {
        setMapError('No encontramos resultados para esa direccion.')
      }
    } catch (error) {
      setResults([])
      setMapError(error.message || 'No se pudo buscar la direccion.')
    } finally {
      setSearching(false)
    }
  }

  const handlePickResult = (result) => {
    const lat = Number(result?.lat)
    const lng = Number(result?.lon)
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return

    setSelectedLocation(result)
    placeMarker(lat, lng)
    setResults([])
    setSearchQuery(normalizeAddressLabel(result) || result.display_name || '')
    setMapError('')
  }

  const handleConfirm = () => {
    if (!selectedLocation) {
      setMapError('Selecciona una ubicacion en el mapa o desde la busqueda para continuar.')
      return
    }

    onConfirm?.({
      address: selectedAddress || String(selectedLocation.display_name || '').trim(),
      latitude: Number(selectedLocation.lat),
      longitude: Number(selectedLocation.lon),
      raw: selectedLocation,
    })
  }

  if (!isOpen) return null

  return (
    <div className="sp-modal-overlay" role="presentation">
      <div className="sp-modal register-map-modal" role="dialog" aria-modal="true" aria-labelledby="register-map-title">
        <div className="sp-modal__header">
          <div>
            <p className="auth-modal-eyebrow">Direccion del garaje</p>
            <h3 id="register-map-title" className="auth-modal-title">
              Seleccionar ubicacion en el mapa
            </h3>
          </div>
          <button
            type="button"
            className="sp-modal__close"
            aria-label="Cerrar mapa"
            onClick={onClose}
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <div className="sp-modal__body">
          <form className="register-map-search" onSubmit={handleSearch}>
            <input
              className="register-map-search__input"
              type="text"
              placeholder="Busca una calle, ciudad o punto de referencia"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
            />
            <button type="submit" className="register-map-search__button" disabled={searching}>
              {searching ? 'Buscando...' : 'Buscar'}
            </button>
          </form>

          {results.length ? (
            <div className="register-map-results">
              {results.map((result) => (
                <button
                  key={`${result.place_id}-${result.lat}-${result.lon}`}
                  type="button"
                  className="register-map-results__item"
                  onClick={() => handlePickResult(result)}
                >
                  <strong>{normalizeAddressLabel(result) || result.display_name}</strong>
                  <span>{result.display_name}</span>
                </button>
              ))}
            </div>
          ) : null}

          <div ref={mapContainerRef} className="register-map-canvas" />

          <div className="register-map-selection">
            <div>
              <span className="register-map-selection__label">Direccion seleccionada</span>
              <strong className="register-map-selection__value">
                {selectedAddress || 'Haz click en el mapa o usa la busqueda.'}
              </strong>
            </div>
            <span className="register-map-selection__hint">
              Puedes mover el mapa, hacer zoom y elegir cualquier punto.
            </span>
          </div>

          {mapError ? <p className="auth-alert error">{mapError}</p> : null}

          <div className="sp-modal__actions">
            <button type="button" className="auth-btn auth-btn-ghost register-map-action" onClick={onClose}>
              Cancelar
            </button>
            <button type="button" className="auth-btn auth-btn-primary register-map-action" onClick={handleConfirm}>
              Usar esta direccion
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
