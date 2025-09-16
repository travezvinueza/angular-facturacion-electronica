import { AfterViewInit, Component, ElementRef, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
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
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { catchError, finalize, of, retry, Subject, takeUntil, timeout, timer } from 'rxjs';
import { UserDto } from '@/core/models/UserDto';
import { UserService } from '@/core/services/user.service';
import { MapService, RangeDisplayInfo, SearchResult } from '@/core/services/map.service';
import * as L from 'leaflet';
import { CustomerResponseDto } from '@/core/models/Customer/CustomerResponseDto';
import { CustomerService } from '@/core/services/customer.service';
import { CustomerAreaRequestDto } from '@/core/models/Customer/CustomerAreaRequestDto';
import {
    GeocercaDto,
    VendedorDto,
    VendedoresQueryParams,
    VendedoresResponse
} from '@/core/models/Geocercas/VendedorDto';
import { AutoComplete } from 'primeng/autocomplete';
import { DatePicker } from 'primeng/datepicker';
import { Checkbox } from 'primeng/checkbox';
import { ToggleSwitchModule } from 'primeng/toggleswitch';
import { Accordion, AccordionContent, AccordionHeader, AccordionPanel } from 'primeng/accordion';
import { NominatimReverseResponse } from '@/core/models/nominatim-response.interface';
import { FilterRequest, ZonaClientes } from '@/core/models/Filter/FilterRequest';
import { TrackingResponse } from '@/core/models/Filter/TrackingResponse';

@Component({
    selector: 'app-geocercas',
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
        AutoComplete,
        DatePicker,
        Checkbox,
        ToggleSwitchModule,
        Accordion,
        AccordionContent,
        AccordionPanel,
        AccordionHeader
    ],
    standalone: true,
    templateUrl: './geocercas-list.component.html',
    styleUrls: ['./geocercas-list.component.css']
})
export class GeocercasListComponent implements OnInit, AfterViewInit, OnDestroy {
    @ViewChild('mapContainer', { static: false }) mapContainer!: ElementRef;
    @ViewChild('scrollContainer') scrollContainer!: ElementRef;


    customerSearchTerm: string = '';
    userLocations: Map<string, string> = new Map();
    loadingLocations: Set<string> = new Set();
    private geocodingQueue: Array<{userId: string, lat: number, lon: number}> = [];
    private isProcessingQueue: boolean = false;
    private lastRequestTime: number = 0;
    private readonly MIN_REQUEST_INTERVAL = 1500; // 1.5 segundos entre peticiones
    private readonly MAX_RETRIES = 3;
    private failedRequests: Map<string, number> = new Map();

    // Para scroll infinito
    loadingMore: boolean = false;
    hasReachedEnd: boolean = false;
    currentPage: number = 0;// Mantener usuarios originales
    private scrollThreshold: number = 100;
    private debounceTimer: any;

    // Propiedades de filtros
    filterFrom: Date | null = null;
    selectedTimeUnit: any = null;
    timeValue: number | null = null;
    selectedGeofence: any = null;
    geofenceEnabled: boolean = false;
    pedidosEnabled: boolean = false;
    collectionsEnabled: boolean = false;
    clientesNone: boolean = false;
    clientesAll: boolean = false;
    clientesAssigned: boolean = false;


    timeUnitOptions: any[] = [];


    geofenceOptions: any[] = [];

    // Propiedades para geocercas
    vendorGeocercas: GeocercaDto[] = [];
    loadingGeocercas: boolean = false;
    showGeocercasDrawer: boolean = false;
    selectedVendor: VendedorDto | null = null;

    // Propiedades de customers
    customers: CustomerResponseDto[] = [];
    loadingCustomers: boolean = false;

    // Propiedades de búsqueda de customers
    filteredCustomers: CustomerResponseDto[] = [];

    // Subject para manejo de subscripciones
    private destroy$ = new Subject<void>();

    // Propiedades de usuarios
    users: UserDto[] = [];
    filteredUsers: UserDto[] = [];
    paginatedUsers: UserDto[] = [];
    selectedUser: UserDto | null = null;
    loading: boolean = true;

