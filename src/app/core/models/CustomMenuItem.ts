import { MenuItem } from "primeng/api";

export interface CustomMenuItem extends MenuItem {
    requiredRoles?: string[]; // Roles necesarios para que este ítem sea visible
    isAuthenticated?: boolean; // Indica si el usuario debe estar autenticado para ver el ítem
}