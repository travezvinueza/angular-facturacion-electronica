export interface LoginDto {
    token: string;
    listado: Array<{
        id: number;
        nomempresa: string;
        flag: boolean;
    }>;
}
export interface JwtPayload {
    usuario: string;
    nbf: number;
    exp: number;
    iat: number;
}

export interface TokenEmpresaDto {
    token: string;
}

