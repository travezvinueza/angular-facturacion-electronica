import { AfterViewInit, Component, ElementRef, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TableModule } from 'primeng/table';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { InputTextModule } from 'primeng/inputtext';
import { ButtonModule } from 'primeng/button';
import { RippleModule } from 'primeng/ripple';
import { ToolbarModule } from 'primeng/toolbar';
import { TextareaModule } from 'primeng/textarea';
import { InputNumberModule } from 'primeng/inputnumber';
import { DialogModule } from 'primeng/dialog';
import { firstValueFrom } from 'rxjs';
import { TagModule } from 'primeng/tag';
import { InputIconModule } from 'primeng/inputicon';
import { IconFieldModule } from 'primeng/iconfield';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { CardModule } from 'primeng/card';
import { PaginatorModule } from 'primeng/paginator';
import { SkeletonModule } from 'primeng/skeleton';
import { Tooltip } from 'primeng/tooltip';
import { debounceTime, distinctUntilChanged, Subject, takeUntil } from 'rxjs';
import { MapService, SearchResult } from '@/core/services/map.service';
import { GeocercaService } from '@/core/services/geocerca.service';
import { AuthService } from '@/core/services/auth.service';
import { ConfirmationService, MessageService } from 'primeng/api';
import { HttpErrorResponse } from '@angular/common/http';
import { GeocercaValidationResponse, GeofenceDto } from '@/core/models/Geocercas/GeocercaValidationResponseDto';
import * as L from 'leaflet';
import { Select } from 'primeng/select';
import { Slider } from 'primeng/slider';
import { ProvinceService } from '@/core/services/province.service';
import { GeocercaDrawingService } from '@/core/services/geocerca-drawing.service';
import { GeocercaDrawing, GeocercaDrawingState } from '@/core/models/Draw/DrawingCoordinate';
import { Canton, Parroquia, Provincia } from '@/core/models/ProvinciaDto';
import { AutoComplete } from 'primeng/autocomplete';
import { ToggleSwitch } from 'primeng/toggleswitch';
import { AdditionalGeocercaData, GeocercaMapper } from '@/core/models/helpers/geocerca-mapper.helper';
import { ActualizarGeocercaDto, CoordenadaDto } from '@/core/models/Geocercas/GeocercaDto';

interface TipoGeocercaOption {
    label: string;
    value: 'circular' | 'poligono';
    icon: string;
}

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
        Select,
        Slider,
        AutoComplete,
        ToggleSwitch
    ],
    templateUrl: './only-geocercas.component.html',
    styleUrl: './only-geocercas.component.css'
})
export class OnlyGeocercasComponent implements OnInit, AfterViewInit, OnDestroy {
    @ViewChild('mapContainer', { static: false }) mapContainer!: ElementRef;
    // =================== VARIABLES/PROPIEDADES ===================

    //======= VARIABLES PRIVADAS PARA MANEJO DE SUBSCRIPCIONES ===================//
    private destroy$ = new Subject<void>(); // Subject para manejo de subscripciones


    //======= Propiedades de provincias ===================//
    cantonesList: Canton[] = [];
    parroquiasList: Parroquia[] = [];

    // Propiedades para las sugerencias filtradas
    provinciasFiltradas: Provincia[] = [];
    ciudadesFiltradas: Canton[] = [];
    sectoresFiltrados: Parroquia[] = [];
    geocercaForm!: FormGroup;

    // Propiedades para elementos seleccionados
    provinciaSeleccionada: Provincia | null = null;
    ciudadSeleccionada: Canton | null = null;
    sectorSeleccionado: Parroquia | null = null;

    //===========================================================//

    //======= VARIABLES PARA VALIDACIÓN DEL CÓDIGO DE LAS GEOCERCAS ===================//
    // Estados de validación de código
    private codeValidationSubject = new Subject<string>(); // Subject para manejar la validación del código
    validatingCode: boolean = false;
    codeValidationResult: 'valid' | 'invalid' | 'pending' | null = null;
    codeValidationMessage: string = '';

    //===========================================================//

    // =================== PROPIEDADES PARA ELIMINACIÓN MÚLTIPLE ===================
    modoEliminacion: boolean = false;
    geocercasSeleccionadas: Set<string> = new Set(); // Set con códigos de geocercas seleccionadas
    todasSeleccionadas: boolean = false;

    // ===================  PROPIEDADES PARA EDICION DE GEOCERCAS ===================

    editandoGeocerca: boolean = false;
    modoEdicion: boolean = false;
    geocercaOriginal: GeofenceDto | null = null;



    // ===================  PROPIEDADES PARA CREACIÓN DE GEOCERCAS ===================
    creandoGeocerca: boolean = false;
    geocercaDialog: boolean = false;

    // Propiedades del dibujo (sincronizadas con el servicio)
    tipoGeocerca: 'circular' | 'poligono' = 'circular';
    radioGeocerca: number = 500;
    coordenadasGeocerca: Array<{lat: number, lng: number}> = [];
    centroGeocerca: {lat: number, lng: number} | null = null;

    // Estados del servicio de drawing
    drawingState: GeocercaDrawingState | null = null;
    geocercasCreadas: GeocercaDrawing[] = [];

    // Configuraciones para UI
    tiposGeocerca: TipoGeocercaOption[] = [
        {
            label: 'Geocerca Circular',
            value: 'circular',
            icon: 'pi pi-circle'
        },
        {
            label: 'Geocerca Poligonal',
            value: 'poligono',
            icon: 'pi pi-stop'
        }
    ];

    //=================================================================//

