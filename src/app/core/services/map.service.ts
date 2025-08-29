import { ElementRef, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable } from 'rxjs';
import { MessageService } from 'primeng/api';
import * as L from 'leaflet';
import 'leaflet.markercluster';
import { UserDto } from '@/core/models/UserDto';
import { CustomerResponseDto } from '@/core/models/Customer/CustomerResponseDto';
import { GeocercaDto } from '@/core/models/Geocercas/VendedorDto';
import { GeofenceDto } from '@/core/models/Geocercas/GeocercaValidationResponseDto';


//===== INTERFACES =====//
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
//====================================//

@Injectable({
    providedIn: 'root'
})
export class MapService {

    private geocercasLayer: L.FeatureGroup | null = null;
    private geocercasMarkers: Map<string, L.Layer> = new Map();

    // Propiedades para customers
    private customerMarkers: Map<string, L.Marker> = new Map();
    private customerClusterGroup: L.MarkerClusterGroup | null = null;

    private map: L.Map | null = null;
    private userMarkers: Map<string, L.Marker> = new Map();
    private markerClusterGroup: L.MarkerClusterGroup | null = null;
    private searchMarker: L.Marker | null = null;

    private userRangeLayer: L.LayerGroup | null = null;

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


    displayVendorGeocercas(geocercas: GeocercaDto[]): void {
        if (!this.map) return;

        this.clearGeocercas();
        this.geocercasLayer = L.featureGroup().addTo(this.map);

        geocercas.forEach((geocerca) => {
            if (geocerca.geocact) {
                const layer = this.createGeocercaLayer(geocerca);
                if (layer) {
                    this.geocercasMarkers.set(geocerca.geoccod, layer);
                    this.geocercasLayer?.addLayer(layer);
                }
            }
        });

        this.fitGeocercasBounds();
    }

    /**
     * Crea la capa visual para una geocerca
     */
    private createGeocercaLayer(geocerca: GeocercaDto): L.Layer | null {
        try {
            // Parsear coordenadas del polígono
            const coordinates = JSON.parse(geocerca.geoccoor);

            if (!Array.isArray(coordinates) || coordinates.length === 0) {
                return null;
            }

            // Convertir a formato Leaflet
            const latLngs: [number, number][] = coordinates.map((coord) => [coord.lat, coord.lng]);

            // Crear polígono
            const polygon = L.polygon(latLngs, {
                color: '#f32a2a',
                fillColor: '#f32a2a',
                fillOpacity: 0.15,
                weight: 2,
                opacity: 0.8
            });

            // Agregar popup con información
            polygon.bindPopup(this.createGeocercaPopup(geocerca), {
                maxWidth: 280,
                className: 'geocerca-popup'
            });

            // Agregar marcador central
            const centerMarker = L.circleMarker([geocerca.geoclat, geocerca.geoclon], {
                radius: 6,
                color: '#8b5cf6',
                fillColor: '#ffffff',
                fillOpacity: 1,
                weight: 2
            });

            centerMarker.bindTooltip(`Geocerca: ${geocerca.geocnom}`, {
                permanent: false,
                direction: 'top'
            });

            // Crear grupo con polígono y marcador central


            return L.layerGroup([polygon, centerMarker]);
        } catch (error) {
            console.error('Error al crear geocerca:', error);
            return null;
        }
    }

