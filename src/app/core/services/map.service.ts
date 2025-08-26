import { Injectable, ElementRef } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, BehaviorSubject } from 'rxjs';
import { MessageService } from 'primeng/api';
import * as L from 'leaflet';
import 'leaflet.markercluster';
import { UserDto } from '@/core/models/UserDto';

export interface MapConfig {
    center: [number, number];
    zoom: number;
    defaultLocation: string;
}

export interface SearchResult {
    lat: string;
    lon: string;
    display_name: string;
}
export interface UserRange {
    center: [number, number];
    northEast: [number, number];  // Coordenada superior derecha
    southWest: [number, number];  // Coordenada inferior izquierda
    radius: number;              // Radio en metros
}

export interface RangeDisplayInfo {
    user: UserDto;
    range: UserRange;
    bounds: L.LatLngBounds;
}

@Injectable({
    providedIn: 'root'
})
export class MapService {
    private map: L.Map | null = null;
    private userMarkers: Map<string, L.Marker> = new Map();
    private markerClusterGroup: L.MarkerClusterGroup | null = null;
    private searchMarker: L.Marker | null = null;

    private userRangeLayer: L.LayerGroup | null = null;
    private currentUserRange: RangeDisplayInfo | null = null;

    // Observable para el rango actual
    private userRange$ = new BehaviorSubject<RangeDisplayInfo | null>(null);

    // Configuración por defecto
    private readonly defaultConfig: MapConfig = {
        center: [-0.2298, -78.5249], // Quito, Ecuador
        zoom: 13,
        defaultLocation: 'Quito, Ecuador'
    };

    // Observables para el estado
    private mapInitialized$ = new BehaviorSubject<boolean>(false);
    private searchingLocation$ = new BehaviorSubject<boolean>(false);
    private searchResults$ = new BehaviorSubject<SearchResult[]>([]);

    constructor(
        private http: HttpClient,
        private msgService: MessageService
    ) {
        this.configureLeafletIcons();
    }

    get currentUserRange$(): Observable<RangeDisplayInfo | null> {
        return this.userRange$.asObservable();
    }

    focusOnUserWithRange(user: UserDto, radiusMeters: number = 1000): RangeDisplayInfo | null {
        if (!this.map || !user.ubicacion) return null;

        const centerLat = user.ubicacion.geublat;
        const centerLng = user.ubicacion.geublon;

        // Centrar el mapa
        this.map.setView([centerLat, centerLng], 16);

        // Calcular el rango
        const userRange = this.calculateUserRange(centerLat, centerLng, radiusMeters);

        // Crear información del rango
        const rangeInfo: RangeDisplayInfo = {
            user,
            range: userRange,
            bounds: L.latLngBounds(
                [userRange.southWest[0], userRange.southWest[1]],
                [userRange.northEast[0], userRange.northEast[1]]
            )
        };

        // Mostrar el rango en el mapa
        this.displayUserRange(rangeInfo);

        // Actualizar el observable
        this.currentUserRange = rangeInfo;
        this.userRange$.next(rangeInfo);

        // Abrir popup del usuario
        const marker = this.userMarkers.get(user.usucod);
        if (marker) {
            marker.openPopup();
        }

        return rangeInfo;
    }

    private calculateUserRange(lat: number, lng: number, radiusMeters: number): UserRange {
        // Convertir radio de metros a grados (aproximación)
        const earthRadius = 6371000; // Radio de la Tierra en metros
        const latDelta = (radiusMeters / earthRadius) * (180 / Math.PI);
        const lngDelta = latDelta / Math.cos(lat * Math.PI / 180);

        const northEast: [number, number] = [
            lat + latDelta,    // Latitud norte (superior)
            lng + lngDelta     // Longitud este (derecha)
        ];

        const southWest: [number, number] = [
            lat - latDelta,    // Latitud sur (inferior)
            lng - lngDelta     // Longitud oeste (izquierda)
        ];

        return {
            center: [lat, lng],
            northEast,
            southWest,
            radius: radiusMeters
        };
    }


