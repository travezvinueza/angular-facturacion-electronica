import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { AppMenuitem } from './app.menuitem';
import { AuthService } from '@/core/services/auth.service';
import { CustomMenuItem } from '@/core/models/Auth/CustomMenuItem';

@Component({
    selector: 'app-menu',
    standalone: true,
    imports: [CommonModule, AppMenuitem, RouterModule],
    template: `<ul class="layout-menu">
        <ng-container *ngFor="let item of model; let i = index">
            <li app-menuitem *ngIf="!item.separator" [item]="item" [index]="i" [root]="true"></li>
            <li *ngIf="item.separator" class="menu-separator"></li>
        </ng-container>
    </ul> `
})
export class AppMenu {
    private readonly authService = inject(AuthService);
    readonly router = inject(Router);

    // Simplificado: solo verificamos si está autenticado
    isAuthenticated = this.authService.isAuthenticated();
    userSignal = this.authService.getUserSignal();

    model: CustomMenuItem[] = [];

    ngOnInit() {
        this.model = [
            {
                label: 'CONFIGURACIÓN',
                items: [
                    {
                        label: 'Geolocalización',
                        isAuthenticated: true,
                        icon: 'pi pi-fw pi-cog',
                        items: [
                            { label: 'Geocercas y Vendedores', isAuthenticated: true, icon: 'pi pi-fw pi-map-marker', routerLink: ['/pages/geocercas-vendedores'] },
                        ]
                    },
                ]
            },
            {
                label: 'MAESTRO',
                items: [
                    {
                        label: 'Geolocalización',
                        isAuthenticated: true,
                        icon: 'pi pi-fw pi-cog',
                        items: [
                            { label: 'Crear Geocercas ', isAuthenticated: true, icon: 'pi pi-fw pi-map-marker', routerLink: ['/pages/only-geocercas'] },
                        ]
                    },
                ]
            },
            {
                label: 'REPORTES',
                items: [
                    {
                        label: 'Geolocalización',
                        isAuthenticated: true,
                        icon: 'pi pi-fw pi-cog',
                        items: [
                            { label: 'Detalles del Registro', isAuthenticated: true, icon: 'pi pi-fw pi-map-marker', routerLink: ['/pages/item-detail'] },
                            { label: 'Vendedores', isAuthenticated: true, icon: 'pi pi-fw pi-id-card', routerLink: ['/pages/vendedores'] },
                        ]
                    },
                ]
            },


            {
                label: 'Cerrar Sesión',
                items: [
                    { label: 'Cerrar Sesión', isAuthenticated: true, icon: 'pi pi-fw pi-sign-out', command: () => this.logout() },
                ]
            }

        ];

        // Filtrado simplificado: solo verificamos si requiere autenticación
        this.model = this.model.map(menu => ({
            ...menu,
            items: menu.items?.filter(item =>
                // Solo mostrar si no requiere autenticación O si está autenticado
                !item['isAuthenticated'] || this.isAuthenticated
            )
        }));
    }

    logout(): void {
        this.authService.logOut();
        this.router.navigate(['/auth/login']);
    }
}
