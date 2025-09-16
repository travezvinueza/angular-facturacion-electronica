import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ActualizarGeocercaDto, CrearGeocercaDto, GeocercaResponseDto } from '../models/Geocercas/GeocercaDto';
import { AuthService } from './auth.service';
import { environment } from '../../../environments/environment';
import { CreateGeofenceDto, GeocercaValidationResponse, GeofenceDto } from '@/core/models/Geocercas/GeocercaValidationResponseDto';
import { AsignarGeocercaDto } from '@/core/models/AsignarGeocercaDto';

@Injectable({
    providedIn: 'root'
})
export class GeocercaService {
    private readonly baseUrl = environment.apiUrl2;
    private readonly authService = inject(AuthService);

    constructor(private readonly http: HttpClient) { }


    consultarGeocerca(codigoGeocerca: string): Observable<GeocercaResponseDto> {
        const token = this.authService.getToken();
        const headers = new HttpHeaders({
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        });
        return this.http.get<GeocercaResponseDto>(`${this.baseUrl}/ConsultarRelacion/${codigoGeocerca}`, { headers });
    }

    desvincularGeocerca(codigoGeocerca: string): Observable<void> {
        const token = this.authService.getToken();
        const headers = new HttpHeaders({
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        });
        return this.http.patch<void>(`${this.baseUrl}/desvincular-vendedor/${codigoGeocerca}`, { headers });
    }

    assignGeocercaToUser(codigoGeocerca: string, dto: AsignarGeocercaDto): Observable<any> {
        const token = this.authService.getToken();
        const headers = new HttpHeaders({
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        });

        return this.http.post<any>(`${this.baseUrl}/asignar-vendedor/${codigoGeocerca}`, dto, { headers });
    }


    getGeocercasConVendedoresByEnterpriseName(
        enterpriseName: string,
        pageNumber: number = 1,
        pageSize: number = 10,
        activo: boolean = true,
        soloConVendedores: boolean = true
    ): Observable<GeocercaValidationResponse> {
        const token = this.authService.getToken();
        const headers = new HttpHeaders({
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        });

        const params = new HttpParams()
            .set('pageNumber', pageNumber)
            .set('pageSize', pageSize)
            .set('activo', activo)
            .set('soloConVendedores', soloConVendedores)
            .set('nameEnterprise', enterpriseName);



        return this.http.get<GeocercaValidationResponse>(
            `${this.baseUrl}/obtenerGeocercasConVendedorAsync/`,
            { headers, params }
        );
    }

    getOnlyGeocercasByEnterpriseName(
        enterpriseName: string,
        pageNumber: number = 1,
        pageSize: number = 10,
    ): Observable<GeocercaValidationResponse> {
        const token = this.authService.getToken();
        const headers = new HttpHeaders({
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        });

        const params = new HttpParams()
            .set('pageNumber', pageNumber)
            .set('pageSize', pageSize)
            .set('enterpriseName', enterpriseName)


        return this.http.get<GeocercaValidationResponse>(
            `${this.baseUrl}/getListGeofenceByEnterprise/`,
            { headers, params }
        );
    }

    createOnlyGeocerca(geocerca: CreateGeofenceDto): Observable<CreateGeofenceDto> {
        const token = this.authService.getToken();
        const headers = new HttpHeaders({
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        });

        return this.http.post<CreateGeofenceDto>(`${this.baseUrl}/crear-geocercas`, geocerca, { headers });
    }






    validarCodigoGeocerca(codigoGeocerca: string): Observable<boolean> {
        const token = this.authService.getToken();
        const headers = new HttpHeaders({
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        });

        return this.http.get<boolean>(`${this.baseUrl}/validar-codigo-geocerca/${codigoGeocerca}`, { headers });
    }
    /** Crear una nueva geocerca */
    crearGeocerca(geocerca: CrearGeocercaDto): Observable<GeocercaResponseDto> {
        const token = this.authService.getToken();
        const headers = new HttpHeaders({
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        });

        return this.http.post<GeocercaResponseDto>(`${this.baseUrl}/crear-con-vendedores`, geocerca, { headers });
    }

