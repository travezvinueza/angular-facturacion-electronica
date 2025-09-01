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
import { MessageService } from 'primeng/api';
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
    map: L.Map | null = null;
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
    itemsPerPage: number = 4;
    enterpriseName: string = '';     // Propiedades de empresa



    constructor(
        private readonly geocercaService: GeocercaService,
        private readonly fb: FormBuilder,
        private readonly authService: AuthService,
        private readonly msgService: MessageService,
        private readonly mapService: MapService,
        private readonly provinceService: ProvinceService,
        private readonly geocercaDrawing: GeocercaDrawingService
    ) {}


    //============== MÉTODOS DE INICIALIZACIÓN ===================

    async initializeMap(): Promise<void> {
        try {
            await this.mapService.initializeMap(this.mapContainer, {
                center: [-0.2298, -78.5249],
                zoom: 13,
                defaultLocation: 'Quito, Ecuador'
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
        // Estado de inicialización del mapa
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

    /**
     * Extraer mensaje de código existente
     */
    private extractCodeExistsMessage(fullMessage: string): string {
        const match = fullMessage.match(/'([^']+)'/);
        if (match) {
            const code = match[1];
            return `Código '${code}' ya está en uso`;
        }
        return 'Este código ya está en uso';
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

    //MÉTODO PARA CREAR GEOCERCAS//

    /**
     * Verifica si la geocerca actual se puede finalizar
     */
    get puedeFinalizarGeocerca(): boolean {
        return !!this.centroGeocerca && (this.tipoGeocerca === 'circular' || (this.tipoGeocerca === 'poligono' && this.coordenadasGeocerca.length >= 3));
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
        this.geocercaDrawing.cancelarCreacion();

        this.msgService.add({
            severity: 'info',
            summary: 'Dibujo limpiado',
            detail: 'Se ha limpiado el dibujo actual'
        });
    }

    /**
     * Cancelar creación de geocerca
     */
    cancelarCreacionGeocerca(): void {
        this.geocercaDrawing.cancelarCreacion();

        this.msgService.add({
            severity: 'info',
            summary: 'Creación cancelada',
            detail: 'Se ha cancelado la creación de la geocerca'
        });
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
            // CAMBIO: No llamar finalizarGeocerca todavía, solo validar
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

            // Debug para ver qué está pasando
            console.log('Centro:', additionalData.centroGeocerca);
            console.log('Área calculada:', area);
            console.log('Coordenadas:', this.drawingState.coordenadas.length);

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
                            // AHORA SÍ finalizar y limpiar
                            this.geocercaDrawing.finalizarGeocerca(geocercaDto.geocnom);

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


    //=================================================================//


    //======= FUNCIÓN PARA OBTENER TODAS LAS GEOCERCAS ===================//
    getAllGeocercas(): void {
        if (!this.enterpriseName) {
            this.loading = false;
            return;
        }

        this.loading = true;
        this.geocercaService.getOnlyGeocercasByEnterpriseName(this.enterpriseName, 1, 50, true).subscribe({
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

    //=================================================================//



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

    //=================================================================//

    //======= FUNCIONES GETTERS PARA OBTENER ESTADO DE GEOCERCA =================//

    getGeocercaStatusSeverity(geocerca: GeofenceDto): string {
        return geocerca.geocact ? 'success' : 'danger';
    }

    getGeocercaStatusText(geocerca: GeofenceDto): string {
        return geocerca.geocact ? 'Activa' : 'Inactiva';
    }

    //=================================================================//

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

    //=================================================================//


    ngOnDestroy(): void {
        this.destroy$.next();
        this.destroy$.complete();
        this.geocercaDrawing.destroy();
        this.mapService.destroyMap();
    }
}
