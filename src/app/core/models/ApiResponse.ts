export interface ApiResponse<T> {
    success: boolean
    message: string
    data: T
    errorCode: string | null
    validationErrors: any | null
    timestamp: string
    requestId: string
}
