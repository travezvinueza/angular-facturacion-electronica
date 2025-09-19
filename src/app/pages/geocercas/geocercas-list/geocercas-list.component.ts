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
import { catchError, finalize, of, retry, startWith, Subject, switchMap, takeUntil, timeout, timer } from 'rxjs';
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
import { FilterRequest, ZonaBusquedaFilter } from '@/core/models/Filter/FilterRequest';
import { TrackingResponse } from '@/core/models/Filter/TrackingResponse';
import { MultiSelect } from 'primeng/multiselect';

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
        AccordionHeader,
        MultiSelect
    ],
    standalone: true,
    templateUrl: './geocercas-list.component.html',
    styleUrls: ['./geocercas-list.component.css']
})
export class GeocercasListComponent implements OnInit, AfterViewInit, OnDestroy {
    @ViewChild('mapContainer', { static: false }) mapContainer!: ElementRef;
    @ViewChild('scrollContainer') scrollContainer!: ElementRef;


    //Propiedades para el polling/ refresh de coordenadas en el mapa en tiempo real

    private pollingSubscription$ = new Subject<void>();
    private readonly POLLING_INTERVAL = 30000; // 30 segundos
    private isPollingActive = false;

    //Propiedades de geocoding
    userLocations: Map<string, string> = new Map();
    loadingLocations: Set<string> = new Set();
    private geocodingQueue: Array<{ userId: string; lat: number; lon: number }> = [];
    private isProcessingQueue: boolean = false;
    private lastRequestTime: number = 0;
    private readonly MIN_REQUEST_INTERVAL = 1500; // 1.5 segundos entre peticiones
    private readonly MAX_RETRIES = 3;
    private failedRequests: Map<string, number> = new Map();

    // Para scroll infinito
    loadingMore: boolean = false;
    hasReachedEnd: boolean = false;
    currentPage: number = 0;
    private scrollThreshold: number = 100;
    private debounceTimer: any;

    // Propiedades de filtros
    filterFrom: Date | null = null;
    selectedTimeUnit: any = null;
    timeValue: number | null = null;
    selectedGeofence: string[] = [];
    geofenceEnabled: boolean = true;
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
    customerSearchTerm: string = '';

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
        this.startUserLocationPolling();
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
            this.mapService.addSearchAreaButton((bounds) => this.searchCustomersInCurrentArea(bounds));
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
        if (user.ubicacion.geublat && user.ubicacion.geublon) {
            setTimeout(() => {
                this.addToGeocodingQueue(parseFloat(String(user.ubicacion!.geublat)), parseFloat(String(user.ubicacion!.geublon)), user.usucodv);
            }, 100);

            return 'Cargando ubicación...';
        }

