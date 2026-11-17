import { captureBrowserGcj02, captureNativeGcj02, type LocationCoordinates } from '@mobile-core/location'

export interface CapturedLocation extends LocationCoordinates {
  locationText?: string
  poiName?: string
  addressText?: string
}

interface AmapGeocoder {
  getAddress(location: [number, number], callback: (status: string, result: unknown) => void): void
}

export interface AmapMapHandle {
  destroy?: () => void
  on?: (event: string, callback: () => void) => void
  off?: (event: string, callback: () => void) => void
}

interface AmapApi {
  Geocoder?: new (options?: Record<string, unknown>) => AmapGeocoder
  Map?: new (container: string, options?: Record<string, unknown>) => AmapMapHandle & { add?: (overlay: unknown) => void }
  Marker?: new (options?: Record<string, unknown>) => unknown
  plugin?: (plugins: string[], callback: () => void) => void
}

declare global {
  interface Window {
    AMap?: AmapApi
    _AMapSecurityConfig?: { securityJsCode: string }
  }
}

let amapLoader: Promise<AmapApi> | undefined

export async function getCurrentGcj02Location(): Promise<CapturedLocation> {
  // #ifdef H5
  const coordinates = await captureBrowserGcj02()
  return { ...coordinates, ...await reverseGeocode(coordinates.longitude, coordinates.latitude) }
  // #endif

  // #ifndef H5
  const { address, ...nativeCoordinates } = await captureNativeGcj02()
  return { ...nativeCoordinates, ...formatAddress(address) }
  // #endif
}

async function reverseGeocode(longitude: number, latitude: number) {
  const key = import.meta.env.VITE_AMAP_KEY
  if (!key) return undefined
  try {
    const AMap = await loadAmap(key)
    if (!AMap.Geocoder) return undefined
    const geocoder = new AMap.Geocoder({ extensions: 'all' })
    return await new Promise<ReturnType<typeof formatAddress>>((resolve) => {
      const timeout = setTimeout(() => resolve(undefined), 4000)
      geocoder.getAddress([longitude, latitude], (status, result) => {
        clearTimeout(timeout)
        if (status !== 'complete' || !result || typeof result !== 'object') {
          resolve(undefined)
          return
        }
        resolve(formatAddress((result as { regeocode?: unknown }).regeocode))
      })
    })
  } catch {
    return undefined
  }
}

function formatAddress(address: unknown) {
  if (typeof address === 'string') {
    const addressText = address.trim()
    return addressText ? { addressText, locationText: addressText } : undefined
  }
  if (!address || typeof address !== 'object') return undefined
  const value = address as Record<string, unknown>
  const formatted = [value.formattedAddress, value.formatted_address, value.address]
    .find((item): item is string => typeof item === 'string' && Boolean(item.trim()))
  const addressText = formatted?.trim() || [value.province, value.city, value.district, value.street, value.streetNum]
    .filter((item): item is string => typeof item === 'string' && Boolean(item.trim()))
    .join('') || undefined
  const pois = Array.isArray(value.pois) ? value.pois : []
  const firstPoi = pois.find((item): item is Record<string, unknown> => Boolean(item && typeof item === 'object'))
  const poiName = [value.poiName, firstPoi?.name]
    .find((item): item is string => typeof item === 'string' && Boolean(item.trim()))
    ?.trim()
  const locationText = poiName && addressText && !addressText.includes(poiName)
    ? `${poiName} · ${addressText}`
    : poiName || addressText
  return locationText ? { poiName, addressText, locationText } : undefined
}

function loadAmap(key: string): Promise<AmapApi> {
  if (window.AMap?.Geocoder && window.AMap.Map) return Promise.resolve(window.AMap)
  if (amapLoader) return amapLoader

  const securityJsCode = import.meta.env.VITE_AMAP_SECURITY_JS_CODE
  if (securityJsCode) window._AMapSecurityConfig = { securityJsCode }

  amapLoader = new Promise<AmapApi>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('地图加载超时，请检查网络后重试')), 12000)
    const finish = () => {
      const AMap = window.AMap
      if (!AMap) {
        clearTimeout(timeout)
        reject(new Error('高德地图服务加载失败'))
        return
      }
      if (AMap.Geocoder) {
        clearTimeout(timeout)
        resolve(AMap)
        return
      }
      AMap.plugin?.(['AMap.Geocoder'], () => {
        clearTimeout(timeout)
        AMap.Geocoder ? resolve(AMap) : reject(new Error('地址解析服务不可用'))
      })
    }
    document.querySelector('script[data-smis-amap-geocoder]')?.remove()

    const script = document.createElement('script')
    script.dataset.smisAmapGeocoder = 'true'
    script.src = `https://webapi.amap.com/maps?v=2.0&key=${encodeURIComponent(key)}&plugin=AMap.Geocoder`
    script.async = true
    script.onload = finish
    script.onerror = () => {
      clearTimeout(timeout)
      reject(new Error('高德地图服务加载失败'))
    }
    document.head.appendChild(script)
  }).catch((error) => {
    amapLoader = undefined
    throw error
  })

  return amapLoader
}

export async function createAmapPointMap(containerId: string, point: CapturedLocation): Promise<AmapMapHandle> {
  const key = import.meta.env.VITE_AMAP_KEY
  if (!key) throw new Error('地图暂不可用，已保留位置坐标')
  const AMap = await loadAmap(key)
  if (!AMap.Map || !AMap.Marker) throw new Error('地图服务暂不可用，请重试')

  const map = new AMap.Map(containerId, {
    zoom: 16,
    center: [point.longitude, point.latitude],
    resizeEnable: true,
    dragEnable: true,
    zoomEnable: true,
    viewMode: '2D',
    features: ['bg', 'road', 'point']
  })
  const marker = new AMap.Marker({
    position: [point.longitude, point.latitude],
    title: point.poiName || point.locationText || '隐患位置',
    anchor: 'bottom-center'
  })
  map.add?.(marker)
  try {
    await new Promise<void>((resolve, reject) => {
      const complete = () => {
        clearTimeout(timeout)
        map.off?.('complete', complete)
        resolve()
      }
      const timeout = setTimeout(() => {
        map.off?.('complete', complete)
        reject(new Error('地图加载超时，已保留位置坐标'))
      }, 12000)
      map.on?.('complete', complete)
    })
  } catch (error) {
    map.destroy?.()
    throw error
  }
  return map
}
