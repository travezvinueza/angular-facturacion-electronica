import { Routes } from '@angular/router';
import { Documentation } from './documentation/documentation';
import { Crud } from './crud/crud';
import { Empty } from './empty/empty';
import { UserListComponent } from './user/user-list/user-list.component';
import { GeocercasListComponent } from '@/pages/geocercas/geocercas-list/geocercas-list.component';
import { VendedoresComponent } from '@/pages/vendedores/vendedores.component';
import { OnlyGeocercasComponent } from '@/pages/onlygeocercas/only-geocercas.component';
import { ItemDetailComponent } from '@/pages/item-detail/item-detail.component';

export default [
    { path: 'documentation', component: Documentation },
    { path: 'crud', component: Crud },
    { path: 'empty', component: Empty },
    { path: 'geocercas', component: UserListComponent },
    { path: 'vendedores', component: GeocercasListComponent },
    { path: 'geocercas-vendedores', component: VendedoresComponent },
    { path: 'only-geocercas', component: OnlyGeocercasComponent },
    { path: 'item-detail', component: ItemDetailComponent },
    { path: '**', redirectTo: '/notfound' }
] as Routes;
