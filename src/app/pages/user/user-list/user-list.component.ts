import { UserDto } from '@/core/models/UserDto';
import { UserService } from '@/core/services/user.service';
import { GeocercaService } from '@/core/services/geocerca.service';
import { CrearGeocercaDto, CoordenadaDto } from '@/core/models/Geocercas/GeocercaDto';
import { AuthService } from '@/core/services/auth.service';
import { CommonModule } from '@angular/common';
import { HttpErrorResponse, HttpClient } from '@angular/common/http';
import { Component, OnInit, ViewChild, AfterViewInit, ElementRef, OnDestroy } from '@angular/core';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { DialogModule } from 'primeng/dialog';
import { IconFieldModule } from 'primeng/iconfield';
import { InputIconModule } from 'primeng/inputicon';
import { InputNumberModule } from 'primeng/inputnumber';
import { InputTextModule } from 'primeng/inputtext';
import { RippleModule } from 'primeng/ripple';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { TextareaModule } from 'primeng/textarea';
import { ToolbarModule } from 'primeng/toolbar';
import { CardModule } from 'primeng/card';
import { PaginatorModule } from 'primeng/paginator';
import { SkeletonModule } from 'primeng/skeleton';
import { TooltipModule } from 'primeng/tooltip';
import { SelectModule } from 'primeng/select';
import { ToggleSwitchModule } from 'primeng/toggleswitch';
import { SliderModule } from 'primeng/slider';
import * as L from 'leaflet';
import 'leaflet.markercluster';
import { Canton, Parroquia, Provincia } from '@/core/models/ProvinciaDto';
import { AutoComplete } from 'primeng/autocomplete';
import { ProvinceService } from '@/core/services/province.service';
import { debounceTime, distinctUntilChanged, Subject, takeUntil } from 'rxjs';
import { GeocercaValidationResponse } from '@/core/models/Geocercas/GeocercaValidationResponseDto';

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
        SelectModule,
        ToggleSwitchModule,
        SliderModule,
        AutoComplete
    ],
    templateUrl: './user-list.component.html',
    styleUrls: ['./user-list.component.css']
})
export class UserListComponent implements OnInit, AfterViewInit, OnDestroy {
    @ViewChild('mapContainer', { static: false }) mapContainer!: ElementRef;


    validatingCode: boolean = false;
    codeValidationResult: 'valid' | 'invalid' | 'pending' | null = null;
    codeValidationMessage: string = '';
    private codeValidationSubject = new Subject<string>();
    private destroy$ = new Subject<void>();


    // Propiedades para AutoComplete de provincias
    cantonesList: Canton[] = [];
    parroquiasList: Parroquia[] = [];

    // Propiedades para las sugerencias filtradas
    provinciasFiltradas: Provincia[] = [];
    ciudadesFiltradas: Canton[] = [];
    sectoresFiltrados: Parroquia[] = [];

    // Propiedades para elementos seleccionados
    provinciaSeleccionada: Provincia | null = null;
    ciudadSeleccionada: Canton | null = null;
    sectorSeleccionado: Parroquia | null = null;

    // Propiedades de usuarios
    users: UserDto[] = [];
    filteredUsers: UserDto[] = [];
    paginatedUsers: UserDto[] = [];
    selectedUser: UserDto | null = null;
    loading: boolean = true;

    // Propiedades de paginación
    first: number = 0;
    itemsPerPage: number = 5;

    // Propiedades del dialog
    userForm!: FormGroup;

    // Mapa
    map: L.Map | null = null;
// Buscador de ubicaciones
    userMarkers: Map<string, L.Marker> = new Map();
    markerClusterGroup: L.MarkerClusterGroup | null = null;
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
    radioGeocerca: number = 200;

