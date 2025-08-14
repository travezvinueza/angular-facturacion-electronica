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

    isAuthenticate = this.authService.isAuthenticated();
    rolesSignal = this.authService.getRolesSignal();

    model: CustomMenuItem[] = [];

    ngOnInit() {
        const userRoles = this.rolesSignal();

        this.model = [
            // {
            //     label: 'Home',
            //     items: [{ label: 'Dashboard', icon: 'pi pi-fw pi-home', routerLink: ['/'] }]
            // },
            {
                label: 'UI Components',
                items: [
                    { label: 'Dashboard', isAuthenticated: true, icon: 'pi pi-fw pi-home', routerLink: ['/dashboard'] },
                    { label: 'Gestion Usuarios', isAuthenticated: true, icon: 'pi pi-fw pi-id-card', routerLink: ['/pages/user-list'] },
                    { label: 'Gestion Empresas', isAuthenticated: true, icon: 'pi pi-fw pi-check-square', routerLink: ['/uikit/input'] },
                    { label: 'Gestion Sucursales', isAuthenticated: true, icon: 'pi pi-fw pi-mobile', class: 'rotated-icon', routerLink: ['/uikit/button'] },
                    { label: 'Firma Electronica', isAuthenticated: true, icon: 'pi pi-fw pi-table', routerLink: ['/uikit/table'] },
                    { label: 'Puntos Emision', isAuthenticated: true, icon: 'pi pi-fw pi-list', routerLink: ['/uikit/list'] },
                    { label: 'Gestionar Secuencias', isAuthenticated: true, icon: 'pi pi-fw pi-share-alt', routerLink: ['/uikit/tree'] },
                    { label: 'Factura', isAuthenticated: true, icon: 'pi pi-fw pi-tablet', routerLink: ['/uikit/panel'] },
                    { label: 'Suscriptores', isAuthenticated: true, icon: 'pi pi-fw pi-clone', routerLink: ['/uikit/overlay'] },

                    // { label: 'Media', icon: 'pi pi-fw pi-image', routerLink: ['/uikit/media'] },
                    // { label: 'Menu', icon: 'pi pi-fw pi-bars', routerLink: ['/uikit/menu'] },
                    // { label: 'Message', icon: 'pi pi-fw pi-comment', routerLink: ['/uikit/message'] },
                    // { label: 'File', icon: 'pi pi-fw pi-file', routerLink: ['/uikit/file'] },
                    // { label: 'Chart', icon: 'pi pi-fw pi-chart-bar', routerLink: ['/uikit/charts'] },
                    // { label: 'Timeline', icon: 'pi pi-fw pi-calendar', routerLink: ['/uikit/timeline'] },
                    // { label: 'Misc', icon: 'pi pi-fw pi-circle', routerLink: ['/uikit/misc'] }
                ]
            },
            {
                label: 'Get Started',
                items: [
                    // {
                    //     label: 'Documentation',
                    //     icon: 'pi pi-fw pi-book',
                    //     routerLink: ['/documentation']
                    // },
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
        ]
        this.model = this.model.map(menu => ({
            ...menu,
            items: menu.items?.filter(item =>
                (!item['requiredRoles'] || item['requiredRoles'].some((role: string) => userRoles.includes(role))) &&
                (!item['isAuthenticated'] || this.isAuthenticate)
            )
        }));
    }

    logout(): void {
        this.authService.logOut();
        this.router.navigate(['/auth/login']);
    }

}
