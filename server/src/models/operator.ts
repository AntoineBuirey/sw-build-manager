
export class Operator {
    id: number;
    name: string;
    description: string;
    logo: string;

    constructor(id: number, name: string, description: string, logo: string) {
        this.id = id;
        this.name = name;
        this.description = description;
        this.logo = logo;
    }
}
