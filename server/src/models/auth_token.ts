import { UserName } from "./user";

export type TokenId = number;

export class Token {
    id: TokenId;
    username: UserName;
    token: string;
    expiration_date: Date;

    constructor(id: TokenId, username: UserName, token: string, expiration_date: Date) {
        this.id = id;
        this.username = username;
        this.token = token;
        this.expiration_date = expiration_date;
    }
}