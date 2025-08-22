import { Injectable } from '@angular/core';
import provinciasData from '../../../assets/data/provincias.json';
import { Canton, Parroquia, Provincia } from '@/core/models/ProvinciaDto';


@Injectable({
  providedIn: 'root'
})
export class ProvinceService {
    private provinciasList: Provincia[] = [];

    constructor() {
        this.procesarDatosProvincias();
    }

    private procesarDatosProvincias(): void {
        if (!provinciasData) {
            console.error('Error: No hay datos de provincias para procesar');
            return;
        }

        this.provinciasList = Object.keys(provinciasData).map(provinciaId => {
            const provinciaData = (provinciasData as any)[provinciaId];

            const cantones: Canton[] = provinciaData.cantones
                ? Object.keys(provinciaData.cantones).map(cantonId => {
                    const cantonData = provinciaData.cantones[cantonId];

                    const parroquias: Parroquia[] = cantonData.parroquias
                        ? Object.keys(cantonData.parroquias).map(parroquiaId => ({
                            codigo: parroquiaId,
                            parroquia: cantonData.parroquias[parroquiaId]
                        }))
                        : [];

                    return {
                        codigo: cantonId,
                        canton: cantonData.canton,
                        parroquias
                    };
                })
                : [];

            return {
                codigo: provinciaId,
                provincia: provinciaData.provincia,
                cantones
            };
        });
    }

    // ========== Métodos públicos ==========
    getProvincias(): Provincia[] {
        return this.provinciasList;
    }

    getCantones(provinciaCodigo: string): Canton[] {
        return this.provinciasList.find(p => p.codigo === provinciaCodigo)?.cantones || [];
    }

    getParroquias(provinciaCodigo: string, cantonCodigo: string): Parroquia[] {
        const cantones = this.getCantones(provinciaCodigo);
        return cantones.find(c => c.codigo === cantonCodigo)?.parroquias || [];
    }

    filtrarProvincias(query: string): Provincia[] {
        query = query.toLowerCase();
        return this.provinciasList.filter(p =>
            p.provincia.toLowerCase().includes(query)
        );
    }

    filtrarCantones(cantones: Canton[], query: string): Canton[] {
        query = query.toLowerCase();
        return cantones.filter(c =>
            c.canton.toLowerCase().includes(query)
        );
    }

    filtrarParroquias(parroquias: Parroquia[], query: string): Parroquia[] {
        query = query.toLowerCase();
        return parroquias.filter(p =>
            p.parroquia.toLowerCase().includes(query)
        );
    }

}