    /**
     * Crea popup para geocerca
     */
    private createGeocercaPopup(geocerca: GeocercaDto): string {
        const fechaAsignacion = new Date(geocerca.fechaAsignacion).toLocaleDateString('es-EC');

        return `
        <div class="bg-white rounded-lg shadow-sm border-0 overflow-hidden">
            <div class="bg-purple-500 text-white px-3 py-2">
                <h3 class="font-semibold text-sm">${geocerca.geocnom}</h3>
                <span class="text-xs opacity-90">${geocerca.geoccod}</span>
            </div>
            <div class="p-3 space-y-2">
                <div class="flex items-center space-x-2 text-xs">
                    <svg class="w-3 h-3 text-gray-400" viewBox="0 0 20 20">
                        <path fill="currentColor" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z"/>
                    </svg>
                    <span class="text-gray-700">${geocerca.geocsec}</span>
                </div>
                <div class="flex items-center space-x-2 text-xs">
                    <svg class="w-3 h-3 text-gray-400" viewBox="0 0 20 20">
                        <path fill="currentColor" d="M4 4a2 2 0 00-2 2v8a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2H4z"/>
                    </svg>
                    <span class="text-gray-600">${geocerca.geocciud}, ${geocerca.geocprov}</span>
                </div>
                <div class="flex items-center space-x-2 text-xs">
                    <svg class="w-3 h-3 text-gray-400" viewBox="0 0 20 20">
                        <path fill="currentColor" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zM4 8h12v8H4V8z"/>
                    </svg>
                    <span class="text-gray-600">Asignada: ${fechaAsignacion}</span>
                </div>
                <div class="flex items-center space-x-2 text-xs">
                    <svg class="w-3 h-3 text-gray-400" viewBox="0 0 20 20">
                        <path fill="currentColor" d="M9 12a1 1 0 102 0V8a1 1 0 10-2 0v4zm1-7a1 1 0 100 2 1 1 0 000-2z M10 18a8 8 0 100-16 8 8 0 000 16z"/>
                    </svg>
                    <span class="text-gray-600">Prioridad: ${geocerca.geocpri}</span>
                </div>
                <div class="flex items-center justify-between mt-3 pt-2 border-t border-gray-100">
                    <div class="flex items-center space-x-1">
                        <div class="w-2 h-2 bg-green-400 rounded-full"></div>
                        <span class="text-xs text-green-600 font-medium">Activa</span>
                    </div>
                    <span class="text-xs text-gray-500">Área: ${geocerca.geocarm}m²</span>
                </div>
            </div>
        </div>
    `;
    }

    /**
     * Ajusta la vista para mostrar todas las geocercas
     */
    private fitGeocercasBounds(): void {
        if (!this.map || this.geocercasMarkers.size === 0) return;

        const bounds = L.latLngBounds([]);

        // Iterar sobre las geocercas y expandir los bounds
        this.geocercasMarkers.forEach(layer => {
            if (layer instanceof L.Polygon) {
                bounds.extend(layer.getBounds());
            } else if (layer instanceof L.LayerGroup) {
                layer.eachLayer(subLayer => {
                    if (subLayer instanceof L.Polygon) {
                        bounds.extend(subLayer.getBounds());
                    }
                });
            }
        });

        if (bounds.isValid()) {
            this.map.fitBounds(bounds, { padding: [20, 20] });
        }
    }
    /**
     * Limpia las geocercas del mapa
     */
    clearGeocercas(): void {
        if (this.geocercasLayer && this.map) {
            this.map.removeLayer(this.geocercasLayer);
            this.geocercasLayer = null;
        }
        this.geocercasMarkers.clear();
    }

    /**
     * Agrega marcadores de clientes al mapa
     */
    addCustomerMarkers(customers: CustomerResponseDto[]): void {
        if (!this.map) return;

        this.clearCustomerMarkers();
        this.initializeCustomerCluster();

        customers.forEach((customer) => {
            if (customer.latitud && customer.longitud) {
                try {
                    const marker = this.createCustomerMarker(customer);
                    this.customerMarkers.set(customer.dirclave, marker);
                    this.customerClusterGroup?.addLayer(marker);
                } catch (error) {
                    console.error('❌ Error al agregar marcador de cliente:', error);
                }
            }
        });
        setTimeout(() => {
            this.map?.invalidateSize();
        }, 100);
    }

    /**
     * Inicializa el cluster de clientes
     */
    private initializeCustomerCluster(): void {
        if (!this.map) return;

        // Siempre limpiar el cluster existente primero
        if (this.customerClusterGroup) {
            this.map.removeLayer(this.customerClusterGroup);
            this.customerClusterGroup = null;
        }

        // Crear nuevo cluster
        this.customerClusterGroup = L.markerClusterGroup({
            showCoverageOnHover: false,
            maxClusterRadius: 40,
            spiderfyOnMaxZoom: true,
            iconCreateFunction: (cluster) => {
                const count = cluster.getChildCount();
                return L.divIcon({
                    html: `<div class="w-8 h-8 bg-purple-500 rounded-full border-2 border-white shadow-lg flex items-center justify-center text-white text-xs font-bold">${count}</div>`,
                    className: 'custom-customer-cluster',
                    iconSize: [32, 32],
                    iconAnchor: [16, 16]
                });
            }
        });

        this.map.addLayer(this.customerClusterGroup);
    }

