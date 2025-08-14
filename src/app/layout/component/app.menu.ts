import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { AppMenuitem } from './app.menuitem';
import { AuthService } from '@/core/services/auth.service';
import { CustomMenuItem } from '@/core/models/CustomMenuItem';

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
                label: 'UI Components',
                items: [
                    { label: 'Dashboard', isAuthenticated: true, icon: 'pi pi-fw pi-home', routerLink: ['/dashboard'] },
                    { label: 'Gestion Usuarios', isAuthenticated: true, icon: 'pi pi-fw pi-id-card', routerLink: ['/pages/user-list'] },
                    { label: 'Gestion de Geocercas', isAuthenticated: true, icon: 'pi pi-fw pi-check-square', routerLink: ['/pages/geocercas-list'] },
                    { label: 'Gestion Sucursales', isAuthenticated: true, icon: 'pi pi-fw pi-mobile', class: 'rotated-icon', routerLink: ['/uikit/button'] },
                    { label: 'Firma Electronica', isAuthenticated: true, icon: 'pi pi-fw pi-table', routerLink: ['/uikit/table'] },
                    { label: 'Puntos Emision', isAuthenticated: true, icon: 'pi pi-fw pi-list', routerLink: ['/uikit/list'] },
                    { label: 'Gestionar Secuencias', isAuthenticated: true, icon: 'pi pi-fw pi-share-alt', routerLink: ['/uikit/tree'] },
                    { label: 'Factura', isAuthenticated: true, icon: 'pi pi-fw pi-tablet', routerLink: ['/uikit/panel'] },
                    { label: 'Suscriptores', isAuthenticated: true, icon: 'pi pi-fw pi-clone', routerLink: ['/uikit/overlay'] },
                ]
            },
            {
                label: 'Get Started',
                items: [
                    {
                        label: 'View Source',
                        icon: 'pi pi-fw pi-github',
                        url: 'https://github.com/primefaces/sakai-ng',
                        target: '_blank'
                    },
                    {
                        label: 'Logout',
                        icon: 'pi pi-fw pi-sign-out',
                        command: () => this.logout()
                    }
                ]
            },
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
