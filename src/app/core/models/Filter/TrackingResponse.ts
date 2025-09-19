export interface TrackingResponse {
    ubicaciones: UserLocationDto[];
    clientes: ClientDto[];
    cobros: ChargeDto[];
    pedidos: OrderDto[];
}

export interface LocationDto {
    latitud: number;
    longitud: number;
    tiempo: string; // ISO string, e.g., "2025-09-15T14:42:05"
}

export interface UserLocationDto {
    usuario: string;
    ubicaciones: LocationDto[];
}

export interface ClientDto {
    dirclave: string;
    dirnombre: string;
    dirruc: string;
    dirclave1: string;
    asignado: boolean;
    numdire: number;
    dirdirec: string;
    latitud: number;
    longitud: number;
}

export interface ChargeDto {
    cabnumero: number;
    cabclave1: string;
    cabfecha: string; // ISO string, e.g., "2025-08-16T00:00:00"
    cabnvendedor: string;
    cabnrecibo: string;
    cabsucu: string;
    cablat: number;
    cablon: number;
}

export interface OrderDto {
    pdtfactura: number;
    pdttd: string;
    pdtfechaf: string; // ISO string, e.g., "2025-08-18T10:39:22"
    pdtnombre: string;
    pdtclave: string;
    pdtclave1: string;
    pdtlat: number;
    pdtlon: number;
}
