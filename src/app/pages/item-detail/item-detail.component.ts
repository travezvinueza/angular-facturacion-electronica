import { AfterViewInit, Component, ElementRef, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { Accordion, AccordionContent, AccordionHeader, AccordionPanel } from 'primeng/accordion';
import { FormsModule } from '@angular/forms';
import { DatePicker } from 'primeng/datepicker';
import { ToggleSwitch } from 'primeng/toggleswitch';
import { NgClass } from '@angular/common';
import { MultiSelect } from 'primeng/multiselect';
import { MessageService, PrimeTemplate } from 'primeng/api';
import { Checkbox } from 'primeng/checkbox';
import { Button } from 'primeng/button';
import { TableModule } from 'primeng/table';
import { IconField } from 'primeng/iconfield';
import { InputIcon } from 'primeng/inputicon';
import { InputText } from 'primeng/inputtext';
import { UserDto } from '@/core/models/UserDto';
import { MapService, SearchResult } from '@/core/services/map.service';
import { Subject, takeUntil } from 'rxjs';
import { UserService } from '@/core/services/user.service';
import { HttpErrorResponse } from '@angular/common/http';
import { GeocercaDto, VendedorDto } from '@/core/models/Geocercas/VendedorDto';

@Component({
    selector: 'app-item-detail',
    imports: [Accordion, AccordionContent, FormsModule, DatePicker, ToggleSwitch, NgClass, MultiSelect, PrimeTemplate, Checkbox, Button, TableModule, IconField, InputIcon, InputText, AccordionPanel, AccordionHeader],
    templateUrl: './item-detail.component.html',
    styleUrl: './item-detail.component.scss',
    standalone: true,
    providers: [MapService]
})
export class ItemDetailComponent implements OnInit, AfterViewInit, OnDestroy {
    @ViewChild('mapContainer', { static: false }) mapContainer!: ElementRef;

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

    // Propiedades para geocercas
    vendorGeocercas: GeocercaDto[] = [];
    loadingGeocercas: boolean = false;
    selectedVendor: VendedorDto | null = null;

    // Propiedades del mapa (delegadas al servicio)
    searchLocation: string = '';
    searchingLocation: boolean = false;
    searchResults: SearchResult[] = [];
    mapInitialized: boolean = false;
    loadingMap: boolean = false;

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

    // Propiedades para el loading
    loadingFilters: boolean = false;

    constructor(
        private readonly userService: UserService,
        private readonly msgService: MessageService,
        private readonly mapService: MapService
    ) {}

    //region Lifecycle Hooks

    ngOnInit(): void {
        this.getAllUsers();
        this.subscribeToMapService();
    }

    ngAfterViewInit(): void {
        requestAnimationFrame(() => {
            this.initializeMap().then(() => {});
        });
    }
    ngOnDestroy(): void {
        this.destroy$.next();
        this.destroy$.complete();
        this.mapService.destroyMap();
    }

    /**
     * Suscribe a los observables del servicio de mapas
     */
    private subscribeToMapService(): void {
        // Estado de inicialización del mapa
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

    getAllUsers(): void {
        this.loading = true;
        this.userService.getAllListUser().subscribe({
            next: (data: UserDto[]) => {
                this.users = data;
                this.filteredUsers = [...this.users];
                this.updatePagination();
                this.loading = false;

                // Si el mapa está inicializado, agregar marcadores
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



    /*
     * Obtiene el número de filtros activos
     */
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


    onSearch(event: Event): void {
        const value = (event.target as HTMLInputElement).value.toLowerCase();
        this.filteredUsers = this.users.filter((user) => user.usunombre.toLowerCase().includes(value) || user.usucod.toLowerCase().includes(value) || user.usuemail.toLowerCase().includes(value));
        this.first = 0;
        this.updatePagination();
    }



    updatePagination(): void {
        const start = this.first;
        const end = start + this.itemsPerPage;
        this.paginatedUsers = this.filteredUsers.slice(start, end);
    }

    selectUser(user: UserDto): void {
        this.selectedUser = user;
        this.mapService.focusOnUser(user);
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

    resetMapView(): void {
        this.mapService.resetMapView();
    }

    refreshData(): void {
        this.loading = true;
        this.selectedUser = null;
        this.getAllUsers();
        this.resetMapView();
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


}
