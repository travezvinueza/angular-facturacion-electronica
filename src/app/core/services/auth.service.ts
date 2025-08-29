import { Injectable, signal, Signal } from '@angular/core';
import { environment } from '../../../environments/environment';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { JwtPayload, LoginDto, TokenEmpresaDto } from '../models/Auth/LoginDto';

@Injectable({
  providedIn: 'root'
})
export class AuthService {

    private readonly baseUrl = environment.apiUrl + '/login';
    private readonly userSignal = signal<string | null>(this.getUsuarioFromToken());

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

    private decodeToken(token: string): JwtPayload | null {
        try {
            const payload = token.split('.')[1];
            return JSON.parse(atob(payload));
        } catch (e) {
            console.error('Error al decodificar el token:', e);
            return null;
        }
    }

    getDecodedToken(): JwtPayload | null {
        const token = localStorage.getItem('token');
        return token ? this.decodeToken(token) : null;
    }

     getUsuarioFromToken(): string | null {
        const decoded = this.getDecodedToken();
        return decoded?.usuario || null;
    }

    isTokenExpired(): boolean {
        const decoded = this.getDecodedToken();
        const expiration = decoded?.exp ? decoded.exp * 1000 : 0;
        return Date.now() > expiration;
    }

    getUserSignal(): Signal<string | null> {
        return this.userSignal;
    }

    /** Obtiene el usuario actual */
    getCurrentUser(): string | null {
        return this.userSignal();
    }

    updateUserFromToken(token: string): void {
        const decodedToken = this.decodeToken(token);
        const usuario = decodedToken?.usuario || null;
        this.userSignal.set(usuario);
    }

    isAuthenticated(): boolean {
        const token = localStorage.getItem('token');
        return token ? !this.isTokenExpired() : false;
    }

    getEmpresa(): {id: number, nomempresa: string, flag: boolean} | null {
        const empresa = localStorage.getItem('empresa');
        return empresa ? JSON.parse(empresa) : null;
    }

    cancelarLogin(): void {
        this.tokenTemporalSignal.set(null);
        this.empresasDisponiblesSignal.set([]);
    }


    getToken(): string | null {
        return localStorage.getItem('token');
    }

    logOut(): void {
        localStorage.removeItem('token');
        localStorage.removeItem('empresa');
        this.userSignal.set(null);
        this.tokenTemporalSignal.set(null);
        this.empresasDisponiblesSignal.set([]);
    }
}
