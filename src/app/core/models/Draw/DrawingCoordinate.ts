export interface GeocercaCoordinate {
    lat: number;
    lng: number;
}

export interface GeocercaDrawing {
    id: string;
    tipo: 'circular' | 'poligono';
    coordenadas: GeocercaCoordinate[];
    centro: GeocercaCoordinate;
    area: number;
    radio?: number; // Para círculos
    activa: boolean;
    fechaCreacion: Date;
}

export interface GeocercaDrawingState {
    creando: boolean;
    tipo: 'circular' | 'poligono' | null;
    coordenadas: GeocercaCoordinate[];
    centro: GeocercaCoordinate | null;
}
