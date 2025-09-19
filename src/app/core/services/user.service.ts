import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { environment } from 'src/environments/environment';
import { UserDto } from '../models/UserDto';
import { Observable } from 'rxjs';
import { AuthService } from '@/core/services/auth.service';
import { VendedoresQueryParams, VendedoresResponse } from '@/core/models/Geocercas/VendedorDto';

@Injectable({
    providedIn: 'root'
})
export class UserService {
    private readonly baseUrl = environment.apiUrl + '/usuarios';
    private readonly baseUrl2 = environment.apiUrl2;
    private readonly authService = inject(AuthService);

    constructor(private readonly http: HttpClient) {}


    getAllListUser(): Observable<UserDto[]> {
        const token = this.authService.getToken();
        const headers = new HttpHeaders({
            Authorization: `Bearer ${token}`
        });
        return this.http.get<UserDto[]>(`${this.baseUrl}/listacompleta`, { headers });
    }
    getAllListUser2(skipLoader = false): Observable<UserDto[]> {
        const token = this.authService.getToken();
        let headers = new HttpHeaders({
            Authorization: `Bearer ${token}`
        });

        if (skipLoader) {
            headers = headers.set('X-Skip-Loader', 'true');
        }

        return this.http.get<UserDto[]>(`${this.baseUrl}/listacompleta`, { headers });
    }
    getVendedoresConGeocercas(params?: VendedoresQueryParams): Observable<VendedoresResponse> {
        const token = this.authService.getToken();
        const headers = new HttpHeaders({
            Authorization: `Bearer ${token}`
        });
        let httpParams = new HttpParams();

        if (params?.pageNumber) {
            httpParams = httpParams.set('pageNumber', params.pageNumber.toString());
        } else {
            httpParams = httpParams.set('pageNumber', '1');
        }

        if (params?.pageSize) {
            httpParams = httpParams.set('pageSize', params.pageSize.toString());
        } else {
            httpParams = httpParams.set('pageSize', '10');
        }

        if (params?.busqueda) {
            httpParams = httpParams.set('busqueda', params.busqueda);
        }

        return this.http.get<VendedoresResponse>(
            `${this.baseUrl2}/vendedores-con-geocercas`,
            { headers, params: httpParams }
        );
    }

}
