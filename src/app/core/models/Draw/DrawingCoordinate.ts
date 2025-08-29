export interface DrawingCoordinate {
    lat: number;
    lng: number;
}

export interface GeocercaDrawingData {
    tipo: 'circular' | 'poligonal';
    nombre?: string;
    coordenadas: DrawingCoordinate[];
    centro?: DrawingCoordinate;
    radio?: number; // Solo para círculos
    area: number;
    perimetro: number;
}

export interface DrawingState {
    isActive: boolean;
    mode: 'circular' | 'poligonal' | null;
    isDrawing: boolean;
    currentData: GeocercaDrawingData | null;
}

export enum DrawingMode {
    CIRCULAR = 'circular',
    POLIGONAL = 'poligonal'
}
