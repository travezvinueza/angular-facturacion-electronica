import { Injectable, signal, Signal } from '@angular/core';
import { environment } from '../../../environments/environment';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { JwtPayload, LoginDto, TokenEmpresaDto } from '../models/LoginDto';

@Injectable({
  providedIn: 'root'
})
export class AuthService {

    private readonly baseUrl = environment.apiUrl + '/login';
    private readonly userSignal = signal<string | null>(this.getUsuarioFromToken());

    // Signals para manejar el flujo de dos pasos
    private readonly empresasDisponiblesSignal = signal<Array<{id: number, nomempresa: string, flag: boolean}>>([]);
    private readonly tokenTemporalSignal = signal<string | null>(null);


    constructor(private readonly http: HttpClient) { }

    login(nombreUsuario: string, contrasena: string): Observable<LoginDto> {
        const body = { nombreUsuario, contrasena };
        return this.http.post<LoginDto>(`${this.baseUrl}/listaempresas`, body).pipe(
            tap((response: LoginDto) => {
                this.tokenTemporalSignal.set(response.token);
                this.empresasDisponiblesSignal.set(response.listado);
            })
        );
    }
    loginConEmpresa(idEmpresa: number): Observable<TokenEmpresaDto> {
        const tokenTemporal = this.tokenTemporalSignal();

        if (!tokenTemporal) {
            throw new Error('No hay token temporal. Debe hacer login primero.');
        }

        return this.http.get<TokenEmpresaDto>(`${this.baseUrl}/tokenweb?idempresa=${idEmpresa}`, {
            headers: {
                'Authorization': `Bearer ${tokenTemporal}`
            }
        }).pipe(
            tap((response: TokenEmpresaDto) => {
                localStorage.setItem('token', response.token);

                const empresaSeleccionada = this.empresasDisponiblesSignal().find(emp => emp.id === idEmpresa);
                if (empresaSeleccionada) {
                    localStorage.setItem('empresa', JSON.stringify(empresaSeleccionada));
                }
                this.updateUserFromToken(response.token);
                this.tokenTemporalSignal.set(null);
                this.empresasDisponiblesSignal.set([]);
            })
        );
    }

    /** Decodifica el token JWT */
    private decodeToken(token: string): JwtPayload | null {
        try {
            const payload = token.split('.')[1];
            return JSON.parse(atob(payload));
        } catch (e) {
            console.error('Error al decodificar el token:', e);
            return null;
        }
    }

    /** Obtiene el token decodificado */
    getDecodedToken(): JwtPayload | null {
        const token = localStorage.getItem('token');
        return token ? this.decodeToken(token) : null;
    }

    /** Obtiene el usuario del token */
     getUsuarioFromToken(): string | null {
        const decoded = this.getDecodedToken();
        return decoded?.usuario || null;
    }

    /** Verifica si el token ha expirado */
    isTokenExpired(): boolean {
        const decoded = this.getDecodedToken();
        const expiration = decoded?.exp ? decoded.exp * 1000 : 0;
        return Date.now() > expiration;
    }

    /** Obtiene el usuario actual (como signal) */
    getUserSignal(): Signal<string | null> {
        return this.userSignal;
    }

    /** Obtiene el usuario actual */
    getCurrentUser(): string | null {
        return this.userSignal();
    }

    /** Actualiza el usuario desde el token */
    updateUserFromToken(token: string): void {
        const decodedToken = this.decodeToken(token);
        const usuario = decodedToken?.usuario || null;
        this.userSignal.set(usuario);
    }

    /** Verifica si el usuario está autenticado */
    isAuthenticated(): boolean {
        const token = localStorage.getItem('token');
        return token ? !this.isTokenExpired() : false;
    }

    /** Obtiene la empresa guardada */
    getEmpresa(): {id: number, nomempresa: string, flag: boolean} | null {
        const empresa = localStorage.getItem('empresa');
        return empresa ? JSON.parse(empresa) : null;
    }
    /** Obtiene las empresas disponibles después del login inicial */
    getEmpresasDisponibles(): Array<{id: number, nomempresa: string, flag: boolean}> {
        return this.empresasDisponiblesSignal();
    }

    tieneEmpresasPendientes(): boolean {
        return this.empresasDisponiblesSignal().length > 0 && !this.isAuthenticated();
    }

    cancelarLogin(): void {
        this.tokenTemporalSignal.set(null);
        this.empresasDisponiblesSignal.set([]);
    }


    /** Obtiene el token actual */
    getToken(): string | null {
        return localStorage.getItem('token');
    }

    /** Cierra sesión */
    logOut(): void {
        localStorage.removeItem('token');
        localStorage.removeItem('empresa');
        this.userSignal.set(null);
        this.tokenTemporalSignal.set(null);
        this.empresasDisponiblesSignal.set([]);
    }
}
