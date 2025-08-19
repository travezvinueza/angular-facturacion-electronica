export interface Parroquia {
    codigo: string;
    parroquia: string;
}

export interface Canton {
    codigo: string;
    canton: string;
    parroquias: Parroquia[];
}

export interface Provincia {
    codigo: string;
    provincia: string;
    cantones: Canton[];
}