    //======= VARIABLES PARA EL MAPA ===================//
    // Mapa (delegadas al servicio)
    searchLocation: string = '';
    searchingLocation: boolean = false;
    searchResults: SearchResult[] = [];
    mapInitialized: boolean = false;
    //=================================================================//


    //======= VARIABLES DE GEOCERCAS ===================//
    // Propiedades de geocercas
    geocercas: GeofenceDto[] = [];
    filteredGeocercas: GeofenceDto[] = [];
    paginatedGeocercas: GeofenceDto[] = [];
    selectedGeocerca: GeofenceDto | null = null;
    loading: boolean = true;

    //=================================================================//


    //======= VARIABLES DE PAGINACION DE GEOCERCAS ==================//
    first: number = 0;
    itemsPerPage: number = 5;
    enterpriseName: string = '';     // Propiedades de empresa



    constructor(
        private readonly geocercaService: GeocercaService,
        private readonly fb: FormBuilder,
        private readonly authService: AuthService,
        private readonly msgService: MessageService,
        private readonly mapService: MapService,
        private readonly provinceService: ProvinceService,
        private readonly geocercaDrawing: GeocercaDrawingService,
        private readonly confirmationService: ConfirmationService
    ) {}


    //============== MÉTODOS DE INICIALIZACIÓN ===================

    async initializeMap(): Promise<void> {

        this.mapInitialized = true;
        const container = this.mapContainer.nativeElement;
        if (!container) {
            console.error('Contenedor del mapa no encontrado');
            return;
        }
        try {
            await this.mapService.initializeMap(this.mapContainer, {
                center: [-0.2298, -78.5249],
                zoom: 13,
                defaultLocation: 'Quito, Ecuador',
                zoomControl: false,
            });

            if (!this.loading && this.geocercas.length > 0) {
                this.mapService.addGeocercaMarkers(this.geocercas);
            }
        } catch (error) {
            console.error('Error al inicializar el mapa:', error);
        }
    }


    ngOnInit(): void {
        this.initializeEnterpriseName();
        this.getAllGeocercas();
        this.subscribeToMapService();
        this.subscribeToDrawingService();
        this.initializeGeocercaForm();
        this.inicializarProvincias();
        this.setupCodeValidation();
    }

    ngAfterViewInit(): void {
        requestAnimationFrame(() => {
            this.initializeMap().then(() => {});
        });
    }

    private inicializarProvincias(): void {
        this.provinciasFiltradas = this.provinceService.getProvincias();
    }

