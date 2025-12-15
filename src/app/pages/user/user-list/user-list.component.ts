import { UserDto } from '@/core/models/UserDto';
import { CreateUserDto } from '@/core/models/CreateUserDto';
import { UpdateUserDto } from '@/core/models/UpdateUserDto';
import { UserService } from '@/core/services/user.service';
import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ConfirmationService, MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { IconFieldModule } from 'primeng/iconfield';
import { InputIconModule } from 'primeng/inputicon';
import { InputTextModule } from 'primeng/inputtext';
import { InputNumberModule } from 'primeng/inputnumber';
import { PasswordModule } from 'primeng/password';
import { Table, TableModule } from 'primeng/table';
import { TooltipModule } from 'primeng/tooltip';
import { ConfirmDialogModule } from 'primeng/confirmdialog';


@Component({
    selector: 'app-user-list',
    standalone: true,
    imports: [
        CommonModule,
        ReactiveFormsModule,
        TableModule,
        InputTextModule,
        InputNumberModule,
        PasswordModule,
        ButtonModule,
        IconFieldModule,
        InputIconModule,
        TooltipModule,
        DialogModule,
        ConfirmDialogModule
    ],
    templateUrl: './user-list.component.html',
    styleUrls: ['./user-list.component.css']
})
export class UserListComponent implements OnInit {

    users: UserDto[] = [];
    loading = false;
    totalRecords = 0;

    userDialog = false;
    userForm!: FormGroup;
    submitted = false;
    isEditMode = false;
    selectedUserId: number | null = null;

    constructor(
        private readonly userService: UserService,
        private readonly msgService: MessageService,
        private readonly formBuilder: FormBuilder,
        private readonly confirmationService: ConfirmationService
    ) { }

    ngOnInit(): void {
        this.getAllUsers();
        this.initForm();
    }

    initForm(): void {
        this.userForm = this.formBuilder.group({
            name: ['', [Validators.required, Validators.minLength(2)]],
            lastName: ['', [Validators.required, Validators.minLength(2)]],
            dni: ['', [Validators.required, Validators.pattern('^[0-9]{10}$')]],
            phone: ['', [Validators.required, Validators.pattern('^[0-9]{10}$')]],
            address: ['', [Validators.required, Validators.minLength(5)]],
            age: [18, [Validators.required, Validators.min(18), Validators.max(100)]],
            username: ['', [Validators.required, Validators.minLength(4)]],
            email: ['', [Validators.required, Validators.email]],
            password: ['']
        });
    }


    getAllUsers(): void {
        this.loading = true;
        this.userService.getAllListUser().subscribe({
            next: (data: UserDto[]) => {
                this.users = data;
                this.totalRecords = data.length;
                this.loading = false;
            },
            error: (error: HttpErrorResponse) => {
                console.error(error);
                this.msgService.add({
                    severity: 'error',
                    summary: 'Error',
                    detail: error.error?.message || 'No se pudieron cargar los usuarios'
                });
                this.loading = false;
            }
        });
    }

    openNew(): void {
        this.isEditMode = false;
        this.selectedUserId = null;
        this.submitted = false;
        this.userForm.reset({ age: 18 });
        this.setPasswordValidation(true);
        this.userDialog = true;
    }

    editUser(user: UserDto): void {
        this.isEditMode = true;
        this.selectedUserId = user.id;
        this.submitted = false;

        this.userForm.patchValue({
            name: user.name,
            lastName: user.lastName,
            dni: user.dni,
            phone: user.phone,
            address: user.address,
            age: user.age,
            username: user.username,
            email: user.email
        });

        this.setPasswordValidation(false);
        this.userDialog = true;
    }

    setPasswordValidation(isRequired: boolean): void {
        const passwordControl = this.userForm.get('password');
        if (isRequired) {
            passwordControl?.setValidators([Validators.required, Validators.minLength(6)]);
        } else {
            passwordControl?.clearValidators();
        }
        passwordControl?.updateValueAndValidity();
    }

    hideDialog(): void {
        this.userDialog = false;
        this.submitted = false;
        this.isEditMode = false;
        this.selectedUserId = null;
    }

    saveUser(): void {
        this.submitted = true;

        if (this.userForm.invalid) {
            this.msgService.add({
                severity: 'warn',
                summary: 'Advertencia',
                detail: 'Por favor, completa correctamente todos los campos requeridos'
            });
            return;
        }

        if (this.isEditMode) {
            this.updateUser();
        } else {
            this.createUser();
        }
    }

    createUser(): void {
        const createDto: CreateUserDto = this.userForm.value;

        this.userService.createUser(createDto).subscribe({
            next: (user: UserDto) => {
                this.users.push(user);
                this.totalRecords = this.users.length;
                this.msgService.add({
                    severity: 'success',
                    summary: 'Éxito',
                    detail: 'Usuario creado correctamente'
                });
                this.hideDialog();
            },
            error: (error: HttpErrorResponse) => {
                console.error(error);
                this.msgService.add({
                    severity: 'error',
                    summary: 'Error',
                    detail: error.error?.message || 'No se pudo crear el usuario'
                });
            }
        });
    }

