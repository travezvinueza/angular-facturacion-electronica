import { Component, OnInit } from '@angular/core';
import { WorkItemDto } from '@/core/models/WorkItemDto';
import { MessageService } from 'primeng/api';
import { UserService } from '@/core/services/user.service';
import { HttpErrorResponse } from '@angular/common/http';
import { Table, TableModule } from 'primeng/table';
import { DatePipe, NgClass } from '@angular/common';
import { InputIcon } from 'primeng/inputicon';
import { IconField } from 'primeng/iconfield';
import { Button } from 'primeng/button';

@Component({
    selector: 'app-work-items',
    imports: [TableModule, NgClass, InputIcon, DatePipe, IconField, Button],
    templateUrl: './work-items.html',
    styleUrl: './work-items.scss'
})
export class WorkItemsComponent implements OnInit {
    workItems: WorkItemDto[] = [];
    loading = false;
    totalRecords = 0;

    constructor(
        private readonly userService: UserService,
        private readonly msgService: MessageService
    ) {}

    ngOnInit(): void {
        this.getPendingWorkItems();
    }

    getPendingWorkItems(): void {
        this.loading = true;
        this.userService.getWorkItemsByStatus('P').subscribe({
            next: (data: WorkItemDto[]) => {
                this.workItems = data;
                this.totalRecords = data.length;
                this.loading = false;
            },
            error: (error: HttpErrorResponse) => {
                console.error(error);
                this.msgService.add({
                    severity: 'error',
                    summary: 'Error',
                    detail: error.error?.message || 'No se pudieron cargar los work items'
                });
                this.loading = false;
            }
        });
    }

    getRelevanceIcon(relevance: number): string {
        if (relevance >= 8) return 'text-red-500';
        if (relevance >= 5) return 'text-orange-400';
        return 'text-green-500';
    }

    onGlobalFilter(table: Table, event: Event): void {
        table.filterGlobal((event.target as HTMLInputElement).value, 'contains');
    }

    clearTableFilters(table: Table): void {
        table.clear();
    }
}