    /**
     * Crea marcador para cliente
     */
    private createCustomerMarker(customer: CustomerResponseDto): L.Marker {
        const customIcon = this.createCustomerIcon(customer.asignado);
        const marker = L.marker([customer.latitud, customer.longitud], {
            icon: customIcon
        });

        const popupContent = this.createCustomerPopupContent(customer);
        marker.bindPopup(popupContent, {
            maxWidth: 260,
            className: 'custom-customer-popup'
        });

        return marker;
    }

    /**
     * Centra el mapa en un cliente específico
     */
    focusOnCustomer(customer: CustomerResponseDto): void {
        if (!this.map || !customer.latitud || !customer.longitud) return;

        this.map.setView([customer.latitud, customer.longitud], 17);

        const marker = this.customerMarkers.get(customer.dirclave);
        if (marker) {
            marker.openPopup();
        }
    }

    /**
     * Crea icono para cliente
     */
    private createCustomerIcon(isAssigned: boolean): L.DivIcon {
        const bgColor = isAssigned ? 'bg-blue-500' : 'bg-gray-400';
        const indicatorColor = isAssigned ? 'bg-green-400' : 'bg-yellow-400';

        return L.divIcon({
            html: `
            <div class="relative">
                <div class="w-7 h-7 ${bgColor} rounded-full border-2 border-white shadow-md flex items-center justify-center">
                    <svg class="w-3.5 h-3.5 text-white" viewBox="0 0 20 20">
                        <path fill="currentColor" d="M4 4a2 2 0 00-2 2v8a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2H4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1z"/>
                    </svg>
                </div>
                <div class="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 ${indicatorColor} border border-white rounded-full"></div>
            </div>
        `,
            className: 'custom-customer-marker',
            iconSize: [28, 28],
            iconAnchor: [14, 14]
        });
    }

    /**
     * Crea popup para cliente
     */
    private createCustomerPopupContent(customer: CustomerResponseDto): string {
        const statusColor = customer.asignado ? 'text-blue-600' : 'text-gray-600';
        const statusText = customer.asignado ? 'Asignado' : 'No asignado';
        const statusIcon = customer.asignado ? 'text-green-500' : 'text-yellow-500';

        return `
        <div class="bg-white rounded-lg shadow-sm border-0 overflow-hidden">
            <div class="p-3 space-y-2">
                <div class="flex items-center space-x-2 text-sm">
                    <svg class="w-3 h-3 text-gray-400" viewBox="0 0 20 20">
                        <path fill="currentColor" d="M4 4a2 2 0 00-2 2v8a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2H4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1z"/>
                    </svg>
                    <span class="font-medium text-gray-800">${customer.dirnombre}</span>
                </div>
                <div class="flex items-center space-x-2 text-xs text-gray-600">
                    <svg class="w-2.5 h-2.5 text-gray-400" viewBox="0 0 20 20">
                        <path fill="currentColor" d="M2 5a2 2 0 012-2h7a2 2 0 012 2v4a2 2 0 01-2 2H9l-3 3v-3H4a2 2 0 01-2-2V5z"/>
                    </svg>
                    <span>${customer.dirruc}</span>
                </div>
                <div class="flex items-start space-x-2 text-xs text-gray-600">
                    <svg class="w-2.5 h-2.5 text-gray-400 mt-0.5" viewBox="0 0 20 20">
                        <path fill="currentColor" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z"/>
                    </svg>
                    <span class="leading-tight">${customer.dirdirec}</span>
                </div>
                <div class="flex items-center space-x-2 mt-2 pt-2 border-t border-gray-100">
                    <div class="w-2 h-2 ${statusIcon} rounded-full"></div>
                    <span class="text-xs ${statusColor} font-medium">${statusText}</span>
                </div>
            </div>
        </div>
    `;
    }

    /**
     * Limpia marcadores de clientes
     */
    clearCustomerMarkers(): void {
        if (this.customerClusterGroup && this.map) {
            this.customerClusterGroup.clearLayers();
            this.map.removeLayer(this.customerClusterGroup);
            this.customerClusterGroup = null;
        }

        this.customerMarkers.clear();
    }

    focusOnUserWithRange(user: UserDto, radiusMeters: number = 1000): RangeDisplayInfo | null {
        if (!this.map || !user.ubicacion) return null;

        const centerLat = user.ubicacion.geublat;
        const centerLng = user.ubicacion.geublon;

        this.map.setView([centerLat, centerLng], 16);
        const userRange = this.calculateUserRange(centerLat, centerLng, radiusMeters);

        const rangeInfo: RangeDisplayInfo = {
            user,
            range: userRange,
            bounds: L.latLngBounds([userRange.southWest[0], userRange.southWest[1]], [userRange.northEast[0], userRange.northEast[1]])
        };

        this.displayUserRange(rangeInfo);
        this.userRange$.next(rangeInfo);

        const marker = this.userMarkers.get(user.usucod);
        if (marker) {
            marker.openPopup();
        }

        return rangeInfo;
    }

