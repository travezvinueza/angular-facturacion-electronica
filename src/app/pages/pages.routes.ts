import { Routes } from '@angular/router';
import { Documentation } from './documentation/documentation';
import { Crud } from './crud/crud';
import { Empty } from './empty/empty';
import { UserListComponent } from './user/user-list/user-list.component';
import { WorkItemsComponent } from '@/pages/work-items/work-items';

export default [
    { path: 'documentation', component: Documentation },
    { path: 'crud', component: Crud },
    { path: 'empty', component: Empty },
    { path: 'user-list', component: UserListComponent },
    { path: 'work-items', component: WorkItemsComponent },

    { path: '**', redirectTo: '/notfound' }
] as Routes;