    private displayUserRange(rangeInfo: RangeDisplayInfo): void {
        if (!this.map) return;

        // Limpiar rango anterior
        this.clearUserRange();

        // Crear nuevo grupo de capas para el rango
        this.userRangeLayer = L.layerGroup().addTo(this.map);

        const { range } = rangeInfo;

        // Crear círculo para mostrar el área de cobertura
        const circle = L.circle([range.center[0], range.center[1]], {
            radius: range.radius,
            color: '#3b82f6',        // Azul
            fillColor: '#3b82f6',
            fillOpacity: 0.1,
            weight: 2,
            dashArray: '5, 5'        // Línea discontinua
        });

        // Crear rectángulo para mostrar los bounds exactos
        const rectangle = L.rectangle([
            [range.southWest[0], range.southWest[1]],
            [range.northEast[0], range.northEast[1]]
        ], {
            color: '#ef4444',        // Rojo
            fillColor: '#ef4444',
            fillOpacity: 0.05,
            weight: 1,
            dashArray: '3, 3'
        });

        // Agregar al grupo de capas
        this.userRangeLayer.addLayer(circle);
        this.userRangeLayer.addLayer(rectangle);

        // Crear marcadores en las esquinas con información
        this.addCornerMarkers(range);
    }

    private addCornerMarkers(range: UserRange): void {
        if (!this.userRangeLayer) return;

        // Marcador esquina superior derecha (NorthEast)
        const neMarker = L.circleMarker([range.northEast[0], range.northEast[1]], {
            radius: 6,
            color: '#ef4444',
            fillColor: '#ffffff',
            fillOpacity: 1,
            weight: 2
        });

        neMarker.bindTooltip(`
            <div class="font-semibold text-xs">
                <div class="text-red-600">Límite Superior Derecho</div>
                <div class="mt-1">
                    <div>Lat: ${range.northEast[0].toFixed(6)}</div>
                    <div>Lng: ${range.northEast[1].toFixed(6)}</div>
                </div>
            </div>
        `, {
            permanent: false,
            direction: 'top',
            className: 'range-tooltip'
        });

        // Marcador esquina inferior izquierda (SouthWest)
        const swMarker = L.circleMarker([range.southWest[0], range.southWest[1]], {
            radius: 6,
            color: '#ef4444',
            fillColor: '#ffffff',
            fillOpacity: 1,
            weight: 2
        });

        swMarker.bindTooltip(`
            <div class="font-semibold text-xs">
                <div class="text-red-600">Límite Inferior Izquierdo</div>
                <div class="mt-1">
                    <div>Lat: ${range.southWest[0].toFixed(6)}</div>
                    <div>Lng: ${range.southWest[1].toFixed(6)}</div>
                </div>
            </div>
        `, {
            permanent: false,
            direction: 'bottom',
            className: 'range-tooltip'
        });

        // Agregar marcadores al grupo
        this.userRangeLayer.addLayer(neMarker);
        this.userRangeLayer.addLayer(swMarker);
    }

    clearUserRange(): void {
        if (this.userRangeLayer && this.map) {
            this.map.removeLayer(this.userRangeLayer);
            this.userRangeLayer = null;
        }

        this.currentUserRange = null;
        this.userRange$.next(null);
    }

    getCurrentRangeInfo(): string | null {
        if (!this.currentUserRange) return null;

        const { user, range } = this.currentUserRange;

        return `Usuario ${user.usunombre} (${user.usucod}) tiene un rango de:
        • Coordenada Superior Derecha: ${range.northEast[0].toFixed(6)}, ${range.northEast[1].toFixed(6)}
        • Coordenada Inferior Izquierda: ${range.southWest[0].toFixed(6)}, ${range.southWest[1].toFixed(6)}
        • Radio de cobertura: ${range.radius} metros`;
    }

    // Getters para observables
    get isMapInitialized$(): Observable<boolean> {
        return this.mapInitialized$.asObservable();
    }

    get isSearchingLocation$(): Observable<boolean> {
        return this.searchingLocation$.asObservable();
    }