    private calculateUserRange(lat: number, lng: number, radiusMeters: number): UserRange {
        const earthRadius = 6371000; // Radio de la Tierra en metros
        const latDelta = (radiusMeters / earthRadius) * (180 / Math.PI);
        const lngDelta = latDelta / Math.cos((lat * Math.PI) / 180);

        const northEast: [number, number] = [lat + latDelta, lng + lngDelta];

        const southWest: [number, number] = [lat - latDelta, lng - lngDelta];

        return {
            center: [lat, lng],
            northEast,
            southWest,
            radius: radiusMeters
        };
    }

    private displayUserRange(rangeInfo: RangeDisplayInfo): void {
        if (!this.map) return;
        this.clearUserRange();
        this.userRangeLayer = L.layerGroup().addTo(this.map);

        const { range } = rangeInfo;

        // Crear círculo para mostrar el área de cobertura
        const circle = L.circle([range.center[0], range.center[1]], {
            radius: range.radius,
            color: '#3b82f6',
            fillColor: '#3b82f6',
            fillOpacity: 0.1,
            weight: 2,
            dashArray: '5, 5' // Línea discontinua
        });

        // Crear rectángulo para mostrar los bounds exactos
        const rectangle = L.rectangle(
            [
                [range.southWest[0], range.southWest[1]],
                [range.northEast[0], range.northEast[1]]
            ],
            {
                color: '#ef4444',
                fillColor: '#ef4444',
                fillOpacity: 0.05,
                weight: 1,
                dashArray: '3, 3'
            }
        );
        this.userRangeLayer.addLayer(circle);
        this.userRangeLayer.addLayer(rectangle);
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

        neMarker.bindTooltip(
            `
            <div class="font-semibold text-xs">
                <div class="text-red-600">Límite Superior Derecho</div>
                <div class="mt-1">
                    <div>Lat: ${range.northEast[0].toFixed(6)}</div>
                    <div>Lng: ${range.northEast[1].toFixed(6)}</div>
                </div>
            </div>
        `,
            {
                permanent: false,
                direction: 'top',
                className: 'range-tooltip'
            }
        );

        // Marcador esquina inferior izquierda (SouthWest)
        const swMarker = L.circleMarker([range.southWest[0], range.southWest[1]], {
            radius: 6,
            color: '#ef4444',
            fillColor: '#ffffff',
            fillOpacity: 1,
            weight: 2
        });

        swMarker.bindTooltip(
            `
            <div class="font-semibold text-xs">
                <div class="text-red-600">Límite Inferior Izquierdo</div>
                <div class="mt-1">
                    <div>Lat: ${range.southWest[0].toFixed(6)}</div>
                    <div>Lng: ${range.southWest[1].toFixed(6)}</div>
                </div>
            </div>
        `,
            {
                permanent: false,
                direction: 'bottom',
                className: 'range-tooltip'
            }
        );
        this.userRangeLayer.addLayer(neMarker);
        this.userRangeLayer.addLayer(swMarker);
    }

