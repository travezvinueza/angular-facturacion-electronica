export interface LoginDto {
    success: boolean
    message: string
    data: {
        accessToken: string
        userId: number
        username: string
        email: string
    }
}
