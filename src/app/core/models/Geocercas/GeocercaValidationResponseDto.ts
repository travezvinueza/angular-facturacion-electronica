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
}
