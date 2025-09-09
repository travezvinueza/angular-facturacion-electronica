export interface UbicacionDto {
    geubfech: string;  // Fecha de la última ubicación
    geublat: number;   // Latitud
    geublon: number;   // Longitud
}

export interface UserDto {
    usucod: string;
    usunombre: string;
    usuemail: string;
    usucodv: string;
    ubicacion: UbicacionDto;
}