    // Propiedades de paginación
    first: number = 0;
    itemsPerPage: number = 6;

    // Propiedades del mapa (delegadas al servicio)
    searchLocation: string = '';
    searchingLocation: boolean = false;
    searchResults: SearchResult[] = [];
    mapInitialized: boolean = false;

    // Nuevas propiedades para el drawer
    showRangeDrawer: boolean = false;
    userRange: RangeDisplayInfo | null = null;
    showRangeDialog: boolean = false;
    defaultRadius: number = 1000;
    customRadius: number = 1000;


    constructor(
        private readonly userService: UserService,
        private readonly msgService: MessageService,
        private readonly mapService: MapService,
        private readonly http: HttpClient,
        private readonly customerService: CustomerService
    ) {}

    //===============MÉTODO DE INICIALIZACIÓN========================================//

    ngOnInit(): void {
        this.getAllUsers();
        this.subscribeToMapService();
    }

    ngAfterViewInit(): void {
        requestAnimationFrame(() => {
            this.initializeMap().then(() => {});
        });
    }

    async initializeMap(): Promise<void> {
        this.mapInitialized = true;
        try {
            await this.mapService.initializeMap(this.mapContainer, {
                center: [-0.2298, -78.5249],
                zoom: 13,
                defaultLocation: 'Quito, Ecuador',
                zoomControl: false
            });
            this.mapService.addSearchAreaButton(
                (bounds) => this.searchCustomersInCurrentArea(bounds)
            );
            if (!this.loading && this.users.length > 0) {
                this.mapService.addUserMarkers(this.users);
            }
        } catch (error) {
            console.error('Error al inicializar el mapa:', error);
        }
    }

    /**
     * Busca clientes en el área visible actual del mapa
     */
    private searchCustomersInCurrentArea(bounds: L.LatLngBounds): void {
        if (!this.selectedUser) {
            this.msgService.add({
                severity: 'warn',
                summary: 'Advertencia',
                detail: 'Seleccione un usuario primero'
            });
            return;
        }

        const range = {
            southWest: [bounds.getSouth(), bounds.getWest()],
            northEast: [bounds.getNorth(), bounds.getEast()]
        };

        this.getCustomersInArea(this.selectedUser.usucodv, range);
    }

    /**
     * Obtiene el nombre de la ubicación para mostrar en el UI
     */
    getUserLocationName(user: UserDto): string {
        const locationName = this.userLocations.get(user.usucodv);
        const isLoading = this.loadingLocations.has(user.usucodv);

        if (isLoading) {
            return 'Obteniendo ubicación...';
        }

        if (locationName) {
            return locationName;
        }

        // Si no se ha iniciado el proceso, iniciarlo
        if (user.ubicacion.geublat && user.ubicacion.geublon) {
            // Agregar a la cola si no existe
            setTimeout(() => {
                this.addToGeocodingQueue(
                    parseFloat(String(user.ubicacion!.geublat)),
                    parseFloat(String(user.ubicacion!.geublon)),
                    user.usucodv
                );
            }, 100);

            return 'Cargando ubicación...';
        }

        return 'Sin ubicación disponible';
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
            this.processGeocodingQueue().then();
        }
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

