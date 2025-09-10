
export interface UbicacionDto {
    geubfech: string;
    geublat: number;
    geublon: number;
}

export interface GeocercaDto {
    geoccod: string;
    geocnom: string;
    geocsec: string;
    geocdirre: string;
    geocciud: string;
    geocprov: string;
    geocest: string;
    geocact: boolean;
    geocpri: number;
    geocarm: number;
    geocperm: number;
    geoclat: number;
    geocfcre: string;
    geoclon: number;
    fechaAsignacion: string;
    geoccoor: string;
}

export interface VendedorDto {
    codigoVendedor: string;
    nombreVendedor: string;
    emailVendedor: string;
    codigoVendedorSecundario: string;
    ubicacionActual: UbicacionDto;
    geocercas: GeocercaDto[];
    totalGeocercas: number;
}

export interface PaginacionDto {
    paginaActual: number;
    tamanioPagina: number;
    totalRegistros: number;
    totalPaginas: number;
}

export interface VendedoresResponse {
    data: VendedorDto[];
    paginacion: PaginacionDto;
}

export interface VendedoresQueryParams {
    pageNumber?: number;
    pageSize?: number;
    activo?: boolean;
    busqueda?: string;
}
