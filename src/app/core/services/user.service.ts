import { HttpClient, HttpHeaders } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { environment } from 'src/environments/environment';
import { UserDto } from '../models/UserDto';
import { ApiResponse } from '../models/ApiResponse';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { CreateUserDto } from '@/core/models/CreateUserDto';
import { UpdateUserDto } from '@/core/models/UpdateUserDto';
import { WorkItemDto } from '@/core/models/WorkItemDto';

@Injectable({
    providedIn: 'root'
})
export class UserService {
    private readonly baseUrl = environment.apiUrl + '/Users';
    private readonly http = inject(HttpClient);

    private getHeaders(): HttpHeaders {
        const token = localStorage.getItem('token');
        return new HttpHeaders({
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        });
    }

    getAllListUser(): Observable<UserDto[]> {
        return this.http.get<ApiResponse<UserDto[]>>(`${this.baseUrl}/all`, { headers: this.getHeaders() }).pipe(
            map(response => response.data)
        );
    }

    createUser(createDto: CreateUserDto): Observable<UserDto> {
        return this.http.post<ApiResponse<UserDto>>(`${this.baseUrl}/createUser`, createDto, { headers: this.getHeaders() }).pipe(
            map(response => response.data)
        );
    }
    updateUser(id: number, updateDto: UpdateUserDto): Observable<UserDto> {
        return this.http.put<ApiResponse<UserDto>>(`${this.baseUrl}/updateUserById/${id}`, updateDto, { headers: this.getHeaders() }).pipe(
            map(response => response.data)
        );
    }
    deleteUser(id: number): Observable<UserDto> {
        return this.http.delete<ApiResponse<UserDto>>(`${this.baseUrl}/deleteLogicUserById/${id}`, { headers: this.getHeaders() }).pipe(
            map(response => response.data)
        );
    }
    deleteForceUser(id: number): Observable<UserDto> {
        return this.http.delete<ApiResponse<UserDto>>(`${this.baseUrl}/deleteForceUserById/${id}`, { headers: this.getHeaders() }).pipe(
            map(response => response.data)
        );
    }

    getWorkItemsByUser(userId: number): Observable<WorkItemDto[]> {
        return this.http.get<ApiResponse<WorkItemDto[]>>(`${this.baseUrl}/${userId}/work-items`, { headers: this.getHeaders() }).pipe(
            map(response => response.data)
        );
    }

    getWorkItemsByStatus(status: string): Observable<WorkItemDto[]> {
        return this.http.get<ApiResponse<WorkItemDto[]>>(`${this.baseUrl}/status/${status}`, { headers: this.getHeaders() }).pipe(
            map(response => response.data)
        );
    }
}
