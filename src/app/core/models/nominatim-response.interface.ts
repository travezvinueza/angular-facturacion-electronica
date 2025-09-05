// interfaces/nominatim-response.interface.ts
export interface NominatimReverseResponse {
    place_id: number;
    licence: string;
    osm_type: string;
    osm_id: number;
    lat: string;
    lon: string;
    class: string;
    type: string;
    place_rank: number;
    importance: number;
    addresstype: string;
    name: string;
    display_name: string;
    address: {
        road?: string;
        quarter?: string;
        city_district?: string;
        city?: string;
        county?: string;
        plot?: string;
        postcode?: string;
        country?: string;
        country_code?: string;
    };
    boundingbox: string[];
}
