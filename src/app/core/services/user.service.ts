import { HttpClient, HttpHeaders } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { environment } from 'src/environments/environment';
import { UserDto } from '../models/UserDto';
import { Observable } from 'rxjs';
import { AuthService } from '@/core/services/auth.service';

@Injectable({
    providedIn: 'root'
})
export class UserService {
    private readonly baseUrl = environment.apiUrl + '/usuarios';
    private readonly authService = inject(AuthService);

    constructor(private readonly http: HttpClient) {}

    getAllListUser(): Observable<UserDto[]> {
        const token = this.authService.getToken();
        const headers = new HttpHeaders({
            Authorization: `Bearer ${token}`
        });
        return this.http.get<UserDto[]>(`${this.baseUrl}/listacompleta`, { headers });
    }
}