    clearUserRange(): void {
        if (this.userRangeLayer && this.map) {
            this.map.removeLayer(this.userRangeLayer);
            this.userRangeLayer = null;
        }

        this.userRange$.next(null);
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

                this.map = L.map(element, {
                    center: mapConfig.center,
                    zoom: mapConfig.zoom
                });

                L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                    maxZoom: 19,
                    attribution: '© OpenStreetMap contributors'
                }).addTo(this.map);

                const mainMarker = L.marker(mapConfig.center).addTo(this.map);
                mainMarker.bindPopup(`<b>${mapConfig.defaultLocation}</b><br>Ubicación principal`).openPopup();

                this.initializeMarkerCluster();

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

        this.clearUserMarkers();

        users.forEach((user) => {
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
            return new Observable((observer) => observer.next([]));
        }

        this.searchingLocation$.next(true);

        const encodedQuery = encodeURIComponent(query.trim());
        const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodedQuery}&limit=5&countrycodes=ec&addressdetails=1`;

        return new Observable<SearchResult[]>((observer) => {
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

        this.clearSearchMarker();
        this.searchMarker = L.marker([lat, lon]).addTo(this.map).bindPopup(`<b>${result.display_name}</b><br><small>Resultado de búsqueda</small>`).openPopup();

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
     * Agrega marcadores de geocercas al mapa
     */
    addGeocercaMarkers(geocercas: GeofenceDto[]): void {
        if (!this.map) return;

        this.clearGeocercas();
        this.geocercasLayer = L.featureGroup().addTo(this.map);

        geocercas.forEach((geocerca) => {
            if (geocerca.geocact && geocerca.geoclat && geocerca.geoclon) {
                try {
                    const layer = this.createGeocercaResponseLayer(geocerca);
                    if (layer) {
                        this.geocercasMarkers.set(geocerca.geoccod, layer);
                        this.geocercasLayer?.addLayer(layer);
                    }
                } catch (error) {
                    console.error('Error al agregar marcador de geocerca:', error);
                }
            }
        });

        // Auto-fit bounds si hay geocercas
        if (geocercas.length > 0) {
            this.fitGeocercasBounds();
        }

        setTimeout(() => {
            this.map?.invalidateSize();
        }, 100);
    }

    /**
     * Crea la capa visual para una geocerca del tipo GeocercaResponseDto
     */
    private createGeocercaResponseLayer(geocerca: GeofenceDto): L.Layer | null {
        try {
            const layers: L.Layer[] = [];

            // Crear polígono si tiene coordenadas
            if (geocerca.geoccoor) {
                const coordinates = JSON.parse(geocerca.geoccoor);

                if (Array.isArray(coordinates) && coordinates.length > 0) {
                    const latLngs: [number, number][] = coordinates.map((coord) => [coord.lat, coord.lng]);

                    const polygon = L.polygon(latLngs, {
                        color: '#8b5cf6',
                        fillColor: '#8b5cf6',
                        fillOpacity: 0.15,
                        weight: 2,
                        opacity: 0.8
                    });

                    polygon.bindPopup(this.createGeocercaResponsePopup(geocerca), {
                        maxWidth: 280,
                        className: 'geocerca-response-popup'
                    });

                    layers.push(polygon);
                }
            }

            // Crear marcador central
            const centerMarker = L.circleMarker([geocerca.geoclat, geocerca.geoclon], {
                radius: 8,
                color: '#8b5cf6',
                fillColor: '#ffffff',
                fillOpacity: 1,
                weight: 3
            });

            centerMarker.bindTooltip(`${geocerca.geocnom}`, {
                permanent: false,
                direction: 'top',
                className: 'geocerca-tooltip'
            });

            centerMarker.bindPopup(this.createGeocercaResponsePopup(geocerca), {
                maxWidth: 280,
                className: 'geocerca-response-popup'
            });

            layers.push(centerMarker);

            // Retornar grupo con todas las capas
            return layers.length > 1 ? L.layerGroup(layers) : layers[0];
        } catch (error) {
            console.error('Error al crear geocerca:', error);

            // Fallback: solo marcador central
            const fallbackMarker = L.circleMarker([geocerca.geoclat, geocerca.geoclon], {
                radius: 6,
                color: '#ef4444',
                fillColor: '#ffffff',
                fillOpacity: 1,
                weight: 2
            });

            fallbackMarker.bindPopup(this.createGeocercaResponsePopup(geocerca));
            return fallbackMarker;
        }
    }

    /**
     * Crea popup para geocerca del tipo GeocercaResponseDto
     */
    private createGeocercaResponsePopup(geocerca: GeofenceDto): string {
        const fechaCreacion = new Date(geocerca.geocfcre).toLocaleDateString('es-EC', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        });

        const statusColor = geocerca.geocact ? 'text-green-600' : 'text-red-600';
        const statusText = geocerca.geocact ? 'Activa' : 'Inactiva';
        const statusIcon = geocerca.geocact ? 'bg-green-400' : 'bg-red-400';

        return `
        <div class="bg-white rounded-lg shadow-sm border-0 overflow-hidden">
            <div class="bg-purple-500 text-white px-3 py-2">
                <h3 class="font-semibold text-sm">${geocerca.geocnom}</h3>
                <span class="text-xs opacity-90">${geocerca.geoccod}</span>
            </div>
            <div class="p-3 space-y-2">
                <div class="flex items-center space-x-2 text-xs">
                    <svg class="w-3 h-3 text-gray-400" viewBox="0 0 20 20">
                        <path fill="currentColor" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z"/>
                    </svg>
                    <span class="text-gray-700">${geocerca.geocsec}</span>
                </div>
                <div class="flex items-center space-x-2 text-xs">
                    <svg class="w-3 h-3 text-gray-400" viewBox="0 0 20 20">
                        <path fill="currentColor" d="M4 4a2 2 0 00-2 2v8a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2H4z"/>
                    </svg>
                    <span class="text-gray-600">${geocerca.geocciud}, ${geocerca.geocprov}</span>
                </div>
                <div class="flex items-center space-x-2 text-xs">
                    <svg class="w-3 h-3 text-gray-400" viewBox="0 0 20 20">
                        <path fill="currentColor" d="M9 12a1 1 0 102 0V8a1 1 0 10-2 0v4zm1-7a1 1 0 100 2 1 1 0 000-2z M10 18a8 8 0 100-16 8 8 0 000 16z"/>
                    </svg>
                    <span class="text-gray-600">País: ${geocerca.geocpais}</span>
                </div>
                <div class="flex items-center space-x-2 text-xs">
                    <svg class="w-3 h-3 text-gray-400" viewBox="0 0 20 20">
                        <path fill="currentColor" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zM4 8h12v8H4V8z"/>
                    </svg>
                    <span class="text-gray-600">Creada: ${fechaCreacion}</span>
                </div>
                <div class="flex items-center justify-between mt-3 pt-2 border-t border-gray-100">
                    <div class="flex items-center space-x-1">
                        <div class="w-2 h-2 ${statusIcon} rounded-full"></div>
                        <span class="text-xs ${statusColor} font-medium">${statusText}</span>
                    </div>
                    <div class="text-right">
                        <div class="text-xs text-gray-500">Prioridad: ${geocerca.geocpri}</div>
                        ${geocerca.geocarm ? `<div class="text-xs text-gray-500">Área: ${geocerca.geocarm}m²</div>` : ''}
                    </div>
                </div>
            </div>
        </div>
    `;
    }

    /**
     * Centra el mapa en una geocerca específica
     */
    focusOnGeocerca(geocerca: GeofenceDto): void {
        if (!this.map || !geocerca.geoclat || !geocerca.geoclon) return;

        // Centrar en la geocerca con zoom apropiado
        this.map.setView([geocerca.geoclat, geocerca.geoclon], 16);

        // Abrir popup del marcador si existe
        const marker = this.geocercasMarkers.get(geocerca.geoccod);
        if (marker) {
            // Si es un LayerGroup, buscar el marcador que tiene popup
            if ('getLayers' in marker) {
                const layers = (marker as L.LayerGroup).getLayers();
                const markerWithPopup = layers.find((layer) => 'openPopup' in layer && '_popup' in layer) as L.Layer & { openPopup(): void };

                if (markerWithPopup) {
                    markerWithPopup.openPopup();
                }
            } else if ('openPopup' in marker) {
                (marker as any).openPopup();
            }
        }

        // Mensaje de confirmación
        this.msgService.add({
            severity: 'info',
            summary: 'Geocerca seleccionada',
            detail: `Mostrando: ${geocerca.geocnom}`,
            life: 1000
        });
    }

    /**
     * Resetea la vista del mapa a la configuración inicial
     */
    resetMapView(): void {
        if (!this.map) return;

        // Restablecer vista a la configuración por defecto
        this.map.setView(this.defaultConfig.center, this.defaultConfig.zoom);

        // Limpiar marcadores de búsqueda
        this.clearSearchMarker();

        // Limpiar rangos de usuario si existen
        this.clearUserRange();

        // Resetear resultados de búsqueda
        this.searchResults$.next([]);

        // Mensaje de confirmación
        this.msgService.add({
            severity: 'info',
            summary: 'Vista restablecida',
            detail: 'El mapa ha vuelto a la vista inicial'
        });

        // Invalidar tamaño para asegurar renderizado correcto
        setTimeout(() => {
            this.map?.invalidateSize();
        }, 100);
    }

    /**
     * Destruye el mapa y limpia recursos
     */
    destroyMap(): void {
        this.clearSearchMarker();
        this.clearUserMarkers();
        this.clearUserRange();
        this.clearCustomerMarkers();
        this.clearGeocercas();

        if (this.markerClusterGroup && this.map) {
            this.map.removeLayer(this.markerClusterGroup);
            this.markerClusterGroup = null;
        }

        if (this.map) {
            this.map.remove();
            this.map = null;
        }

        this.mapInitialized$.next(false);
    }
}
