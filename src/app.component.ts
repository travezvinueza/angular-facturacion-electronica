import { Loading } from '@/shared/loading/loading';
import { Component } from '@angular/core';
import { RouterModule } from '@angular/router';
import { ToastModule } from 'primeng/toast';

@Component({
    selector: 'app-root',
    standalone: true,
    imports: [RouterModule, Loading, ToastModule],
    template: `
    <router-outlet></router-outlet>
    <p-toast></p-toast>
    <app-loading></app-loading>`
})
export class AppComponent { }
