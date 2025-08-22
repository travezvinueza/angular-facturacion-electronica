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
import { UserDto } from '@/core/models/UserDto';
import * as L from 'leaflet';
import 'leaflet.markercluster';
import { UserService } from '@/core/services/user.service';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';

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

    // Propiedades de usuarios
    users: UserDto[] = [];
    filteredUsers: UserDto[] = [];
    paginatedUsers: UserDto[] = [];
    selectedUser: UserDto | null = null;
    loading: boolean = true;

    // Propiedades de paginación
    first: number = 0;
    itemsPerPage: number = 5; // Cambiado a 5 slots

    userForm!: FormGroup;

    // Mapa
    map: L.Map | null = null;

    // Buscador de ubicaciones
    searchLocation: string = '';
    searchingLocation: boolean = false;
    userMarkers: Map<string, L.Marker> = new Map();
    markerClusterGroup: L.MarkerClusterGroup | null = null;
    searchResults: any[] = [];
    searchMarker: L.Marker | null = null;

    constructor(
        private readonly formBuilder: FormBuilder,
        private readonly userService: UserService,
        private readonly msgService: MessageService,
        private readonly http: HttpClient
    ) {}

    ngOnInit(): void {
        this.getAllUsers();
        this.initializeForm();

    }

    ngAfterViewInit(): void {
        requestAnimationFrame(() => {
            this.initializeMap();
        });
    }

    initializeForm(): void {
        this.userForm = this.formBuilder.group({
            usucod: ['', [Validators.required]],
            usunombre: ['', [Validators.required]],
            usuemail: ['', [Validators.required, Validators.email]],
            usuestado: [0, [Validators.required]],
            usuapp: [false],
            usuwebapp: [false],
            usucodv: ['', [Validators.required]],
            usugeol: [false]
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

        if (user.ubicacion && this.map) {
            this.map.setView(
                [user.ubicacion.geublat, user.ubicacion.geublon],
                15
            );

            const marker = this.userMarkers.get(user.usucod);
            if (marker) {
                marker.openPopup();
            }
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

        // Usar API de Nominatim de OpenStreetMap para geocodificación
        const query = encodeURIComponent(this.searchLocation.trim());
        const url = `https://nominatim.openstreetmap.org/search?format=json&q=${query}&limit=5&countrycodes=ec&addressdetails=1`;

        this.http.get<any[]>(url).subscribe({
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

    selectSearchResult(result: any): void {
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

    addUserMarkersToMap(): void {
        if (!this.map || !this.markerClusterGroup) return;

        this.markerClusterGroup.clearLayers();
        this.userMarkers.clear();

        this.users.forEach(user => {
            if (user.ubicacion && user.ubicacion.geublat && user.ubicacion.geublon) {
                const marker = L.marker([user.ubicacion.geublat, user.ubicacion.geublon]);

                const popupContent = `
                <div class="p-2">
                    <p class="font-semibold mb-1 text-sm">${user.usunombre}</p>
                    <p class="text-sm mb-1">${user.usucod} • ${user.usucodv}</p>
                    <p class="text-xs text-gray-500">
                        Última ubicación: ${new Date(user.ubicacion.geubfech).toLocaleString('es-EC')}
                    </p>
                </div> `;
                marker.bindPopup(popupContent);
                this.userMarkers.set(user.usucod, marker);

                if (this.markerClusterGroup) {
                    this.markerClusterGroup.addLayer(marker);
                }
            }
        });
    }

    resetMapView(): void {
        if (!this.map) return;

        this.map.setView([-0.2298, -78.5249], 13);
        this.clearLocationSearch();

        this.msgService.add({
            severity: 'info',
            summary: 'Vista restablecida',
            detail: 'El mapa volvió a la vista inicial'
        });
    }

    ngOnDestroy(): void {
        if (this.searchMarker && this.map) {
            this.map.removeLayer(this.searchMarker);
            this.searchMarker = null;
        }

        if (this.map) {
            this.map.remove();
            this.map = null;
        }
    }
}
