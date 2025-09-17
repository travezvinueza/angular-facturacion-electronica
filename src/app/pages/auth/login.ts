import { Component, inject, signal } from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { CheckboxModule } from 'primeng/checkbox';
import { InputTextModule } from 'primeng/inputtext';
import { PasswordModule } from 'primeng/password';
import { RippleModule } from 'primeng/ripple';
import { CardModule } from 'primeng/card';
import { AppFloatingConfigurator } from '@/layout/component/app.floatingconfigurator';
import { AuthService } from '@/core/services/auth.service';
import { MessageService } from 'primeng/api';
import { CommonModule } from '@angular/common';

@Component({
    selector: 'app-login',
    standalone: true,
    imports: [CommonModule, ReactiveFormsModule, ButtonModule, CheckboxModule, InputTextModule, PasswordModule, FormsModule, RouterModule, RippleModule, AppFloatingConfigurator, CardModule],
    template: `
        <app-floating-configurator />
        <div class="bg-surface-50 dark:bg-surface-950 flex items-center justify-center min-h-screen min-w-screen overflow-hidden">
            <div class="flex flex-col items-center justify-center">
                <div style="border-radius: 56px; padding: 0.3rem; background: linear-gradient(180deg, var(--primary-color) 10%, rgba(33, 150, 243, 0) 30%)">
                    <div class="w-full bg-surface-0 dark:bg-surface-900 py-20 px-8 sm:px-20" style="border-radius: 53px">
                        <div class="text-center mb-8">
                            <svg viewBox="0 0 772 232" fill="none" xmlns="http://www.w3.org/2000/svg" class="mb-8 w-30 shrink-0 mx-auto">
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
                            <div class="text-surface-900 dark:text-surface-0 text-3xl font-medium mb-4">Egas Tamayo & Asociados</div>
                            <span class="text-muted-color font-medium text-sm">
                                Contabilidad, Impuestos, Nómina
                            </span>
                            <div class="mt-2">
                            <span class="text-muted-color font-medium">
                                {{ mostrarSelectorEmpresa() ? 'Selecciona una empresa' : 'Inicia sesión para continuar' }}
                            </span>
                            </div>
                        </div>

                        <!-- PASO 1: Formulario de Login -->
                        @if (!mostrarSelectorEmpresa()) {
                            <form [formGroup]="userDetailForm" (ngSubmit)="login()">

                                <label for="nombreUsuario"
                                       class="block text-surface-900 dark:text-surface-0 text-xl font-medium">
                                    Nombre Usuario
                                </label>
                                <input pInputText
                                       type="text"
                                       formControlName="nombreUsuario"
                                       id="nombreUsuario"
                                       placeholder="Nombre de usuario"
                                       class="w-full md:w-[30rem] mb-4"
                                       required />

                                <label for="contrasena"
                                       class="block text-surface-900 dark:text-surface-0 font-medium text-xl">
                                    Contraseña
                                </label>
                                <p-password type="password"
                                            formControlName="contrasena"
                                            id="contrasena"
                                            placeholder="Contraseña"
                                            [toggleMask]="true"
                                            class="mb-4"
                                            [fluid]="true"
                                            [feedback]="false"
                                            required>
                                </p-password>
                                <p-button type="submit"
                                          [loading]="cargandoLogin()"
                                          styleClass="w-full">
                                    Iniciar Sesión
                                </p-button>
                            </form>
                        }


                        <!-- PASO 2: Selector de Empresa -->
                        @if (mostrarSelectorEmpresa()) {
                            <div>
                                <div class="text-center mb-8">
                                    <p class="text-surface-600 dark:text-surface-400 text-base">
                                        Credenciales válidas. Selecciona la empresa con la que deseas ingresar:
                                    </p>
                                </div>

                                <div class="space-y-4">
                                    @for (empresa of empresasDisponibles(); track empresa.id) {
                                        <div
                                            class="cursor-pointer rounded-xl bg-white dark:bg-surface-800/50 border border-surface-200/60 dark:border-surface-700/50 hover:bg-surface-50 dark:hover:bg-surface-700/70 hover:border-surface-300/80 dark:hover:border-surface-600/70 transition-all duration-300 p-5 group hover:shadow-sm dark:hover:shadow-lg"
                                            (click)="seleccionarEmpresa(empresa.id)">

                                            <div class="flex items-center gap-5">
                                                <!-- Icono de empresa -->
                                                <div class="flex items-center justify-center w-14 h-14 rounded-full bg-primary-500/10 dark:bg-primary-400/10 flex-shrink-0 group-hover:bg-primary-500/15 dark:group-hover:bg-primary-400/15 transition-colors duration-300">
                                                    <i class="pi pi-building text-primary-600 dark:text-primary-400 text-xl"></i>
                                                </div>

                                                <!-- Información de la empresa -->
                                                <div class="flex-1 min-w-0">
                                                    <h3 class="text-lg font-semibold text-surface-900 dark:text-surface-100 mb-2 truncate group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors duration-300">
                                                        {{ empresa.nomempresa }}
                                                    </h3>
                                                    <div class="flex items-center gap-2">
                                                        <i class="pi pi-tag text-surface-400 dark:text-surface-500 text-xs"></i>
                                                        <p class="text-sm text-surface-500 dark:text-surface-400 truncate">
                                                            ID: {{ empresa.id }}
                                                        </p>
                                                    </div>
                                                </div>

                                                <!-- Flecha de acceso -->
                                                <div class="flex items-center justify-center w-10 h-10 rounded-full bg-surface-200/50 dark:bg-surface-600/50 flex-shrink-0 group-hover:bg-primary-500/15 dark:group-hover:bg-primary-400/15 transition-all duration-300">
                                                    <i class="pi pi-arrow-right text-surface-600 dark:text-surface-400 text-sm group-hover:text-primary-600 dark:group-hover:text-primary-400 group-hover:translate-x-0.5 transition-all duration-300"></i>
                                                </div>
                                            </div>
                                        </div>
                                    }
                                </div>

                                <div class="mt-8">
                                    <p-button
                                        type="button"
                                        styleClass="w-full !rounded-xl !py-3"
                                        severity="secondary"
                                        (click)="cancelarSeleccion()">
                                        Cancelar
                                    </p-button>
                                </div>
                            </div>
                        }
                    </div>
                </div>
            </div>
        </div>
    `
})
export class Login {
    readonly formBuilder = inject(FormBuilder);
    readonly msgService = inject(MessageService);
    readonly authService = inject(AuthService);
    readonly router = inject(Router);

