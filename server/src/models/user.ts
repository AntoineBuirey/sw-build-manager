
export type UserName = string;

export class User {
    name: string;
    hashed_password: string;

    constructor(name: UserName, hashed_password: string) {
        this.name = name;
        this.hashed_password = hashed_password;
    }
}