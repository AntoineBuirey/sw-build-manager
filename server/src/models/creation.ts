import { Manufacturer } from "./manufacturer";
import { Operator } from "./operator";
import { CreationType } from "./creation_type";
import { Usage } from "./creation_usage";
import { Status } from "./status";

export class Creation {
    name: string;
    code: string;
    description: string;
    workshop_link: string;
    manufacturer: Manufacturer;
    operator: Operator;
    type: CreationType;
    usage: Usage;
    creation_date: Date;
    status: Status;
    last_update: Date;

    constructor(name: string, code: string, description: string, workshop_link: string, manufacturer: Manufacturer, operator: Operator,
        type: CreationType, usage: Usage, creation_date: Date, status: Status, last_update: Date) {
        this.name = name;
        this.code = code;
        this.description = description;
        this.workshop_link = workshop_link;
        this.manufacturer = manufacturer;
        this.operator = operator;
        this.type = type;
        this.usage = usage;
        this.creation_date = creation_date;
        this.status = status;
        this.last_update = last_update;
    }
}
