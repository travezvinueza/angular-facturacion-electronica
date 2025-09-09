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
import { HttpErrorResponse } from '@angular/common/http';
import { Subject, takeUntil } from 'rxjs';
import { UserDto } from '@/core/models/UserDto';
import { UserService } from '@/core/services/user.service';
import { MapService, RangeDisplayInfo, SearchResult } from '@/core/services/map.service';
import * as L from 'leaflet';
import { Drawer } from 'primeng/drawer';
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
    @ViewChild('mapContainer') mapContainer!: ElementRef;
    @ViewChild('scrollContainer') scrollContainer!: ElementRef;


    // Para scroll infinito
    loadingMore: boolean = false;
    hasReachedEnd: boolean = false;
    currentPage: number = 0;
    allUsers: UserDto[] = []; // Mantener usuarios originales
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

    // Opciones para autoComplete
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
    itemsPerPage: number = 5;

    // Propiedades del mapa (delegadas al servicio)
    searchLocation: string = '';
    searchingLocation: boolean = false;
    searchResults: SearchResult[] = [];
    mapInitialized: boolean = false;
    map: L.Map | null = null;

    // Nuevas propiedades para el drawer
    openFilterDrawer: boolean = false;
    showRangeDrawer: boolean = false;
    userRange: RangeDisplayInfo | null = null;
    showRangeDialog: boolean = false;
    defaultRadius: number = 1000;
    customRadius: number = 1000;


    constructor(
        private readonly userService: UserService,
        private readonly msgService: MessageService,
        private readonly mapService: MapService,
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
        try {
            await this.mapService.initializeMap(this.mapContainer, {
                center: [-0.2298, -78.5249],
                zoom: 20,
                defaultLocation: 'Quito, Ecuador'
            });
            if (!this.loading && this.users.length > 0) {
                this.mapService.addUserMarkers(this.users);
            }
        } catch (error) {
            console.error('Error al inicializar el mapa:', error);
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

        this.mapService.isMapInitialized$.pipe(takeUntil(this.destroy$)).subscribe((initialized) => {
            this.mapInitialized = initialized;
        });
        this.mapService.isSearchingLocation$.pipe(takeUntil(this.destroy$)).subscribe((searching) => {
            this.searchingLocation = searching;
        });

        this.mapService.searchResultsList$.pipe(takeUntil(this.destroy$)).subscribe((results) => {
            this.searchResults = results;
        });
    }

    //====MÉTODO PARA OBTENER LOS CUSTOMERS POR VENDEDOR Y ÁREA====//
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

    //===============MÉTODO PARA OBTENER TODOS LOS USERS===========================================//

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
    /**
     * Aplica el radio personalizado
     */
    applyCustomRadius(): void {
        if (this.selectedUser && this.customRadius > 0) {
            this.defaultRadius = this.customRadius;

            // Recalcular el rango con el nuevo radio
            const rangeInfo = this.mapService.focusOnUserWithRange(this.selectedUser, this.customRadius);

            this.showRangeDialog = false;

            if (rangeInfo) {
                // Mantener el drawer abierto para mostrar los cambios
                this.showRangeDrawer = true;

                this.msgService.add({
                    severity: 'success',
                    summary: 'Radio actualizado',
                    detail: `Nuevo radio aplicado: ${this.customRadius} metros`,
                    life: 4000
                });
            }
        }
    }
    cancelRangeConfig(): void {
        this.showRangeDialog = false;
        this.customRadius = this.defaultRadius;
    }
    get hasUserRange(): boolean {
        return this.userRange !== null;
    }

    //=============================================================================================//

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

    //=====MÉTODO DE REFRESH (LOADING) MAPA/DATA================================================================//
    resetMapView(): void {
        this.selectedUser = null;
        this.userRange = null;
        this.mapService.clearGeocercas();
        this.selectedVendor = null;
        this.mapService.clearCustomerMarkers();
        this.showRangeDrawer = false;
        this.showRangeDialog = false;
    }
    refreshData(): void {
        this.loading = true;
        this.getAllUsers();
        this.resetMapView();
        this.customers = [];

        this.msgService.add({
            severity: 'info',
            summary: 'Datos actualizados',
            detail: 'La vista del mapa y usuarios ha sido restablecida',
            life: 1000
        });
    }
    //=============================================================================================//

    // Métodos para autoComplete
    searchTimeUnit(event: any): void {
        const query = event.query.toLowerCase();
        const allTimeUnits = [
            { label: 'Horas', value: 'Horas' },
            { label: 'Minutos', value: 'Minutos' },
            { label: 'Días', value: 'Días' }
        ];

        this.timeUnitOptions = allTimeUnits.filter((option) => option.label.toLowerCase().includes(query));
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

    getActiveFiltersCount(): number {
        let count = 0;
        if (this.filterFrom) count++;
        if (this.geofenceEnabled && this.selectedGeofence) count++;
        if (this.pedidosEnabled) count++;
        if (this.collectionsEnabled) count++;
        if (this.timeValue && this.selectedTimeUnit) count++;
        return count;
    }

    clearFilters(): void {
        this.filterFrom = null;
        this.geofenceEnabled = false;
        this.selectedGeofence = null;
        this.pedidosEnabled = false;
        this.collectionsEnabled = false;
        this.timeValue = null;
        this.selectedTimeUnit = null;
    }

    applyFilters(): void {
        // Tu lógica de filtrado
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

    /**
     * Scroll suave al inicio (útil después de filtros)
     */
    scrollToTop(): void {
        if (this.scrollContainer?.nativeElement) {
            this.scrollContainer.nativeElement.scrollTo({
                top: 0,
                behavior: 'smooth'
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
        this.userRange = null;
        this.customers = [];
        this.vendorGeocercas = [];
        this.selectedUser = null;
        this.selectedVendor = null;
    }
}