    initializeGeocercaForm(): void {
        this.geocercaForm = this.fb.group({
            geoccod: ['', [Validators.required, Validators.minLength(3)]],
            geocnom: ['', [Validators.required, Validators.minLength(3)]],
            geocsec: ['', [Validators.required]],
            geocdirre: ['', [Validators.required]],
            geocciud: ['', [Validators.required]],
            geocprov: ['', [Validators.required]],
            geocpais: [{ value: 'ECUADOR', disabled: false }, Validators.required],
            geocpri: [5, [Validators.required, Validators.min(1), Validators.max(10)]],
            geocdesc: ['', [Validators.required]],
            geocact: [true]
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

    //=================================================================//


    //======= METODOS PARA EL MANEJO DE SUBSCRIPCIONES ===================//

    /**
     * Suscribe a los observables del servicio de mapas
     */
    private subscribeToMapService(): void {
        this.mapService.isMapInitialized$.pipe(takeUntil(this.destroy$)).subscribe((initialized) => {
            this.mapInitialized = initialized;
            if (initialized && this.mapService['map']) {
                this.geocercaDrawing.initialize(this.mapService['map']);
            }
        });

        this.mapService.isSearchingLocation$.pipe(takeUntil(this.destroy$)).subscribe((searching) => {
            this.searchingLocation = searching;
        });

        this.mapService.searchResultsList$.pipe(takeUntil(this.destroy$)).subscribe((results) => {
            this.searchResults = results;
        });
    }

    /**
     * Suscribirse a los observables del servicio de drawing
     */
    private subscribeToDrawingService(): void {
        // Estado del dibujo
        this.geocercaDrawing.drawingState$
            .pipe(takeUntil(this.destroy$))
            .subscribe(state => {
                this.drawingState = state;

                if (state) {
                    // Sincronizar estado local
                    this.coordenadasGeocerca = [...state.coordenadas];
                    this.centroGeocerca = state.centro ? {...state.centro} : null;
                    this.creandoGeocerca = state.creando;

                    if (state.tipo) {
                        this.tipoGeocerca = state.tipo;
                    }
                }
            });

        // Geocercas creadas
        this.geocercaDrawing.geocercas$
            .pipe(takeUntil(this.destroy$))
            .subscribe(geocercas => {
                this.geocercasCreadas = geocercas;
            });
    }
    //=================================================================//



    // ============== MÉTODOS PARA VALIDACION DE CODIGO DE GEOCERCA =============

    /**
     * Configurar validación de código con debounce
     */
    private setupCodeValidation(): void {
        // Configurar debounce para validación de código
        this.codeValidationSubject
            .pipe(
                debounceTime(500), // Esperar 500ms después de que el usuario deje de escribir
                distinctUntilChanged(),
                takeUntil(this.destroy$)
            )
            .subscribe(code => {
                if (code && code.length >= 5) {
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
                }
            });

    }

    /**
     * Validar código de geocerca con el backend
     */
    private validateGeocercaCode(code: string): void {
        this.validatingCode = true;
        this.codeValidationResult = 'pending';

        this.geocercaService.validarCodigoGeocerca(code)
            .pipe(takeUntil(this.destroy$))
            .subscribe({
                next: () => {
                    // Código válido y disponible
                    this.validatingCode = false;
                    this.codeValidationResult = 'valid';
                    this.codeValidationMessage = 'Código disponible';
                },
                error: (error: HttpErrorResponse) => {
                    // Cualquier error = código inválido

                    // Mensaje simplificado basado en el status
                    if (error.status === 400) {
                        this.codeValidationMessage = 'El código ya existe o no es válido';
                    } else {
                        this.codeValidationMessage = 'Error al validar el código. Intente nuevamente.';
                    }
                }
            });
    }


    /**
     * Resetear validación de código
     */
    private resetCodeValidation(): void {
        this.validatingCode = false;
        this.codeValidationResult = null;
        this.codeValidationMessage = '';
    }

    /**
     * Obtener clase CSS para input de código según estado de validación
     */
    getCodeInputClass(): string {
        const baseClass = 'w-full';

        if (this.codeValidationResult === 'valid') {
            return `${baseClass} border-green-300 focus:border-green-500 focus:ring-green-200`;
        } else if (this.codeValidationResult === 'invalid') {
            return `${baseClass} border-red-300 focus:border-red-500 focus:ring-red-200`;
        }

        return baseClass;
    }

    /**
     * Obtener clase CSS para mensaje de validación
     */
    getValidationMessageClass(): string {
        if (this.codeValidationResult === 'valid') {
            return 'text-xs text-green-600 flex items-center gap-1';
        } else if (this.codeValidationResult === 'invalid') {
            return 'text-xs text-red-600 flex items-center gap-1';
        }

        return 'text-xs text-surface-500';
    }

    //=================================================================//


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
            this.parroquiasList = this.provinceService.getParroquias(this.provinciaSeleccionada.codigo, ciudadObj.codigo);
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


    /**
     * Iniciar edición de geocerca existente
     */
    editarGeocerca(geocerca: GeofenceDto): void {


        if (!this.mapInitialized) {
            this.msgService.add({
                severity: 'warn',
                summary: 'Advertencia',
                detail: 'Espere a que el mapa se inicialice completamente'
            });
            return;
        }

        // Guardar copia original para comparar cambios
        this.geocercaOriginal = { ...geocerca };
        this.modoEdicion = true;
        this.editandoGeocerca = true;
        this.selectedGeocerca = geocerca;

        // Cargar datos existentes en el formulario
        this.cargarGeocercaParaEdicion(geocerca);

        // Iniciar drawing service en modo edición
        this.iniciarEdicionEnMapa(geocerca);
        this.geocercaDialog = true;

        this.msgService.add({
            severity: 'info',
            summary: 'Modo edición activado',
            detail: `Editando geocerca: ${geocerca.geocnom}`
        });
    }
    /**
     * Cargar datos de geocerca existente en el formulario
     */
    private cargarGeocercaParaEdicion(geocerca: GeofenceDto): void {
        // Extraer coordenadas
        let coordenadas: CoordenadaDto[] = [];
        try {
            coordenadas = JSON.parse(geocerca.geoccoor);
        } catch (error) {
            console.error('Error parseando coordenadas:', error);
        }

        // Determinar tipo de geocerca y configurar estado
        this.tipoGeocerca = this.determinarTipoGeocerca(coordenadas);
        this.coordenadasGeocerca = coordenadas;
        this.centroGeocerca = { lat: geocerca.geoclat, lng: geocerca.geoclon };

        // Si es circular, calcular radio aproximado
        if (this.tipoGeocerca === 'circular' && coordenadas.length > 0) {
            this.radioGeocerca = this.calcularRadioDesdeArea(geocerca.geocarm);
        }

        // Cargar datos en el formulario
        this.geocercaForm.patchValue({
            geoccod: geocerca.geoccod,
            geocnom: geocerca.geocnom,
            geocprov: geocerca.geocprov,
            geocciud: geocerca.geocciud,
            geocsec: geocerca.geocsec,
            geocdirre: geocerca.geocdirre,
            geocpais: geocerca.geocpais,
            geocpri: geocerca.geocpri,
            geocact: geocerca.geocact,
            geocdesc: geocerca.geocdesc
        });

        // Deshabilitar código en modo edición
        this.geocercaForm.get('geoccod')?.disable();
        this.codeValidationResult = 'valid'; // El código existente siempre es válido
    }

    /**
     * Determinar tipo de geocerca basado en coordenadas
     */
    private determinarTipoGeocerca(coordenadas: CoordenadaDto[]): 'circular' | 'poligono' {
        if (coordenadas.length === 32) {
            const esCircular = this.verificarSiEsCircular(coordenadas);
            return esCircular ? 'circular' : 'poligono';
        }
        return 'poligono';
    }

    /**
     * Verificar si las coordenadas forman un círculo
     */
    private verificarSiEsCircular(coordenadas: CoordenadaDto[]): boolean {
        if (coordenadas.length !== 32) return false;

        const centro = this.centroGeocerca;
        if (!centro) return false;

        const distancias = coordenadas.map(coord =>
            Math.sqrt(Math.pow(coord.lat - centro.lat, 2) + Math.pow(coord.lng - centro.lng, 2))
        );

        const distanciaPromedio = distancias.reduce((sum, d) => sum + d, 0) / distancias.length;
        const tolerancia = distanciaPromedio * 0.05;

        return distancias.every(d => Math.abs(d - distanciaPromedio) < tolerancia);
    }

    /**
     * Calcular radio aproximado desde el área
     */
    private calcularRadioDesdeArea(area: number): number {
        const radio = Math.sqrt(area / Math.PI);
        return Math.max(50, Math.min(2000, Math.round(radio)));
    }

    /**
     * Abrir diálogo de edición
     */
    abrirDialogoEdicion(): void {
        this.geocercaDialog = true;
    }

    /**
     * Actualizar geocerca existente
     */
    async actualizarGeocerca(): Promise<void> {
        if (!this.modoEdicion || !this.geocercaOriginal) {
            this.msgService.add({
                severity: 'error',
                summary: 'Error',
                detail: 'No hay una geocerca en modo de edición'
            });
            return;
        }

        if (this.geocercaForm.invalid || !this.centroGeocerca) {
            this.msgService.add({
                severity: 'error',
                summary: 'Error de validación',
                detail: 'Complete todos los campos requeridos'
            });
            return;
        }

        try {
            const area = GeocercaMapper.calculateArea(this.drawingState?.coordenadas || this.coordenadasGeocerca);
            const perimetro = GeocercaMapper.calculatePerimeter(this.drawingState?.coordenadas || this.coordenadasGeocerca);

            const updateDto: ActualizarGeocercaDto = {
                geocnom: this.geocercaForm.get('geocnom')?.value,
                geocsec: this.extractFormValue('geocsec', 'parroquia'),
                geocdirre: this.geocercaForm.get('geocdirre')?.value,
                geocciud: this.extractFormValue('geocciud', 'canton'),
                geocprov: this.extractFormValue('geocprov', 'provincia'),
                geocpais: this.geocercaForm.get('geocpais')?.value || 'ECUADOR',
                geoclat: this.centroGeocerca.lat,
                geoclon: this.centroGeocerca.lng,
                geoccoor: this.formatCoordinatesForUpdate(),
                geocarm: Math.round(area),
                geocperm: Math.round(perimetro),
                geocest: this.geocercaOriginal.geocest,
                geocact: this.geocercaForm.get('geocact')?.value,
                geocpri: this.geocercaForm.get('geocpri')?.value,
                geocdesc: this.geocercaForm.get('geocdesc')?.value,
                geocusedi: this.authService.getUsuarioFromToken() || 'SUPERVISOR',
                geoceqedi: this.enterpriseName
            };

            const response = await this.geocercaService.actualizarGeocerca(
                this.geocercaOriginal.geoccod,
                updateDto
            ).toPromise();

            if (response && response.success) {
                this.geocercaDialog = false;
                this.cancelarEdicion();

                this.msgService.add({
                    severity: 'success',
                    summary: 'Geocerca actualizada',
                    detail: `La geocerca "${updateDto.geocnom}" se ha actualizado exitosamente`
                });

                this.refreshData();
            }

        } catch (error: any) {
            console.error('Error al actualizar geocerca:', error);
            this.msgService.add({
                severity: 'error',
                summary: 'Error al actualizar',
                detail: 'No se pudo actualizar la geocerca'
            });
        }
    }

    /**
     * Extraer valor de campo que puede ser string u objeto
     */
    private extractFormValue(fieldName: string, property: string): string {
        const value = this.geocercaForm.get(fieldName)?.value;

        if (typeof value === 'string') {
            return value;
        }

        if (typeof value === 'object' && value[property]) {
            return value[property];
        }

        return '';
    }

    /**
     * Formatear coordenadas para actualización
     */
    private formatCoordinatesForUpdate(): CoordenadaDto[] {
        const coordinates = this.drawingState?.coordenadas || this.coordenadasGeocerca;
        return coordinates.map(coord => ({
            lat: Math.round(coord.lat * 1000000) / 1000000,
            lng: Math.round(coord.lng * 1000000) / 1000000
        }));
    }

    /**
     * Cancelar edición
     */
    cancelarEdicion(): void {
        this.modoEdicion = false;
        this.editandoGeocerca = false;
        this.geocercaOriginal = null;

        this.geocercaDrawing.cancelarCreacion();
        this.geocercaForm.get('geoccod')?.enable();
        this.resetCodeValidation();

        this.msgService.add({
            severity: 'info',
            summary: 'Edición cancelada',
            detail: 'Se ha cancelado la edición de la geocerca'
        });
    }

    //MÉTODO PARA CREAR GEOCERCAS//

    /**
     * Verifica si la geocerca actual se puede finalizar
     */
    get puedeFinalizarGeocerca(): boolean {
        return !!this.centroGeocerca && (this.tipoGeocerca === 'circular' || (this.tipoGeocerca === 'poligono' && this.coordenadasGeocerca.length >= 3));
    }

    // En OnlyGeocercasComponent - Método iniciarEdicionEnMapa()
    private iniciarEdicionEnMapa(geocerca: GeofenceDto): void {
        // Limpiar estado actual del drawing service
        this.geocercaDrawing.cancelarCreacion();

        // Extraer coordenadas de la geocerca
        let coordenadas: CoordenadaDto[] = [];
        try {
            coordenadas = JSON.parse(geocerca.geoccoor);
        } catch (error) {
            console.error('Error parseando coordenadas:', error);
        }

        // Configurar estado inicial para edición usando el nuevo método
        setTimeout(() => {
            this.geocercaDrawing.cargarGeocercaParaEdicion(  // ← AQUÍ SE USA
                this.tipoGeocerca,
                coordenadas,
                { lat: geocerca.geoclat, lng: geocerca.geoclon },
                this.tipoGeocerca === 'circular' ? this.radioGeocerca : undefined
            );
        }, 500);
    }

    /**
     * Iniciar creación de nueva geocerca
     */
    iniciarCreacionGeocerca(): void {
        if (!this.mapInitialized) {
            this.msgService.add({
                severity: 'warn',
                summary: 'Advertencia',
                detail: 'Espere a que el mapa se inicialice completamente'
            });
            return;
        }

        // Limpiar selección actual
        this.selectedGeocerca = null;

        // Iniciar drawing con el servicio
        this.geocercaDrawing.iniciarCreacionGeocerca(this.tipoGeocerca);

        this.msgService.add({
            severity: 'info',
            summary: 'Modo creación activado',
            detail: `Haga clic en el mapa para crear una geocerca ${this.tipoGeocerca}`,
            life: 2000
        });
    }

    /**
     * Cambiar tipo de geocerca durante la creación
     */
    onTipoGeocercaChange(): void {
        if (this.creandoGeocerca) {
            // Cancelar creación actual y reiniciar con nuevo tipo
            this.geocercaDrawing.cancelarCreacion();

            setTimeout(() => {
                this.geocercaDrawing.iniciarCreacionGeocerca(this.tipoGeocerca);
            }, 100);
        }
    }

    /**
     * Actualizar radio del círculo
     */
    actualizarRadioCirculo(): void {
        if (this.tipoGeocerca === 'circular' && this.creandoGeocerca) {
            this.geocercaDrawing.cambiarRadioCirculo(this.radioGeocerca);
        }
    }

    /**
     * Deshacer último punto (para polígonos)
     */
    deshacerUltimoPunto(): void {
        if (this.coordenadasGeocerca.length > 0) {
            // Remover el último punto del estado local
            this.coordenadasGeocerca.pop();

            // Actualizar el servicio de drawing
            if (this.drawingState) {
                this.drawingState.coordenadas = [...this.coordenadasGeocerca];

                // Actualizar visualización (esto requiere acceso a métodos privados del servicio)
                // Por ahora, reiniciamos la creación
                this.geocercaDrawing.cancelarCreacion();
                setTimeout(() => {
                    this.geocercaDrawing.iniciarCreacionGeocerca(this.tipoGeocerca);

                    // Restaurar puntos (esto requeriría un método en el servicio)
                    // Por simplicidad, el usuario tendrá que volver a hacer los puntos
                }, 100);
            }
        }
    }
    /**
     * Limpiar dibujo actual
     */
    limpiarDibujo(): void {
        // Delegar la limpieza del mapa al servicio de dibujo
        this.geocercaDrawing.cancelarCreacion();
        this.geocercaDrawing.cancelarEdicion();

        // IMPORTANTE: Resetear también las variables del componente
        this.coordenadasGeocerca = [];
        this.radioGeocerca = 100;
        this.tipoGeocerca = 'circular';

        // NO resetear creandoGeocerca/editandoGeocerca/modoEdicion aquí
        // Solo limpiar el dibujo, mantener el modo activo

        this.msgService.add({
            severity: 'info',
            summary: 'Dibujo limpiado',
            detail: 'Se ha limpiado el dibujo actual'
        });
    }

// Función separada para cancelar completamente (cerrar el panel)
    cancelarGestionGeocerca(): void {
        // Primero limpiar el dibujo
        this.geocercaDrawing.cancelarCreacion();
        this.geocercaDrawing.cancelarEdicion();

        // Luego resetear TODAS las variables de estado
        this.creandoGeocerca = false;
        this.editandoGeocerca = false;
        this.modoEdicion = false;  // Resetear también esta variable
        this.coordenadasGeocerca = [];
        this.radioGeocerca = 100;
        this.tipoGeocerca = 'circular';

        // Limpiar la geocerca original si estaba editando
        this.geocercaOriginal = null;

        this.msgService.add({
            severity: 'info',
            summary: 'Cancelado',
            detail: 'Operación cancelada'
        });
    }

// Aliases para mantener compatibilidad
    cancelarCreacionGeocerca(): void {
        this.cancelarGestionGeocerca();
    }

    cancelarEdicionGeocerca(): void {
        this.cancelarGestionGeocerca();
    }

// Getter actualizado para el template
    get estaGestionandoGeocerca(): boolean {
        return this.creandoGeocerca || this.editandoGeocerca || this.modoEdicion;
    }

    get modoGeocerca(): string {
        if (this.editandoGeocerca || this.modoEdicion) return 'Editando Geocerca';
        if (this.creandoGeocerca) return 'Creando Geocerca';
        return '';
    }


    /**
     * Abrir diálogo para configurar y guardar geocerca
     */
    abrirDialogoGeocerca(): void {
        if (!this.centroGeocerca || (this.tipoGeocerca === 'poligono' && this.coordenadasGeocerca.length < 3)) {
            this.msgService.add({
                severity: 'warn',
                summary: 'Advertencia',
                detail: this.tipoGeocerca === 'poligono' ?
                    'Necesita al menos 3 puntos para crear un polígono' :
                    'Debe colocar el centro de la geocerca'
            });
            return;
        }

        // Resetear formulario y estados de validación
        this.resetForm();
        this.resetCodeValidation();

        // Abrir diálogo
        this.geocercaDialog = true;
    }
    private resetForm(): void {
        this.geocercaForm.reset({
            geoccod: '',
            geocnom: '',
            geocprov: '',
            geocciud: '',
            geocsec: '',
            geocdirre: '',
            geocpais: 'ECUADOR',
            geocpri: 1,
            geocact: true,
            geocdesc: ''
        });

        // Limpiar estados de ubicación
        this.provinciaSeleccionada = null;
        this.ciudadSeleccionada = null;
        this.provinciasFiltradas = [];
        this.ciudadesFiltradas = [];
        this.sectoresFiltrados = [];
    }

    cerrarDialogoGeocerca(): void {
        this.geocercaDialog = false;
        this.resetCodeValidation();
    }

    async guardarGeocerca(): Promise<void> {
        if (this.codeValidationResult !== 'valid') {
            this.msgService.add({
                severity: 'warn',
                summary: 'Código inválido',
                detail: 'Debe usar un código de geocerca válido'
            });
            return;
        }

        if (this.geocercaForm.invalid || !this.centroGeocerca) {
            this.msgService.add({
                severity: 'error',
                summary: 'Error de validación',
                detail: 'Complete todos los campos requeridos'
            });
            return;
        }

        try {
            if (!this.drawingState?.creando || !this.drawingState.centro) {
                this.msgService.add({
                    severity: 'error',
                    summary: 'Error',
                    detail: 'No hay una geocerca en proceso de creación'
                });
                return;
            }

            if (this.drawingState.tipo === 'poligono' && this.drawingState.coordenadas.length < 3) {
                this.msgService.add({
                    severity: 'error',
                    summary: 'Error',
                    detail: 'Un polígono necesita al menos 3 puntos'
                });
                return;
            }

            // USAR DATOS DEL DRAWING STATE DIRECTAMENTE
            const area = GeocercaMapper.calculateArea(this.drawingState.coordenadas);
            const perimetro = GeocercaMapper.calculatePerimeter(this.drawingState.coordenadas);

            const additionalData: AdditionalGeocercaData = {
                centroGeocerca: this.drawingState.centro, // USAR DEL DRAWING STATE
                coordenadasParaCalculo: GeocercaMapper.formatCoordinatesForBackend(this.drawingState.coordenadas),
                area: area,
                perimetro: perimetro,
                usuario: this.authService.getUsuarioFromToken() || 'SUPERVISOR',
                empresa: this.enterpriseName,
                tipoGeocerca: this.drawingState.tipo!,
                radio: this.drawingState.tipo === 'circular' ? this.radioGeocerca : undefined
            };


            const validationErrors = GeocercaMapper.validate(this.geocercaForm.value, additionalData);

            if (validationErrors.length > 0) {
                this.msgService.add({
                    severity: 'warn',
                    summary: 'Datos inválidos',
                    detail: validationErrors.join(', ')
                });
                return;
            }

            const geocercaDto = GeocercaMapper.mapToDto(this.geocercaForm.value, additionalData);

            this.msgService.add({
                severity: 'info',
                summary: 'Guardando',
                detail: 'Creando geocerca...'
            });

            this.geocercaService.createOnlyGeocerca(geocercaDto)
                .pipe(takeUntil(this.destroy$))
                .subscribe({
                    next: (response) => {
                        if (response) {
                            this.geocercaDrawing.finalizarGeocerca();

                            this.geocercaDialog = false;
                            this.msgService.add({
                                severity: 'success',
                                summary: 'Geocerca creada',
                                detail: `La geocerca "${geocercaDto.geocnom}" se ha creado exitosamente`
                            });
                            this.refreshData();
                        } else {
                            this.msgService.add({
                                severity: 'error',
                                summary: 'Error del servidor',
                                detail:  'No se pudo crear la geocerca'
                            });
                        }
                    },
                    error: (error: any) => {
                        console.error('Error al guardar geocerca:', error);
                        this.msgService.add({
                            severity: 'error',
                            summary: 'Error al guardar',
                            detail: error?.error?.message || 'No se pudo crear la geocerca'
                        });
                    }
                });

        } catch (error: any) {
            console.error('Error al guardar geocerca:', error);
            this.msgService.add({
                severity: 'error',
                summary: 'Error al guardar',
                detail: 'No se pudo crear la geocerca'
            });
        }
    }

    getGeocercaStatusClasses(geocerca: any): string {
        const baseClasses = 'inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border shadow-sm';

        if (geocerca.geocact) {
            return `${baseClasses} bg-green-100/80 text-green-700 border-green-200/60 dark:bg-green-900/30 dark:text-green-300 dark:border-green-700/40`;
        } else {
            return `${baseClasses} bg-gray-100/80 text-gray-700 border-gray-200/60 dark:bg-gray-900/30 dark:text-gray-300 dark:border-gray-700/40`;
        }
    }

    //======= FUNCIÓN PARA OBTENER TODAS LAS GEOCERCAS ===================//
    getAllGeocercas(): void {
        if (!this.enterpriseName) {
            this.loading = false;
            return;
        }

        this.loading = true;
        this.geocercaService.getOnlyGeocercasByEnterpriseName(this.enterpriseName, 1, 50).subscribe({
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


    //======= FUNCIONES PARA BUSQUEDA DE GEOCERCAS ===================//
    onSearch(event: Event): void {
        const value = (event.target as HTMLInputElement).value.toLowerCase();
        this.filteredGeocercas = this.geocercas.filter(
            (geocerca) =>
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


    // Manejo de clics diferenciado por modo
    handleItemClick(geocerca: GeofenceDto): void {
        if (this.modoEliminacion) {
            this.toggleSeleccionGeocerca(geocerca.geoccod);
        } else if (!this.editandoGeocerca) {
            this.selectGeocerca(geocerca);
        }
    }

// Edición rápida (previene propagación)
    quickEditGeocerca(geocerca: GeofenceDto, event: Event): void {
        event.stopPropagation();
        this.editarGeocerca(geocerca);
    }

// Clases dinámicas para el avatar
    getAvatarClasses(geocerca: GeofenceDto): string {
        if (this.editandoGeocerca && this.selectedGeocerca?.geoccod === geocerca.geoccod) {
            return 'bg-orange-100 dark:bg-orange-900/30';
        }
        if (this.selectedGeocerca?.geoccod === geocerca.geoccod) {
            return 'bg-primary-100 dark:bg-primary-900/30';
        }
        return 'bg-surface-100 dark:bg-surface-800';
    }

// Icono del avatar según estado
    getAvatarIcon(geocerca: GeofenceDto): string {
        const baseIcon = 'pi pi-map-marker text-lg sm:text-xl';

        if (this.editandoGeocerca && this.selectedGeocerca?.geoccod === geocerca.geoccod) {
            return `${baseIcon} text-orange-600 dark:text-orange-400`;
        }
        if (this.selectedGeocerca?.geoccod === geocerca.geoccod) {
            return `${baseIcon} text-primary-600 dark:text-primary-400`;
        }
        return `${baseIcon} text-surface-600 dark:text-surface-400`;
    }

// Clases del botón de editar
    getEditButtonClasses(geocerca: GeofenceDto): string {
        const isDisabled = this.getEditButtonDisabled(geocerca);
        const isEditing = this.editandoGeocerca && this.selectedGeocerca?.geoccod === geocerca.geoccod;

        if (isDisabled) {
            return 'bg-surface-100 dark:bg-surface-700 border-surface-200 dark:border-surface-600 cursor-not-allowed';
        }
        if (isEditing) {
            return 'bg-orange-50 dark:bg-orange-900/30 border-orange-200 dark:border-orange-700 hover:bg-orange-100 dark:hover:bg-orange-900/50';
        }
        return 'bg-white dark:bg-surface-800 border-surface-200 dark:border-surface-700 hover:bg-orange-50 dark:hover:bg-orange-900/30 hover:border-orange-300 dark:hover:border-orange-600';
    }

// Estado disabled del botón
    getEditButtonDisabled(geocerca: GeofenceDto): boolean {
        return !this.mapInitialized ||
            this.creandoGeocerca ||
            (this.editandoGeocerca && this.selectedGeocerca?.geoccod !== geocerca.geoccod);
    }

// Clases del icono de editar
    getEditIconClasses(geocerca: GeofenceDto): string {
        if (this.getEditButtonDisabled(geocerca)) {
            return 'text-surface-300 dark:text-surface-600';
        }
        if (this.editandoGeocerca && this.selectedGeocerca?.geoccod === geocerca.geoccod) {
            return 'text-orange-600 dark:text-orange-400';
        }
        return 'text-surface-600 dark:text-surface-400 hover:text-orange-600 dark:hover:text-orange-400';
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
    //=================================================================//

    //======= FUNCIONES PARA RESETEO DE MAPA/DATA =========================//
    resetMapView(): void {
        this.mapService.resetMapView();
    }

    refreshData(): void {
        this.loading = true;
        this.selectedGeocerca = null;
        this.geocercaDrawing.cancelarCreacion();
        this.getAllGeocercas();
        this.resetMapView();
    }

    //======= FUNCIONES GETTERS PARA OBTENER ESTADO DE GEOCERCA =================//

    getGeocercaStatusSeverity(geocerca: GeofenceDto): string {
        return geocerca.geocact ? 'success' : 'danger';
    }

    getGeocercaStatusText(geocerca: GeofenceDto): string {
        return geocerca.geocact ? 'Activa' : 'Inactiva';
    }


    //======= FUNCIONES PARA FORMATEO DE DATOS =========================//

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


    // =================== MÉTODOS PARA ELIMINACIÓN MÚLTIPLE ===================

        /**
         * Activar/desactivar modo eliminación
         */
        toggleModoEliminacion(): void {
            this.modoEliminacion = !this.modoEliminacion;

            if (!this.modoEliminacion) {
                // Al desactivar, limpiar selecciones
                this.limpiarSelecciones();
            }

            this.msgService.add({
                severity: this.modoEliminacion ? 'info' : 'success',
                summary: this.modoEliminacion ? 'Modo eliminación activado' : 'Modo eliminación desactivado',
                detail: this.modoEliminacion ? 'Seleccione las geocercas que desea eliminar' : 'Selección cancelada',
                life: 2000
            });
        }

        /**
         * Seleccionar/deseleccionar geocerca individual
         */
        toggleSeleccionGeocerca(geoccod: string): void {
            if (this.geocercasSeleccionadas.has(geoccod)) {
                this.geocercasSeleccionadas.delete(geoccod);
            } else {
                this.geocercasSeleccionadas.add(geoccod);
            }

            // Actualizar estado de "todas seleccionadas"
            this.actualizarEstadoTodasSeleccionadas();
        }

        /**
         * Seleccionar/deseleccionar todas las geocercas visibles
         */
        toggleSeleccionarTodas(): void {
            if (this.todasSeleccionadas) {
                // Deseleccionar todas
                this.limpiarSelecciones();
            } else {
                // Seleccionar todas las visibles
                this.paginatedGeocercas.forEach(geocerca => {
                    this.geocercasSeleccionadas.add(geocerca.geoccod);
                });
            }

            this.actualizarEstadoTodasSeleccionadas();
        }

        /**
         * Actualizar estado de todas seleccionadas
         */
        private actualizarEstadoTodasSeleccionadas(): void {
            const totalVisibles = this.paginatedGeocercas.length;
            const seleccionadasVisibles = this.paginatedGeocercas.filter(
                geocerca => this.geocercasSeleccionadas.has(geocerca.geoccod)
            ).length;

            this.todasSeleccionadas = totalVisibles > 0 && seleccionadasVisibles === totalVisibles;
        }

        /**
         * Verificar si una geocerca está seleccionada
         */
        estaSeleccionada(geoccod: string): boolean {
            return this.geocercasSeleccionadas.has(geoccod);
        }

        /**
         * Limpiar todas las selecciones
         */
        private limpiarSelecciones(): void {
            this.geocercasSeleccionadas.clear();
            this.todasSeleccionadas = false;
        }

        /**
         * Validar relaciones antes de eliminar geocercas
         */
        private async validarRelacionesGeocercas(): Promise<boolean>
        {
            const codigosSeleccionados = Array.from(this.geocercasSeleccionadas);
            const geocercasConRelacion: string[] = [];

            // Verificar cada geocerca seleccionada
            for (const codigo of codigosSeleccionados) {
                try {
                    await firstValueFrom(this.geocercaService.consultarGeocerca(codigo));
                    // Si llega aquí, significa que encontró relación (200)
                    const geocerca = this.geocercas.find(g => g.geoccod === codigo);
                    geocercasConRelacion.push(geocerca ? `${geocerca.geocnom} (${codigo})` : codigo);
                } catch (error: any) {
                    // Si es 404, no hay relación - se puede eliminar sin problema
                    if (error.status !== 404) {
                        // Si es otro error, mostrar mensaje
                        this.msgService.add({
                            severity: 'error',
                            summary: 'Error de validación',
                            detail: `Error al validar la geocerca ${codigo}`
                        });
                        return false;
                    }
                }
            }

            // Si hay geocercas con relación, mostrar advertencia
            if (geocercasConRelacion.length > 0) {
                return new Promise<boolean>((resolve) => {
                    this.confirmationService.confirm({
                        message: `<strong>¡ADVERTENCIA!</strong><br><br>Las siguientes geocercas tienen relaciones con vendedores:<br><br>${geocercasConRelacion.join('<br>')}<br><br>Eliminar estas geocercas también <strong>eliminará sus relaciones</strong>. ¿Desea continuar?`,
                        header: 'Geocercas con Relaciones Detectadas',
                        icon: 'pi pi-exclamation-triangle',
                        acceptLabel: 'Eliminar de todas formas',
                        rejectLabel: 'Cancelar',
                        acceptButtonStyleClass: 'p-button-danger',
                        accept: () => {
                            this.eliminarGeocercasSeleccionadas().then();
                        },
                        reject: () => {
                            resolve(false);
                        }
                    });
                });
            }
            return true;
        }

        /**
         * Confirmar eliminación de geocercas seleccionadas
         */
        async confirmarEliminacion(): Promise<void> {
            if (this.geocercasSeleccionadas.size === 0) {
                this.msgService.add({
                    severity: 'warn',
                    summary: 'Sin selección',
                    detail: 'Debe seleccionar al menos una geocerca para eliminar'
                });
                return;
            }

            // Validar relaciones primero
            const puedeEliminar = await this.validarRelacionesGeocercas();
            if (!puedeEliminar) {
                return; // El usuario canceló o hubo error
            }

            // Obtener nombres de las geocercas seleccionadas para mostrar en el diálogo
            const nombresSeleccionadas = this.geocercas
                .filter(g => this.geocercasSeleccionadas.has(g.geoccod))
                .map(g => `${g.geocnom} (${g.geoccod})`)
                .join(', ');

            this.confirmationService.confirm({
                message: `¿Está seguro que desea eliminar ${this.geocercasSeleccionadas.size} geocerca(s)?<br><br><strong>Geocercas seleccionadas:</strong><br>${nombresSeleccionadas}`,
                header: 'Confirmar Eliminación',
                icon: 'pi pi-exclamation-triangle',
                acceptLabel: 'Eliminar',
                rejectLabel: 'Cancelar',
                acceptButtonStyleClass: 'p-button-danger',
                accept: () => {
                    this.eliminarGeocercasSeleccionadas().then();
                }
            });
        }

        /**
         * Eliminar geocercas seleccionadas
         */
        private async eliminarGeocercasSeleccionadas(): Promise<void>
        {
            const codigosSeleccionados = Array.from(this.geocercasSeleccionadas);
            const totalSeleccionadas = codigosSeleccionados.length;

            this.msgService.add({
                severity: 'info',
                summary: 'Eliminando geocercas',
                detail: `Eliminando ${totalSeleccionadas} geocerca(s)...`
            });

            // Crear un array de promesas (todas se lanzan a la vez)
            const promesas = codigosSeleccionados.map(codigo =>
                firstValueFrom(this.geocercaService.eliminarGeocerca(codigo))
            );

            // Esperar a que todas terminen (éxito o error)
            const resultados = await Promise.allSettled(promesas);

            const eliminadas = resultados.filter(r => r.status === 'fulfilled').length;
            const errores = resultados.filter(r => r.status === 'rejected').length;

            // Mostrar resultado
            if (eliminadas > 0) {
                this.msgService.add({
                    severity: eliminadas === totalSeleccionadas ? 'success' : 'warn',
                    summary: `${eliminadas} geocerca(s) eliminada(s)`,
                    detail: errores > 0 ? `${errores} geocerca(s) no pudieron eliminarse` : 'Eliminación completada exitosamente'
                });
            }

            if (errores > 0 && eliminadas === 0) {
                this.msgService.add({
                    severity: 'error',
                    summary: 'Error en eliminación',
                    detail: 'No se pudo eliminar ninguna geocerca'
                });
            }

            this.limpiarSelecciones();
            this.modoEliminacion = false;
            this.refreshData();
        }

    /**
     * Getter para verificar si hay geocercas seleccionadas
     */
    get tieneSelecciones(): boolean {
        return this.geocercasSeleccionadas.size > 0;
    }


    ngOnDestroy(): void {
        this.destroy$.next();
        this.destroy$.complete();
        this.geocercaDrawing.destroy();
        this.mapService.destroyMap();
    }
}
