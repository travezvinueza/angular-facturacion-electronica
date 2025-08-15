import { UserDto } from '@/core/models/UserDto';
import { UserService } from '@/core/services/user.service';
import { CommonModule } from '@angular/common';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, ViewChild, AfterViewInit, ElementRef, OnDestroy } from '@angular/core';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { ConfirmationService, MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { DialogModule } from 'primeng/dialog';
import { IconFieldModule } from 'primeng/iconfield';
import { InputIconModule } from 'primeng/inputicon';
import { InputNumberModule } from 'primeng/inputnumber';
import { InputTextModule } from 'primeng/inputtext';
import { RippleModule } from 'primeng/ripple';
import { Table, TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { TextareaModule } from 'primeng/textarea';
import { ToolbarModule } from 'primeng/toolbar';
import { CardModule } from 'primeng/card';
import { PaginatorModule } from 'primeng/paginator';
import { SkeletonModule } from 'primeng/skeleton';
import * as L from 'leaflet';
import { Tooltip, TooltipModule } from 'primeng/tooltip';
import { CoordenadaDto, CrearGeocercaDto } from '@/core/models/GeocercaDto';
import { GeocercaService } from '@/core/services/geocerca.service';
import { AuthService } from '@/core/services/auth.service';
import { Select } from 'primeng/select';
import { ToggleSwitchModule } from 'primeng/toggleswitch';


@Component({
    selector: 'app-user-list',
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
        TooltipModule,
        Select,
        ToggleSwitchModule
    ],
    templateUrl: './user-list.component.html',
    styleUrls: ['./user-list.component.css']
})
export class UserListComponent implements OnInit, AfterViewInit, OnDestroy {
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

    // Propiedades del dialog
    userDialog: boolean = false;
    submitted: boolean = false;
    userForm!: FormGroup;

    // Mapa
    map: L.Map | null = null;

    // Buscador de ubicaciones
    searchLocation: string = '';
    searchingLocation: boolean = false;
    searchResults: any[] = [];
    searchMarker: L.Marker | null = null;

    // Creación de geocercas
    creandoGeocerca: boolean = false;
    tipoGeocerca: 'circular' | 'poligono' = 'circular';
    geocercaForm!: FormGroup;
    geocercaDialog: boolean = false;
    coordenadasGeocerca: CoordenadaDto[] = [];
    centroGeocerca: CoordenadaDto | null = null;
    radioGeocerca: number = 100; // radio en metros

    // Capas del mapa para dibujo
    dibujoLayer: L.LayerGroup | null = null;
    formaActual: L.Circle | L.Polygon | null = null;

    // Opciones para dropdowns
    tiposGeocerca = [
        { label: 'Circular', value: 'circular', icon: 'pi pi-circle' },
        { label: 'Polígono', value: 'poligono', icon: 'pi pi-stop' }
    ];

    constructor(
        private readonly formBuilder: FormBuilder,
        private readonly userService: UserService,
        private readonly geocercaService: GeocercaService,
        private readonly authService: AuthService,
        private readonly confirmationService: ConfirmationService,
        private readonly msgService: MessageService,
        private readonly http: HttpClient
    ) {}

    ngOnInit(): void {
        this.getAllUsers();
        this.initializeForm();
        this.initializeGeocercaForm();
    }

    ngAfterViewInit(): void {
        setTimeout(() => {
            this.initializeMap();
        }, 500);
    }
    // === MÉTODOS PARA INICIALIZAR FORMULARIOS ===
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

    initializeGeocercaForm(): void {
        this.geocercaForm = this.formBuilder.group({
            geocnom: ['', [Validators.required, Validators.minLength(3)]],
            geocsec: ['', [Validators.required]],
            geocdirre: ['', [Validators.required]],
            geocciud: ['Quito', [Validators.required]],
            geocprov: ['Pichincha', [Validators.required]],
            geocpais: ['Ecuador', [Validators.required]],
            geocpri: [1, [Validators.required, Validators.min(1), Validators.max(10)]],
            geocdesc: ['', [Validators.required]],
            geocact: [true]
        });
    }

    // ==================================================================


    getAllUsers(): void {
        this.loading = true;
        this.userService.getAllListUser().subscribe({
            next: (data: UserDto[]) => {
                this.users = data;
                this.filteredUsers = [...this.users];
                this.updatePagination();
                this.loading = false;
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
        // Aquí podrías agregar lógica para mostrar el usuario en el mapa
        console.log('Usuario seleccionado:', user);
    }

    openNew(): void {
        this.userForm.reset();
        this.submitted = false;
        this.userDialog = true;
    }

    hideDialog(): void {
        this.userDialog = false;
        this.submitted = false;
    }

    getEstadoText(estado: number): string {
        switch (estado) {
            case 0:
                return 'Activo';
            case 1:
                return 'Inactivo';
            case 2:
                return 'Bloqueado';
            default:
                return 'Desconocido';
        }
    }

    getEstadoSeverity(estado: number): 'success' | 'warning' | 'danger' | 'info' {
        switch (estado) {
            case 0:
                return 'success';
            case 1:
                return 'warning';
            case 2:
                return 'danger';
            default:
                return 'info';
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

            setTimeout(() => {
                this.map?.invalidateSize();
            }, 200);

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
    iniciarCreacionGeocerca(): void {
        if (!this.selectedUser) {
            this.msgService.add({
                severity: 'warn',
                summary: 'Usuario requerido',
                detail: 'Debe seleccionar un usuario antes de crear una geocerca'
            });
            return;
        }

        this.creandoGeocerca = true;
        this.coordenadasGeocerca = [];
        this.centroGeocerca = null;

        // Inicializar capa de dibujo
        if (!this.dibujoLayer) {
            this.dibujoLayer = L.layerGroup().addTo(this.map!);
        }

        // Configurar eventos del mapa
        this.configurarEventosMapa();

        this.msgService.add({
            severity: 'info',
            summary: 'Modo creación activado',
            detail: `Haga clic en el mapa para crear una geocerca ${this.tipoGeocerca}`
        });
    }

    configurarEventosMapa(): void {
        if (!this.map) return;

        if (this.tipoGeocerca === 'circular') {
            this.map.on('click', this.onMapClickCircular.bind(this));
        } else {
            this.map.on('click', this.onMapClickPoligono.bind(this));
        }
    }

    onMapClickCircular(e: L.LeafletMouseEvent): void {
        if (!this.creandoGeocerca) return;

        const { lat, lng } = e.latlng;
        this.centroGeocerca = { lat, lng };

        // Limpiar forma anterior
        if (this.formaActual && this.dibujoLayer) {
            this.dibujoLayer.removeLayer(this.formaActual);
        }

        // Crear círculo
        this.formaActual = L.circle([lat, lng], {
            radius: this.radioGeocerca,
            color: '#3b82f6',
            fillColor: '#3b82f6',
            fillOpacity: 0.2
        });

        this.dibujoLayer!.addLayer(this.formaActual);

        // Generar coordenadas del círculo (aproximación con polígono)
        this.generarCoordenadasCirculo(lat, lng, this.radioGeocerca);

        this.msgService.add({
            severity: 'success',
            summary: 'Geocerca circular creada',
            detail: 'Ajuste el radio si es necesario y proceda a guardar'
        });
    }

    onMapClickPoligono(e: L.LeafletMouseEvent): void {
        if (!this.creandoGeocerca) return;

        const { lat, lng } = e.latlng;
        this.coordenadasGeocerca.push({ lat, lng });

        // Actualizar polígono
        this.actualizarPoligono();

        this.msgService.add({
            severity: 'info',
            summary: 'Punto agregado',
            detail: `Punto ${this.coordenadasGeocerca.length} del polígono agregado`
        });
    }

    actualizarPoligono(): void {
        if (this.coordenadasGeocerca.length < 2) return;

        // Limpiar forma anterior
        if (this.formaActual && this.dibujoLayer) {
            this.dibujoLayer.removeLayer(this.formaActual);
        }

        // Crear nuevo polígono
        const latLngs = this.coordenadasGeocerca.map(coord => [coord.lat, coord.lng] as L.LatLngTuple);

        this.formaActual = L.polygon(latLngs, {
            color: '#3b82f6',
            fillColor: '#3b82f6',
            fillOpacity: 0.2
        });

        this.dibujoLayer!.addLayer(this.formaActual);

        // Calcular centro del polígono
        this.calcularCentroPoligono();
    }

    calcularCentroPoligono(): void {
        if (this.coordenadasGeocerca.length === 0) return;

        const sumLat = this.coordenadasGeocerca.reduce((sum, coord) => sum + coord.lat, 0);
        const sumLng = this.coordenadasGeocerca.reduce((sum, coord) => sum + coord.lng, 0);

        this.centroGeocerca = {
            lat: sumLat / this.coordenadasGeocerca.length,
            lng: sumLng / this.coordenadasGeocerca.length
        };
    }

    generarCoordenadasCirculo(lat: number, lng: number, radio: number): void {
        this.coordenadasGeocerca = [];
        const puntos = 32; // Número de puntos para aproximar el círculo

        for (let i = 0; i < puntos; i++) {
            const angulo = (i * 2 * Math.PI) / puntos;

            // Conversión aproximada de metros a grados
            const deltaLat = (radio / 111320) * Math.cos(angulo);
            const deltaLng = (radio / (111320 * Math.cos(lat * Math.PI / 180))) * Math.sin(angulo);

            this.coordenadasGeocerca.push({
                lat: lat + deltaLat,
                lng: lng + deltaLng
            });
        }
    }

    actualizarRadioCirculo(): void {
        if (this.tipoGeocerca === 'circular' && this.centroGeocerca && this.creandoGeocerca) {
            this.onMapClickCircular({ latlng: this.centroGeocerca } as L.LeafletMouseEvent);
        }
    }

    limpiarDibujo(): void {
        if (this.dibujoLayer) {
            this.dibujoLayer.clearLayers();
        }
        this.coordenadasGeocerca = [];
        this.centroGeocerca = null;
        this.formaActual = null;
    }

    cancelarCreacionGeocerca(): void {
        this.creandoGeocerca = false;
        this.limpiarDibujo();

        // Remover eventos del mapa
        if (this.map) {
            this.map.off('click');
        }

        this.msgService.add({
            severity: 'info',
            summary: 'Creación cancelada',
            detail: 'Se canceló la creación de la geocerca'
        });
    }

    abrirDialogoGeocerca(): void {
        if (!this.centroGeocerca || this.coordenadasGeocerca.length === 0) {
            this.msgService.add({
                severity: 'warn',
                summary: 'Geocerca incompleta',
                detail: 'Debe crear la forma en el mapa antes de continuar'
            });
            return;
        }

        this.geocercaDialog = true;
    }

    guardarGeocerca(): void {
        if (this.geocercaForm.invalid || !this.selectedUser || !this.centroGeocerca) {
            this.msgService.add({
                severity: 'error',
                summary: 'Error de validación',
                detail: 'Complete todos los campos requeridos'
            });
            return;
        }

        const formData = this.geocercaForm.value;
        const usuario = this.authService.getCurrentUser() || 'admin';
        const empresa = this.authService.getEmpresa()?.nomempresa || 'PC-ADMIN';

        // Calcular área y perímetro
        let area = 0;
        let perimetro = 0;

        if (this.tipoGeocerca === 'circular') {
            area = this.geocercaService.calcularAreaCirculo(this.radioGeocerca);
            perimetro = this.geocercaService.calcularPerimetroCirculo(this.radioGeocerca);
        } else {
            area = this.geocercaService.calcularAreaPoligono(this.coordenadasGeocerca);
            perimetro = this.geocercaService.calcularPerimetroPoligono(this.coordenadasGeocerca);
        }

        const geocercaData: CrearGeocercaDto = {
            geoccod: this.geocercaService.generarCodigoGeocerca(),
            geocnom: formData.geocnom,
            geocsec: formData.geocsec,
            geocdirre: formData.geocdirre,
            geocciud: formData.geocciud,
            geocprov: formData.geocprov,
            geocpais: formData.geocpais,
            geoclat: this.centroGeocerca.lat,
            geoclon: this.centroGeocerca.lng,
            geoccoor: this.coordenadasGeocerca,
            geocarm: area,
            geocperm: perimetro,
            geocest: 'A',
            geocact: formData.geocact,
            geocpri: formData.geocpri,
            geocdesc: formData.geocdesc,
            geocuscre: usuario,
            geoceqcre: empresa,
            vendedores: [{
                geugidv: this.selectedUser.usucod,
                geuglat: this.centroGeocerca.lat,
                geuglon: this.centroGeocerca.lng,
                geuguscre: usuario,
                geugeqcre: this.selectedUser.usucodv
            }],
            validarVendedoresDuplicados: true
        };

        this.geocercaService.crearGeocerca(geocercaData).subscribe({
            next: (response) => {
                this.msgService.add({
                    severity: 'success',
                    summary: 'Geocerca creada',
                    detail: 'La geocerca se creó exitosamente'
                });
                this.cerrarDialogoGeocerca();
                this.cancelarCreacionGeocerca();
            },
            error: (error) => {
                console.error('Error al crear geocerca:', error);
                this.msgService.add({
                    severity: 'error',
                    summary: 'Error',
                    detail: 'No se pudo crear la geocerca'
                });
            }
        });
    }

    cerrarDialogoGeocerca(): void {
        this.geocercaDialog = false;
        this.geocercaForm.reset();
    }

    onTipoGeocercaChange(): void {
        this.limpiarDibujo();
        if (this.creandoGeocerca) {
            this.configurarEventosMapa();
        }
    }


    ngOnDestroy(): void {
        if (this.searchMarker && this.map) {
            this.map.removeLayer(this.searchMarker);
            this.searchMarker = null;
        }

        if (this.dibujoLayer && this.map) {
            this.map.removeLayer(this.dibujoLayer);
            this.dibujoLayer = null;
        }

        if (this.map) {
            this.map.off();
            this.map.remove();
            this.map = null;
        }
    }
}
