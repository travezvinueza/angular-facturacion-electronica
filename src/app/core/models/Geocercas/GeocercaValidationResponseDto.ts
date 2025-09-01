import { CoordenadaDto } from '@/core/models/Geocercas/GeocercaDto';

export interface GeocercaValidationResponse {
    success: boolean;
    message: string;
    data: {
        data: GeofenceDto[];
    };
    errorCode: string;
    validationErrors: any;
    timestamp: string;
    responseTimeMs: number;
    requestId: string;
}

export interface GeofenceDto {
    geoccod: string;
    geocnom: string;
    geocsec: string;
    geocdirre: string;
    geocciud: string;
    geocprov: string;
    geocpais: string;
    geoclat: number;
    geoclon: number;
    geoccoor: string;
    geocarm: number;
    geocperm: number;
    geocest: string;
    geocact: boolean;
    geocpri: number;
    geocfcre: string;
    geocdesc: string;
    geocuscre: string;
    geoceqcre: string;
}
export interface CreateGeofenceDto {
    geoccod: string;
    geocnom: string;
    geocsec: string;
    geocdirre: string;
    geocciud: string;
    geocprov: string;
    geocpais: string;
    geoclat: number;
    geoclon: number;
    geoccoor: CoordenadaDto[];
    geocarm: number;
    geocperm: number;
    geocest: string;
    geocact: boolean;
    geocpri: number;
    geocfcre: string;
    geocdesc: string;
    geocuscre: string;
    geoceqcre: string;
}
