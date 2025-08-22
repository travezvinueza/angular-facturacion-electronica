import { AfterViewInit, Component, ElementRef, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { IconFieldModule } from 'primeng/iconfield';
import { InputIconModule } from 'primeng/inputicon';
import { InputTextModule } from 'primeng/inputtext';
import { CommonModule } from '@angular/common';
import { PaginatorModule } from 'primeng/paginator';
import { MessageService } from 'primeng/api';
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
        Slider
    ],
    templateUrl: './vendedores.component.html',
    styleUrl: './vendedores.component.scss'
})
export class VendedoresComponent implements OnInit, AfterViewInit, OnDestroy {
    @ViewChild('mapContainer', { static: false }) mapContainer!: ElementRef;

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
    }
    //==========================================================================//


    // ======================== MÉTODOS PARA GESTIÓN DEL MAPA  =====================

    addUserMarkersToMap(): void {
        if (!this.map || !this.markerClusterGroup) return;

        this.markerClusterGroup.clearLayers();
        this.userMarkers.clear();

        this.users.forEach((user) => {
            if (user.ubicacionActual && user.ubicacionActual.geublat && user.ubicacionActual.geublon) {
                const marker = L.marker([user.ubicacionActual.geublat, user.ubicacionActual.geublon]);

                const popupContent = `
                <div class="p-2">
                    <p class="font-semibold mb-1 text-sm">${user.nombreVendedor}</p>
                    <p class="text-sm mb-1">${user.codigoVendedor} • ${user.codigoVendedorSecundario}</p>
                    <p class="text-xs text-gray-500 mb-1">
                        Última ubicación: ${new Date(user.ubicacionActual.geubfech).toLocaleString('es-EC')}
                    </p>
                    <p class="text-xs text-blue-600">
                        Geocercas: ${user.totalGeocercas}
                    </p>
                </div>`;

                marker.bindPopup(popupContent);
                this.userMarkers.set(user.codigoVendedor, marker);

                if (this.markerClusterGroup) {
                    this.markerClusterGroup.addLayer(marker);
                }
            }
        });
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

                    const popupContent = `
                <div class="p-3">
                    <p class="font-semibold mb-2 text-base text-primary-700">${geocerca.geocnom}</p>
                    <div class="space-y-1">
                        <p class="text-sm"><span class="font-medium">Código:</span> ${geocerca.geoccod}</p>
                        <p class="text-sm"><span class="font-medium">Sector:</span> ${geocerca.geocsec}</p>
                        <p class="text-sm"><span class="font-medium">Ciudad:</span> ${geocerca.geocciud}, ${geocerca.geocprov}</p>
                        <p class="text-sm"><span class="font-medium">Vendedor:</span> ${user.nombreVendedor}</p>
                        <p class="text-sm"><span class="font-medium">Prioridad:</span> ${geocerca.geocpri}</p>
                        <p class="text-sm"><span class="font-medium">Estado:</span> ${geocerca.geocest}</p>
                        <p class="text-xs text-gray-500 mt-2">
                            Asignado: ${new Date(geocerca.fechaAsignacion).toLocaleDateString('es-EC')}
                        </p>
                    </div>
                </div>`;

                    polygon.bindPopup(popupContent);

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
        this.clearAllGeocercas();
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

        // Confirmación con detalles específicos
        if (confirm(
            `¿Está seguro de que desea eliminar la geocerca "${geocercaAEliminar.geocnom}"?\n\n` +
            `Código: ${geocercaAEliminar.geoccod}\n` +
            `Esta acción no se puede deshacer.`
        )) {
            this.loading = true;

            this.geocercaService.eliminarGeocerca(geocercaAEliminar.geoccod).subscribe({
                next: () => {
                    this.loading = false;
                    this.msgService.add({
                        severity: 'success',
                        summary: 'Geocerca eliminada',
                        detail: `La geocerca "${geocercaAEliminar.geocnom}" fue eliminada correctamente`
                    });

                    // Si estaba en modo edición, cancelar
                    if (this.editMode && this.editingGeocerca?.geoccod === geocercaAEliminar.geoccod) {
                        this.cancelarModoEdicion();
                        this.refreshData();
                    }

                    // Cerrar dialog si estaba abierto
                    if (this.geocercaDialog) {
                        this.cerrarDialogoGeocerca();
                    }

                    // Refresh de datos
                    this.refreshData();
                },
                error: (error) => {
                    this.loading = false;
                    console.error('Error eliminando geocerca:', error);
                    this.msgService.add({
                        severity: 'error',
                        summary: 'Error',
                        detail: 'No se pudo eliminar la geocerca'
                    });
                }
            });
        }
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
     * Desactiva una geocerca
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

        // Verificar si ya está desactivada
        if (geocerca.geocact === false) {
            this.msgService.add({
                severity: 'info',
                summary: 'Información',
                detail: 'La geocerca ya está desactivada'
            });
            return;
        }

        // Confirmación para desactivar
        if (confirm(
            `¿Está seguro de que desea desactivar la geocerca "${geocerca.geocnom}"?\n\n` +
            `Esto ocultará la geocerca para el vendedor pero no la eliminará.`
        )) {
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
                    this.refreshData();
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
    }

    /**
     * Cambia el estado activo/inactivo de una geocerca (toggle)
     */
    toggleEstadoGeocerca(geocerca: any): void {
        if (geocerca.geocact) {
            this.desactivarGeocerca(geocerca);
        } else {
            this.activarGeocerca(geocerca);
        }
    }
    //==========================================================================//




    // ================== MÉTODOS PARA MODO EDICIÓN ===============================

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

        const geocercaEncontrada = this.selectedUser.geocercas.find(g => g.geoccod === geocercaCodigo);

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
        // Verificar si los estilos ya existen
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
        this.editingMarkers.forEach(marker => {
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
        // Restaurar coordenadas originales si había una geocerca en edición
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
     * Continúa con la edición - abre tu dialog existente
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

    /**
     * Método para cerrar tu dialog (agregar este si no lo tienes)
     */
    cerrarDialogoGeocerca(): void {
        this.geocercaDialog = false;

        if (this.editMode && this.editingGeocerca) {
            // Mantener el modo edición activo para seguir editando
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

        const provinciaString = typeof formData.geocprov === 'object'
            ? formData.geocprov.provincia
            : formData.geocprov;

        const ciudadString = typeof formData.geocciud === 'object'
            ? formData.geocciud.canton
            : formData.geocciud;

        const sectorString = typeof formData.geocsec === 'object'
            ? formData.geocsec.parroquia
            : formData.geocsec;

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
