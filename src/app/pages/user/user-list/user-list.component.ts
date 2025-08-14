import { UserDto } from '@/core/models/UserDto';
import { UserService } from '@/core/services/user.service';
import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, ViewChild } from '@angular/core';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { ConfirmationService, MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { DialogModule } from 'primeng/dialog';
import { IconFieldModule } from 'primeng/iconfield';
import { InputIconModule } from 'primeng/inputicon';
import { InputNumberModule } from 'primeng/inputnumber';
import { InputTextModule } from 'primeng/inputtext';
import { RippleModule } from 'primeng/ripple';
import { Table, TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { TextareaModule } from 'primeng/textarea';
import { ToolbarModule } from 'primeng/toolbar';

@Component({
  selector: 'app-user-list',
  imports: [
     CommonModule,
    TableModule,
    FormsModule,
    InputTextModule,
    ButtonModule,
    RippleModule,
    ToolbarModule,
    TextareaModule,
    InputNumberModule,
    DialogModule,
    TagModule,
    InputIconModule,
    IconFieldModule,
    ReactiveFormsModule,
    ConfirmDialogModule,
    DialogModule,
  ],
  templateUrl: './user-list.component.html',
  styleUrls: ['./user-list.component.css']
})
export class UserListComponent implements OnInit {

  userDialog: boolean = false;

  user!: UserDto;

  users: UserDto[] = [];

   @ViewChild('dt') dt!: Table;

  submitted: boolean = false;

  rowsPerPageOptions: number[] = [5, 10, 20];

  userForm!: FormGroup;

    constructor(
    private readonly formBuilder: FormBuilder,
    private readonly userService: UserService,
    private readonly confirmationService: ConfirmationService,
    private readonly msgService: MessageService,
  ) { }

 ngOnInit(): void {
    this.getAllUsers();
    this.userForm = this.formBuilder.group({
      id_us: [0],
      name_us: ['',[Validators.required]],
      lastname_us: ['',[Validators.required]],
      email_us: ['',[Validators.required]],
      password_us: ['',[Validators.required]],
      role: ['',[Validators.required]],
      dni_us: ['',[Validators.required]],
      phone_us: ['',[Validators.required]],
      nationality_us: ['',[Validators.required]],
      gender_us: ['',[Validators.required]],
      terms_and_conditions: ['',[Validators.required]],
      age: [0],
    });
  }

  exportCSV() {
    this.dt.exportCSV();
}

getAllUsers() {
  this.userService.getAllListUser().subscribe({
    next: (data: any) => (this.users = data),
    error: (error: HttpErrorResponse) => console.error(error),
  });
}

onGlobalFilter(table: Table, event: Event) {
  table.filterGlobal((event.target as HTMLInputElement).value, 'contains');
}

openNew() {
this.userForm.reset();
  this.submitted = false;
  this.userDialog = true;
}

editUser(user: UserDto) {
  this.userForm.patchValue({ ...user });
  this.userDialog = true;
}

  deleteUser(user: UserDto) {
    this.confirmationService.confirm({
      message: 'Are you sure you want to delete ' + user.name_us + '?',
      header: 'Confirm',
      icon: 'pi pi-exclamation-triangle',
      accept: () => {
        this.userService.deleteUser(user.id_us).subscribe((data) => {
          this.getAllUsers();
          this.msgService.add({
            severity: 'success',
            summary: 'Éxito',
            detail: 'Usuario eliminado exitosamente.',
          });
        });
      }
    });
  }

  hideDialog() {
    this.submitted = false;
  }

  createId(): string {
    let id = '';
    let chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 5; i++) {
      id += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return id;
  }

    saveUser() {

    if (this.userForm.invalid) {
      this.isTouched();
      return;
    }

    if (this.userForm.get('id')?.value) {
      this.userService.updateUser( this.userForm.get('id')?.value, this.userForm.value as UserDto).subscribe((data) => {
        this.user = data;
        this.getAllUsers();
        this.msgService.add({ severity: 'success', summary: 'Usuario Updated', detail: 'Role ' + this.user.name_us + ' updated successfully' });
      })

    } else {
      console.log(this.userForm.value);
      this.userService.createUser(this.userForm.value).subscribe({
        next: () => {
          this.getAllUsers();
          this.msgService.add({
            severity: 'success',
            summary: 'Éxito',
            detail: 'Usuario creado exitosamente.',
          });
          this.userForm.reset();

        },
        error: (error: HttpErrorResponse) => {
          console.error(error);
          this.msgService.add({ severity: 'error', summary: 'Error', detail: 'Error al crear el usuario', });
        },
      });
    }
    this.userDialog = false;
  }

  isTouched() {
    Object.values(this.userForm.controls).forEach((control) => {
      control.markAsTouched();
    });
  }

  isRequire(controlName: string, errorType: string) {
    const control = this.userForm.get(controlName);
    return control?.invalid && control.errors?.[errorType] && (control.touched || control.dirty);
  }

  isInvalid(controlName: string): boolean {
    const control = this.userForm.get(controlName);
    return !!control && control.invalid && (control.dirty || control.touched);
  }


}
