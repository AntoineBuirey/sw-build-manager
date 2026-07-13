import { Status } from "./status";

export class Microcontroller {
    id: number;
    
    name: string;
    description: string;
    workshop_link: string;
    creation_date: Date;
    status: Status;
    last_update: Date;

    constructor(id: number, name: string, description: string, workshop_link: string, creation_date: Date, status: Status, last_update: Date) {
        this.id = id;
        this.name = name;
        this.description = description;
        this.workshop_link = workshop_link;
        this.creation_date = creation_date;
        this.status = status;
        this.last_update = last_update;
    }
}