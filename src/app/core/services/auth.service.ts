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
   private readonly rolesSignal = signal<string[]>(this.getDecodedToken()?.roles || []);

  constructor(private readonly http: HttpClient) { }

  login(cedula: string, password: string, role: string): Observable<LoginDto> {
    const body = { cedula, password, role };
    return this.http.post<LoginDto>(`${this.baseUrl}/login-with-role`, body).pipe(
      tap((user: LoginDto) => {
        localStorage.setItem('token', user.token);

        this.updateRolesFromToken(user.token);
      })
    );
  }

    /** Decodifica el token JWT */
  private decodeToken(token: string): any {
    try {
      const payload = token.split('.')[1];
      return JSON.parse(atob(payload));
    } catch (e) {
      console.error('Error al decodificar el token:', e);
      return null;
    }
  }

  /** Obtiene el token decodificado */
  private getDecodedToken(): any {
    const token = localStorage.getItem('token');
    return token ? this.decodeToken(token) : null;
  }
  
  /** Verifica si el token ha expirado */
  isTokenExpired(): boolean {
    const decoded = this.getDecodedToken();
    const expiration = decoded?.exp ? decoded.exp * 1000 : 0;
    return Date.now() > expiration;
  }

  /** Verifica si el usuario tiene un rol específico */
  hasRole(role: string): boolean {
    return this.rolesSignal().includes(role);
  }

  /** Obtiene los roles del usuario (como signal) */
  getRolesSignal(): Signal<string[]> {
    return this.rolesSignal;
  }

  updateRolesFromToken(token: string): void {
    const decodedToken = this.decodeToken(token);
    const roles = decodedToken?.roles || [];

    this.rolesSignal.set(roles); // Actualizar el signal
  }

  /** Verifica si el usuario está autenticado */
  isAuthenticated(): boolean {
    const token = this.rolesSignal();
    return token ? !this.isTokenExpired() : false;
  }

  logOut() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  }

}
