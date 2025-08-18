import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
    standalone: true,
    selector: 'app-footer',
    imports: [CommonModule],
    template: `
        <div class="layout-footer py-2 px-4 border-t border-surface-200/50 dark:border-surface-700/50 bg-surface-50 dark:bg-surface-900">
            <div class="container mx-auto flex justify-between items-center">
                <!-- Logo y copyright -->
                <div class="flex items-center gap-2">
                    <span class="text-sm font-semibold text-gray-700 dark:text-gray-300">
                        Egas Tamayo <span class="text-primary-500">&</span> Asociados
                    </span>
                    <span class="text-xs text-gray-500 dark:text-gray-500 hidden sm:inline-block">
                        © {{currentYear}}
                    </span>
                </div>

                <!-- Servicios destacados -->
                <div class="flex gap-5">
                    <div class="flex items-center gap-1.5" title="Contabilidad">
                        <i class="pi pi-book text-primary-500 text-sm"></i>
                        <span class="text-xs text-gray-600 dark:text-gray-400 hidden sm:inline-block">Contabilidad</span>
                    </div>

                    <div class="flex items-center gap-1.5" title="Impuestos">
                        <i class="pi pi-calculator text-primary-500 text-sm"></i>
                        <span class="text-xs text-gray-600 dark:text-gray-400 hidden sm:inline-block">Impuestos</span>
                    </div>

                    <div class="flex items-center gap-1.5" title="Nómina">
                        <i class="pi pi-users text-primary-500 text-sm"></i>
                        <span class="text-xs text-gray-600 dark:text-gray-400 hidden sm:inline-block">Nómina</span>
                    </div>
                </div>
            </div>
        </div>
    `
})
export class AppFooter {
    currentYear = new Date().getFullYear();
}
