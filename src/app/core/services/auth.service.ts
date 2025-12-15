import { Injectable, signal, Signal } from '@angular/core';
import { environment } from '../../../environments/environment';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { LoginDto } from '../models/LoginDto';

@Injectable({
    providedIn: 'root'
})
export class AuthService {

    private readonly baseUrl = environment.apiUrl + '/auth';
    private readonly userIdSignal = signal<number | null>(this.getDecodedToken()?.userId || null);

    constructor(private readonly http: HttpClient) { }

    login(usernameOrEmail: string, password: string): Observable<LoginDto> {
        const body = { usernameOrEmail, password };
        return this.http.post<LoginDto>(`${this.baseUrl}/login`, body).pipe(
            tap((response: LoginDto) => {
                if (response.success && response.data) {
                    localStorage.setItem('token', response.data.accessToken);
                    localStorage.setItem('user', JSON.stringify(response.data));
                    this.updateUserIdFromToken(response.data.accessToken);
                }
            })
        );
    }

    private decodeToken(token: string): any {
        try {
            const payload = token.split('.')[1];
            return JSON.parse(atob(payload));
        } catch (e) {
            console.error('Error al decodificar el token:', e);
            return null;
        }
    }

    private getDecodedToken(): any {
        const token = localStorage.getItem('token');
        return token ? this.decodeToken(token) : null;
    }

    isTokenExpired(): boolean {
        const decoded = this.getDecodedToken();
        const expiration = decoded?.exp ? decoded.exp * 1000 : 0;
        return Date.now() > expiration;
    }

    getUserIdSignal(): Signal<number | null> {
        return this.userIdSignal;
    }

    updateUserIdFromToken(token: string): void {
        const decodedToken = this.decodeToken(token);
        const userId = decodedToken?.userId || null;
        this.userIdSignal.set(userId);
    }

    isAuthenticated(): boolean {
        const token = localStorage.getItem('token');
        return token ? !this.isTokenExpired() : false;
    }

    logOut(): void {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        this.userIdSignal.set(null);
    }

}
