export interface FilterRequest {
    mostrarvendedor: boolean;
    codusuario: string;
    codvendedor: string;
    fechainicio: string; // ISO date string
    tipotiempo: number;  // 0=segundos,1=minutos,...,6=año
    valortiempo: number; // valor asociado al tipo de tiempo
    clientes: number;    // 0=ninguno,1=todos,2=asignados
    geocercasif?: boolean;
    geocercas?: Geocerca[];
    transacciones: Transacciones;
    zonaclientes: ZonaClientes;
}

export interface Geocerca {
    // Definir campos cuando conozcas la estructura real de cada geocerca
}

export interface Transacciones {
    pedidos: boolean;
    cobros: boolean;
}

export interface ZonaClientes {
    codvend: string;
    latmax: number;
    latmin: number;
    lonmax: number;
    lonmin: number;
}