    updateUser(): void {
        const formValue = this.userForm.value;
        const updateData: UpdateUserDto = {
            name: formValue.name,
            lastName: formValue.lastName,
            dni: formValue.dni,
            phone: formValue.phone,
            address: formValue.address,
            age: formValue.age,
            username: formValue.username,
            email: formValue.email,
            password: formValue.password
        };

        if (formValue.password && formValue.password.trim() !== '') {
            updateData.password = formValue.password;
        }

        this.userService.updateUser(this.selectedUserId!, updateData).subscribe({
            next: (updatedUser: UserDto) => {
                const index = this.users.findIndex(u => u.id === this.selectedUserId);
                if (index !== -1) {
                    this.users[index] = updatedUser;
                }
                this.msgService.add({
                    severity: 'success',
                    summary: 'Éxito',
                    detail: 'Usuario actualizado correctamente'
                });
                this.hideDialog();
            },
            error: (error: HttpErrorResponse) => {
                console.error(error);
                this.msgService.add({
                    severity: 'error',
                    summary: 'Error',
                    detail: error.error?.message || 'No se pudo actualizar el usuario'
                });
            }
        });
    }

    deleteUser(user: UserDto): void {
        this.confirmationService.confirm({
            message: `¿Estás seguro de que deseas ocultar al usuario <strong>${user.username}</strong>?<br><small class="text-surface-500">Esta acción cambiará el estado del usuario a inactivo.</small>`,
            header: 'Confirmar Eliminación',
            icon: 'pi pi-exclamation-triangle',
            acceptLabel: 'Sí, ocultar',
            rejectLabel: 'Cancelar',
            acceptButtonStyleClass: 'p-button-danger p-button-sm',
            rejectButtonStyleClass: 'p-button-secondary p-button-outlined p-button-sm',
            accept: () => {
                this.userService.deleteUser(user.id).subscribe({
                    next: () => {
                        this.users = this.users.filter(u => u.id !== user.id);
                        this.totalRecords = this.users.length;
                        this.msgService.add({
                            severity: 'success',
                            summary: 'Usuario Oculto',
                            detail: `El usuario ${user.username} ha sido ocultado correctamente`
                        });
                    },
                    error: (error: HttpErrorResponse) => {
                        console.error(error);
                        this.msgService.add({
                            severity: 'error',
                            summary: 'Error',
                            detail: error.error?.message || 'No se pudo ocultar el usuario'
                        });
                    }
                });
            },
            reject: () => {
                this.msgService.add({
                    severity: 'info',
                    summary: 'Cancelado',
                    detail: 'Operación cancelada'
                });
            }
        });
    }

    onGlobalFilter(table: Table, event: Event): void {
        table.filterGlobal((event.target as HTMLInputElement).value, 'contains');
    }

    clearTableFilters(table: Table): void {
        table.clear();
    }

    exportToExcel(): void {
        this.msgService.add({
            severity: 'info',
            summary: 'Exportar',
            detail: 'Funcionalidad en desarrollo'
        });
    }

    isFieldInvalid(fieldName: string): boolean {
        const field = this.userForm.get(fieldName);
        return !!(field && field.invalid && (field.dirty || field.touched || this.submitted));
    }

    getFieldError(fieldName: string): string {
        const field = this.userForm.get(fieldName);
        if (field?.errors) {
            if (field.errors['required']) return 'Este campo es requerido';
            if (field.errors['email']) return 'Email inválido';
            if (field.errors['minlength']) return `Mínimo ${field.errors['minlength'].requiredLength} caracteres`;
            if (field.errors['pattern']) return 'Formato inválido';
            if (field.errors['min']) return `Valor mínimo: ${field.errors['min'].min}`;
            if (field.errors['max']) return `Valor máximo: ${field.errors['max'].max}`;
        }
        return '';
    }

    deleteForceUser(user: UserDto): void {
        this.confirmationService.confirm({
            message: `<strong class="text-red-600">⚠️ ADVERTENCIA</strong><br>¿Estás seguro de que deseas eliminar <strong>DEFINITIVAMENTE</strong> al usuario <strong>${user.username}</strong>?<br><small class="text-surface-500">Esta acción es <strong>irreversible</strong> y eliminará todos los datos permanentemente.</small>`,
            header: 'Eliminar Definitivamente',
            icon: 'pi pi-trash',
            acceptLabel: 'Sí, eliminar',
            rejectLabel: 'Cancelar',
            acceptButtonStyleClass: 'p-button-danger p-button-sm',
            rejectButtonStyleClass: 'p-button-secondary p-button-outlined p-button-sm',
            accept: () => {
                this.userService.deleteForceUser(user.id).subscribe({
                    next: () => {
                        this.users = this.users.filter(u => u.id !== user.id);
                        this.totalRecords = this.users.length;
                        this.msgService.add({
                            severity: 'success',
                            summary: 'Usuario Eliminado',
                            detail: `El usuario ${user.username} ha sido eliminado definitivamente`
                        });
                    },
                    error: (error: HttpErrorResponse) => {
                        console.error(error);
                        this.msgService.add({
                            severity: 'error',
                            summary: 'Error',
                            detail: error.error?.message || 'No se pudo eliminar el usuario'
                        });
                    }
                });
            }
        });
    }
}