        return 'Sin ubicación disponible';
    }
    /**
     * Obtiene el nombre del lugar usando reverse geocoding con cola y cooldown
     */
    private addToGeocodingQueue(lat: number, lon: number, userId: string): void {
        const exists = this.geocodingQueue.some((item) => item.userId === userId);
        if (exists || this.loadingLocations.has(userId) || this.userLocations.has(userId)) {
            return;
        }
        this.geocodingQueue.push({ userId, lat, lon });
        this.loadingLocations.add(userId);

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
                const now = Date.now();
                const timeSinceLastRequest = now - this.lastRequestTime;
                const delay = Math.max(0, this.MIN_REQUEST_INTERVAL - timeSinceLastRequest);

                if (delay > 0) {
                    await this.delay(delay);
                }

                await this.performGeocodingRequest(item.lat, item.lon, item.userId);
                this.lastRequestTime = Date.now();
            } catch (error) {
                console.warn(`Error procesando geocoding para ${item.userId}:`, error);
                this.handleGeocodingError(item);
            }
            await this.delay(200);
        }

        this.isProcessingQueue = false;
    }

    /**
     * Realiza la petición de geocoding con retry automático
     */
    private performGeocodingRequest = async (lat: number, lon: number, userId: string): Promise<void> => {
        const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&addressdetails=1`;

        this.http.get<NominatimReverseResponse>(url).pipe(
            timeout(10000),
            retry({
                count: this.MAX_RETRIES,
                delay: (_, i) => timer(Math.pow(2, i) * 1000)
            }),
            catchError(() => of(null)),
            finalize(() => this.loadingLocations.delete(userId))
        ).subscribe(res => {
            const name = res?.address ? this.buildLocationName(res) : 'Ubicación no disponible';
            this.userLocations.set(userId, name);
            res?.address && this.failedRequests.delete(userId);
        });
    };


    /**
     * Construye un nombre legible de la ubicación
     */
    private buildLocationName(response: NominatimReverseResponse): string {
        const address = response.address;
        const locationParts: string[] = [];

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
        return new Promise((resolve) => setTimeout(resolve, ms));
    }

    /**
     * Maneja errores de geocoding con reintentos inteligentes
     */
    private handleGeocodingError = ({ userId, lat, lon }: { userId: string; lat: number; lon: number }): void => {
        const failures = this.failedRequests.get(userId) || 0;

        failures < this.MAX_RETRIES
            ? setTimeout(() => {
                this.failedRequests.set(userId, failures + 1);
                this.geocodingQueue.push({ userId, lat, lon });
                !this.isProcessingQueue && this.processGeocodingQueue();
            }, Math.pow(2, failures) * 2000)
            : (() => {
                this.loadingLocations.delete(userId);
                this.userLocations.set(userId, 'Ubicación no disponible');
                this.failedRequests.delete(userId);
            })();
    };

    /**
     * Suscribe a los observables del servicio de mapas
     */
    private subscribeToMapService(): void {
        this.mapService.currentUserRange$.pipe(takeUntil(this.destroy$)).subscribe((range) => {
            this.userRange = range;
        });

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
        this.filteredCustomers = this.customers.filter((customer) => customer.dirnombre.toLowerCase().includes(searchTerm) || customer.dirruc.toLowerCase().includes(searchTerm) || customer.dirdirec.toLowerCase().includes(searchTerm));
    }

    private getCustomersInArea(vendorCode: string, range: any): void {
        this.loadingCustomers = true;

        const requestDto: CustomerAreaRequestDto = {
            clientes: {
                tipoelementos: 0,
                codvendedor: vendorCode
            },
            zonasbusqueda: {
                latmax: range.southWest[0],
                latmin: range.northEast[0],
                lonmax: range.southWest[1],
                lonmin: range.northEast[1]
            }
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
                    setTimeout(() => this.mapService.addCustomerMarkers(customers), 200);
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

    //===============MÉTODO PARA OBTENER TODOS LOS USUARIOS===========================================//

    getAllUsers = (): void => {
        this.loading = true;
        this.userService.getAllListUser().subscribe({
            next: (users) => {
                this.users = users;
                this.filteredUsers = [...users];
                this.resetInfiniteScroll();
                this.updatePagination();
                if (this.mapInitialized) this.mapService.addUserMarkers(users);
                this.loading = false;
            },
            error: (err) => {
                console.error('Error al cargar usuarios:', err);
                this.msgService.add({ severity: 'error', summary: 'Error', detail: 'No se pudieron cargar los usuarios' });
                this.loading = false;
            }
        });
    };

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
        this.selectedGeofence = [];

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
                    const vendorData = this.findVendorByCode(response.data, vendorCode);

                    if (vendorData && vendorData.geocercas.length > 0) {
                        this.selectedVendor = vendorData;
                        this.vendorGeocercas = vendorData.geocercas;

                        this.loadGeofenceOptions();

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

    //=====MÉTODO DE REFRESH (LOADING) MAPA/DATA==============================//

    resetMapView(): void {
        this.mapService.resetMapView();
    }

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
        ].filter((option) => option.label.toLowerCase().includes(query));
    }

    searchGeofence(event: any): void {
        const query = event.query.toLowerCase();

        if (!this.selectedUser || !this.vendorGeocercas.length) {
            this.geofenceOptions = [];
            return;
        }

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

    onToggleChange() {
        if (this.geofenceEnabled) {
            if (this.vendorGeocercas.length > 0) {
                this.selectedGeofence = this.vendorGeocercas.map((geocerca) => geocerca.geoccod);
                this.onGeofencesChange({ value: this.selectedGeofence });
            }
        } else {
            this.selectedGeofence = [];
            this.mapService.clearGeocercas();

            this.msgService.add({
                severity: 'info',
                summary: 'Geocercas deshabilitadas',
                detail: 'Se ha limpiado la selección de geocercas',
                life: 2000
            });
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
        this.filterFrom = null;
        this.selectedTimeUnit = null;
        this.timeValue = null;
        this.geofenceEnabled = false;
        this.selectedGeofence = [];
        this.pedidosEnabled = false;
        this.collectionsEnabled = false;
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

        if (!this.validateFilters()) {
            return;
        }

        const filterRequest: FilterRequest = {
            usuarios: {
                tipoelementos: 0,
                usuarios: [this.selectedUser.usucod],
                buscaxzona: 0
            },
            transacciones: {
                codvendedor: this.selectedUser.usucodv,
                cobros: this.collectionsEnabled,
                pedidos: this.pedidosEnabled
            },
            lapzotiempo: {
                tipofiltro: 1,
                fechainicio: this.buildFechaInicio(),
                tipotiempo: this.selectedTimeUnit?.value ?? 4,
                valortiempo: this.timeValue ?? 4
            },
            clientes: {
                tipoelementos: this.buildClientesFilter(),
                codvendedor: this.selectedUser.usucodv
            },
            zonasbusqueda: this.buildZonaClientes()
        };
        this.loading = true;
        this.loadingCustomers = true;
        this.customerService
            .getTrackingDetails(filterRequest)
            .pipe(
                takeUntil(this.destroy$),
                finalize(() => {
                    this.loading = false;
                    this.loadingCustomers = false;
                })
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
        return new Date().toISOString();
    }

    /**
     * Construye el valor de filtro de clientes (0=todos, 1=asignado)
     */
    private buildClientesFilter(): number {
        if (this.clientesAll) return 0;
        if (this.clientesAssigned) return 1;
        return 0;
    }

    /**
     * Construye la zona de clientes basada en la geocerca o área actual
     */
    private buildZonaClientes(): ZonaBusquedaFilter {
        const bounds = this.mapService.getCurrentBounds();

        return {
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
        if (!this.pedidosEnabled && !this.collectionsEnabled) {
            this.msgService.add({
                severity: 'warn',
                summary: 'Validación',
                detail: 'Seleccione al menos un tipo de transacción'
            });
            return false;
        }
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

        if (response.ubicaciones && response.ubicaciones.length > 0) {
            this.mapService.addTrackingMarkers(response.ubicaciones);
        }
        this.loadingCustomers = false;
        if (response.clientes && response.clientes.length > 0) {
            this.customers = response.clientes;
            this.filterCustomers();
            this.mapService.addCustomerMarkers(response.clientes);
        } else {
            this.customers = [];
            this.filteredCustomers = [];
            this.mapService.clearCustomerMarkers();
        }

        if (this.collectionsEnabled) {
            this.mapService.clearChargeMarkers();
            if (response.cobros && response.cobros.length > 0) {
                this.mapService.addChargeMarkers(response.cobros);
            }
        } else {
            this.mapService.clearChargeMarkers();
        }

        if (this.pedidosEnabled) {
            this.mapService.clearOrderMarkers();
            if (response.pedidos && response.pedidos.length > 0) {
                this.mapService.addOrderMarkers(response.pedidos);
            }
        } else {
            this.mapService.clearOrderMarkers();
        }
        this.centerMapOnFilteredData(response);
    }

    /**
     * Centra el mapa en base a los datos filtrados
     */
    private centerMapOnFilteredData(response: TrackingResponse): void {
        const allCoordinates: [number, number][] = [];

        if (response.ubicaciones && response.ubicaciones.length > 0) {
            response.ubicaciones.forEach((userLocation) => {
                userLocation.ubicaciones.forEach((location) => {
                    if (location.latitud && location.longitud) {
                        allCoordinates.push([location.latitud, location.longitud]);
                    }
                });
            });
        }

        if (response.clientes && response.clientes.length > 0) {
            response.clientes.forEach((cliente) => {
                if (cliente.latitud && cliente.longitud) {
                    allCoordinates.push([cliente.latitud, cliente.longitud]);
                }
            });
        }

        if (response.cobros && response.cobros.length > 0) {
            response.cobros.forEach((cobro) => {
                if (cobro.cablat && cobro.cablon) {
                    allCoordinates.push([cobro.cablat, cobro.cablon]);
                }
            });
        }

        if (response.pedidos && response.pedidos.length > 0) {
            response.pedidos.forEach((pedido) => {
                if (pedido.pdtlat && pedido.pdtlon) {
                    allCoordinates.push([pedido.pdtlat, pedido.pdtlon]);
                }
            });
        }
        if (allCoordinates.length > 0) {
            this.mapService.fitBoundsToCoordinates(allCoordinates);
        } else if (this.selectedUser) {
            this.mapService.focusOnUser(this.selectedUser);
        }
    }
    /**
     * Valida la disponibilidad de datos en la respuesta y muestra mensajes informativos
     */
    private validateTrackingDataAvailability(response: TrackingResponse): void {
        const emptyData: string[] = [];

        if (this.pedidosEnabled) {
            if (!response.pedidos || response.pedidos.length === 0) {
                emptyData.push('Pedidos');
            }
        }

        if (this.collectionsEnabled) {
            if (!response.cobros || response.cobros.length === 0) {
                emptyData.push('Cobros');
            }
        }
        if (emptyData.length > 0) {
            this.msgService.add({
                severity: 'info',
                summary: 'Datos no disponibles',
                detail: `No se encontraron datos para: ${emptyData.join(', ')}`,
                life: 5000
            });
        }

        const hasAnyData = (response.ubicaciones?.length ?? 0) > 0 || (response.clientes?.length ?? 0) > 0 || (response.cobros?.length ?? 0) > 0 || (response.pedidos?.length ?? 0) > 0;

        if (response.clientes.length === 0) {
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
        const isNearBottom = scrollTop + clientHeight >= scrollHeight - this.scrollThreshold;
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
        this.loadInitialUsers();
    }

    /**
     * Carga los usuarios iniciales
     */
    private loadInitialUsers(): void {
        this.paginatedUsers = this.filteredUsers.slice(0, this.itemsPerPage);
        this.currentPage = 1;

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

    // Método actualizado para cargar las opciones del multiselect
    private loadGeofenceOptions(): void {
        if (!this.vendorGeocercas.length) {
            this.geofenceOptions = [];
            this.selectedGeofence = [];
            return;
        }
        this.geofenceOptions = this.vendorGeocercas.map((geocerca) => ({
            label: `${geocerca.geocnom} - ${geocerca.geocciud}`,
            value: geocerca.geoccod,
            geocerca: geocerca
        }));
        if (this.geofenceEnabled) {
            this.selectedGeofence = this.vendorGeocercas.map((geocerca) => geocerca.geoccod);
            this.onGeofencesChange({ value: this.selectedGeofence });
        } else {
            this.selectedGeofence = [];
        }
    }

    // Método para manejar cambios en la selección
    onGeofencesChange(event: any): void {
        const selectedCodes = event.value; // Array de códigos seleccionados

        const selectedGeocercasData = this.vendorGeocercas.filter((geocerca) => selectedCodes.includes(geocerca.geoccod));

        if (selectedGeocercasData.length > 0) {
            this.mapService.displayVendorGeocercas(selectedGeocercasData);

            this.msgService.add({
                severity: 'info',
                summary: 'Filtro aplicado',
                detail: `Mostrando ${selectedGeocercasData.length} de ${this.vendorGeocercas.length} geocerca${selectedGeocercasData.length === 1 ? '' : 's'}`,
                life: 2000
            });
        } else {
            this.mapService.clearGeocercas();
            this.msgService.add({
                severity: 'warn',
                summary: 'Sin filtro',
                detail: 'No hay geocercas seleccionadas para mostrar',
                life: 2000
            });
        }
    }

    //Métodos para el polling/ refresh de coordenadas en el mapa en tiempo real

    private startUserLocationPolling(): void {
        if (this.isPollingActive) return;

        this.isPollingActive = true;

        this.pollingSubscription$
            .pipe(
                startWith(0), // Ejecutar inmediatamente
                switchMap(() => this.userService.getAllListUser2(true)),
                takeUntil(this.destroy$),
                catchError((error) => {
                    console.error('Error en polling de usuarios:', error);
                    return of([]);
                })
            )
            .subscribe({
                next: (users) => {
                    this.updateUsersLocation(users);
                },
                error: (error) => {
                    console.error('Error crítico en polling:', error);
                    this.restartPolling();
                }
            });
        this.scheduleNextPoll();
    }

    private scheduleNextPoll(): void {
        if (!this.isPollingActive) return;

        setTimeout(() => {
            if (this.isPollingActive) {
                this.pollingSubscription$.next();
                this.scheduleNextPoll();
            }
        }, this.POLLING_INTERVAL);
    }

    private updateUsersLocation(users: UserDto[]): void {
        users.forEach(updatedUser => {
            const existingUserIndex = this.users.findIndex(u => u.usucod === updatedUser.usucod);
            if (existingUserIndex !== -1) {
                this.users[existingUserIndex].ubicacion = updatedUser.ubicacion;
            }
        });

        this.filteredUsers = this.filteredUsers.map(user => {
            const updatedUser = users.find(u => u.usucod === user.usucod);
            return updatedUser ? { ...user, ubicacion: updatedUser.ubicacion } : user;
        });

        if (this.mapInitialized) {
            this.mapService.updateUserMarkersLocation(users);
        }
    }
    //Controles
    stopUserLocationPolling(): void {
        this.isPollingActive = false;
        this.pollingSubscription$.complete();
    }

    restartPolling(): void {
        this.stopUserLocationPolling();
        this.pollingSubscription$ = new Subject<void>();
        setTimeout(() => this.startUserLocationPolling(), 5000); // Reiniciar en 5 segundos
    }

    pausePolling(): void {
        this.isPollingActive = false;
    }

    resumePolling(): void {
        if (!this.isPollingActive) {
            this.startUserLocationPolling();
        }
    }



    ngOnDestroy(): void {

        this.stopUserLocationPolling()

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
