export interface CoordenadaDto {
    lat: number;
    lng: number;
}

export interface VendedorGeocercaDto {
    geugidv: string;
    geuglat: number;
    geuglon: number;
    geuguscre: string;
    geugeqcre: string;
}

export interface CrearGeocercaDto {
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
    geocdesc: string;
    geocuscre: string;
    geoceqcre: string;
    vendedores: VendedorGeocercaDto[];
    validarVendedoresDuplicados: boolean;
}

export interface GeocercaResponseDto {
    success: boolean;
    message: string;
    data?: any;
}
export interface ActualizarGeocercaDto {
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
    geocdesc: string;
    geocusedi: string;
    geoceqedi: string;
}
