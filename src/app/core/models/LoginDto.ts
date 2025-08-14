export interface LoginDto {
    message: string;
    responseTimeMs: number;
    token: string;
    user: {
        id_us: number;
        name_us: string;
        lastname_us: string;
        email_us: string;
        password_us: string | null;
        rol: string;
        dni_us: string;
        image_us: string | null;
        birthday_us: string; // o Date si lo conviertes
        phone_us: string;
        nationality_us: string;
        gender_us: string;
        terms_and_conditions: string;
        age_us: number;
    };
}
