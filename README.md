# sw-creation-manager

## Idea

A tool to manage creations in the game stormworks: build & rescue. Hold data for creations.

### Some tabs :

- **Manufacturer** : 
  - List of all manufacturers
  - Add a new manufacturer
  - Edit a manufacturer
  - Delete a manufacturer

- **Operators** :
  - List of all operators
  - Add a new operator
  - Edit an operator
  - Delete an operator

- **Creations** :
  - List of all creations
  - Add a new creation
  - Edit a creation
  - Delete a creation

- **Microcontrollers** :
  - List of all microcontrollers
  - Add a new microcontroller
  - Edit a microcontroller
  - Delete a microcontroller


### Manufacturer data

The company that created the creation.

- **Name** : Name of the manufacturer
- **Description** : Description of the manufacturer
- **Logo** : Logo of the manufacturer

### Operator

The company that operates the creation.

- **Name** : Name of the operator
- **Description** : Description of the operator
- **Logo** : Logo of the operator

### Creation

The creation itself.

- Primary data

  -**Id** : Unique identifier of the creation
  - **Code** : Code of the creation, created automatically from other data
  - **Name** : Name of the creation
  - **Type** : Type of the creation (Aircraft, Boat, Car, Building, etc.)
  - **Usage** : Usage of the creation (SAR, Firefighting, Transport, Fun, etc.)
  - **Last update** : Date of the last update of the creation
  - **Status** : Status of the creation (In development, Published, Archived, etc.)

- Detailed data

  - **Description** : Description of the creation
  - **Workshop link** : Link to the creation on the workshop if published
  - **Manufacturer** : Company that created the creation
  - **Operator** : Company that operates the creation
  - **Creation date** : Date of creation

### Microcontroller

- **Name** : Name of the microcontroller
- **Description** : Description of the microcontroller
- **Workshop link** : Link to the microcontroller on the workshop if published
- **Creation date** : Date of creation
- **Status** : Status of the microcontroller (In development, Published, Archived, etc.)
- **Last update** : Date of the last update of the microcontroller
