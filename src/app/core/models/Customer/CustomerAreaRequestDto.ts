export interface CustomerAreaRequestDto {
    clientes: {
        tipoelementos: number;
        codvendedor: string;
    };
    zonasbusqueda: {
        latmax: number;
        latmin: number;
        lonmax: number;
        lonmin: number;
    };
}
