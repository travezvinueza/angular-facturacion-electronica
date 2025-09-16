import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { MessageService } from 'primeng/api';
import * as L from 'leaflet';
import { GeocercaDrawing, GeocercaDrawingState } from '@/core/models/Draw/DrawingCoordinate';

@Injectable({
    providedIn: 'root'
})
export class GeocercaDrawingService {
    private map: L.Map | null = null;
    private dibujoLayer: L.FeatureGroup | null = null;

    // Estado del dibujo actual
    private estadoDibujo: GeocercaDrawingState = {
        creando: false,
        tipo: null,
        coordenadas: [],
        centro: null
    };

    // Arrays para manejo de elementos temporales
    private marcadoresPuntos: L.Marker[] = [];
    private lineasTemporales: L.Polyline[] = [];
    private formaActual: L.Layer | null = null;

    // Configuración para círculos
    private radioGeocerca = 500; // metros por defecto

    // Estados reactivos
    private drawing$ = new BehaviorSubject<GeocercaDrawingState>(this.estadoDibujo);
    private geocercaDrawing$ = new BehaviorSubject<GeocercaDrawing[]>([]);

    // Colección de geocercas creadas
    private geocercasCreadas: Map<string, GeocercaDrawing> = new Map();

    constructor(private msgService: MessageService) {}

    // Observables públicos
    get drawingState$(): Observable<GeocercaDrawingState> {
        return this.drawing$.asObservable();
    }

    get geocercas$(): Observable<GeocercaDrawing[]> {
        return this.geocercaDrawing$.asObservable();
    }

    /**
     * Inicializar servicio con el mapa
     */
    initialize(map: L.Map): void {
        this.map = map;

        // Crear layer para dibujo
        this.dibujoLayer = L.featureGroup().addTo(this.map);

        console.log('GeocercaDrawingService inicializado');
    }

    /**
     * Iniciar creación de geocerca - adaptando tu configurarEventosMapa()
     */
    iniciarCreacionGeocerca(tipo: 'circular' | 'poligono'): void {
        if (!this.map) {
            this.msgService.add({
                severity: 'error',
                summary: 'Error',
                detail: 'Mapa no inicializado'
            });
            return;
        }

        // Limpiar estado anterior
        this.cancelarCreacion();

        // Configurar estado
        this.estadoDibujo = {
            creando: true,
            tipo,
            coordenadas: [],
            centro: null
        };

        // Configurar eventos del mapa según tipo (tu lógica)
        this.configurarEventosMapa(tipo);

        this.drawing$.next(this.estadoDibujo);

        this.msgService.add({
            severity: 'info',
            summary: 'Modo dibujo activado',
            detail: `Haga clic en el mapa para crear una geocerca ${tipo}`
        });
    }

    /**
     * Configurar eventos del mapa - Tu función adaptada
     */
    private configurarEventosMapa(tipo: 'circular' | 'poligono'): void {
        if (!this.map) return;

        // Limpiar eventos anteriores
        this.map.off('click');

        setTimeout(() => {
            if (tipo === 'circular') {
                console.log('Configurando eventos para CÍRCULO');
                this.map!.on('click', this.onMapClickCircular.bind(this));
            } else {
                console.log('Configurando eventos para POLÍGONO');
                this.map!.on('click', this.onMapClickPoligono.bind(this));
            }
        }, 100);
    }

    /**
     * Handle click para círculo
     */
    private onMapClickCircular(e: L.LeafletMouseEvent): void {
        if (!this.estadoDibujo.creando) return;

        const { lat, lng } = e.latlng;
        this.estadoDibujo.centro = { lat, lng };

        // Limpiar forma anterior
        if (this.formaActual && this.dibujoLayer) {
            this.dibujoLayer.removeLayer(this.formaActual);
        }

        // Crear círculo visual
        this.formaActual = L.circle([lat, lng], {
            radius: this.radioGeocerca,
            color: '#3b82f6',
            fillColor: '#3b82f6',
            fillOpacity: 0.2
        });

        this.dibujoLayer!.addLayer(this.formaActual);

        // Generar coordenadas usando tu función
        this.generarCoordenadasCirculo(lat, lng, this.radioGeocerca);

        // Actualizar estado
        this.estadoDibujo.coordenadas = [...this.estadoDibujo.coordenadas];
        this.drawing$.next(this.estadoDibujo);

        this.msgService.add({
            severity: 'success',
            summary: 'Geocerca circular creada',
            detail: 'Ajuste el radio si es necesario y proceda a guardar'
        });
    }

