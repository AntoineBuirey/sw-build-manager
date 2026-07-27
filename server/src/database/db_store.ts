import {
    Creation, CreationCode, CreationLite, CreationId,
    Manufacturer, ManufacturerId,
    Microcontroller, MicrocontrollerId,
    Operator, OperatorId,
    UserName, User,
    Token, TokenId
} from "../models";
import { logger } from "../utility/logger";

export interface DbStore {
    connect(): Promise<void>;
    close(): Promise<void>;

     /**
     * Creates a new creation in the database. Fail if a creation with the same code already exists. Return the id of the newly created creation.
     * @param creation The creation to create.
     * @returns The code of the newly created creation.
     * @throws Error if a creation with the same code already exists.
     */
    createCreation(creation: CreationLite): Promise<CreationId>;

    /**
     * Retrieves a creation from the database by its code. Returns null if no creation with the given code exists.
     * @param code The code of the creation to retrieve.
     * @returns The creation with the given code, or null if no such creation exists.
     */
    getCreation(code: CreationCode): Promise<Creation | null>;

    /**
     * Retrieves all creations from the database. Returns an array of CreationLite objects, which contain only the code, name, type, usage, last_update, and status of each creation.
     * @returns An array of CreationLite objects representing all creations in the database.
     * @throws Error if there is an issue retrieving the creations from the database.
     */
    getAllCreations(): Promise<CreationLite[]>;

    /**
     * Updates an existing creation in the database. The creation is identified by its code. If no creation with the given code exists, an error is thrown.
     * @param creation The creation to update.
     * @throws Error if no creation with the given code exists.
     * @throws Error if there is an issue updating the creation in the database.
     */
    updateCreation(creation: Creation): Promise<void>;

    /**
     * Deletes a creation from the database by its code. If no creation with the given code exists, an error is thrown.
     * @param code The code of the creation to delete.
     * @throws Error if no creation with the given code exists.
     * @throws Error if there is an issue deleting the creation from the database.
     */
    deleteCreation(code: CreationCode): Promise<void>;

    /**
     * Creates a new manufacturer in the database. Returns the ID of the newly created manufacturer.
     * @param manufacturer The manufacturer to create.
     * @returns The ID of the newly created manufacturer.
     * @throws Error if there is an issue creating the manufacturer in the database.
     */
    createManufacturer(manufacturer: Manufacturer): Promise<ManufacturerId>;

    /**
     * Retrieves a manufacturer from the database by its ID. Returns null if no manufacturer with the given ID exists.
     * @param id The ID of the manufacturer to retrieve.
     * @returns The manufacturer with the given ID, or null if no such manufacturer exists.
     */
    getManufacturer(id: ManufacturerId): Promise<Manufacturer | null>;

    /**
     * Retrieves all manufacturers from the database. Returns an array of Manufacturer objects.
     * @returns An array of Manufacturer objects representing all manufacturers in the database.
     * @throws Error if there is an issue retrieving the manufacturers from the database.
     */
    getAllManufacturers(): Promise<Manufacturer[]>;

    /**
     * Updates an existing manufacturer in the database. The manufacturer is identified by its ID. If no manufacturer with the given ID exists, an error is thrown.
     * @param manufacturer The manufacturer to update.
     * @throws Error if no manufacturer with the given ID exists.
     * @throws Error if there is an issue updating the manufacturer in the database.
     */
    updateManufacturer(manufacturer: Manufacturer): Promise<void>;

    /**
     * Deletes a manufacturer from the database by its ID. If no manufacturer with the given ID exists, an error is thrown.
     * @param id The ID of the manufacturer to delete.
     * @throws Error if no manufacturer with the given ID exists.
     * @throws Error if there is an issue deleting the manufacturer from the database.
     */
    deleteManufacturer(id: ManufacturerId): Promise<void>;

    /**
     * Creates a new microcontroller in the database. Returns the ID of the newly created microcontroller.
     * @param microcontroller The microcontroller to create.
     * @returns The ID of the newly created microcontroller.
     * @throws Error if there is an issue creating the microcontroller in the database.
     */
    createMicrocontroller(microcontroller: Microcontroller): Promise<MicrocontrollerId>;

    /**
     * Retrieves a microcontroller from the database by its ID. Returns null if no microcontroller with the given ID exists.
     * @param id The ID of the microcontroller to retrieve.
     * @returns The microcontroller with the given ID, or null if no such microcontroller exists.
     */
    getMicrocontroller(id: MicrocontrollerId): Promise<Microcontroller | null>;

    /**
     * Retrieves all microcontrollers from the database. Returns an array of Microcontroller objects.
     * @returns An array of Microcontroller objects representing all microcontrollers in the database.
     * @throws Error if there is an issue retrieving the microcontrollers from the database.
     */
    getAllMicrocontrollers(): Promise<Microcontroller[]>;

    /**
     * Updates an existing microcontroller in the database. The microcontroller is identified by its ID. If no microcontroller with the given ID exists, an error is thrown.
     * @param microcontroller The microcontroller to update.
     * @throws Error if no microcontroller with the given ID exists.
     * @throws Error if there is an issue updating the microcontroller in the database.
     */
    updateMicrocontroller(microcontroller: Microcontroller): Promise<void>;

