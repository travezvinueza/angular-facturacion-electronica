export interface GeocercaValidationResponse {
    success: boolean;
    message: string;
    data: any;
    errorCode: string;
    validationErrors: any;
    timestamp: string;
    responseTimeMs: number;
    requestId: string;
}