    // Signals para manejar el estado del componente
    readonly cargandoLogin = signal(false);
    readonly empresasDisponibles = signal<Array<{id: number, nomempresa: string, flag: boolean}>>([]);
    readonly mostrarSelectorEmpresa = signal(false);

    userDetailForm = this.formBuilder.group({
        nombreUsuario: ['', [Validators.required, Validators.minLength(3)]],
        contrasena: ['', [Validators.required, Validators.minLength(4)]],
    });

    /** PASO 1: Login inicial */
    login(): void {
        if (this.userDetailForm.invalid) {
            this.msgService.add({
                severity: 'warn',
                summary: 'Advertencia',
                detail: 'Por favor, completa los campos requeridos.'
            });
            return;
        }

        const { nombreUsuario, contrasena } = this.userDetailForm.value;
        this.cargandoLogin.set(true);

        this.authService.login(nombreUsuario!, contrasena!).subscribe({
            next: (response) => {
                this.cargandoLogin.set(false);

                // Guardar empresas disponibles y mostrar selector
                this.empresasDisponibles.set(response.listado);
                this.mostrarSelectorEmpresa.set(true);

                this.msgService.add({
                    severity: 'success',
                    summary: 'Credenciales válidas',
                    detail: 'Ahora selecciona la empresa con la que deseas ingresar'
                });
            },
            error: (error) => {
                this.cargandoLogin.set(false);
                console.error('Error en login:', error);
                this.msgService.add({
                    severity: 'error',
                    summary: 'Error',
                    detail: 'Credenciales incorrectas. Verifique su usuario y contraseña.'
                });
            }
        });
    }

    /** PASO 2: Seleccionar empresa */
    seleccionarEmpresa(idEmpresa: number): void {
        this.cargandoLogin.set(true);

        this.authService.loginConEmpresa(idEmpresa).subscribe({
            next: (response) => {
                this.cargandoLogin.set(false);

                const empresaSeleccionada = this.empresasDisponibles().find(emp => emp.id === idEmpresa);

                this.msgService.add({
                    severity: 'success',
                    summary: 'Bienvenido',
                    detail: `Acceso autorizado a ${empresaSeleccionada?.nomempresa}`
                });

                // Redirigir al dashboard
                this.router.navigate(['/vendedores']).then();
            },
            error: (error) => {
                this.cargandoLogin.set(false);
                console.error('Error al obtener token de empresa:', error);
                this.msgService.add({
                    severity: 'error',
                    summary: 'Error',
                    detail: 'No se pudo acceder a la empresa seleccionada. Intenta nuevamente.'
                });
            }
        });
    }

    /** Cancelar selección y volver al login */
    cancelarSeleccion(): void {
        this.authService.cancelarLogin();
        this.empresasDisponibles.set([]);
        this.mostrarSelectorEmpresa.set(false);
        this.userDetailForm.reset();
    }
}
