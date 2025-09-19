export interface FilterRequest {
    usuarios: UsuariosFilter;
    transacciones: TransaccionesFilter;
    lapzotiempo: TiempoFilter;
    clientes: ClientesFilter;
    zonasbusqueda: ZonaBusquedaFilter;
}

export interface UsuariosFilter {
    tipoelementos: number;
    usuarios: string[];
    buscaxzona: number;
}

export interface TransaccionesFilter {
    codvendedor: string;
    cobros: boolean;
    pedidos: boolean;
}

export interface TiempoFilter {
    tipofiltro: number;
    fechainicio: string;
    fechafinal?: string;
    tipotiempo: number;
    valortiempo: number;
}

export interface ClientesFilter {
    tipoelementos: number;
    codvendedor: string;
}

export interface ZonaBusquedaFilter {
    latmax: number;
    latmin: number;
    lonmax: number;
    lonmin: number;
}
