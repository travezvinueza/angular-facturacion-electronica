import { AfterViewInit, Component, ElementRef, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { IconFieldModule } from 'primeng/iconfield';
import { InputIconModule } from 'primeng/inputicon';
import { InputTextModule } from 'primeng/inputtext';
import { CommonModule } from '@angular/common';
import { PaginatorModule } from 'primeng/paginator';
import { ConfirmationService, MessageService } from 'primeng/api';
import { SkeletonModule } from 'primeng/skeleton';
import { TagModule } from 'primeng/tag';
import { ToolbarModule } from 'primeng/toolbar';
import { Tooltip } from 'primeng/tooltip';
import { TableModule } from 'primeng/table';
import { RippleModule } from 'primeng/ripple';
import { TextareaModule } from 'primeng/textarea';
import { InputNumberModule } from 'primeng/inputnumber';
import { DialogModule } from 'primeng/dialog';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import * as L from 'leaflet';
import 'leaflet.markercluster';
import { UserService } from '@/core/services/user.service';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { VendedorDto, VendedoresResponse, PaginacionDto } from '@/core/models/Geocercas/VendedorDto';
import { catchError, finalize, of, retry, Subject, timeout, timer } from 'rxjs';
import { GeocercaService } from '@/core/services/geocerca.service';
import { AuthService } from '@/core/services/auth.service';
import { NominatimReverseResponse } from '@/core/models/nominatim-response.interface';
import { AsignarGeocercaDto } from '@/core/models/AsignarGeocercaDto';
import { UserDto } from '@/core/models/UserDto';

interface NominatimResult {
    lat: string;
    lon: string;
    display_name: string;
    place_id: number;
}

@Component({
    selector: 'app-vendedores',
    standalone: true,
    imports: [
        CommonModule,
        TableModule,
        FormsModule,
        InputTextModule,
        ButtonModule,
        RippleModule,
        ToolbarModule,
        TextareaModule,
        InputNumberModule,
        DialogModule,
        TagModule,
        InputIconModule,
        IconFieldModule,
        ReactiveFormsModule,
        ConfirmDialogModule,
        CardModule,
        PaginatorModule,
        SkeletonModule,
        Tooltip
    ],
    templateUrl: './vendedores.component.html',
    styleUrl: './vendedores.component.css'
})
export class VendedoresComponent implements OnInit, AfterViewInit, OnDestroy {
    @ViewChild('mapContainer', { static: true }) mapContainer!: ElementRef;


    // Para scroll infinito
    loadingMore: boolean = false;
    hasReachedEnd: boolean = false;
    allUsers: UserDto[] = []; // Mantener usuarios originales
    private scrollThreshold: number = 100;
    private debounceTimer: any;

    userLocations: Map<string, string> = new Map();
    loadingLocations: Set<string> = new Set();
    private geocodingQueue: Array<{userId: string, lat: number, lon: number}> = [];
    private isProcessingQueue: boolean = false;
    private lastRequestTime: number = 0;
    private readonly MIN_REQUEST_INTERVAL = 1500; // 1.5 segundos entre peticiones
    private readonly MAX_RETRIES = 3;
    private failedRequests: Map<string, number> = new Map();

    // Propiedades para el diálogo de geocercas disponibles
    availableGeocercas: any[] = [];
    filteredAvailableGeocercas: any[] = [];
    selectedAvailableGeocerca: any = null;
    availableGeocercasLoading: boolean = false;
    searchAvailableGeocerca: string = '';

// Mapa del diálogo
    dialogMap: L.Map | null = null;
    dialogPreviewPolygon: L.Polygon | L.Circle | null = null;// Filtro de geocercas
    filtroGeocerca: string = '';
    geocercasFiltradas: any[] = [];

    // Propiedades de usuarios/vendedores
    users: VendedorDto[] = [];
    filteredUsers: VendedorDto[] = [];
    paginatedUsers: VendedorDto[] = [];
    selectedUser: VendedorDto | null = null;
    loading: boolean = true;

    // Propiedades de paginación del servidor
    serverPagination: PaginacionDto | null = null;
    currentPage: number = 1;
    serverPageSize: number = 100;

    // Propiedades de paginación local
    first: number = 0;
    itemsPerPage: number = 4;

    // Búsqueda
    searchValue: string = '';
    private destroy$ = new Subject<void>();


    // Mapa
    map: L.Map | null = null;
    userMarkers: Map<string, L.Marker> = new Map();
    geocercaLayers: Map<string, L.Polygon> = new Map();
    markerClusterGroup: L.MarkerClusterGroup | null = null;

    // Buscador de ubicaciones
    searchLocation: string = '';
    searchingLocation: boolean = false;
    searchResults: NominatimResult[] = [];
    searchMarker: L.Marker | null = null;

    // Propiedades para la edición de geocercas
    editMode: boolean = false;
    editingGeocerca: any = null;
    editingPolygon: L.Polygon | null = null;
    editingMarkers: L.Marker[] = [];
    isEditingVertices: boolean = false;
    geocercaDialog: boolean = false;
    enterpriseName: string = '';


    constructor(
        private readonly userService: UserService,
        private readonly geocercaService: GeocercaService,
        private readonly authService: AuthService,
        private readonly msgService: MessageService,
        private readonly http: HttpClient,
        private readonly confirmationService: ConfirmationService
    ) {}

    //====================== MÉTODOS DE INICIALIZACIÓN =======================

    ngOnInit(): void {
        this.getAllUsers();
        this.initializeEnterpriseName();
    }

    ngAfterViewInit(): void {
        requestAnimationFrame(() => {
            this.initializeMap();
        });
    }

    /**
     * Inicializa el nombre de la empresa desde el auth service
     */
     initializeEnterpriseName(): any {
        const empresa = this.authService.getEmpresa();
        if (empresa && empresa.nomempresa) {
            this.enterpriseName = empresa.nomempresa;
        } else {
            this.msgService.add({
                severity: 'error',
                summary: 'Error',
                detail: 'No se pudo obtener la información de la empresa'
            });
        }
    }

    initializeMap(): void {
        try {
            const container = this.mapContainer.nativeElement;
            if (!container) {
                console.error('Contenedor del mapa no encontrado');
                return;
            }

            delete (L.Icon.Default.prototype as any)._getIconUrl;
            L.Icon.Default.mergeOptions({
                iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
                iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
                shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png'
            });

            this.map = L.map(container, {
                center: [-0.2298, -78.5249],
                zoom: 13,
                zoomControl: false
            });

            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                maxZoom: 19,
                attribution: '© OpenStreetMap contributors'
            }).addTo(this.map);

            const marker = L.marker([-0.2298, -78.5249]).addTo(this.map);
            marker.bindPopup('<b>Quito, Ecuador</b><br>Ubicación principal').openPopup();

            if (!this.markerClusterGroup) {
                this.markerClusterGroup = L.markerClusterGroup({
                    showCoverageOnHover: false,
                    maxClusterRadius: 50,
                    spiderfyOnMaxZoom: true
                });
                this.map.addLayer(this.markerClusterGroup);
            }

            if (!this.loading && this.users.length > 0) {
                this.addUserMarkersToMap();
            }

            // Invalidar el tamaño después de un delay
            setTimeout(() => {
                this.map?.invalidateSize();
            }, 100);


            console.log('Mapa inicializado correctamente');
        } catch (error) {
            console.error('Error inicializando el mapa:', error);
            this.showMapFallback();
        }
    }



    // ===================================== MÉTODO PARA OBTENER TODOS LOS USUARIOS ================================

    getAllUsers(): void {
        this.loading = true;
        this.userService
            .getVendedoresConGeocercas({
                pageNumber: this.currentPage,
                pageSize: this.serverPageSize,
                activo: true
            })
            .subscribe({
                next: (response: VendedoresResponse) => {
                    this.users = response.data;
                    this.serverPagination = response.paginacion;
                    this.filteredUsers = [...this.users];
                    this.updateLocalPagination();
                    this.loading = false;

                    if (this.map && this.markerClusterGroup) {
                        this.addUserMarkersToMap();
                    }
                },
                error: (error: HttpErrorResponse) => {
                    console.error('Error al cargar usuarios:', error);
                    this.loading = false;
                    this.msgService.add({
                        severity: 'error',
                        summary: 'Error',
                        detail: 'No se pudieron cargar los usuarios'
                    });
                }
            });
    }
    /**
     * Carga las direcciones de todos los usuarios que tienen ubicación
     */
    private loadUserLocations(): void {
        // Limpiar estados previos
        this.geocodingQueue = [];
        this.isProcessingQueue = false;

        // Filtrar usuarios con ubicación válida
        const usersWithLocation = this.users.filter(user =>
            user.ubicacionActual?.geublat &&
            user.ubicacionActual?.geublon &&
            !isNaN(parseFloat(String(user.ubicacionActual.geublat))) &&
            !isNaN(parseFloat(String(user.ubicacionActual.geublon)))
        );

        console.log(`Iniciando geocoding para ${usersWithLocation.length} usuarios`);

        // Agregar todos a la cola con un pequeño delay aleatorio inicial
        usersWithLocation.forEach((user, index) => {
            setTimeout(() => {
                this.addToGeocodingQueue(
                    parseFloat(String(user.ubicacionActual!.geublat)),
                    parseFloat(String(user.ubicacionActual!.geublon)),
                    user.codigoVendedor
                );
            }, index * 100); // 100ms entre adiciones a la cola
        });
    }

    /**
     * Obtiene el nombre de la ubicación para mostrar en el UI
     */
    getUserLocationName(user: VendedorDto): string {
        const locationName = this.userLocations.get(user.codigoVendedor);
        const isLoading = this.loadingLocations.has(user.codigoVendedor);

        if (isLoading) {
            return 'Obteniendo ubicación...';
        }

        if (locationName) {
            return locationName;
        }

        // Si no se ha iniciado el proceso, iniciarlo
        if (user.ubicacionActual?.geublat && user.ubicacionActual?.geublon) {
            // Agregar a la cola si no existe
            setTimeout(() => {
                this.addToGeocodingQueue(
                    parseFloat(String(user.ubicacionActual!.geublat)),
                    parseFloat(String(user.ubicacionActual!.geublon)),
                    user.codigoVendedor
                );
            }, 100);

            return 'Cargando ubicación...';
        }

        return 'Sin ubicación disponible';
    }

    // ======================================================= MÉTODO PARA FILTRAR USUARIOS =======================================
    onSearch(event: Event): void {
        const value = (event.target as HTMLInputElement).value.toLowerCase();
        this.searchValue = value;
        this.filteredUsers = this.users.filter((user) => user.nombreVendedor.toLowerCase().includes(value) || user.codigoVendedor.toLowerCase().includes(value) || user.emailVendedor.toLowerCase().includes(value));
        this.first = 0;
        this.updateLocalPagination();
    }

    onPageChange(event: any): void {
        this.first = event.first;
        this.itemsPerPage = event.rows;
        this.updateLocalPagination();
    }

    updateLocalPagination(): void {
        const start = this.first;
        const end = start + this.itemsPerPage;
        this.paginatedUsers = this.filteredUsers.slice(start, end);
    }

    selectUser(user: VendedorDto): void {
        this.selectedUser = user;
        this.geocercasFiltradas = user.geocercas || [];
        this.filtroGeocerca = ''; // Limpiar filtro


        if (this.map) {
            this.showSelectedUserGeocercas(user);
            this.hideAllUserMarkersExcept(user.codigoVendedor);

            if (user.totalGeocercas > 0) {
                this.fitMapToUserGeocercas(user);
            } else if (user.ubicacionActual) {
                this.map.setView([user.ubicacionActual.geublat, user.ubicacionActual.geublon], 15);
            }

            const marker = this.userMarkers.get(user.codigoVendedor);
            if (marker) {
                marker.openPopup();
            }
        }
    }


    private hideAllUserMarkersExcept(selectedUserCode: string): void {
        this.userMarkers.forEach((marker, userCode) => {
            if (userCode !== selectedUserCode) {
                // Si usas cluster group
                if (this.markerClusterGroup) {
                    this.markerClusterGroup.removeLayer(marker);
                } else {
                    // Si los markers están directamente en el mapa
                    this.map?.removeLayer(marker);
                }
            }
        });
    }

    restoreAllUserMarkers(): void {
        this.userMarkers.forEach((marker) => {
            if (this.markerClusterGroup) {
                this.markerClusterGroup.addLayer(marker);
            } else {
                marker.addTo(this.map!);
            }
        });
    }
    //==========================================================================//

    // ======================== MÉTODOS PARA GESTIÓN DEL MAPA  =====================

    addUserMarkersToMap(): void {
        if (!this.map || !this.markerClusterGroup) return;

        this.markerClusterGroup.clearLayers();
        this.userMarkers.clear();

        this.users.forEach((user) => {
            if (user.ubicacionActual?.geublat && user.ubicacionActual?.geublon) {
                const customIcon = L.divIcon({
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

                const marker = L.marker([user.ubicacionActual.geublat, user.ubicacionActual.geublon], {
                    icon: customIcon
                });

                const popupContent = this.createUserPopupContent(user);
                marker.bindPopup(popupContent, {
                    maxWidth: 240,
                    className: 'custom-popup'
                });

                this.userMarkers.set(user.codigoVendedor, marker);
                this.markerClusterGroup?.addLayer(marker);
            }
        });
    }

    private createUserPopupContent(user: any): string {
        const lastUpdate = new Date(user.ubicacionActual.geubfech).toLocaleString('es-EC', {
            day: '2-digit',
            month: '2-digit',
            year: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        });

        return `
        <div class="bg-white rounded-lg shadow-sm border-0 overflow-hidden">
            <!-- Content -->
            <div class="p-2 space-y-1.5">
                <!-- Códigos -->
                <div class="flex items-center space-x-1.5 text-xs">
                    <svg class="w-2.5 h-2.5 text-gray-400" viewBox="0 0 20 20">
                      <path
                        fill="currentColor"
                        fill-rule="evenodd"
                        clip-rule="evenodd"
                        d="M4 4a2 2 0 00-2 2v8a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2H4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1z"
                      />
                    </svg>

                    <span class="text-gray-700 font-medium">${user.codigoVendedor}</span>
                    <span class="text-gray-400">•</span>
                    <span class="text-gray-500">${user.codigoVendedorSecundario}</span>
                </div>

                <!-- Última ubicación -->
                <div class="flex items-center space-x-1.5 text-xs">
                    <svg class="w-2.5 h-2.5 text-gray-400" viewBox="0 0 20 20">
                      <path
                        fill="currentColor"
                        fill-rule="evenodd"
                        clip-rule="evenodd"
                        d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z"
                      />
                    </svg>

                    <span class="text-gray-500">Última ubicación: ${lastUpdate}</span>
                </div>

                <!-- Geocercas -->
                <div class="flex items-center justify-between">
                    <div class="flex items-center space-x-1.5">
                        <svg class="w-2.5 h-2.5 text-blue-500" viewBox="0 0 20 20">
                          <path
                            fill="currentColor"
                            fill-rule="evenodd"
                            clip-rule="evenodd"
                            d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z"
                          />
                        </svg>

                        <span class="text-xs text-gray-600">Geocercas</span>
                    </div>
                    <span class="bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full text-xs font-medium">
                        ${user.totalGeocercas}
                    </span>
                </div>
            </div>
        </div>
    `;
    }

    showMapFallback(): void {
        const mapElement = this.mapContainer.nativeElement;
        mapElement.innerHTML = `
      <div class="flex items-center justify-center h-full bg-surface-100 dark:bg-surface-800 rounded-lg">
        <div class="text-center">
          <i class="pi pi-exclamation-triangle text-4xl text-orange-500 mb-4"></i>
          <p class="text-surface-600 dark:text-surface-400 mb-2">Error al cargar el mapa</p>
          <p class="text-sm text-surface-500">Verifique que Leaflet esté instalado correctamente</p>
        </div>
      </div>
    `;
        this.map = null;
    }

    searchLocationOnMap(): void {
        if (!this.searchLocation.trim()) {
            this.msgService.add({
                severity: 'warn',
                summary: 'Advertencia',
                detail: 'Ingrese una ubicación para buscar'
            });
            return;
        }

        this.searchingLocation = true;
        this.searchResults = [];

        const query = encodeURIComponent(this.searchLocation.trim());
        const url = `https://nominatim.openstreetmap.org/search?format=json&q=${query}&limit=5&countrycodes=ec&addressdetails=1`;

        this.http.get<NominatimResult[]>(url).subscribe({
            next: (results) => {
                this.searchingLocation = false;
                if (results && results.length > 0) {
                    this.searchResults = results;
                    if (results.length === 1) {
                        this.selectSearchResult(results[0]);
                    }
                } else {
                    this.msgService.add({
                        severity: 'info',
                        summary: 'Sin resultados',
                        detail: 'No se encontraron ubicaciones para la búsqueda'
                    });
                }
            },
            error: (error) => {
                this.searchingLocation = false;
                console.error('Error en búsqueda de ubicación:', error);
                this.msgService.add({
                    severity: 'error',
                    summary: 'Error',
                    detail: 'Error al buscar la ubicación'
                });
            }
        });
    }

    selectSearchResult(result: NominatimResult): void {
        if (!this.map) return;

        const lat = parseFloat(result.lat);
        const lon = parseFloat(result.lon);
        this.map.setView([lat, lon], 15);

        if (this.searchMarker) {
            this.map.removeLayer(this.searchMarker);
        }

        this.searchMarker = L.marker([lat, lon]).addTo(this.map).bindPopup(`<b>${result.display_name}</b><br><small>Resultado de búsqueda</small>`).openPopup();
        this.searchResults = [];

        this.msgService.add({
            severity: 'success',
            summary: 'Ubicación encontrada',
            detail: 'Ubicación marcada en el mapa'
        });
    }

    clearLocationSearch(): void {
        this.searchLocation = '';
        this.searchResults = [];

        if (this.searchMarker && this.map) {
            this.map.removeLayer(this.searchMarker);
            this.searchMarker = null;
        }
    }

    resetMapView(): void {
        if (!this.map) return;

        this.selectedUser = null;
        this.clearAllGeocercas();
        this.restoreAllUserMarkers();
        this.map.setView([-0.2298, -78.5249], 13);
        this.clearLocationSearch();

        this.msgService.add({
            severity: 'info',
            summary: 'Vista restablecida',
            detail: 'El mapa volvió a la vista inicial y se limpió la selección'
        });
    }

    //==========================================================================//

    /**
     * Muestra solo las geocercas del vendedor seleccionado
     * Las geocercas se resaltan con mayor opacidad y grosor
     */
    /**
     * Muestra solo las geocercas del vendedor seleccionado
     */
    showSelectedUserGeocercas(user: VendedorDto): void {
        if (!this.map) return;

        this.clearAllGeocercas();

        user.geocercas.forEach((geocerca) => {
            try {
                const coordinates = JSON.parse(geocerca.geoccoor);
                if (coordinates && coordinates.length > 0) {
                    const latlngs: [number, number][] = coordinates.map((coord: any) => [coord.lat, coord.lng]);

                    const polygon = L.polygon(latlngs, {
                        color: this.getGeocercaColor(geocerca.geocpri),
                        fillColor: this.getGeocercaColor(geocerca.geocpri),
                        fillOpacity: 0.3,
                        weight: 3,
                        opacity: 0.8
                    }).addTo(this.map!);

                    const popupContent = this.createGeocercaPopupContent(geocerca, user);
                    polygon.bindPopup(popupContent, {
                        maxWidth: 260,
                        className: 'custom-geocerca-popup'
                    });

                    const key = `${user.codigoVendedor}-${geocerca.geoccod}`;
                    this.geocercaLayers.set(key, polygon);

                    // Efectos hover
                    polygon.on('mouseover', () => {
                        polygon.setStyle({
                            fillOpacity: 0.5,
                            weight: 4
                        });
                    });

                    polygon.on('mouseout', () => {
                        polygon.setStyle({
                            fillOpacity: 0.3,
                            weight: 3
                        });
                    });
                }
            } catch (error) {
                console.error('Error parsing geocerca coordinates:', error);
            }
        });

        if (user.totalGeocercas > 0) {
            this.msgService.add({
                severity: 'info',
                summary: 'Geocercas mostradas',
                detail: `Se muestran ${user.totalGeocercas} geocerca${user.totalGeocercas > 1 ? 's' : ''} de ${user.nombreVendedor}`,
                life: 3000
            });
        }
    }

    private createGeocercaPopupContent(geocerca: any, user: VendedorDto): string {
        const assignedDate = new Date(geocerca.fechaAsignacion).toLocaleDateString('es-EC', {
            day: '2-digit',
            month: '2-digit',
            year: '2-digit'
        });

        const getStatusColor = (estado: string) => {
            switch (estado?.toUpperCase()) {
                case 'A': case 'ACTIVO': return 'bg-green-100 text-green-700';
                case 'I': case 'INACTIVO': return 'bg-red-100 text-red-700';
                default: return 'bg-gray-100 text-gray-700';
            }
        };

        const formatArea = (areaMeters: number): string => {
            if (areaMeters >= 1000000) {
                return `${(areaMeters / 1000000).toFixed(2)} km²`;
            } else if (areaMeters >= 10000) {
                return `${(areaMeters / 10000).toFixed(2)} hectáreas`;
            } else {
                return `${areaMeters.toLocaleString('es-EC')} m²`;
            }
        };

        const formatPerimeter = (perimeterMeters: number): string => {
            if (perimeterMeters >= 1000) {
                return `${(perimeterMeters / 1000).toFixed(2)} km`;
            } else {
                return `${Math.round(perimeterMeters).toLocaleString('es-EC')} m`;
            }
        };

        const getStatusText = (estado: string) => {
            switch (estado?.toUpperCase()) {
                case 'A': return 'Activo';
                case 'I': return 'Inactivo';
                default: return estado;
            }
        };

        return `
        <div class="bg-white rounded-lg shadow-sm border-0 overflow-hidden">
            <!-- Header -->
            <div class="bg-gradient-to-r from-amber-500 to-orange-500 px-2 py-1">
                <div class="flex items-center space-x-1">
                    <div class="w-5 h-5 bg-white/20 rounded-full flex items-center justify-center">
                        <svg class="w-2.5 h-2.5 text-white" viewBox="0 0 20 20">
                          <path
                            fill="currentColor"
                            fill-rule="evenodd"
                            clip-rule="evenodd"
                            d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z"
                          />
                        </svg>
                    </div>
                    <h5 class="text-white font-medium text-xs truncate uppercase tracking-wide">${geocerca.geocnom}</h5>
                </div>
            </div>

            <!-- Content -->
            <div class="p-2 space-y-1.5">
            <!-- Área y Perímetro - Sección destacada -->
            <div class="bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg p-2 border border-blue-100">
                    <div class="flex items-center justify-between">
                        <!-- Área -->
                        <div class="flex items-center space-x-2">
                            <div class="w-7 h-7 bg-blue-100 rounded-full flex items-center justify-center">
                                <svg class="w-3.5 h-3.5 text-blue-600" viewBox="0 0 24 24">
                                  <path
                                    fill="currentColor"
                                    d="M3 3h6v6H3V3zm8 0h6v6h-6V3zm8 0h2v2h-2V3zm0 4h2v6h-2V7zM3 11h6v6H3v-6zm8 0h6v6h-6v-6zm8 4h2v6h-2v-6zM3 19h6v2H3v-2zm8 0h6v2h-6v-2z"/>
                                </svg>
                            </div>
                            <div class="flex flex-col">
                                <span class="text-xs text-blue-600 font-medium">Área</span>
                                <span class="text-sm text-blue-700 font-bold">${formatArea(geocerca.geocarm)}</span>
                            </div>
                        </div>

                        <!-- Separador -->
                        <div class="w-px h-8 bg-gradient-to-b from-blue-200 to-purple-200"></div>

                        <!-- Perímetro -->
                        <div class="flex items-center space-x-2">
                            <div class="w-7 h-7 bg-purple-100 rounded-full flex items-center justify-center">
                                <svg class="w-3.5 h-3.5 text-purple-600" viewBox="0 0 24 24">
                                  <path
                                    fill="currentColor"
                                    d="M12 2C6.48 2 2 6.48 2 10s4.48 8 10 8 10-3.58 10-8-4.48-8-10-8zm-1 13.93c-3.94-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 11v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V4h2c2.76 0 5.26 1.79 6.9 4.39z" />
                                </svg>
                            </div>
                            <div class="flex flex-col">
                                <span class="text-xs text-purple-600 font-medium">Perímetro</span>
                                <span class="text-sm text-purple-700 font-bold">${formatPerimeter(geocerca.geocperm)}</span>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Código y Sector -->
                <div class="grid grid-cols-2 gap-2 text-xs">
                    <div class="flex items-center space-x-1">
                       <svg class="w-2.5 h-2.5 text-gray-400" viewBox="0 0 20 20">
                          <path
                            fill="currentColor"
                            fill-rule="evenodd"
                            clip-rule="evenodd"
                            d="M4 4a2 2 0 00-2 2v8a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2H4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1z"
                          />
                        </svg>
                        <span class="text-gray-500">Código:</span>
                        <span class="text-gray-700 font-medium">${geocerca.geoccod}</span>
                    </div>
                    <div class="flex items-center space-x-1">
                        <svg class="w-2.5 h-2.5 text-gray-400" viewBox="0 0 20 20">
                          <path
                            fill="currentColor"
                            fill-rule="evenodd"
                            clip-rule="evenodd"
                            d="M3 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4zM3 10a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H4a1 1 0 01-1-1v-6zM14 9a1 1 0 00-1 1v6a1 1 0 001 1h2a1 1 0 001-1v-6a1 1 0 00-1-1h-2z"
                          />
                        </svg>

                        <span class="text-gray-500">Sector:</span>
                        <span class="text-gray-700 font-medium">${geocerca.geocsec}</span>
                    </div>
                </div>

                <!-- Ciudad -->
                <div class="flex items-center space-x-1.5 text-xs">
                    <svg class="w-2.5 h-2.5 text-gray-400" viewBox="0 0 20 20">
                      <path
                        fill="currentColor"
                        fill-rule="evenodd"
                        clip-rule="evenodd"
                        d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z"
                      />
                    </svg>
                    <span class="text-gray-500">Ciudad:</span>
                    <span class="text-gray-700">${geocerca.geocciud}, ${geocerca.geocprov}</span>
                </div>

                <!-- Vendedor -->
                <div class="flex items-center space-x-1.5 text-xs">
                    <svg class="w-2.5 h-2.5 text-gray-400" viewBox="0 0 20 20">
                      <path
                        fill="currentColor"
                        fill-rule="evenodd"
                        clip-rule="evenodd"
                        d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z"
                      />
                    </svg>
                    <span class="text-gray-500">Vendedor:</span>
                    <span class="text-gray-700 font-medium">${user.nombreVendedor}</span>
                </div>

                <!-- Estado y Prioridad -->
                <div class="flex items-center justify-between pt-1">
                    <div class="flex items-center space-x-1.5">
                        <svg class="w-2.5 h-2.5 text-gray-400" viewBox="0 0 20 20">
                          <path
                            fill="currentColor"
                            fill-rule="evenodd"
                            clip-rule="evenodd"
                            d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                          />
                        </svg>
                        <span class="text-xs text-gray-500">Estado:</span>
                        <span class="px-1.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(geocerca.geocest)}">
                            ${getStatusText(geocerca.geocest)}
                        </span>
                    </div>
                    <div class="flex items-center space-x-1">
                        <svg class="w-2.5 h-2.5 text-amber-500" viewBox="0 0 20 20">
                          <path
                            fill="currentColor"
                            d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"
                          />
                        </svg>

                        <span class="text-xs text-amber-600 font-medium">P${geocerca.geocpri}</span>
                    </div>
                </div>

            </div>
        </div>
    `;
    }

    /**
     * Limpia todas las geocercas del mapa
     */
    clearAllGeocercas(): void {
        this.geocercaLayers.forEach((layer) => {
            this.map?.removeLayer(layer);
        });
        this.geocercaLayers.clear();
    }

    /**
     * Ajusta la vista del mapa para mostrar todas las geocercas del vendedor
     */
    fitMapToUserGeocercas(user: VendedorDto): void {
        if (!this.map || user.geocercas.length === 0) return;

        const bounds = L.latLngBounds([]);
        let hasValidCoords = false;

        user.geocercas.forEach((geocerca) => {
            try {
                const coordinates = JSON.parse(geocerca.geoccoor);
                if (coordinates && coordinates.length > 0) {
                    coordinates.forEach((coord: any) => {
                        bounds.extend([coord.lat, coord.lng]);
                        hasValidCoords = true;
                    });
                }
            } catch (error) {
                console.error('Error parsing geocerca coordinates for bounds:', error);
            }
        });

        if (user.ubicacionActual) {
            bounds.extend([user.ubicacionActual.geublat, user.ubicacionActual.geublon]);
            hasValidCoords = true;
        }

        if (hasValidCoords) {
            this.map.fitBounds(bounds, {
                padding: [20, 20],
                maxZoom: 15
            });
        }
    }

    getGeocercaColor(priority: number): string {
        const colors = {
            1: '#EB0505',
            2: '#ff4444',
            3: '#ff4444',
            4: '#ECFF00',
            5: '#DBED09',
            6: '#E2F041',
            7: '#B0F041',
            8: '#AFFC23',
            9: '#4DFF00',
            10: '#22FF00'
        };
        return colors[priority as keyof typeof colors] || '#888888';
    }

    //==========================================================================//

    // ================== MÉTODOS REUTILIZABLES ===========================
    /**
     * Limpia la selección actual de vendedor y sus geocercas
     */
    clearUserSelection(): void {
        this.selectedUser = null;
        this.clearAllGeocercas();

        this.msgService.add({
            severity: 'info',
            summary: 'Selección limpiada',
            detail: 'Se ocultaron las geocercas del vendedor'
        });
    }
    refreshData(): void {
        this.loading = true;
        this.selectedUser = null;
        this.getAllUsers();
        this.resetMapView();
    }

    //==========================================================================//



    /**
     * Ejecuta la desactivación real de la geocerca
     */
    centrarMapaEnGeocerca(geocerca: any): void {
        if (!this.map) {
            this.msgService.add({
                severity: 'warn',
                summary: 'Error',
                detail: 'El mapa no está disponible'
            });
            return;
        }

        try {
            const coordinates = JSON.parse(geocerca.geoccoor);
            if (coordinates && coordinates.length > 0) {
                const latlngs: [number, number][] = coordinates.map((coord: any) => [coord.lat, coord.lng]);
                const polygon = L.polygon(latlngs);
                this.map.fitBounds(polygon.getBounds(), {
                    padding: [30, 30],
                    maxZoom: 16
                });

                this.resaltarGeocercaTemporal(geocerca);

                this.msgService.add({
                    severity: 'success',
                    summary: 'Mapa centrado',
                    detail: `Centrando en: ${geocerca.geocnom}`,
                    life: 2000
                });
            }
        } catch (error) {
            console.error('Error centrando mapa en geocerca:', error);
            this.msgService.add({
                severity: 'error',
                summary: 'Error',
                detail: 'No se pudo centrar el mapa en la geocerca'
            });
        }
    }

    /**
     * Resalta temporalmente una geocerca en el mapa
     */
    private resaltarGeocercaTemporal(geocerca: any): void {
        if (!this.selectedUser) return;

        const key = `${this.selectedUser.codigoVendedor}-${geocerca.geoccod}`;
        const polygon = this.geocercaLayers.get(key);

        if (polygon) {
            const estiloOriginal = {
                color: polygon.options.color,
                weight: polygon.options.weight,
                opacity: polygon.options.opacity,
                fillOpacity: polygon.options.fillOpacity
            };

            polygon.setStyle({
                color: '#FF6B35',
                weight: 5,
                opacity: 1,
                fillOpacity: 0.4
            });

            setTimeout(() => {
                polygon.setStyle(estiloOriginal);
            }, 2000);

            if (polygon.getPopup()) {
                polygon.openPopup();
            }
        }
    }

    /**
     * Limpia los markers de edición
     */
    limpiarMarkersEdicion(): void {
        this.editingMarkers.forEach((marker) => {
            if (this.map) {
                this.map.removeLayer(marker);
            }
        });
        this.editingMarkers = [];
        this.isEditingVertices = false;
    }

    /**
     * Filtra la lista de geocercas según el término de búsqueda
     */
    filtrarGeocercasList(): void {
        if (!this.selectedUser?.geocercas) {
            this.geocercasFiltradas = [];
            return;
        }

        const filtro = this.filtroGeocerca.toLowerCase().trim();

        if (!filtro) {
            this.geocercasFiltradas = [...this.selectedUser.geocercas];
            return;
        }

        this.geocercasFiltradas = this.selectedUser.geocercas.filter(geocerca => {
            return (
                geocerca.geocnom?.toLowerCase().includes(filtro) ||
                geocerca.geoccod?.toLowerCase().includes(filtro) ||
                geocerca.geocsec?.toLowerCase().includes(filtro) ||
                geocerca.geocciud?.toLowerCase().includes(filtro) ||
                geocerca.geocprov?.toLowerCase().includes(filtro)
            );
        });
    }

    ngOnDestroy(): void {
        this.destroy$.next();
        this.destroy$.complete();

        if (this.searchMarker && this.map) {
            this.map.removeLayer(this.searchMarker);
            this.searchMarker = null;
        }

        if (this.map) {
            this.map.remove();
            this.map = null;
        }

        this.limpiarMarkersEdicion();
        this.editMode = false;
        this.editingGeocerca = null;
        this.editingPolygon = null;


        this.geocodingQueue = [];
        this.isProcessingQueue = false;
        this.userLocations.clear();
        this.loadingLocations.clear();
        this.failedRequests.clear();
    }

    protected readonly Math = Math;

 //====================== FUNCIONES ASYNC COMPLETADAS =======================


    /**
     * Obtiene geocercas DISPONIBLES (sin vendedores asignados) para el diálogo
     */
    async getAvailableGeocercas(): Promise<void> {
        if (!this.enterpriseName) {
            return;
        }

        this.availableGeocercasLoading = true;

        try {
            const response = await this.geocercaService.getGeocercasConVendedoresByEnterpriseName(
                this.enterpriseName,
                1, // Primera página
                100, // Tamaño grande para obtener todas
                true, // activo
                false // soloConVendedores = false - geocercas SIN asignar
            ).toPromise();

            if (response && response.success && response.data) {
                this.availableGeocercas = response.data.data;
                this.filteredAvailableGeocercas = [...this.availableGeocercas];

                console.log('Geocercas disponibles:', this.availableGeocercas);
            }
        } catch (error) {
            console.error('Error obteniendo geocercas disponibles:', error);
            this.msgService.add({
                severity: 'error',
                summary: 'Error',
                detail: 'No se pudieron cargar las geocercas disponibles'
            });
        } finally {
            this.availableGeocercasLoading = false;
        }
    }

//====================== FUNCIONES DEL DIÁLOGO =======================

    /**
     * Abre el diálogo para agregar geocerca (botón AGREGAR)
     */
    async openAddGeocercaDialog(): Promise<void> {
        this.geocercaDialog = true;
        this.selectedAvailableGeocerca = null;
        this.searchAvailableGeocerca = '';

        // Cargar geocercas disponibles
        await this.getAvailableGeocercas();

        // Inicializar mapa del diálogo después de que se abra
        setTimeout(() => {
            this.initializeDialogMap();
        }, 100);
    }

    /**
     * Cierra el diálogo
     */
    closeGeocercaDialog(): void {
        this.geocercaDialog = false;
        this.selectedAvailableGeocerca = null;
        this.searchAvailableGeocerca = '';

        // Limpiar mapa del diálogo
        if (this.dialogMap) {
            this.dialogMap.remove();
            this.dialogMap = null;
        }
        this.dialogPreviewPolygon = null;
    }

    /**
     * Filtra las geocercas disponibles
     */
    filterAvailableGeocercas(): void {
        if (!this.searchAvailableGeocerca.trim()) {
            this.filteredAvailableGeocercas = [...this.availableGeocercas];
            return;
        }

        const searchTerm = this.searchAvailableGeocerca.toLowerCase().trim();
        this.filteredAvailableGeocercas = this.availableGeocercas.filter(geocerca =>
            geocerca.geocnom?.toLowerCase().includes(searchTerm) ||
            geocerca.geoccod?.toLowerCase().includes(searchTerm) ||
            geocerca.geocsec?.toLowerCase().includes(searchTerm) ||
            geocerca.geocciud?.toLowerCase().includes(searchTerm)
        );
    }

    /**
     * Selecciona una geocerca para vista previa
     */
    selectAvailableGeocerca(geocerca: any): void {
        this.selectedAvailableGeocerca = geocerca;
        this.showGeocercaPreview(geocerca);
    }

    /**
     * Asigna la geocerca seleccionada al vendedor actual
     */
    async assignGeocercaToUser(): Promise<void> {
        if (!this.selectedAvailableGeocerca || !this.selectedUser) {
            this.msgService.add({
                severity: 'warn',
                summary: 'Advertencia',
                detail: 'Debe seleccionar una geocerca y tener un vendedor seleccionado'
            });
            return;
        }

        // Validar que el vendedor tenga ubicación actual
        if (!this.selectedUser.ubicacionActual?.geublat || !this.selectedUser.ubicacionActual?.geublon) {
            this.msgService.add({
                severity: 'warn',
                summary: 'Advertencia',
                detail: 'El vendedor debe tener una ubicación válida para asignar geocercas'
            });
            return;
        }

        try {
            // Preparar el DTO con los datos del vendedor y ubicación
            const asignarDto: AsignarGeocercaDto = {
                geugidv: this.selectedUser.codigoVendedor,
                geuglat: parseFloat(String(this.selectedUser.ubicacionActual.geublat)),
                geuglon: parseFloat(String(this.selectedUser.ubicacionActual.geublon)),
                geuguscre: this.authService.getUsuarioFromToken() || 'SUPERVISOR',
                geugeqcre: this.initializeEnterpriseName() || 'SUPERVISOR'
            };

            // Llamar al servicio para asignar la geocerca
            await this.geocercaService.assignGeocercaToUser(
                this.selectedAvailableGeocerca.geoccod,
                asignarDto
            ).toPromise();

            this.msgService.add({
                severity: 'success',
                summary: 'Éxito',
                detail: `Geocerca "${this.selectedAvailableGeocerca.geocnom}" asignada correctamente a ${this.selectedUser.nombreVendedor}`
            });

            // Actualizar la información local del vendedor
            if (!this.selectedUser.geocercas) {
                this.selectedUser.geocercas = [];
            }

            // Agregar la geocerca asignada con información adicional
            const geocercaAsignada = {
                ...this.selectedAvailableGeocerca,
                fechaAsignacion: new Date().toISOString(),
                geuglat: asignarDto.geuglat,
                geuglon: asignarDto.geuglon,
                geuguscre: asignarDto.geuguscre,
                geugeqcre: asignarDto.geugeqcre
            };

            this.selectedUser.geocercas.push(geocercaAsignada);
            this.selectedUser.totalGeocercas = this.selectedUser.geocercas.length;

            // Actualizar la lista filtrada de geocercas del vendedor
            this.filtrarGeocercasList();

            // Remover la geocerca de la lista de disponibles
            this.availableGeocercas = this.availableGeocercas.filter(
                g => g.geoccod !== this.selectedAvailableGeocerca!.geoccod
            );
            this.filteredAvailableGeocercas = this.filteredAvailableGeocercas.filter(
                g => g.geoccod !== this.selectedAvailableGeocerca!.geoccod
            );

            // Limpiar selección
            this.selectedAvailableGeocerca = null;

            // Cerrar diálogo
            this.closeGeocercaDialog();

            this.refreshData();

        } catch (error: any) {
            console.error('Error asignando geocerca:', error);

            // Manejo de errores específicos
            let errorMessage = 'No se pudo asignar la geocerca al vendedor';

            if (error?.error?.message) {
                errorMessage = error.error.message;
            } else if (error?.status === 400) {
                errorMessage = 'Datos inválidos para la asignación';
            } else if (error?.status === 404) {
                errorMessage = 'Geocerca o vendedor no encontrado';
            } else if (error?.status === 409) {
                errorMessage = 'La geocerca ya está asignada a otro vendedor';
            }

            this.msgService.add({
                severity: 'error',
                summary: 'Error',
                detail: errorMessage
            });
        }
    }

    //===============NUEVOS MÉTODOS PARA SCROLL INFINITO========================================//

    /**
     * Maneja el evento de scroll para detectar cuando cargar más usuarios
     */
    onScroll(event: Event): void {
        const element = event.target as HTMLElement;
        const { scrollTop, scrollHeight, clientHeight } = element;

        // Calcular si estamos cerca del final
        const isNearBottom = scrollTop + clientHeight >= scrollHeight - this.scrollThreshold;

        // Solo cargar más si cumple todas las condiciones
        if (isNearBottom && !this.loadingMore && !this.hasReachedEnd && this.canLoadMore()) {
            this.loadMoreUsers();
        }
    }

    /**
     * Verifica si se pueden cargar más usuarios
     */
    private canLoadMore(): boolean {
        const totalLoaded = this.paginatedUsers.length;
        const totalAvailable = this.filteredUsers.length;
        return totalLoaded < totalAvailable;
    }

    /**
     * Carga más usuarios con skeleton
     */
    private loadMoreUsers(): void {
        if (this.loadingMore) return;

        this.loadingMore = true;

        // Simular delay de carga para mostrar skeleton
        setTimeout(() => {
            const startIndex = this.currentPage * this.itemsPerPage;
            const endIndex = startIndex + this.itemsPerPage;
            const nextBatch = this.filteredUsers.slice(startIndex, endIndex);

            if (nextBatch.length > 0) {
                // Agregar nuevos usuarios a la lista existente
                this.paginatedUsers = [...this.paginatedUsers, ...nextBatch];
                this.currentPage++;

                // Verificar si hemos llegado al final
                if (this.paginatedUsers.length >= this.filteredUsers.length) {
                    this.hasReachedEnd = true;
                }
            } else {
                this.hasReachedEnd = true;
            }

            this.loadingMore = false;
        }, 600); // Tiempo ajustable según necesidades
    }


    /**
     * Carga los usuarios iniciales
     */
    private loadInitialUsers(): void {

        this.paginatedUsers = this.filteredUsers.slice(0, this.itemsPerPage);
        this.currentPage = 1;

        // Verificar si ya no hay más usuarios
        if (this.paginatedUsers.length >= this.filteredUsers.length) {
            this.hasReachedEnd = true;
        }
    }

    /**
     * Scroll suave al inicio (útil después de filtros)
     */


    formatLocationDate(dateString: string): string {
        if (!dateString) return 'Sin fecha';

        const date = new Date(dateString);
        const now = new Date();
        const diffInMs = now.getTime() - date.getTime();
        const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60));
        const diffInDays = Math.floor(diffInHours / 24);

        if (diffInHours < 1) return 'Hace menos de 1 hora';
        if (diffInHours < 24) return `Hace ${diffInHours} horas`;
        if (diffInDays === 1) return 'Ayer';
        if (diffInDays < 7) return `Hace ${diffInDays} días`;

        return date.toLocaleDateString('es-ES', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        });
    }
    getLocationTimeAgo(dateString: string): string {
        if (!dateString) return '';

        const date = new Date(dateString);
        const now = new Date();
        const diffInMs = now.getTime() - date.getTime();
        const diffInMinutes = Math.floor(diffInMs / (1000 * 60));
        const diffInHours = Math.floor(diffInMinutes / 60);
        const diffInDays = Math.floor(diffInHours / 24);

        if (diffInMinutes < 1) return 'Recién actualizada';
        if (diffInMinutes < 60) return `Hace ${diffInMinutes} minutos`;
        if (diffInHours < 24) return `Hace ${diffInHours} horas`;
        return `Hace ${diffInDays} días`;
    }

    formatLocationDateTime(dateString: string): string {
        if (!dateString) return 'Sin fecha';

        const date = new Date(dateString);
        return date.toLocaleDateString('es-ES', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    copyCoordinates(ubicacion: any): void {
        if (ubicacion?.geublat && ubicacion?.geublon) {
            const coordinates = `${ubicacion.geublat}, ${ubicacion.geublon}`;
            navigator.clipboard.writeText(coordinates).then(() => {
                this.msgService.add({
                    severity: 'success',
                    summary: 'Copia exitosa',
                    detail: 'Las coordenadas se copiaron al portapapeles',
                    life: 1000
                });
            });
        }
    }

//====================== FUNCIONES DEL MAPA DEL DIÁLOGO =======================

    /**
     * Inicializa el mapa del diálogo
     */
    initializeDialogMap(): void {
        try {
            const dialogMapContainer = document.getElementById('dialogMapContainer');
            if (!dialogMapContainer) {
                console.error('Contenedor del mapa del diálogo no encontrado');
                return;
            }

            this.dialogMap = L.map(dialogMapContainer, {
                center: [-0.2298, -78.5249],
                zoom: 13,
                zoomControl: true
            });

            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                maxZoom: 19,
                attribution: '© OpenStreetMap contributors'
            }).addTo(this.dialogMap);

            // Permitir que el mapa se redimensione
            setTimeout(() => {
                this.dialogMap?.invalidateSize();
            }, 100);

        } catch (error) {
            console.error('Error inicializando mapa del diálogo:', error);
        }
    }

    showGeocercaPreview(geocerca: any): void {
        if (!this.dialogMap) {
            return;
        }

        // Limpiar capas anteriores
        if (this.dialogPreviewPolygon) {
            this.dialogMap.removeLayer(this.dialogPreviewPolygon);
            this.dialogPreviewPolygon = null;
        }

        try {



            // Intentar usar las coordenadas completas del polígono primero
            if (geocerca.geoccoor) {
                this.showFullPolygonPreview(geocerca);
                return;
            }

            // Fallback: usar coordenadas del centro si no hay polígono completo
            if (geocerca.geoclat && geocerca.geoclon) {
                this.showCenterPointPreview(geocerca);
                return;
            }

            console.warn('Geocerca sin coordenadas válidas:', geocerca);

        } catch (error) {
            console.error('Error mostrando vista previa de geocerca:', error);
            this.msgService.add({
                severity: 'error',
                summary: 'Error',
                detail: 'No se pudo mostrar la vista previa de la geocerca'
            });
        }
    }

    /**
     * Muestra el polígono completo de la geocerca
     */
    private showFullPolygonPreview(geocerca: any): void {
        try {
            // Parsear las coordenadas del JSON string
            const coordinates = typeof geocerca.geoccoor === 'string'
                ? JSON.parse(geocerca.geoccoor)
                : geocerca.geoccoor;

            if (!Array.isArray(coordinates) || coordinates.length < 3) {
                console.warn('Coordenadas insuficientes para formar polígono, usando punto central');
                this.showCenterPointPreview(geocerca);
                return;
            }

            // Convertir a formato Leaflet [lat, lng] con tipado explícito
            const latLngs: [number, number][] = coordinates.map((coord: any) => {
                const lat = parseFloat(coord.lat);
                const lng = parseFloat(coord.lng);

                if (isNaN(lat) || isNaN(lng)) {
                    throw new Error(`Coordenada inválida: lat=${coord.lat}, lng=${coord.lng}`);
                }

                return [lat, lng] as [number, number]; // Tupla explícita
            });

            // Crear el polígono
            this.dialogPreviewPolygon = L.polygon(latLngs, {
                color: this.getGeocercaColor(geocerca.geocpri) || '#3388ff',
                fillColor: this.getGeocercaColor(geocerca.geocpri) || '#3388ff',
                fillOpacity: 0.25,
                weight: 3,
                opacity: 0.8,
                dashArray: geocerca.geocact ? undefined : '5, 10' // Línea punteada si está inactiva
            }).addTo(this.dialogMap!);

            // Agregar marcador en el centro del polígono
            const bounds = this.dialogPreviewPolygon.getBounds(); // Ahora funciona porque es L.Polygon
            const center = bounds.getCenter();

            const centerMarker = L.marker([center.lat, center.lng], {
                icon: L.divIcon({
                    className: 'geocerca-center-marker',
                    html: `<div style="
                    width: 16px;
                    height: 16px;
                    background-color: ${this.getGeocercaColor(geocerca.geocpri) || '#3388ff'};
                    border: 3px solid white;
                    border-radius: 50%;
                    box-shadow: 0 3px 6px rgba(0,0,0,0.4);
                "></div>`,
                    iconSize: [16, 16],
                    iconAnchor: [8, 8]
                })
            }).addTo(this.dialogMap!);

            // Ajustar vista al polígono
            this.dialogMap!.fitBounds(bounds, {
                padding: [20, 20],
                maxZoom: 16
            });

            // Usar tu método existente para crear el popup
            if (this.selectedUser) {
                const popupContent = this.createGeocercaPopupContent(geocerca, this.selectedUser);
                centerMarker.bindPopup(popupContent, {
                    maxWidth: 300,
                    className: 'custom-popup'
                }).openPopup();
            }

            console.log(`Polígono completo mostrado para geocerca: ${geocerca.geocnom} con ${coordinates.length} vértices`);

        } catch (error) {
            console.error('Error parseando coordenadas del polígono:', error);
            // Fallback al punto central
            this.showCenterPointPreview(geocerca);
        }
    }

    /**
     * Muestra solo el punto central como círculo (fallback)
     */
    private showCenterPointPreview(geocerca: any): void {
        if (!geocerca.geoclat || !geocerca.geoclon) {
            console.warn('Sin coordenadas de centro disponibles');
            return;
        }

        const lat = parseFloat(geocerca.geoclat);
        const lon = parseFloat(geocerca.geoclon);

        if (isNaN(lat) || isNaN(lon)) {
            console.error('Coordenadas de centro inválidas:', { lat: geocerca.geoclat, lon: geocerca.geoclon });
            return;
        }

        // Crear círculo de aproximación
        const radius = 500; // Radio en metros

        this.dialogPreviewPolygon = L.circle([lat, lon], {
            radius: radius,
            color: this.getGeocercaColor(geocerca.geocpri) || '#3388ff',
            fillColor: this.getGeocercaColor(geocerca.geocpri) || '#3388ff',
            fillOpacity: 0.15,
            weight: 2,
            opacity: 0.6,
            dashArray: '10, 5' // Línea punteada para indicar que es aproximado
        }).addTo(this.dialogMap!);

        // Marcador central
        const centerMarker = L.marker([lat, lon], {
            icon: L.divIcon({
                className: 'geocerca-center-marker',
                html: `<div style="
                width: 12px;
                height: 12px;
                background-color: ${this.getGeocercaColor(geocerca.geocpri) || '#3388ff'};
                border: 2px solid white;
                border-radius: 50%;
                box-shadow: 0 2px 4px rgba(0,0,0,0.3);
            "></div>`,
                iconSize: [12, 12],
                iconAnchor: [6, 6]
            })
        }).addTo(this.dialogMap!);

        // Centrar mapa
        this.dialogMap!.setView([lat, lon], 15);

        // Usar tu método existente para el popup
        if (this.selectedUser) {
            const popupContent = this.createGeocercaPopupContent(geocerca, this.selectedUser);
            centerMarker.bindPopup(popupContent, {
                maxWidth: 300,
                className: 'custom-popup'
            }).openPopup();
        }

        console.log(`Vista aproximada mostrada para geocerca: ${geocerca.geocnom} en [${lat}, ${lon}]`);
    }
    /**
     * Obtiene el nombre del lugar usando reverse geocoding con cola y cooldown
     */
    private addToGeocodingQueue(lat: number, lon: number, userId: string): void {
        // Evitar duplicados en la cola
        const exists = this.geocodingQueue.some(item => item.userId === userId);
        if (exists || this.loadingLocations.has(userId) || this.userLocations.has(userId)) {
            return;
        }

        // Agregar a la cola
        this.geocodingQueue.push({ userId, lat, lon });
        this.loadingLocations.add(userId);

        // Procesar la cola si no se está procesando
        if (!this.isProcessingQueue) {
            this.processGeocodingQueue();
        }
    }


    /**
     * Construye un nombre legible de la ubicación
     */
    private buildLocationName(response: NominatimReverseResponse): string {
        const address = response.address;
        const locationParts: string[] = [];

        // Priorizar información más específica
        if (address.road) {
            locationParts.push(address.road);
        }
        if (address.quarter && address.quarter !== address.road) {
            locationParts.push(address.quarter);
        }
        if (address.city_district && address.city_district !== address.quarter) {
            locationParts.push(address.city_district);
        }
        if (address.city) {
            locationParts.push(address.city);
        }

        return locationParts.length > 0
            ? locationParts.slice(0, 3).join(', ') // Máximo 3 partes
            : response.display_name.split(',').slice(0, 2).join(',');
    }

    /**
     * Utility para delays
     */
    private delay(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Procesa la cola de geocoding de forma secuencial con delays
     */
    private async processGeocodingQueue(): Promise<void> {
        if (this.isProcessingQueue || this.geocodingQueue.length === 0) {
            return;
        }

        this.isProcessingQueue = true;

        while (this.geocodingQueue.length > 0) {
            const item = this.geocodingQueue.shift();
            if (!item) continue;

            try {
                // Calcular delay necesario
                const now = Date.now();
                const timeSinceLastRequest = now - this.lastRequestTime;
                const delay = Math.max(0, this.MIN_REQUEST_INTERVAL - timeSinceLastRequest);

                if (delay > 0) {
                    await this.delay(delay);
                }

                // Realizar la petición
                await this.performGeocodingRequest(item.lat, item.lon, item.userId);
                this.lastRequestTime = Date.now();

            } catch (error) {
                console.warn(`Error procesando geocoding para ${item.userId}:`, error);
                this.handleGeocodingError(item);
            }

            // Pequeño delay adicional entre peticiones
            await this.delay(200);
        }

        this.isProcessingQueue = false;
    }

    /**
     * Realiza la petición de geocoding con retry automático
     */
    private performGeocodingRequest(lat: number, lon: number, userId: string): Promise<void> {
        const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&addressdetails=1`;

        return this.http.get<NominatimReverseResponse>(url, {
            headers: {
                'User-Agent': `${this.enterpriseName || 'VendedoresApp'}/1.0`
            }
        }).pipe(
            timeout(10000), // 10 segundos timeout
            retry({
                count: this.MAX_RETRIES,
                delay: (error, retryCount) => {
                    // Delay exponencial: 2s, 4s, 8s
                    const delayMs = Math.pow(2, retryCount) * 1000;
                    console.log(`Reintentando geocoding para ${userId} en ${delayMs}ms (intento ${retryCount})`);
                    return timer(delayMs);
                }
            }),
            catchError(error => {
                console.warn(`Error en geocoding para ${userId} después de ${this.MAX_RETRIES} intentos:`, error);
                return of(null); // Continuar sin error
            }),
            finalize(() => {
                this.loadingLocations.delete(userId);
            })
        ).toPromise().then(response => {
            if (response && response.address) {
                const locationName = this.buildLocationName(response);
                this.userLocations.set(userId, locationName);

                // Limpiar contador de errores si fue exitoso
                this.failedRequests.delete(userId);
            } else {
                // Marcar como fallido pero no mostrar error
                this.userLocations.set(userId, 'Ubicación no disponible');
            }
        });
    }

    /**
     * Maneja errores de geocoding con reintentos inteligentes
     */
    private handleGeocodingError(item: {userId: string, lat: number, lon: number}): void {
        const failures = this.failedRequests.get(item.userId) || 0;

        if (failures < this.MAX_RETRIES) {
            // Reintroducir en la cola con delay exponencial
            const retryDelay = Math.pow(2, failures) * 2000; // 2s, 4s, 8s

            setTimeout(() => {
                this.failedRequests.set(item.userId, failures + 1);
                this.geocodingQueue.push(item);

                if (!this.isProcessingQueue) {
                    this.processGeocodingQueue();
                }
            }, retryDelay);

        } else {
            // Máximo de reintentos alcanzado, marcar como no disponible
            this.loadingLocations.delete(item.userId);
            this.userLocations.set(item.userId, 'Ubicación no disponible');
            this.failedRequests.delete(item.userId);
        }
    }

    confirmarDesvincularGeocerca(geocerca: any): void {
        this.confirmationService.confirm({
            message: `¿Está seguro de que desea desvincular la geocerca "${geocerca.geocnom}" del vendedor "${this.selectedUser?.nombreVendedor}"?`,
            header: 'Confirmar Desvinculación',
            icon: 'pi pi-exclamation-triangle',
            acceptLabel: 'Sí, Desvincular',
            rejectLabel: 'Cancelar',
            acceptButtonStyleClass: 'p-button-warning p-button-sm',
            rejectButtonStyleClass: 'p-button-text p-button-sm',
            accept: () => {
                this.desvincularGeocercaDelVendedor(geocerca);
            },
            reject: () => {
                // Opcional: mensaje de cancelación
                this.msgService.add({
                    severity: 'info',
                    summary: 'Cancelado',
                    detail: 'La desvinculación ha sido cancelada',
                    life: 3000
                });
            }
        });
    }

    /**
     * Realiza la desvinculación de la geocerca
     */
    private desvincularGeocercaDelVendedor(geocerca: any): void {
        this.loading = true;

        this.geocercaService.desvincularGeocerca(geocerca.geoccod).subscribe({
            next: () => {
                this.msgService.add({
                    severity: 'success',
                    summary: 'Desvinculación Exitosa',
                    detail: `La geocerca "${geocerca.geocnom}" ha sido desvinculada correctamente`,
                    life: 5000
                });

                // Recargar las geocercas del vendedor seleccionado
                if (this.selectedUser) {
                    this.refreshData()
                }

                this.loading = false;
            },
            error: (error: HttpErrorResponse) => {
                console.error('Error al desvincular geocerca:', error);

                let errorMessage = 'No se pudo desvincular la geocerca';
                if (error.error?.message) {
                    errorMessage = error.error.message;
                } else if (error.status === 404) {
                    errorMessage = 'La geocerca no fue encontrada';
                } else if (error.status === 403) {
                    errorMessage = 'No tiene permisos para realizar esta acción';
                }

                this.msgService.add({
                    severity: 'error',
                    summary: 'Error de Desvinculación',
                    detail: errorMessage,
                    life: 7000
                });

                this.loading = false;
            }
        });
    }
}