        return this.http
            .get<NominatimReverseResponse>(url, {})
            .pipe(
                timeout(10000), // 10 segundos timeout
                retry({
                    count: this.MAX_RETRIES,
                    delay: (_error, retryCount) => {
                        // Delay exponencial: 2s, 4s, 8s
                        const delayMs = Math.pow(2, retryCount) * 1000;
                        console.log(`Reintentando geocoding para ${userId} en ${delayMs}ms (intento ${retryCount})`);
                        return timer(delayMs);
                    }
                }),
                catchError((error) => {
                    console.warn(`Error en geocoding para ${userId} después de ${this.MAX_RETRIES} intentos:`, error);
                    return of(null); // Continuar sin error
                }),
                finalize(() => {
                    this.loadingLocations.delete(userId);
                })
            )
            .toPromise()
            .then((response) => {
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
    //=============================================================================================//

    /**
     * Suscribe a los observables del servicio de mapas
     */
    private subscribeToMapService(): void {
        this.mapService.currentUserRange$.pipe(takeUntil(this.destroy$)).subscribe((range) => {
            this.userRange = range;
        });

        // Estado de inicialización del mapa
        this.mapService.isMapInitialized$.pipe(takeUntil(this.destroy$)).subscribe((initialized) => {
            this.mapInitialized = initialized;
            if (initialized && this.mapService['map']) {
                this.mapService.addUserMarkers(this.users);
            }
        });
        this.mapService.isSearchingLocation$.pipe(takeUntil(this.destroy$)).subscribe((searching) => {
            this.searchingLocation = searching;
        });

        this.mapService.searchResultsList$.pipe(takeUntil(this.destroy$)).subscribe((results) => {
            this.searchResults = results;
        });
    }

    //====MÉTODO PARA OBTENER LOS CUSTOMERS POR VENDEDOR Y ÁREA====//
    /**
     * Filtra clientes basado en el término de búsqueda
     */
    filterCustomers(): void {
        if (!this.customerSearchTerm.trim()) {
            this.filteredCustomers = [...this.customers];
            return;
        }

        const searchTerm = this.customerSearchTerm.toLowerCase();
        this.filteredCustomers = this.customers.filter(customer =>
            customer.dirnombre.toLowerCase().includes(searchTerm) ||
            customer.dirruc.toLowerCase().includes(searchTerm) ||
            customer.dirdirec.toLowerCase().includes(searchTerm)
        );
    }



    private getCustomersInArea(vendorCode: string, range: any): void {
        this.loadingCustomers = true;

        const requestDto: CustomerAreaRequestDto = {
            codvend: vendorCode,
            latmax: range.southWest[0],
            latmin: range.northEast[0],
            lonmax: range.southWest[1],
            lonmin: range.northEast[1]
        };

        this.fetchCustomersByArea(requestDto);
    }

    private fetchCustomersByArea(requestDto: CustomerAreaRequestDto): void {
        this.customerService
            .getCustomersByVendorAndArea(requestDto)
            .pipe(takeUntil(this.destroy$))
            .subscribe({
                next: (customers: CustomerResponseDto[]) => {
                    this.customers = customers;
                    this.filteredCustomers = [...customers];
                    this.loadingCustomers = false;
                    setTimeout(() => {
                        this.mapService.addCustomerMarkers(customers);
                    }, 200);
                    const assignedCount = customers.filter((c) => c.asignado).length;

                    this.msgService.add({
                        severity: 'success',
                        summary: 'Clientes cargados',
                        detail: `${customers.length} clientes encontrados (${assignedCount} asignados)`,
                        life: 3000
                    });
                },
                error: (error: HttpErrorResponse) => {
                    console.error('Error al cargar clientes:', error);
                    this.loadingCustomers = false;
                    this.customers = [];

                    this.msgService.add({
                        severity: 'error',
                        summary: 'Error',
                        detail: 'No se pudieron cargar los clientes del área'
                    });
                }
            });
    }
    //==============================================================================================//

    //===============MÉTODO PARA OBTENER TODOS LOS USUARIOS===========================================//

    getAllUsers(): void {
        this.loading = true;
        this.userService.getAllListUser().subscribe({
            next: (data: UserDto[]) => {
                this.users = data;
                this.filteredUsers = [...this.users];
                this.resetInfiniteScroll();
                this.updatePagination();
                this.loading = false;

                if (this.mapInitialized) {
                    this.mapService.addUserMarkers(this.users);
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
    //=============================================================================================//

    //===============MÉTODO PARA BUSCAR USUARIOS/PAGINACIÓN====================================================//
    onSearch(event: Event): void {
        const value = (event.target as HTMLInputElement).value.toLowerCase();
        this.filteredUsers = this.users.filter((user) => user.usunombre.toLowerCase().includes(value) || user.usucod.toLowerCase().includes(value) || user.usuemail.toLowerCase().includes(value));
        this.first = 0;
        this.updatePagination();
    }

    onPageChange(event: any): void {
        this.first = event.first;
        this.itemsPerPage = event.rows;
        this.updatePagination();
    }

    updatePagination(): void {
        const start = this.first;
        const end = start + this.itemsPerPage;
        this.paginatedUsers = this.filteredUsers.slice(start, end);
    }
    //=============================================================================================//

    selectUser(user: UserDto): void {
        this.selectedUser = user;
        const rangeInfo = this.mapService.focusOnUserWithRange(user, this.defaultRadius);

        if (rangeInfo) {
            this.getCustomersInArea(user.usucodv, rangeInfo.range);
        }

        this.loadVendorGeocercas(user.usucodv);
    }

    selectOnlyUser(user: UserDto): void {
        this.selectedUser = user;
        this.mapService.focusOnUser(user);
    }

    //===MÉTODO PARA CARGAR LAS GEOCERCAS DEL VENDEDOR====================================================//

    private loadVendorGeocercas(vendorCode: string): void {
        this.loadingGeocercas = true;

        const params: VendedoresQueryParams = {
            busqueda: vendorCode, // Buscar específicamente por este código
            pageNumber: 1,
            pageSize: 50
        };

        this.userService
            .getVendedoresConGeocercas(params)
            .pipe(takeUntil(this.destroy$))
            .subscribe({
                next: (response: VendedoresResponse) => {
                    // Filtrar específicamente por el código de vendedor
                    const vendorData = this.findVendorByCode(response.data, vendorCode);

                    if (vendorData && vendorData.geocercas.length > 0) {
                        this.selectedVendor = vendorData;
                        this.vendorGeocercas = vendorData.geocercas;

                        // Mostrar geocercas en el mapa
                        this.mapService.displayVendorGeocercas(this.vendorGeocercas);

                        this.msgService.add({
                            severity: 'success',
                            summary: 'Geocercas cargadas',
                            detail: `${this.vendorGeocercas.length} geocercas encontradas para ${vendorData.nombreVendedor}`,
                            life: 3000
                        });
                    } else {
                        this.handleNoGeocercasFound(vendorCode);
                    }

                    this.loadingGeocercas = false;
                },
                error: (error: HttpErrorResponse) => {
                    this.handleGeocercasError(error, vendorCode);
                }
            });
    }

    private findVendorByCode(vendors: VendedorDto[], vendorCode: string): VendedorDto | null {
        return vendors.find((vendor) => vendor.codigoVendedor === vendorCode || vendor.codigoVendedorSecundario === vendorCode) || null;
    }

    private handleNoGeocercasFound(vendorCode: string): void {
        this.vendorGeocercas = [];
        this.selectedVendor = null;
        this.showGeocercasDrawer = false;

        this.msgService.add({
            severity: 'info',
            summary: 'Sin geocercas',
            detail: `No se encontraron geocercas para el vendedor ${vendorCode}`,
            life: 2000
        });
    }

    private handleGeocercasError(error: HttpErrorResponse, vendorCode: string): void {
        console.error('Error al cargar geocercas:', error);
        this.loadingGeocercas = false;
        this.vendorGeocercas = [];
        this.selectedVendor = null;

        this.msgService.add({
            severity: 'error',
            summary: 'Error',
            detail: `No se pudieron cargar las geocercas para el vendedor ${vendorCode}`
        });
    }

    //===============MÉTODO PARA CONFIGURAR EL RANGO/SACAR COORDENADAS NORHWEST AND SOUTHWEST/CONFIGURACION DEL MODULO DRAWER====================================================//
    get hasUserRange(): boolean {
        return this.userRange !== null;
    }


    //=====MÉTODO PARA EL BUSCADOR DEL MAPA========================================================//
    searchLocationOnMap(): void {
        if (!this.searchLocation.trim()) return;

        this.mapService.searchLocation(this.searchLocation).subscribe({
            next: (results) => {
                if (results.length === 1) {
                    this.selectSearchResult(results[0]);
                } else if (results.length === 0) {
                    this.msgService.add({
                        severity: 'info',
                        summary: 'Sin resultados',
                        detail: 'No se encontraron ubicaciones para la búsqueda'
                    });
                }
            },
            error: (error) => {
                console.error('Error en búsqueda:', error);
            }
        });
    }

    selectSearchResult(result: SearchResult): void {
        this.mapService.selectSearchResult(result);
    }

    clearLocationSearch(): void {
        this.searchLocation = '';
        this.mapService.clearSearchMarker();
        this.searchResults = [];
    }
    //=============================================================================================//

    //=====MÉTODO DE REFRESH (LOADING) MAPA/DATA==================================================================//

    resetMapView(): void {
        this.mapService.resetMapView();
    }


    // Función para regresar a la lista de usuarios
    backToUsersList(): void {
        this.refreshData();
    }

    refreshData(): void {
        this.loading = true;
        this.selectedUser = null;
        this.filteredCustomers = [];
        this.getAllUsers();
        this.resetMapView();
        this.clearFilters();
        this.customers = [];

    }
    //=============================================================================================//
    focusCustomerOnMap(customer: CustomerResponseDto): void {
        this.mapService.focusOnCustomer(customer);

        this.msgService.add({
            severity: 'info',
            summary: 'Cliente localizado',
            detail: `Mapa centrado en ${customer.dirnombre}`,
            life: 2000
        });
    }


    searchTimeUnit(event: any): void {
        const query = event.query.toLowerCase();
        this.timeUnitOptions = [
            { label: 'Segundos', value: 'Segundos' },
            { label: 'Minutos', value: 'Minutos' },
            { label: 'Horas', value: 'Horas' },
            { label: 'Días', value: 'Días' },
            { label: 'Semanas', value: 'Semanas' },
            { label: 'Meses', value: 'Meses' },
            { label: 'Años', value: 'Años' }
        ].filter(option =>
            option.label.toLowerCase().includes(query)
        );
    }

    searchGeofence(event: any): void {
        const query = event.query.toLowerCase();

        // Solo buscar si hay usuario seleccionado y geocercas cargadas
        if (!this.selectedUser || !this.vendorGeocercas.length) {
            this.geofenceOptions = [];
            return;
        }

        // Usar las geocercas del vendor actual con la interfaz correcta
        this.geofenceOptions = this.vendorGeocercas
            .filter((geocerca) => geocerca.geocnom.toLowerCase().includes(query) || geocerca.geocciud.toLowerCase().includes(query) || geocerca.geocprov.toLowerCase().includes(query))
            .map((geocerca) => ({
                label: `${geocerca.geocnom} - ${geocerca.geocciud}`,
                value: geocerca.geoccod,
                geocerca: geocerca
            }));
    }
    /**
     * Maneja el cambio de checkboxes de clientes (mutuamente excluyentes)
     */
    onClientFilterChange(filterType: 'none' | 'all' | 'assigned'): void {
        // Resetear todos
        this.clientesNone = false;
        this.clientesAll = false;
        this.clientesAssigned = false;

        // Activar el seleccionado
        switch (filterType) {
            case 'none':
                this.clientesNone = true;
                this.mapService.clearCustomerMarkers();
                break;
            case 'all':
                this.clientesAll = true;
                break;
            case 'assigned':
                this.clientesAssigned = true;
                break;
        }
    }

    getActiveFiltersCount(): number {
        let count = 0;
        if (this.filterFrom) count++;
        if (this.geofenceEnabled && this.selectedGeofence) count++;
        if (this.pedidosEnabled) count++;
        if (this.collectionsEnabled) count++;
        if (this.timeValue && this.selectedTimeUnit) count++;
        if (this.clientesNone || this.clientesAll || this.clientesAssigned) count++;
        return count;
    }

    clearFilters(): void {
        // Filtros temporales
        this.filterFrom = null;
        this.selectedTimeUnit = null;
        this.timeValue = null;

        // Filtros espaciales
        this.geofenceEnabled = false;
        this.selectedGeofence = null;

        // Filtros de transacciones
        this.pedidosEnabled = false;
        this.collectionsEnabled = false;

        // Filtros de clientes
        this.clientesNone = false;
        this.clientesAll = false;
        this.clientesAssigned = false;

        this.msgService.add({
            severity: 'info',
            summary: 'Filtros',
            detail: 'Todos los filtros han sido limpiados'
        });
    }

    /**
     * Aplica los filtros seleccionados y realiza la petición
     */
    applyFilters(): void {
        if (!this.selectedUser) {
            this.msgService.add({
                severity: 'warn',
                summary: 'Advertencia',
                detail: 'Seleccione un usuario primero'
            });
            return;
        }

        // Validar filtros requeridos
        if (!this.validateFilters()) {
            return;
        }

        // Construir el DTO
        const filterRequest: FilterRequest = {
            mostrarvendedor: !!this.selectedUser,
            codusuario: this.selectedUser.usucod,
            codvendedor: this.selectedUser.usucodv,
            fechainicio: this.buildFechaInicio(),
            tipotiempo: this.selectedTimeUnit?.value ?? 3, // Default: días
            valortiempo: this.timeValue ?? 1,
            clientes: this.buildClientesFilter(),
            transacciones: {
                pedidos: this.pedidosEnabled,
                cobros: this.collectionsEnabled
            },
            zonaclientes: this.buildZonaClientes()
        };



        // Realizar la petición
        this.loading = true;
        this.customerService.getTrackingDetails(filterRequest)
            .pipe(
                takeUntil(this.destroy$),
                finalize(() => this.loading = false)
            )

            .subscribe({
                next: (response: TrackingResponse) => {
                    this.processTrackingResponse(response);
                    this.msgService.add({
                        severity: 'success',
                        summary: 'Éxito',
                        detail: 'Filtros aplicados correctamente'
                    });
                },

                error: (error: HttpErrorResponse) => {
                    console.error('Error al aplicar filtros:', error);
                    this.msgService.add({
                        severity: 'error',
                        summary: 'Error',
                        detail: 'No se pudieron aplicar los filtros'
                    });
                }
            });
    }

    /**
     * Construye la fecha de inicio en formato ISO
     */
    private buildFechaInicio(): string {
        if (this.filterFrom) {
            return this.filterFrom.toISOString();
        }
        // Default: fecha actual
        return new Date().toISOString();
    }

    /**
     * Construye el valor de filtro de clientes (0=ninguno, 1=todos, 2=asignados)
     */
    private buildClientesFilter(): number {
        if (this.clientesNone) return 0;
        if (this.clientesAll) return 1;
        if (this.clientesAssigned) return 2;
        return 0;
    }

    /**
     * Construye la zona de clientes basada en la geocerca o área actual
     */
    private buildZonaClientes(): ZonaClientes {
        let bounds: L.LatLngBounds;

        if (this.geofenceEnabled && this.selectedGeofence) {
            // Usar coordenadas de la geocerca seleccionada
            bounds = new L.LatLngBounds(
                [this.selectedGeofence.latmin, this.selectedGeofence.lonmin],
                [this.selectedGeofence.latmax, this.selectedGeofence.lonmax]
            );
        } else {
            // Usar área visible actual del mapa
            bounds = this.mapService.getCurrentBounds();
        }

        return {
            codvend: this.selectedUser!.usucodv,
            latmax: bounds.getSouth(),
            latmin: bounds.getNorth(),
            lonmax: bounds.getWest(),
            lonmin: bounds.getEast()
        };
    }

    /**
     * Valida que los filtros requeridos estén completos
     */
    private validateFilters(): boolean {
        // Validar que al menos una transacción esté habilitada
        if (!this.pedidosEnabled && !this.collectionsEnabled) {
            this.msgService.add({
                severity: 'warn',
                summary: 'Validación',
                detail: 'Seleccione al menos un tipo de transacción'
            });
            return false;
        }

        // Validar tiempo si está especificado
        if (this.selectedTimeUnit && (!this.timeValue || this.timeValue <= 0)) {
            this.msgService.add({
                severity: 'warn',
                summary: 'Validación',
                detail: 'Ingrese un valor válido para el tiempo'
            });
            return false;
        }

        return true;
    }

    /**
     * Procesa la respuesta del tracking y actualiza el mapa
     */
    private processTrackingResponse(response: TrackingResponse): void {

        this.validateTrackingDataAvailability(response);

        // Actualizar marcadores en el mapa con las ubicaciones
        if (response.ubicaciones && response.ubicaciones.length > 0) {
            this.mapService.addTrackingMarkers(response.ubicaciones);
        }

        // Actualizar clientes si es necesario
        if (response.clientes && response.clientes.length > 0) {
            this.mapService.addCustomerMarkers(response.clientes);
        }

        // Agregar marcadores de cobros
        if (response.cobros && response.cobros.length > 0) {
            this.mapService.addChargeMarkers(response.cobros);
        }

        // Agregar marcadores de pedidos
        if (response.pedidos && response.pedidos.length > 0) {
            this.mapService.addOrderMarkers(response.pedidos);
        }

        console.log('Tracking response processed:', {
            ubicaciones: response.ubicaciones?.length ?? 0,
            clientes: response.clientes?.length ?? 0,
            cobros: response.cobros?.length ?? 0,
            pedidos: response.pedidos?.length ?? 0
        });
    }
    /**
     * Valida la disponibilidad de datos en la respuesta y muestra mensajes informativos
     */
    private validateTrackingDataAvailability(response: TrackingResponse): void {
        const emptyData: string[] = [];

        // Verificar pedidos si están habilitados
        if (this.pedidosEnabled) {
            if (!response.pedidos || response.pedidos.length === 0) {
                emptyData.push('Pedidos');
            }
        }

        // Verificar cobros si están habilitados
        if (this.collectionsEnabled) {
            if (!response.cobros || response.cobros.length === 0) {
                emptyData.push('Cobros');
            }
        }



        // Mostrar mensaje sobre qué tipos de datos están vacíos
        if (emptyData.length > 0) {
            this.msgService.add({
                severity: 'info',
                summary: 'Datos no disponibles',
                detail: `No se encontraron datos para: ${emptyData.join(', ')}`,
                life: 5000
            });
        }

        // Verificar si no hay datos en absoluto
        const hasAnyData = (response.ubicaciones?.length ?? 0) > 0 ||
            (response.clientes?.length ?? 0) > 0 ||
            (response.cobros?.length ?? 0) > 0 ||
            (response.pedidos?.length ?? 0) > 0;

        if (response.clientes.length  === 0)
        {
            this.msgService.add({
                severity: 'info',
                summary: 'Sin clientes',
                detail: 'No se encontraron clientes para mostrar con los filtros aplicados',
                life: 2000
            });
        }

        if (!hasAnyData) {
            this.msgService.add({
                severity: 'warn',
                summary: 'Sin datos',
                detail: 'No se encontraron datos para mostrar con los filtros aplicados. Intente con diferentes criterios de búsqueda',
                life: 6000
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
     * Resetea el estado del scroll infinito
     */
    private resetInfiniteScroll(): void {
        this.currentPage = 0;
        this.loadingMore = false;
        this.hasReachedEnd = false;
        this.paginatedUsers = [];

        // Cargar la primera página
        this.loadInitialUsers();
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


    ngOnDestroy(): void {
        if (this.debounceTimer) {
            clearTimeout(this.debounceTimer);
        }
        this.destroy$.next();
        this.destroy$.complete();
        this.mapService.destroyMap();
        this.showRangeDrawer = false;
        this.showRangeDialog = false;
        this.customerSearchTerm = '';
        this.userRange = null;
        this.customers = [];
        this.vendorGeocercas = [];
        this.selectedUser = null;
        this.selectedVendor = null;
    }
}
