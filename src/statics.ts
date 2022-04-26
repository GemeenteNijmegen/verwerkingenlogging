export abstract class Statics {

  /**
   * Project name.
   */
  static readonly projectName: string = 'verwerkingenlogging';

  /**
   * DynamoDB table name for verwerkingen.
   */
  static readonly verwerkingenTableName: 'verwerkingen-table';

  /**
   * Codestar connection ARN to connect to GitHub.
   */
  static readonly connectionArn: string = 'arn:aws:codestar-connections:eu-west-1:418648875085:connection/4f647929-c982-4f30-94f4-24ff7dbf9766';
}