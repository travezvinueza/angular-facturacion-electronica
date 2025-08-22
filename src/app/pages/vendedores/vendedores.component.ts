import { AfterViewInit, Component, ElementRef, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
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
import { VendedorDto, VendedoresResponse, PaginacionDto } from '@/core/models/VendedorDto';
import { Subject } from 'rxjs';
import { AuthService } from '@/core/services/auth.service';
import { GeocercaService } from '@/core/services/geocerca.service';
import { CoordenadaDto } from '@/core/models/GeocercaDto';
import { ToggleSwitch } from 'primeng/toggleswitch';
import { AutoComplete } from 'primeng/autocomplete';
import { Canton, Parroquia, Provincia } from '@/core/models/ProvinciaDto';
import { ProvinceService } from '@/core/services/province.service';
import { Slider } from 'primeng/slider';
import { Drawer } from 'primeng/drawer';

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
        Tooltip,
        ToggleSwitch,
        AutoComplete,
        Slider,
        Drawer
    ],
    templateUrl: './vendedores.component.html',
    styleUrl: './vendedores.component.css'
})
export class VendedoresComponent implements OnInit, AfterViewInit, OnDestroy {
    @ViewChild('mapContainer', { static: false }) mapContainer!: ElementRef;

    // Propiedades del drawer
    drawerGeocercasVisible: boolean = false;

    // Filtro de geocercas
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
    itemsPerPage: number = 5;

    // Búsqueda
    searchValue: string = '';
    private destroy$ = new Subject<void>();

    userForm!: FormGroup;

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
    originalCoordinates: CoordenadaDto[] = [];
    editingMarkers: L.Marker[] = [];
    isEditingVertices: boolean = false;
    geocercaForm!: FormGroup;
    geocercaDialog: boolean = false;

    // Propiedades para la edición de geocercas
    coordenadasGeocerca: CoordenadaDto[] = [];
    centroGeocerca: CoordenadaDto | null = null;

    // Propiedades para la gestion de provincias
    provinciasFiltradas: Provincia[] = [];
    ciudadesFiltradas: Canton[] = [];
    sectoresFiltrados: Parroquia[] = [];
    cantonesList: Canton[] = [];
    parroquiasList: Parroquia[] = [];
    provinciaSeleccionada: Provincia | null = null;
    ciudadSeleccionada: Canton | null = null;
    sectorSeleccionado: Parroquia | null = null;

    constructor(
        private readonly formBuilder: FormBuilder,
        private readonly userService: UserService,
        private readonly authService: AuthService,
        private readonly msgService: MessageService,
        private readonly geocercaService: GeocercaService,
        private readonly provinceService: ProvinceService,
        private readonly confirmationService: ConfirmationService,
        private readonly http: HttpClient
    ) {}

    //====================== MÉTODOS DE INICIALIZACIÓN =======================

    ngOnInit(): void {
        this.getAllUsers();
        this.initializeForm();
        this.initializeGeocercaForm();
        this.inicializarProvincias();
    }

    ngAfterViewInit(): void {
        requestAnimationFrame(() => {
            this.initializeMap();
        });
    }

    private inicializarProvincias(): void {
        this.provinciasFiltradas = this.provinceService.getProvincias();
    }

    initializeForm(): void {
        this.userForm = this.formBuilder.group({
            codigoVendedor: ['', [Validators.required]],
            nombreVendedor: ['', [Validators.required]],
            emailVendedor: ['', [Validators.required, Validators.email]],
            codigoVendedorSecundario: ['', [Validators.required]]
        });
    }

