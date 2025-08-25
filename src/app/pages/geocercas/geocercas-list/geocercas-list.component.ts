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
import { MapService, SearchResult } from '@/core/services/map.service';
import { map } from 'rxjs/operators';
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
    ],
    standalone: true,
    templateUrl: './geocercas-list.component.html',
    styleUrls: ['./geocercas-list.component.css']
})
export class GeocercasListComponent implements OnInit, AfterViewInit, OnDestroy {
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

    // Propiedades del mapa (delegadas al servicio)
    searchLocation: string = '';
    searchingLocation: boolean = false;
    searchResults: SearchResult[] = [];
    mapInitialized: boolean = false;

    constructor(
        private readonly userService: UserService,
        private readonly msgService: MessageService,
        private readonly mapService: MapService
    ) {}

    ngOnInit(): void {
        this.getAllUsers();
        this.subscribeToMapService();

    }

    ngAfterViewInit(): void {
        requestAnimationFrame(() => {
            this.initializeMap().then(() => {});
        });
    }

    /**
     * Suscribe a los observables del servicio de mapas
     */
    private subscribeToMapService(): void {
        // Estado de inicialización del mapa
        this.mapService.isMapInitialized$
            .pipe(takeUntil(this.destroy$))
            .subscribe(initialized => {
                this.mapInitialized = initialized;
            });
        this.mapService.isSearchingLocation$
            .pipe(takeUntil(this.destroy$))
            .subscribe(searching => {
                this.searchingLocation = searching;
            });

        this.mapService.searchResultsList$
            .pipe(takeUntil(this.destroy$))
            .subscribe(results => {
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

    ngOnDestroy(): void {
        this.destroy$.next();
        this.destroy$.complete();
        this.mapService.destroyMap();
    }
    protected readonly map = map;
}
