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
import { CustomerResponseDto } from '@/core/models/CustomerResponseDto';
import { CustomerService } from '@/core/services/customer.service';
import { CustomerAreaRequestDto } from '@/core/models/CustomerAreaRequestDto';
import { GeocercaDto, VendedorDto, VendedoresQueryParams, VendedoresResponse } from '@/core/models/VendedorDto';
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
        Drawer
    ],
    standalone: true,
    templateUrl: './geocercas-list.component.html',
    styleUrls: ['./geocercas-list.component.css']
})
export class GeocercasListComponent implements OnInit, AfterViewInit, OnDestroy {
    @ViewChild('mapContainer', { static: false }) mapContainer!: ElementRef;


    // Propiedades para geocercas
    vendorGeocercas: GeocercaDto[] = [];
    loadingGeocercas: boolean = false;
    showGeocercasDrawer: boolean = false;
    selectedVendor: VendedorDto | null = null;

    // Propiedades de customers
    customers: CustomerResponseDto[] = [];
    loadingCustomers: boolean = false;

    // Propiedades de búsqueda de customers
    customerSearchTerm: string = '';
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

    // Nuevas propiedades para el drawerRRR
    showRangeDrawer: boolean = false;
    userRange: RangeDisplayInfo | null = null;
    showRangeDialog: boolean = false;
    defaultRadius: number = 1000;
    customRadius: number = 1000;
    showRangeInfo: boolean = false;

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
                zoom: 13,
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

            if (range) {
                this.showRangeDrawer = true;
                this.showRangeNotification(range);
            } else {
                this.showRangeDrawer = false;
            }
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

    /**
     * Centra el mapa en un cliente específico
     */
    focusCustomerOnMap(customer: CustomerResponseDto): void {
        this.mapService.focusOnCustomer(customer);

        this.msgService.add({
            severity: 'info',
            summary: 'Cliente localizado',
            detail: `Mapa centrado en ${customer.dirnombre}`,
            life: 2000
        });
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
        this.customerService.getCustomersByVendorAndArea(requestDto)
            .pipe(takeUntil(this.destroy$))
            .subscribe({
                next: (customers: CustomerResponseDto[]) => {
                    this.customers = customers;
                    this.filteredCustomers = [...customers];
                    this.loadingCustomers = false;
                    setTimeout(() => {
                        this.mapService.addCustomerMarkers(customers);
                    }, 200);
                    const assignedCount = customers.filter(c => c.asignado).length;


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
    //=============================================================================================//



    //===============MÉTODO PARA OBTENER TODOS LOS USERS===========================================//

    getAllUsers(): void {
        this.loading = true;
        this.userService.getAllListUser().subscribe({
            next: (data: UserDto[]) => {
                this.users = data;
                this.filteredUsers = [...this.users];
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

        this.userService.getVendedoresConGeocercas(params)
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
                        this.showGeocercasDrawer = true;

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
        return vendors.find(vendor =>
            vendor.codigoVendedor === vendorCode ||
            vendor.codigoVendedorSecundario === vendorCode
        ) || null;
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
    openRangeConfigDialog(): void {
        if (this.selectedUser) {
            this.customRadius = this.defaultRadius;
            this.showRangeDialog = true;
        } else {
            this.msgService.add({
                severity: 'warn',
                summary: 'Sin selección',
                detail: 'Selecciona un usuario primero',
                life: 3000
            });
        }
    }

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

    toggleRangeDrawer(): void {
        if (this.hasUserRange) {
            this.showRangeDrawer = !this.showRangeDrawer;
        } else {
            this.msgService.add({
                severity: 'warn',
                summary: 'Sin rango',
                detail: 'Selecciona un usuario para ver su rango',
                life: 3000
            });
        }
    }
    get hasUserRange(): boolean {
        return this.userRange !== null;
    }

    get rangeRadiusText(): string {
        return this.userRange ? `${this.userRange.range.radius}m` : '';
    }

    clearUserRange(): void {
        this.mapService.clearUserRange();
        this.mapService.clearCustomerMarkers();
        this.userRange = null;
        this.customers = [];
        this.filteredCustomers = [];
        this.customerSearchTerm = '';
        this.showRangeInfo = false;
    }

    async copyRangeToClipboard(): Promise<void> {
        if (!this.userRange) return;

        const { user, range } = this.userRange;
        const text = `Usuario: ${user.usunombre} (${user.usucod})
            Centro: ${range.center[0].toFixed(6)}, ${range.center[1].toFixed(6)}
            Superior Derecho: ${range.northEast[0].toFixed(6)}, ${range.northEast[1].toFixed(6)}
            Inferior Izquierdo: ${range.southWest[0].toFixed(6)}, ${range.southWest[1].toFixed(6)}
            Radio: ${range.radius} metros`;

        try {
            await navigator.clipboard.writeText(text);
            this.msgService.add({
                severity: 'success',
                summary: 'Copiado',
                detail: 'Coordenadas copiadas al portapapeles',
                life: 2000
            });
        } catch (error) {
            console.error('Error al copiar:', error);
            this.msgService.add({
                severity: 'error',
                summary: 'Error',
                detail: 'No se pudo copiar al portapapeles'
            });
        }
    }

    private showRangeNotification(rangeInfo: RangeDisplayInfo): void {
        const { user, range } = rangeInfo;

        this.msgService.add({
            severity: 'info',
            summary: `Rango de ${user.usunombre}`,
            detail: `Radio: ${range.radius}m | Superior: ${range.northEast[0].toFixed(4)}, ${range.northEast[1].toFixed(4)} | Inferior: ${range.southWest[0].toFixed(4)}, ${range.southWest[1].toFixed(4)}`,
            life: 3000
        });
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
    ngOnDestroy(): void {
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
