export interface UserDto {
    usucod: string;
    usunombre: string;
    usuemail: string;
    usuestado: number; // 0 = Activo, 1 = Inactivo, 2 = Bloqueado
    usuapp: boolean; // true si tiene acceso a la app móvil
    usuwebapp: boolean; // true si tiene acceso a la web
    usucodv: string;
    usugeol: boolean; // true si tiene acceso a la geolocalización
}