    // Capas del mapa para dibujo
    dibujoLayer: L.LayerGroup | null = null;
    formaActual: L.Circle | L.Polygon | null = null;
    marcadoresPuntos: L.Marker[] = [];
    lineasTemporales: L.Polyline[] = [];

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
        private readonly msgService: MessageService,
        private readonly http: HttpClient,
        private provinceService: ProvinceService

    ) {}

    // =============================== METODOS DE INICIALIZACION =================================

    ngOnInit(): void {
        this.getAllUsers();
        this.initializeForm();
        this.initializeGeocercaForm();
        this.inicializarProvincias();
        this.setupCodeValidation();
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
            geoccod: ['', [Validators.required, Validators.minLength(3)]],
            geocnom: ['', [Validators.required, Validators.minLength(3)]],
            geocsec: ['', [Validators.required]],
            geocdirre: ['', [Validators.required]],
            geocciud: ['', [Validators.required]],
            geocprov: ['', [Validators.required]],
            geocpais: ['ECUADOR', [Validators.required]],
            geocpri: [5, [Validators.required, Validators.min(1), Validators.max(10)]],
            geocdesc: ['', [Validators.required]],
            geocact: [true]
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
                zoom: 13,
                zoomControl: false
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

    //================================================================================


    //MÉTODOS PRIVADOS//
    private setupCodeValidation(): void {
        // Configurar debounce para validación de código
        this.codeValidationSubject
            .pipe(
                debounceTime(500), // Esperar 500ms después de que el usuario deje de escribir
                distinctUntilChanged(),
                takeUntil(this.destroy$)
            )
            .subscribe(code => {
                if (code && code.length >= 3) {
                    this.validateGeocercaCode(code);
                } else {
                    this.resetCodeValidation();
                }
            });

        // Suscribirse a cambios en el campo de código
        this.geocercaForm.get('geoccod')?.valueChanges
            .pipe(takeUntil(this.destroy$))
            .subscribe(value => {
                if (value) {
                    this.codeValidationResult = 'pending';
                    this.codeValidationSubject.next(value);
                } else {
                    this.resetCodeValidation();
                }
            });
    }
    private validateGeocercaCode(code: string): void {
        this.validatingCode = true;
        this.codeValidationResult = 'pending';

        this.geocercaService.validarCodigoGeocerca(code)
            .pipe(takeUntil(this.destroy$))
            .subscribe({
                next: (response: any) => {
                    // Si llega aquí, el código está disponible (respuesta 200)
                    this.validatingCode = false;
                    this.codeValidationResult = 'valid';
                    this.codeValidationMessage = 'Código disponible';
                },
                error: (error: HttpErrorResponse) => {
                    this.validatingCode = false;

                    // Verificar si es un error 400 (código ya existe)
                    if (error.status === 400 && error.error) {
                        const errorResponse: GeocercaValidationResponse = error.error;

                        // Verificar si el error es específicamente por código duplicado
                        if (errorResponse.errorCode === 'BAD_REQUEST' &&
                            errorResponse.message?.includes('ya existe')) {

                            this.codeValidationResult = 'invalid';
                            this.codeValidationMessage = this.extractCodeExistsMessage(errorResponse.message);
                        } else {
                            // Otro tipo de error 400
                            this.codeValidationResult = 'invalid';
                            this.codeValidationMessage = errorResponse.message || 'Código inválido';
                        }
                    } else {
                        // Error de conexión o servidor
                        console.error('Error validando código:', error);
                        this.codeValidationResult = 'invalid';
                        this.codeValidationMessage = 'Error al validar el código. Intente nuevamente.';
                    }
                }
            });
    }

    private extractCodeExistsMessage(fullMessage: string): string {


        const match = fullMessage.match(/'([^']+)'/);
        if (match) {
            const code = match[1];
            return `Código '${code}' ya está en uso`;
        }

        return 'Este código ya está en uso';
    }

    private resetCodeValidation(): void {
        this.validatingCode = false;
        this.codeValidationResult = null;
        this.codeValidationMessage = '';
    }

    getCodeInputClass(): string {
        const baseClass = 'w-full';

        if (this.codeValidationResult === 'valid') {
            return `${baseClass} border-green-300 focus:border-green-500 focus:ring-green-200`;
        } else if (this.codeValidationResult === 'invalid') {
            return `${baseClass} border-red-300 focus:border-red-500 focus:ring-red-200`;
        }

        return baseClass;
    }

    getValidationMessageClass(): string {
        if (this.codeValidationResult === 'valid') {
            return 'text-xs text-green-600 flex items-center gap-1';
        } else if (this.codeValidationResult === 'invalid') {
            return 'text-xs text-red-600 flex items-center gap-1';
        }

        return 'text-xs text-surface-500';
    }





    //FUNCIONES PARA OBTENER LOS USUARIOS/MANEJO DEL PANEL IZQUIERDO EN EL COMPONENTE

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

    deshacerUltimoPunto(): void {
        if (this.coordenadasGeocerca.length === 0) return;

        this.coordenadasGeocerca.pop();

        if (this.marcadoresPuntos.length > 0) {
            const ultimoMarcador = this.marcadoresPuntos.pop();
            if (ultimoMarcador && this.dibujoLayer) {
                this.dibujoLayer.removeLayer(ultimoMarcador);
            }
        }

        if (this.formaActual && this.dibujoLayer) {
            this.dibujoLayer.removeLayer(this.formaActual);
            this.formaActual = null;
        }

        this.lineasTemporales.forEach((linea) => {
            if (this.dibujoLayer) {
                this.dibujoLayer.removeLayer(linea);
            }
        });
        this.lineasTemporales = [];

        if (this.coordenadasGeocerca.length >= 2) {
            this.actualizarPoligono();
        } else if (this.coordenadasGeocerca.length === 0) {
            this.centroGeocerca = null;
        }

        this.msgService.add({
            severity: 'info',
            summary: 'Punto eliminado',
            detail: `Último punto eliminado. Puntos restantes: ${this.coordenadasGeocerca.length}`
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
            this.map.setView([user.ubicacion.geublat, user.ubicacion.geublon], 15);

            const marker = this.userMarkers.get(user.usucod);
            if (marker) {
                marker.openPopup();
            }
        }

        this.msgService.add({
            severity: 'info',
            summary: 'Usuario seleccionado',
            detail: `${user.usunombre} seleccionado para geocercas`
        });
    }
    //============================================================================================


    // FUNCIONES PARA LA CONFIGURACION DEL MAPA Y LOS MARCADORES DE LOS USUARIOS

    configurarEventosMapa(): void {
        if (!this.map) return;

        this.map.off('click');

        setTimeout(() => {
            if (this.tipoGeocerca === 'circular') {
                console.log('Configurando eventos para CÍRCULO');
                this.map!.on('click', this.onMapClickCircular.bind(this));
            } else {
                console.log('Configurando eventos para POLÍGONO');
                this.map!.on('click', this.onMapClickPoligono.bind(this));
            }
        }, 100);
    }

    onMapClickCircular(e: L.LeafletMouseEvent): void {
        if (!this.creandoGeocerca) return;

        const { lat, lng } = e.latlng;
        this.centroGeocerca = { lat, lng };

        if (this.formaActual && this.dibujoLayer) {
            this.dibujoLayer.removeLayer(this.formaActual);
        }

        this.formaActual = L.circle([lat, lng], {
            radius: this.radioGeocerca,
            color: '#3b82f6',
            fillColor: '#3b82f6',
            fillOpacity: 0.2
        });

        this.dibujoLayer!.addLayer(this.formaActual);
        this.generarCoordenadasCirculo(lat, lng, this.radioGeocerca);

        this.msgService.add({
            severity: 'success',
            summary: 'Geocerca circular creada',
            detail: 'Ajuste el radio si es necesario y proceda a guardar'
        });
    }

    onMapClickPoligono(e: L.LeafletMouseEvent): void {
        const { lat, lng } = e.latlng;
        this.coordenadasGeocerca.push({ lat, lng });
        this.agregarMarcadorPunto(lat, lng, this.coordenadasGeocerca.length);
        this.actualizarPoligono();

        this.msgService.add({
            severity: 'info',
            summary: `Punto ${this.coordenadasGeocerca.length} agregado`,
            detail: this.coordenadasGeocerca.length >= 3 ? 'Ya puede continuar o agregar más puntos' : `Necesita ${3 - this.coordenadasGeocerca.length} puntos más`
        });
    }

    agregarMarcadorPunto(lat: number, lng: number, numero: number): void {
        if (!this.dibujoLayer) return;

        const iconoNumero = L.divIcon({
            className: 'numero-punto-custom',
            iconSize: [30, 30],
            html: `<div style="
            background-color: #8b5cf6;
            color: white;
            width: 30px;
            height: 30px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            border: 3px solid white;
            box-shadow: 0 2px 6px rgba(0,0,0,0.3);
            font-weight: bold;
            font-size: 14px;
            box-sizing: border-box;
            cursor: move;
        ">${numero}</div>`,
            iconAnchor: [15, 15]
        });

        const marcador = L.marker([lat, lng], {
            icon: iconoNumero,
            draggable: true
        });

        marcador.addTo(this.dibujoLayer);
        this.marcadoresPuntos.push(marcador);

        marcador.bindTooltip(`Punto ${numero}<br>Lat: ${lat.toFixed(6)}<br>Lng: ${lng.toFixed(6)}`, {
            permanent: false,
            direction: 'top'
        });

        marcador.on('dragstart', () => {
            marcador.closeTooltip();
            const iconElement = (marcador as any)._icon;
            if (iconElement) {
                iconElement.classList.add('dragging');
            }
        });

        marcador.on('drag', (event) => {
            const newPos = event.target.getLatLng();
            marcador.setTooltipContent(`Punto ${numero}<br>Lat: ${newPos.lat.toFixed(6)}<br>Lng: ${newPos.lng.toFixed(6)}`);
        });

        marcador.on('dragend', (event) => {
            const newPos = event.target.getLatLng();

            const iconElement = (marcador as any)._icon;
            if (iconElement) {
                iconElement.classList.remove('dragging');
            }

            const index = this.marcadoresPuntos.findIndex(marker => marker === marcador);

            if (index !== -1) {
                this.coordenadasGeocerca[index] = {
                    lat: newPos.lat,
                    lng: newPos.lng
                };

                this.actualizarPoligono();
                marcador.setTooltipContent(`Punto ${numero}<br>Lat: ${newPos.lat.toFixed(6)}<br>Lng: ${newPos.lng.toFixed(6)}`);

                this.msgService.add({
                    severity: 'success',
                    summary: `Punto ${numero} movido`,
                    detail: `Nueva posición: ${newPos.lat.toFixed(6)}, ${newPos.lng.toFixed(6)}`
                });
            }
        });
    }

    private crearLineasPunteadas(): void {
        if (this.coordenadasGeocerca.length < 2) return;

        for (let i = 0; i < this.coordenadasGeocerca.length; i++) {
            const punto1 = this.coordenadasGeocerca[i];
            const punto2 = this.coordenadasGeocerca[(i + 1) % this.coordenadasGeocerca.length];

            if (this.coordenadasGeocerca.length >= 3 || i < this.coordenadasGeocerca.length - 1) {
                const linea = L.polyline(
                    [
                        [punto1.lat, punto1.lng],
                        [punto2.lat, punto2.lng]
                    ],
                    {
                        color: '#8b5cf6',
                        weight: 2,
                        opacity: 0.8,
                        dashArray: '8, 6'
                    }
                );

                this.lineasTemporales.push(linea);
                this.dibujoLayer!.addLayer(linea);
            }
        }
    }

    actualizarPoligono(): void {
        if (this.coordenadasGeocerca.length < 2) return;

        if (this.formaActual && this.dibujoLayer) {
            this.dibujoLayer.removeLayer(this.formaActual);
        }

        this.lineasTemporales.forEach((linea) => {
            if (this.dibujoLayer) {
                this.dibujoLayer.removeLayer(linea);
            }
        });

        this.lineasTemporales = [];

        this.crearLineasPunteadas();

        if (this.coordenadasGeocerca.length >= 3) {
            const latLngs = this.coordenadasGeocerca.map((coord) => [coord.lat, coord.lng] as L.LatLngTuple);

            const polygon = L.polygon(latLngs, {
                stroke: false,
                fillColor: '#8b5cf6',
                fillOpacity: 0.15
            });

            this.formaActual = polygon;
            this.dibujoLayer!.addLayer(polygon);
        }

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
        const puntos = 32;

        for (let i = 0; i < puntos; i++) {
            const angulo = (i * 2 * Math.PI) / puntos;

            const deltaLat = (radio / 111320) * Math.cos(angulo);
            const deltaLng = (radio / (111320 * Math.cos((lat * Math.PI) / 180))) * Math.sin(angulo);

            this.coordenadasGeocerca.push({
                lat: lat + deltaLat,
                lng: lng + deltaLng
            });
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

    addUserMarkersToMap(): void {
        if (!this.map || !this.markerClusterGroup) return;

        this.markerClusterGroup.clearLayers();
        this.userMarkers.clear();

        this.users.forEach(user => {
            if (user.ubicacion?.geublat && user.ubicacion?.geublon) {
                // Icono personalizado para usuarios
                const customIcon = L.divIcon({
                    html: `
                    <div class="relative">
                        <div class="w-8 h-8 bg-blue-500 rounded-full border-2 border-white shadow-lg flex items-center justify-center">
                            <svg class="w-4 h-4 text-white" viewBox="0 0 20 20">
                              <path
                                fill="currentColor"
                                fill-rule="evenodd"
                                clip-rule="evenodd"
                                d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z"
                              />
                            </svg>

                        </div>
                        <div class="absolute -top-1 -right-1 w-3 h-3 bg-green-400 border border-white rounded-full"></div>
                    </div>
                `,
                    className: 'custom-user-marker',
                    iconSize: [32, 32],
                    iconAnchor: [16, 16]
                });

                const marker = L.marker([user.ubicacion.geublat, user.ubicacion.geublon], {
                    icon: customIcon
                });

                const popupContent = this.createUserPopupContent(user);
                marker.bindPopup(popupContent, {
                    maxWidth: 240,
                    className: 'custom-popup'
                });

                this.userMarkers.set(user.usucod, marker);
                this.markerClusterGroup?.addLayer(marker);
            }
        });
    }

    private createUserPopupContent(user: any): string {
        const lastUpdate = new Date(user.ubicacion.geubfech).toLocaleString('es-EC', {
            day: '2-digit',
            month: '2-digit',
            year: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        });

        return `
        <div class="bg-white rounded-lg shadow-sm border-0 overflow-hidden">
            <!-- Content -->
            <div class="p-2 space-y-1.5">
                <!-- Códigos -->
                <div class="flex items-center space-x-1.5 text-xs">
                    <svg class="w-2.5 h-2.5 text-gray-400" viewBox="0 0 20 20">
                      <path
                        fill="currentColor"
                        fill-rule="evenodd"
                        clip-rule="evenodd"
                        d="M4 4a2 2 0 00-2 2v8a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2H4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1z"
                      />
                    </svg>

                    <span class="text-gray-700 font-medium">${user.usucod}</span>
                    <span class="text-gray-400">•</span>
                    <span class="text-gray-500">${user.usucodv}</span>
                </div>

                <!-- Última ubicación -->
                <div class="flex items-center space-x-1.5 text-xs">
                    <svg class="w-2.5 h-2.5 text-gray-400" viewBox="0 0 20 20">
                      <path
                        fill="currentColor"
                        fill-rule="evenodd"
                        clip-rule="evenodd"
                        d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z"
                      />
                    </svg>

                    <span class="text-gray-500">Última ubicación: ${lastUpdate}</span>
                </div>

                <!-- Estado activo -->
                <div class="flex items-center space-x-1.5 mt-2">
                    <div class="w-2 h-2 bg-green-400 rounded-full"></div>
                    <span class="text-xs text-green-600 font-medium">Usuario activo</span>
                </div>
            </div>
        </div>
    `;
    }

    // ==================== MÉTODOS DEL BUSCADOR DE UBICACIONES ==================

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
    // =============================================================



    // ================= MÉTODOS PARA CREACIÓN DE GEOCERCAS ====================

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

        this.limpiarDibujo();

        if (!this.dibujoLayer) {
            this.dibujoLayer = L.layerGroup().addTo(this.map!);
        }

        if (this.map) {
            this.map.off('click');
        }

        setTimeout(() => {
            this.configurarEventosMapa();
            console.log('Eventos configurados para tipo:', this.tipoGeocerca);
        }, 100);

        this.msgService.add({
            severity: 'info',
            summary: 'Modo creación activado',
            detail: `Haga clic en el mapa para crear una geocerca ${this.tipoGeocerca}`
        });
    }

    private prepararCoordenadasParaServicio(): Array<{ lat: number; lng: number }> {
        if (this.tipoGeocerca === 'circular') {
            return [...this.coordenadasGeocerca];
        }

        const coordenadas = [...this.coordenadasGeocerca];

        if (coordenadas.length > 3) {
            const primero = coordenadas[0];
            const ultimo = coordenadas[coordenadas.length - 1];

            if (Math.abs(primero.lat - ultimo.lat) < 0.000001 && Math.abs(primero.lng - ultimo.lng) < 0.000001) {
                coordenadas.pop();
            }
        }

        return coordenadas;
    }

    actualizarRadioCirculo(): void {
        if (this.tipoGeocerca === 'circular' && this.centroGeocerca && this.creandoGeocerca) {
            const mockEvent = {
                latlng: {
                    lat: this.centroGeocerca.lat,
                    lng: this.centroGeocerca.lng
                }
            } as L.LeafletMouseEvent;

            this.onMapClickCircular(mockEvent);
        }
    }

    limpiarDibujo(): void {
        if (this.dibujoLayer) {
            this.dibujoLayer.clearLayers();
        }

        // Limpiar marcadores
        this.marcadoresPuntos.forEach((marcador) => {
            if (this.dibujoLayer && this.map) {
                try {
                    this.dibujoLayer.removeLayer(marcador);
                } catch (e) {
                    console.log('Error removiendo marcador:', e);
                }
            }
        });
        this.marcadoresPuntos = [];

        this.lineasTemporales.forEach((linea) => {
            if (this.dibujoLayer && this.map) {
                try {
                    this.dibujoLayer.removeLayer(linea);
                } catch (e) {
                    console.log('Error removiendo línea:', e);
                }
            }
        });
        this.lineasTemporales = [];

        if (this.formaActual && this.dibujoLayer) {
            try {
                this.dibujoLayer.removeLayer(this.formaActual);
            } catch (e) {
                console.log('Error removiendo forma:', e);
            }
        }

        this.coordenadasGeocerca = [];
        this.centroGeocerca = null;
        this.formaActual = null;
    }

    cancelarCreacionGeocerca(): void {
        this.creandoGeocerca = false;
        this.limpiarDibujo();

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

        if (this.codeValidationResult !== 'valid') {
            this.msgService.add({
                severity: 'warn',
                summary: 'Código inválido',
                detail: 'Debe usar un código de geocerca válido'
            });
            return;
        }

        const formData = this.geocercaForm.value;
        const usuario = this.authService.getUsuarioFromToken() || 'SUPERVISOR';
        const empresa = this.authService.getEmpresa()?.nomempresa || 'PC-ADMIN';

        const coordenadasParaCalculo = this.prepararCoordenadasParaServicio();

        let area: number;
        let perimetro: number;

        if (this.tipoGeocerca === 'circular') {
            area = this.geocercaService.calcularAreaCirculo(this.radioGeocerca);
            perimetro = this.geocercaService.calcularPerimetroCirculo(this.radioGeocerca);
        } else {
            area = this.geocercaService.calcularAreaPoligono(coordenadasParaCalculo);
            perimetro = this.geocercaService.calcularPerimetroPoligono(coordenadasParaCalculo);
        }

        const geocercaData: CrearGeocercaDto = {
            geoccod: formData.geoccod,
            geocnom: formData.geocnom,
            geocdirre: formData.geocdirre,
            geocsec: formData.geocsec?.parroquia || formData.geocsec || '',
            geocciud: formData.geocciud?.canton || formData.geocciud || '',
            geocprov: formData.geocprov?.provincia || formData.geocprov || '',
            geocpais: formData.geocpais,
            geoclat: this.centroGeocerca.lat,
            geoclon: this.centroGeocerca.lng,
            geoccoor: coordenadasParaCalculo,
            geocarm: area,
            geocperm: perimetro,
            geocest: 'A',
            geocact: formData.geocact,
            geocpri: formData.geocpri,
            geocdesc: formData.geocdesc,
            geocuscre: usuario,
            geoceqcre: empresa,
            vendedores: [
                {
                    geugidv: this.selectedUser.usucod,
                    geuglat: this.centroGeocerca.lat,
                    geuglon: this.centroGeocerca.lng,
                    geuguscre: usuario,
                    geugeqcre: this.selectedUser.usucodv
                }
            ],
            validarVendedoresDuplicados: true
        };

        this.geocercaService.crearGeocerca(geocercaData).subscribe({
            next: () => {
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

        if (this.map) {
            this.map.off('click');
        }

        if (this.creandoGeocerca) {
            this.configurarEventosMapa();
        }
    }

    // ============== MÉTODOS PARA CARGAR DATOS DE PROVINCIAS =============

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


    // Métodos para manejar selecciones
    onProvinciaSeleccionada(event: any): void {
        const provinciaObj: Provincia = event.value;
        this.provinciaSeleccionada = provinciaObj;

        // Usar el servicio para obtener cantones
        this.cantonesList = this.provinceService.getCantones(provinciaObj.codigo);

        // Limpiar selecciones dependientes
        this.ciudadSeleccionada = null;
        this.parroquiasList = [];
        this.sectorSeleccionado = null;

        // Actualizar formulario
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
            this.parroquiasList = this.provinceService.getParroquias(
                this.provinciaSeleccionada.codigo,
                ciudadObj.codigo
            );
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

    // ==============================================================================


    refreshData(): void {
        this.loading = true;
        this.selectedUser = null;
        this.getAllUsers();
        this.resetMapView();
    }

    ngOnDestroy(): void {
        if (this.searchMarker && this.map) {
            this.map.removeLayer(this.searchMarker);
            this.searchMarker = null;
        }

        this.marcadoresPuntos.forEach((marcador) => {
            if (this.map) {
                this.map.removeLayer(marcador);
            }
        });
        this.marcadoresPuntos = [];

        this.lineasTemporales.forEach((linea) => {
            if (this.map) {
                this.map.removeLayer(linea);
            }
        });
        this.lineasTemporales = [];

        if (this.dibujoLayer && this.map) {
            this.map.removeLayer(this.dibujoLayer);
            this.dibujoLayer = null;
        }

        if (this.map) {
            this.map.remove();
            this.map = null;
        }

    }
}
