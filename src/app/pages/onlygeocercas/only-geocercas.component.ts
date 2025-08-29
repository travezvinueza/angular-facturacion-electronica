import { AfterViewInit, Component, ElementRef, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TableModule } from 'primeng/table';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { InputTextModule } from 'primeng/inputtext';
import { ButtonModule } from 'primeng/button';
import { RippleModule } from 'primeng/ripple';
import { ToolbarModule } from 'primeng/toolbar';
import { TextareaModule } from 'primeng/textarea';
import { InputNumberModule } from 'primeng/inputnumber';
import { DialogModule } from 'primeng/dialog';
import { TagModule } from 'primeng/tag';
import { InputIconModule } from 'primeng/inputicon';
import { IconFieldModule } from 'primeng/iconfield';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { CardModule } from 'primeng/card';
import { PaginatorModule } from 'primeng/paginator';
import { SkeletonModule } from 'primeng/skeleton';
import { Tooltip } from 'primeng/tooltip';
import { Subject, takeUntil } from 'rxjs';
import { MapService, SearchResult } from '@/core/services/map.service';
import { GeocercaService } from '@/core/services/geocerca.service';
import { AuthService } from '@/core/services/auth.service';
import { MessageService } from 'primeng/api';
import { HttpErrorResponse } from '@angular/common/http';
import { GeocercaValidationResponse, GeofenceDto } from '@/core/models/Geocercas/GeocercaValidationResponseDto';
import * as L from 'leaflet';

@Component({
  selector: 'app-onlygeocercas',
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
  templateUrl: './only-geocercas.component.html',
  styleUrl: './only-geocercas.component.css'
})
export class OnlyGeocercasComponent implements OnInit, AfterViewInit, OnDestroy {
    @ViewChild('mapContainer', { static: false }) mapContainer!: ElementRef;
    // Subject para manejo de subscripciones
    private destroy$ = new Subject<void>();


    // Mapa
    map: L.Map | null = null;
    // Propiedades de geocercas
    geocercas: GeofenceDto[] = [];
    filteredGeocercas: GeofenceDto[] = [];
    paginatedGeocercas: GeofenceDto[] = [];
    selectedGeocerca: GeofenceDto | null = null;
    loading: boolean = true;

    // Propiedades de paginación
    first: number = 0;
    itemsPerPage: number = 4;

    // Propiedades de empresa
    enterpriseName: string = '';

    // Propiedades del mapa (delegadas al servicio)
    searchLocation: string = '';
    searchingLocation: boolean = false;
    searchResults: SearchResult[] = [];
    mapInitialized: boolean = false;

    constructor(
        private readonly geocercaService: GeocercaService,
        private readonly authService: AuthService,
        private readonly msgService: MessageService,
        private readonly mapService: MapService
    ) {}

    ngOnInit(): void {
        this.initializeEnterpriseName();
        this.getAllGeocercas();
        this.subscribeToMapService();
    }

    ngAfterViewInit(): void {
        requestAnimationFrame(() => {
            this.initializeMap().then(() => {});
        });
    }

    /**
     * Inicializa el nombre de la empresa desde el auth service
     */
    private initializeEnterpriseName(): void {
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

    getAllGeocercas(): void {
        if (!this.enterpriseName) {
            this.loading = false;
            return;
        }

        this.loading = true;
        this.geocercaService.getOnlyGeocercasByEnterpriseName(this.enterpriseName, 1, 50, true)
            .subscribe({
                next: (response: GeocercaValidationResponse) => {
                    if (response.success && response.data?.data) {
                        this.geocercas = response.data.data;
                        this.filteredGeocercas = [...this.geocercas];
                        this.updatePagination();
                        this.loading = false;


                    } else {
                        this.loading = false;
                        this.msgService.add({
                            severity: 'warn',
                            summary: 'Advertencia',
                            detail: response.message || 'No se encontraron geocercas'
                        });
                    }
                },
                error: (error: HttpErrorResponse) => {
                    console.error('Error al cargar geocercas:', error);
                    this.loading = false;
                    this.msgService.add({
                        severity: 'error',
                        summary: 'Error',
                        detail: 'No se pudieron cargar las geocercas'
                    });
                }
            });
    }

    onSearch(event: Event): void {
        const value = (event.target as HTMLInputElement).value.toLowerCase();
        this.filteredGeocercas = this.geocercas.filter((geocerca) =>
            geocerca.geocnom.toLowerCase().includes(value) ||
            geocerca.geoccod.toLowerCase().includes(value) ||
            geocerca.geocsec.toLowerCase().includes(value) ||
            geocerca.geocciud.toLowerCase().includes(value) ||
            geocerca.geocprov.toLowerCase().includes(value)
        );
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
        this.paginatedGeocercas = this.filteredGeocercas.slice(start, end);
    }

    selectGeocerca(geocerca: GeofenceDto): void {
        this.selectedGeocerca = geocerca;
        this.mapService.focusOnGeocerca(geocerca);
        this.mapService.addGeocercaMarkers([geocerca]);
    }

    async initializeMap(): Promise<void> {
        try {
            await this.mapService.initializeMap(this.mapContainer, {
                center: [-0.2298, -78.5249],
                zoom: 13,
                defaultLocation: 'Quito, Ecuador',
            });

            if (!this.loading && this.geocercas.length > 0) {
                this.mapService.addGeocercaMarkers(this.geocercas);
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
        this.selectedGeocerca = null;
        this.getAllGeocercas();
        this.resetMapView();
    }

    getGeocercaStatusSeverity(geocerca: GeofenceDto): string {
        return geocerca.geocact ? 'success' : 'danger';
    }

    getGeocercaStatusText(geocerca: GeofenceDto): string {
        return geocerca.geocact ? 'Activa' : 'Inactiva';
    }

    formatArea(area: number): string {
        if (area >= 1000000) {
            return `${(area / 1000000).toFixed(2)} km²`;
        }
        return `${area.toLocaleString()} m²`;
    }

    formatPerimeter(perimeter: number): string {
        if (perimeter >= 1000) {
            return `${(perimeter / 1000).toFixed(2)} km`;
        }
        return `${perimeter} m`;
    }

    ngOnDestroy(): void {
        this.destroy$.next();
        this.destroy$.complete();
        this.mapService.destroyMap();
    }

}
