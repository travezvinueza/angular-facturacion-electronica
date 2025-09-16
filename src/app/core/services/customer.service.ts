import { inject, Injectable } from '@angular/core';
import { environment } from '../../../environments/environment';
import { AuthService } from '@/core/services/auth.service';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { CustomerResponseDto } from '@/core/models/Customer/CustomerResponseDto';
import { Observable } from 'rxjs';
import { CustomerAreaRequestDto } from '@/core/models/Customer/CustomerAreaRequestDto';
import { FilterRequest } from '@/core/models/Filter/FilterRequest';
import { TrackingResponse } from '@/core/models/Filter/TrackingResponse';

@Injectable({
    providedIn: 'root'
})
export class CustomerService {
    private readonly baseUrl = environment.apiUrl;
    private readonly authService = inject(AuthService);

    constructor(private readonly http: HttpClient) { }

    getCustomersByVendorAndArea(requestDto: CustomerAreaRequestDto ): Observable<CustomerResponseDto[]> {
        const token = this.authService.getToken();
        const headers = new HttpHeaders({
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        });
        return this.http.post<CustomerResponseDto[]>(`${this.baseUrl}/geolocalizacion/webclientezona`, requestDto, { headers });
    }
    getTrackingDetails(requestDto: FilterRequest): Observable<TrackingResponse> {
        const token = this.authService.getToken();

        const headers = new HttpHeaders({
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
        });

        return this.http.post<TrackingResponse>(
            `${this.baseUrl}/geolocalizacion/webconsultacompleta`,
            requestDto,
            { headers }
        );
    }


}
