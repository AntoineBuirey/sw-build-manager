
export type OperatorId = number;

export class Operator {
    id: OperatorId;
    name: string;
    description: string;
    logo: string;

    constructor(id: OperatorId, name: string, description: string, logo: string) {
        this.id = id;
        this.name = name;
        this.description = description;
        this.logo = logo;
    }
}
