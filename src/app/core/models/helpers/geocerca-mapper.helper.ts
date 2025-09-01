import { CreateGeofenceDto, GeofenceDto } from '@/core/models/Geocercas/GeocercaValidationResponseDto';
import { CoordenadaDto } from '@/core/models/Geocercas/GeocercaDto';

export interface AdditionalGeocercaData {
    centroGeocerca: { lat: number; lng: number };
    coordenadasParaCalculo: CoordenadaDto[]; // ✅ Usar la interface
    area: number;
    perimetro: number;
    usuario: string;
    empresa: string;
    tipoGeocerca: 'circular' | 'poligono';
    radio?: number; // Para círculos
}

export class GeocercaMapper {

    /**
     * Mapear datos del formulario y drawing service a GeofenceDto
     */
    static mapToDto(formData: any, additional: AdditionalGeocercaData): CreateGeofenceDto {
        // Validaciones básicas
        if (!formData || !additional || !additional.centroGeocerca) {
            throw new Error('Datos insuficientes para crear la geocerca');
        }

        return {
            geoccod: formData.geoccod?.trim() || '',
            geocnom: formData.geocnom?.trim() || '',
            geocdirre: formData.geocdirre?.trim() || '',

            // Extraer valores de objetos o strings
            geocsec: this.extractValue(formData.geocsec, 'parroquia'),
            geocciud: this.extractValue(formData.geocciud, 'canton'),
            geocprov: this.extractValue(formData.geocprov, 'provincia'),

            geocpais: formData.geocpais || 'ECUADOR',

            // Coordenadas del centro
            geoclat: this.roundCoordinate(additional.centroGeocerca.lat),
            geoclon: this.roundCoordinate(additional.centroGeocerca.lng),

            // Geometría
            geoccoor: additional.coordenadasParaCalculo,
            geocarm: Math.round(additional.area), // Área en m²
            geocperm: Math.round(additional.perimetro), // Perímetro en m

            // Metadatos
            geocpri: formData.geocpri || 5,
            geocact: formData.geocact !== undefined ? formData.geocact : true,
            geocdesc: formData.geocdesc?.trim() || '',

            // Campos de auditoría - mejorados
            geocfcre: this.getCurrentTimestamp(),
            geocuscre: additional.usuario,
            geoceqcre: additional.empresa,
            geocest: 'A', // Estado activo por defecto

        };
    }

    /**
     * Extraer valor de objeto o retornar string si ya es string
     */
    private static extractValue(value: any, property: string): string {
        if (!value) return '';

        if (typeof value === 'string') {
            return value.trim();
        }

        if (typeof value === 'object' && value[property]) {
            return value[property].trim();
        }

        return '';
    }

    /**
     * Redondear coordenadas a 6 decimales para consistencia
     */
    private static roundCoordinate(coordinate: number): number {
        return Math.round(coordinate * 1000000) / 1000000;
    }

    /**
     * Obtener timestamp actual en formato ISO
     */
    private static getCurrentTimestamp(): string {
        return new Date().toISOString();
    }

    /**
     * Validar que los datos mínimos estén presentes
     */
    static validate(formData: any, additional: AdditionalGeocercaData): string[] {
        const errors: string[] = [];

        // Validaciones de formulario
        if (!formData.geoccod?.trim()) {
            errors.push('Código de geocerca es requerido');
        }

        if (!formData.geocnom?.trim()) {
            errors.push('Nombre de geocerca es requerido');
        }

        if (!formData.geocdirre?.trim()) {
            errors.push('Dirección de referencia es requerida');
        }

        // Validaciones de ubicación
        if (!this.extractValue(formData.geocprov, 'provincia')) {
            errors.push('Provincia es requerida');
        }

        if (!this.extractValue(formData.geocciud, 'canton')) {
            errors.push('Ciudad es requerida');
        }

        if (!this.extractValue(formData.geocsec, 'parroquia')) {
            errors.push('Sector es requerido');
        }

        // Validaciones de geometría
        if (!additional.centroGeocerca) {
            errors.push('Centro de geocerca no definido');
        }

        if (!additional.coordenadasParaCalculo) {
            errors.push('Coordenadas de geocerca no definidas');
        }

        if (!additional.area || additional.area <= 0) {
            errors.push('Área de geocerca inválida');
        }

        return errors;
    }

    /**
     * Formatear coordenadas para envío al backend
     */
    static formatCoordinatesForBackend(coordinates: Array<{lat: number, lng: number}>): CoordenadaDto[] {
        return coordinates.map(coord => ({
            lat: this.roundCoordinate(coord.lat),
            lng: this.roundCoordinate(coord.lng)
        }));
    }
    /**
     * Calcular perímetro de polígono usando coordenadas
     */
    static calculatePerimeter(coordinates: Array<{lat: number, lng: number}>): number {
        if (coordinates.length < 2) return 0;

        let perimeter = 0;
        for (let i = 0; i < coordinates.length; i++) {
            const current = coordinates[i];
            const next = coordinates[(i + 1) % coordinates.length];

            // Usar fórmula haversine para distancia más precisa
            perimeter += this.haversineDistance(
                current.lat, current.lng,
                next.lat, next.lng
            );
        }

        return perimeter;
    }

    /**
     * Calcular área usando fórmula de shoelace (más precisa)
     */
    static calculateArea(coordinates: Array<{lat: number, lng: number}>): number {
        if (coordinates.length < 3) return 0;

        let area = 0;
        for (let i = 0; i < coordinates.length; i++) {
            const current = coordinates[i];
            const next = coordinates[(i + 1) % coordinates.length];

            area += (current.lng * next.lat) - (next.lng * current.lat);
        }

        // Convertir a metros cuadrados (aproximación)
        const areaInDegrees = Math.abs(area) / 2;
        return areaInDegrees * 111000 * 111000;
    }

    /**
     * Calcular distancia haversine entre dos puntos
     */
    private static haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
        const R = 6371000; // Radio de la Tierra en metros
        const dLat = this.toRadians(lat2 - lat1);
        const dLng = this.toRadians(lng2 - lng1);

        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(this.toRadians(lat1)) * Math.cos(this.toRadians(lat2)) *
            Math.sin(dLng / 2) * Math.sin(dLng / 2);

        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    }

    /**
     * Convertir grados a radianes
     */
    private static toRadians(degrees: number): number {
        return degrees * (Math.PI / 180);
    }
}
