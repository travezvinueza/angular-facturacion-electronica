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
    private readonly router = inject(Router);

    isAuthenticate = this.authService.isAuthenticated();

    model: CustomMenuItem[] = [];

    ngOnInit(): void {
        this.model = [
            {
                label: 'UI Components',
                items: [
                    { label: 'Gestion Usuarios', isAuthenticated: true, icon: 'pi pi-fw pi-id-card', routerLink: ['/pages/user-list'] },
                    { label: 'Gestion Items de Trabajo', isAuthenticated: true, icon: 'pi pi-fw pi-id-card', routerLink: ['/pages/work-items'] },

                ]
            },
            {
                label: 'Cerrar Sesión',
                items: [

                    {
                        label: 'Logout',
                        icon: 'pi pi-fw pi-sign-out',
                        command: () => this.logout()
                    }
                ]
            }
        ];

        this.model = this.model.map(menu => ({
            ...menu,
            items: menu.items?.filter(item => !item['isAuthenticated'] || this.isAuthenticate)
        }));
    }

    logout(): void {
        this.authService.logOut();
        this.router.navigate(['/auth/login']);
    }
}