    /** Actualizar una geocerca existente */
    actualizarGeocerca(codigoGeocerca: string, geocerca: ActualizarGeocercaDto): Observable<GeocercaResponseDto> {
        const token = this.authService.getToken();
        const headers = new HttpHeaders({
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        });

        return this.http.put<GeocercaResponseDto>(
            `${this.baseUrl}/actualizar-geocerca/${codigoGeocerca}`,
            geocerca,
            { headers }
        );
    }

    /** Eliminar una geocerca existente */
    eliminarGeocerca(codigoGeocerca: string): Observable<void> {
        const token = this.authService.getToken();
        const headers = new HttpHeaders({
            'Authorization': `Bearer ${token}`
        });

        return this.http.delete<void>(`${this.baseUrl}/eliminar-geocerca/${codigoGeocerca}`, { headers });
    }

    /** Activar una geocerca existente */
    activarGeocerca(codigoGeocerca: string): Observable<void> {
        const token = this.authService.getToken();
        const headers = new HttpHeaders({
            'Authorization': `Bearer ${token}`
        });

        return this.http.patch<void>(`${this.baseUrl}/activar-geocerca/${codigoGeocerca}`, { headers });
    }

    /** Desactivar una geocerca existente */
    desactivarGeocerca(codigoGeocerca: string): Observable<void> {
        const token = this.authService.getToken();
        const headers = new HttpHeaders({
            'Authorization': `Bearer ${token}`
        });

        return this.http.patch<void>(`${this.baseUrl}/desactivar-geocerca/${codigoGeocerca}`, { headers });
    }

    /** Generar código único para geocerca */
    generarCodigoGeocerca(): string {
        const timestamp = Date.now().toString().slice(-6);
        return `G${timestamp}`;
    }

    /** Calcular área de un polígono usando fórmula de Shoelace */
    calcularAreaPoligono(coordenadas: Array<{lat: number, lng: number}>): number {
        if (coordenadas.length < 3) return 0;

        let area = 0;
        const n = coordenadas.length;

        for (let i = 0; i < n; i++) {
            const j = (i + 1) % n;
            area += coordenadas[i].lat * coordenadas[j].lng;
            area -= coordenadas[j].lat * coordenadas[i].lng;
        }

        area = Math.abs(area) / 2;

        // Convertir a metros cuadrados (aproximación)
        // 1 grado ≈ 111,320 metros en el ecuador
        const metrosLat = 111320;
        const metrosLng = 111320 * Math.cos(coordenadas[0].lat * Math.PI / 180);

        return Math.round(area * metrosLat * metrosLng);
    }

    /** Calcular perímetro de un polígono */
    calcularPerimetroPoligono(coordenadas: Array<{lat: number, lng: number}>): number {
        if (coordenadas.length < 2) return 0;

        let perimetro = 0;

        for (let i = 0; i < coordenadas.length - 1; i++) {
            perimetro += this.calcularDistancia(coordenadas[i], coordenadas[i + 1]);
        }

        // Cerrar el polígono
        if (coordenadas.length > 2) {
            perimetro += this.calcularDistancia(coordenadas[coordenadas.length - 1], coordenadas[0]);
        }

        return Math.round(perimetro);
    }

    /** Calcular área de un círculo */
    calcularAreaCirculo(radio: number): number {
        return Math.round(Math.PI * radio * radio);
    }

    /** Calcular perímetro de un círculo */
    calcularPerimetroCirculo(radio: number): number {
        return Math.round(2 * Math.PI * radio);
    }

    /** Calcular distancia entre dos puntos usando fórmula de Haversine */
    private calcularDistancia(punto1: {lat: number, lng: number}, punto2: {lat: number, lng: number}): number {
        const R = 6371000; // Radio de la Tierra en metros
        const dLat = (punto2.lat - punto1.lat) * Math.PI / 180;
        const dLng = (punto2.lng - punto1.lng) * Math.PI / 180;

        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(punto1.lat * Math.PI / 180) * Math.cos(punto2.lat * Math.PI / 180) *
            Math.sin(dLng / 2) * Math.sin(dLng / 2);

        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

        return R * c;
    }
}