    /**
     * Handle click para polígono
     */
    private onMapClickPoligono(e: L.LeafletMouseEvent): void {
        if (!this.estadoDibujo.creando) return;

        const { lat, lng } = e.latlng;
        this.estadoDibujo.coordenadas.push({ lat, lng });

        // Agregar marcador
        this.agregarMarcadorPunto(lat, lng, this.estadoDibujo.coordenadas.length);

        // Actualizar polígono
        this.actualizarPoligono();

        // Actualizar estado reactivo
        this.drawing$.next(this.estadoDibujo);

        this.msgService.add({
            severity: 'info',
            summary: `Punto ${this.estadoDibujo.coordenadas.length} agregado`,
            detail: this.estadoDibujo.coordenadas.length >= 3 ?
                'Ya puede continuar o agregar más puntos' :
                `Necesita ${3 - this.estadoDibujo.coordenadas.length} puntos más`
        });
    }

    /**
     * Agregar marcador de punto
     */
    private agregarMarcadorPunto(lat: number, lng: number, numero: number): void {
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

        // Eventos de drag
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
                this.estadoDibujo.coordenadas[index] = {
                    lat: newPos.lat,
                    lng: newPos.lng
                };

                this.actualizarPoligono();
                this.drawing$.next(this.estadoDibujo);

                marcador.setTooltipContent(`Punto ${numero}<br>Lat: ${newPos.lat.toFixed(6)}<br>Lng: ${newPos.lng.toFixed(6)}`);

                this.msgService.add({
                    severity: 'success',
                    summary: `Punto ${numero} movido`,
                    detail: `Nueva posición: ${newPos.lat.toFixed(6)}, ${newPos.lng.toFixed(6)}`
                });
            }
        });
    }

    /**
     * Crear líneas punteadas
     */
    private crearLineasPunteadas(): void {
        if (this.estadoDibujo.coordenadas.length < 2) return;

        for (let i = 0; i < this.estadoDibujo.coordenadas.length; i++) {
            const punto1 = this.estadoDibujo.coordenadas[i];
            const punto2 = this.estadoDibujo.coordenadas[(i + 1) % this.estadoDibujo.coordenadas.length];

            if (this.estadoDibujo.coordenadas.length >= 3 || i < this.estadoDibujo.coordenadas.length - 1) {
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

    /**
     * Actualizar polígono
     */
    private actualizarPoligono(): void {
        if (this.estadoDibujo.coordenadas.length < 2) return;

        // Limpiar forma anterior
        if (this.formaActual && this.dibujoLayer) {
            this.dibujoLayer.removeLayer(this.formaActual);
        }

        // Limpiar líneas temporales
        this.lineasTemporales.forEach((linea) => {
            if (this.dibujoLayer) {
                this.dibujoLayer.removeLayer(linea);
            }
        });
        this.lineasTemporales = [];

        // Crear líneas punteadas
        this.crearLineasPunteadas();

        // Crear polígono si hay suficientes puntos
        if (this.estadoDibujo.coordenadas.length >= 3) {
            const latLngs = this.estadoDibujo.coordenadas.map((coord) => [coord.lat, coord.lng] as L.LatLngTuple);

            const polygon = L.polygon(latLngs, {
                stroke: false,
                fillColor: '#8b5cf6',
                fillOpacity: 0.15
            });

            this.formaActual = polygon;
            this.dibujoLayer!.addLayer(polygon);
        }

        // Calcular centro
        this.calcularCentroPoligono();
    }

    /**
     * Calcular centro del polígono
     */
    private calcularCentroPoligono(): void {
        if (this.estadoDibujo.coordenadas.length === 0) return;

        const sumLat = this.estadoDibujo.coordenadas.reduce((sum, coord) => sum + coord.lat, 0);
        const sumLng = this.estadoDibujo.coordenadas.reduce((sum, coord) => sum + coord.lng, 0);

        this.estadoDibujo.centro = {
            lat: sumLat / this.estadoDibujo.coordenadas.length,
            lng: sumLng / this.estadoDibujo.coordenadas.length
        };
    }

    /**
     * Generar coordenadas de círculo
     */
    private generarCoordenadasCirculo(lat: number, lng: number, radio: number): void {
        this.estadoDibujo.coordenadas = [];
        const puntos = 32;

        for (let i = 0; i < puntos; i++) {
            const angulo = (i * 2 * Math.PI) / puntos;

            const deltaLat = (radio / 111320) * Math.cos(angulo);
            const deltaLng = (radio / (111320 * Math.cos((lat * Math.PI) / 180))) * Math.sin(angulo);

            this.estadoDibujo.coordenadas.push({
                lat: lat + deltaLat,
                lng: lng + deltaLng
            });
        }
    }

    /**
     * Calcular área usando la fórmula de Shoelace
     */
    private calcularArea(): number {
        if (this.estadoDibujo.coordenadas.length < 3) return 0;

        let area = 0;
        const coords = this.estadoDibujo.coordenadas;

        for (let i = 0; i < coords.length; i++) {
            const j = (i + 1) % coords.length;
            area += coords[i].lng * coords[j].lat;
            area -= coords[j].lng * coords[i].lat;
        }

        return Math.abs(area / 2) * 111000 * 111000; // Aproximado en m²
    }

    /**
     * Finalizar y guardar geocerca
     */
    finalizarGeocerca(): GeocercaDrawing | null {
        if (!this.estadoDibujo.creando || !this.estadoDibujo.centro) {
            return null;
        }

        if (this.estadoDibujo.tipo === 'poligono' && this.estadoDibujo.coordenadas.length < 3) {
            return null;
        }

        // Crear objeto geocerca
        const geocerca: GeocercaDrawing = {
            id: this.generarId(),
            tipo: this.estadoDibujo.tipo!,
            coordenadas: [...this.estadoDibujo.coordenadas],
            centro: { ...this.estadoDibujo.centro },
            area: this.calcularArea(),
            radio: this.estadoDibujo.tipo === 'circular' ? this.radioGeocerca : undefined,
            activa: true,
            fechaCreacion: new Date()
        };

        // Guardar geocerca
        this.geocercasCreadas.set(geocerca.id, geocerca);
        this.geocercaDrawing$.next(Array.from(this.geocercasCreadas.values()))

        return geocerca;
    }


    /**
     * Cancelar creación actual
     */
    cancelarCreacion(): void {
        // Limpiar eventos del mapa
        if (this.map) {
            this.map.off('click');
        }

        // Limpiar elementos temporales
        this.limpiarElementosTemporales();

        // Resetear estado
        this.estadoDibujo = {
            creando: false,
            tipo: null,
            coordenadas: [],
            centro: null
        };

        this.drawing$.next(this.estadoDibujo);
    }
    cancelarEdicion(): void {
        // Limpiar eventos del mapa
        if (this.map) {
            this.map.off('click');
        }

        // Limpiar elementos temporales
        this.limpiarElementosTemporales();

        // Resetear estado
        this.estadoDibujo = {
            creando: false,
            tipo: null,
            coordenadas: [],
            centro: null
        };

        this.drawing$.next(this.estadoDibujo);
    }

    /**
     * Limpiar elementos temporales del dibujo
     */
    private limpiarElementosTemporales(): void {
        // Limpiar marcadores de puntos
        this.marcadoresPuntos.forEach(marcador => {
            if (this.dibujoLayer) {
                this.dibujoLayer.removeLayer(marcador);
            }
        });
        this.marcadoresPuntos = [];

        // Limpiar líneas temporales
        this.lineasTemporales.forEach(linea => {
            if (this.dibujoLayer) {
                this.dibujoLayer.removeLayer(linea);
            }
        });
        this.lineasTemporales = [];

        // Limpiar forma actual
        if (this.formaActual && this.dibujoLayer) {
            this.dibujoLayer.removeLayer(this.formaActual);
            this.formaActual = null;
        }
    }

    /**
     * Cambiar radio del círculo
     */
    cambiarRadioCirculo(nuevoRadio: number): void {
        if (this.estadoDibujo.tipo === 'circular' && this.estadoDibujo.centro) {
            this.radioGeocerca = nuevoRadio;
            this.generarCoordenadasCirculo(
                this.estadoDibujo.centro.lat,
                this.estadoDibujo.centro.lng,
                nuevoRadio
            );

            // Actualizar visualización
            if (this.formaActual && this.dibujoLayer) {
                this.dibujoLayer.removeLayer(this.formaActual);

                this.formaActual = L.circle([this.estadoDibujo.centro.lat, this.estadoDibujo.centro.lng], {
                    radius: nuevoRadio,
                    color: '#3b82f6',
                    fillColor: '#3b82f6',
                    fillOpacity: 0.2
                });

                this.dibujoLayer.addLayer(this.formaActual);
            }

            this.drawing$.next(this.estadoDibujo);
        }
    }

    /**
     * Generar ID único
     */
    private generarId(): string {
        return `geocerca_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }


    /**
     * Cargar geocerca existente para edición
     */
    cargarGeocercaParaEdicion(
        tipo: 'circular' | 'poligono',
        coordenadas: Array<{lat: number, lng: number}>,
        centro: {lat: number, lng: number},
        radio?: number
    ): void {
        if (!this.map) return;

        // Limpiar estado actual
        this.cancelarCreacion();

        // Configurar estado para edición
        this.estadoDibujo = {
            creando: true,
            tipo: tipo,
            coordenadas: [...coordenadas],
            centro: { ...centro }
        };

        // Configurar eventos del mapa
        this.configurarEventosMapa(tipo);

        // Si es circular, configurar radio
        if (tipo === 'circular' && radio) {
            this.radioGeocerca = radio;
        }

        // Dibujar geocerca existente en el mapa
        this.dibujarGeocercaExistente();

        // Actualizar estado reactivo
        this.drawing$.next(this.estadoDibujo);
    }

    private dibujarGeocercaExistente(): void
    {
        if (!this.map || !this.estadoDibujo.coordenadas.length) return;

        this.limpiarElementosTemporales();

        if (this.estadoDibujo.tipo === 'circular') {
            this.dibujarCirculoExistente();

        }else{
            this.dibujarPoligonoExistente();

        }
    }

    private dibujarCirculoExistente(): void
    {
        if (!this.estadoDibujo.centro || !this.dibujoLayer) return;

        this.formaActual = L.circle([this.estadoDibujo.centro.lat, this.estadoDibujo.centro.lng], {
            radius: this.radioGeocerca,
            color: '#3b82f6',
            fillColor: '#3b82f6',
            fillOpacity: 0.2
        });
        this.dibujoLayer.addLayer(this.formaActual);
    }

    private dibujarPoligonoExistente(): void
    {
        this.estadoDibujo.coordenadas.forEach((coord, index) => {
            this.agregarMarcadorPunto(coord.lat, coord.lng, index + 1);
        });
        this.actualizarPoligono();

    }




    /**
     * Destruir el servicio
     */
    destroy(): void {
        this.cancelarCreacion();

        // Limpiar capa de dibujo del mapa
        if (this.dibujoLayer && this.map) {
            this.map.removeLayer(this.dibujoLayer);
            this.dibujoLayer = null;
        }

        // Limpiar colecciones y mapas
        this.geocercasCreadas.clear();
        this.marcadoresPuntos = [];
        this.lineasTemporales = [];
        this.formaActual = null;

        // Resetear estado
        this.estadoDibujo = {
            creando: false,
            tipo: null,
            coordenadas: [],
            centro: null
        };

        this.drawing$.complete();
        this.geocercaDrawing$.complete();
        this.map = null;

    }
}
