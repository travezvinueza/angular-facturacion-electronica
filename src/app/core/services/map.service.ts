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
import { ChargeDto, LocationDto, OrderDto, UserLocationDto } from '../models/Filter/TrackingResponse';


//===== INTERFACES ======//
export interface MapConfig {
    center: [number, number];
    zoom: number;
    defaultLocation: string;
    zoomControl: boolean;

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
    //Variables para el filtrado de Especial
    private trackingMarkers = new Map<string, L.Marker>();
    private chargeMarkers = new Map<string, L.Marker>();
    private orderMarkers = new Map<string, L.Marker>();
    private trackingPath: L.Polyline | null = null;
    private trackingClusterGroup: L.MarkerClusterGroup | null = null;
    private chargeClusterGroup: L.MarkerClusterGroup | null = null;
    private orderClusterGroup: L.MarkerClusterGroup | null = null;

    private markerClusterLoaded = false;
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
        defaultLocation: 'Quito, Ecuador',
        zoomControl: true
    };

    // Observables para el estado
    private mapInitialized$ = new BehaviorSubject<boolean>(false);
    private searchingLocation$ = new BehaviorSubject<boolean>(false);
    private searchResults$ = new BehaviorSubject<SearchResult[]>([]);
    private boundsSubject = new BehaviorSubject<L.LatLngBounds | null>(null);

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
        this.geocercasMarkers.forEach((layer) => {
            if (layer instanceof L.Polygon) {
                bounds.extend(layer.getBounds());
            } else if (layer instanceof L.LayerGroup) {
                layer.eachLayer((subLayer) => {
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

        this.map.setView([customer.latitud, customer.longitud], 20);

        const marker = this.customerMarkers.get(customer.dirclave);
        if (marker) {
            marker.openPopup();
        }
    }

    /**
     * Crea icono para cliente
     */
    private createCustomerIcon(isAssigned: boolean): L.DivIcon {
        const bgColor = isAssigned ? 'bg-green-500' : 'bg-red-500';
        const indicatorColor = isAssigned ? 'bg-green-400' : 'bg-yellow-400';

        return L.divIcon({
            html: `
            <div class="relative">
                <div class="w-10 h-10 ${bgColor} rounded-full border-2 border-white shadow-md flex items-center justify-center">
                    <svg class="w-5 h-5 text-white" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 12c2.7 0 4.9-2.2 4.9-4.9S14.7 2.2 12 2.2 7.1 4.4 7.1 7.1 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z"/>
                    </svg>
                </div>
                <div class="absolute -top-0.5 -right-0.5 w-3 h-3 ${indicatorColor} border border-white rounded-full"></div>
            </div>`,
            className: 'custom-customer-marker',
            iconSize: [40, 40],
            iconAnchor: [20, 20]
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

        this.hideAllUserMarkersExcept(user.usucod);

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

    private hideAllUserMarkersExcept(selectedUserCode: string): void {
        if (!this.markerClusterGroup) return;

        this.userMarkers.forEach((marker, userCode) => {
            if (userCode !== selectedUserCode) {
                this.markerClusterGroup?.removeLayer(marker);
            }
        });
    }

    restoreAllUserMarkers(): void {
        if (!this.markerClusterGroup) return;

        this.userMarkers.forEach((marker) => {
            this.markerClusterGroup?.addLayer(marker);
        });
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

        // Crear rectángulo para mostrar los bounds exactos
        const rectangle = L.rectangle(
            [
                [range.southWest[0], range.southWest[1]],
                [range.northEast[0], range.northEast[1]]
            ],
            {
                color: '#ef4444',
                fillColor: '#ef4444',
                fillOpacity: 0, // Relleno transparente
                opacity: 0, // Borde transparente
                weight: 1,
                dashArray: '3, 3'
            }
        );
        this.userRangeLayer.addLayer(rectangle);
        this.addCornerMarkers(range);
    }

    private addCornerMarkers(range: UserRange): void {
        if (!this.userRangeLayer) return;

        // Marcador esquina superior derecha (NorthEast)
        const neMarker = L.circleMarker([range.northEast[0], range.northEast[1]], {
            radius: 6,
            color: '#ffffff',
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
    async initializeMap(container: ElementRef, config?: Partial<MapConfig>): Promise<boolean> {
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
                    zoom: mapConfig.zoom,
                    zoomControl: mapConfig.zoomControl
                });

                L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                    maxZoom: 19,
                    attribution: '© OpenStreetMap contributors'
                }).addTo(this.map);

                const mapInstance = this.map;
                mapInstance.on('moveend zoomend', () => {
                    const bounds = mapInstance.getBounds();
                    this.boundsSubject.next(bounds); // Emitir cambios
                    console.log('Nuevas coordenadas:', {
                        southWest: bounds.getSouthWest(),
                        northEast: bounds.getNorthEast()
                    });
                });

                const mainMarker = L.marker(mapConfig.center).addTo(this.map);
                mainMarker.bindPopup(`<b>${mapConfig.defaultLocation}</b><br>Ubicación principal`).openPopup();

                this.initializeMarkerCluster();

                setTimeout(() => {
                    this.map?.invalidateSize();
                }, 100);

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

    addSearchAreaButton(onSearchClick: (bounds: L.LatLngBounds) => void): void {
        if (!this.map) return;

        const mapContainer = this.map.getContainer();

        // Crear contenedor principal flotante
        const container = L.DomUtil.create('div', 'leaflet-control leaflet-control-custom', mapContainer);

        // Estilos base
        container.style.position = 'absolute';
        container.style.top = '10px';
        container.style.left = '50%';
        container.style.transform = 'translateX(-50%)';
        container.style.backgroundColor = 'white';
        container.style.padding = '6px 12px';
        container.style.display = 'flex';
        container.style.alignItems = 'center';
        container.style.gap = '6px';
        container.style.cursor = 'pointer';
        container.style.fontSize = '13px';
        container.style.fontWeight = '600'; // más peso
        container.style.fontFamily = 'Segoe UI, Roboto, sans-serif'; // tipografía distinta
        container.style.border = '2px solid rgba(0,0,0,0.2)';
        container.style.borderRadius = '10px'; // bordes suaves
        container.style.boxShadow = '0 2px 6px rgba(0,0,0,0.15)'; // sombra ligera
        container.style.transition = 'all 0.2s ease'; // transición suave

        // Agregar icono y texto
        container.innerHTML = `
            <i class="pi pi-search" style="font-size: 15px; color: #4f46e5;"></i>
            <span style="color: #374151;">Buscar en esta área</span>
        `;

        // Hover
        container.onmouseenter = () => {
            container.style.backgroundColor = '#f3f4f6'; // gris clarito
            container.style.borderColor = '#4f46e5'; // morado del ícono
            container.style.boxShadow = '0 3px 8px rgba(0,0,0,0.25)';
        };

        container.onmouseleave = () => {
            container.style.backgroundColor = 'white';
            container.style.borderColor = 'rgba(0,0,0,0.2)';
            container.style.boxShadow = '0 2px 6px rgba(0,0,0,0.15)';
        };

        // Click
        container.onclick = () => {
            const currentBounds = this.map!.getBounds();
            onSearchClick(currentBounds);
        };

        // Prevenir propagación
        L.DomEvent.disableClickPropagation(container);
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
     * Obtiene los bounds actuales del mapa
     */
    getCurrentBounds(): L.LatLngBounds {
        if (!this.map) {
            throw new Error('El mapa no está inicializado');
        }
        return this.map.getBounds();
    }

    /**
     * Centra el mapa para mostrar todas las coordenadas proporcionadas
     */
    fitBoundsToCoordinates(coordinates: [number, number][]): void {
        if (!this.map || coordinates.length === 0) return;

        try {
            if (coordinates.length === 1) {
                // Si solo hay una coordenada, centrar con zoom específico
                this.map.setView(coordinates[0], 15);
            } else {
                // Si hay múltiples coordenadas, crear bounds para incluir todas
                const group = new L.FeatureGroup();

                coordinates.forEach((coord) => {
                    L.marker(coord).addTo(group);
                });

                // Ajustar el mapa para mostrar todos los puntos con padding
                this.map.fitBounds(group.getBounds(), {
                    padding: [20, 20], // Padding en píxeles
                    maxZoom: 16 // Zoom máximo para evitar acercarse demasiado
                });

                // Limpiar el grupo temporal
                group.clearLayers();
            }
        } catch (error) {
            console.error('Error al centrar el mapa:', error);
        }
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
          <div class="w-8 h-8 bg-blue-500 rounded-full border-2 border-white shadow-lg flex items-center justify-center">
            <svg class="w-4 h-4 text-white" viewBox="0 0 20 20">
              <path
                fill="currentColor"
                fill-rule="evenodd"
                clip-rule="evenodd"
                d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z"
              />
            </svg>
          </div>
          <div class="absolute -top-1 -right-1 w-3 h-3 bg-green-400 border border-white rounded-full"></div>
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

        this.clearTrackingMarkers();

        this.clearAllTrackingData();

        this.clearCustomerMarkers();

        this.clearGeocercas();

        // Limpiar rangos de usuario si existen
        this.clearUserRange();
        this.restoreAllUserMarkers();

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
     * Agrega marcadores de tracking (ubicaciones del vendedor) al mapa
     */
    addTrackingMarkers(userLocations: UserLocationDto[]): void {
        if (!this.map || userLocations.length === 0) return;

        this.clearTrackingMarkers();
        this.initializeTrackingCluster();

        const userLocation = userLocations[0]; // Solo un usuario
        const locations = userLocation.ubicaciones;

        // Crear marcadores para cada ubicación
        locations.forEach((location, index) => {
            if (location.latitud && location.longitud) {
                try {
                    const marker = this.createTrackingMarker(location, index, locations.length);
                    const markerId = `${location.latitud}-${location.longitud}-${location.tiempo}`;
                    this.trackingMarkers.set(markerId, marker);
                    this.trackingClusterGroup?.addLayer(marker);
                } catch (error) {
                    console.error('Error al agregar marcador de tracking:', error);
                }
            }
        });

        this.createTrackingPath(userLocations);

        setTimeout(() => {
            this.map?.invalidateSize();
        }, 100);
    }

    /**
     * Agrega marcadores de cobros al mapa
     */
    addChargeMarkers(charges: ChargeDto[]): void {
        if (!this.map) return;

        this.clearChargeMarkers();
        this.initializeChargeCluster();

        charges.forEach((charge) => {
            if (charge.cablat && charge.cablon) {
                try {
                    const marker = this.createChargeMarker(charge);
                    this.chargeMarkers.set(charge.cabnumero.toString(), marker);
                    this.chargeClusterGroup?.addLayer(marker);
                } catch (error) {
                    console.error('❌ Error al agregar marcador de cobro:', error);
                }
            }
        });

        setTimeout(() => {
            this.map?.invalidateSize();
        }, 100);
    }

    /**
     * Agrega marcadores de pedidos al mapa
     */
    addOrderMarkers(orders: OrderDto[]): void {
        if (!this.map) return;

        this.clearOrderMarkers();
        this.initializeOrderCluster();

        orders.forEach((order) => {
            if (order.pdtlat && order.pdtlon) {
                try {
                    const marker = this.createOrderMarker(order);
                    this.orderMarkers.set(order.pdtfactura.toString(), marker);
                    this.orderClusterGroup?.addLayer(marker);
                } catch (error) {
                    console.error('❌ Error al agregar marcador de pedido:', error);
                }
            }
        });

        setTimeout(() => {
            this.map?.invalidateSize();
        }, 100);
    }

    // ============= MÉTODOS PRIVADOS PARA CREAR MARCADORES =============

    /**
     * Crea marcador para ubicación de tracking
     */
    private createTrackingMarker(location: LocationDto, index: number, totalLocations: number): L.Marker {
        const isLastLocation = index === totalLocations - 1;
        const customIcon = this.createTrackingIcon(index, isLastLocation);
        const marker = L.marker([location.latitud, location.longitud], {
            icon: customIcon
        });

        const popupContent = this.createTrackingPopupContent(location, index, isLastLocation);
        marker.bindPopup(popupContent, {
            maxWidth: 260,
            className: 'custom-tracking-popup'
        });

        return marker;
    }

    /**
     * Crea marcador para cobro
     */
    private createChargeMarker(charge: ChargeDto): L.Marker {
        const customIcon = this.createChargeIcon();
        const marker = L.marker([charge.cablat, charge.cablon], {
            icon: customIcon
        });

        const popupContent = this.createChargePopupContent(charge);
        marker.bindPopup(popupContent, {
            maxWidth: 280,
            className: 'custom-charge-popup'
        });

        return marker;
    }

    /**
     * Crea marcador para pedido
     */
    private createOrderMarker(order: OrderDto): L.Marker {
        const customIcon = this.createOrderIcon();
        const marker = L.marker([order.pdtlat, order.pdtlon], {
            icon: customIcon
        });

        const popupContent = this.createOrderPopupContent(order);
        marker.bindPopup(popupContent, {
            maxWidth: 280,
            className: 'custom-order-popup'
        });

        return marker;
    }

    // ============= MÉTODOS PARA CREAR ICONOS =============

    /**
     * Crea icono para ubicación de tracking
     */
    private createTrackingIcon(index: number, isLastLocation: boolean = false): L.DivIcon {
        // Usar icono especial para la última ubicación (posición actual)
        if (isLastLocation) {
            return this.createDeliveryPersonIcon();
        }

        // Icono simple para ubicaciones históricas (como en la imagen)
        return L.divIcon({
            html: `
            <div class="relative">
                <div class="w-3 h-3 bg-gray-400 rounded-full border-2 border-white shadow-sm">
                </div>
            </div>`,
            className: 'custom-tracking-marker',
            iconSize: [12, 12],
            iconAnchor: [6, 6]
        });
    }

    /**
     * Crea icono para repartidor/persona en movimiento
     */
    private createDeliveryPersonIcon(): L.DivIcon {
        return L.divIcon({
            html: `
<div class="relative">
    <div class="w-10 h-10 bg-blue-500 rounded-full border-2 border-white shadow-lg flex items-center justify-center">
        <svg class="w-5 h-5 text-white" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12,4A4,4 0 0,1 16,8A4,4 0 0,1 12,12A4,4 0 0,1 8,8A4,4 0 0,1 12,4M12,14C16.42,14 20,15.79 20,18V20H4V18C4,15.79 7.58,14 12,14Z"/>
        </svg>
    </div>
</div>`,
            className: 'custom-delivery-person-marker',
            iconSize: [40, 40],
            iconAnchor: [20, 20]
        });
    }

    /**
     * Crea icono para cobro
     */
    private createChargeIcon(): L.DivIcon {
        return L.divIcon({
            html: `
        <div class="relative">
            <div class="w-10 h-10 bg-green-600 rounded-full border-2 border-white shadow-md flex items-center justify-center">
                <svg class="w-5 h-5 text-white" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M7,15H9C9,16.08 10.37,17 12,17C13.63,17 15,16.08 15,15C15,13.9 13.96,13.5 11.76,12.97C9.64,12.44 7,11.78 7,9C7,7.21 8.47,5.69 10.5,5.18V3H13.5V5.18C15.53,5.69 17,7.21 17,9H15C15,7.92 13.63,7 12,7C10.37,7 9,7.92 9,9C9,10.1 10.04,10.5 12.24,11.03C14.36,11.56 17,12.22 17,15C17,16.79 15.53,18.31 13.5,18.82V21H10.5V18.82C8.47,18.31 7,16.79 7,15Z"/>
                </svg>
            </div>
            <div class="absolute -top-1 -right-1 w-4 h-4 bg-yellow-400 border border-white rounded-full flex items-center justify-center">
                <span class="text-xs font-bold text-green-800">$</span>
            </div>
        </div>`,
            className: 'custom-charge-marker',
            iconSize: [40, 40],
            iconAnchor: [20, 20]
        });
    }

    /**
     * Crea icono para pedido
     */
    private createOrderIcon(): L.DivIcon {
        return L.divIcon({
            html: `
            <div class="relative">
                <div class="w-10 h-10 bg-purple-500 rounded-full border-2 border-white shadow-md flex items-center justify-center">
                    <svg class="w-5 h-5 text-white" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M17 18C15.89 18 15 18.89 15 20C15 21.11 15.89 22 17 22C18.11 22 19 21.11 19 20C19 18.89 18.11 18 17 18ZM1 2V4H3L6.6 11.59L5.25 14.04C5.09 14.32 5 14.65 5 15C5 16.11 5.89 17 7 17H19V15H7.42C7.28 15 7.17 14.89 7.17 14.75L7.2 14.63L8.1 13H15.55C16.3 13 16.96 12.59 17.3 11.97L20.88 5H5.21L4.27 2H1ZM7 18C5.89 18 5 18.89 5 20C5 21.11 5.89 22 7 22C8.11 22 9 21.11 9 20C9 18.89 8.11 18 7 18Z"/>
                    </svg>
                </div>
                <div class="absolute -top-1 -right-1 w-4 h-4 bg-purple-400 border border-white rounded-full flex items-center justify-center">
                    <span class="text-xs font-bold text-purple-800">P</span>
                </div>
            </div>`,
            className: 'custom-order-marker',
            iconSize: [40, 40],
            iconAnchor: [20, 20]
        });
    }

    // ============= MÉTODOS PARA CREAR POPUPS =============

    /**
     * Crea popup para ubicación de tracking
     */
    private createTrackingPopupContent(location: LocationDto, index: number, isLastLocation: boolean = false): string {
        const date = new Date(location.tiempo);
        const formattedDate = date.toLocaleDateString('es-ES');
        const formattedTime = date.toLocaleTimeString('es-ES', {
            hour: '2-digit',
            minute: '2-digit'
        });

        const headerColor = isLastLocation ? 'bg-green-600' : 'bg-blue-600';
        const title = isLastLocation ? 'Ubicación Actual' : `Ubicación ${index + 1}`;
        const timeLabel = isLastLocation ? 'Última actualización' : 'Registro';

        return `
        <div class="bg-white rounded-lg shadow-sm border-0 overflow-hidden">
            <div class="${headerColor} px-3 py-2">
                <div class="flex items-center space-x-2 text-white">
                    <svg class="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                        ${
                            isLastLocation
                                ? '<path d="M12,4A4,4 0 0,1 16,8A4,4 0 0,1 12,12A4,4 0 0,1 8,8A4,4 0 0,1 12,4M12,14C16.42,14 20,15.79 20,18V20H4V18C4,15.79 7.58,14 12,14Z"/>'
                                : '<path d="M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2Z"/>'
                        }
                    </svg>
                    <span class="font-semibold text-sm">${title}</span>
                    ${isLastLocation ? '<div class="w-2 h-2 bg-green-300 rounded-full animate-pulse ml-1"></div>' : ''}
                </div>
            </div>
            <div class="p-3 space-y-2">
                <div class="flex items-center space-x-2 text-sm">
                    <svg class="w-3 h-3 text-gray-400" viewBox="0 0 20 20">
                        <path fill="currentColor" d="M10 2L3 7v11h4v-6h6v6h4V7l-7-5z"/>
                    </svg>
                    <span class="font-medium text-gray-800">Vendedor</span>
                </div>
                <div class="flex items-center space-x-2 text-xs text-gray-600">
                    <svg class="w-2.5 h-2.5 text-gray-400" viewBox="0 0 20 20">
                        <path fill="currentColor" d="M10 2a6 6 0 00-6 6c0 4.314 5.686 9.32 5.814 9.45a.5.5 0 00.372 0C10.314 17.32 16 12.314 16 8a6 6 0 00-6-6z"/>
                    </svg>
                    <span>${location.latitud.toFixed(6)}, ${location.longitud.toFixed(6)}</span>
                </div>
                <div class="flex items-center space-x-2 text-xs text-gray-600">
                    <svg class="w-2.5 h-2.5 text-gray-400" viewBox="0 0 20 20">
                        <path fill="currentColor" d="M10 2a8 8 0 100 16 8 8 0 000-16zm1 11H9v-2h2v2zm0-4H9V5h2v4z"/>
                    </svg>
                    <span>${timeLabel}: ${formattedDate} - ${formattedTime}</span>
                </div>
            </div>
        </div>
    `;
    }

    /**
     * Crea popup para cobro
     */
    private createChargePopupContent(charge: ChargeDto): string {
        const date = new Date(charge.cabfecha);
        const formattedDate = date.toLocaleDateString('es-ES');

        return `
    <div class="bg-white rounded-lg shadow-sm border-0 overflow-hidden">
        <div class="bg-green-600 px-3 py-2">
            <div class="flex items-center space-x-2 text-white">
                <svg class="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M7,15H9C9,16.08 10.37,17 12,17C13.63,17 15,16.08 15,15C15,13.9 13.96,13.5 11.76,12.97C9.64,12.44 7,11.78 7,9C7,7.21 8.47,5.69 10.5,5.18V3H13.5V5.18C15.53,5.69 17,7.21 17,9H15C15,7.92 13.63,7 12,7C10.37,7 9,7.92 9,9C9,10.1 10.04,10.5 12.24,11.03C14.36,11.56 17,12.22 17,15C17,16.79 15.53,18.31 13.5,18.82V21H10.5V18.82C8.47,18.31 7,16.79 7,15Z"/>
                </svg>
                <span class="font-semibold text-sm">Cobro #${charge.cabnumero}</span>
            </div>
        </div>
        <div class="p-3 space-y-2">
            <div class="flex items-center space-x-2 text-sm">
                <svg class="w-3 h-3 text-gray-400" viewBox="0 0 20 20">
                    <path fill="currentColor" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                </svg>
                <span class="font-medium text-gray-800">${charge.cabclave1}</span>
            </div>
            <div class="flex items-center space-x-2 text-xs text-gray-600">
                <svg class="w-2.5 h-2.5 text-gray-400" viewBox="0 0 20 20">
                    <path fill="currentColor" d="M6 2a1 1 0 000 2h8a1 1 0 100-2H6zM3 6a2 2 0 012-2h10a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V6z"/>
                </svg>
                <span>Recibo: ${charge.cabnrecibo}</span>
            </div>
            <div class="flex items-center space-x-2 text-xs text-gray-600">
                <svg class="w-2.5 h-2.5 text-gray-400" viewBox="0 0 20 20">
                    <path fill="currentColor" d="M10 2a8 8 0 100 16 8 8 0 000-16zm1 11H9v-2h2v2zm0-4H9V5h2v4z"/>
                </svg>
                <span>${formattedDate}</span>
            </div>
            <div class="flex items-center space-x-2 text-xs text-gray-600">
                <svg class="w-2.5 h-2.5 text-gray-400" viewBox="0 0 20 20">
                    <path fill="currentColor" d="M4 4a2 2 0 00-2 2v8a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2H4z"/>
                </svg>
                <span>Vendedor: ${charge.cabnvendedor}</span>
            </div>
            <div class="flex items-center space-x-2 text-xs text-gray-600">
                <svg class="w-2.5 h-2.5 text-gray-400" viewBox="0 0 20 20">
                    <path fill="currentColor" d="M10 2L3 7v11h4v-6h6v6h4V7l-7-5z"/>
                </svg>
                <span>Sucursal: ${charge.cabsucu}</span>
            </div>
        </div>
    </div>
    `;
    }

    /**
     * Crea popup para pedido
     */
    private createOrderPopupContent(order: OrderDto): string {
        const date = new Date(order.pdtfechaf);
        const formattedDate = date.toLocaleDateString('es-ES');
        const formattedTime = date.toLocaleTimeString('es-ES', {
            hour: '2-digit',
            minute: '2-digit'
        });

        return `
        <div class="bg-white rounded-lg shadow-sm border-0 overflow-hidden">
            <div class="bg-purple-600 px-3 py-2">
                <div class="flex items-center space-x-2 text-white">
                    <svg class="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M19,7H18V6A2,2 0 0,0 16,4H8A2,2 0 0,0 6,6V7H5A1,1 0 0,0 4,8V19A3,3 0 0,0 7,22H17A3,3 0 0,0 20,19V8A1,1 0 0,0 19,7Z"/>
                    </svg>
                    <span class="font-semibold text-sm">Pedido #${order.pdtfactura}</span>
                </div>
            </div>
            <div class="p-3 space-y-2">
                <div class="flex items-center space-x-2 text-sm">
                    <svg class="w-3 h-3 text-gray-400" viewBox="0 0 20 20">
                        <path fill="currentColor" d="M4 4a2 2 0 00-2 2v8a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2H4z"/>
                    </svg>
                    <span class="font-medium text-gray-800">${order.pdtnombre}</span>
                </div>
                <div class="flex items-center space-x-2 text-xs text-gray-600">
                    <svg class="w-2.5 h-2.5 text-gray-400" viewBox="0 0 20 20">
                        <path fill="currentColor" d="M6 2a1 1 0 000 2h8a1 1 0 100-2H6zM3 6a2 2 0 012-2h10a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V6z"/>
                    </svg>
                    <span>Cliente: ${order.pdtclave} - ${order.pdtclave1}</span>
                </div>
                <div class="flex items-center space-x-2 text-xs text-gray-600">
                    <svg class="w-2.5 h-2.5 text-gray-400" viewBox="0 0 20 20" fill="currentColor">
                        <path d="M17.707 9.293l-5-5A.997.997 0 0012 4H5a3 3 0 00-3 3v6a3 3 0 003 3h7c.265 0 .52-.105.707-.293l5-5a.999.999 0 000-1.414zM6 9a1 1 0 110-2 1 1 0 010 2z"/>
                    </svg>
                    <span>Tipo: ${order.pdttd}</span>
                </div>
                <div class="flex items-center space-x-2 text-xs text-gray-600">
                    <svg class="w-2.5 h-2.5 text-gray-400" viewBox="0 0 20 20">
                        <path fill="currentColor" d="M10 2a8 8 0 100 16 8 8 0 000-16zm1 11H9v-2h2v2zm0-4H9V5h2v4z"/>
                    </svg>
                    <span>${formattedDate} - ${formattedTime}</span>
                </div>
            </div>
        </div>
        `;
    }

    // ============= MÉTODOS PARA CREAR CLUSTERS Y LIMPIAR =============
    /**
     * Inicializa cluster para marcadores de tracking
     */
    private initializeTrackingCluster(): void {
        if (!this.map) return;

        this.trackingClusterGroup = new L.MarkerClusterGroup({
            disableClusteringAtZoom: 0,
            iconCreateFunction: (cluster) => {
                const count = cluster.getChildCount();
                return L.divIcon({
                    html: `<div class="bg-blue-600 text-white rounded-full w-10 h-10 flex items-center justify-center font-semibold text-sm shadow-lg border-2 border-white">${count}</div>`,
                    className: 'custom-tracking-cluster',
                    iconSize: [40, 40]
                });
            },
            spiderfyOnMaxZoom: true,
            showCoverageOnHover: false,
            zoomToBoundsOnClick: true
        });

        this.map.addLayer(this.trackingClusterGroup);
    }

    /**
     * Inicializa cluster para marcadores de cobros
     */
    private initializeChargeCluster(): void {
        if (!this.map) return;

        this.chargeClusterGroup = new L.MarkerClusterGroup({
            iconCreateFunction: (cluster) => {
                const count = cluster.getChildCount();
                return L.divIcon({
                    html: `<div class="bg-green-600 text-white rounded-full w-10 h-10 flex items-center justify-center font-semibold text-sm shadow-lg border-2 border-white">${count}</div>`,
                    className: 'custom-charge-cluster',
                    iconSize: [40, 40]
                });
            },
            spiderfyOnMaxZoom: true,
            showCoverageOnHover: false,
            zoomToBoundsOnClick: true
        });

        this.map.addLayer(this.chargeClusterGroup);
    }

    /**
     * Inicializa cluster para marcadores de pedidos
     */
    private initializeOrderCluster(): void {
        if (!this.map) return;

        this.orderClusterGroup = new L.MarkerClusterGroup({
            iconCreateFunction: (cluster) => {
                const count = cluster.getChildCount();
                return L.divIcon({
                    html: `<div class="bg-orange-600 text-white rounded-full w-10 h-10 flex items-center justify-center font-semibold text-sm shadow-lg border-2 border-white">${count}</div>`,
                    className: 'custom-order-cluster',
                    iconSize: [40, 40]
                });
            },
            spiderfyOnMaxZoom: true,
            showCoverageOnHover: false,
            zoomToBoundsOnClick: true
        });

        this.map.addLayer(this.orderClusterGroup);
    }

    /**
     * Crea línea de recorrido del vendedor
     */
    private createTrackingPath(userLocations: UserLocationDto[]): void {
        if (!this.map || userLocations.length === 0) return;

        const userLocation = userLocations[0]; // Solo un usuario
        if (userLocation.ubicaciones.length < 2) return;

        // Ordenar ubicaciones por tiempo
        const sortedLocations = userLocation.ubicaciones.sort((a, b) => new Date(a.tiempo).getTime() - new Date(b.tiempo).getTime());

        // Crear coordenadas para la línea
        const pathCoordinates: [number, number][] = sortedLocations.map((location) => [location.latitud, location.longitud]);

        // Crear polyline
        this.trackingPath = L.polyline(pathCoordinates, {
            color: '#3B82F6',
            weight: 3,
            opacity: 0.7,
            smoothFactor: 1
        });

        this.trackingPath.addTo(this.map);
    }

    /**
     * Limpia marcadores de tracking
     */
    clearTrackingMarkers(): void {
        if (this.trackingClusterGroup && this.map) {
            this.trackingClusterGroup.clearLayers();
            this.map.removeLayer(this.trackingClusterGroup);
            this.trackingClusterGroup = null;
        }

        if (this.trackingPath && this.map) {
            this.map.removeLayer(this.trackingPath);
            this.trackingPath = null;
        }

        this.trackingMarkers.clear();
    }

    /**
     * Limpia marcadores de cobros
     */
    clearChargeMarkers(): void {
        if (this.chargeClusterGroup && this.map) {
            this.chargeClusterGroup.clearLayers();
            this.map.removeLayer(this.chargeClusterGroup);
            this.chargeClusterGroup = null;
        }

        this.chargeMarkers.clear();
    }

    /**
     * Limpia marcadores de pedidos
     */
    clearOrderMarkers(): void {
        if (this.orderClusterGroup && this.map) {
            this.orderClusterGroup.clearLayers();
            this.map.removeLayer(this.orderClusterGroup);
            this.orderClusterGroup = null;
        }

        this.orderMarkers.clear();
    }

    /**
     * Limpia todos los marcadores de tracking (método público)
     */
    clearAllTrackingData(): void {
        this.clearTrackingMarkers();
        this.clearChargeMarkers();
        this.clearOrderMarkers();
    }

    updateUserMarkersLocation(users: UserDto[]): void {
        if (!this.map || !this.markerClusterGroup) return;

        users.forEach(user => {
            if (user.ubicacion?.geublat && user.ubicacion?.geublon) {
                const existingMarker = this.userMarkers.get(user.usucod);

                if (existingMarker) {
                    // Actualizar posición del marcador existente
                    const newLatLng = L.latLng(user.ubicacion.geublat, user.ubicacion.geublon);
                    existingMarker.setLatLng(newLatLng);

                    // Actualizar popup si es necesario
                    const popupContent = this.createUserPopupContent(user);
                    existingMarker.setPopupContent(popupContent);
                } else {
                    // Crear nuevo marcador si no existe
                    const marker = this.createUserMarker(user);
                    this.userMarkers.set(user.usucod, marker);
                    this.markerClusterGroup?.addLayer(marker);
                }
            }
        });
    }

    /**
     * Destruye el mapa y limpia recursos
     */
    destroyMap(): void {
        this.clearSearchMarker();
        this.clearAllTrackingData();
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
