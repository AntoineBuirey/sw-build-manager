export type ManufacturerId = number;


export class Manufacturer {
    id: ManufacturerId;
    name: string;
    description: string;
    logo: string;

    constructor(id: ManufacturerId, name: string, description: string, logo: string) {
        this.id = id;
        this.name = name;
        this.description = description;
        this.logo = logo;
    }
}