    /**
     * Deletes a microcontroller from the database by its ID. If no microcontroller with the given ID exists, an error is thrown.
     * @param id The ID of the microcontroller to delete.
     * @throws Error if no microcontroller with the given ID exists.
     * @throws Error if there is an issue deleting the microcontroller from the database.
     */
    deleteMicrocontroller(id: MicrocontrollerId): Promise<void>;

    /**
     * Creates a new operator in the database. Returns the ID of the newly created operator.
     * @param operator The operator to create.
     * @returns The ID of the newly created operator.
     * @throws Error if there is an issue creating the operator in the database.
     */
    createOperator(operator: Operator): Promise<OperatorId>;

    /**
     * Retrieves an operator from the database by its ID. Returns null if no operator with the given ID exists.
     * @param id The ID of the operator to retrieve.
     * @returns The operator with the given ID, or null if no such operator exists.
     */
    getOperator(id: OperatorId): Promise<Operator | null>;

    /**
     * Retrieves all operators from the database. Returns an array of Operator objects.
     * @returns An array of Operator objects representing all operators in the database.
     * @throws Error if there is an issue retrieving the operators from the database.
     */
    getAllOperators(): Promise<Operator[]>;

    /**
     * Updates an existing operator in the database. The operator is identified by its ID. If no operator with the given ID exists, an error is thrown.
     * @param operator The operator to update.
     * @throws Error if no operator with the given ID exists.
     * @throws Error if there is an issue updating the operator in the database.
     */
    updateOperator(operator: Operator): Promise<void>;

    /**
     * Deletes an operator from the database by its ID. If no operator with the given ID exists, an error is thrown.
     * @param id The ID of the operator to delete.
     * @throws Error if no operator with the given ID exists.
     * @throws Error if there is an issue deleting the operator from the database.
     */
    deleteOperator(id: OperatorId): Promise<void>;

    /**
     * Creates a new user in the database with the given username and password. The password is stored as a hashed value for security. If a user with the same username already exists, an error is thrown.
     * @param username The username of the new user.
     * @param password The password of the new user.
     * @throws Error if a user with the same username already exists.
     * @throws Error if there is an issue creating the user in the database.
     */
    createUser(user: User): Promise<void>;

    /**
     * Retrieves a user from the database by their username. Returns null if no user with the given username exists.
     * @param username The username of the user to retrieve.
     * @returns The user with the given username, or null if no such user exists.
     * @throws Error if there is an issue retrieving the user from the database.
     */
    getUser(username: UserName): Promise<User | null>;

    /**
     * Retrieves all users from the database. Returns an array of User objects.
     * @returns An array of User objects representing all users in the database.
     * @throws Error if there is an issue retrieving the users from the database.
     */
    getAllUsers(): Promise<User[]>;

    /**
     * Deletes a user from the database by their username. If no user with the given username exists, an error is thrown.
     * @param username The username of the user to delete.
     * @throws Error if no user with the given username exists.
     * @throws Error if there is an issue deleting the user from the database.
     */
    deleteUser(username: UserName): Promise<void>;

    /**
     * Updates an existing user's password in the database. The user is identified by their username. If no user with the given username exists, an error is thrown.
     * @param username The username of the user to update.
     * @param newPassword The new password for the user.
     * @throws Error if no user with the given username exists.
     * @throws Error if there is an issue updating the user's password in the database.
     */
    updateUserPassword(username: UserName, newPassword: string): Promise<void>;

    /**
     * Checks if a user with the given username exists in the database.
     * @param username The username to check for existence.
     * @returns True if a user with the given username exists, false otherwise.
     * @throws Error if there is an issue checking for the user's existence in the database.
     */
    userExists(username: UserName): Promise<boolean>;



    //auth_tokens

    /**
     * Retreive a user by their auth token. Returns null if no user with the given auth token exists.
     * @param authToken The auth token of the user to retrieve.
     * @returns The user with the given auth token, or null if no such user exists.
     * @throws Error if there is an issue retrieving the user from the database.
     */
    getUserByAuthToken(authToken: string): Promise<User | null>;

    /**
     * Creates a new auth token for a user in the database. The auth token is associated with the user's username. If a user with the given username does not exist, an error is thrown.
     * @param token The auth token to create.
     * @throws Error if no user with the given username exists.
     * @throws Error if there is an issue creating the auth token in the database.
     */
    createAuthToken(token: Token): Promise<void>;

    /**
     * Deletes an auth token from the database. If no auth token with the given value exists, an error is thrown.
     * @param authToken The auth token to delete.
     * @throws Error if no auth token with the given value exists.
     * @throws Error if there is an issue deleting the auth token from the database.
     */
    deleteAuthToken(authToken: string): Promise<void>;

    /**
     * Deletes all expired auth tokens from the database. An auth token is considered expired if its expiration date is in the past. This method does not throw an error if there are no expired auth tokens to delete.
     * @throws Error if there is an issue deleting the expired auth tokens from the database.
     */
    deleteExpiredAuthTokens(): Promise<void>;

    /**
     * Checks if an auth token is valid. An auth token is considered valid if it exists in the database and its expiration date is in the future. Returns true if the auth token is valid, false otherwise.
     * @param authToken The auth token to check for validity.
     * @returns True if the auth token is valid, false otherwise.
     * @throws Error if there is an issue checking the validity of the auth token in the database.
     */
    isAuthTokenValid(authToken: string): Promise<boolean>;
    
}