    get searchResultsList$(): Observable<SearchResult[]> {
        return this.searchResults$.asObservable();
    }
    /**
     * Inicializa el mapa en el contenedor especificado
     */
    initializeMap(container: ElementRef, config?: Partial<MapConfig>): Promise<boolean> {
        return new Promise((resolve, reject) => {
            try {
                const mapConfig = { ...this.defaultConfig, ...config };
                const element = container.nativeElement;

                if (!element) {
                    this.showMapFallback(container);
                    resolve(false);
                }

                // Crear instancia del mapa
                this.map = L.map(element, {
                    center: mapConfig.center,
                    zoom: mapConfig.zoom
                });

                // Agregar capa de tiles
                L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                    maxZoom: 19,
                    attribution: '© OpenStreetMap contributors'
                }).addTo(this.map);

                // Marcador principal
                const mainMarker = L.marker(mapConfig.center).addTo(this.map);
                mainMarker.bindPopup(`<b>${mapConfig.defaultLocation}</b><br>Ubicación principal`).openPopup();

                // Inicializar cluster de marcadores
                this.initializeMarkerCluster();

                // Configurar redimensionamiento
                requestAnimationFrame(() => {
                    this.map?.invalidateSize();
                });

                this.mapInitialized$.next(true);
                console.log('Mapa inicializado correctamente');
                resolve(true);

            } catch (error) {
                console.error('Error inicializando el mapa:', error);
                this.showMapFallback(container);
                this.mapInitialized$.next(false);
                reject(error);
            }
        });
    }

    /**
     * Configura los iconos de Leaflet
     */
    private configureLeafletIcons(): void {
        delete (L.Icon.Default.prototype as any)._getIconUrl;
        L.Icon.Default.mergeOptions({
            iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
            iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
            shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png'
        });
    }

    /**
     * Inicializa el grupo de clustering de marcadores
     */
    private initializeMarkerCluster(): void {
        if (!this.map) return;

        this.markerClusterGroup = L.markerClusterGroup({
            showCoverageOnHover: false,
            maxClusterRadius: 50,
            spiderfyOnMaxZoom: true
        });

        this.map.addLayer(this.markerClusterGroup);
    }

    /**
     * Agrega marcadores de usuarios al mapa
     */
    addUserMarkers(users: UserDto[]): void {
        if (!this.map || !this.markerClusterGroup) return;

        // Limpiar marcadores existentes
        this.clearUserMarkers();

        users.forEach(user => {
            if (user.ubicacion?.geublat && user.ubicacion?.geublon) {
                const marker = this.createUserMarker(user);
                this.userMarkers.set(user.usucod, marker);
                this.markerClusterGroup?.addLayer(marker);
            }
        });
    }

    /**
     * Crea un marcador para un usuario específico
     */
    private createUserMarker(user: UserDto): L.Marker {
        const customIcon = this.createUserIcon();
        const marker = L.marker([user.ubicacion!.geublat, user.ubicacion!.geublon], {
            icon: customIcon
        });

        const popupContent = this.createUserPopupContent(user);
        marker.bindPopup(popupContent, {
            maxWidth: 240,
            className: 'custom-popup'
        });

        return marker;
    }

    /**
     * Crea el icono personalizado para usuarios
     */
    private createUserIcon(): L.DivIcon {
        return L.divIcon({
            html: `
        <div class="relative">
          <div class="w-8 h-8 bg-green-500 rounded-full border-2 border-white shadow-lg flex items-center justify-center">
            <svg class="w-4 h-4 text-white" viewBox="0 0 20 20">
              <path
                fill="currentColor"
                fill-rule="evenodd"
                clip-rule="evenodd"
                d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z"
              />
            </svg>
          </div>
          <div class="absolute -top-1 -right-1 w-3 h-3 bg-blue-400 border border-white rounded-full"></div>
        </div>
      `,
            className: 'custom-user-marker',
            iconSize: [32, 32],
            iconAnchor: [16, 16]
        });
    }

    /**
     * Crea el contenido del popup para un usuario
     */
    private createUserPopupContent(user: UserDto): string {
        const lastUpdate = new Date(user.ubicacion!.geubfech).toLocaleString('es-EC', {
            day: '2-digit',
            month: '2-digit',
            year: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        });

        return `
      <div class="bg-white rounded-lg shadow-sm border-0 overflow-hidden">
        <div class="p-2 space-y-1.5">
          <div class="flex items-center space-x-1.5 text-xs">
            <svg class="w-2.5 h-2.5 text-gray-400" viewBox="0 0 20 20">
              <path fill="currentColor" fill-rule="evenodd" clip-rule="evenodd"
                d="M4 4a2 2 0 00-2 2v8a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2H4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1z" />
            </svg>
            <span class="text-gray-700 font-medium">${user.usucod}</span>
            <span class="text-gray-400">•</span>
            <span class="text-gray-500">${user.usucodv}</span>
          </div>
          <div class="flex items-center space-x-1.5 text-xs">
            <svg class="w-2.5 h-2.5 text-gray-400" viewBox="0 0 20 20">
              <path fill="currentColor" fill-rule="evenodd" clip-rule="evenodd"
                d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
            </svg>
            <span class="text-gray-600 text-xs">${user.usuemail || 'No tiene correo'}</span>
          </div>
          <div class="flex items-center space-x-1.5 text-xs">
            <svg class="w-2.5 h-2.5 text-gray-400" viewBox="0 0 20 20">
              <path fill="currentColor" fill-rule="evenodd" clip-rule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" />
            </svg>
            <span class="text-gray-500">Última ubicación: ${lastUpdate}</span>
          </div>
          <div class="flex items-center space-x-1.5 mt-2">
            <div class="w-2 h-2 bg-green-400 rounded-full"></div>
            <span class="text-xs text-green-600 font-medium">Usuario activo</span>
          </div>
        </div>
      </div>
    `;
    }

    /**
     * Busca ubicaciones usando la API de Nominatim
     */
    searchLocation(query: string): Observable<SearchResult[]> {
        if (!query.trim()) {
            this.msgService.add({
                severity: 'warn',
                summary: 'Advertencia',
                detail: 'Ingrese una ubicación para buscar'
            });
            return new Observable(observer => observer.next([]));
        }

        this.searchingLocation$.next(true);

        const encodedQuery = encodeURIComponent(query.trim());
        const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodedQuery}&limit=5&countrycodes=ec&addressdetails=1`;

        return new Observable<SearchResult[]>(observer => {
            this.http.get<SearchResult[]>(url).subscribe({
                next: (results) => {
                    this.searchingLocation$.next(false);
                    this.searchResults$.next(results);
                    observer.next(results);
                    observer.complete();
                },
                error: (error) => {
                    this.searchingLocation$.next(false);
                    this.searchResults$.next([]);
                    this.msgService.add({
                        severity: 'error',
                        summary: 'Error',
                        detail: 'Error al buscar la ubicación'
                    });
                    observer.error(error);
                }
            });
        });
    }

    /**
     * Selecciona un resultado de búsqueda y lo muestra en el mapa
     */
    selectSearchResult(result: SearchResult): void {
        if (!this.map) return;

        const lat = parseFloat(result.lat);
        const lon = parseFloat(result.lon);

        this.map.setView([lat, lon], 15);

        // Remover marcador de búsqueda anterior
        this.clearSearchMarker();

        // Crear nuevo marcador de búsqueda
        this.searchMarker = L.marker([lat, lon]).addTo(this.map)
            .bindPopup(`<b>${result.display_name}</b><br><small>Resultado de búsqueda</small>`)
            .openPopup();

        this.searchResults$.next([]);

        this.msgService.add({
            severity: 'success',
            summary: 'Ubicación encontrada',
            detail: 'Ubicación marcada en el mapa'
        });
    }

    /**
     * Centra el mapa en un usuario específico
     */
    focusOnUser(user: UserDto): void {
        if (!this.map || !user.ubicacion) return;

        this.map.setView([user.ubicacion.geublat, user.ubicacion.geublon], 15);

        const marker = this.userMarkers.get(user.usucod);
        if (marker) {
            marker.openPopup();
        }
        this.focusOnUserWithRange(user, 1000);

    }

    /**
     * Resetea la vista del mapa
     */
    resetMapView(): void {
        if (!this.map) return;

        this.map.setView(this.defaultConfig.center, this.defaultConfig.zoom);
        this.clearSearchMarker();
        this.clearUserRange(); // Limpiar rango de usuario

        this.searchResults$.next([]);

        this.msgService.add({
            severity: 'info',
            summary: 'Vista restablecida',
            detail: 'El mapa volvió a la vista inicial'
        });
    }

    /**
     * Limpia los marcadores de usuarios
     */
    clearUserMarkers(): void {
        if (this.markerClusterGroup) {
            this.markerClusterGroup.clearLayers();
        }
        this.userMarkers.clear();
    }

    /**
     * Limpia el marcador de búsqueda
     */
    clearSearchMarker(): void {
        if (this.searchMarker && this.map) {
            this.map.removeLayer(this.searchMarker);
            this.searchMarker = null;
        }
    }

    /**
     * Muestra un fallback cuando hay error en el mapa
     */
    private showMapFallback(container: ElementRef): void {
        const mapElement = container.nativeElement;
        mapElement.innerHTML = `
      <div class="flex items-center justify-center h-full bg-surface-100 dark:bg-surface-800 rounded-lg">
        <div class="text-center">
          <i class="pi pi-exclamation-triangle text-4xl text-orange-500 mb-4"></i>
          <p class="text-surface-600 dark:text-surface-400 mb-2">Error al cargar el mapa</p>
          <p class="text-sm text-surface-500">Verifique que Leaflet esté instalado correctamente</p>
        </div>
      </div>
    `;
    }


    /**
     * Destruye el mapa y limpia recursos
     */
    destroyMap(): void {
        this.clearSearchMarker();
        this.clearUserMarkers();
        this.clearUserRange(); // Limpiar rango


        if (this.map) {
            this.map.remove();
            this.map = null;
        }

        this.mapInitialized$.next(false);
        this.userRange$.complete(); // Completar observable

    }

}
