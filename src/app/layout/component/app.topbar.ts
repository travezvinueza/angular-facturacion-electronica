import { Component } from '@angular/core';
import { MenuItem } from 'primeng/api';
import { RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { StyleClassModule } from 'primeng/styleclass';
import { AppConfigurator } from './app.configurator';
import { LayoutService } from '../service/layout.service';

@Component({
    selector: 'app-topbar',
    standalone: true,
    imports: [RouterModule, CommonModule, StyleClassModule, AppConfigurator],
    template: ` <div class="layout-topbar">
        <div class="layout-topbar-logo-container">
            <button class="layout-menu-button layout-topbar-action" (click)="layoutService.onMenuToggle()">
                <i class="pi pi-bars"></i>
            </button>
            <a class="layout-topbar-logo">
                <svg viewBox="0 0 772 232" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <defs>
                        <linearGradient id="stepGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                            <stop offset="0%" style="stop-color:var(--primary-color);stop-opacity:1" />
                            <stop offset="100%" style="stop-color:var(--primary-color);stop-opacity:0.3" />
                        </linearGradient>
                    </defs>
                    <path d="M0 0H386V45H44L0 0Z" fill="url(#stepGradient)"/>
                    <path d="M130 57H386V102H159.181L130 57Z" fill="url(#stepGradient)"/>
                    <path d="M202 114H386V159H222.974L202 114Z" fill="url(#stepGradient)"/>
                    <path d="M280 171H386V216H309L280 171Z" fill="url(#stepGradient)"/>
                    <path d="M772 231.065L386 231L386.005 186L728.005 186.057L772 231.065Z" fill="url(#stepGradient)"/>
                    <path d="M642.01 174.043L386.01 174L386.015 129L612.833 129.038L642.01 174.043Z" fill="url(#stepGradient)"/>
                    <path d="M570.019 117.031L386.019 117L386.024 72L549.05 72.0273L570.019 117.031Z" fill="url(#stepGradient)"/>
                    <path d="M492.029 60.0178L386.029 60L386.034 15L463.034 15.0129L492.029 60.0178Z" fill="url(#stepGradient)"/>
                </svg>
                <span>Egas Tamayo</span>
            </a>
        </div>

        <div class="layout-topbar-actions">
            <div class="layout-config-menu">
                <button type="button" class="layout-topbar-action" (click)="toggleDarkMode()">
                    <i [ngClass]="{ 'pi ': true, 'pi-moon': layoutService.isDarkTheme(), 'pi-sun': !layoutService.isDarkTheme() }"></i>
                </button>
                <div class="relative">
                    <button
                        class="layout-topbar-action layout-topbar-action-highlight"
                        pStyleClass="@next"
                        enterFromClass="hidden"
                        enterActiveClass="animate-scalein"
                        leaveToClass="hidden"
                        leaveActiveClass="animate-fadeout"
                        [hideOnOutsideClick]="true"
                    >
                        <i class="pi pi-palette"></i>
                    </button>
                    <app-configurator />
                </div>
            </div>

            <button class="layout-topbar-menu-button layout-topbar-action" pStyleClass="@next" enterFromClass="hidden" enterActiveClass="animate-scalein" leaveToClass="hidden" leaveActiveClass="animate-fadeout" [hideOnOutsideClick]="true">
                <i class="pi pi-ellipsis-v"></i>
            </button>


        </div>
    </div>`
})
export class AppTopbar {
    items!: MenuItem[];

    constructor(public layoutService: LayoutService) {}

    toggleDarkMode() {
        this.layoutService.layoutConfig.update((state) => ({ ...state, darkTheme: !state.darkTheme }));
    }
}