    initializeGeocercaForm(): void {
        this.geocercaForm = this.formBuilder.group({
            geoccod: ['', [Validators.required, Validators.maxLength(5)]],
            geocnom: ['', [Validators.required]],
            geocsec: ['', [Validators.required]],
            geocdirre: ['', [Validators.required]],
            geocciud: ['', [Validators.required]],
            geocprov: ['', [Validators.required]],
            geocpais: ['ECUADOR', [Validators.required]],
            geocpri: [1, [Validators.required, Validators.min(1), Validators.max(10)]],
            geocact: [true],
            geocdesc: ['', [Validators.required]]
        });
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
                zoom: 13
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

            requestAnimationFrame(() => {
                this.map?.invalidateSize();
            });

            console.log('Mapa inicializado correctamente');
        } catch (error) {
            console.error('Error inicializando el mapa:', error);
            this.showMapFallback();
        }
    }

    //==========================================================================//

    // ==== MÉTODOS PARA FILTRAR PROVINCIAS, CIUDADES Y SECTORES ====

    filtrarProvincias(event: any): void {
        const query = event.query?.toLowerCase() || '';
        this.provinciasFiltradas = this.provinceService.filtrarProvincias(query);
    }

    filtrarCiudades(event: any): void {
        const query = event.query?.toLowerCase() || '';
        this.ciudadesFiltradas = this.provinceService.filtrarCantones(this.cantonesList, query);
    }

    filtrarSectores(event: any): void {
        const query = event.query?.toLowerCase() || '';
        this.sectoresFiltrados = this.provinceService.filtrarParroquias(this.parroquiasList, query);
    }

    onProvinciaSeleccionada(event: any): void {
        const provinciaObj: Provincia = event.value;
        this.provinciaSeleccionada = provinciaObj;
        this.cantonesList = this.provinceService.getCantones(provinciaObj.codigo);
        this.ciudadSeleccionada = null;
        this.parroquiasList = [];
        this.sectorSeleccionado = null;
        this.geocercaForm.patchValue({
            geocciud: '',
            geocsec: ''
        });
    }

    onProvinciaLimpiada() {
        this.provinciaSeleccionada = null;
        this.cantonesList = [];
        this.ciudadSeleccionada = null;
        this.parroquiasList = [];
        this.sectorSeleccionado = null;
    }

    onCiudadSeleccionada(event: any): void {
        const ciudadObj: Canton = event.value;
        this.ciudadSeleccionada = ciudadObj;

        if (this.provinciaSeleccionada) {
            this.parroquiasList = this.provinceService.getParroquias(this.provinciaSeleccionada.codigo, ciudadObj.codigo);
        }

        this.sectorSeleccionado = null;
        this.geocercaForm.patchValue({
            geocsec: ''
        });
    }

    onCiudadLimpiada() {
        this.ciudadSeleccionada = null;
        this.parroquiasList = [];
        this.sectorSeleccionado = null;
    }
    //==========================================================================//

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

    //==========================================================================//

    // ======================================================= MÉTODO PARA FILTRAR USUARIOS =======================================
    onSearch(event: Event): void {
        const value = (event.target as HTMLInputElement).value.toLowerCase();
        this.searchValue = value;
        this.filteredUsers = this.users.filter((user) => user.nombreVendedor.toLowerCase().includes(value) || user.codigoVendedor.toLowerCase().includes(value) || user.emailVendedor.toLowerCase().includes(value));
        this.first = 0;
        this.updateLocalPagination();
    }

    clearUserSearch(): void {
        this.searchValue = '';
        this.filteredUsers = [...this.users];
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

        if (this.map) {
            this.showSelectedUserGeocercas(user);

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
        this.actualizarDrawerSiEstaAbierto();
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
        this.map.setView([-0.2298, -78.5249], 13);
        this.clearLocationSearch();

        this.msgService.add({
            severity: 'info',
            summary: 'Vista restablecida',
            detail: 'El mapa volvió a la vista inicial y se limpió la selección'
        });
    }

    //==========================================================================//

    // ===================== MÉTODOS PARA GEOCERCAS DEL VENDEDOR SELECCIONADO =========================

    /**
     * Muestra solo las geocercas del vendedor seleccionado
     * Las geocercas se resaltan con mayor opacidad y grosor
     */
    showSelectedUserGeocercas(user: VendedorDto): void {
        if (!this.map) return;
        this.clearAllGeocercas();

        user.geocercas.forEach((geocerca) => {
            try {
                const coordinates = JSON.parse(geocerca.geoccoor);
                if (coordinates && coordinates.length > 0) {
                    const latlngs: [number, number][] = coordinates.map((coord: any) => [coord.lat, coord.lng]);

                    const isEditMode = this.editMode;
                    const polygon = L.polygon(latlngs, {
                        color: isEditMode ? '#3B82F6' : this.getGeocercaColor(geocerca.geocpri),
                        fillColor: isEditMode ? '#3B82F6' : this.getGeocercaColor(geocerca.geocpri),
                        fillOpacity: isEditMode ? 0.2 : 0.3,
                        weight: isEditMode ? 3 : 3,
                        opacity: isEditMode ? 0.8 : 0.8
                    }).addTo(this.map!);

                    const popupContent = this.createGeocercaPopupContent(geocerca, user);
                    polygon.bindPopup(popupContent, {
                        maxWidth: 260,
                        className: 'custom-geocerca-popup'
                    });

                    const key = `${user.codigoVendedor}-${geocerca.geoccod}`;
                    this.geocercaLayers.set(key, polygon);

                    if (!isEditMode) {
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
                }
            } catch (error) {
                console.error('Error parsing geocerca coordinates:', error);
            }
        });

        if (!this.editMode && user.totalGeocercas > 0) {
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

                <!-- Fecha de asignación -->
                <div class="flex items-center space-x-1.5 text-xs pt-1 border-t border-gray-100">
                    <svg class="w-2.5 h-2.5 text-gray-400" viewBox="0 0 20 20">
                      <path
                        fill="currentColor"
                        fill-rule="evenodd"
                        clip-rule="evenodd"
                        d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z"
                      />
                    </svg>
                    <span class="text-gray-500">Asignado:</span>
                    <span class="text-gray-700 font-medium">${assignedDate}</span>
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

    //============METODOS PARA ELIMINAR/DESACTIVAR/ACTIVAR GEOCERCAS=============================

    /**
     * Elimina una geocerca con confirmación
     */
    eliminarGeocerca(geocerca?: any): void {
        // Usar la geocerca pasada como parámetro o la que está en edición
        const geocercaAEliminar = geocerca || this.editingGeocerca;

        if (!geocercaAEliminar) {
            this.msgService.add({
                severity: 'warn',
                summary: 'Advertencia',
                detail: 'No hay geocerca seleccionada para eliminar'
            });
            return;
        }

        // ConfirmDialog simple para eliminar
        this.confirmationService.confirm({
            message: `¿Está seguro de que desea eliminar la geocerca "${geocercaAEliminar.geocnom}"?\n\nCódigo: ${geocercaAEliminar.geoccod}\n\nEsta acción no se puede deshacer.`,
            header: 'Delete Geocerca',
            icon: 'pi pi-exclamation-triangle',
            acceptLabel: 'Delete',
            rejectLabel: 'Cancel',
            acceptButtonStyleClass: 'p-button-danger',
            rejectButtonStyleClass: 'p-button-outlined',
            accept: () => {
                this.ejecutarEliminacionGeocerca(geocercaAEliminar);
            },
            reject: () => {
                this.msgService.add({
                    severity: 'info',
                    summary: 'Cancelled',
                    detail: 'Delete operation was cancelled',
                    life: 3000
                });
            }
        });
    }
    private ejecutarEliminacionGeocerca(geocercaAEliminar: any): void {
        this.loading = true;

        this.geocercaService.eliminarGeocerca(geocercaAEliminar.geoccod).subscribe({
            next: () => {
                this.loading = false;
                this.msgService.add({
                    severity: 'success',
                    summary: 'Geocerca eliminada',
                    detail: `La geocerca "${geocercaAEliminar.geocnom}" fue eliminada correctamente`
                });

                if (this.editMode && this.editingGeocerca?.geoccod === geocercaAEliminar.geoccod) {
                    this.cancelarModoEdicion();
                }

                if (this.geocercaDialog) {
                    this.cerrarDialogoGeocerca();
                }

                if (this.drawerGeocercasVisible) {
                    this.actualizarDrawerSiEstaAbierto();
                }
                this.refreshRapidoUsuarioActual();
            },
            error: (error) => {
                this.loading = false;
                console.error('Error eliminando geocerca:', error);

                let mensajeError = 'No se pudo eliminar la geocerca';
                if (error.status === 404) {
                    mensajeError = 'La geocerca no existe o ya fue eliminada';
                } else if (error.status === 403) {
                    mensajeError = 'No tiene permisos para eliminar esta geocerca';
                } else if (error.status === 409) {
                    mensajeError = 'No se puede eliminar la geocerca porque está siendo utilizada';
                }

                this.msgService.add({
                    severity: 'error',
                    summary: 'Error al eliminar',
                    detail: mensajeError
                });
            }
        });
    }

    /**
     * Activa una geocerca
     */
    activarGeocerca(geocerca: any): void {
        if (!geocerca) {
            this.msgService.add({
                severity: 'warn',
                summary: 'Advertencia',
                detail: 'No hay geocerca seleccionada'
            });
            return;
        }

        // Verificar si ya está activa
        if (geocerca.geocact === true) {
            this.msgService.add({
                severity: 'info',
                summary: 'Información',
                detail: 'La geocerca ya está activa'
            });
            return;
        }

        this.loading = true;

        this.geocercaService.activarGeocerca(geocerca.geoccod).subscribe({
            next: () => {
                this.loading = false;
                this.msgService.add({
                    severity: 'success',
                    summary: 'Geocerca activada',
                    detail: `La geocerca "${geocerca.geocnom}" fue activada correctamente`
                });

                this.refreshData();
            },
            error: (error) => {
                this.loading = false;
                console.error('Error activando geocerca:', error);
                this.msgService.add({
                    severity: 'error',
                    summary: 'Error',
                    detail: 'No se pudo activar la geocerca'
                });
            }
        });
    }

    /**
     * Desactiva una geocerca con ConfirmDialog
     */
    desactivarGeocerca(geocerca: any): void {
        if (!geocerca) {
            this.msgService.add({
                severity: 'warn',
                summary: 'Advertencia',
                detail: 'No hay geocerca seleccionada'
            });
            return;
        }

        if (geocerca.geocact === false) {
            this.msgService.add({
                severity: 'info',
                summary: 'Información',
                detail: 'La geocerca ya está desactivada'
            });
            return;
        }

        // ConfirmDialog para desactivar
        this.confirmationService.confirm({
            message: `¿Está seguro de que desea desactivar la geocerca "${geocerca.geocnom}"?\n\nEsto ocultará la geocerca para el vendedor pero no la eliminará.`,
            header: 'Desactivar Geocerca',
            icon: 'pi pi-question-circle',
            acceptLabel: 'Sí, Desactivar',
            rejectLabel: 'Cancelar',
            acceptButtonStyleClass: 'p-button-warning',
            rejectButtonStyleClass: 'p-button-outlined',
            accept: () => {
                this.ejecutarDesactivacionGeocerca(geocerca);
            },
            reject: () => {
                this.msgService.add({
                    severity: 'info',
                    summary: 'Cancelado',
                    detail: 'La desactivación fue cancelada',
                    life: 3000
                });
            }
        });
    }

    /**
     * Ejecuta la desactivación real de la geocerca
     */
    private ejecutarDesactivacionGeocerca(geocerca: any): void {
        this.loading = true;

        this.geocercaService.desactivarGeocerca(geocerca.geoccod).subscribe({
            next: () => {
                this.loading = false;
                this.msgService.add({
                    severity: 'success',
                    summary: 'Geocerca desactivada',
                    detail: `La geocerca "${geocerca.geocnom}" fue desactivada correctamente`
                });

                // Refresh de datos para mostrar el cambio
                this.refreshRapidoUsuarioActual();
            },
            error: (error) => {
                this.loading = false;
                console.error('Error desactivando geocerca:', error);
                this.msgService.add({
                    severity: 'error',
                    summary: 'Error',
                    detail: 'No se pudo desactivar la geocerca'
                });
            }
        });
    }

    toggleEstadoGeocerca(geocerca: any): void {
        if (geocerca.geocact) {
            this.desactivarGeocerca(geocerca);
        } else {
            this.activarGeocerca(geocerca);
        }
    }
    //==========================================================================//

    // ================== MÉTODOS PARA MODO EDICIÓN ===============================
    iniciarEdicionDeGeocerca(geocerca: any): void {
        if (!this.selectedUser) {
            this.msgService.add({
                severity: 'warn',
                summary: 'Advertencia',
                detail: 'Seleccione un vendedor primero'
            });
            return;
        }
        if (!geocerca || !geocerca.geoccod) {
            this.msgService.add({
                severity: 'error',
                summary: 'Error',
                detail: 'Geocerca inválida'
            });
            return;
        }
        const geocercaDelUsuario = this.selectedUser.geocercas?.find((g) => g.geoccod === geocerca.geoccod);
        if (!geocercaDelUsuario) {
            this.msgService.add({
                severity: 'error',
                summary: 'Error',
                detail: 'La geocerca no pertenece al vendedor seleccionado'
            });
            return;
        }
        const key = `${this.selectedUser.codigoVendedor}-${geocerca.geoccod}`;
        const polygon = this.geocercaLayers.get(key);

        if (!polygon) {
            console.error('❌ No se encontró la geocerca en el mapa');
            this.msgService.add({
                severity: 'error',
                summary: 'Error',
                detail: `No se encontró la geocerca "${geocerca.geocnom}" en el mapa`
            });
            return;
        }
        this.cerrarDrawerGeocercas();

        if (!this.editMode) {
            this.activarModoEdicion();

            setTimeout(() => {
                this.seleccionarGeocercaParaEditar(key, polygon);
            }, 100);
        } else {
            this.seleccionarGeocercaParaEditar(key, polygon);
        }

        this.centrarMapaEnGeocerca(geocerca);
    }
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

                // Centrar el mapa en la geocerca
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
     * Activa el modo edición - hace las geocercas clickeables
     */
    activarModoEdicion(): void {
        if (!this.selectedUser || this.selectedUser.totalGeocercas === 0) {
            this.msgService.add({
                severity: 'warn',
                summary: 'Advertencia',
                detail: 'No hay geocercas para editar'
            });
            return;
        }

        this.editMode = true;
        this.editingGeocerca = null;
        this.editingPolygon = null;

        this.geocercaLayers.forEach((polygon, key) => {
            polygon.setStyle({
                color: '#3B82F6',
                weight: 3,
                opacity: 0.8,
                fillOpacity: 0.2
            });

            polygon.off('click');
            polygon.on('click', () => {
                this.seleccionarGeocercaParaEditar(key, polygon);
            });
        });

        this.msgService.add({
            severity: 'info',
            summary: 'Modo edición activado',
            detail: 'Haga clic en una geocerca para editarla'
        });
    }

    /**
     * Selecciona una geocerca específica para editar
     */
    seleccionarGeocercaParaEditar(key: string, polygon: L.Polygon): void {
        if (this.editingPolygon) {
            this.limpiarEdicionActual();
        }
        const parts = key.split('-');
        const geocercaCodigo = parts[parts.length - 1];

        if (!this.selectedUser?.geocercas) {
            this.msgService.add({
                severity: 'error',
                summary: 'Error',
                detail: 'No hay datos de geocercas disponibles'
            });
            return;
        }

        const geocercaEncontrada = this.selectedUser.geocercas.find((g) => g.geoccod === geocercaCodigo);

        if (!geocercaEncontrada) {
            this.msgService.add({
                severity: 'error',
                summary: 'Error',
                detail: `No se encontró la geocerca con código: ${geocercaCodigo}`
            });
            return;
        }

        this.editingGeocerca = geocercaEncontrada;
        this.editingPolygon = polygon;

        try {
            this.originalCoordinates = JSON.parse(this.editingGeocerca.geoccoor);
        } catch (error) {
            console.error('Error parsing coordinates:', error);
            this.originalCoordinates = [];
        }

        polygon.setStyle({
            color: '#EF4444',
            weight: 4,
            opacity: 1,
            fillOpacity: 0.3
        });

        this.habilitarEdicionVertices(polygon);

        this.msgService.add({
            severity: 'success',
            summary: 'Geocerca seleccionada',
            detail: `Editando: ${this.editingGeocerca.geocnom}. Arrastre los vértices para modificar.`
        });
    }

    /**
     * Habilita la edición de vértices de un polígono
     */
    habilitarEdicionVertices(polygon: L.Polygon): void {
        if (!this.map) return;

        this.limpiarMarkersEdicion();
        this.isEditingVertices = true;
        const latLngs = polygon.getLatLngs()[0] as L.LatLng[];

        latLngs.forEach((latLng, index) => {
            const marker = L.marker(latLng, {
                draggable: true,
                icon: L.divIcon({
                    className: 'vertex-marker-custom',
                    html: `<div class="vertex-point"></div>`,
                    iconSize: [16, 16],
                    iconAnchor: [8, 8]
                })
            }).addTo(this.map!);

            marker.on('drag', () => {
                const newLatLngs = [...latLngs];
                newLatLngs[index] = marker.getLatLng();
                polygon.setLatLngs(newLatLngs);
            });

            marker.on('dragstart', () => {
                marker.getElement()?.classList.add('dragging');
            });

            marker.on('dragend', () => {
                marker.getElement()?.classList.remove('dragging');
            });

            this.editingMarkers.push(marker);
        });

        this.agregarEstilosVertices();

        this.msgService.add({
            severity: 'info',
            summary: 'Vértices habilitados',
            detail: 'Arrastre los puntos rojos para modificar la forma',
            life: 3000
        });
    }

    /**
     * Agrega estilos CSS para los vértices si no existen
     */
    private agregarEstilosVertices(): void {
        if (document.querySelector('#vertex-styles')) return;

        const style = document.createElement('style');
        style.id = 'vertex-styles';
        style.innerHTML = `
        .vertex-marker-custom {
            border: none !important;
            background: none !important;
        }

        .vertex-point {
            width: 12px;
            height: 12px;
            background-color: #EF4444;
            border: 3px solid white;
            border-radius: 50%;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
            cursor: grab;
            position: relative;
            z-index: 1000;
            transition: all 0.2s ease;
        }

        .vertex-point:hover {
            transform: scale(1.2);
            box-shadow: 0 3px 12px rgba(239, 68, 68, 0.4);
        }

        .vertex-marker-custom.dragging .vertex-point {
            cursor: grabbing !important;
            transform: scale(1.3);
            box-shadow: 0 4px 16px rgba(239, 68, 68, 0.6);
        }

        .leaflet-marker-icon.vertex-marker-custom {
            border: none !important;
            outline: none !important;
        }
    `;

        document.head.appendChild(style);
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
     * Limpia la edición actual
     */
    limpiarEdicionActual(): void {
        this.limpiarMarkersEdicion();

        if (this.editingPolygon) {
            // Restaurar estilo normal
            this.editingPolygon.setStyle({
                color: this.getGeocercaColor(this.editingGeocerca?.geocpri || 1),
                weight: 3,
                opacity: 0.8,
                fillOpacity: 0.3
            });
        }
    }

    /**
     * Cancela el modo edición y restaura todo
     */
    cancelarModoEdicion(): void {
        if (this.editingPolygon && this.originalCoordinates.length > 0) {
            const latlngs: [number, number][] = this.originalCoordinates.map((coord) => [coord.lat, coord.lng]);
            this.editingPolygon.setLatLngs(latlngs);
        }

        this.limpiarEdicionActual();
        this.editMode = false;
        this.editingGeocerca = null;
        this.editingPolygon = null;
        this.originalCoordinates = [];

        if (this.selectedUser) {
            this.showSelectedUserGeocercas(this.selectedUser);
        }

        this.msgService.add({
            severity: 'info',
            summary: 'Edición cancelada',
            detail: 'Se restauraron las geocercas originales'
        });
    }

    /**
     * Continúa con la edición
     */
    continuarEdicion(): void {
        if (!this.editingGeocerca || !this.editingPolygon) {
            this.msgService.add({
                severity: 'warn',
                summary: 'Advertencia',
                detail: 'Seleccione una geocerca primero'
            });
            return;
        }

        const latLngs = this.editingPolygon.getLatLngs()[0] as L.LatLng[];
        this.coordenadasGeocerca = latLngs.map((latLng) => ({
            lat: latLng.lat,
            lng: latLng.lng
        }));

        const sumLat = this.coordenadasGeocerca.reduce((sum, coord) => sum + coord.lat, 0);
        const sumLng = this.coordenadasGeocerca.reduce((sum, coord) => sum + coord.lng, 0);
        this.centroGeocerca = {
            lat: sumLat / this.coordenadasGeocerca.length,
            lng: sumLng / this.coordenadasGeocerca.length
        };

        this.cargarDatosEnFormulario();
        this.limpiarMarkersEdicion();
        this.geocercaDialog = true;

        this.msgService.add({
            severity: 'success',
            summary: 'Continuando edición',
            detail: 'Complete los datos en el formulario'
        });
    }

    /**
     * Carga los datos de la geocerca en el formulario
     */
    private cargarDatosEnFormulario(): void {
        if (!this.editingGeocerca) return;

        this.geocercaForm.patchValue({
            geoccod: this.editingGeocerca.geoccod,
            geocnom: this.editingGeocerca.geocnom,
            geocdesc: this.editingGeocerca.geocdesc,
            geocdirre: this.editingGeocerca.geocdirre,
            geocprov: this.editingGeocerca.geocprov,
            geocciud: this.editingGeocerca.geocciud,
            geocsec: this.editingGeocerca.geocsec,
            geocpais: this.editingGeocerca.geocpais || 'ECUADOR',
            geocpri: this.editingGeocerca.geocpri,
            geocact: this.editingGeocerca.geocact
        });

        this.cargarSeleccionesGeograficas();
    }

    /**
     * Carga las selecciones geográficas en los autocompletes
     */
    private cargarSeleccionesGeograficas(): void {
        if (!this.editingGeocerca) return;
        const provincia = this.provinceService.getProvincias().find((p) => p.provincia.toLowerCase() === this.editingGeocerca.geocprov.toLowerCase());

        if (provincia) {
            this.provinciaSeleccionada = provincia;
            this.cantonesList = this.provinceService.getCantones(provincia.codigo);
            this.geocercaForm.patchValue({ geocprov: provincia });
            const canton = this.cantonesList.find((c) => c.canton.toLowerCase() === this.editingGeocerca.geocciud.toLowerCase());

            if (canton) {
                this.ciudadSeleccionada = canton;
                this.parroquiasList = this.provinceService.getParroquias(provincia.codigo, canton.codigo);
                this.geocercaForm.patchValue({ geocciud: canton });

                const parroquia = this.parroquiasList.find((p) => p.parroquia.toLowerCase() === this.editingGeocerca.geocsec.toLowerCase());

                if (parroquia) {
                    this.sectorSeleccionado = parroquia;
                    this.geocercaForm.patchValue({ geocsec: parroquia });
                }
            }
        }
    }


    cerrarDialogoGeocerca(): void {
        this.geocercaDialog = false;
        if (this.editMode && this.editingGeocerca) {
            this.msgService.add({
                severity: 'info',
                summary: 'Edición cancelada',
                detail: 'Puede seguir editando en el mapa o cancelar'
            });
        }
    }

    /**
     * Guardar geocerca actualizada
     */
    guardarGeocerca(): void {
        if (this.geocercaForm.invalid) {
            this.msgService.add({
                severity: 'error',
                summary: 'Error de validación',
                detail: 'Complete todos los campos requeridos'
            });
            return;
        }

        if (!this.coordenadasGeocerca || this.coordenadasGeocerca.length === 0) {
            this.msgService.add({
                severity: 'error',
                summary: 'Error',
                detail: 'No hay coordenadas de la geocerca modificada'
            });
            return;
        }

        if (!this.editingGeocerca || !this.selectedUser) {
            this.msgService.add({
                severity: 'error',
                summary: 'Error',
                detail: 'No hay datos suficientes para la actualización'
            });
            return;
        }

        const formData = this.geocercaForm.value;
        let centroLat = this.centroGeocerca?.lat || 0;
        let centroLng = this.centroGeocerca?.lng || 0;

        if (!this.centroGeocerca && this.coordenadasGeocerca.length > 0) {
            centroLat = this.coordenadasGeocerca.reduce((sum, coord) => sum + coord.lat, 0) / this.coordenadasGeocerca.length;
            centroLng = this.coordenadasGeocerca.reduce((sum, coord) => sum + coord.lng, 0) / this.coordenadasGeocerca.length;
        }

        const provinciaString = typeof formData.geocprov === 'object' ? formData.geocprov.provincia : formData.geocprov;
        const ciudadString = typeof formData.geocciud === 'object' ? formData.geocciud.canton : formData.geocciud;
        const sectorString = typeof formData.geocsec === 'object' ? formData.geocsec.parroquia : formData.geocsec;

        const actualizarGeocercaDto: any = {
            geocnom: formData.geocnom,
            geocsec: sectorString,
            geocdirre: formData.geocdirre,
            geocciud: ciudadString,
            geocprov: provinciaString,
            geocpais: formData.geocpais || 'ECUADOR',
            geoclat: centroLat,
            geoclon: centroLng,
            geoccoor: this.coordenadasGeocerca,
            geocarm: this.editingGeocerca.geocarm || 0,
            geocperm: this.editingGeocerca.geocperm || 1,
            geocest: this.editingGeocerca.geocest || 'ACTIVO',
            geocact: formData.geocact,
            geocpri: formData.geocpri,
            geocdesc: formData.geocdesc,
            geocusedi: this.authService.getUsuarioFromToken() || 'SUPERVISOR',
            geoceqedi: this.authService.getEmpresa()?.nomempresa
        };

        this.loading = true;

        this.geocercaService.actualizarGeocerca(this.editingGeocerca.geoccod, actualizarGeocercaDto).subscribe({
            next: () => {
                this.loading = false;
                this.msgService.add({
                    severity: 'success',
                    summary: 'Éxito',
                    detail: 'Geocerca actualizada correctamente'
                });

                this.cerrarDialogoGeocerca();
                this.cancelarModoEdicion();
                this.refreshData();

                if (this.selectedUser) {
                    this.selectUser(this.selectedUser);
                }
            },
            error: () => {
                this.loading = false;
                this.msgService.add({
                    severity: 'error',
                    summary: 'Error',
                    detail: 'Error al actualizar la geocerca'
                });
            }
        });
    }

    //==========================================================================//

    // ========== MÉTODOS PARA EL DRAWER ==========

    abrirDrawerGeocercas(): void {
        if (!this.selectedUser || this.selectedUser.totalGeocercas === 0) {
            this.msgService.add({
                severity: 'info',
                summary: 'Sin geocercas',
                detail: 'Este vendedor no tiene geocercas asignadas'
            });
            return;
        }
        this.drawerGeocercasVisible = true;
        this.inicializarListaGeocercas();
    }

    /**
     * Cierra el drawer de geocercas
     */
    cerrarDrawerGeocercas(): void {
        this.drawerGeocercasVisible = false;
        this.limpiarFiltroGeocerca();
    }

    /**
     * Inicializa la lista de geocercas en el drawer
     */
    private inicializarListaGeocercas(): void {
        if (this.selectedUser?.geocercas) {
            this.geocercasFiltradas = [...this.selectedUser.geocercas];
            this.filtroGeocerca = '';
        }
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

    /**
     * Limpia el filtro de geocercas
     */
    limpiarFiltroGeocerca(): void {
        this.filtroGeocerca = '';
        this.filtrarGeocercasList();
    }

    /**
     * Método mejorado para actualizar la lista cuando cambia la selección de usuario
     */
    private actualizarDrawerSiEstaAbierto(): void {
        if (this.drawerGeocercasVisible) {
            this.inicializarListaGeocercas();
        }
    }

    refreshRapidoUsuarioActual(): void {
        if (!this.selectedUser) return;

        const codigoUsuario = this.selectedUser.codigoVendedor;
        this.loading = true;
        this.refreshData();

        setTimeout(() => {
            const usuarioActualizado = this.users.find(u => u.codigoVendedor === codigoUsuario);
            if (usuarioActualizado) {
                this.selectUser(usuarioActualizado);
                this.msgService.add({
                    severity: 'info',
                    summary: 'Datos actualizados',
                    detail: 'Geocercas actualizadas en tiempo real',
                    life: 2000
                });
            }
            this.loading = false;

            this.actualizarDrawerSiEstaAbierto();
        }, 1000);
    }


    //==========================================================================//


    // =========== MÉTODOS PARA EL CONFIRM DIALOG ===========

    //==========================================================================//




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
    }

    protected readonly Math = Math;
}
